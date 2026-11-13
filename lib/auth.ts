import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { effectivePermissions, type Permission } from "@/lib/permissions";
import type { Profile } from "@/types/user";

export type CurrentProfile = Profile & { permissions: Permission[] };

/**
 * Hồ sơ của người dùng đang đăng nhập (null nếu chưa đăng nhập).
 * - `getClaims()` xác thực JWT tại chỗ (khoá ký bất đối xứng) thay vì `getUser()`
 *   đi mạng tới Auth server mỗi lần — nhanh hơn 1 round-trip.
 * - `cache()`: layout + page + action trong cùng request dùng chung 1 lần đọc.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*, access:department_permissions(permissions)")
    .eq("id", userId)
    .single();
  if (!data) return null;

  // Quyền đi kèm cùng query (FK profiles.department → department_permissions).
  const { access, ...profile } = data as Profile & { access: { permissions: string[] } | null };
  return { ...profile, permissions: effectivePermissions(profile.role, access?.permissions) };
});

const forbidden = () =>
  new AppError("Bạn không có quyền thực hiện thao tác này.", { code: "FORBIDDEN", status: 403 });

/** Chặn thao tác nếu user (đang hoạt động) thiếu quyền `key`. Dùng đầu Server Action / page. */
export async function requirePermission(key: Permission): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (profile?.status !== "active" || !profile.permissions.includes(key)) throw forbidden();
  return profile;
}

/** Chặn thao tác nếu người gọi không phải admin. Dùng đầu mỗi Server Action admin. */
export async function requireAdmin(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw forbidden();
  return profile;
}
