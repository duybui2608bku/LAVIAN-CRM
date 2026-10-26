"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { fetchFbAds } from "@/lib/marketing";
import type { CustomerInput, CustomerNote } from "@/types/customer";

type Result = { error?: string };

/** Số tin nhắn FB Ads trong khoảng ngày VN — cho ô "Tin nhắn → Data" trang /customers.
 *  Chỉ trả số tin nhắn (không lộ chi tiêu) nên mọi user đăng nhập đều xem được. */
export async function getFbMessages(
  from: string,
  to: string,
): Promise<{ messages: number | null; error?: string }> {
  if (!(await getCurrentProfile())) return { messages: null, error: "Chưa đăng nhập." };
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymd.test(from) || !ymd.test(to) || from > to)
    return { messages: null, error: "Khoảng ngày không hợp lệ." };
  try {
    return { messages: (await fetchFbAds(from, to)).messages };
  } catch (err) {
    return { messages: null, error: normalizeError(err).message };
  }
}

// Note mới do server stamp thời điểm + người ghi (không tin client).
async function stampNote(text: string): Promise<CustomerNote> {
  const profile = await getCurrentProfile();
  return { text, at: new Date().toISOString(), by: profile?.user_name ?? null };
}

// "" -> null; lost_reason chỉ giữ khi stage = 'lost'. KHÔNG đụng cột notes
// (create dựa default '[]' của DB; note quản lý riêng qua addCustomerNote).
function clean(input: CustomerInput) {
  const nz = (v?: string | null) => (v && v.trim() !== "" ? v.trim() : null);
  return {
    full_name: input.full_name.trim(),
    phone: input.phone.trim(),
    social_name: nz(input.social_name),
    source: nz(input.source),
    stage: input.stage,
    lost_reason: input.stage === "lost" ? nz(input.lost_reason) : null,
    staff_id: nz(input.staff_id),
    sales_id: nz(input.sales_id),
    technician_id: nz(input.technician_id),
    first_contact: nz(input.first_contact),
  };
}

// Đồng bộ bảng nối customer_services theo danh sách gửi lên (delete-all-insert).
// ponytail: 2 lệnh không transaction — lỗi giữa chừng chỉ mất tag, sửa lại qua dialog;
//           nâng cấp RPC khi thành vấn đề.
async function syncServices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
  serviceIds: string[] | undefined,
) {
  if (serviceIds === undefined) return; // không gửi -> giữ nguyên
  const { error } = await supabase
    .from("customer_services")
    .delete()
    .eq("customer_id", customerId);
  if (error) throw error;
  if (serviceIds.length === 0) return;
  const { error: insErr } = await supabase.from("customer_services").insert(
    serviceIds.map((service_id) => ({ customer_id: customerId, service_id })),
  );
  if (insErr) throw insErr;
}

export async function createCustomer(input: CustomerInput): Promise<Result> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .insert(clean(input))
      .select("id")
      .single();
    if (error) throw error;
    await syncServices(supabase, data.id, input.service_ids);
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
    const supabase = await createClient();
    const { error } = await supabase
      .from("customers")
      .update(clean(input))
      .eq("id", id);
    if (error) throw error;
    await syncServices(supabase, id, input.service_ids);
    revalidatePath("/customers");
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Sửa nhanh từng trường từ bảng (inline edit) — whitelist stage/source/staff_id/sales_id/technician_id/service_ids. */
export async function patchCustomer(
  id: string,
  patch: {
    stage?: string;
    source?: string | null;
    staff_id?: string | null;
    sales_id?: string | null;
    technician_id?: string | null;
    service_ids?: string[];
  },
): Promise<Result> {
  try {
    const data: Record<string, string | null> = {};
    if (patch.stage !== undefined) {
      data.stage = patch.stage;
      // Đồng nhất với clean(): rời khỏi 'lost' thì xóa lý do.
      if (patch.stage !== "lost") data.lost_reason = null;
    }
    if (patch.source !== undefined) data.source = patch.source || null;
    if (patch.staff_id !== undefined) data.staff_id = patch.staff_id || null;
    if (patch.sales_id !== undefined) data.sales_id = patch.sales_id || null;
    if (patch.technician_id !== undefined)
      data.technician_id = patch.technician_id || null;
    if (Object.keys(data).length === 0 && patch.service_ids === undefined)
      return {};
    const supabase = await createClient();
    if (Object.keys(data).length > 0) {
      const { error } = await supabase
        .from("customers")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    }
    await syncServices(supabase, id, patch.service_ids);
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
