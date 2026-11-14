// Lịch hẹn chỉ lưu lịch đến của khách (tính doanh số Telesales). Tour KTV ở bảng `tours` (types/tour.ts).

/** Trạng thái xác nhận lịch (cột `booking_confirm`, check constraint ở DB). */
export const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "rescheduled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  pending: "orange",
  confirmed: "green",
  cancelled: "red",
  rescheduled: "blue",
};

export interface Appointment {
  id: string;
  customer_id: string;
  scheduled_at: string;
  booking_confirm: BookingStatus; // Telesales gọi lại xác nhận lịch
  checked_in: boolean;
  service_ids: string[];
  staff_id: string | null; // chăm sóc khách hàng
  note: string;
}

export type AppointmentCustomer = {
  id: string;
  full_name: string;
  phone: string;
  source: string | null;
  staff_id?: string | null; // CSKH của khách — mặc định cho lịch hẹn mới
  wa?: string | null; // "WA-xxxx" rút từ thread SMAX (dẫn xuất, không phải cột DB)
};

/** Trường lịch hẹn được log (khớp trigger `log_clinic_appointment_change`). */
export type AppointmentLogField = "scheduled_at" | "booking_confirm" | "checked_in" | "service_ids" | "staff_id" | "note";

/** 1 dòng `clinic_appointment_logs` — actor_id null = ghi qua admin client (Form SMAX). */
export interface AppointmentLog {
  id: string;
  appointment_id: string;
  action: "create" | "update" | "delete";
  changes: Partial<Record<AppointmentLogField, { old: unknown; new: unknown }>>;
  actor_id: string | null;
  created_at: string;
  appointment: { scheduled_at: string } | null;
}

export type AppointmentPatch =Partial<Pick<Appointment,
  "scheduled_at" | "booking_confirm" | "checked_in" | "service_ids" | "staff_id" | "note"
>>;
