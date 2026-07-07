"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { normalizeError } from "@/lib/errors";
import type { CustomerInput } from "@/types/customer";

type Result = { error?: string };

// "" -> null; lost_reason chỉ giữ khi stage = 'lost'.
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
    notes: input.notes ?? [],
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
