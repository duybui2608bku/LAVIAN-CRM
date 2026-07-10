import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ServicesManager } from "@/components/services/services-manager";
import type { Service } from "@/types/service";

// Proxy đã chặn non-admin; requireAdmin là lớp phòng vệ thứ hai.
export default async function ServicesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true });

  return <ServicesManager services={(data as Service[]) ?? []} />;
}
