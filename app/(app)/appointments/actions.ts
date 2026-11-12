"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/auth";
import { appointmentPatchSchema } from "@/lib/appointments";
import { normalizeError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentPatch } from "@/types/appointment";

async function client() {
  const profile = await getCurrentProfile();
  if (profile?.status !== "active") throw new Error("Unauthorized");
  return createClient();
}

function refresh() {
  revalidatePath("/customers");
  revalidatePath("/appointments");
}

async function failure(error: unknown) {
  const t = await getTranslations("appointments");
  return { error: error && typeof error === "object" && "code" in error && error.code === "23505"
    ? t("duplicate") : normalizeError(error).message };
}

// Các kiểm tra độc lập → chạy song song.
async function validateReferences(db: Awaited<ReturnType<typeof client>>, patch: AppointmentPatch) {
  const checks: PromiseLike<void>[] = [];
  if (patch.staff_id) {
    checks.push(db.from("profiles").select("id").eq("id", patch.staff_id).eq("status", "active")
      .eq("department", "customer_care").single().then(({ error }) => { if (error) throw error; }));
  }
  const serviceIds = patch.service_ids;
  if (serviceIds?.length) {
    checks.push(db.from("services").select("id").in("id", serviceIds).then(({ data, error }) => {
      if (error) throw error;
      if (data?.length !== serviceIds.length) throw new Error("Invalid services");
    }));
  }
  await Promise.all(checks);
}

export async function createAppointment(
  customerId: string,
  input: AppointmentPatch & { scheduled_at: string },
): Promise<{ error?: string }> {
  try {
    z.uuid().parse(customerId);
    const patch = appointmentPatchSchema.parse(input);
    if (!patch.scheduled_at) throw new Error("Missing date");
    const db = await client();
    await validateReferences(db, patch);
    const { data: customer, error: customerError } = await db.from("customers")
      .select("staff_id").eq("id", customerId).is("deleted_at", null).single();
    if (customerError) throw customerError;
    // Dịch vụ chỉ chọn trên lịch hẹn (khách không còn gắn dịch vụ).
    const { error } = await db.from("clinic_appointments").insert({
      customer_id: customerId, ...patch, service_ids: patch.service_ids ?? [],
      // Không chọn CSKH → lấy CSKH đang phụ trách khách.
      staff_id: patch.staff_id || customer.staff_id || null,
    });
    if (error) throw error;
    refresh();
    return {};
  } catch (error) {
    return failure(error);
  }
}

export async function patchAppointment(id: string, input: AppointmentPatch): Promise<{ error?: string }> {
  try {
    z.uuid().parse(id);
    const patch = appointmentPatchSchema.parse(input);
    const db = await client();
    await validateReferences(db, patch);
    const { error } = await db.from("clinic_appointments").update(patch)
      .eq("id", id).is("deleted_at", null).select("id").single();
    if (error) throw error;
    refresh();
    return {};
  } catch (error) {
    return failure(error);
  }
}

export async function deleteAppointment(id: string): Promise<{ error?: string }> {
  try {
    z.uuid().parse(id);
    const db = await client();
    const { error } = await db.from("clinic_appointments").update({ deleted_at: new Date().toISOString() })
      .eq("id", id).is("deleted_at", null).select("id").single();
    if (error) throw error;
    refresh();
    return {};
  } catch (error) {
    return failure(error);
  }
}
