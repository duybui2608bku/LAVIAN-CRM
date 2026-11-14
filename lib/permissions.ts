// Phân quyền theo bộ phận — dùng chung server (proxy, action) + client (menu, ẩn nút).
// Key quyền: `<module>.<action>`. Admin luôn toàn quyền; trang /users chỉ admin (không nằm trong cây).

export const PERMISSION_MODULES = {
  customers: ["view", "edit", "delete"],
  appointments: ["view", "edit", "delete"],
  tour: ["view", "edit", "delete"],
  services: ["view", "edit", "delete"],
  reports: ["view"],
  marketing: ["view", "edit"],
} as const;

export type PermissionModule = keyof typeof PERMISSION_MODULES;
export type Permission = {
  [M in PermissionModule]: `${M}.${(typeof PERMISSION_MODULES)[M][number]}`;
}[PermissionModule];

export const MODULES = Object.keys(PERMISSION_MODULES) as PermissionModule[];
export const ALL_PERMISSIONS = MODULES.flatMap((m) =>
  PERMISSION_MODULES[m].map((a) => `${m}.${a}` as Permission),
);

/** Quyền thực tế: admin = tất cả; còn lại = quyền của bộ phận (lọc key lạ). */
export function effectivePermissions(
  role: string | null | undefined,
  departmentPermissions: readonly string[] | null | undefined,
): Permission[] {
  if (role === "admin") return ALL_PERMISSIONS;
  return ALL_PERMISSIONS.filter((p) => departmentPermissions?.includes(p));
}

/** Module của 1 đường dẫn (route trùng tên module), null nếu không thuộc module nào. */
export function moduleOfPath(path: string): PermissionModule | null {
  return MODULES.find((m) => path === `/${m}` || path.startsWith(`/${m}/`)) ?? null;
}

/** Trang đầu tiên user được xem (null = không có quyền nào). */
export function homePath(permissions: readonly Permission[]): string | null {
  const m = MODULES.find((m) => permissions.includes(`${m}.view` as Permission));
  return m ? `/${m}` : null;
}

/**
 * Chuẩn hoá sau khi tick: chọn Sửa/Xoá → tự thêm Xem (thiếu Xem thì không vào được trang);
 * bỏ Xem → bỏ luôn Sửa/Xoá của module đó. Trả về theo thứ tự ALL_PERMISSIONS.
 */
export function normalizePermissions(prev: readonly string[], next: readonly string[]): Permission[] {
  const set = new Set(next);
  for (const m of MODULES) {
    const keys = PERMISSION_MODULES[m].map((a) => `${m}.${a}`);
    if (prev.includes(`${m}.view`) && !set.has(`${m}.view`)) keys.forEach((k) => set.delete(k));
    else if (keys.some((k) => set.has(k))) set.add(`${m}.view`);
  }
  return ALL_PERMISSIONS.filter((p) => set.has(p));
}
