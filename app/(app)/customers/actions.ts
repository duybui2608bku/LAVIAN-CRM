"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import type { CustomerInput, CustomerNote } from "@/types/customer";

type Result = { error?: string };

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
    social_link: nz(input.social_link),
    source: nz(input.source),
    stage: input.stage,
    lost_reason: input.stage === "lost" ? nz(input.lost_reason) : null,
    staff_id: nz(input.staff_id),
    first_contact: nz(input.first_contact),
  };
}

export async function createCustomer(input: CustomerInput): Promise<Result> {
  try {
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

/** Sửa nhanh từng trường từ bảng (inline edit) — chỉ nhận stage/source/staff_id. */
export async function patchCustomer(
  id: string,
  patch: { stage?: string; source?: string | null; staff_id?: string | null },
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
    if (Object.keys(data).length === 0) return {};
    const supabase = await createClient();
    const { error } = await supabase.from("customers").update(data).eq("id", id);
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
