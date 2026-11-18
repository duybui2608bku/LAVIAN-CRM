"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { normalizeError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStage, leadSource, needsAppointment } from "@/lib/customer-options";
import { serviceCategoriesSchema } from "@/lib/appointments";
import { formatPhone, isValidPhone } from "@/lib/phone";
import type { CustomerNote } from "@/types/customer";

const schema = z.object({
  customer_id: z.string().trim().max(200),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().refine(isValidPhone).transform(formatPhone),
  note: z.string().trim().max(1000),
  staff_id: z.uuid().or(z.literal("")),
  stage: z.string(),
  // Tiền cọc (IDR, số nguyên) — chỉ lưu khi giai đoạn là "deposited".
  deposit_amount: z.number().int().min(0).max(1e12).nullable().catch(null),
  website: z.string(),
  // Lịch hẹn kèm (mọi stage). Hỏng/thiếu → null (stage bắt buộc lịch thì báo thiếu).
  appointment: z
    .object({
      scheduled_at: z.iso.datetime({ offset: true }),
      // Telesales chỉ chọn nhóm dịch vụ; dịch vụ chi tiết điền sau trong CRM.
      service_categories: serviceCategoriesSchema,
    })
    .nullable()
    .optional()
    .catch(null),
  // Ảnh xác nhận thanh toán (null = xoá). Hỏng/thiếu → undefined: không đụng giá trị cũ.
  payment_confirm_url: z.url().max(2000).nullable().optional().catch(undefined),
  // Mã vùng Kemendagri "31" | "31.71"; "" = chưa chọn. Sai định dạng → "".
  region_code: z.string().regex(/^\d{2}(\.\d{2})?$/).or(z.literal("")).catch(""),
  // Thiếu (ô đang tạm ẩn ở form) → undefined: không đụng giá trị cũ.
  address_detail: z.string().trim().max(500).optional().catch(undefined),
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
    .select("stage, staff_id, deposit_amount, payment_confirm_url, region_code, address_detail, staff:profiles!staff_id(user_name, avatar_url)")
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
    stage: data.stage ?? "",
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
    const current = d.customer_id ? await checkLeadCustomer(d.customer_id) : null;
    const existing = current !== null;
    if (mode === "create" && existing) {
      return { error: "Khách hàng đã tồn tại. Chỉ được cập nhật thông tin." };
    }
    if (mode === "update" && (!d.customer_id || !existing)) {
      return { error: "Khách hàng chưa tồn tại. Hãy dùng nút Submit." };
    }

    // Stage bắt buộc chọn (không còn mặc định "Khách mới").
    if (!isStage(d.stage)) return { error: "Vui lòng chọn trạng thái." };
    if (!d.staff_id) return { error: "Vui lòng chọn Telesales." };
    // Stage nào cũng có thể kèm lịch hẹn; vừa chọn Booking / Tiềm năng / Cân nhắc thì bắt buộc.
    const appointment = d.appointment ?? null;
    if (needsAppointment(d.stage, current?.stage) && !appointment)
      return { error: "Vui lòng chọn lịch hẹn." };
    const insertAppointment = (customerId: string) =>
      supabase.from("clinic_appointments").insert({
        customer_id: customerId,
        scheduled_at: appointment!.scheduled_at,
        checked_in: false,
        service_categories: appointment!.service_categories,
        staff_id: d.staff_id,
        created_by: d.staff_id, // lead-form không có user đăng nhập → người tạo = Telesales đã chọn
        note: "",
      });
    const stage = d.stage;
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
      staff_id: d.staff_id || null,
      region_code: d.region_code || null,
      ...(d.address_detail !== undefined ? { address_detail: d.address_detail || null } : {}),
      // Chỉ ghi khi đang ở "deposited" và có nhập — còn lại giữ tiền cọc cũ trong CRM.
      ...(stage === "deposited" && d.deposit_amount != null
        ? { deposit_amount: d.deposit_amount }
        : {}),
      ...(d.payment_confirm_url !== undefined
        ? { payment_confirm_url: d.payment_confirm_url }
        : {}),
    };

    if (mode === "create") {
      const { data: created, error } = await supabase
        .from("customers")
        .insert({
          ...customer,
          notes,
          // Chỉ đặt lúc tạo — cập nhật giữ ngày liên hệ đầu tiên.
          first_contact: new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Ho_Chi_Minh",
          }),
        })
        .select("id")
        .single();
      if (error) throw error;

      if (appointment) {
        const { error: apptError } = await insertAppointment(created.id);
        if (apptError) {
          // Không để khách Booking mà không có lịch: gỡ khách vừa tạo rồi báo lỗi.
          await supabase.from("customers").delete().eq("id", created.id);
          throw apptError;
        }
      }
    } else {
      const { data: row, error: readError } = await supabase
        .from("customers")
        .select("id, notes")
        .eq("smax_customer_id", d.customer_id)
        .is("deleted_at", null)
        .single();
      if (readError) throw readError;
      // Tạo lịch TRƯỚC khi đổi stage: lịch lỗi thì khách giữ nguyên, không thành Booking mà thiếu lịch.
      if (appointment) {
        const { error: apptError } = await insertAppointment(row.id);
        if (apptError) throw apptError;
      }

      const { error } = await supabase
        .from("customers")
        .update({
          ...customer,
          notes: notes.length ? [...(row.notes ?? []), ...notes] : row.notes,
        })
        .eq("smax_customer_id", d.customer_id)
        .is("deleted_at", null);
      if (error) throw error;
    }
    if (appointment) revalidatePath("/appointments");
    return {};
  } catch (e) {
    if (isDuplicate(e)) return { error: (await getTranslations("appointments"))("duplicate") };
    return { error: normalizeError(e).message };
  }
}

/** Trùng lịch hẹn (unique khách + giờ hẹn). */
const isDuplicate = (e: unknown) => !!e && typeof e === "object" && "code" in e && e.code === "23505";
