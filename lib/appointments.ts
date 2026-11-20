import { z } from "zod";

import type { BookingStatus, VisitStatus } from "@/types/appointment";
import type { ServiceCategory } from "@/types/service";

// Literal (không import giá trị từ types/ — node --test không hiểu alias "@/"); test đối chiếu BOOKING_STATUSES.
export const BOOKING_STATUS_VALUES = ["pending", "confirmed", "cancelled", "rescheduled"] as const satisfies readonly BookingStatus[];
export const VISIT_STATUS_VALUES = ["waiting", "arrived", "in_progress", "done", "rescheduled", "cancelled"] as const satisfies readonly VisitStatus[];
export const SERVICE_CATEGORY_VALUES = ["alis", "bibir", "laser"] as const satisfies readonly ServiceCategory[];

/** Nhóm dịch vụ (chọn nhiều): bỏ trùng. Dùng chung CRM + lead-form. */
export const serviceCategoriesSchema = z.array(z.enum(SERVICE_CATEGORY_VALUES)).max(10)
  .transform((cats) => [...new Set(cats)]);

/** Clinic confirmation (Show-up) chỉ bộ phận Sales được đổi (admin luôn toàn quyền). */
export function canConfirmShowUp(profile: { role: string; department: string | null } | null | undefined): boolean {
  return profile?.role === "admin" || profile?.department === "sales";
}

/** Đổi Status lịch: Sales/admin mọi trạng thái; Master (technician) chỉ được chọn "Đã thực hiện". */
export function canSetVisitStatus(profile: { role: string; department: string | null } | null | undefined, status: VisitStatus): boolean {
  return canConfirmShowUp(profile) || (profile?.department === "technician" && status === "done");
}

type RuleFields = { visit_status: string; technician_id: string | null; sales_id: string | null; bill_amount: number | null; paid_amount: number | null };
/** Mã lỗi quy tắc E3 → i18n `appointments.rule.<code>`; field = ô hiện lỗi ở Drawer. */
export type AppointmentRuleError = { code: "billBelowCollected" | "doneNeedsMaster" | "inProgressNeedsStaff"; field: keyof RuleFields };

/**
 * Quy tắc E3 khi lưu lịch (chỉ xét quy tắc có trường nằm trong `patch`, để lịch cũ vẫn sửa được trường khác):
 * Giá trị DV > 0 không nhỏ hơn số đã thu (cọc + thu thêm); Đang thực hiện cần Master hoặc Sales; Đã thực hiện cần Master.
 * DB có check NOT VALID tương ứng cho 2 quy tắc trạng thái.
 */
export function validateVisitStatus(patch: Partial<RuleFields>, current: RuleFields, deposit: number | null | undefined): AppointmentRuleError | null {
  const next = { ...current, ...patch };
  const touched = (...keys: (keyof RuleFields)[]) => keys.some((k) => k in patch);
  if (touched("bill_amount", "paid_amount") && (next.bill_amount ?? 0) > 0
    && (next.bill_amount ?? 0) < (deposit ?? 0) + (next.paid_amount ?? 0)) return { code: "billBelowCollected", field: "bill_amount" };
  if (touched("visit_status", "technician_id", "sales_id")) {
    if (next.visit_status === "done" && !next.technician_id) return { code: "doneNeedsMaster", field: "technician_id" };
    if (next.visit_status === "in_progress" && !next.technician_id && !next.sales_id)
      return { code: "inProgressNeedsStaff", field: "technician_id" };
  }
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
  bill_amount: z.number().int().min(0).max(1e15).nullable(),
  paid_amount: z.number().int().min(0).max(1e15).nullable(),
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

/** Tiền 1 lịch: Thực thu = Deposit (của khách) + Thu thêm; Phải thu = Giá trị DV − Thực thu (không âm). */
export function appointmentMoney(bill: number | null | undefined, deposit: number | null | undefined, paid: number | null | undefined) {
  const collected = (deposit ?? 0) + (paid ?? 0);
  return { bill: bill ?? 0, collected, due: Math.max((bill ?? 0) - collected, 0) };
}

/** Dải số liệu Sales Management — tính trên các lịch đang lọc. */
export function appointmentStats(
  rows: { customer_id: string; visit_status: string; bill_amount: number | null; paid_amount: number | null }[],
  depositOf: (customerId: string) => number | null | undefined,
) {
  const s = { total: rows.length, arrived: 0, cancelled: 0, waiting: 0, bill: 0, collected: 0, due: 0 };
  for (const a of rows) {
    if (ARRIVED_STATUSES.includes(a.visit_status)) s.arrived++;
    else if (a.visit_status === "cancelled" || a.visit_status === "rescheduled") s.cancelled++;
    else if (a.visit_status === "waiting") s.waiting++;
    const m = appointmentMoney(a.bill_amount, depositOf(a.customer_id), a.paid_amount);
    s.bill += m.bill; s.collected += m.collected; s.due += m.due;
  }
  return s;
}
