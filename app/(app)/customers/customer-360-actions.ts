"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAnyPermission, requirePermission } from "@/lib/auth";
import { canSeeFinance, canSeePhotos, customerRole } from "@/lib/customer-360";
import { detectPortrait, SUMMARY_FIELDS, summarizeAndSave } from "@/lib/chat-summary";
import { AppError, normalizeError } from "@/lib/errors";
import { newNote } from "@/lib/notes";
import { fetchThreadMessages, type ChatMessage } from "@/lib/smax-messages";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentLog } from "@/types/appointment";
import {
  NEED_ORIGINS, NEED_STATUSES, PERFORMER_ROLES, PORTRAIT_FIELDS, PORTRAIT_SOURCES,
  type AppointmentPhoto, type ChatSummary, type Customer360, type CustomerNeed, type NeedStatus, type PortraitField,
} from "@/types/customer-360";
import type { NoteInput } from "@/types/note";

type Result = { error?: string };
const BUCKET = "ba-photos";
const SIGNED_URL_TTL = 3600; // 1 giờ

const forbidden = () => new AppError("Bạn không có quyền thực hiện thao tác này.", { code: "FORBIDDEN", status: 403 });

/** Xem hồ sơ 360°: user đang hoạt động có quyền xem khách hoặc lịch hẹn. */
const viewer = () => requireAnyPermission("customers.view", "appointments.view", "appointments.edit");

async function requirePhotos() {
  const profile = await requirePermission("appointments.edit");
  if (!canSeePhotos(profile)) throw forbidden();
  return profile;
}

const APPT_FIELDS = "id,customer_id,scheduled_at,booking_confirm,checked_in,visit_status,service_categories,service_ids,staff_id,sales_id,technician_id,notes,sales_notes,performers:appointment_performers(profile_id,role)";
const MONEY_LOG_FIELDS = ["bill_amount", "paid_amount"];
// Thẻ + tour nối theo customer_id (RLS lọc theo quyền cards.* / tour.*). Cột tiền chỉ select khi được xem tài chính,
// ảnh tour chỉ khi được xem ảnh B/A — server không trả dữ liệu bị ẩn.
const cardFields = (finance: boolean) => `id,code,cancelled_at,created_by,created_at${finance ? ",deposit_used" : ""},`
  + `items:treatment_card_items(id,service_id,sessions,refunded_at${finance ? ",price,refund_amount" : ""},service:services(group_id,tourable))`
  + (finance ? ",payments:treatment_card_payments(id,amount,method,paid_at,note,images,created_by)" : "");
const tourFields = (photos: boolean) => "id,tour_date,service_id,card_item_id,service_detail,service_session,technician_id,confirmed_at"
  + (photos ? ",before_images,after_images,extra_images" : "");

type PhotoRow = Omit<AppointmentPhoto, "url"> & { path: string };
const PHOTO_FIELDS = "id,appointment_id,kind,path,created_by,created_at";

async function signPhotos(db: Awaited<ReturnType<typeof createClient>>, rows: PhotoRow[]): Promise<AppointmentPhoto[]> {
  if (!rows.length) return [];
  const { data, error } = await db.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.path), SIGNED_URL_TTL);
  if (error) throw error;
  // Không trả path ra client — chỉ signed URL.
  return rows.flatMap((r, i) => (data[i]?.signedUrl ? [{
    id: r.id, appointment_id: r.appointment_id, kind: r.kind, created_by: r.created_by, created_at: r.created_at, url: data[i].signedUrl,
  }] : []));
}


/** Toàn bộ hồ sơ 1 khách (popup 360°). Tài chính / ảnh chỉ trả khi người gọi được xem. */
export async function getCustomer360(customerId: string): Promise<{ data?: Customer360; error?: string }> {
  try {
    const profile = await viewer();
    z.uuid().parse(customerId);
    const finance = canSeeFinance(profile);
    const photos = canSeePhotos(profile);
    const db = await createClient();
    const [customer, appts, cards, tours, logs, portrait, needs, reminders, services, photoRows, summary] = await Promise.all([
      db.from("customers").select(`id,full_name,phone,picture,source,stage,staff_id,sales_id,technician_id,first_contact,created_at,thread_link:thread->>link,notes,smax_messages,smax_messages_at${finance ? ",deposit_amount,payment_confirm_url" : ""}`)
        .eq("id", customerId).is("deleted_at", null).single(),
      db.from("clinic_appointments").select(APPT_FIELDS)
        .eq("customer_id", customerId).is("deleted_at", null).order("scheduled_at", { ascending: false }),
      db.from("treatment_cards").select(cardFields(finance)).eq("customer_id", customerId).order("created_at", { ascending: false }),
      db.from("tours").select(tourFields(photos)).eq("customer_id", customerId).is("deleted_at", null).order("tour_date", { ascending: false }),
      db.from("clinic_appointment_logs")
        .select("id,appointment_id,action,changes,actor_id,created_at,appointment:clinic_appointments(scheduled_at)")
        .eq("customer_id", customerId).order("created_at", { ascending: false }).limit(200),
      db.from("customer_portrait_entries").select("id,field,text,text_en,source,message_ref,created_by,created_at")
        .eq("customer_id", customerId).in("field", PORTRAIT_FIELDS).order("created_at", { ascending: false }),
      db.from("customer_needs").select("id,title,service_id,origin,status,history,created_by,created_at")
        .eq("customer_id", customerId).order("created_at", { ascending: false }),
      db.from("customer_reminders").select("id,remind_at,note")
        .eq("customer_id", customerId).is("done_at", null).order("remind_at"),
      db.from("services").select("id,name,group_id,is_active").order("sort_order"),
      photos
        ? db.from("appointment_photos").select(PHOTO_FIELDS).eq("customer_id", customerId).order("created_at")
        : Promise.resolve({ data: null, error: null }),
      db.from("customer_chat_summaries").select(SUMMARY_FIELDS).eq("customer_id", customerId).maybeSingle(),
    ]);
    const error = customer.error ?? appts.error ?? cards.error ?? tours.error ?? logs.error ?? portrait.error ?? needs.error ?? reminders.error ?? services.error ?? photoRows.error ?? summary.error;
    if (error) throw error;
    const { smax_messages, ...info } = customer.data as unknown as Customer360["customer"] & { smax_messages: Customer360["smax_messages"] };
    return {
      data: {
        customer: { ...info, notes: info.notes ?? [] },
        appointments: (appts.data ?? []) as unknown as Customer360["appointments"],
        cards: (cards.data ?? []) as unknown as Customer360["cards"],
        tours: (tours.data ?? []) as unknown as Customer360["tours"],
        // Log không lộ số tiền khi không được xem tài chính.
        logs: ((logs.data ?? []) as unknown as AppointmentLog[]).map((l) => finance ? l : {
          ...l, changes: Object.fromEntries(Object.entries(l.changes).filter(([k]) => !MONEY_LOG_FIELDS.includes(k))),
        }).filter((l) => Object.keys(l.changes).length || l.action !== "update"),
        portrait: (portrait.data ?? []) as Customer360["portrait"],
        needs: (needs.data ?? []) as CustomerNeed[],
        reminders: reminders.data ?? [],
        services: (services.data ?? []) as Customer360["services"],
        photos: photos ? await signPhotos(db, (photoRows.data ?? []) as PhotoRow[]) : null,
        smax_messages,
        chat_summary: (summary.data ?? null) as ChatSummary | null,
        can: { finance, photos },
        role: customerRole(profile),
        now: Date.now(),
      },
    };
  } catch (error) {
    return { error: normalizeError(error).message };
  }
}

const portraitNoteSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  source: z.enum(PORTRAIT_SOURCES),
}).strict();

/**
 * Nhân viên ghi chú thô → lưu vào mục ẩn `general`, rồi AI tách ra các mục chân dung (mỗi mục = 1 dòng mới, nguồn theo NV chọn).
 * AI lỗi vẫn giữ ghi chú thô, trả `warning`. `fields` = các mục AI đã cập nhật.
 */
export async function addPortraitNote(customerId: string, input: z.input<typeof portraitNoteSchema>): Promise<Result & { warning?: string; fields?: PortraitField[] }> {
  try {
    const profile = await viewer();
    z.uuid().parse(customerId);
    const { text, source } = portraitNoteSchema.parse(input);
    const db = await createClient();
    const row = { customer_id: customerId, source, message_ref: null, created_by: profile.id };
    const { error } = await db.from("customer_portrait_entries").insert({ ...row, field: "general", text });
    if (error) throw error;

    let detected;
    try {
      const { data: rows, error: readErr } = await db.from("customer_portrait_entries").select("field,text")
        .eq("customer_id", customerId).in("field", PORTRAIT_FIELDS).order("created_at", { ascending: false });
      if (readErr) throw readErr;
      const current: Partial<Record<PortraitField, string>> = {};
      for (const r of rows ?? []) current[r.field as PortraitField] ??= r.text;
      detected = await detectPortrait(text, current);
    } catch (error) {
      return { warning: normalizeError(error).message };
    }
    const fields = Object.keys(detected) as PortraitField[];
    if (fields.length) {
      const { error: insErr } = await db.from("customer_portrait_entries")
        .insert(fields.map((f) => ({ ...row, field: f, text: detected[f]!.vi, text_en: detected[f]!.en })));
      if (insErr) throw insErr;
    }
    return { fields };
  } catch (error) {
    return { error: normalizeError(error).message };
  }
}

const needSchema = z.object({
  title: z.string().trim().min(1).max(200),
  service_id: z.uuid().nullable(),
  origin: z.enum(NEED_ORIGINS),
}).strict();

/** Ghi nhận 1 nhu cầu mới (trạng thái Nhu cầu, mốc lịch sử đầu tiên). */
export async function addCustomerNeed(customerId: string, input: z.input<typeof needSchema>): Promise<Result> {
  try {
    const profile = await viewer();
    z.uuid().parse(customerId);
    const db = await createClient();
    const { error } = await db.from("customer_needs").insert({
      customer_id: customerId, ...needSchema.parse(input), status: "need", created_by: profile.id,
      history: [{ status: "need", by_id: profile.id, at: new Date().toISOString() }],
    });
    if (error) throw error;
    return {};
  } catch (error) {
    return { error: normalizeError(error).message };
  }
}

/** Đổi trạng thái nhu cầu — append 1 mốc vào lịch sử (server stamp người + giờ). */
export async function setNeedStatus(needId: string, status: NeedStatus): Promise<Result> {
  try {
    const profile = await viewer();
    z.uuid().parse(needId);
    const next = z.enum(NEED_STATUSES).parse(status);
    const db = await createClient();
    const { data, error } = await db.from("customer_needs").select("status,history").eq("id", needId).single();
    if (error) throw error;
    if (data.status === next) return {};
    const { error: upErr } = await db.from("customer_needs").update({
      status: next, history: [...(data.history ?? []), { status: next, by_id: profile.id, at: new Date().toISOString() }],
    }).eq("id", needId);
    if (upErr) throw upErr;
    return {};
  } catch (error) {
    return { error: normalizeError(error).message };
  }
}

/** Ghi chú nhanh từ popup → ghi chú của khách (customers.notes). Mọi bộ phận xem được hồ sơ đều ghi được. */
export async function addQuickNote(customerId: string, input: NoteInput): Promise<Result> {
  try {
    const profile = await viewer();
    z.uuid().parse(customerId);
    const note = newNote(input, profile);
    const db = await createClient();
    const { data, error } = await db.from("customers").select("notes").eq("id", customerId).single();
    if (error) throw error;
    const { error: upErr } = await db.from("customers").update({ notes: [...(data.notes ?? []), note] }).eq("id", customerId);
    if (upErr) throw upErr;
    revalidatePath("/customers");
    revalidatePath("/customers/bookings");
    revalidatePath("/customers/potential");
    revalidatePath("/appointments");
    return {};
  } catch (error) {
    return { error: normalizeError(error).message };
  }
}

/** Ảnh B/A của 1 lịch (Drawer Sales) — signed URL. */
export async function getAppointmentPhotos(appointmentId: string): Promise<{ photos?: AppointmentPhoto[]; error?: string }> {
  try {
    await requirePhotos();
    z.uuid().parse(appointmentId);
    const db = await createClient();
    const { data, error } = await db.from("appointment_photos").select(PHOTO_FIELDS)
      .eq("appointment_id", appointmentId).order("created_at");
    if (error) throw error;
    return { photos: await signPhotos(db, (data ?? []) as PhotoRow[]) };
  } catch (error) {
    return { error: normalizeError(error).message };
  }
}

/** Ghi dòng ảnh sau khi client đã tải file thẳng lên Storage (path phải nằm trong thư mục khách/lịch). */
export async function addAppointmentPhoto(appointmentId: string, kind: "before" | "after", path: string): Promise<Result> {
  try {
    const profile = await requirePhotos();
    z.uuid().parse(appointmentId);
    z.enum(["before", "after"]).parse(kind);
    const db = await createClient();
    const { data, error } = await db.from("clinic_appointments").select("customer_id")
      .eq("id", appointmentId).is("deleted_at", null).single();
    if (error) throw error;
    if (!new RegExp(`^${data.customer_id}/${appointmentId}/[0-9a-f-]{36}\\.[a-z0-9]{2,5}$`).test(path)) throw new Error("Đường dẫn ảnh không hợp lệ.");
    const { error: insErr } = await db.from("appointment_photos")
      .insert({ appointment_id: appointmentId, customer_id: data.customer_id, kind, path, created_by: profile.id });
    if (insErr) throw insErr;
    return {};
  } catch (error) {
    return { error: normalizeError(error).message };
  }
}

/** Xoá 1 ảnh — chỉ người tải lên hoặc admin (RLS chặn người khác). */
export async function deleteAppointmentPhoto(photoId: string): Promise<Result> {
  try {
    await requirePhotos();
    z.uuid().parse(photoId);
    const db = await createClient();
    const { data, error } = await db.from("appointment_photos").delete().eq("id", photoId).select("path").single();
    if (error) throw new AppError("Chỉ người tải lên được xoá ảnh này.", { code: "FORBIDDEN", status: 403 });
    await db.storage.from(BUCKET).remove([data.path]); // best-effort: file mồ côi không ảnh hưởng hiển thị
    return {};
  } catch (error) {
    return { error: normalizeError(error).message };
  }
}

const performersSchema = z.array(z.object({ profile_id: z.uuid(), role: z.enum(PERFORMER_ROLES) }).strict()).max(10)
  .refine((items) => new Set(items.map((i) => i.profile_id)).size === items.length, "Mỗi người chỉ xuất hiện 1 lần.");

/** Lưu cả danh sách người thực hiện thêm của lịch (RPC xoá cũ + thêm mới trong 1 transaction). */
export async function setAppointmentPerformers(appointmentId: string, input: z.input<typeof performersSchema>): Promise<Result> {
  try {
    await requirePermission("appointments.edit");
    z.uuid().parse(appointmentId);
    const items = performersSchema.parse(input);
    const db = await createClient();
    if (items.length) {
      // Vai trò Sales → bộ phận sales; Mapping / Phun-xăm / Hỗ trợ → bộ phận technician (Master).
      const { data, error } = await db.from("profiles").select("id,department")
        .in("id", items.map((i) => i.profile_id)).eq("status", "active");
      if (error) throw error;
      const dept = new Map((data ?? []).map((p) => [p.id, p.department as string | null]));
      if (items.some((i) => dept.get(i.profile_id) !== (i.role === "sales" ? "sales" : "technician")))
        throw new Error("Người thực hiện không đúng bộ phận với vai trò.");
    }
    const { error } = await db.rpc("set_appointment_performers", { p_appointment: appointmentId, p_items: items });
    if (error) throw error;
    revalidatePath("/appointments");
    return {};
  } catch (error) {
    return { error: normalizeError(error).message };
  }
}

// ─────────────────────────── Tóm tắt AI hội thoại SMAX (Claude) ───────────────────────────

/**
 * Tóm tắt 30 tin SMAX gần nhất bằng Claude (song ngữ Việt + Anh) rồi lưu (1 dòng / khách, ghi đè) + điền Chân dung nhanh.
 * SMAX lỗi → dùng bản chụp lúc gửi lead-form.
 */
export async function summarizeCustomerChat(customerId: string): Promise<{ summary?: ChatSummary; error?: string }> {
  try {
    const profile = await viewer();
    z.uuid().parse(customerId);
    const db = await createClient();
    const { data, error } = await db.from("customers").select("link:thread->>link,smax_messages")
      .eq("id", customerId).is("deleted_at", null).single();
    if (error) throw error;
    const snapshot = (data.smax_messages ?? []) as ChatMessage[];
    const messages = await fetchThreadMessages(data.link as string | null)
      .catch((e) => { if (snapshot.length) return snapshot; throw e; });
    return { summary: await summarizeAndSave(db, customerId, messages, profile.id) };
  } catch (error) {
    return { error: normalizeError(error).message };
  }
}
