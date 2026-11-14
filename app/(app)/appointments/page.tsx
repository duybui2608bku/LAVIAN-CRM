import { AppointmentsManager, type AppointmentStaff } from "@/components/appointments/appointments-manager";
import { createClient } from "@/lib/supabase/server";
import { waNumber } from "@/lib/wa";
import type { Appointment, AppointmentCustomer } from "@/types/appointment";
import type { Service } from "@/types/service";

export default async function AppointmentsPage({ searchParams }: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const db = await createClient();
  const [appointments, customers, staff, services, params] = await Promise.all([
    db.from("clinic_appointments").select("id,customer_id,scheduled_at,booking_confirm,checked_in,service_ids,staff_id,note")
      .is("deleted_at", null).order("scheduled_at"),
    db.from("customers").select("id,full_name,phone,source,staff_id,wa_link:thread->>link").is("deleted_at", null).order("full_name"),
    db.from("profiles").select("id,user_name,avatar_url,status,department").order("user_name"),
    db.from("services").select("*").order("sort_order"),
    searchParams,
  ]);
  for (const result of [appointments, customers, staff, services]) {
    if (result.error) throw new Error(result.error.message);
  }
  return <AppointmentsManager
    appointments={(appointments.data ?? []) as Appointment[]}
    // Chỉ lấy link hội thoại (không kéo nội dung tin nhắn), gửi xuống client dạng "WA-xxxx".
    customers={(customers.data ?? []).map(({ wa_link, ...c }) => ({
      ...c, wa: waNumber(wa_link as string | null),
    })) as AppointmentCustomer[]}
    staff={(staff.data ?? []) as AppointmentStaff[]}
    services={(services.data ?? []) as Service[]}
    initialCustomer={params.customer ?? ""}
  />;
}
