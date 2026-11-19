import type { AppointmentStaff } from "@/components/appointments/appointments-manager";
import { BookingsManager, type BookingCustomer } from "@/components/appointments/bookings-manager";
import { instagramUsername } from "@/lib/customer-options";
import { createClient } from "@/lib/supabase/server";
import type { Appointment } from "@/types/appointment";
import type { Service } from "@/types/service";

// Booking management: lấy theo lịch hẹn (clinic_appointments), không lọc theo stage khách nữa.
export default async function BookingsPage() {
  const db = await createClient();
  const [appointments, customers, staff, services] = await Promise.all([
    db.from("clinic_appointments")
      .select("id,customer_id,scheduled_at,booking_confirm,checked_in,service_categories,service_ids,staff_id,sales_id,created_by,note")
      .is("deleted_at", null),
    // Toàn bộ khách: cho cột của bảng + chọn khách ở form Tạo lịch hẹn. Chỉ rút link / username, không kéo jsonb lớn.
    db.from("customers")
      .select("id,full_name,phone,source,staff_id,deposit_amount,payment_confirm_url,thread_link:thread->>link,other_channel,instagram_username:smax_data->customer->instagram->>username")
      .is("deleted_at", null)
      .order("full_name"),
    db.from("profiles").select("id,user_name,avatar_url,status,department").order("user_name"),
    db.from("services").select("*").order("sort_order"),
  ]);
  for (const result of [appointments, customers, staff, services]) {
    if (result.error) throw new Error(result.error.message);
  }
  return (
    <BookingsManager
      appointments={(appointments.data ?? []) as Appointment[]}
      customers={((customers.data ?? []) as BookingCustomer[]).map((c) => ({
        ...c,
        instagram_username: instagramUsername(c.instagram_username),
      }))}
      staff={(staff.data ?? []) as AppointmentStaff[]}
      services={(services.data ?? []) as Service[]}
    />
  );
}
