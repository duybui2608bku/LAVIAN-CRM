import { createClient } from "@/lib/supabase/server";
import { CustomersManager } from "@/components/customers/customers-manager";
import type { Customer, EnumOption } from "@/types/customer";
import { CUSTOMER_OPTIONS } from "@/lib/customer-options";
import type { Service } from "@/types/service";

// Mọi user đăng nhập đều xem được (RLS customers cho authenticated). Proxy đã gác login.
export default async function CustomersPage() {
  const supabase = await createClient();
  const [customersRes, staffRes, optionsRes, servicesRes] = await Promise.all([
    supabase
      .from("customers")
      // Nested select qua FK bảng nối — 1 query, không N+1.
      .select("*, customer_services(service_id)")
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
    // Services cũng nạp cả inactive (hiện tên dịch vụ cũ còn gắn trên khách).
    supabase
      .from("services")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  type Row = Customer & { customer_services: { service_id: string }[] | null };
  const customers = (((customersRes.data as Row[]) ?? []).map(
    ({ customer_services, ...c }) => ({
      ...c,
      service_ids: (customer_services ?? []).map((r) => r.service_id),
    }),
  ) as Customer[]);

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
      services={(servicesRes.data as Service[]) ?? []}
    />
  );
}
