import type { AppointmentStaff } from "@/components/appointments/appointments-manager";
import type { PipelineAppointment } from "@/components/customers/customer-pipeline";
import { PotentialManager } from "@/components/customers/potential-manager";
import { CUSTOMER_OPTIONS, FOLLOW_UP_STAGES, instagramUsername } from "@/lib/customer-options";
import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/types/customer";

import { CUSTOMER_LIST_FIELDS } from "../customers-view";

// Khách tiềm năng: khách stage Tiềm năng + Cân nhắc + số khách chuyển đổi sang Booking hôm nay (giờ VN).
export default async function PotentialCustomersPage() {
  const supabase = await createClient();
  const todayVN = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  const startOfToday = new Date(`${todayVN}T00:00:00+07:00`).toISOString();

  const [customersRes, staffRes, convertedRes, appointmentsRes] = await Promise.all([
    supabase
      .from("customers")
      .select(`${CUSTOMER_LIST_FIELDS}, potential_status`)
      .in("stage", FOLLOW_UP_STAGES)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, user_name, avatar_url, department, status")
      .order("user_name", { ascending: true }),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .gte("converted_at", startOfToday)
      .is("deleted_at", null),
    // Cột Sales Status: Status lịch gần nhất của khách.
    supabase.from("clinic_appointments").select("customer_id, created_at, scheduled_at, checked_in, visit_status, service_categories").is("deleted_at", null),
  ]);

  const customers = ((customersRes.data ?? []) as unknown as Customer[]).map((c) => ({
    ...c,
    instagram_username: instagramUsername(c.instagram_username),
  }));

  return (
    <PotentialManager
      customers={customers}
      staff={(staffRes.data as AppointmentStaff[]) ?? []}
      options={CUSTOMER_OPTIONS}
      convertedToday={convertedRes.count ?? 0}
      appointments={(appointmentsRes.data ?? []) as PipelineAppointment[]}
    />
  );
}
