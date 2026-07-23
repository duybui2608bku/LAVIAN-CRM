export type UserRole = "admin" | "user";
export type UserStatus = "active" | "banned";
export type UserDepartment = "customer_care" | "technician" | "sales";

/** Hồ sơ người dùng — ánh xạ bảng `public.profiles` (mật khẩu sống ở auth.users). */
export interface Profile {
  id: string;
  email: string;
  user_name: string;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  department: UserDepartment | null; // null = chưa gán bộ phận
  created_at: string;
}
