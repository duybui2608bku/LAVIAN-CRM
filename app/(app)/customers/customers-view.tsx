import { getCurrentProfile } from "@/lib/auth";
import { canConfirmShowUp } from "@/lib/appointments";
import { createClient } from "@/lib/supabase/server";
import { CustomersManager } from "@/components/customers/customers-manager";
import type { PipelineAppointment } from "@/components/customers/customer-pipeline";
import type { AppointmentStaff } from "@/components/appointments/appointments-manager";
import type { Customer } from "@/types/customer";
import type { Service } from "@/types/service";
import { CUSTOMER_OPTIONS, instagramUsername } from "@/lib/customer-options";

const CUSTOMER_LIST_FIELDS =
  "id, smax_customer_id, full_name, phone, social_name, picture, thread, source, stage, " +
  "staff_id, sales_id, technician_id, first_contact, notes, created_at, updated_at, deleted_at, deposit_amount, payment_confirm_url, region_code, address_detail, rating, " +
  "instagram_username:smax_data->customer->instagram->>username";

// Trang Khách hàng dùng chung cho /customers và các trang con lọc sẵn theo stage
// (vd /customers/bookings). Mọi user đăng nhập đều xem được (RLS customers cho authenticated).
export async function CustomersView({ stages, title }: { stages?: readonly string[]; title?: string } = {}) {
  const supabase = await createClient();
  let customersQuery = supabase
    .from("customers")
    // Không tải smax_data/tags (jsonb lớn, trang không dùng) — chỉ rút username IG bằng JSON path.
    .select(CUSTOMER_LIST_FIELDS)
    .is("deleted_at", null);
  if (stages) customersQuery = customersQuery.in("stage", stages);
  const [customersRes, staffRes, appointmentsRes, servicesRes, profile] = await Promise.all([
    customersQuery.order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, user_name, avatar_url, department, status")
      .order("user_name", { ascending: true }),
    // Lịch hẹn cho pipeline (chỉ 3 cột cần đếm).
    supabase
      .from("clinic_appointments")
      .select("customer_id, scheduled_at, checked_in")
      .is("deleted_at", null),
    // Dịch vụ cho drawer tạo lịch hẹn (nút ở cột Lịch hẹn).
    supabase.from("services").select("*").order("sort_order", { ascending: true }),
    getCurrentProfile(),
  ]);

  const customers = ((customersRes.data ?? []) as unknown as Customer[]).map((c) => ({
    ...c,
    instagram_username: instagramUsername(c.instagram_username),
  }));

  return (
    <CustomersManager
      customers={customers}
      staff={(staffRes.data as AppointmentStaff[]) ?? []}
      options={CUSTOMER_OPTIONS}
      appointments={(appointmentsRes.data as PipelineAppointment[]) ?? []}
      services={(servicesRes.data as Service[]) ?? []}
      canShowUp={canConfirmShowUp(profile)}
      stages={stages}
      title={title}
    />
  );
}
