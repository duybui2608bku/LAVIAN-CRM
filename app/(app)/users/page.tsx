import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { UsersManager } from "@/components/users/users-manager";
import type { Profile } from "@/types/user";

// Proxy đã chặn non-admin vào /users; trang đọc toàn bộ profiles qua RLS admin.
export default async function UsersPage() {
  const me = await getCurrentProfile();
  const supabase = await createClient();
  const [{ data }, { data: access }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("department_permissions").select("department, permissions"),
  ]);

  return (
    <UsersManager
      profiles={(data as Profile[]) ?? []}
      currentUserId={me?.id ?? ""}
      departmentPermissions={Object.fromEntries((access ?? []).map((r) => [r.department, r.permissions as string[]]))}
    />
  );
}
