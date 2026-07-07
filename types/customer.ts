export type EnumKind = "stage" | "source" | "lost_reason";

/** Một giá trị danh mục (admin CRUD) — ánh xạ bảng `public.enum_options`. */
export interface EnumOption {
  id: string;
  kind: EnumKind;
  value: string;
  label_vi: string;
  label_en: string;
  label_id: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Một lần ghi chú của khách hàng (lưu trong cột jsonb `customers.notes`). */
export interface CustomerNote {
  text: string;
  at: string; // ISO timestamp
}

/** Dữ liệu tạo/sửa khách hàng gửi lên Server Action. */
export interface CustomerInput {
  full_name: string;
  phone: string;
  social_link?: string | null;
  source?: string | null;
  stage: string;
  lost_reason?: string | null;
  staff_id?: string | null;
  first_contact?: string | null; // "YYYY-MM-DD"
  notes: CustomerNote[];
}

/** Khách hàng — ánh xạ bảng `public.customers`. */
export interface Customer {
  id: string;
  full_name: string;
  phone: string;
  social_link: string | null;
  source: string | null;
  stage: string;
  lost_reason: string | null;
  staff_id: string | null;
  first_contact: string | null;
  notes: CustomerNote[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
