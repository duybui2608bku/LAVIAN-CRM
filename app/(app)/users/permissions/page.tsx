import { PermissionsEditor } from "@/components/users/permissions-editor";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Phân quyền theo bộ phận (menu con của Người dùng). Proxy đã chặn non-admin; requireAdmin là lớp thứ hai.
export default async function PermissionsPage() {
  await requireAdmin();
  const db = await createClient();
  const [access, profiles] = await Promise.all([
    db.from("department_permissions").select("department, permissions"),
    db.from("profiles").select("department").eq("status", "active").not("department", "is", null),
  ]);
  if (access.error) throw new Error(access.error.message);

  const members: Record<string, number> = {};
  for (const p of profiles.data ?? []) members[p.department] = (members[p.department] ?? 0) + 1;

  return (
    <PermissionsEditor
      initial={Object.fromEntries((access.data ?? []).map((r) => [r.department, r.permissions as string[]]))}
      members={members}
    />
  );
}
