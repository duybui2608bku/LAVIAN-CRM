import { TourView, type TourRow } from "@/components/tour/tour-view";
import type { StaffRef } from "@/components/common/user-avatar";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Tiền tour của kỹ thuật viên: non-admin luôn xem của chính mình; admin chọn KTV qua ?technician=.
export default async function TourPage({ searchParams }: {
  searchParams: Promise<{ technician?: string }>;
}) {
  const [profile, params] = await Promise.all([getCurrentProfile(), searchParams]);
  if (!profile) throw new Error("Unauthorized");
  const isAdmin = profile.role === "admin";
  const technicianId = (isAdmin && params.technician) || profile.id;

  const db = await createClient();
  const [rows, technicians] = await Promise.all([
    db.from("clinic_appointments")
      .select("id,scheduled_at,service_detail,service_session,bill_amount,customer:customers(full_name)")
      .eq("technician_id", technicianId).eq("checked_in", true).is("deleted_at", null)
      .order("scheduled_at", { ascending: false }),
    isAdmin
      ? db.from("profiles").select("id,user_name,avatar_url").eq("department", "technician").order("user_name")
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [rows, technicians]) {
    if (result.error) throw new Error(result.error.message);
  }

  return <TourView
    rows={(rows.data ?? []) as unknown as TourRow[]}
    technicianId={technicianId}
    technicians={isAdmin ? (technicians.data ?? []) as StaffRef[] : null}
  />;
}
