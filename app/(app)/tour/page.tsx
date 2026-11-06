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
  const db = await createClient();

  // Admin không phải KTV: mặc định chọn KTV đầu tiên (không lấy id admin — select sẽ hiện UUID).
  const technicians = isAdmin
    ? await db.from("profiles").select("id,user_name,avatar_url").eq("department", "technician").order("user_name")
    : null;
  if (technicians?.error) throw new Error(technicians.error.message);
  const technicianId = isAdmin
    ? (technicians?.data?.some((s) => s.id === params.technician) ? params.technician! : technicians?.data?.[0]?.id ?? "")
    : profile.id;

  const rows = technicianId
    ? await db.from("clinic_appointments")
      .select("id,scheduled_at,service_detail,service_session,bill_amount,customer:customers(full_name)")
      .eq("technician_id", technicianId).eq("checked_in", true).is("deleted_at", null)
      .order("scheduled_at", { ascending: false })
    : { data: [], error: null };
  if (rows.error) throw new Error(rows.error.message);

  return <TourView
    rows={(rows.data ?? []) as unknown as TourRow[]}
    technicianId={technicianId}
    technicians={isAdmin ? (technicians?.data ?? []) as StaffRef[] : null}
  />;
}
