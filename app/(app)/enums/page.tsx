import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EnumsManager } from "@/components/enums/enums-manager";
import type { EnumOption } from "@/types/customer";

// Proxy đã chặn non-admin; requireAdmin là lớp phòng vệ thứ hai.
export default async function EnumsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("enum_options")
    .select("*")
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });

  return <EnumsManager options={(data as EnumOption[]) ?? []} />;
}
