import { z } from "zod";

// Loại tour (cột service_detail). Laser = mày, Plasma = môi; có số lần với laser/plasma/retouch. Debt chỉ còn ở dữ liệu cũ.
export const SERVICE_DETAILS = ["laser", "plasma", "new", "debt", "retouch"] as const;
export type ServiceDetail = (typeof SERVICE_DETAILS)[number];

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
  // Loại tour — server tự tính số lần (tourKindDetail). Khớp TOUR_KINDS (lib/cards.ts).
  kind: z.enum(["laser", "plasma", "new", "retouch"]).nullable(),
  before_images: images,
  after_images: images,
  extra_images: images,
}).partial().strict() // không có bill/thanh toán: tiền tour lấy từ thẻ, thu tiền ở thẻ
  .refine((p) => Object.keys(p).length > 0);
