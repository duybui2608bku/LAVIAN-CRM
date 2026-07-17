export const ENUM_KINDS = ["stage", "source", "lost_reason"] as const;
export type EnumKind = (typeof ENUM_KINDS)[number];

/** Một giá trị danh mục (admin CRUD) — ánh xạ bảng `public.enum_options`. */
export interface EnumOption {
  id: string;
  kind: EnumKind;
  value: string;
  label_vi: string;
  label_en: string | null; // không bắt buộc — UI fallback label_vi
  label_id: string | null;
  icon: string | null; // tên icon Lucide (kebab-case)
  color: string | null; // hex #rrggbb
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Một lần ghi chú của khách hàng (lưu trong cột jsonb `customers.notes`). */
export interface CustomerNote {
  text: string;
  at: string; // ISO timestamp
  by?: string | null; // tên người ghi (server stamp) — note cũ không có
}

/** Tag SMAX gắn cho khách — lưu nguyên mảng từ event `__SM_FORM_CUSTOMER`. */
export interface SmaxTag {
  id?: string;
  name: string;
  alias?: string;
  time?: string; // ISO timestamp
}

/** Hội thoại SMAX tạo ra lead — lưu từ `data.thread` của event. */
export interface SmaxThread {
  id?: string;
  tid?: string;
  message?: string;
  link?: string;
}

/** Dữ liệu tạo/sửa khách hàng gửi lên Server Action. */
export interface CustomerInput {
  full_name: string;
  phone: string;
  social_name?: string | null;
  source?: string | null;
  stage: string;
  lost_reason?: string | null;
  staff_id?: string | null;
  first_contact?: string | null; // "YYYY-MM-DD"
  service_ids?: string[]; // đồng bộ bảng nối customer_services; không gửi = giữ nguyên
}

/** Khách hàng — ánh xạ bảng `public.customers`. */
export interface Customer {
  id: string;
  smax_customer_id: string | null;
  full_name: string;
  phone: string;
  social_name: string | null; // tên hiển thị MXH (SMAX name_original)
  picture: string | null; // URL avatar khách (SMAX customer.picture)
  tags: SmaxTag[];
  thread: SmaxThread | null;
  source: string | null;
  stage: string;
  lost_reason: string | null;
  staff_id: string | null;
  first_contact: string | null;
  notes: CustomerNote[];
  deposit_amount: number | null;
  deposit_currency: string | null;
  service_ids: string[]; // map từ bảng nối customer_services (page query nested)
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
