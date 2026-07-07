"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeError } from "@/lib/errors";
import type { EnumKind } from "@/types/customer";

type Result = { error?: string };

// Cột customers ứng với từng kind — để đếm option đang dùng trước khi xóa.
const KIND_COLUMN: Record<EnumKind, "stage" | "source" | "lost_reason"> = {
  stage: "stage",
  source: "source",
  lost_reason: "lost_reason",
};

export async function createOption(input: {
  kind: EnumKind;
  value: string;
  label_vi: string;
  label_en: string;
  label_id: string;
  sort_order: number;
  is_active: boolean;
}): Promise<Result> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("enum_options").insert(input);
    if (error) throw error;
    revalidatePath("/enums");
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

export async function updateOption(
  id: string,
  input: {
    label_vi: string;
    label_en: string;
    label_id: string;
    sort_order: number;
    is_active: boolean;
  },
): Promise<Result> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase
      .from("enum_options")
      .update(input)
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/enums");
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Xóa cứng — nhưng chặn nếu còn khách hàng đang dùng giá trị này. */
export async function deleteOption(
  id: string,
  kind: EnumKind,
  value: string,
): Promise<Result> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { count, error: cErr } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq(KIND_COLUMN[kind], value);
    if (cErr) throw cErr;
    if ((count ?? 0) > 0) {
      return {
        error: `Đang có ${count} khách hàng dùng giá trị này — hãy tắt "Kích hoạt" thay vì xóa.`,
      };
    }

    const { error } = await supabase.from("enum_options").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/enums");
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}
