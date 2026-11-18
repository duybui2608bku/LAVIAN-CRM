import { AppointmentsManager, type AppointmentStaff } from "@/components/appointments/appointments-manager";
import { getCurrentProfile } from "@/lib/auth";
import { canConfirmShowUp } from "@/lib/appointments";
import { instagramUsername } from "@/lib/customer-options";
import { createClient } from "@/lib/supabase/server";
import type { Appointment, AppointmentCustomer } from "@/types/appointment";
import type { Service } from "@/types/service";

export default async function AppointmentsPage({ searchParams }: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const db = await createClient();
  const [appointments, customers, staff, services, params, profile] = await Promise.all([
    db.from("clinic_appointments").select("id,customer_id,scheduled_at,booking_confirm,checked_in,service_categories,service_ids,staff_id,sales_id,created_by,note")
      .is("deleted_at", null).order("scheduled_at"),
    db.from("customers").select("id,full_name,phone,source,staff_id,thread_link:thread->>link,instagram_username:smax_data->customer->instagram->>username")
      .is("deleted_at", null).order("full_name"),
    db.from("profiles").select("id,user_name,avatar_url,status,department").order("user_name"),
    db.from("services").select("*").order("sort_order"),
    searchParams,
    getCurrentProfile(),
  ]);
  for (const result of [appointments, customers, staff, services]) {
    if (result.error) throw new Error(result.error.message);
  }
  return <AppointmentsManager
    appointments={(appointments.data ?? []) as Appointment[]}
    // Chỉ lấy link hội thoại + username IG (không kéo nội dung) — cột Tin nhắn tải tin khi mở modal.
    customers={((customers.data ?? []) as AppointmentCustomer[]).map((c) => ({
      ...c,
      instagram_username: instagramUsername(c.instagram_username),
    }))}
    staff={(staff.data ?? []) as AppointmentStaff[]}
    services={(services.data ?? []) as Service[]}
    initialCustomer={params.customer ?? ""}
    canShowUp={canConfirmShowUp(profile)}
  />;
}
