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

// Các kiểm tra độc lập → chạy song song (1 round-trip thay vì tối đa 3).
async function validateReferences(db: Awaited<ReturnType<typeof client>>, patch: AppointmentPatch) {
  const checks: PromiseLike<void>[] = [];
  for (const [id, department] of [[patch.staff_id, "customer_care"], [patch.technician_id, "technician"]]) {
    if (!id) continue;
    checks.push(db.from("profiles").select("id").eq("id", id).eq("status", "active")
      .eq("department", department).single().then(({ error }) => { if (error) throw error; }));
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
      .select("customer_services(service_id)").eq("id", customerId).is("deleted_at", null).single();
    if (customerError) throw customerError;
    // Không chọn dịch vụ → lấy dịch vụ đang gắn trên khách.
    const serviceIds = patch.service_ids ?? (customer.customer_services ?? []).map((s: { service_id: string }) => s.service_id);
    const { error } = await db.from("clinic_appointments").insert({
      customer_id: customerId, ...patch, service_ids: serviceIds,
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
