import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EnumsManager } from "@/components/enums/enums-manager";
import { ENUM_KINDS, type EnumKind, type EnumOption } from "@/types/customer";

// Proxy đã chặn non-admin; requireAdmin là lớp phòng vệ thứ hai.
export default async function EnumKindPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!ENUM_KINDS.includes(kind as EnumKind) || kind !== "lost_reason") notFound();

  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("enum_options")
    .select("*")
    .eq("kind", kind)
    .order("sort_order", { ascending: true });

  return (
    <EnumsManager
      kind={kind as EnumKind}
      options={(data as EnumOption[]) ?? []}
    />
  );
}
