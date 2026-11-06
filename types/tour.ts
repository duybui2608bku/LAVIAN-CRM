import type { PaymentMethod, ServiceDetail } from "@/lib/tours";

/** Bảng `public.tours`. Thực thu = bill × % tính trong code (lib/tours.ts). */
export interface Tour {
  id: string;
  tour_date: string; // YYYY-MM-DD
  customer_id: string;
  service_id: string;
  service_detail: ServiceDetail | null;
  service_session: number | null;
  note: string;
  technician_id: string | null;
  before_images: string[];
  after_images: string[];
  extra_images: string[];
  bill_amount: number | null; // Rupiah
  payment_method: PaymentMethod | null;
  confirmed_at: string | null;
  created_by: string | null;
  customer: { full_name: string; phone: string } | null;
}

export const TOUR_FIELDS = "id,tour_date,customer_id,service_id,service_detail,service_session,note,technician_id,"
  + "before_images,after_images,extra_images,bill_amount,payment_method,confirmed_at,created_by,"
  + "customer:customers(full_name,phone)";

export type TourPatch = Partial<Pick<Tour,
  "tour_date" | "customer_id" | "service_id" | "note" | "technician_id" | "service_detail" | "service_session"
  | "bill_amount" | "payment_method" | "before_images" | "after_images" | "extra_images"
>>;

export type TourImageField = "before_images" | "after_images" | "extra_images";
