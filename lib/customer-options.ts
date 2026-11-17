import type { EnumKind, EnumOption } from "@/types/customer";

const definitions: [EnumKind, string, string, string, string][] = [
  ["stage", "consulting", "Đang tư vấn", "Consulting", "cyan"],
  ["stage", "potential", "Tiềm năng", "Potential", "purple"],
  ["stage", "deposited", "Đã đặt cọc", "Deposited", "gold"],
  ["stage", "booked", "Booking", "Booking", "geekblue"], // tạo mới ở lead form bắt buộc kèm lịch hẹn
  ["stage", "show_up", "Show-up", "Show-up", "green"], // tự động theo Clinic confirmation — không cho chọn tay
  ["rating", "potential", "Tiềm năng", "Potential", "green"],
  ["rating", "price_only", "Chỉ hỏi giá", "Price only", "gold"],
  ["rating", "far", "Ở xa", "Far away", "orange"],
  ["rating", "spam", "Spam", "Spam", "red"],
  ["source", "instagrams", "Instagram", "Instagram", "magenta"],
  ["source", "whatsapp", "WhatsApp", "WhatsApp", "green"],
];

/** Stage tự chuyển khi lịch hẹn được đánh dấu Show-up (trigger DB) — ẩn khỏi ô chọn stage. */
export const SHOW_UP_STAGE = "show_up";

/** Stage "Booking" — khách mới ở lead form chọn stage này phải kèm lịch hẹn. */
export const BOOKED_STAGE = "booked";

/** Stage hợp lệ (kể cả show_up đang giữ nguyên khi sửa khách). */
export function isStage(v: string | null | undefined): boolean {
  return CUSTOMER_OPTIONS.some((o) => o.kind === "stage" && o.value === v);
}

/** Giá trị đánh giá hợp lệ → giữ; "" / lạ → null (chưa đánh giá). */
export function validRating(v: string | null | undefined): string | null {
  return v && CUSTOMER_OPTIONS.some((o) => o.kind === "rating" && o.value === v) ? v : null;
}

/** Nguồn khách: có hội thoại WhatsApp (link SMAX `/chats/waw…`) → WA, còn lại mặc định Instagram. */
export function leadSource(threadLink: string | null | undefined): "whatsapp" | "instagrams" {
  return threadLink && /\/chats\/waw\d/.test(threadLink) ? "whatsapp" : "instagrams";
}

/** Username IG (rút từ `smax_data->customer->instagram->>username`); chỉ nhận ký tự hợp lệ của IG. */
export function instagramUsername(u: unknown): string | null {
  return typeof u === "string" && /^[A-Za-z0-9._]{1,30}$/.test(u) ? u : null;
}

export const CUSTOMER_OPTIONS: EnumOption[] = definitions.map(
  ([kind, value, label_vi, label_en, color], sort_order) => ({
    id: `${kind}-${value}`, kind, value, label_vi, label_en,
    label_id: null, icon: null, color, sort_order,
    is_active: true, created_at: "", updated_at: "",
  }),
);
