/**
 * Nhóm dịch vụ (cột `services.category`, `clinic_appointments.service_categories`, check constraint ở DB).
 * Telesales chọn nhóm khi tạo lịch; dịch vụ chi tiết (bảng `services`) điền sau.
 */
export const SERVICE_CATEGORIES = ["alis", "bibir", "laser"] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
// Tên riêng — giống nhau mọi ngôn ngữ nên không đưa vào i18n.
export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  alis: "Sulam Alis",
  bibir: "Sulam Bibir",
  laser: "Laser",
};
export const SERVICE_CATEGORY_COLORS: Record<ServiceCategory, string> = {
  alis: "purple",
  bibir: "magenta",
  laser: "cyan",
};
export const SERVICE_CATEGORY_OPTIONS = SERVICE_CATEGORIES.map((c) => ({ value: c, label: SERVICE_CATEGORY_LABELS[c] }));
/** "Sulam Alis, Laser" — ô Khách hàng (dòng phụ sau SĐT); không có nhóm → "". */
export const serviceCategoriesLabel = (cats?: readonly string[] | null) =>
  (cats ?? []).map((c) => SERVICE_CATEGORY_LABELS[c as ServiceCategory] ?? c).join(", ");

/** Dịch vụ chi tiết — ánh xạ bảng `public.services`. */
export interface Service {
  id: string;
  name_vi: string;
  name_en: string | null; // không bắt buộc — UI fallback name_vi
  name_id: string | null;
  category: ServiceCategory;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Dữ liệu tạo/sửa dịch vụ gửi lên Server Action. */
export type ServiceInput = Omit<Service, "id" | "created_at" | "updated_at">;
