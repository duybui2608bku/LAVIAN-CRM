import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import type { Profile } from "@/types/user";

/** Hồ sơ của người dùng đang đăng nhập (null nếu chưa đăng nhập). */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

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
