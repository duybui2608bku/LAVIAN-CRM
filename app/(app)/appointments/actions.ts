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

async function validateReferences(db: Awaited<ReturnType<typeof client>>, patch: AppointmentPatch) {
  if (patch.staff_id) {
    const { error } = await db.from("profiles").select("id").eq("id", patch.staff_id).eq("status", "active").single();
    if (error) throw error;
  }
  if (patch.service_ids?.length) {
    const { data, error } = await db.from("services").select("id").in("id", patch.service_ids);
    if (error) throw error;
    if (data?.length !== patch.service_ids.length) throw new Error("Invalid services");
  }
}

export async function createAppointment(customerId: string, scheduledAt: string): Promise<{ error?: string }> {
  try {
    z.uuid().parse(customerId);
    const patch = appointmentPatchSchema.parse({ scheduled_at: scheduledAt });
    const db = await client();
    const { data: customer, error: customerError } = await db.from("customers")
      .select("customer_services(service_id)").eq("id", customerId).is("deleted_at", null).single();
    if (customerError) throw customerError;
    const serviceIds = (customer.customer_services ?? []).map((s: { service_id: string }) => s.service_id);
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
