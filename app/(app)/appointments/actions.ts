"use server";

import { revalidatePath } from "next/cache";

import { sumPayments } from "@/lib/appointments";
import { formatRupiah } from "@/lib/currency";
import { createClient } from "@/lib/supabase/server";
import { normalizeError } from "@/lib/errors";
import {
  PAYMENT_KINDS,
  type AppointmentInput,
  type AppointmentStatus,
  type PaymentInput,
  type PaymentKind,
  type PaymentMethod,
} from "@/types/appointment";

type Result = { error?: string };
type Supabase = Awaited<ReturnType<typeof createClient>>;

const nz = (v?: string | null) => (v && v.trim() !== "" ? v.trim() : null);

// "" -> null; status KHÔNG nằm đây — do server điều khiển (create/transition).
// Tiền không nằm đây — tổng giá ghi vào SỔ (service_ledgers), không phải lịch.
function clean(input: AppointmentInput) {
  return {
    technician_id: nz(input.technician_id),
    scheduled_at: input.scheduled_at ?? null,
    duration_minutes: input.duration_minutes ?? 60,
    source: nz(input.source),
    payment_method: input.payment_method ?? null,
    booking_note: nz(input.booking_note),
    internal_note: nz(input.internal_note),
  };
}

async function validateTechnician(
  supabase: Supabase,
  technicianId: string | null | undefined,
) {
  const id = nz(technicianId);
  if (!id) return;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", id)
    .eq("department", "technician")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Kỹ thuật viên không tồn tại hoặc không hoạt động.");
}

// Dịch vụ bắt buộc đúng 1 mỗi lịch hẹn (trust boundary — không tin client).
function singleService(serviceIds: string[] | undefined): string | null {
  return serviceIds?.length === 1 ? serviceIds[0] : null;
}

/** Sổ MỞ của (khách, dịch vụ) — chưa có thì tạo. Mọi lịch hẹn cùng cặp dùng
 *  chung sổ này (tổng giá + dòng tiền). Race 2 người cùng tạo: unique partial
 *  index nổ 23505 → đọc lại sổ người kia vừa tạo. */
async function resolveLedger(
  supabase: Supabase,
  customerId: string,
  serviceId: string,
  userId: string | null,
): Promise<string> {
  const findOpen = () =>
    supabase
      .from("service_ledgers")
      .select("id")
      .eq("customer_id", customerId)
      .eq("service_id", serviceId)
      .is("closed_at", null)
      .maybeSingle();
  const { data: found, error } = await findOpen();
  if (error) throw error;
  if (found) return found.id;
  const { data: created, error: insErr } = await supabase
    .from("service_ledgers")
    .insert({ customer_id: customerId, service_id: serviceId, created_by: userId })
    .select("id")
    .single();
  if (!insErr) return created.id;
  if (insErr.code !== "23505") throw insErr;
  const { data: again, error: e2 } = await findOpen();
  if (e2) throw e2;
  if (!again) throw insErr;
  return again.id;
}

// Ghi tổng giá liệu trình lên sổ — chỉ khi client GỬI field (undefined = không đụng).
async function setLedgerTotal(
  supabase: Supabase,
  ledgerId: string,
  total: number | null | undefined,
) {
  if (total === undefined) return;
  const { error } = await supabase
    .from("service_ledgers")
    .update({ total_amount: total })
    .eq("id", ledgerId);
  if (error) throw error;
}

/** Chặn thu/cọc vượt tổng phải thu của sổ, gồm giá liệu trình và upsale.
 *  Trả message lỗi hoặc null nếu hợp lệ. Sổ chưa báo giá (total null) và
 *  refund không chặn. Gọi TRƯỚC mọi mutation của caller.
 *  ponytail: check app-level — 2 người thu đồng thời vẫn có thể lọt,
 *  nâng lên trigger DB khi thành vấn đề. */
async function overTotalError(
  supabase: Supabase,
  ledgerId: string | null,
  amount: number,
): Promise<string | null> {
  if (!ledgerId || amount <= 0) return null;
  const { data, error } = await supabase
    .from("service_ledgers")
    .select("total_amount, appointment_payments(kind, amount)")
    .eq("id", ledgerId)
    .single();
  if (error) throw error;
  const l = data as unknown as {
    total_amount: number | null;
    appointment_payments: { kind: PaymentKind; amount: number }[] | null;
  };
  const { data: ledgerAppointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select("id")
    .eq("ledger_id", ledgerId);
  if (appointmentsError) throw appointmentsError;
  const appointmentIds = (ledgerAppointments ?? []).map((row) => row.id);
  const upsaleQuery =
    appointmentIds.length > 0
      ? await supabase
          .from("appointment_upsales")
          .select("amount")
          .in("appointment_id", appointmentIds)
      : { data: [], error: null };
  if (upsaleQuery.error) throw upsaleQuery.error;
  const upsales = (upsaleQuery.data ?? []).reduce(
    (sum, row) => sum + row.amount,
    0,
  );
  if (l.total_amount == null && upsales === 0) return null;
  const payable =
    (l.total_amount ?? 0) + upsales;
  const left = payable - sumPayments(l.appointment_payments);
  return amount > left
    ? `Thu vượt tổng giá — còn phải thu tối đa ${formatRupiah(Math.max(left, 0))}.`
    : null;
}

async function currentUserId(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Đồng bộ bảng nối appointment_services (delete-all-insert, pattern customer_services).
// ponytail: 2 lệnh không transaction — lỗi giữa chừng chỉ mất tag dịch vụ, sửa lại
//           qua dialog; nâng cấp RPC khi thành vấn đề.
async function syncServices(
  supabase: Supabase,
  appointmentId: string,
  serviceIds: string[] | undefined,
) {
  if (serviceIds === undefined) return; // không gửi -> giữ nguyên
  const { error } = await supabase
    .from("appointment_services")
    .delete()
    .eq("appointment_id", appointmentId);
  if (error) throw error;
  if (serviceIds.length === 0) return;
  const { error: insErr } = await supabase.from("appointment_services").insert(
    serviceIds.map((service_id) => ({
      appointment_id: appointmentId,
      service_id,
    })),
  );
  if (insErr) throw insErr;
}

// Máy trạng thái: transition ngoài whitelist bị từ chối (Decision 1).
// checked_in → booked và completed → checked_in là HOÀN TÁC (bấm nhầm);
// checked_in → cancelled = khách đến nhưng không làm dịch vụ (giữ checked_in_at).
const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending_confirmation: ["booked", "cancelled"],
  booked: ["checked_in", "no_show", "cancelled"],
  checked_in: ["completed", "booked", "cancelled"],
  completed: ["checked_in"],
  no_show: ["booked"],
  cancelled: ["booked"],
};

// Stage khách hàng tương ứng với trạng thái lịch hẹn (null = không đụng).
function stageTargetFor(status: AppointmentStatus, deposit: number) {
  if (status === "booked") return "booked";
  if (status === "checked_in" || status === "completed") return "visited";
  if (status === "pending_confirmation" && deposit > 0) return "deposited";
  return null;
}

// Decision 11: stage chỉ đi TIẾN — chỉ nâng khi sort_order cao hơn hiện tại.
async function advanceCustomerStage(
  supabase: Supabase,
  customerId: string,
  target: string | null,
) {
  if (!target) return;
  const [custRes, stagesRes] = await Promise.all([
    supabase.from("customers").select("stage").eq("id", customerId).single(),
    supabase
      .from("enum_options")
      .select("value, sort_order")
      .eq("kind", "stage"),
  ]);
  if (custRes.error) throw custRes.error;
  const order = (v: string | null) =>
    stagesRes.data?.find((s) => s.value === v)?.sort_order ?? -1;
  if (order(target) <= order(custRes.data.stage)) return;
  const { error } = await supabase
    .from("customers")
    .update({ stage: target })
    .eq("id", customerId);
  if (error) throw error;
}

function refresh() {
  revalidatePath("/appointments");
  revalidatePath("/customers"); // /customers cũng hiện lịch hẹn của khách
}

// Ghi 1 dòng tiền vào SỔ (amount đã validate > 0 ở caller);
// appointment_id là dấu vết buổi thu.
async function insertPayment(
  supabase: Supabase,
  ledgerId: string | null,
  appointmentId: string,
  input: PaymentInput,
  userId: string | null,
) {
  const { error } = await supabase.from("appointment_payments").insert({
    ledger_id: ledgerId,
    appointment_id: appointmentId,
    kind: input.kind,
    amount: input.amount,
    payment_method: input.payment_method ?? null,
    image_url: nz(input.image_url),
    note: nz(input.note),
    received_by: input.received_by ?? userId,
    created_by: userId,
  });
  if (error) throw error;
}

export async function createAppointment(
  input: AppointmentInput,
): Promise<Result> {
  try {
    const serviceId = singleService(input.service_ids);
    if (!serviceId) return { error: "Chọn đúng một dịch vụ." };
    const supabase = await createClient();
    await validateTechnician(supabase, input.technician_id);
    const data = clean(input);
    // Có ngày giờ = đã đặt lịch; chưa có = cọc/chờ xếp lịch (Decision 12).
    const status: AppointmentStatus = data.scheduled_at
      ? "booked"
      : "pending_confirmation";
    const userId = await currentUserId(supabase);
    // Sổ tiền dùng chung của (khách, dịch vụ) — khách cũ cùng dịch vụ nối sổ cũ.
    const ledgerId = await resolveLedger(
      supabase,
      input.customer_id,
      serviceId,
      userId,
    );
    await setLedgerTotal(supabase, ledgerId, input.total_amount);
    // Cọc ban đầu = dòng deposit trong sổ — check vượt tổng TRƯỚC khi tạo lịch.
    const deposit = input.deposit?.amount ?? 0;
    const over = await overTotalError(supabase, ledgerId, deposit);
    if (over) return { error: over };
    const { data: row, error } = await supabase
      .from("appointments")
      .insert({
        ...data,
        customer_id: input.customer_id,
        ledger_id: ledgerId,
        status,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    await syncServices(supabase, row.id, input.service_ids);
    if (deposit > 0)
      await insertPayment(
        supabase,
        ledgerId,
        row.id,
        {
          kind: "deposit",
          amount: deposit,
          payment_method: input.deposit?.payment_method ?? data.payment_method,
          image_url: input.deposit?.image_url,
        },
        userId,
      );
    await advanceCustomerStage(
      supabase,
      input.customer_id,
      stageTargetFor(status, deposit),
    );
    refresh();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

export async function updateAppointment(
  id: string,
  input: AppointmentInput,
): Promise<Result> {
  try {
    const serviceId = singleService(input.service_ids);
    if (!serviceId) return { error: "Chọn đúng một dịch vụ." };
    const supabase = await createClient();
    await validateTechnician(supabase, input.technician_id);
    const { data: cur, error: curErr } = await supabase
      .from("appointments")
      .select("customer_id, status, ledger_id")
      .eq("id", id)
      .single();
    if (curErr) throw curErr;
    const userId = await currentUserId(supabase);
    // Đổi dịch vụ (hoặc lịch cũ chưa có sổ) → resolve lại sổ của cặp mới.
    const ledgerId = await resolveLedger(
      supabase,
      cur.customer_id,
      serviceId,
      userId,
    );
    const data = clean(input);
    const patch: Record<string, unknown> = {
      ...data,
      ledger_id: ledgerId,
      updated_by: userId,
    };
    // Chờ xếp lịch mà đã chốt ngày -> chuyển booked (flow 2b), trigger tự ghi history.
    if (cur.status === "pending_confirmation" && data.scheduled_at) {
      patch.status = "booked";
      patch.confirmed_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("appointments")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
    // Sổ đổi → kéo dòng tiền của LỊCH NÀY theo (sửa nhầm dịch vụ là tiền đi cùng),
    // đồng thời adopt dòng mồ côi (lịch cũ chưa có sổ).
    if (ledgerId !== cur.ledger_id) {
      const { error: moveErr } = await supabase
        .from("appointment_payments")
        .update({ ledger_id: ledgerId })
        .eq("appointment_id", id);
      if (moveErr) throw moveErr;
    }
    await setLedgerTotal(supabase, ledgerId, input.total_amount);
    await syncServices(supabase, id, input.service_ids);
    if (patch.status === "booked")
      await advanceCustomerStage(supabase, cur.customer_id, "booked");
    refresh();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Sửa nhanh kỹ thuật viên ngay trên bảng lịch hẹn. */
export async function setAppointmentTechnician(
  id: string,
  technicianId: string | null,
): Promise<Result> {
  try {
    const supabase = await createClient();
    const userId = await currentUserId(supabase);
    if (!userId) return { error: "Phiên đăng nhập không hợp lệ." };
    const nextId = nz(technicianId);
    await validateTechnician(supabase, nextId);
    const { data, error } = await supabase
      .from("appointments")
      .update({ technician_id: nextId, updated_by: userId })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { error: "Lịch hẹn không tồn tại hoặc đã bị xóa." };
    refresh();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Chuyển trạng thái nhanh từ bảng (check-in / hoàn tất / hoàn tác / hủy...).
 *  Chỉ chấp nhận transition trong ALLOWED_TRANSITIONS; hoàn tác xóa timestamp
 *  mốc của trạng thái vừa rời. `collect` = tiền thu lúc hoàn tất → dòng sổ;
 *  `total_amount` = tổng giá liệu trình → update SỔ (không còn cột trên lịch). */
export async function setAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  extra?: {
    total_amount?: number | null;
    payment_method?: PaymentMethod | null;
    collect?: { amount: number; image_url?: string | null };
  },
): Promise<Result> {
  try {
    const supabase = await createClient();
    const { data: cur, error: curErr } = await supabase
      .from("appointments")
      .select("customer_id, status, ledger_id")
      .eq("id", id)
      .single();
    if (curErr) throw curErr;
    if (!ALLOWED_TRANSITIONS[cur.status as AppointmentStatus]?.includes(status))
      return { error: "Chuyển trạng thái không hợp lệ." };
    const now = new Date().toISOString();
    const stampField: Partial<Record<AppointmentStatus, string>> = {
      booked: "confirmed_at",
      checked_in: "checked_in_at",
      completed: "completed_at",
      cancelled: "cancelled_at",
    };
    const userId = await currentUserId(supabase);
    const patch: Record<string, unknown> = { status, updated_by: userId };
    const field = stampField[status];
    if (field) patch[field] = now;
    // Hoàn tác / đặt lại: xóa mốc của trạng thái vừa rời.
    if (status === "booked" && cur.status === "checked_in")
      patch.checked_in_at = null;
    if (status === "checked_in" && cur.status === "completed")
      patch.completed_at = null;
    if (status === "booked" && cur.status === "cancelled")
      patch.cancelled_at = null;
    if (status === "completed" && extra?.payment_method !== undefined)
      patch.payment_method = extra.payment_method;
    // Tổng giá liệu trình ghi lên SỔ + check thu vượt TRƯỚC khi đổi trạng thái
    // (tiền sai thì không complete nửa chừng; lịch cũ không sổ → bỏ qua).
    if (status === "completed" && cur.ledger_id) {
      await setLedgerTotal(supabase, cur.ledger_id, extra?.total_amount);
      if (extra?.collect) {
        const over = await overTotalError(
          supabase,
          cur.ledger_id,
          extra.collect.amount,
        );
        if (over) return { error: over };
      }
    }
    const { error } = await supabase
      .from("appointments")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
    // Thu tiền lúc hoàn tất = 1 dòng sổ (sau khi status đã đổi thành công).
    if (status === "completed" && extra?.collect && extra.collect.amount > 0)
      await insertPayment(
        supabase,
        cur.ledger_id,
        id,
        {
          kind: "payment",
          amount: extra.collect.amount,
          payment_method: extra.payment_method ?? null,
          image_url: extra.collect.image_url,
        },
        userId,
      );
    await advanceCustomerStage(
      supabase,
      cur.customer_id,
      stageTargetFor(status, 0),
    );
    refresh();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Thêm 1 dòng tiền vào SỔ của lịch hẹn (thu thêm / hoàn tiền) từ dialog
 *  Thanh toán. Sổ đã tất toán hoặc lịch chưa có sổ → từ chối. */
export async function addPayment(
  appointmentId: string,
  input: PaymentInput,
): Promise<Result> {
  try {
    if (!PAYMENT_KINDS.includes(input.kind))
      return { error: "Loại thanh toán không hợp lệ." };
    if (!Number.isFinite(input.amount) || input.amount <= 0)
      return { error: "Số tiền phải lớn hơn 0." };
    const supabase = await createClient();
    const currentId = await currentUserId(supabase);
    if (!currentId) return { error: "Phiên đăng nhập không hợp lệ." };
    const receivedBy = input.received_by ?? currentId;
    const { data: receiver, error: receiverError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", receivedBy)
      .eq("status", "active")
      .maybeSingle();
    if (receiverError) throw receiverError;
    if (!receiver) return { error: "User được chọn không tồn tại hoặc đã bị cấm." };
    const { data: appt, error: aErr } = await supabase
      .from("appointments")
      .select("ledger_id, ledger:service_ledgers(closed_at)")
      .eq("id", appointmentId)
      .single();
    if (aErr) throw aErr;
    if (!appt.ledger_id)
      return { error: "Lịch hẹn chưa có sổ — chọn dịch vụ cho lịch trước." };
    // PostgREST trả object cho FK to-one; type gen chưa có nên ép tay.
    const ledger = appt.ledger as unknown as { closed_at: string | null } | null;
    if (ledger?.closed_at) return { error: "Sổ đã tất toán." };
    if (input.kind !== "refund") {
      const over = await overTotalError(supabase, appt.ledger_id, input.amount);
      if (over) return { error: over };
    }
    await insertPayment(
      supabase,
      appt.ledger_id,
      appointmentId,
      input,
      currentId,
    );
    refresh();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Tất toán / mở lại sổ tiền của liệu trình. Sau khi đóng, lịch mới cùng
 *  (khách, dịch vụ) sẽ mở sổ MỚI; mở lại bị chặn nếu đã có sổ mở khác. */
export async function setLedgerClosed(
  id: string,
  closed: boolean,
): Promise<Result> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("service_ledgers")
      .update({ closed_at: closed ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) {
      if (error.code === "23505")
        return { error: "Khách đang có sổ mở khác cho dịch vụ này." };
      throw error;
    }
    refresh();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Xóa 1 dòng sổ (ghi nhầm). Trả image_url để client dọn ảnh best-effort. */
export async function deletePayment(
  id: string,
): Promise<Result & { image_url?: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointment_payments")
      .delete()
      .eq("id", id)
      .select("image_url")
      .single();
    if (error) throw error;
    refresh();
    return { image_url: data?.image_url ?? null };
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Thêm record tiền upsale con của lịch. Mọi user đăng nhập được ghi khi
 *  khách đã check-in hoặc lịch đã hoàn tất; RLS kiểm tra lại cùng điều kiện. */
export async function addAppointmentUpsale(
  appointmentId: string,
  serviceId: string,
  amount: number,
): Promise<Result> {
  try {
    const normalizedServiceId = serviceId.trim();
    if (!normalizedServiceId)
      return { error: "Vui lòng chọn dịch vụ upsale." };
    if (!Number.isFinite(amount) || amount <= 0)
      return { error: "Số tiền upsale phải lớn hơn 0." };
    const supabase = await createClient();
    const userId = await currentUserId(supabase);
    if (!userId) return { error: "Phiên đăng nhập không hợp lệ." };
    const [appointmentRes, serviceRes] = await Promise.all([
      supabase
        .from("appointments")
        .select(
          "status, deleted_at, ledger_id, ledger:service_ledgers(closed_at)",
        )
        .eq("id", appointmentId)
        .single(),
      supabase
        .from("services")
        .select("id")
        .eq("id", normalizedServiceId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);
    const { data: appointment, error: appointmentError } = appointmentRes;
    if (appointmentError) throw appointmentError;
    if (serviceRes.error) throw serviceRes.error;
    if (!serviceRes.data)
      return { error: "Dịch vụ upsale không tồn tại hoặc đã ngừng kích hoạt." };
    if (appointment.deleted_at)
      return { error: "Lịch hẹn đã bị xóa." };
    if (!["checked_in", "completed"].includes(appointment.status))
      return { error: "Chỉ được ghi upsale khi khách đã đến hoặc đã hoàn tất." };
    if (!appointment.ledger_id)
      return { error: "Lịch hẹn chưa có sổ để ghi nhận thanh toán upsale." };
    const ledger = appointment.ledger as unknown as {
      closed_at: string | null;
    } | null;
    if (ledger?.closed_at)
      return { error: "Sổ đã tất toán, không thể thêm upsale mới." };
    const { error } = await supabase.from("appointment_upsales").insert({
      appointment_id: appointmentId,
      service_id: normalizedServiceId,
      amount,
      created_by: userId,
    });
    if (error) throw error;
    refresh();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Xóa record upsale nhập sai. Người tạo hoặc admin mới có quyền. */
export async function deleteAppointmentUpsale(id: string): Promise<Result> {
  try {
    const supabase = await createClient();
    const userId = await currentUserId(supabase);
    if (!userId) return { error: "Phiên đăng nhập không hợp lệ." };
    const [upsaleRes, profileRes] = await Promise.all([
      supabase
        .from("appointment_upsales")
        .select("created_by")
        .eq("id", id)
        .single(),
      supabase.from("profiles").select("role").eq("id", userId).single(),
    ]);
    if (upsaleRes.error) throw upsaleRes.error;
    if (profileRes.error) throw profileRes.error;
    if (upsaleRes.data.created_by !== userId && profileRes.data.role !== "admin")
      return { error: "Bạn không có quyền xóa khoản upsale này." };
    const { data, error } = await supabase
      .from("appointment_upsales")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { error: "Không thể xóa khoản upsale." };
    refresh();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Dời lịch = SỰ KIỆN: đổi scheduled_at, status giữ nguyên (Decision 2);
 *  riêng lịch chờ xếp (`pending_confirmation`) chốt ngày thì chuyển booked. */
export async function rescheduleAppointment(
  id: string,
  scheduledAt: string,
): Promise<Result> {
  try {
    const supabase = await createClient();
    const { data: cur, error: curErr } = await supabase
      .from("appointments")
      .select("customer_id, status")
      .eq("id", id)
      .single();
    if (curErr) throw curErr;
    const patch: Record<string, unknown> = {
      scheduled_at: scheduledAt,
      updated_by: await currentUserId(supabase),
    };
    if (cur.status === "pending_confirmation") {
      patch.status = "booked";
      patch.confirmed_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("appointments")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
    if (patch.status === "booked")
      await advanceCustomerStage(supabase, cur.customer_id, "booked");
    refresh();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Xóa mềm: đặt deleted_at (giữ lịch sử — pattern customers). */
export async function deleteAppointment(id: string): Promise<Result> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("appointments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    refresh();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}
