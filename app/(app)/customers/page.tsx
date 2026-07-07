import { createClient } from "@/lib/supabase/server";
import { CustomersManager } from "@/components/customers/customers-manager";
import type { Customer, EnumOption } from "@/types/customer";

// Mọi user đăng nhập đều xem được (RLS customers cho authenticated). Proxy đã gác login.
export default async function CustomersPage() {
  const supabase = await createClient();
  const [customersRes, staffRes, optionsRes] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, user_name")
      .order("user_name", { ascending: true }),
    // Nạp tất cả option (kể cả inactive) để hiện nhãn đúng cho dữ liệu cũ;
    // dropdown sẽ tự lọc is_active phía client.
    supabase
      .from("enum_options")
      .select("*")
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <CustomersManager
      customers={(customersRes.data as Customer[]) ?? []}
      staff={(staffRes.data as { id: string; user_name: string }[]) ?? []}
      options={(optionsRes.data as EnumOption[]) ?? []}
    />
  );
}
