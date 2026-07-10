import { createClient } from "@/lib/supabase/server";
import { AppointmentsManager } from "@/components/appointments/appointments-manager";
import type { CustomerRef } from "@/components/appointments/appointment-dialog";
import type { StaffRef } from "@/components/common/user-avatar";
import type { Appointment } from "@/types/appointment";
import type { EnumOption } from "@/types/customer";
import type { Service } from "@/types/service";

// Mọi user đăng nhập đều dùng được (RLS authenticated). Proxy đã gác login.
// ponytail: nạp toàn bộ lịch chưa xóa + lọc client-side (đồng nhất /customers);
//           giới hạn theo khoảng ngày phía server khi dữ liệu lớn.
export default async function AppointmentsPage() {
  const supabase = await createClient();
  const [apptsRes, customersRes, staffRes, optionsRes, servicesRes] =
    await Promise.all([
      supabase
        .from("appointments")
        // Nested select 1 query: dịch vụ (bảng nối) + tên/phone khách.
        .select(
          "*, appointment_services(service_id), customer:customers(full_name, phone)",
        )
        .is("deleted_at", null)
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("customers")
        // source/staff_id/dịch vụ để prefill form khi tạo lịch mới.
        .select(
          "id, full_name, phone, source, staff_id, customer_services(service_id)",
        )
        .is("deleted_at", null)
        .order("full_name", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, user_name, avatar_url")
        .order("user_name", { ascending: true }),
      supabase
        .from("enum_options")
        .select("*")
        .order("kind", { ascending: true })
        .order("sort_order", { ascending: true }),
      // Cả inactive để hiện tên dịch vụ cũ còn gắn trên lịch.
      supabase.from("services").select("*").order("sort_order", { ascending: true }),
    ]);

  type Row = Appointment & {
    appointment_services: { service_id: string }[] | null;
  };
  const appointments = (((apptsRes.data as Row[]) ?? []).map(
    ({ appointment_services, ...a }) => ({
      ...a,
      service_ids: (appointment_services ?? []).map((r) => r.service_id),
    }),
  ) as Appointment[]);

  type CustomerRow = CustomerRef & {
    customer_services: { service_id: string }[] | null;
  };
  const customers = (((customersRes.data as unknown as CustomerRow[]) ?? []).map(
    ({ customer_services, ...c }) => ({
      ...c,
      service_ids: (customer_services ?? []).map((r) => r.service_id),
    }),
  ) as CustomerRef[]);

  return (
    <AppointmentsManager
      appointments={appointments}
      customers={customers}
      staff={(staffRes.data as StaffRef[]) ?? []}
      options={(optionsRes.data as EnumOption[]) ?? []}
      services={(servicesRes.data as Service[]) ?? []}
    />
  );
}
