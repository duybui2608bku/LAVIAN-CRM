import { AppointmentsManager } from "@/components/appointments/appointments-manager";
import { createClient } from "@/lib/supabase/server";
import type { Appointment, AppointmentCustomer } from "@/types/appointment";
import type { StaffRef } from "@/components/common/user-avatar";
import type { Service } from "@/types/service";

export default async function AppointmentsPage({ searchParams }: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const db = await createClient();
  const [appointments, customers, staff, services, params] = await Promise.all([
    db.from("clinic_appointments").select("id,customer_id,scheduled_at,checked_in,service_ids,payment_method,staff_id,note")
      .is("deleted_at", null).order("scheduled_at"),
    db.from("customers").select("id,full_name,phone,source").is("deleted_at", null).order("full_name"),
    db.from("profiles").select("id,user_name,avatar_url,status").order("user_name"),
    db.from("services").select("*").order("sort_order"),
    searchParams,
  ]);
  for (const result of [appointments, customers, staff, services]) {
    if (result.error) throw new Error(result.error.message);
  }
  return <AppointmentsManager
    appointments={(appointments.data ?? []) as Appointment[]}
    customers={(customers.data ?? []) as AppointmentCustomer[]}
    staff={(staff.data ?? []) as (StaffRef & { status: string })[]}
    services={(services.data ?? []) as Service[]}
    initialCustomer={params.customer ?? ""}
  />;
}
