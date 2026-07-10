/** Dịch vụ — ánh xạ bảng `public.services`. */
export interface Service {
  id: string;
  name_vi: string;
  name_en: string | null; // không bắt buộc — UI fallback name_vi
  name_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Dữ liệu tạo/sửa dịch vụ gửi lên Server Action. */
export type ServiceInput = Omit<Service, "id" | "created_at" | "updated_at">;
