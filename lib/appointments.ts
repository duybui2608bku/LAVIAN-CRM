import { z } from "zod";

import type { BookingStatus, VisitStatus } from "@/types/appointment";
import type { ServiceCategory } from "@/types/service";

// Literal (không import giá trị từ types/ — node --test không hiểu alias "@/"); test đối chiếu BOOKING_STATUSES.
export const BOOKING_STATUS_VALUES = ["pending", "confirmed", "cancelled", "rescheduled"] as const satisfies readonly BookingStatus[];
export const VISIT_STATUS_VALUES = ["waiting", "arrived", "in_progress", "done", "rescheduled"] as const satisfies readonly VisitStatus[];
export const SERVICE_CATEGORY_VALUES = ["alis", "bibir", "laser"] as const satisfies readonly ServiceCategory[];

/** Nhóm dịch vụ (chọn nhiều): bỏ trùng. Dùng chung CRM + lead-form. */
export const serviceCategoriesSchema = z.array(z.enum(SERVICE_CATEGORY_VALUES)).max(10)
  .transform((cats) => [...new Set(cats)]);

/** Clinic confirmation (Show-up) chỉ bộ phận Sales được đổi (admin luôn toàn quyền). */
export function canConfirmShowUp(profile: { role: string; department: string | null } | null | undefined): boolean {
  return profile?.role === "admin" || profile?.department === "sales";
}

export const appointmentPatchSchema = z.object({
  scheduled_at: z.iso.datetime({ offset: true }),
  booking_confirm: z.enum(BOOKING_STATUS_VALUES),
  visit_status: z.enum(VISIT_STATUS_VALUES),
  service_categories: serviceCategoriesSchema,
  service_ids: z.array(z.uuid()).max(100).transform((ids) => [...new Set(ids)]),
  staff_id: z.uuid().nullable(),
  sales_id: z.uuid().nullable(),
  technician_id: z.uuid().nullable(),
  bill_amount: z.number().int().min(0).max(1e15).nullable(),
  note: z.string().trim().max(10000),
}).partial().strict()
  .refine((patch) => Object.keys(patch).length > 0);

/**
 * Lịch "gần bây giờ" nhất của mỗi khách: lịch sắp tới sớm nhất, không có thì lịch đã qua gần nhất.
 * Dùng chung cột Lịch hẹn / Sales Status ở trang Khách hàng + Khách tiềm năng.
 */
export function nearestByCustomer<T extends { customer_id: string; scheduled_at: string }>(appointments: T[], now: number) {
  // Lịch đã qua cộng thêm số rất lớn để luôn xếp sau lịch sắp tới.
  const rank = (a: T) => {
    const diff = Date.parse(a.scheduled_at) - now;
    return diff >= 0 ? diff : Number.MAX_SAFE_INTEGER / 2 - diff;
  };
  const map = new Map<string, T>();
  for (const a of appointments) {
    const cur = map.get(a.customer_id);
    if (!cur || rank(a) < rank(cur)) map.set(a.customer_id, a);
  }
  return map;
}

/** Status tính là khách đã đến — khớp trigger DB `sync_appointment_checked_in` (checked_in). */
export const ARRIVED_STATUSES: readonly string[] = ["arrived", "in_progress", "done"];

/**
 * Id các lịch của KHÁCH MỚI (chấm xanh ở Sales Management): khách chưa có lịch nào đã đến xếp sớm hơn lịch này.
 * Lần đến đầu tiên vẫn là khách mới (kể cả đã làm xong); lịch sau đó (vd Retouch) là khách cũ.
 * Lịch không đến (Chưa đến / Đổi lịch) không làm khách thành khách cũ. Đổi định nghĩa "khách mới" → sửa hàm này.
 */
export function newCustomerAppointmentIds(
  appointments: { id: string; customer_id: string; scheduled_at: string; visit_status: string }[],
): Set<string> {
  const firstVisit = new Map<string, number>();
  for (const a of appointments) {
    if (!ARRIVED_STATUSES.includes(a.visit_status)) continue;
    const at = Date.parse(a.scheduled_at);
    const cur = firstVisit.get(a.customer_id);
    if (cur === undefined || at < cur) firstVisit.set(a.customer_id, at);
  }
  return new Set(appointments
    .filter((a) => {
      const first = firstVisit.get(a.customer_id);
      return first === undefined || Date.parse(a.scheduled_at) <= first;
    })
    .map((a) => a.id));
}
