import type { EnumKind, EnumOption } from "@/types/customer";

const definitions: [EnumKind, string, string, string, string][] = [
  ["stage", "new_lead", "Khách mới", "New lead", "blue"],
  ["stage", "consulting", "Đang tư vấn", "Consulting", "cyan"],
  ["stage", "deposited", "Đã đặt cọc", "Deposited", "gold"],
  ["stage", "booked", "Đã đặt lịch", "Booked", "geekblue"],
  ["stage", "visited", "Đã đến", "Visited", "green"],
  ["stage", "returning", "Khách quay lại", "Returning", "purple"],
  ["stage", "lost", "Đã mất", "Lost", "red"],
  ["source", "instagrams", "Instagram", "Instagram", "magenta"],
  ["source", "whatsapp", "WhatsApp", "WhatsApp", "green"],
];

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
