export interface Appointment {
  id: string;
  customer_id: string;
  scheduled_at: string;
  checked_in: boolean;
  service_ids: string[];
  payment_method: "cash" | "bank" | "card" | null;
  staff_id: string | null;
  note: string;
}

export type AppointmentCustomer = {
  id: string;
  full_name: string;
  phone: string;
  source: string | null;
};

export type AppointmentPatch = Partial<Pick<Appointment,
  "scheduled_at" | "checked_in" | "service_ids" | "payment_method" | "staff_id" | "note"
>>;

export type AppointmentSummary = Pick<Appointment, "id" | "customer_id" | "scheduled_at" | "checked_in">;
