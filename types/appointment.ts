import type { CustomerNote, OtherChannel } from "./customer";
import type { ServiceCategory } from "./service";

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

/** Status lịch hẹn (cột `visit_status`, Sales đổi). arrived/in_progress/done = đã đến (`checked_in`, trigger DB tính). */
export const VISIT_STATUSES = ["waiting", "arrived", "in_progress", "done", "rescheduled", "cancelled"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export const VISIT_STATUS_COLORS: Record<VisitStatus, string> = {
  waiting: "default",
  arrived: "blue",
  in_progress: "gold",
  done: "green",
  rescheduled: "volcano",
  cancelled: "red",
};

export interface Appointment {
  id: string;
  customer_id: string;
  scheduled_at: string;
  booking_confirm: BookingStatus; // Telesales gọi lại xác nhận lịch
  checked_in: boolean; // chỉ đọc — DB tính từ visit_status
  visit_status: VisitStatus;
  service_categories: ServiceCategory[]; // nhóm dịch vụ Telesales chọn khi tạo lịch
  service_ids: string[]; // dịch vụ chi tiết — điền sau
  staff_id: string | null; // chăm sóc khách hàng
  sales_id: string | null; // nhân viên bộ phận Sales phụ trách lịch
  technician_id: string | null; // Master / KTV làm lịch (bộ phận technician)
  bill_amount: number | null; // giá trị dịch vụ (IDR) — cột Tài chính
  paid_amount: number | null; // thu thêm sau Deposit (IDR) — Thực thu = Deposit + paid_amount
  sales_note: string; // ghi chú của Sales (note = ghi chú Telesales)
  created_by: string | null; // người tạo lịch (lịch cũ không truy được → null)
  note: string;
}

export type AppointmentCustomer = {
  id: string;
  full_name: string;
  phone: string;
  source: string | null;
  staff_id?: string | null; // CSKH của khách — mặc định cho lịch hẹn mới
  thread_link?: string | null; // link hội thoại SMAX (customers.thread->>link)
  instagram_username?: string | null; // username IG (smax_data->customer->instagram->>username) — cột Nguồn
  deposit_amount?: number | null; // tiền cọc của khách — dòng Deposit cột Tài chính
  other_channel?: OtherChannel | null; // kênh thứ hai — cột Nguồn 2 hàng
  notes?: CustomerNote[] | null; // ghi chú Telesales của khách (customers.notes) — cột Note Telesales
};

/** Trường lịch hẹn được log (khớp trigger `log_clinic_appointment_change`). */
export type AppointmentLogField = "scheduled_at" | "booking_confirm" | "checked_in" | "visit_status" | "service_categories" | "service_ids"
  | "staff_id" | "sales_id" | "technician_id" | "bill_amount" | "paid_amount" | "note" | "sales_note";

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
  "scheduled_at" | "booking_confirm" | "visit_status" | "service_categories" | "service_ids" | "staff_id" | "sales_id"
  | "technician_id" | "bill_amount" | "paid_amount" | "note" | "sales_note"
>>;
