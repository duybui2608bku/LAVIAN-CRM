"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { Permission } from "@/lib/permissions";
import { tourCreateSchema, tourPatchSchema } from "@/lib/tours";

type Result = { error?: string };

// Quyền bộ phận (tour.edit / tour.delete) mở thao tác; quản lý (xác nhận, gán KTV, sửa/xoá mọi tour) vẫn chỉ admin.
async function context(key: Permission) {
  const profile = await requirePermission(key);
  return { profile, isAdmin: profile.role === "admin", db: await createClient() };
}

async function run(action: (t: Awaited<ReturnType<typeof getTranslations<"tour">>>) => Promise<string | void>): Promise<Result> {
  const t = await getTranslations("tour");
  try {
    const error = await action(t);
    if (error) return { error };
    revalidatePath("/tour");
    return {};
  } catch (error) {
    // 42501 = trigger tours_protect_confirmation (tour đã xác nhận).
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    return { error: code === "42501" ? t("locked") : normalizeError(error).message };
  }
}

export async function createTour(input: z.input<typeof tourCreateSchema>) {
  return run(async () => {
    const values = tourCreateSchema.parse(input);
    const { profile, db } = await context("tour.edit");
    const { error } = await db.from("tours").insert({ ...values, created_by: profile.id });
    if (error) throw error;
  });
}

/** KTV nhận tour — chỉ thành công khi tour còn trống (2 người bấm cùng lúc thì 1 người thắng). */
export async function claimTour(id: string) {
  return run(async (t) => {
    z.uuid().parse(id);
    const { profile, db } = await context("tour.edit");
    if (profile.department !== "technician") return t("onlyTechnician");
    const { data, error } = await db.from("tours")
      .update({ technician_id: profile.id, claimed_at: new Date().toISOString() })
      .eq("id", id).is("technician_id", null).is("deleted_at", null).select("id");
    if (error) throw error;
    if (!data.length) return t("alreadyClaimed");
  });
}

/** KTV trả lại tour mình đã nhận (khi chưa xác nhận). */
export async function releaseTour(id: string) {
  return run(async (t) => {
    z.uuid().parse(id);
    const { profile, db } = await context("tour.edit");
    const { data, error } = await db.from("tours").update({ technician_id: null, claimed_at: null })
      .eq("id", id).eq("technician_id", profile.id).is("confirmed_at", null).is("deleted_at", null).select("id");
    if (error) throw error;
    if (!data.length) return t("forbidden");
  });
}

/**
 * Sửa tour. Admin: mọi trường, mọi lúc. Người khác: chỉ tour chưa xác nhận, không gán KTV;
 * KTV chỉ sửa tour của chính mình.
 */
export async function updateTour(id: string, input: z.input<typeof tourPatchSchema>) {
  return run(async (t) => {
    z.uuid().parse(id);
    const patch = tourPatchSchema.parse(input);
    const { profile, isAdmin, db } = await context("tour.edit");
    const data: Record<string, unknown> = { ...patch };
    if (patch.technician_id !== undefined) {
      if (!isAdmin) return t("forbidden");
      if (patch.technician_id) {
        const { error } = await db.from("profiles").select("id").eq("id", patch.technician_id)
          .eq("status", "active").eq("department", "technician").single();
        if (error) throw error;
      }
      data.claimed_at = patch.technician_id ? new Date().toISOString() : null;
    }
    let query = db.from("tours").update(data).eq("id", id).is("deleted_at", null);
    if (!isAdmin) {
      query = query.is("confirmed_at", null);
      if (profile.department === "technician") query = query.eq("technician_id", profile.id);
    }
    const { data: rows, error } = await query.select("id");
    if (error) throw error;
    if (!rows.length) return t("forbidden");
  });
}

/** Admin xác nhận (cần có KTV, dịch vụ chi tiết, bill) hoặc bỏ xác nhận. */
export async function confirmTour(id: string, confirmed: boolean) {
  return run(async (t) => {
    z.uuid().parse(id);
    const { profile, isAdmin, db } = await context("tour.edit");
    if (!isAdmin) return t("forbidden");
    let query = db.from("tours").update(confirmed
      ? { confirmed_at: new Date().toISOString(), confirmed_by: profile.id }
      : { confirmed_at: null, confirmed_by: null })
      .eq("id", id).is("deleted_at", null);
    if (confirmed) {
      query = query.not("technician_id", "is", null).not("service_detail", "is", null).not("bill_amount", "is", null);
    }
    const { data, error } = await query.select("id");
    if (error) throw error;
    if (!data.length) return confirmed ? t("confirmMissing") : t("forbidden");
  });
}

/** Xoá mềm: admin, hoặc người tạo khi tour chưa có KTV nhận. */
export async function deleteTour(id: string) {
  return run(async (t) => {
    z.uuid().parse(id);
    const { profile, isAdmin, db } = await context("tour.delete");
    let query = db.from("tours").update({ deleted_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null);
    if (!isAdmin) query = query.eq("created_by", profile.id).is("technician_id", null);
    const { data, error } = await query.select("id");
    if (error) throw error;
    if (!data.length) return t("forbidden");
  });
}
