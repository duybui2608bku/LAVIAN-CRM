"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth";
import {
  areaTaken, cardCreateSchema, cardItemSessionsSchema, cardItemsAddSchema, cardPaymentSchema, cardRefundSchema, cardTourSchema, isTourable, tourKindDetail,
  type CardAudit,
} from "@/lib/cards";
import { normalizeError } from "@/lib/errors";
import { initialNotes } from "@/lib/notes";
import { syncRoadmap } from "@/lib/roadmap-sync";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };
type T = Awaited<ReturnType<typeof getTranslations<"cards">>>;

// Lỗi nghiệp vụ do RPC / trigger DB raise (P0001) → key i18n `cards.error.*`.
const DB_ERRORS: Record<string, string> = {
  card_needs_items: "card_needs_items", customer_not_found: "customer_not_found", appointment_not_arrived: "appointment_not_arrived",
  card_cancelled: "cancelled", item_refunded: "itemUnavailable", tour_card_mismatch: "itemUnavailable",
  payment_over_due: "paymentOverDue", refund_over_paid: "refundOverPaid", service_group_taken: "groupTaken",
  item_has_tours: "itemHasTours", card_area_taken: "areaTaken",
};

/** Thẻ Mày hoặc thẻ Môi (`areaTaken`): kiểm ở server trước khi ghi — DB trigger card_area_taken là chốt chặn cuối. */
async function areaMixed(db: Awaited<ReturnType<typeof createClient>>, serviceIds: string[]) {
  const { data, error } = await db.from("services").select("group_id,tourable").in("id", [...new Set(serviceIds)]);
  if (error) throw error;
  return data.some((s) => areaTaken(s, data));
}

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
    const known = Object.keys(DB_ERRORS).find((code) => message.includes(code));
    if (known) return { error: t(`error.${DB_ERRORS[known]}`) };
    // 23505 = unique: lịch hẹn đã có thẻ đang hiệu lực.
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    return { error: code === "23505" ? t("error.appointmentHasCard") : message };
  }
}

/** Thẻ còn hiệu lực (chưa huỷ, chưa hoàn) — null khi không có. */
async function openCard(db: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await db.from("treatment_cards").select("id,customer_id")
    .eq("id", id).is("cancelled_at", null).is("refunded_at", null).maybeSingle();
  if (error) throw error;
  return data;
}

/** Bán thẻ (Sales Management): RPC tạo thẻ + DV, trừ cọc chưa dùng, khách → Đã mua. */
export async function createCard(input: z.input<typeof cardCreateSchema>) {
  return run(async (t, db) => {
    const values = cardCreateSchema.parse(input);
    await requirePermission("cards.edit");
    if (await areaMixed(db, values.items.map((i) => i.service_id))) return t("error.areaTaken");
    const { data: card, error } = await db.rpc("create_treatment_card", {
      p_customer_id: values.customer_id, p_appointment_id: values.appointment_id, p_items: values.items, p_note: values.note,
    });
    if (error) throw error;
    // Lộ trình lập lúc bán (ngày bắt đầu + ngày sửa tay) → tour dự kiến ngay.
    if (values.plan) await syncRoadmap(db, (card as { id: string }).id, values.plan);
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
    const { data: have, error: haveErr } = await db.from("treatment_card_items").select("service_id")
      .eq("card_id", cardId).is("refunded_at", null);
    if (haveErr) throw haveErr;
    if (await areaMixed(db, [...have.map((i) => i.service_id), ...items.map((i) => i.service_id)])) return t("error.areaTaken");
    const { error } = await db.from("treatment_card_items")
      .insert(items.map((i) => ({ ...i, card_id: cardId, created_by: profile.id })));
    if (error) throw error;
    await syncRoadmap(db, cardId); // bán thêm mày / laser → lộ trình dự kiến tính lại
  });
}

/**
 * Xoá 1 DV khỏi thẻ (bán nhầm / khách đổi ý): RPC chặn DV đã có tour thật, thẻ chỉ còn 1 DV.
 * Nhật ký thẻ (card_audit) tự ghi DV bị xoá. Lộ trình dự kiến tính lại.
 */
export async function deleteCardItem(itemId: string) {
  return run(async (t, db) => {
    z.uuid().parse(itemId);
    await requirePermission("cards.edit");
    const { data: item, error: readErr } = await db.from("treatment_card_items").select("card_id").eq("id", itemId).maybeSingle();
    if (readErr) throw readErr;
    if (!item) return t("error.itemUnavailable");
    const { error } = await db.rpc("delete_treatment_card_item", { p_item_id: itemId });
    if (error) throw error;
    await syncRoadmap(db, item.card_id);
  });
}

/** Hoàn cả thẻ: tiền hoàn ≤ Đã thu; thẻ khoá, tour dự kiến bị xoá (RPC). */
export async function refundCard(cardId: string, input: z.input<typeof cardRefundSchema>) {
  return run(async (_, db) => {
    z.uuid().parse(cardId);
    const { amount, method, note } = cardRefundSchema.parse(input);
    await requirePermission("cards.edit");
    const { error } = await db.rpc("refund_treatment_card", { p_card_id: cardId, p_amount: amount, p_method: method, p_note: note });
    if (error) throw error;
    revalidatePath("/customers");
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

/**
 * Huỷ thẻ tạo nhầm — chỉ admin, chưa thu tiền (đã thu → dùng Hoàn thẻ), chưa có tour nào có Master nhận.
 * Tour chưa ai nhận (dự kiến + Chờ nhận) xoá mềm cùng thẻ. Cọc đã trừ được trả lại cho thẻ sau.
 */
export async function cancelCard(cardId: string) {
  return run(async (t, db) => {
    z.uuid().parse(cardId);
    const profile = await requirePermission("cards.delete");
    if (profile.role !== "admin") return t("error.forbidden");
    // Thẻ đã thu tiền: huỷ sẽ làm khoản thu biến khỏi báo cáo → phải ghi khoản hoàn (số âm) trước.
    const { data: paid, error: paidErr } = await db.from("treatment_card_payments").select("amount").eq("card_id", cardId);
    if (paidErr) throw paidErr;
    if (paid.reduce((s, p) => s + p.amount, 0) !== 0) return t("error.hasPayments");
    const { data: tours, error: toursErr } = await db.from("tours").select("id,technician_id,item:treatment_card_items!inner(card_id)")
      .eq("item.card_id", cardId).is("deleted_at", null);
    if (toursErr) throw toursErr;
    if (tours.some((x) => x.technician_id)) return t("error.hasTours");
    if (tours.length) {
      // Lọc lại technician_id null: Master vừa nhận giữa chừng thì tour đó không bị xoá → dừng huỷ.
      const { data: removed, error: delErr } = await db.from("tours").update({ deleted_at: new Date().toISOString() })
        .in("id", tours.map((x) => x.id)).is("technician_id", null).is("deleted_at", null).select("id");
      if (delErr) throw delErr;
      if (removed.length !== tours.length) return t("error.hasTours");
    }
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
      .eq("card_item_id", itemId).is("deleted_at", null).eq("planned", false);
    if (countErr) throw countErr;
    if (value < (count ?? 0)) return t("error.sessionsBelowUsed", { used: count ?? 0 });
    const { error } = await db.from("treatment_card_items").update({ sessions: value }).eq("id", itemId).is("refunded_at", null);
    if (error) throw error;
    await syncRoadmap(db, item.card_id); // số buổi Laser = laser dự kiến → tính lại lộ trình
  });
}

/**
 * Tạo tour từ thẻ: mỗi dịch vụ chọn = 1 tour (khách, dịch vụ, Hoá đơn = giá bán lấy từ thẻ — cơ sở tính công Master) theo Loại;
 * số lần server tự tính theo tour đã có của dòng DV (tourKindDetail). Tour vào "Chờ nhận" như cũ.
 * Chặn DV không tạo tour (mực, phí Master); vượt số buổi chỉ admin.
 */
export async function createCardTours(cardId: string, input: z.input<typeof cardTourSchema>) {
  return run(async (t, db) => {
    z.uuid().parse(cardId);
    const values = cardTourSchema.parse(input);
    const profile = await requirePermission("cards.edit");
    const card = await openCard(db, cardId);
    if (!card) return t("error.cancelled");
    const ids = values.items.map((i) => i.card_item_id);
    const [{ data: items, error }, { data: existing, error: toursErr }, { data: planned, error: plannedErr }] = await Promise.all([
      db.from("treatment_card_items").select("id,service_id,sessions,service:services(tourable)")
        .eq("card_id", cardId).is("refunded_at", null).in("id", ids),
      db.from("tours").select("card_item_id,tour_date,service_detail").in("card_item_id", ids).is("deleted_at", null).eq("planned", false),
      db.from("tours").select("id,card_item_id").in("card_item_id", ids).is("deleted_at", null).eq("planned", true).order("tour_date"),
    ]);
    if (error) throw error;
    if (toursErr) throw toursErr;
    if (plannedErr) throw plannedErr;
    // Join many-to-one trả object (kiểu suy ra của supabase-js là mảng).
    if (items.length !== values.items.length || !items.every((i) => isTourable(i as unknown as { service: { group_id: string; tourable: boolean } | null })))
      return t("error.itemUnavailable");
    const usedOf = (id: string) => (existing ?? []).filter((x) => x.card_item_id === id).length;
    if (profile.role !== "admin" && items.some((i) => usedOf(i.id) >= i.sessions)) return t("error.overSessions");
    const notes = initialNotes(values.note, profile);
    const rows = values.items.map(({ card_item_id, kind }) => {
      const item = items.find((i) => i.id === card_item_id)!;
      return {
        tour_date: values.tour_date, customer_id: card.customer_id, service_id: item.service_id, card_item_id,
        notes, created_by: profile.id,
        ...tourKindDetail(kind, values.tour_date, (existing ?? []).filter((x) => x.card_item_id === card_item_id)),
      };
    });
    // DV đã có tour dự kiến → dùng tour dự kiến sớm nhất làm tour thật (giữ id, không tạo trùng); còn lại tạo mới.
    const reuse = (itemId: string) => planned?.find((p) => p.card_item_id === itemId)?.id;
    const writes = rows.map((row) => {
      const id = reuse(row.card_item_id);
      return id
        ? db.from("tours").update({ ...row, planned: false, date_pinned: false }).eq("id", id).eq("planned", true)
        : db.from("tours").insert(row as Record<string, unknown>);
    });
    for (const { error: writeErr } of await Promise.all(writes)) if (writeErr) throw writeErr;
    await syncRoadmap(db, cardId);
  });
}

/** Lịch sử thao tác của thẻ (drawer thẻ) — nhật ký `card_audit` do trigger DB ghi, mới nhất trước. */
export async function getCardHistory(cardId: string): Promise<{ rows?: CardAudit[]; error?: string }> {
  try {
    await requirePermission("cards.view");
    z.uuid().parse(cardId);
    const db = await createClient();
    const { data, error } = await db.from("card_audit").select("id,table_name,op,old_row,new_row,actor,at")
      .eq("card_id", cardId).order("at", { ascending: false }).order("id").limit(300);
    if (error) throw error;
    return { rows: data as CardAudit[] };
  } catch (error) {
    return { error: normalizeError(error).message };
  }
}
