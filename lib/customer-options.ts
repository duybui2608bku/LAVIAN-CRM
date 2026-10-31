import type { EnumKind, EnumOption } from "@/types/customer";

const definitions: [EnumKind, string, string, string][] = [
  ["stage", "new_lead", "Khách mới", "New lead"],
  ["stage", "consulting", "Đang tư vấn", "Consulting"],
  ["stage", "deposited", "Đã đặt cọc", "Deposited"],
  ["stage", "booked", "Đã đặt lịch", "Booked"],
  ["stage", "visited", "Đã đến", "Visited"],
  ["stage", "returning", "Khách quay lại", "Returning"],
  ["stage", "lost", "Đã mất", "Lost"],
  ["source", "instagrams", "Instagram", "Instagram"],
  ["source", "whatsapp", "WhatsApp", "WhatsApp"],
  ["source", "referral", "Giới thiệu", "Referral"],
  ["source", "walk_in", "Khách vãng lai", "Walk-in"],
  ["source", "smax", "SMAX", "SMAX"],
  ["source", "other", "Khác", "Other"],
];

export const CUSTOMER_OPTIONS: EnumOption[] = definitions.map(
  ([kind, value, label_vi, label_en], sort_order) => ({
    id: `${kind}-${value}`, kind, value, label_vi, label_en,
    label_id: null, icon: null, color: null, sort_order,
    is_active: true, created_at: "", updated_at: "",
  }),
);
