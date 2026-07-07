export type UserRole = "admin" | "user";
export type UserStatus = "active" | "banned";

/** Hồ sơ người dùng — ánh xạ bảng `public.profiles` (mật khẩu sống ở auth.users). */
export interface Profile {
  id: string;
  email: string;
  user_name: string;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}
