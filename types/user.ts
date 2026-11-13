export type UserRole = "admin" | "user";
export type UserStatus = "active" | "banned";
export const DEPARTMENTS = ["customer_care", "customer_care_leader", "technician", "sales"] as const;
export type UserDepartment = (typeof DEPARTMENTS)[number];
/** Bộ phận được chọn làm nhân viên CSKH phụ trách (leader cũng là CSKH). */
export const CARE_DEPARTMENTS: readonly string[] = ["customer_care", "customer_care_leader"];

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
