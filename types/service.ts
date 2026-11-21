/**
 * Nhóm dịch vụ — bảng `public.service_groups` (id = mã chữ: alis, bibir, laser…).
 * `customers.service_categories` / `clinic_appointments.service_categories` lưu mảng id này.
 */
export interface ServiceGroup {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

/** Dịch vụ — bảng `public.services` (bảng giá). */
export interface Service {
  id: string;
  group_id: string;
  name: string;
  price: number; // Rupiah
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Dữ liệu tạo/sửa dịch vụ gửi lên Server Action. */
export type ServiceInput = Omit<Service, "id" | "created_at" | "updated_at">;
