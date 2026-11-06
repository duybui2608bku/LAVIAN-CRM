import type { ServiceDetail } from "@/lib/appointments";

export interface Appointment {
  id: string;
  customer_id: string;
  scheduled_at: string;
  checked_in: boolean;
  service_ids: string[];
  payment_method: "cash" | "bank" | "card" | null;
  staff_id: string | null; // chăm sóc khách hàng
  technician_id: string | null;
  service_detail: ServiceDetail | null; // dịch vụ chi tiết, tính tour KTV
  service_session: number | null; // số lần (1–10), null với new/debt
  bill_amount: number | null; // Rupiah
  note: string;
}

export type AppointmentCustomer = {
  id: string;
  full_name: string;
  phone: string;
  source: string | null;
};

export type AppointmentPatch = Partial<Pick<Appointment,
  "scheduled_at" | "checked_in" | "service_ids" | "payment_method" | "staff_id" | "technician_id"
  | "service_detail" | "service_session" | "bill_amount" | "note"
>>;

