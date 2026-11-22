"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth";
import {
  cardCreateSchema, cardItemSessionsSchema, cardItemsAddSchema, cardPaymentSchema, cardRefundSchema, cardTourSchema, tourKindDetail,
} from "@/lib/cards";
import { normalizeError } from "@/lib/errors";
import { initialNotes } from "@/lib/notes";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };
type T = Awaited<ReturnType<typeof getTranslations<"cards">>>;

// Lỗi nghiệp vụ do RPC create_treatment_card raise (P0001) → key i18n.
const RPC_ERRORS = ["card_needs_items", "customer_not_found", "appointment_not_arrived"] as const;

async function run(action: (t: T, db: Awaited<ReturnType<typeof createClient>>) => Promise<string | void>): Promise<Result> {
  const t = await getTranslations("cards");
  try {
    const error = await action(t, await createClient());
    if (error) return { error };
    // Thẻ hiện ở Thẻ liệu trình, Sales Management (cột Thẻ + Tài chính), Tour (lộ trình).
    for (const path of ["/cards", "/appointments", "/tour"]) revalidatePath(path);
    return {};
  } catch (error) {
    const message = normalizeError(error).message;
    const known = RPC_ERRORS.find((code) => message.includes(code));
    if (known) return { error: t(`error.${known}`) };
    // 23505 = unique: lịch hẹn đã có thẻ đang hiệu lực.
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    return { error: code === "23505" ? t("error.appointmentHasCard") : message };
  }
}

/** Thẻ còn hiệu lực (chưa huỷ) — null khi không có. */
async function openCard(db: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await db.from("treatment_cards").select("id,customer_id")
    .eq("id", id).is("cancelled_at", null).maybeSingle();
  if (error) throw error;
  return data;
}

/** Bán thẻ (Sales Management): RPC tạo thẻ + DV, trừ cọc chưa dùng, khách → Đã mua. */
export async function createCard(input: z.input<typeof cardCreateSchema>) {
  return run(async (_, db) => {
    const values = cardCreateSchema.parse(input);
    await requirePermission("cards.edit");
    const { error } = await db.rpc("create_treatment_card", {
      p_customer_id: values.customer_id, p_appointment_id: values.appointment_id, p_items: values.items, p_note: values.note,
    });
    if (error) throw error;
    revalidatePath("/customers");
  });
}

/** Bán thêm dịch vụ vào thẻ. */
export async function addCardItems(cardId: string, input: z.input<typeof cardItemsAddSchema>) {
  return run(async (t, db) => {
    z.uuid().parse(cardId);
    const items = cardItemsAddSchema.parse(input);
    const profile = await requirePermission("cards.edit");
    if (!(await openCard(db, cardId))) return t("error.cancelled");
    const { error } = await db.from("treatment_card_items")
      .insert(items.map((i) => ({ ...i, card_id: cardId, created_by: profile.id })));
    if (error) throw error;
  });
}

/** Hoàn 1 dịch vụ (DV đã hoàn không tạo tour được nữa). DB chặn tiền hoàn > giá bán. */
export async function refundCardItem(itemId: string, input: z.input<typeof cardRefundSchema>) {
  return run(async (t, db) => {
    z.uuid().parse(itemId);
    const { amount, note } = cardRefundSchema.parse(input);
    await requirePermission("cards.edit");
    const { data: item, error: readErr } = await db.from("treatment_card_items").select("card_id,price")
      .eq("id", itemId).is("refunded_at", null).maybeSingle();
    if (readErr) throw readErr;
    if (!item || !(await openCard(db, item.card_id))) return t("error.cancelled");
    if (amount > item.price) return t("error.refundTooHigh");
    const { error } = await db.from("treatment_card_items")
      .update({ refunded_at: new Date().toISOString(), refund_amount: amount, refund_note: note })
      .eq("id", itemId).is("refunded_at", null);
    if (error) throw error;
  });
}

/** Thu tiền (âm = hoàn tiền khách). */
export async function addCardPayment(cardId: string, input: z.input<typeof cardPaymentSchema>) {
  return run(async (t, db) => {
    z.uuid().parse(cardId);
    const values = cardPaymentSchema.parse(input);
    const profile = await requirePermission("cards.edit");
    if (!(await openCard(db, cardId))) return t("error.cancelled");
    const { error } = await db.from("treatment_card_payments").insert({ ...values, card_id: cardId, created_by: profile.id });
    if (error) throw error;
  });
}

/** Xoá 1 lần thu nhập nhầm — chỉ admin. */
export async function deleteCardPayment(paymentId: string) {
  return run(async (t, db) => {
    z.uuid().parse(paymentId);
    const profile = await requirePermission("cards.edit");
    if (profile.role !== "admin") return t("error.forbidden");
    const { error } = await db.from("treatment_card_payments").delete().eq("id", paymentId);
    if (error) throw error;
  });
}

/** Huỷ thẻ tạo nhầm — chỉ admin, thẻ chưa có tour. Cọc đã trừ được trả lại cho thẻ sau. */
export async function cancelCard(cardId: string) {
  return run(async (t, db) => {
    z.uuid().parse(cardId);
    const profile = await requirePermission("cards.delete");
    if (profile.role !== "admin") return t("error.forbidden");
    const { count, error: countErr } = await db.from("tours").select("id, item:treatment_card_items!inner(card_id)", { count: "exact", head: true })
      .eq("item.card_id", cardId).is("deleted_at", null);
    if (countErr) throw countErr;
    if (count) return t("error.hasTours");
    const { data, error } = await db.from("treatment_cards")
      .update({ cancelled_at: new Date().toISOString(), cancelled_by: profile.id })
      .eq("id", cardId).is("cancelled_at", null).select("id");
    if (error) throw error;
    if (!data.length) return t("error.cancelled");
  });
}

/** Sửa số buổi 1 DV trong thẻ: DV chưa hoàn, thẻ chưa huỷ, không nhỏ hơn số tour đã có. */
export async function updateCardItemSessions(itemId: string, sessions: number) {
  return run(async (t, db) => {
    z.uuid().parse(itemId);
    const value = cardItemSessionsSchema.parse(sessions);
    await requirePermission("cards.edit");
    const { data: item, error: readErr } = await db.from("treatment_card_items").select("card_id")
      .eq("id", itemId).is("refunded_at", null).maybeSingle();
    if (readErr) throw readErr;
    if (!item || !(await openCard(db, item.card_id))) return t("error.cancelled");
    const { count, error: countErr } = await db.from("tours").select("id", { count: "exact", head: true })
      .eq("card_item_id", itemId).is("deleted_at", null);
    if (countErr) throw countErr;
    if (value < (count ?? 0)) return t("error.sessionsBelowUsed", { used: count ?? 0 });
    const { error } = await db.from("treatment_card_items").update({ sessions: value }).eq("id", itemId).is("refunded_at", null);
    if (error) throw error;
  });
}

/**
 * Tạo tour từ thẻ: mỗi dịch vụ chọn = 1 tour (khách, dịch vụ, Hoá đơn = giá bán lấy từ thẻ) theo Loại đã chọn;
 * số lần server tự tính theo tour đã có của dòng DV (tourKindDetail). Tour vào "Chờ nhận" như cũ.
 */
export async function createCardTours(cardId: string, input: z.input<typeof cardTourSchema>) {
  return run(async (t, db) => {
    z.uuid().parse(cardId);
    const values = cardTourSchema.parse(input);
    const profile = await requirePermission("cards.edit");
    const card = await openCard(db, cardId);
    if (!card) return t("error.cancelled");
    const ids = values.items.map((i) => i.card_item_id);
    const [{ data: items, error }, { data: existing, error: toursErr }] = await Promise.all([
      db.from("treatment_card_items").select("id,service_id,price").eq("card_id", cardId).is("refunded_at", null).in("id", ids),
      db.from("tours").select("card_item_id,tour_date,service_detail").in("card_item_id", ids).is("deleted_at", null),
    ]);
    if (error) throw error;
    if (toursErr) throw toursErr;
    if (items.length !== values.items.length) return t("error.itemUnavailable");
    const notes = initialNotes(values.note, profile);
    const rows = values.items.map(({ card_item_id, kind }) => {
      const item = items.find((i) => i.id === card_item_id)!;
      return {
        tour_date: values.tour_date, customer_id: card.customer_id, service_id: item.service_id, card_item_id,
        bill_amount: item.price, notes, created_by: profile.id,
        ...tourKindDetail(kind, values.tour_date, (existing ?? []).filter((x) => x.card_item_id === card_item_id)),
      };
    });
    const { error: insertErr } = await db.from("tours").insert(rows);
    if (insertErr) throw insertErr;
  });
}
