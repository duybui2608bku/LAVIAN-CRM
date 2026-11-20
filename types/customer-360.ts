import type { Appointment, AppointmentLog } from "./appointment";
import type { CustomerNote } from "./customer";
import type { Reminder } from "./reminder";
import type { Service } from "./service";
import type { ChatMessage } from "@/lib/smax-messages";

// Hồ sơ khách 360° (popup Customer Detail). Danh mục khớp check constraint ở migration 20261120120000.

/** 6 mục chân dung khách. */
export const PORTRAIT_FIELDS = ["wish", "pain", "preference", "behavior", "communication", "personality"] as const;
export type PortraitField = (typeof PORTRAIT_FIELDS)[number];
/** Nguồn: Khách nói / NV nhận định. */
export const PORTRAIT_SOURCES = ["customer", "staff"] as const;
export type PortraitSource = (typeof PORTRAIT_SOURCES)[number];

/** Tin SMAX gốc gắn kèm chân dung — chụp lại nội dung để không mất khi SMAX đổi. */
export type MessageRef = { id: string; at: string; text: string };

/** 1 lần nhập chân dung (bảng chỉ thêm): bản hiện tại = dòng mới nhất của mỗi mục. */
export interface PortraitEntry {
  id: string;
  field: PortraitField;
  text: string;
  source: PortraitSource;
  message_ref: MessageRef | null;
  created_by: string | null;
  created_at: string;
}

/** Nhu cầu / Upsell: Nhu cầu → Tư vấn → Upsell → Thành công / Thất bại. */
export const NEED_STATUSES = ["need", "consulting", "upsell", "won", "lost"] as const;
export type NeedStatus = (typeof NEED_STATUSES)[number];
export const NEED_STATUS_COLORS: Record<NeedStatus, string> = {
  need: "default", consulting: "blue", upsell: "purple", won: "green", lost: "red",
};
/** Nguồn nhu cầu: [Khách đã hỏi] / [Sales khai thác]. */
export const NEED_ORIGINS = ["customer_asked", "staff_found"] as const;
export type NeedOrigin = (typeof NEED_ORIGINS)[number];

export interface CustomerNeed {
  id: string;
  title: string;
  service_id: string | null;
  origin: NeedOrigin;
  status: NeedStatus;
  history: { status: NeedStatus; by_id: string | null; at: string }[];
  created_by: string | null;
  created_at: string;
}

/** Vai trò người thực hiện thêm: Mapping / Phun-xăm / Hỗ trợ (bộ phận technician) hoặc Sales. */
export const PERFORMER_ROLES = ["mapping", "tattoo", "assist", "sales"] as const;
export type PerformerRole = (typeof PERFORMER_ROLES)[number];
export type AppointmentPerformer = { profile_id: string; role: PerformerRole };

/** Ảnh Trước/Sau (bucket riêng tư `ba-photos`) — `url` là signed URL 1 giờ. */
export interface AppointmentPhoto {
  id: string;
  appointment_id: string;
  kind: "before" | "after";
  url: string;
  created_by: string | null;
  created_at: string;
}

/** Lịch hẹn trong hồ sơ: kèm người thực hiện thêm. Tiền chỉ có khi được xem tài chính. */
export type Customer360Appointment = Omit<Appointment, "bill_amount" | "paid_amount" | "created_by"> & {
  bill_amount?: number | null;
  paid_amount?: number | null;
  performers: AppointmentPerformer[];
};

export interface Customer360 {
  customer: {
    id: string;
    full_name: string;
    phone: string;
    picture: string | null;
    source: string | null;
    stage: string;
    staff_id: string | null;
    sales_id: string | null;
    technician_id: string | null;
    first_contact: string | null;
    created_at: string;
    thread_link: string | null;
    notes: CustomerNote[];
    smax_messages_at: string | null; // thời điểm chụp smax_messages
    /** Chỉ có khi được xem tài chính. */
    deposit_amount?: number | null;
  };
  appointments: Customer360Appointment[]; // mới nhất trước
  logs: AppointmentLog[];
  portrait: PortraitEntry[]; // mới nhất trước
  needs: CustomerNeed[]; // mới nhất trước
  reminders: Pick<Reminder, "id" | "remind_at" | "note">[]; // đang mở, sớm nhất trước
  services: Pick<Service, "id" | "name_vi" | "name_en" | "name_id" | "category" | "is_active">[];
  /** null = không được xem (Telesales). */
  photos: AppointmentPhoto[] | null;
  /** Bản chụp tin SMAX lúc gửi lead-form (dự phòng khi SMAX lỗi). */
  smax_messages: ChatMessage[] | null;
  /** Bản tóm tắt AI hội thoại SMAX gần nhất (null = chưa tóm tắt). */
  chat_summary: ChatSummary | null;
  can: { finance: boolean; photos: boolean };
  role: ViewerRole;
  /** Mốc "bây giờ" lúc tải (chọn Đơn hiện tại) — render không gọi Date.now(). */
  now: number;
}

/** Tóm tắt AI (Claude) hội thoại SMAX — 1 bản / khách, ghi đè khi tóm tắt lại. */
export interface ChatSummary {
  summary: string;
  /** Giờ tin mới nhất đã đưa vào tóm tắt — có tin sau mốc này = bản tóm tắt đã cũ. */
  last_message_at: string | null;
  message_count: number;
  created_by: string | null;
  created_at: string;
}

/** Vai trò tài khoản đang xem — gợi ý đầu popup. */
export type ViewerRole = "admin" | "telesales" | "sales" | "master";
