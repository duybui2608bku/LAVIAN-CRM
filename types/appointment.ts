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

// Loại dòng sổ thanh toán: cọc / thu / hoàn (amount luôn dương, refund trừ đi).
export const PAYMENT_KINDS = ["deposit", "payment", "refund"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

/** Một lần tiền vào/ra của một SỔ (liệu trình) — bảng `public.appointment_payments`.
 *  `appointment_id` chỉ là dấu vết buổi thu (nullable). Dòng sổ bất biến:
 *  sửa sai = xóa + thêm lại, hoàn tiền thật = dòng refund. */
export interface AppointmentPayment {
  id: string;
  ledger_id: string | null; // null = dòng mồ côi (lịch cũ không dịch vụ)
  appointment_id: string | null;
  kind: PaymentKind;
  amount: number;
  payment_method: PaymentMethod | null;
  image_url: string | null; // ảnh chứng từ (public URL)
  note: string | null;
  paid_at: string;
  created_by: string | null;
  created_at: string;
}

/** Sổ tiền của một liệu trình (khách hàng + dịch vụ) — bảng `public.service_ledgers`.
 *  Mỗi cặp chỉ có 1 sổ ĐANG MỞ; mọi lịch hẹn cùng cặp dùng chung tổng giá + dòng tiền. */
export interface ServiceLedger {
  id: string;
  customer_id: string;
  service_id: string;
  total_amount: number | null; // tổng giá liệu trình (null = chưa báo giá)
  closed_at: string | null; // null = đang mở; set khi Tất toán
  created_by: string | null;
  created_at: string;
  updated_at: string;
  payments: AppointmentPayment[]; // dòng tiền mọi buổi (nested), mới nhất trước
}

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
  ledger_id: string | null; // sổ tiền của (khách, dịch vụ) — null = lịch cũ không dịch vụ
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
  ledger: ServiceLedger | null; // sổ tiền (nested qua ledger_id)
  payments: AppointmentPayment[]; // dòng tiền THEO LỊCH — chỉ fallback khi không sổ
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
  /** Tổng giá liệu trình — ghi vào SỔ của (khách, dịch vụ); undefined = không đụng. */
  total_amount?: number | null;
  booking_note?: string | null;
  internal_note?: string | null;
  service_ids?: string[]; // bắt buộc đúng 1 phần tử (server validate)
  /** Cọc ban đầu — CHỈ dùng khi tạo mới: ghi 1 dòng deposit vào sổ. */
  deposit?: {
    amount: number;
    payment_method?: PaymentMethod | null;
    image_url?: string | null;
  };
}

/** Dữ liệu thêm 1 dòng sổ thanh toán (addPayment). */
export interface PaymentInput {
  kind: PaymentKind;
  amount: number;
  payment_method?: PaymentMethod | null;
  image_url?: string | null;
  note?: string | null;
}
