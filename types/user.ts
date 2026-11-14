export type UserRole = "admin" | "user";
export type UserStatus = "active" | "banned";
export const DEPARTMENTS = ["telesales", "telesales_leader", "technician", "sales"] as const;
export type UserDepartment = (typeof DEPARTMENTS)[number];
/** Bộ phận được chọn làm nhân viên Telesales phụ trách khách/lịch (leader cũng là Telesales). */
export const TELESALES_DEPARTMENTS: readonly string[] = ["telesales", "telesales_leader"];

/** Hồ sơ người dùng — ánh xạ bảng `public.profiles` (mật khẩu sống ở auth.users). */
export interface Profile {
  id: string;
  email: string;
  user_name: string;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  department: UserDepartment | null; // null = chưa gán bộ phận
  smax_user_id: string | null; // user_id nhân viên trên SMAX (báo cáo Telesales)
  created_at: string;
}
