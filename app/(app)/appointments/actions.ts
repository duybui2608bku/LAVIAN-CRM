"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { normalizeError } from "@/lib/errors";
import {
  APPOINTMENT_STATUSES,
  type AppointmentInput,
  type AppointmentStatus,
  type PaymentMethod,
} from "@/types/appointment";

type Result = { error?: string };
type Supabase = Awaited<ReturnType<typeof createClient>>;

const nz = (v?: string | null) => (v && v.trim() !== "" ? v.trim() : null);

// "" -> null; status KHÔNG nằm đây — do server điều khiển (create/transition).
function clean(input: AppointmentInput) {
  return {
    staff_id: nz(input.staff_id),
    scheduled_at: input.scheduled_at ?? null,
    duration_minutes: input.duration_minutes ?? 60,
    source: nz(input.source),
    payment_method: input.payment_method ?? null,
    deposit_amount: input.deposit_amount ?? 0,
    expected_amount: input.expected_amount ?? null,
    final_amount: input.final_amount ?? null,
    booking_note: nz(input.booking_note),
    internal_note: nz(input.internal_note),
  };
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

export async function createAppointment(
  input: AppointmentInput,
): Promise<Result> {
  try {
    const supabase = await createClient();
    const data = clean(input);
    // Có ngày giờ = đã đặt lịch; chưa có = cọc/chờ xếp lịch (Decision 12).
    const status: AppointmentStatus = data.scheduled_at
      ? "booked"
      : "pending_confirmation";
    const { data: row, error } = await supabase
      .from("appointments")
      .insert({
        ...data,
        customer_id: input.customer_id,
        status,
        created_by: await currentUserId(supabase),
      })
      .select("id")
      .single();
    if (error) throw error;
    await syncServices(supabase, row.id, input.service_ids);
    await advanceCustomerStage(
      supabase,
      input.customer_id,
      stageTargetFor(status, data.deposit_amount),
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
    const supabase = await createClient();
    const { data: cur, error: curErr } = await supabase
      .from("appointments")
      .select("customer_id, status")
      .eq("id", id)
      .single();
    if (curErr) throw curErr;
    const data = clean(input);
    const patch: Record<string, unknown> = {
      ...data,
      updated_by: await currentUserId(supabase),
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
    await syncServices(supabase, id, input.service_ids);
    if (patch.status === "booked")
      await advanceCustomerStage(supabase, cur.customer_id, "booked");
    refresh();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Chuyển trạng thái nhanh từ bảng (check-in / hoàn tất / no-show / hủy...). */
export async function setAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  extra?: { final_amount?: number | null; payment_method?: PaymentMethod | null },
): Promise<Result> {
  try {
    if (!APPOINTMENT_STATUSES.includes(status))
      return { error: "Trạng thái không hợp lệ." };
    const supabase = await createClient();
    const { data: cur, error: curErr } = await supabase
      .from("appointments")
      .select("customer_id")
      .eq("id", id)
      .single();
    if (curErr) throw curErr;
    const now = new Date().toISOString();
    const stampField: Partial<Record<AppointmentStatus, string>> = {
      booked: "confirmed_at",
      checked_in: "checked_in_at",
      completed: "completed_at",
      cancelled: "cancelled_at",
    };
    const patch: Record<string, unknown> = {
      status,
      updated_by: await currentUserId(supabase),
    };
    const field = stampField[status];
    if (field) patch[field] = now;
    if (status === "completed" && extra) {
      if (extra.final_amount !== undefined)
        patch.final_amount = extra.final_amount;
      if (extra.payment_method !== undefined)
        patch.payment_method = extra.payment_method;
    }
    const { error } = await supabase
      .from("appointments")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
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
