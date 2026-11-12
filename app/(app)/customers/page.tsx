import { createClient } from "@/lib/supabase/server";
import { CustomersManager } from "@/components/customers/customers-manager";
import type { PipelineAppointment } from "@/components/customers/customer-pipeline";
import type { Customer, EnumOption } from "@/types/customer";
import { CUSTOMER_OPTIONS, instagramUsername } from "@/lib/customer-options";

const CUSTOMER_LIST_FIELDS =
  "id, smax_customer_id, full_name, phone, social_name, picture, thread, source, stage, lost_reason, " +
  "staff_id, sales_id, technician_id, first_contact, notes, created_at, updated_at, deleted_at, deposit_amount, " +
  "instagram_username:smax_data->customer->instagram->>username";

// Mọi user đăng nhập đều xem được (RLS customers cho authenticated). Proxy đã gác login.
export default async function CustomersPage() {
  const supabase = await createClient();
  const [customersRes, staffRes, optionsRes, appointmentsRes] = await Promise.all([
    supabase
      .from("customers")
      // Không tải smax_data/tags (jsonb lớn, trang không dùng) — chỉ rút username IG bằng JSON path.
      .select(CUSTOMER_LIST_FIELDS)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, user_name, avatar_url, department")
      .order("user_name", { ascending: true }),
    // Nạp tất cả option (kể cả inactive) để hiện nhãn đúng cho dữ liệu cũ;
    // dropdown sẽ tự lọc is_active phía client.
    supabase
      .from("enum_options")
      .select("*")
      .eq("kind", "lost_reason")
      .order("sort_order", { ascending: true }),
    // Lịch hẹn cho pipeline (chỉ 3 cột cần đếm).
    supabase
      .from("clinic_appointments")
      .select("customer_id, scheduled_at, checked_in")
      .is("deleted_at", null),
  ]);

  const customers = ((customersRes.data ?? []) as unknown as Customer[]).map((c) => ({
    ...c,
    instagram_username: instagramUsername(c.instagram_username),
  }));

  return (
    <CustomersManager
      customers={customers}
      staff={
        (staffRes.data as {
          id: string;
          user_name: string;
          avatar_url: string | null;
          department: string | null;
        }[]) ?? []
      }
      options={[...CUSTOMER_OPTIONS, ...((optionsRes.data as EnumOption[]) ?? [])]}
      appointments={(appointmentsRes.data as PipelineAppointment[]) ?? []}
    />
  );
}
