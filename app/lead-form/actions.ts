"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { summarizeAndSave } from "@/lib/chat-summary";
import { normalizeError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchThreadMessages, type ChatMessage } from "@/lib/smax-messages";
import { instagramUsername, isFollowUpStage, isStage, leadSource, needsAppointment, needsServiceGroup, phoneOptional } from "@/lib/customer-options";
import { serviceCategoriesSchema } from "@/lib/appointments";
import { phoneOwner } from "@/lib/customers";
import { formatPhone, isValidPhone } from "@/lib/phone";
import type { CustomerNote } from "@/types/customer";

const schema = z.object({
  customer_id: z.string().trim().max(200),
  full_name: z.string().trim().min(1).max(120),
  // "" = chưa có SĐT — chỉ hợp lệ với nguồn Instagram (kiểm tra trong submitLead).
  phone: z.string().refine((v) => !v.trim() || isValidPhone(v)).transform((v) => (v.trim() ? formatPhone(v) : "")),
  note: z.string().trim().max(1000),
  staff_id: z.uuid().or(z.literal("")),
  stage: z.string(),
  // Tiền cọc (IDR, số nguyên) — chỉ lưu khi giai đoạn là "deposited".
  deposit_amount: z.number().int().min(0).max(1e12).nullable().catch(null),
  website: z.string(),
  // Lịch nhắc follow-up (Tiềm năng / Cân nhắc) — KHÔNG phải lịch hẹn. Hỏng/thiếu → null.
  follow_up_at: z.iso.datetime({ offset: true }).nullable().optional().catch(null),
  // Nhóm dịch vụ khách quan tâm — lưu trên khách + lịch hẹn kèm (nếu có). Bắt buộc theo needsServiceGroup.
  service_categories: serviceCategoriesSchema.catch([]),
  // Lịch hẹn tới chi nhánh (stage khác Tiềm năng / Cân nhắc). Hỏng/thiếu → null (Booking thì báo thiếu).
  appointment: z
    .object({
      scheduled_at: z.iso.datetime({ offset: true }),
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
  follow_up_at: string | null;
  service_categories: string[];
};

const LEAD_FIELDS =
  "id, smax_customer_id, source, notes, stage, staff_id, deposit_amount, payment_confirm_url, region_code, address_detail, follow_up_at, service_categories, staff:profiles!staff_id(user_name, avatar_url)";

type LeadRow = {
  id: string;
  smax_customer_id: string | null;
  source: string | null;
  notes: CustomerNote[] | null;
  stage: string | null;
  staff_id: string | null;
  deposit_amount: number | string | null;
  payment_confirm_url: string | null;
  region_code: string | null;
  address_detail: string | null;
  follow_up_at: string | null;
  service_categories: string[] | null;
  staff: unknown;
  /** Tìm theo SĐT (không khớp SMAX id) — vd khách IG chuyển sang WA có SMAX id mới. */
  viaPhone: boolean;
};

/** Khách của lead trong CRM: theo SMAX id; không có thì theo SĐT — khách tạo trước nhất (giữ kênh đầu). */
async function findLeadRow(smaxId: string, phone: string): Promise<LeadRow | null> {
  const db = createAdminClient();
  if (smaxId) {
    const { data, error } = await db.from("customers").select(LEAD_FIELDS)
      .eq("smax_customer_id", smaxId).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    if (data) return { ...(data as Omit<LeadRow, "viaPhone">), viaPhone: false };
  }
  if (!isValidPhone(phone)) return null;
  const { data, error } = await db.from("customers").select(LEAD_FIELDS)
    .eq("phone", formatPhone(phone)).is("deleted_at", null)
    .order("created_at").limit(1).maybeSingle();
  if (error) throw error;
  return data ? { ...(data as Omit<LeadRow, "viaPhone">), viaPhone: true } : null;
}

// Khách đã có trong CRM (theo SMAX id hoặc SĐT) → trả giai đoạn + CSKH hiện tại để form fill sẵn,
// tránh bấm Cập nhật đè giá trị mặc định lên dữ liệu đã đổi ở CRM.
export async function checkLeadCustomer(
  customerId: string,
  phone = "",
): Promise<LeadCustomer | null> {
  const id = z.string().trim().max(200).safeParse(customerId);
  const tel = z.string().max(50).safeParse(phone);
  if (!id.success || !tel.success) return null;

  const data = await findLeadRow(id.data, tel.data);
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
    follow_up_at: data.follow_up_at ?? null,
    service_categories: data.service_categories ?? [],
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
  const source = leadSource(d.thread?.link); // tự tính: hội thoại WA → WA, còn lại IG
  if (!d.phone && !phoneOptional(source)) return { error: "Vui lòng nhập số điện thoại." };
  const notes: CustomerNote[] = d.note
    ? [{ text: d.note, at: new Date().toISOString(), by: "Form SMAX" }]
    : [];

  try {
    const supabase = createAdminClient();
    // Bản chụp 30 tin SMAX (dữ liệu AI GĐ2 + dự phòng) — chạy song song; SMAX lỗi thì bỏ qua, không chặn lead.
    const snapshot = fetchThreadMessages(d.thread?.link, 30)
      .then((m) => ({ smax_messages: m, smax_messages_at: new Date().toISOString() }))
      .catch(() => ({}));
    const current = await findLeadRow(d.customer_id, d.phone);
    if (mode === "create" && current) {
      return { error: "Khách hàng đã tồn tại. Chỉ được cập nhật thông tin." };
    }
    if (mode === "update" && !current) {
      return { error: "Khách hàng chưa tồn tại. Hãy dùng nút Submit." };
    }
    // Cập nhật: không đổi sang SĐT đang thuộc khách khác (tạo mới đã dò theo SĐT ở trên).
    const owner = current && (await phoneOwner(supabase, d.phone, current.id));
    if (owner) return { error: (await getTranslations("appointments"))("phoneExists", { name: owner }) };

    // Stage bắt buộc chọn (không còn mặc định "Khách mới").
    if (!isStage(d.stage)) return { error: "Vui lòng chọn trạng thái." };
    if (!d.staff_id) return { error: "Vui lòng chọn Telesales." };
    // Tiềm năng / Cân nhắc: bắt buộc lịch nhắc follow-up, không tạo lịch hẹn tới chi nhánh.
    // Stage khác: có thể kèm lịch hẹn; vừa chọn Booking thì bắt buộc.
    const followUp = isFollowUpStage(d.stage);
    if (followUp && !d.follow_up_at) return { error: "Vui lòng chọn lịch nhắc." };
    const appointment = followUp ? null : (d.appointment ?? null);
    if (needsAppointment(d.stage, current?.stage) && !appointment)
      return { error: "Vui lòng chọn lịch hẹn." };
    if (needsServiceGroup(d.stage) && d.service_categories.length === 0)
      return { error: "Vui lòng chọn nhóm dịch vụ." };
    const insertAppointment = (customerId: string) =>
      supabase.from("clinic_appointments").insert({
        customer_id: customerId,
        scheduled_at: appointment!.scheduled_at,
        checked_in: false,
        service_categories: d.service_categories,
        staff_id: d.staff_id,
        created_by: d.staff_id, // lead-form không có user đăng nhập → người tạo = Telesales đã chọn
      });
    const stage = d.stage;
    // Trường theo kênh SMAX (hội thoại đang mở).
    const channel = {
      smax_customer_id: d.customer_id || null,
      source,
      social_name: d.social_name || null,
      picture: d.picture || null,
      tags: d.tags,
      thread: d.thread,
      // Payload hỏng/thiếu → null: không ghi đè smax_data đang có khi cập nhật.
      ...(d.smax_data ? { smax_data: d.smax_data } : {}),
    };
    // Khách tìm theo SĐT đã gắn kênh khác (vd IG → WA) → giữ kênh nhắn trước, chỉ ghi trường CRM.
    const keepChannel = !!current?.viaPhone && current.smax_customer_id !== null;
    // …nhưng hội thoại đang mở thuộc kênh khác → lưu làm kênh thứ hai (ô Nguồn hiện 2 hàng).
    const smaxCustomer = d.smax_data?.customer as { instagram?: { username?: unknown } } | undefined;
    const otherChannel = keepChannel && current.source && current.source !== source
      ? { other_channel: { source, link: d.thread?.link ?? null, username: instagramUsername(smaxCustomer?.instagram?.username) } }
      : {};
    const snap = await snapshot;
    const customer = {
      full_name: d.full_name,
      // Cập nhật mà để trống SĐT → giữ SĐT đang có (form không điền sẵn SĐT từ CRM).
      ...(d.phone || mode === "create" ? { phone: d.phone } : {}),
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
      ...(followUp ? { follow_up_at: new Date(d.follow_up_at!).toISOString() } : {}),
      // Để trống (stage không bắt buộc) → giữ nhóm dịch vụ cũ trong CRM.
      ...(d.service_categories.length ? { service_categories: d.service_categories } : {}),
      ...snap,
    };

    if (mode === "create") {
      const { data: created, error } = await supabase
        .from("customers")
        .insert({
          ...channel,
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
      // Khách mới có tin SMAX → tự tóm tắt AI sau khi đã trả kết quả cho form (không bắt Telesales chờ).
      if ("smax_messages" in snap && snap.smax_messages.length && process.env.ANTHROPIC_API_KEY) {
        after(() => autoSummarize(created.id, snap.smax_messages, d.staff_id));
      }
    } else {
      const row = current!;
      // Tạo lịch TRƯỚC khi đổi stage: lịch lỗi thì khách giữ nguyên, không thành Booking mà thiếu lịch.
      if (appointment) {
        const { error: apptError } = await insertAppointment(row.id);
        if (apptError) throw apptError;
      }

      const { error } = await supabase
        .from("customers")
        .update({
          ...(keepChannel ? otherChannel : channel),
          ...customer,
          notes: notes.length ? [...(row.notes ?? []), ...notes] : row.notes,
        })
        .eq("id", row.id);
      if (error) throw error;
    }
    if (appointment) revalidatePath("/appointments");
    if (followUp) revalidatePath("/customers/potential");
    return {};
  } catch (e) {
    const dup = duplicateKey(e);
    if (dup) return { error: (await getTranslations("appointments"))(dup) };
    // Trigger DB: cọc (nguồn duy nhất customers.deposit_amount) không thấp hơn phần đã trừ vào thẻ.
    if (normalizeError(e).message.includes("deposit_below_used")) return { error: (await getTranslations("appointments"))("depositBelowUsed") };
    return { error: normalizeError(e).message };
  }
}

/** Tóm tắt AI + điền chân dung khách vừa tạo từ lead-form (chạy nền). Lỗi chỉ ghi log — vẫn bấm "Tóm tắt bằng AI" ở popup 360° được. */
async function autoSummarize(customerId: string, messages: ChatMessage[], staffId: string) {
  try {
    await summarizeAndSave(createAdminClient(), customerId, messages, staffId);
  } catch (e) {
    console.error("[lead-form] Tự tóm tắt AI lỗi:", normalizeError(e).message);
  }
}

// Lỗi 23505 → câu báo theo unique index bị trùng (Postgres ghi tên index trong message).
const UNIQUE_MESSAGES = {
  clinic_appointments_customer_time_idx: "duplicate",
  customers_phone_active_uidx: "phoneTaken",
  customers_smax_customer_id_uidx: "smaxTaken",
} as const;
function duplicateKey(e: unknown): (typeof UNIQUE_MESSAGES)[keyof typeof UNIQUE_MESSAGES] | "duplicateRecord" | null {
  if (!e || typeof e !== "object" || !("code" in e) || e.code !== "23505") return null;
  const text = `${"message" in e ? e.message : ""} ${"details" in e ? e.details : ""}`;
  const hit = Object.entries(UNIQUE_MESSAGES).find(([name]) => text.includes(name));
  return hit ? hit[1] : "duplicateRecord";
}
