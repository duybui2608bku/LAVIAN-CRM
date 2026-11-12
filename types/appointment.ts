// Lịch hẹn chỉ lưu lịch đến của khách (tính doanh số CSKH). Tour KTV ở bảng `tours` (types/tour.ts).
export interface Appointment {
  id: string;
  customer_id: string;
  scheduled_at: string;
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

export type AppointmentPatch = Partial<Pick<Appointment,
  "scheduled_at" | "checked_in" | "service_ids" | "staff_id" | "note"
>>;
