"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { appointmentPatchSchema } from "@/lib/appointments";
import { normalizeError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { CUSTOMER_OPTIONS, leadSource, validRating } from "@/lib/customer-options";
import { formatPhone } from "@/lib/phone";
import type { CustomerNote } from "@/types/customer";
import { CARE_DEPARTMENTS } from "@/types/user";

const schema = z.object({
  customer_id: z.string().trim().max(200),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().transform(formatPhone).pipe(z.string().min(1)),
  note: z.string().trim().max(1000),
  staff_id: z.uuid().or(z.literal("")),
  stage: z.string(),
  rating: z.string().max(50).catch(""), // giá trị lạ → null qua validRating
  // Tiền cọc (IDR, số nguyên) — chỉ lưu khi giai đoạn là "deposited".
  deposit_amount: z.number().int().min(0).max(1e12).nullable().catch(null),
  website: z.string(),
  // Ảnh xác nhận thanh toán (null = xoá). Hỏng/thiếu → undefined: không đụng giá trị cũ.
  payment_confirm_url: z.url().max(2000).nullable().optional().catch(undefined),
  // Mã vùng Kemendagri "31" | "31.71"; "" = chưa chọn. Sai định dạng → "".
  region_code: z.string().regex(/^\d{2}(\.\d{2})?$/).or(z.literal("")).catch(""),
  address_detail: z.string().trim().max(500).catch(""),
  social_name: z.string().trim().max(200).catch(""),
  picture: z.string().trim().max(2000).catch(""),
  tags: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().max(200),
        alias: z.string().optional(),
        time: z.string().optional(),
      }),
    )
    .max(50)
    .catch([]),
  thread: z
    .object({
      id: z.string().optional(),
      tid: z.string().optional(),
      message: z.string().max(2000).optional(),
      link: z.string().max(2000).optional(),
    })
    .nullable()
    .catch(null),
  // Nguyên `data` của event __SM_FORM_CUSTOMER — giới hạn ~200KB, hỏng thì bỏ qua.
  smax_data: z
    .record(z.string(), z.unknown())
    .refine((v) => JSON.stringify(v).length <= 200_000)
    .nullable()
    .catch(null),
});

export type LeadInput = z.input<typeof schema>;
export type LeadMode = "create" | "update";

export type LeadCustomer = {
  stage: string;
  rating: string;
  staff_id: string;
  staff_name: string;
  staff_avatar: string | null;
  deposit_amount: number | null;
  payment_confirm_url: string | null;
  region_code: string;
  address_detail: string;
};

// Khách đã có trong CRM → trả giai đoạn + CSKH hiện tại để form fill sẵn,
// tránh bấm Cập nhật đè giá trị mặc định lên dữ liệu đã đổi ở CRM.
export async function checkLeadCustomer(
  customerId: string,
): Promise<LeadCustomer | null> {
  const id = z.string().trim().min(1).max(200).safeParse(customerId);
  if (!id.success) return null;

  const { data, error } = await createAdminClient()
    .from("customers")
    .select("stage, rating, staff_id, deposit_amount, payment_confirm_url, region_code, address_detail, staff:profiles!staff_id(user_name, avatar_url)")
    .eq("smax_customer_id", id.data)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Quan hệ nhiều-1 nên PostgREST trả object (type suy ra mảng do client không typed).
  const staff = data.staff as unknown as
    | { user_name: string; avatar_url: string | null }
    | null;
  return {
    stage: data.stage ?? "new_lead",
    rating: data.rating ?? "",
    staff_id: data.staff_id ?? "",
    staff_name: staff?.user_name ?? "",
    staff_avatar: staff?.avatar_url ?? null,
    // numeric về dạng string qua PostgREST.
    deposit_amount: data.deposit_amount == null ? null : Number(data.deposit_amount),
    payment_confirm_url: data.payment_confirm_url ?? null,
    region_code: data.region_code ?? "",
    address_detail: data.address_detail ?? "",
  };
}

export async function submitLead(
  input: LeadInput,
  mode: LeadMode,
): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Dữ liệu không hợp lệ" };
  const d = parsed.data;
  if (d.website) return {};
  const notes: CustomerNote[] = d.note
    ? [{ text: d.note, at: new Date().toISOString(), by: "Form SMAX" }]
    : [];

  try {
    const supabase = createAdminClient();
    const existing = d.customer_id
      ? (await checkLeadCustomer(d.customer_id)) !== null
      : false;
    if (mode === "create" && existing) {
      return { error: "Khách hàng đã tồn tại. Chỉ được cập nhật thông tin." };
    }
    if (mode === "update" && (!d.customer_id || !existing)) {
      return { error: "Khách hàng chưa tồn tại. Hãy dùng nút Submit." };
    }

    const stage = CUSTOMER_OPTIONS.some((o) => o.kind === "stage" && o.value === d.stage)
      ? d.stage
      : "new_lead";
    const customer = {
      full_name: d.full_name,
      phone: d.phone,
      smax_customer_id: d.customer_id || null,
      source: leadSource(d.thread?.link), // tự tính: hội thoại WA → WA, còn lại IG
      social_name: d.social_name || null,
      picture: d.picture || null,
      tags: d.tags,
      thread: d.thread,
      // Payload hỏng/thiếu → null: không ghi đè smax_data đang có khi cập nhật.
      ...(d.smax_data ? { smax_data: d.smax_data } : {}),
      stage,
      rating: validRating(d.rating),
      staff_id: d.staff_id || null,
      region_code: d.region_code || null,
      address_detail: d.address_detail || null,
      // Chỉ ghi khi đang ở "deposited" và có nhập — còn lại giữ tiền cọc cũ trong CRM.
      ...(stage === "deposited" && d.deposit_amount != null
        ? { deposit_amount: d.deposit_amount }
        : {}),
      ...(d.payment_confirm_url !== undefined
        ? { payment_confirm_url: d.payment_confirm_url }
        : {}),
    };

    if (mode === "create") {
      const { error } = await supabase.from("customers").insert({
        ...customer,
        notes,
        // Chỉ đặt lúc tạo — cập nhật giữ ngày liên hệ đầu tiên.
        first_contact: new Date().toLocaleDateString("en-CA", {
          timeZone: "Asia/Ho_Chi_Minh",
        }),
      });
      if (error) throw error;
    } else {
      const { data: current, error: readError } = await supabase
        .from("customers")
        .select("notes")
        .eq("smax_customer_id", d.customer_id)
        .is("deleted_at", null)
        .single();
      if (readError) throw readError;

      const { error } = await supabase
        .from("customers")
        .update({
          ...customer,
          notes: notes.length ? [...(current.notes ?? []), ...notes] : current.notes,
        })
        .eq("smax_customer_id", d.customer_id)
        .is("deleted_at", null);
      if (error) throw error;
    }
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

const appointmentSchema = appointmentPatchSchema.safeExtend({
  scheduled_at: z.iso.datetime({ offset: true }),
});

export type LeadAppointmentInput = {
  scheduled_at: string;
  service_ids?: string[];
  staff_id?: string | null;
  note?: string;
};

// Tạo lịch hẹn cho khách đang mở trong SMAX (trang public → admin client).
// Không chọn khách (lấy theo smax_customer_id), luôn "chưa đến" (checked_in = false).
export async function createLeadAppointment(
  smaxCustomerId: string,
  input: LeadAppointmentInput,
): Promise<{ error?: string }> {
  try {
    const smaxId = z.string().trim().min(1).max(200).parse(smaxCustomerId);
    const d = appointmentSchema.parse({ ...input, staff_id: input.staff_id || null });
    const db = createAdminClient();

    const { data: customer, error: customerError } = await db
      .from("customers")
      .select("id, staff_id")
      .eq("smax_customer_id", smaxId)
      .is("deleted_at", null)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return { error: "Khách hàng chưa có trong CRM." };

    const serviceIds = d.service_ids ?? [];
    await Promise.all([
      d.staff_id
        ? db.from("profiles").select("id").eq("id", d.staff_id).eq("status", "active")
            .in("department", CARE_DEPARTMENTS).single()
            .then(({ error }) => { if (error) throw error; })
        : null,
      serviceIds.length
        ? db.from("services").select("id").in("id", serviceIds)
            .then(({ data, error }) => {
              if (error) throw error;
              if (data?.length !== serviceIds.length) throw new Error("Invalid services");
            })
        : null,
    ]);

    const { error } = await db.from("clinic_appointments").insert({
      customer_id: customer.id,
      scheduled_at: d.scheduled_at,
      checked_in: false,
      service_ids: serviceIds,
      // Không chọn CSKH → lấy CSKH đang phụ trách khách.
      staff_id: d.staff_id || customer.staff_id || null,
      note: d.note ?? "",
    });
    if (error) throw error;
    revalidatePath("/appointments");
    return {};
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "23505") {
      return { error: (await getTranslations("appointments"))("duplicate") };
    }
    return { error: normalizeError(e).message };
  }
}

export type LeadAppointment = {
  id: string;
  scheduled_at: string;
  checked_in: boolean;
  service_ids: string[];
  staff_name: string;
  staff_avatar: string | null;
  note: string;
};

// Lịch sử lịch hẹn của khách đang mở trong SMAX (mới nhất trước) — hiện dưới tab Appointment.
export async function listLeadAppointments(
  smaxCustomerId: string,
): Promise<LeadAppointment[]> {
  const id = z.string().trim().min(1).max(200).safeParse(smaxCustomerId);
  if (!id.success) return [];

  const { data, error } = await createAdminClient()
    .from("clinic_appointments")
    .select(
      "id, scheduled_at, checked_in, service_ids, note, " +
        "customer:customers!inner(smax_customer_id), staff:profiles!staff_id(user_name, avatar_url)",
    )
    .eq("customer.smax_customer_id", id.data)
    .is("customer.deleted_at", null)
    .is("deleted_at", null)
    .order("scheduled_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      scheduled_at: string;
      checked_in: boolean;
      service_ids: string[] | null;
      note: string | null;
      staff: { user_name: string; avatar_url: string | null } | null;
    };
    return {
      id: r.id,
      scheduled_at: r.scheduled_at,
      checked_in: r.checked_in,
      service_ids: r.service_ids ?? [],
      staff_name: r.staff?.user_name ?? "",
      staff_avatar: r.staff?.avatar_url ?? null,
      note: r.note ?? "",
    };
  });
}
