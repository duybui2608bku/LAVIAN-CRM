"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getCurrentProfile, requirePermission } from "@/lib/auth";
import { appointmentPatchSchema, canConfirmShowUp } from "@/lib/appointments";
import { BOOKED_STAGE } from "@/lib/customer-options";
import { AppError, normalizeError } from "@/lib/errors";
import { formatPhone, isValidPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { fetchThreadMessages, type ChatMessage } from "@/lib/smax-messages";
import type { AppointmentPatch } from "@/types/appointment";
import { TELESALES_DEPARTMENTS } from "@/types/user";

async function client() {
  const profile = await getCurrentProfile();
  if (profile?.status !== "active") throw new Error("Unauthorized");
  return createClient();
}

function refresh() {
  revalidatePath("/customers");
  revalidatePath("/customers/bookings");
  revalidatePath("/appointments");
}

async function failure(error: unknown) {
  const t = await getTranslations("appointments");
  return { error: error && typeof error === "object" && "code" in error && error.code === "23505"
    ? t("duplicate") : normalizeError(error).message };
}

const onlySales = () =>
  new AppError("Chỉ bộ phận Sales được xác nhận khách đã đến.", { code: "FORBIDDEN", status: 403 });

// Các kiểm tra độc lập → chạy song song.
async function validateReferences(db: Awaited<ReturnType<typeof client>>, patch: AppointmentPatch) {
  const checks: PromiseLike<void>[] = [];
  if (patch.staff_id) {
    checks.push(db.from("profiles").select("id").eq("id", patch.staff_id).eq("status", "active")
      .in("department", TELESALES_DEPARTMENTS).single().then(({ error }) => { if (error) throw error; }));
  }
  if (patch.sales_id) {
    checks.push(db.from("profiles").select("id").eq("id", patch.sales_id).eq("status", "active")
      .eq("department", "sales").single().then(({ error }) => { if (error) throw error; }));
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

/** Khách tạo nhanh từ drawer Thêm lịch hẹn — chỉ tên + SĐT, stage mặc định Booking. */
const newCustomerSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  phone: z.string().refine(isValidPhone).transform(formatPhone),
}).strict();

export async function createAppointment(
  customerRef: string | { full_name: string; phone: string },
  input: AppointmentPatch & { scheduled_at: string },
): Promise<{ error?: string }> {
  try {
    const profile = await requirePermission("appointments.edit");
    const patch = appointmentPatchSchema.parse(input);
    if (!patch.scheduled_at) throw new Error("Missing date");
    if (patch.checked_in && !canConfirmShowUp(profile)) throw onlySales();
    const db = await client();
    await validateReferences(db, patch);

    // Khách có sẵn: Telesales mặc định = Telesales đang phụ trách khách.
    // Khách mới: chặn trùng SĐT (DB không unique) rồi tạo với stage Booking.
    let customerId: string;
    let createdCustomer = false;
    let customerStaff: string | null = null;
    if (typeof customerRef === "string") {
      customerId = z.uuid().parse(customerRef);
      const { data, error } = await db.from("customers")
        .select("staff_id").eq("id", customerId).is("deleted_at", null).single();
      if (error) throw error;
      customerStaff = data.staff_id;
    } else {
      const c = newCustomerSchema.parse(customerRef);
      const { data: dup, error: dupError } = await db.from("customers")
        .select("full_name").eq("phone", c.phone).is("deleted_at", null).limit(1).maybeSingle();
      if (dupError) throw dupError;
      if (dup) {
        const t = await getTranslations("appointments");
        return { error: t("phoneExists", { name: dup.full_name }) };
      }
      const { data, error } = await db.from("customers").insert({
        ...c, stage: BOOKED_STAGE, staff_id: patch.staff_id ?? null,
        first_contact: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }),
      }).select("id").single();
      if (error) throw error;
      customerId = data.id;
      createdCustomer = true;
    }

    // Dịch vụ chỉ chọn trên lịch hẹn (khách không còn gắn dịch vụ).
    const { error } = await db.from("clinic_appointments").insert({
      customer_id: customerId, ...patch, service_ids: patch.service_ids ?? [],
      staff_id: patch.staff_id || customerStaff || null,
      created_by: profile.id,
    });
    if (error) {
      // Không để khách Booking mồ côi (không lịch) — gỡ khách vừa tạo nhanh.
      if (createdCustomer) await db.from("customers").delete().eq("id", customerId);
      throw error;
    }
    refresh();
    return {};
  } catch (error) {
    return failure(error);
  }
}

export async function patchAppointment(id: string, input: AppointmentPatch): Promise<{ error?: string }> {
  try {
    const profile = await requirePermission("appointments.edit");
    z.uuid().parse(id);
    const patch = appointmentPatchSchema.parse(input);
    if (patch.checked_in !== undefined && !canConfirmShowUp(profile)) throw onlySales();
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
    await requirePermission("appointments.delete");
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

/** 20 tin SMAX gần nhất với khách (modal Tin nhắn). Link hội thoại đọc từ DB — không nhận link từ client. */
export async function getCustomerMessages(customerId: string): Promise<{ messages?: ChatMessage[]; error?: string }> {
  try {
    await requirePermission("appointments.view");
    z.uuid().parse(customerId);
    const db = await createClient();
    const { data, error } = await db.from("customers").select("link:thread->>link").eq("id", customerId).single();
    if (error) throw error;
    return { messages: await fetchThreadMessages(data.link as string | null) };
  } catch (error) {
    return { error: normalizeError(error).message };
  }
}
