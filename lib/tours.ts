import { z } from "zod";

// Dịch vụ chi tiết của tour. Laser = mày, Plasma = môi; có "lần" với laser/plasma/retouch.
export const SERVICE_DETAILS = ["laser", "plasma", "new", "debt", "retouch"] as const;
export const SESSION_DETAILS = ["laser", "plasma", "retouch"] as const;
export type ServiceDetail = (typeof SERVICE_DETAILS)[number];
export const MAX_SESSION = 20;
export const PAYMENT_METHODS = ["cash", "bank", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const needsSession = (detail: ServiceDetail | null | undefined) =>
  !!detail && (SESSION_DETAILS as readonly string[]).includes(detail);

/** % thực thu: Laser/Plasma 0, New/Debt 7%, Retouch lần 1 3%, lần ≥2 0. */
export function tourRate(detail: ServiceDetail, session: number | null): number {
  if (detail === "new" || detail === "debt") return 0.07;
  if (detail === "retouch") return session === 1 ? 0.03 : 0;
  return 0;
}

/** Thực thu = bill × %. null khi chưa đủ dịch vụ chi tiết / bill. */
export function tourAmount(detail: ServiceDetail | null, session: number | null, bill: number | null) {
  if (!detail || bill == null || (needsSession(detail) && !session)) return null;
  return Math.round(bill * tourRate(detail, session));
}

export type TourStatus = "pending" | "claimed" | "confirmed";

/** Trạng thái suy ra: chưa có KTV = chờ nhận; có KTV = chưa xác nhận; admin xác nhận = đã xác nhận. */
export const tourStatus = (t: { technician_id: string | null; confirmed_at: string | null }): TourStatus =>
  t.confirmed_at ? "confirmed" : t.technician_id ? "claimed" : "pending";

const images = z.array(z.url({ protocol: /^https?$/ })).max(30);
const billAmount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable();

export const tourCreateSchema = z.object({
  tour_date: z.iso.date(),
  customer_id: z.uuid(),
  service_id: z.uuid(),
  bill_amount: billAmount.optional(),
  note: z.string().trim().max(10000).default(""),
}).strict();

export const tourPatchSchema = z.object({
  tour_date: z.iso.date(),
  customer_id: z.uuid(),
  service_id: z.uuid(),
  note: z.string().trim().max(10000),
  technician_id: z.uuid().nullable(),
  service_detail: z.enum(SERVICE_DETAILS).nullable(),
  service_session: z.number().int().min(1).max(MAX_SESSION).nullable(),
  bill_amount: billAmount,
  payment_method: z.enum(PAYMENT_METHODS).nullable(),
  before_images: images,
  after_images: images,
  extra_images: images,
}).partial().strict()
  .refine((p) => Object.keys(p).length > 0)
  // Dịch vụ chi tiết luôn gửi kèm lần, khớp check constraint DB.
  .refine((p) => (p.service_detail === undefined) === (p.service_session === undefined))
  .refine((p) => p.service_detail === undefined || needsSession(p.service_detail) === (p.service_session != null));
