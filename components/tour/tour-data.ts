// Dữ liệu dùng chung cho Excel + phiếu tour PDF (admin).
import type { StaffRef } from "@/components/common/user-avatar";
import { tourSessionOf } from "@/lib/cards";
import type { Tour } from "@/types/tour";

/** missing = số tour chưa nhập bill. */
export type TourGroup = {
  technician: StaffRef;
  rows: Tour[];
  bill: number;
  missing: number;
};

/** Gom tour đã có KTV theo KTV, sắp theo tên. */
export function groupByTechnician(items: Tour[], staff: StaffRef[]): TourGroup[] {
  const byId = new Map(staff.map((s) => [s.id, s]));
  const groups = new Map<string, TourGroup>();
  for (const item of items) {
    if (!item.technician_id) continue;
    let group = groups.get(item.technician_id);
    if (!group) {
      const technician = byId.get(item.technician_id) ?? { id: item.technician_id, user_name: "—", avatar_url: null };
      group = { technician, rows: [], bill: 0, missing: 0 };
      groups.set(item.technician_id, group);
    }
    group.rows.push(item);
    group.bill += item.bill_amount ?? 0;
    if (item.bill_amount == null) group.missing += 1;
  }
  return [...groups.values()].sort((a, b) => a.technician.user_name.localeCompare(b.technician.user_name));
}

/** Nhãn lần tiếng Anh (phiếu tour luôn tiếng Anh). */
export const detailLabelEn = (row: Tour) => {
  const n = tourSessionOf(row);
  return n ? `Session ${n}` : "";
};
