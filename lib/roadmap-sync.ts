import "server-only";
import { planRoadmap, tourKindDetail } from "@/lib/cards";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;
type PlanItem = Parameters<typeof planRoadmap>[0][number];
type TourRow = {
  id: string; card_item_id: string; tour_date: string; service_detail: string | null; service_session: number | null;
  planned: boolean; date_pinned: boolean;
};

/**
 * Sinh lại tour dự kiến (`planned`) của 1 thẻ theo `planRoadmap` — gọi sau mọi thay đổi tour / dòng DV của thẻ.
 * Diff tại chỗ theo từng dòng DV (trigger tours_card_guard không cho đổi dòng DV của tour): sửa ngày / Loại nếu khác,
 * thêm phần thiếu, xoá mềm phần thừa. Tour thật không bao giờ bị đụng. Thẻ huỷ → xoá hết tour dự kiến.
 * ponytail: không transaction — 2 người sửa cùng thẻ cùng lúc có thể lệch, lần sync sau tự sửa.
 */
export async function syncRoadmap(db: Db, cardId: string) {
  const { data: card, error } = await db.from("treatment_cards")
    .select("customer_id,cancelled_at,items:treatment_card_items(id,service_id,sessions,refunded_at,service:services(group_id,tourable))")
    .eq("id", cardId).single();
  if (error) throw error;
  const items = card.items as unknown as PlanItem[];
  if (!items.length) return;
  const { data, error: toursErr } = await db.from("tours")
    .select("id,card_item_id,tour_date,service_detail,service_session,planned,date_pinned")
    .in("card_item_id", items.map((i) => i.id)).is("deleted_at", null);
  if (toursErr) throw toursErr;
  const tours = (data ?? []) as TourRow[];
  const real = tours.filter((t) => !t.planned);
  const planned = tours.filter((t) => t.planned).sort((a, b) => a.tour_date.localeCompare(b.tour_date) || a.id.localeCompare(b.id));
  const plannedOf = (itemId: string) => planned.filter((t) => t.card_item_id === itemId);
  // Ngày đã sửa tay (date_pinned) của bước dự kiến thứ k → giữ nguyên khi tính lại.
  const pinned = (itemId: string, k: number) => { const h = plannedOf(itemId)[k]; return h?.date_pinned ? h.tour_date : null; };

  // Số lần (Laser n / Dặm n) đếm cả tour thật + bước dự kiến trước đó của cùng dòng.
  const seen: { card_item_id: string; tour_date: string; service_detail: string | null }[] = [...real];
  const want = (card.cancelled_at ? [] : planRoadmap(items, real, pinned)).map((step) => {
    const detail = tourKindDetail(step.kind, step.tour_date, seen.filter((t) => t.card_item_id === step.card_item_id));
    seen.push({ card_item_id: step.card_item_id, tour_date: step.tour_date, service_detail: detail.service_detail });
    return { ...step, ...detail };
  });

  const now = new Date().toISOString();
  const inserts: Record<string, unknown>[] = [];
  const updates: PromiseLike<{ error: unknown }>[] = [];
  for (const item of items) {
    const have = plannedOf(item.id);
    const need = want.filter((w) => w.card_item_id === item.id);
    need.forEach((w, k) => {
      const values = { tour_date: w.tour_date, service_detail: w.service_detail, service_session: w.service_session };
      const h = have[k];
      if (!h) inserts.push({ ...values, card_item_id: item.id, service_id: w.service_id, customer_id: card.customer_id, planned: true });
      else if (h.tour_date !== w.tour_date || h.service_detail !== w.service_detail || h.service_session !== w.service_session)
        updates.push(db.from("tours").update(values).eq("id", h.id).eq("planned", true));
    });
    for (const h of have.slice(need.length))
      updates.push(db.from("tours").update({ deleted_at: now }).eq("id", h.id).eq("planned", true));
  }
  if (inserts.length) updates.push(db.from("tours").insert(inserts));
  for (const result of await Promise.all(updates)) if (result.error) throw result.error;
}

/** Thẻ của 1 tour (null = tour không gắn thẻ). */
export async function cardIdOfTour(db: Db, tourId: string): Promise<string | null> {
  const { data, error } = await db.from("tours").select("item:treatment_card_items(card_id)").eq("id", tourId).single();
  if (error) throw error;
  return (data.item as unknown as { card_id: string } | null)?.card_id ?? null;
}
