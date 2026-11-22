import { z } from "zod";

// Dịch vụ chi tiết của tour. Laser = mày, Plasma = môi; có "lần" với laser/plasma/retouch.
export const SERVICE_DETAILS = ["laser", "plasma", "new", "debt", "retouch"] as const;
export const SESSION_DETAILS = ["laser", "plasma", "retouch"] as const;
export type ServiceDetail = (typeof SERVICE_DETAILS)[number];
export const MAX_SESSION = 20;

export const needsSession = (detail: ServiceDetail | null | undefined) =>
  !!detail && (SESSION_DETAILS as readonly string[]).includes(detail);

export type TourStatus = "pending" | "claimed" | "confirmed";

/** Trạng thái suy ra: chưa có KTV = chờ nhận; có KTV = chưa xác nhận; admin xác nhận = đã xác nhận. */
export const tourStatus = (t: { technician_id: string | null; confirmed_at: string | null }): TourStatus =>
  t.confirmed_at ? "confirmed" : t.technician_id ? "claimed" : "pending";

const images = z.array(z.url({ protocol: /^https?$/ })).max(30);

export const tourPatchSchema = z.object({
  tour_date: z.iso.date(),
  customer_id: z.uuid(),
  service_id: z.uuid(),
  technician_id: z.uuid().nullable(),
  service_detail: z.enum(SERVICE_DETAILS).nullable(),
  service_session: z.number().int().min(1).max(MAX_SESSION).nullable(),
  before_images: images,
  after_images: images,
  extra_images: images,
}).partial().strict() // không có bill/thanh toán: tiền tour lấy từ thẻ, thu tiền ở thẻ
  .refine((p) => Object.keys(p).length > 0)
  // Dịch vụ chi tiết luôn gửi kèm lần, khớp check constraint DB.
  .refine((p) => (p.service_detail === undefined) === (p.service_session === undefined))
  .refine((p) => p.service_detail === undefined || needsSession(p.service_detail) === (p.service_session != null));
