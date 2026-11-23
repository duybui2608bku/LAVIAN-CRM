import { z } from "zod";

// Loại tour (cột service_detail). Laser = mày, Plasma = môi; có số lần với laser/plasma/retouch. Debt chỉ còn ở dữ liệu cũ.
export const SERVICE_DETAILS = ["laser", "plasma", "new", "debt", "retouch"] as const;
export type ServiceDetail = (typeof SERVICE_DETAILS)[number];

/**
 * Công Master (sếp chốt 2026-11-22) = Bill (giá DV trong thẻ) × tỷ lệ theo Loại: Làm mới 7%, Dặm 3% (mọi lần),
 * Laser / Plasma 0%; Debt (dữ liệu cũ) 7%. Mực / phí Master không tạo tour nên không có công.
 */
export const TOUR_RATES: Partial<Record<ServiceDetail, number>> = { new: 0.07, debt: 0.07, retouch: 0.03 };
export const tourCommission = (t: { bill_amount: number | null; service_detail: string | null }) =>
  Math.round((t.bill_amount ?? 0) * (TOUR_RATES[t.service_detail as ServiceDetail] ?? 0));

export type TourStatus = "planned" | "pending" | "claimed" | "confirmed";

/** Trạng thái suy ra: dự kiến (lộ trình tự sinh, chưa chốt lịch); chưa có KTV = chờ nhận; có KTV = chưa xác nhận; admin xác nhận = đã xác nhận. */
export const tourStatus = (t: { technician_id: string | null; confirmed_at: string | null; planned?: boolean }): TourStatus =>
  t.planned ? "planned" : t.confirmed_at ? "confirmed" : t.technician_id ? "claimed" : "pending";

const images = z.array(z.url({ protocol: /^https?$/ })).max(30);

export const tourPatchSchema = z.object({
  tour_date: z.iso.date(),
  customer_id: z.uuid(),
  service_id: z.uuid(),
  technician_id: z.uuid().nullable(),
  // Loại tour — server tự tính số lần (tourKindDetail). Khớp TOUR_KINDS (lib/cards.ts).
  kind: z.enum(["laser", "plasma", "new", "retouch"]), // bắt buộc: tour không Loại thì mất khỏi Đến hạn + không tính công
  before_images: images,
  after_images: images,
  extra_images: images,
}).partial().strict() // không có bill/thanh toán: tiền tour lấy từ thẻ, thu tiền ở thẻ
  .refine((p) => Object.keys(p).length > 0);
