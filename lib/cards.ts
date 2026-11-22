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

/** Thẻ hoàn thành: mọi dịch vụ chưa hoàn đã dùng đủ số buổi. */
export const cardDone = (items: { id: string; sessions: number; refunded_at: string | null }[], used: (itemId: string) => number) =>
  items.some((i) => !i.refunded_at) && items.every((i) => i.refunded_at || used(i.id) >= i.sessions);

const LASER_GROUPS = ["laser", "eyeliner_treatment"];

/**
 * Dịch vụ chi tiết + lần của tour thứ `n` của 1 dịch vụ trong thẻ (lưu DB, UI chỉ hiện "Lần n"):
 * nhóm Laser / tên có "laser" → Laser n; tên có "plasma" → Plasma n; còn lại lần 1 = New, lần n ≥ 2 = Retouch n−1.
 * ponytail: đoán theo nhóm/tên dịch vụ — Debt hay ngoại lệ thì KTV/admin sửa ở drawer tour.
 */
export function tourDetailFor(service: { group_id: string; name: string }, n: number) {
  if (LASER_GROUPS.includes(service.group_id) || /laser/i.test(service.name)) return { service_detail: "laser", service_session: n } as const;
  if (/plasma/i.test(service.name)) return { service_detail: "plasma", service_session: n } as const;
  return n <= 1 ? { service_detail: "new", service_session: null } as const : { service_detail: "retouch", service_session: n - 1 } as const;
}

/** Ngược của tourDetailFor: Lần n của tour (New/Debt = 1, Retouch k = k+1, Laser/Plasma k = k); chưa có → null. */
export function tourSessionOf(tour: { service_detail: string | null; service_session: number | null }): number | null {
  if (tour.service_detail === "new" || tour.service_detail === "debt") return 1;
  if (tour.service_detail === "retouch") return tour.service_session == null ? null : tour.service_session + 1;
  return tour.service_detail ? tour.service_session : null;
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

export const cardPaymentSchema = z.object({
  amount: z.number().int().min(-1e13).max(1e13).refine((v) => v !== 0),
  method: z.enum(CARD_PAYMENT_METHODS),
  note,
  images: z.array(z.url({ protocol: /^https?$/ })).max(30).default([]), // khớp check DB
}).strict();

export const cardTourSchema = z.object({
  tour_date: z.iso.date(),
  items: z.array(z.object({ card_item_id: z.uuid(), session: z.number().int().min(1).max(MAX_TOUR_SESSION) }).strict())
    .min(1).max(30).refine((list) => new Set(list.map((i) => i.card_item_id)).size === list.length),
  note: z.string().trim().max(10000).default(""),
}).strict();
