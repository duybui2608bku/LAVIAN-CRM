// Status do code điều khiển (transition + timestamp) — hardcode, KHÔNG đưa vào
// enum_options cho admin sửa (khớp check constraint trong DB).
export const APPOINTMENT_STATUSES = [
  "pending_confirmation",
  "booked",
  "checked_in",
  "completed",
  "no_show",
  "cancelled",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["bank", "cash", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Lịch hẹn — ánh xạ bảng `public.appointments`. */
export interface Appointment {
  id: string;
  customer_id: string;
  staff_id: string | null;
  scheduled_at: string | null; // null = đã cọc, chưa chốt ngày (chờ xếp lịch)
  duration_minutes: number;
  status: AppointmentStatus;
  source: string | null;
  payment_method: PaymentMethod | null;
  deposit_amount: number;
  expected_amount: number | null;
  final_amount: number | null;
  booking_note: string | null;
  internal_note: string | null;
  confirmed_at: string | null;
  checked_in_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  service_ids: string[]; // map từ bảng nối appointment_services (page query nested)
  customer: { full_name: string; phone: string } | null; // join hiển thị
}

/** Dữ liệu tạo/sửa lịch hẹn gửi lên Server Action (status do server điều khiển). */
export interface AppointmentInput {
  customer_id: string;
  staff_id?: string | null;
  scheduled_at?: string | null; // ISO; null/không gửi = chờ xếp lịch
  duration_minutes?: number;
  source?: string | null;
  payment_method?: PaymentMethod | null;
  deposit_amount?: number;
  expected_amount?: number | null;
  final_amount?: number | null;
  booking_note?: string | null;
  internal_note?: string | null;
  service_ids?: string[]; // đồng bộ bảng nối; không gửi = giữ nguyên
}
