import type { EnumKind, EnumOption } from "@/types/customer";

const definitions: [EnumKind, string, string, string, string][] = [
  ["stage", "consulting", "Đang tư vấn", "Consulting", "cyan"],
  ["stage", "potential", "Tiềm năng", "Potential", "purple"],
  ["stage", "consider", "Cân nhắc", "Consider", "orange"],
  ["stage", "deposited", "Đã đặt cọc", "Deposited", "gold"],
  ["stage", "booked", "Đã đặt lịch", "Booking", "geekblue"], // tạo mới ở lead form bắt buộc kèm lịch hẹn
  ["stage", "show_up", "Đã đến", "Showed up", "green"], // tự động theo Clinic confirmation — không cho chọn tay
  ["stage", "purchase", "Đã mua", "Purchase", "volcano"], // chọn tay; trigger Show-up không hạ Purchase về Show-up
  ["rating", "potential", "Tiềm năng", "Potential", "green"],
  ["rating", "price_only", "Chỉ hỏi giá", "Price only", "gold"],
  ["rating", "far", "Ở xa", "Far away", "orange"],
  ["rating", "spam", "Spam", "Spam", "red"],
  ["source", "instagrams", "Instagram", "Instagram", "magenta"],
  ["source", "whatsapp", "WhatsApp", "WhatsApp", "green"],
  // Tình trạng ở trang Khách tiềm năng; "converted" = mở form tạo lịch hẹn rồi chuyển Booking.
  ["potential_status", "interested", "Quan tâm", "Interested", "blue"],
  ["potential_status", "no_response", "Chưa phản hồi", "No response", "default"],
  ["potential_status", "converted", "Chuyển đổi đặt lịch", "Converted to booking", "green"],
];

/** Stage tự chuyển khi lịch hẹn được đánh dấu Show-up (trigger DB) — ẩn khỏi ô chọn stage. */
export const SHOW_UP_STAGE = "show_up";

/** Stage "Booking" — khách mới ở lead form chọn stage này phải kèm lịch hẹn. */
export const BOOKED_STAGE = "booked";

/** Stage của trang Khách tiềm năng (/customers/potential). */
export const POTENTIAL_STAGE = "potential";

/** Tình trạng "Chuyển đổi đặt lịch" — chỉ đặt qua convertPotentialCustomer sau khi tạo lịch hẹn. */
export const CONVERTED_STATUS = "converted";

/** Tình trạng khách tiềm năng hợp lệ (trừ converted); "" / lạ → null. */
export function validPotentialStatus(v: string | null | undefined): string | null {
  return v && v !== CONVERTED_STATUS && CUSTOMER_OPTIONS.some((o) => o.kind === "potential_status" && o.value === v)
    ? v
    : null;
}

/** Stage có lịch nhắc follow-up (`follow_up_at`) — hiện ở trang Khách tiềm năng. Không phải lịch hẹn tới chi nhánh. */
export const FOLLOW_UP_STAGES: readonly string[] = [POTENTIAL_STAGE, "consider"];
export const isFollowUpStage = (stage: string | null | undefined) => !!stage && FOLLOW_UP_STAGES.includes(stage);

/**
 * Lead form: bắt buộc lịch hẹn (tới chi nhánh) khi VỪA chọn Booking (khách mới hoặc khách cũ đổi stage).
 * Khách đang ở sẵn Booking chỉ cập nhật thông tin → không bắt tạo lịch mới.
 */
export const needsAppointment = (stage: string | null | undefined, currentStage?: string | null) =>
  stage === BOOKED_STAGE && currentStage !== stage;

/** Stage hiện ở trang Booking management (/customers/bookings). */
export const BOOKING_PAGE_STAGES = [BOOKED_STAGE, "deposited"] as const;

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

/** Khách Instagram có thể chưa cho SĐT mà vẫn quan tâm → SĐT không bắt buộc (lưu ""). WhatsApp luôn có số. */
export const phoneOptional = (source: string | null | undefined) => source === "instagrams";

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
