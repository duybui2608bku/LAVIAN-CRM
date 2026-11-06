import dayjs from "dayjs";
import { TourView } from "@/components/tour/tour-view";
import type { StaffRef } from "@/components/common/user-avatar";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TOUR_FIELDS, type Tour } from "@/types/tour";
import type { AppointmentCustomer } from "@/types/appointment";
import type { Service } from "@/types/service";

// Menu Tour. KTV (không phải admin): tour chờ nhận + tour của mình theo tháng.
// CSKH / admin: tạo tour, bảng tour theo tháng; admin xác nhận + xuất. Tháng qua ?month=YYYY-MM.
export default async function TourPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const [profile, params] = await Promise.all([getCurrentProfile(), searchParams]);
  if (!profile) throw new Error("Unauthorized");
  const isAdmin = profile.role === "admin";
  const isTechnician = !isAdmin && profile.department === "technician";
  const db = await createClient();

  const parsed = params.month && /^\d{4}-\d{2}$/.test(params.month) ? dayjs(`${params.month}-01`) : null;
  const month = (parsed?.isValid() ? parsed : dayjs()).startOf("month");

  let monthQuery = db.from("tours").select(TOUR_FIELDS).is("deleted_at", null)
    .gte("tour_date", month.format("YYYY-MM-DD")).lt("tour_date", month.add(1, "month").format("YYYY-MM-DD"))
    .order("tour_date", { ascending: false }).order("created_at", { ascending: false });
  if (isTechnician) monthQuery = monthQuery.eq("technician_id", profile.id);

  const [tours, pending, services, staff, customers] = await Promise.all([
    monthQuery,
    // Tour chờ nhận mọi ngày — chỉ KTV cần (người khác thấy trong bảng tháng).
    isTechnician
      ? db.from("tours").select(TOUR_FIELDS).is("deleted_at", null).is("technician_id", null)
        .order("tour_date").order("created_at").limit(200)
      : null,
    db.from("services").select("*").order("sort_order"),
    // Không lọc bộ phận: người đã đổi bộ phận vẫn hiện tên trên tour cũ.
    db.from("profiles").select("id,user_name,avatar_url,status,department").order("user_name"),
    isTechnician ? null : db.from("customers").select("id,full_name,phone,source").is("deleted_at", null).order("full_name"),
  ]);
  for (const result of [tours, pending, services, staff, customers]) {
    if (result?.error) throw new Error(result.error.message);
  }

  return <TourView
    me={{ id: profile.id, isAdmin, isTechnician }}
    month={month.format("YYYY-MM")}
    tours={(tours.data ?? []) as unknown as Tour[]}
    pending={(pending?.data ?? []) as unknown as Tour[]}
    services={(services.data ?? []) as Service[]}
    staff={(staff.data ?? []) as StaffRef[]}
    customers={(customers?.data ?? []) as AppointmentCustomer[]}
  />;
}
