/**
 * Định nghĩa KPI dùng chung (sếp chốt 2026-11-27) — /reports, Báo cáo Telesales, pipeline /customers, Đặt lịch,
 * Quản lý bán hàng đều tính theo file này. Đổi định nghĩa → chỉ sửa ở đây.
 *  - Đặt lịch       = lịch hẹn có NGÀY TẠO trong kỳ (`bookedIn`).
 *  - Đến cơ sở      = lịch có NGÀY HẸN trong kỳ và `visit_status` đã đến (`isArrived`).
 *  - Huỷ / Đổi lịch = `visit_status` cancelled / rescheduled — nguồn duy nhất; `booking_confirm` chỉ còn Chờ / Đã xác nhận.
 *  - Đặt cọc        = khách có tiền cọc > 0 (`customers.deposit_amount`, `hasDeposit`).
 * Ngày là chuỗi `YYYY-MM-DD` theo giờ VN/WIB (UTC+7). File thuần, không import runtime (node --test).
 */

/** Status tính là khách đã đến — khớp trigger DB `sync_appointment_checked_in` (checked_in). */
export const ARRIVED_STATUSES: readonly string[] = ["arrived", "in_progress", "done"];
export const isArrived = (visitStatus: string) => ARRIVED_STATUSES.includes(visitStatus);

export const hasDeposit = (amount: number | string | null | undefined) => Number(amount ?? 0) > 0;

/** Timestamp ISO → ngày theo UTC+7. */
export const vnDay = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);

/** Lịch được tính "Đặt lịch" trong kỳ [from, to]: tạo trong kỳ. */
export const bookedIn = (a: { created_at: string }, from: string, to: string) => {
  const day = vnDay(a.created_at);
  return day >= from && day <= to;
};

/** Trạng thái cột "Xác nhận lịch" (Telesales) — 4 giá trị hiển thị, nhưng Huỷ / Đổi lịch đọc từ visit_status. */
export type ConfirmStatus = "pending" | "confirmed" | "cancelled" | "rescheduled";
type CancelVisit = "cancelled" | "rescheduled";
const isCancelVisit = (v: string): v is CancelVisit => v === "cancelled" || v === "rescheduled";

export function confirmStatus(a: { booking_confirm: string; visit_status: string }): ConfirmStatus {
  if (isCancelVisit(a.visit_status)) return a.visit_status;
  return a.booking_confirm === "confirmed" ? "confirmed" : "pending";
}

/**
 * Chọn ở cột Xác nhận lịch → giá trị ghi DB: Huỷ / Đổi lịch ghi `visit_status` (chỉ khi khách chưa đến);
 * Chờ / Đã xác nhận ghi `booking_confirm` và đưa lịch đang Huỷ / Đổi lịch về Chưa đến. null = không được (khách đã đến).
 */
export function confirmPatch(status: ConfirmStatus, visitStatus: string):
  { booking_confirm?: "pending" | "confirmed"; visit_status?: "waiting" | CancelVisit } | null {
  const notArrived = visitStatus === "waiting" || isCancelVisit(visitStatus);
  if (isCancelVisit(status)) return notArrived ? { visit_status: status } : null;
  return { booking_confirm: status, ...(isCancelVisit(visitStatus) ? { visit_status: "waiting" as const } : {}) };
}

/** Áp patch (booking_confirm dạng 4 trạng thái) lên 1 lịch — cập nhật lạc quan ở client, cùng quy tắc với server. */
export function withPatch<T extends { booking_confirm: string; visit_status: string }>(
  row: T, patch: Partial<Omit<T, "booking_confirm">> & { booking_confirm?: ConfirmStatus },
): T {
  const { booking_confirm, ...rest } = patch;
  return { ...row, ...rest, ...(booking_confirm ? confirmPatch(booking_confirm, row.visit_status) ?? {} : {}) };
}
