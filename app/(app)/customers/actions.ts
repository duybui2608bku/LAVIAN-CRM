"use server";

import {
  BOOKED_STAGE,
  CONVERTED_STATUS,
  isFollowUpStage,
  isStage,
  FOLLOW_UP_STAGES,
  phoneOptional,
  validPotentialStatus,
  validRating,
} from "@/lib/customer-options";
import { formatPhone, isValidPhone } from "@/lib/phone";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { phoneOwner } from "@/lib/customers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requirePermission } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { fetchFbAds } from "@/lib/marketing";
import type { Appointment, AppointmentLog } from "@/types/appointment";
import type { CustomerInput, CustomerNote } from "@/types/customer";
import type { Service } from "@/types/service";

// Trang /customers + trang con lọc sẵn (Booking management, Khách tiềm năng) đọc cùng dữ liệu.
function revalidateCustomers() {
  revalidatePath("/customers");
  revalidatePath("/customers/bookings");
  revalidatePath("/customers/potential");
  revalidatePath("/appointments"); // cột Note Telesales ở Sales Management đọc customers.notes
}

type Result = { error?: string };

export type CustomerAppointmentsData = {
  appointments: Appointment[];
  logs: AppointmentLog[];
  services: Pick<Service, "id" | "name_vi" | "name_en" | "name_id">[];
};

// Drawer cột Lịch hẹn: toàn bộ lịch chưa xoá + log thay đổi (mới nhất trước) của 1 khách.
export async function getCustomerAppointments(
  customerId: string,
): Promise<CustomerAppointmentsData & { error?: string }> {
  try {
    const supabase = await createClient();
    const [appts, logs, services] = await Promise.all([
      supabase
        .from("clinic_appointments")
        .select("id, customer_id, scheduled_at, booking_confirm, checked_in, service_categories, service_ids, staff_id, sales_id, created_by, notes")
        .eq("customer_id", customerId)
        .is("deleted_at", null)
        .order("scheduled_at", { ascending: false }),
      supabase
        .from("clinic_appointment_logs")
        .select("id, appointment_id, action, changes, actor_id, created_at, appointment:clinic_appointments(scheduled_at)")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("services").select("id, name_vi, name_en, name_id"),
    ]);
    const error = appts.error ?? logs.error ?? services.error;
    if (error) throw error;
    return {
      appointments: (appts.data ?? []) as Appointment[],
      logs: (logs.data ?? []) as unknown as AppointmentLog[],
      services: services.data ?? [],
    };
  } catch (e) {
    return { appointments: [], logs: [], services: [], error: normalizeError(e).message };
  }
}

// Note mới do server stamp thời điểm + người ghi (không tin client).
async function stampNote(text: string): Promise<CustomerNote> {
  const profile = await getCurrentProfile();
  return {
    text,
    at: new Date().toISOString(),
    // user_name có thể rỗng → fallback email để vẫn biết ai ghi.
    by: profile?.user_name || profile?.email || null,
    by_id: profile?.id ?? null,
  };
}

// Không gửi source: nguồn tự tính từ số WA (lead form), tạo tay → default DB 'instagrams'.
// "" -> null. KHÔNG đụng cột notes
// (create dựa default '[]' của DB; note quản lý riêng qua addCustomerNote).
// 1 SĐT = 1 khách: thông báo khi SĐT đã thuộc khách khác (cùng câu với drawer tạo lịch).
async function phoneTaken(db: Awaited<ReturnType<typeof createClient>>, phone: string, exceptId?: string) {
  const name = await phoneOwner(db, phone, exceptId);
  return name ? (await getTranslations("appointments"))("phoneExists", { name }) : null;
}

// Tiềm năng / Cân nhắc bắt buộc lịch nhắc (DB có constraint chốt chặn, đây chỉ để báo lỗi dễ hiểu).
// Rời 2 stage này thì trigger DB tự xoá follow_up_at + ghi chuyển đổi.
function followUpIso(v?: string | null): string {
  const at = v ? new Date(v) : null;
  if (!at || Number.isNaN(at.getTime())) throw new Error("Vui lòng chọn lịch nhắc.");
  return at.toISOString();
}

/** `noPhoneOk`: khách Instagram được để trống SĐT (lưu ""). */
function clean(input: CustomerInput, noPhoneOk = false) {
  const nz = (v?: string | null) => (v && v.trim() !== "" ? v.trim() : null);
  if (!isStage(input.stage))
    throw new Error("Giai đoạn không hợp lệ.");
  const noPhone = noPhoneOk && !input.phone.trim();
  if (!noPhone && !isValidPhone(input.phone)) throw new Error("Số điện thoại không hợp lệ.");
  return {
    ...(isFollowUpStage(input.stage) ? { follow_up_at: followUpIso(input.follow_up_at) } : {}),
    full_name: input.full_name.trim(),
    phone: noPhone ? "" : formatPhone(input.phone),
    social_name: nz(input.social_name),
    stage: input.stage,
    rating: validRating(input.rating),
    staff_id: nz(input.staff_id),
    sales_id: nz(input.sales_id),
    technician_id: nz(input.technician_id),
    first_contact: nz(input.first_contact),
    payment_confirm_url: nz(input.payment_confirm_url),
    region_code: nz(input.region_code),
    address_detail: nz(input.address_detail)?.slice(0, 500) ?? null,
  };
}

export async function createCustomer(input: CustomerInput): Promise<Result> {
  try {
    await requirePermission("customers.edit");
    const supabase = await createClient();
    const row = clean(input);
    const taken = await phoneTaken(supabase, row.phone);
    if (taken) return { error: taken };
    const { error } = await supabase.from("customers").insert(row);
    if (error) throw error;
    revalidateCustomers();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

export async function updateCustomer(
  id: string,
  input: CustomerInput,
): Promise<Result> {
  try {
    await requirePermission("customers.edit");
    const supabase = await createClient();
    const { data: cur, error: curError } = await supabase.from("customers").select("source").eq("id", id).single();
    if (curError) throw curError;
    const row = clean(input, phoneOptional(cur.source));
    const taken = await phoneTaken(supabase, row.phone, id);
    if (taken) return { error: taken };
    const { error } = await supabase
      .from("customers")
      .update(row)
      .eq("id", id);
    if (error) throw error;
    revalidateCustomers();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Sửa nhanh từng trường từ bảng (inline edit) — whitelist stage/rating/staff_id/sales_id/technician_id. */
export async function patchCustomer(
  id: string,
  patch: {
    stage?: string;
    rating?: string | null;
    staff_id?: string | null;
    sales_id?: string | null;
    technician_id?: string | null;
    potential_status?: string | null;
    follow_up_at?: string | null;
  },
): Promise<Result> {
  try {
    await requirePermission("customers.edit");
    if (patch.stage !== undefined && !isStage(patch.stage))
      throw new Error("Giai đoạn không hợp lệ.");
    if (isFollowUpStage(patch.stage)) followUpIso(patch.follow_up_at);
    const data: Record<string, string | null> = {};
    if (patch.stage !== undefined) data.stage = patch.stage;
    if (patch.rating !== undefined) data.rating = validRating(patch.rating);
    if (patch.staff_id !== undefined) data.staff_id = patch.staff_id || null;
    if (patch.sales_id !== undefined) data.sales_id = patch.sales_id || null;
    if (patch.technician_id !== undefined)
      data.technician_id = patch.technician_id || null;
    if (patch.potential_status !== undefined)
      data.potential_status = validPotentialStatus(patch.potential_status);
    if (patch.follow_up_at !== undefined) {
      const at = patch.follow_up_at ? new Date(patch.follow_up_at) : null;
      if (at && Number.isNaN(at.getTime())) throw new Error("Ngày giờ liên hệ lại không hợp lệ.");
      data.follow_up_at = at?.toISOString() ?? null;
    }
    if (Object.keys(data).length === 0) return {};
    const supabase = await createClient();
    const { error } = await supabase
      .from("customers")
      .update(data)
      .eq("id", id);
    if (error) throw error;
    revalidateCustomers();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Thêm 1 ghi chú (tiêu đề không bắt buộc): đọc notes hiện tại từ DB rồi append (server stamp id + at + by). */
export async function addCustomerNote(
  id: string,
  input: { title: string; text: string },
): Promise<Result> {
  try {
    await requirePermission("customers.edit");
    const trimmed = input.text.trim().slice(0, 10000);
    if (!trimmed) return {};
    const title = input.title.trim().slice(0, 120) || null;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("notes")
      .eq("id", id)
      .single();
    if (error) throw error;
    const notes = [
      ...((data?.notes as CustomerNote[]) ?? []),
      { id: crypto.randomUUID(), title, ...(await stampNote(trimmed)) },
    ];
    const { error: upErr } = await supabase
      .from("customers")
      .update({ notes })
      .eq("id", id);
    if (upErr) throw upErr;
    revalidateCustomers();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/**
 * Khách tiềm năng đã có lịch hẹn (tạo ở drawer ngay trước đó) → sang Booking, ghi lúc chuyển đổi.
 * Chỉ áp cho khách còn ở stage Tiềm năng / Cân nhắc.
 */
export async function convertPotentialCustomer(id: string): Promise<Result> {
  try {
    await requirePermission("customers.edit");
    const supabase = await createClient();
    const { error } = await supabase
      .from("customers")
      .update({
        stage: BOOKED_STAGE,
        potential_status: CONVERTED_STATUS,
        converted_at: new Date().toISOString(),
        follow_up_at: null,
      })
      .eq("id", id)
      .in("stage", FOLLOW_UP_STAGES);
    if (error) throw error;
    revalidateCustomers();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Xóa mềm: đặt deleted_at (giữ lịch sử). */
export async function deleteCustomer(id: string): Promise<Result> {
  try {
    await requirePermission("customers.delete");
    const supabase = await createClient();
    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    revalidateCustomers();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Số tin nhắn từ các tài khoản quảng cáo FB trong khoảng ngày `YYYY-MM-DD` (pipeline /customers). */
export async function getAdMessages(
  from: string,
  to: string,
): Promise<{ messages?: number; error?: string }> {
  if (!(await getCurrentProfile())) return { error: "Bạn cần đăng nhập." };
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymd.test(from) || !ymd.test(to) || from > to)
    return { error: "Khoảng ngày không hợp lệ." };
  try {
    return { messages: (await fetchFbAds(from, to)).messages };
  } catch (err) {
    return { error: normalizeError(err).message };
  }
}
