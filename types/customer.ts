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
  stage: string;
  lost_reason?: string | null;
  staff_id?: string | null;
  sales_id?: string | null;
  technician_id?: string | null;
  first_contact?: string | null; // "YYYY-MM-DD"
  payment_confirm_url?: string | null; // ảnh xác nhận thanh toán
}

/** Khách hàng — ánh xạ bảng `public.customers`. */
export interface Customer {
  id: string;
  smax_customer_id: string | null;
  full_name: string;
  phone: string;
  social_name: string | null; // tên hiển thị MXH (SMAX name_original)
  picture: string | null; // URL avatar khách (SMAX customer.picture)
  /** Chỉ có ở DB / lead-form — /customers không nạp. */
  tags?: SmaxTag[];
  thread: SmaxThread | null;
  /** Nguyên `data` event SMAX lúc gửi form — chỉ có ở DB, /customers không nạp. */
  smax_data?: Record<string, unknown> | null;
  /** Rút từ smax_data.customer.instagram.username lúc nạp /customers (không phải cột DB). */
  instagram_username?: string | null;
  source: string | null;
  stage: string;
  lost_reason: string | null;
  staff_id: string | null;
  sales_id: string | null; // nhân viên Sales phụ trách (profiles)
  technician_id: string | null; // kỹ thuật viên làm dịch vụ (profiles)
  first_contact: string | null;
  payment_confirm_url: string | null; // ảnh xác nhận thanh toán
  notes: CustomerNote[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
