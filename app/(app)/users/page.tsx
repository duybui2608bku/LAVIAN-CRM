import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { UsersManager } from "@/components/users/users-manager";
import type { Profile } from "@/types/user";

// Proxy đã chặn non-admin vào /users; trang đọc toàn bộ profiles qua RLS admin.
export default async function UsersPage() {
  const me = await getCurrentProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <UsersManager
      profiles={(data as Profile[]) ?? []}
      currentUserId={me?.id ?? ""}
    />
  );
}
