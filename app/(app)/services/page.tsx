import { createClient } from "@/lib/supabase/server";
import { ServicesManager } from "@/components/services/services-manager";
import type { Service } from "@/types/service";

// Mọi user đăng nhập đều xem + sửa (RLS services_write cho authenticated).
export default async function ServicesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true });

  return <ServicesManager services={(data as Service[]) ?? []} />;
}
