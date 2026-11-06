import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import type { Profile } from "@/types/user";

/**
 * Hồ sơ của người dùng đang đăng nhập (null nếu chưa đăng nhập).
 * - `getClaims()` xác thực JWT tại chỗ (khoá ký bất đối xứng) thay vì `getUser()`
 *   đi mạng tới Auth server mỗi lần — nhanh hơn 1 round-trip.
 * - `cache()`: layout + page + action trong cùng request dùng chung 1 lần đọc.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return (data as Profile) ?? null;
});

/** Chặn thao tác nếu người gọi không phải admin. Dùng đầu mỗi Server Action admin. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    throw new AppError("Bạn không có quyền thực hiện thao tác này.", {
      code: "FORBIDDEN",
      status: 403,
    });
  }
  return profile;
}
