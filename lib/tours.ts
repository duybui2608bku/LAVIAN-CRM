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

/**
 * Hoá đơn của tour ở trang Tour (sếp chốt 2026-11-27): giá dòng thẻ là giá TRỌN GÓI (mày 500 làm mấy buổi cũng 500)
 * → chỉ tour thật ĐẦU TIÊN của dòng thẻ ghi giá (`billed`), các buổi sau null. Tổng / Excel / phiếu cộng theo hàm này.
 * Công Master vẫn tính trên giá cả dòng (`tourCommission`). `billed` undefined (không tính) = giữ giá như cũ.
 */
export const tourBill = (t: { bill_amount: number | null; billed?: boolean }) => (t.billed === false ? null : t.bill_amount);

/** Id tour thật đầu tiên của mỗi dòng thẻ (sớm nhất theo ngày, cùng ngày → tạo trước). Tour không thẻ = luôn là đầu. */
export function firstTourIds(tours: { id: string; card_item_id: string | null; tour_date: string; created_at: string }[]) {
  const first = new Map<string, (typeof tours)[number]>();
  for (const t of tours) {
    if (!t.card_item_id) continue;
    const cur = first.get(t.card_item_id);
    if (!cur || t.tour_date < cur.tour_date || (t.tour_date === cur.tour_date && t.created_at < cur.created_at)) first.set(t.card_item_id, t);
  }
  return new Set([...first.values()].map((t) => t.id));
}

/**
 * Master của khách = Master của tour thật gần nhất (ngày lớn nhất) đã có người nhận — nguồn duy nhất là `tours`
 * (bỏ cột customers.technician_id 2026-11-27). Không có → null.
 */
export function latestMaster(tours: { tour_date: string; technician_id: string | null; planned?: boolean }[]) {
  return tours.filter((t) => t.technician_id && !t.planned)
    .reduce<(typeof tours)[number] | null>((a, t) => (!a || t.tour_date > a.tour_date ? t : a), null)?.technician_id ?? null;
}

/**
 * Ghim ngày bước dự kiến `id` = `day` (tours = mọi tour chưa xoá của cùng dòng thẻ). Thứ tự bước theo ngày, nên ngày mới phải
 * nằm sau mọi tour thật + bước dự kiến trước nó và trước bước dự kiến đã ghim kế sau — không thì cờ ghim nhảy sang bước khác.
 * Không ghim vào quá khứ. Hợp lệ → null.
 */
export function plannedDateError(
  id: string, day: string, today: string,
  tours: { id: string; tour_date: string; planned: boolean; date_pinned: boolean }[],
): { key: "plannedPast" | "plannedBeforePrev" | "plannedAfterNext"; date?: string } | null {
  if (day < today) return { key: "plannedPast" };
  const planned = tours.filter((t) => t.planned).sort((a, b) => a.tour_date.localeCompare(b.tour_date) || a.id.localeCompare(b.id));
  const k = planned.findIndex((t) => t.id === id);
  if (k < 0) return null; // không phải bước dự kiến → server báo forbidden
  const prev = [...tours.filter((t) => !t.planned), ...planned.slice(0, k)].reduce<string | null>(
    (max, t) => (!max || t.tour_date > max ? t.tour_date : max), null);
  if (prev && day <= prev) return { key: "plannedBeforePrev", date: prev };
  const next = planned.slice(k + 1).find((t) => t.date_pinned)?.tour_date;
  if (next && day >= next) return { key: "plannedAfterNext", date: next };
  return null;
}

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
