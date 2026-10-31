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
  ["source", "referral", "Giới thiệu", "Referral", "purple"],
  ["source", "walk_in", "Khách vãng lai", "Walk-in", "orange"],
  ["source", "smax", "SMAX", "SMAX", "cyan"],
  ["source", "other", "Khác", "Other", "default"],
];

export const CUSTOMER_OPTIONS: EnumOption[] = definitions.map(
  ([kind, value, label_vi, label_en, color], sort_order) => ({
    id: `${kind}-${value}`, kind, value, label_vi, label_en,
    label_id: null, icon: null, color, sort_order,
    is_active: true, created_at: "", updated_at: "",
  }),
);
