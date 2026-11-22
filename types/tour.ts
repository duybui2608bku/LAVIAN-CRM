import type { TourKind } from "@/lib/cards";
import type { ServiceDetail } from "@/lib/tours";
import type { TimelineNote } from "./note";

/** Bảng `public.tours`. Hoá đơn = giá bán DV trong thẻ (gán khi tạo tour, chỉ xem); thanh toán thu ở thẻ. */
export interface Tour {
  id: string;
  tour_date: string; // YYYY-MM-DD
  customer_id: string;
  service_id: string;
  card_item_id: string | null; // dòng dịch vụ của thẻ liệu trình (tour cũ = null)
  service_detail: ServiceDetail | null;
  service_session: number | null;
  notes: TimelineNote[]; // ghi chú tour dạng timeline
  technician_id: string | null;
  before_images: string[];
  after_images: string[];
  extra_images: string[];
  bill_amount: number | null; // Rupiah
  confirmed_at: string | null;
  created_by: string | null;
  customer: { full_name: string; phone: string } | null;
}

export const TOUR_FIELDS = "id,tour_date,customer_id,service_id,card_item_id,service_detail,service_session,notes,technician_id,"
  + "before_images,after_images,extra_images,bill_amount,confirmed_at,created_by,"
  + "customer:customers(full_name,phone)";

/** Sửa tour: Loại (`kind`) gửi lên, server tự tính service_detail + số lần. */
export type TourPatch = Partial<Pick<Tour,
  "tour_date" | "customer_id" | "service_id" | "technician_id" | "before_images" | "after_images" | "extra_images"
> & { kind: TourKind | null }>;

export type TourImageField = "before_images" | "after_images" | "extra_images";
