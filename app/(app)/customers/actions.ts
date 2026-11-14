"use server";

import { CUSTOMER_OPTIONS, validRating } from "@/lib/customer-options";
import { formatPhone } from "@/lib/phone";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requirePermission } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { fetchFbAds } from "@/lib/marketing";
import type { Appointment, AppointmentLog } from "@/types/appointment";
import type { CustomerInput, CustomerNote } from "@/types/customer";
import type { Service } from "@/types/service";

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
        .select("id, customer_id, scheduled_at, booking_confirm, checked_in, service_ids, staff_id, note")
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
  return { text, at: new Date().toISOString(), by: profile?.user_name ?? null };
}

// Không gửi source: nguồn tự tính từ số WA (lead form), tạo tay → default DB 'instagrams'.
// "" -> null; lost_reason chỉ giữ khi stage = 'lost'. KHÔNG đụng cột notes
// (create dựa default '[]' của DB; note quản lý riêng qua addCustomerNote).
function clean(input: CustomerInput) {
  const nz = (v?: string | null) => (v && v.trim() !== "" ? v.trim() : null);
  if (!CUSTOMER_OPTIONS.some((o) => o.kind === "stage" && o.value === input.stage))
    throw new Error("Giai đoạn không hợp lệ.");
  return {
    full_name: input.full_name.trim(),
    phone: formatPhone(input.phone),
    social_name: nz(input.social_name),
    stage: input.stage,
    rating: validRating(input.rating),
    lost_reason: input.stage === "lost" ? nz(input.lost_reason) : null,
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
    const { error } = await supabase.from("customers").insert(clean(input));
    if (error) throw error;
    revalidatePath("/customers");
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
    const { error } = await supabase
      .from("customers")
      .update(clean(input))
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/customers");
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
  },
): Promise<Result> {
  try {
    await requirePermission("customers.edit");
    if (patch.stage && !CUSTOMER_OPTIONS.some((o) => o.kind === "stage" && o.value === patch.stage))
      throw new Error("Giai đoạn không hợp lệ.");
    const data: Record<string, string | null> = {};
    if (patch.stage !== undefined) {
      data.stage = patch.stage;
      // Đồng nhất với clean(): rời khỏi 'lost' thì xóa lý do.
      if (patch.stage !== "lost") data.lost_reason = null;
    }
    if (patch.rating !== undefined) data.rating = validRating(patch.rating);
    if (patch.staff_id !== undefined) data.staff_id = patch.staff_id || null;
    if (patch.sales_id !== undefined) data.sales_id = patch.sales_id || null;
    if (patch.technician_id !== undefined)
      data.technician_id = patch.technician_id || null;
    if (Object.keys(data).length === 0) return {};
    const supabase = await createClient();
    const { error } = await supabase
      .from("customers")
      .update(data)
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/customers");
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Thêm 1 ghi chú nhanh: đọc notes hiện tại từ DB rồi append (server stamp at + by). */
export async function addCustomerNote(
  id: string,
  text: string,
): Promise<Result> {
  try {
    await requirePermission("customers.edit");
    const trimmed = text.trim();
    if (!trimmed) return {};
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("notes")
      .eq("id", id)
      .single();
    if (error) throw error;
    const notes = [
      ...((data?.notes as CustomerNote[]) ?? []),
      await stampNote(trimmed),
    ];
    const { error: upErr } = await supabase
      .from("customers")
      .update({ notes })
      .eq("id", id);
    if (upErr) throw upErr;
    revalidatePath("/customers");
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
    revalidatePath("/customers");
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
