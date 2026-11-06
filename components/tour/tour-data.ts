// Dữ liệu dùng chung cho Excel + phiếu tour PDF (admin).
import type { StaffRef } from "@/components/common/user-avatar";
import { tourAmount, tourRate, type ServiceDetail } from "@/lib/tours";
import type { Tour } from "@/types/tour";

/** Tour kèm thực thu (`amount`) và % (`rate`). */
export type TourItem = Tour & { amount: number | null; rate: number | null };

export type TourGroup = {
  technician: StaffRef;
  rows: TourItem[];
  bill: number;
  amount: number;
  missing: number;
};

export function toItem(row: Tour): TourItem {
  const amount = tourAmount(row.service_detail, row.service_session, row.bill_amount);
  return { ...row, amount, rate: amount == null ? null : tourRate(row.service_detail!, row.service_session) };
}

/** Gom tour đã có KTV theo KTV, sắp theo tên. */
export function groupByTechnician(items: TourItem[], staff: StaffRef[]): TourGroup[] {
  const byId = new Map(staff.map((s) => [s.id, s]));
  const groups = new Map<string, TourGroup>();
  for (const item of items) {
    if (!item.technician_id) continue;
    let group = groups.get(item.technician_id);
    if (!group) {
      const technician = byId.get(item.technician_id) ?? { id: item.technician_id, user_name: "—", avatar_url: null };
      group = { technician, rows: [], bill: 0, amount: 0, missing: 0 };
      groups.set(item.technician_id, group);
    }
    group.rows.push(item);
    group.bill += item.bill_amount ?? 0;
    group.amount += item.amount ?? 0;
    if (item.amount == null) group.missing += 1;
  }
  return [...groups.values()].sort((a, b) => a.technician.user_name.localeCompare(b.technician.user_name));
}

const DETAIL_EN: Record<ServiceDetail, string> = {
  laser: "Laser", plasma: "Plasma", new: "New", debt: "Debt", retouch: "Retouch",
};

/** Nhãn dịch vụ chi tiết tiếng Anh (phiếu tour luôn tiếng Anh). */
export const detailLabelEn = (row: Tour) =>
  row.service_detail ? `${DETAIL_EN[row.service_detail]}${row.service_session ? ` ${row.service_session}` : ""}` : "";
