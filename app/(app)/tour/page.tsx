import dayjs from "dayjs";
import { TourView } from "@/components/tour/tour-view";
import { ALL_TECHNICIANS, type TourRow } from "@/components/tour/tour-data";
import type { StaffRef } from "@/components/common/user-avatar";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Tiền tour của kỹ thuật viên: non-admin luôn xem của chính mình; admin chọn KTV qua ?technician=
// (mặc định "all" = cả đội). Tháng qua ?month=YYYY-MM.
export default async function TourPage({ searchParams }: {
  searchParams: Promise<{ technician?: string; month?: string }>;
}) {
  const [profile, params] = await Promise.all([getCurrentProfile(), searchParams]);
  if (!profile) throw new Error("Unauthorized");
  const isAdmin = profile.role === "admin";
  const db = await createClient();

  const parsed = params.month && /^\d{4}-\d{2}$/.test(params.month) ? dayjs(`${params.month}-01`) : null;
  const month = (parsed?.isValid() ? parsed : dayjs()).startOf("month");

  // Không lọc bộ phận: KTV đã đổi bộ phận vẫn có tên trên lịch cũ. Select chỉ liệt kê department = technician.
  const staff = isAdmin
    ? await db.from("profiles").select("id,user_name,avatar_url,department").order("user_name")
    : null;
  if (staff?.error) throw new Error(staff.error.message);
  const technicians = (staff?.data ?? []).filter((s) => s.department === "technician") as StaffRef[];

  const technicianId = isAdmin
    ? (technicians.some((s) => s.id === params.technician) ? params.technician! : ALL_TECHNICIANS)
    : profile.id;

  // Đệm ±1 ngày quanh tháng; client lọc chính xác theo múi giờ trình duyệt.
  let query = db.from("clinic_appointments")
    .select("id,technician_id,scheduled_at,service_detail,service_session,bill_amount,customer:customers(full_name)")
    .eq("checked_in", true).is("deleted_at", null)
    .gte("scheduled_at", month.subtract(1, "day").toISOString())
    .lt("scheduled_at", month.add(1, "month").add(1, "day").toISOString())
    .order("scheduled_at", { ascending: false });
  query = technicianId === ALL_TECHNICIANS ? query.not("technician_id", "is", null) : query.eq("technician_id", technicianId);
  const rows = await query;
  if (rows.error) throw new Error(rows.error.message);

  return <TourView
    rows={(rows.data ?? []) as unknown as TourRow[]}
    month={month.format("YYYY-MM")}
    technicianId={technicianId}
    technicians={isAdmin ? technicians : null}
    staff={(staff?.data ?? []) as StaffRef[]}
  />;
}
