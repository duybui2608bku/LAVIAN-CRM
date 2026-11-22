import { z } from "zod";

// Thẻ liệu trình — tiền + quy tắc dùng chung client/server. Literal (không import "@/…") để node --test chạy được.
export const CARD_PAYMENT_METHODS = ["cash", "bank", "card"] as const; // khớp check DB treatment_card_payments.method
export type CardPaymentMethod = (typeof CARD_PAYMENT_METHODS)[number];
export const MAX_TOUR_SESSION = 20; // khớp check tours.service_session

type MoneyItem = { price: number; refund_amount: number | null };
type MoneyCard = { deposit_used: number; items: MoneyItem[]; payments: { amount: number }[] };

/**
 * Giá trị thẻ = Σ giá bán − Σ tiền hoàn; Đã thu = cọc trừ vào thẻ + Σ thanh toán (âm = đã hoàn khách);
 * Công nợ = Giá trị − Đã thu (âm = phải hoàn khách).
 */
export function cardMoney(card: MoneyCard) {
  const value = card.items.reduce((s, i) => s + i.price - (i.refund_amount ?? 0), 0);
  const collected = card.deposit_used + card.payments.reduce((s, p) => s + p.amount, 0);
  return { value, collected, due: value - collected };
}

/** Gợi ý tiền hoàn 1 dịch vụ = giá × buổi chưa làm / tổng buổi. */
export const suggestRefund = (price: number, sessions: number, used: number) =>
  Math.round((price * Math.max(sessions - used, 0)) / Math.max(sessions, 1));

/** DV của dòng thẻ (join `services`): `tourable = false` = mực, phí Master, sản phẩm — không tạo tour, không tính buổi. */
type ItemService = { service?: { group_id: string; tourable: boolean } | null };
export const isTourable = (item: ItemService) => item.service?.tourable !== false;

/** Thẻ hoàn thành: mọi dịch vụ (tạo tour được) chưa hoàn đã dùng đủ số buổi. */
export function cardDone(items: ({ id: string; sessions: number; refunded_at: string | null } & ItemService)[], used: (itemId: string) => number) {
  const list = items.filter(isTourable);
  return list.some((i) => !i.refunded_at) && list.every((i) => i.refunded_at || used(i.id) >= i.sessions);
}

// ───────── Loại tour + lộ trình liệu trình (sếp chốt 2026-11-22) ─────────
// Laser (mày) / Plasma (môi) xoá cũ → kiểm tra sau 20 ngày: tour kế tiếp lại Laser = chưa OK, Làm mới = OK.
// Làm mới / Dặm xong → dặm sau 45 ngày nếu DV còn buổi.
export const LASER_CHECK_DAYS = 20;
export const RETOUCH_DAYS = 45;
/** Loại tour chọn được = tours.service_detail (debt chỉ còn ở dữ liệu cũ). Khớp tourPatchSchema.kind (lib/tours.ts). */
export const TOUR_KINDS = ["laser", "plasma", "new", "retouch"] as const;
export type TourKind = (typeof TOUR_KINDS)[number];

const LASER_GROUPS = ["laser", "eyeliner_treatment"];
const isRemoval = (detail: string | null) => detail === "laser" || detail === "plasma";
/** Vùng làm (mày / môi / mí): nhóm xoá cũ cùng vùng với nhóm phun — laser mày chỉ chặn dặm mày, không chặn môi. */
const AREA: Record<string, string> = { laser: "alis", lips_treatment: "bibir", eyeliner_treatment: "eyeliner" };
const areaOf = (groupId: string | undefined) => (groupId ? AREA[groupId] ?? groupId : "");

type KindTour = { tour_date: string; service_detail: string | null };

/** Loại gợi ý cho tour mới của 1 dòng DV: nhóm Laser / tên "laser" → Laser; tên "plasma" → Plasma; chưa Làm mới → Làm mới; còn lại Dặm. */
export function suggestTourKind(service: { group_id: string; name: string }, itemTours: KindTour[]): TourKind {
  if (LASER_GROUPS.includes(service.group_id) || /laser/i.test(service.name)) return "laser";
  if (/plasma/i.test(service.name)) return "plasma";
  return itemTours.some((t) => t.service_detail === "new") ? "retouch" : "new";
}

/**
 * Giá trị lưu DB của Loại: Làm mới không có số; Laser / Plasma / Dặm số n = số tour cùng loại khác của dòng DV
 * có ngày ≤ ngày tour này + 1 (check DB: 1–20).
 * ponytail: đổi Loại / ngày 1 tour không đánh số lại các tour sau — chỉ là nhãn.
 */
export function tourKindDetail(kind: TourKind, date: string, others: KindTour[]) {
  if (kind === "new") return { service_detail: kind, service_session: null };
  const n = others.filter((t) => t.service_detail === kind && t.tour_date <= date).length + 1;
  return { service_detail: kind, service_session: Math.min(n, MAX_TOUR_SESSION) };
}

const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

type DueItem = { id: string; service_id: string; sessions: number; refunded_at: string | null } & ItemService;
type DueCard = { cancelled_at: string | null; items: DueItem[] };
type DueTour = KindTour & { card_item_id: string | null; service_session: number | null };
export type JourneyDue<C, T> = {
  card: C;
  item: DueItem;
  /** laser_check = Kiểm tra laser/plasma; retouch = Dặm lần `n`. */
  task: "laser_check" | "retouch";
  n: number;
  due: string; // YYYY-MM-DD
  last: T; // tour tính hạn
};

/**
 * Việc đến hạn của khách đang có liệu trình — tự tính từ thẻ + tour, không lưu. Tính riêng từng vùng (mày / môi / mí):
 * - Tour cuối của vùng là Laser/Plasma + vùng còn buổi → Kiểm tra laser (ngày tour + 20): đủ điều kiện phun mới chưa.
 * - Ngược lại, mỗi DV chưa hoàn còn buổi có tour cuối Làm mới / Dặm → Dặm (ngày tour + 45).
 * Bỏ qua DV không tạo tour (mực, phí Master). Tour ngày tương lai cũng tính là "tour kế tiếp" (đã hẹn thì không nhắc lại).
 */
export function journeyDue<C extends DueCard, T extends DueTour>(cards: C[], tours: T[]): JourneyDue<C, T>[] {
  const out: JourneyDue<C, T>[] = [];
  // Cùng ngày: tour xoá cũ (laser/plasma) xếp trước → tour Làm mới cùng ngày mới là "tour cuối".
  const order = (a: KindTour, b: KindTour) =>
    a.tour_date.localeCompare(b.tour_date) || Number(isRemoval(b.service_detail)) - Number(isRemoval(a.service_detail));
  const ofItem = (id: string) => tours.filter((t) => t.card_item_id === id).sort(order);
  for (const card of cards) {
    if (card.cancelled_at) continue;
    const areas = new Map<string, DueItem[]>();
    for (const i of card.items.filter(isTourable)) {
      const key = areaOf(i.service?.group_id) || i.service_id;
      areas.set(key, [...(areas.get(key) ?? []), i]);
    }
    for (const items of areas.values()) {
      const open = items.filter((i) => !i.refunded_at && ofItem(i.id).length < i.sessions);
      const last = items.flatMap((item) => ofItem(item.id).map((tour) => ({ tour, item })))
        .sort((a, b) => order(a.tour, b.tour)).at(-1);
      if (last && isRemoval(last.tour.service_detail)) {
        if (open.length) out.push({ card, item: last.item, task: "laser_check", n: last.tour.service_session ?? 1,
          due: addDays(last.tour.tour_date, LASER_CHECK_DAYS), last: last.tour });
        continue;
      }
      for (const item of open) {
        const list = ofItem(item.id);
        const end = list.at(-1);
        if (!end || (end.service_detail !== "new" && end.service_detail !== "retouch")) continue;
        out.push({ card, item, task: "retouch", n: list.filter((t) => t.service_detail === "retouch").length + 1,
          due: addDays(end.tour_date, RETOUCH_DAYS), last: end });
      }
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

const money = z.number().int().min(0).max(1e13);
const note = z.string().trim().max(2000).default("");
export const cardItemInputSchema = z.object({
  service_id: z.uuid(),
  price: money,
  sessions: z.number().int().min(1).max(100),
}).strict();
const items = z.array(cardItemInputSchema).min(1).max(30);

export const cardCreateSchema = z.object({
  customer_id: z.uuid(),
  appointment_id: z.uuid().nullable(),
  items,
  note,
}).strict();

export const cardItemsAddSchema = items;

export const cardRefundSchema = z.object({ amount: money, note }).strict();

/** Sửa số buổi 1 DV trong thẻ (khớp check DB 1–100; server chặn thêm < số tour đã có). */
export const cardItemSessionsSchema = cardItemInputSchema.shape.sessions;

export const cardPaymentSchema = z.object({
  amount: z.number().int().min(-1e13).max(1e13).refine((v) => v !== 0),
  method: z.enum(CARD_PAYMENT_METHODS),
  note,
  images: z.array(z.url({ protocol: /^https?$/ })).max(30).default([]), // khớp check DB
}).strict();

export const cardTourSchema = z.object({
  tour_date: z.iso.date(),
  items: z.array(z.object({ card_item_id: z.uuid(), kind: z.enum(TOUR_KINDS) }).strict())
    .min(1).max(30).refine((list) => new Set(list.map((i) => i.card_item_id)).size === list.length),
  note: z.string().trim().max(10000).default(""),
}).strict();
