import { z } from "zod";

import type { BookingStatus, VisitStatus } from "@/types/appointment";
import { ARRIVED_STATUSES } from "./kpi.ts";

// Literal (không import giá trị từ types/ — node --test không hiểu alias "@/"); test đối chiếu BOOKING_STATUSES.
export const BOOKING_STATUS_VALUES = ["pending", "confirmed", "cancelled", "rescheduled"] as const satisfies readonly BookingStatus[];
export const VISIT_STATUS_VALUES = ["waiting", "arrived", "in_progress", "done", "rescheduled", "cancelled"] as const satisfies readonly VisitStatus[];

/** Nhóm dịch vụ (chọn nhiều, mã service_groups.id): bỏ trùng. Dùng chung CRM + lead-form. */
export const serviceCategoriesSchema = z.array(z.string().regex(/^[a-z0-9_]+$/).max(40)).max(10)
  .transform((cats) => [...new Set(cats)]);

/** Clinic confirmation (Show-up) chỉ bộ phận Sales được đổi (admin luôn toàn quyền). */
export function canConfirmShowUp(profile: { role: string; department: string | null } | null | undefined): boolean {
  return profile?.role === "admin" || profile?.department === "sales";
}

/** Đổi Status lịch: Sales/admin mọi trạng thái; Master (technician) chỉ được chọn "Đã thực hiện". */
export function canSetVisitStatus(profile: { role: string; department: string | null } | null | undefined, status: VisitStatus): boolean {
  return canConfirmShowUp(profile) || (profile?.department === "technician" && status === "done");
}

type RuleFields = { visit_status: string; technician_id: string | null; sales_id: string | null };
/** Mã lỗi quy tắc E3 → i18n `appointments.rule.<code>`; field = ô hiện lỗi ở Drawer. */
export type AppointmentRuleError = { code: "doneNeedsMaster" | "inProgressNeedsStaff"; field: keyof RuleFields };

/**
 * Quy tắc E3 khi lưu lịch (chỉ xét quy tắc có trường nằm trong `patch`, để lịch cũ vẫn sửa được trường khác):
 * Đang thực hiện cần Master hoặc Sales; Đã thực hiện cần Master. DB có check NOT VALID tương ứng.
 * Tiền không còn ở lịch hẹn — chỉ ở thẻ liệu trình.
 */
export function validateVisitStatus(patch: Partial<RuleFields>, current: RuleFields): AppointmentRuleError | null {
  if (!["visit_status", "technician_id", "sales_id"].some((k) => k in patch)) return null;
  const next = { ...current, ...patch };
  if (next.visit_status === "done" && !next.technician_id) return { code: "doneNeedsMaster", field: "technician_id" };
  if (next.visit_status === "in_progress" && !next.technician_id && !next.sales_id)
    return { code: "inProgressNeedsStaff", field: "technician_id" };
  return null;
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

// Khách đã đến = định nghĩa KPI chung (lib/kpi.ts).
export { ARRIVED_STATUSES } from "./kpi.ts";

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

/**
 * Dải số liệu Sales Management — tính trên các lịch đang lọc. Tiền lấy từ thẻ liệu trình bán ở lịch
 * (`moneyOf` → cardMoney, lịch chưa có thẻ = null): Giá trị DV, Thực thu (cọc trừ vào thẻ + đã thu), Còn phải thu (không âm).
 */
export function appointmentStats<T extends { visit_status: string }>(
  rows: T[],
  moneyOf: (row: T) => { value: number; collected: number; due: number } | null | undefined,
) {
  const s = { total: rows.length, arrived: 0, cancelled: 0, waiting: 0, bill: 0, collected: 0, due: 0 };
  for (const a of rows) {
    if (ARRIVED_STATUSES.includes(a.visit_status)) s.arrived++;
    else if (a.visit_status === "cancelled" || a.visit_status === "rescheduled") s.cancelled++;
    else if (a.visit_status === "waiting") s.waiting++;
    const m = moneyOf(a);
    if (m) { s.bill += m.value; s.collected += m.collected; s.due += Math.max(m.due, 0); }
  }
  return s;
}
