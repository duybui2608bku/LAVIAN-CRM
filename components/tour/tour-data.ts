// Dữ liệu dùng chung cho trang /tour (server page, bảng, Excel, phiếu PDF) — không "use client"
// để server import được hằng số.
import type { StaffRef } from "@/components/common/user-avatar";
import { tourAmount, tourRate, type ServiceDetail } from "@/lib/appointments";

export const ALL_TECHNICIANS = "all";

export type TourRow = {
  id: string;
  technician_id: string | null;
  scheduled_at: string;
  service_detail: ServiceDetail | null;
  service_session: number | null;
  bill_amount: number | null;
  customer: { full_name: string } | null;
};

export type TourItem = TourRow & { tour: number | null; rate: number | null };

export type TourGroup = {
  technician: StaffRef;
  rows: TourItem[];
  bill: number;
  tour: number;
  missing: number;
};

export function toItem(row: TourRow): TourItem {
  return {
    ...row,
    tour: tourAmount(row.service_detail, row.service_session, row.bill_amount),
    rate: row.service_detail ? tourRate(row.service_detail, row.service_session) : null,
  };
}

/** Gom lịch theo KTV, sắp theo tên. `staff` dùng để lấy tên/avatar. */
export function groupByTechnician(items: TourItem[], staff: StaffRef[]): TourGroup[] {
  const byId = new Map(staff.map((s) => [s.id, s]));
  const groups = new Map<string, TourGroup>();
  for (const item of items) {
    const id = item.technician_id ?? "";
    let group = groups.get(id);
    if (!group) {
      group = { technician: byId.get(id) ?? { id, user_name: "—", avatar_url: null }, rows: [], bill: 0, tour: 0, missing: 0 };
      groups.set(id, group);
    }
    group.rows.push(item);
    group.bill += item.bill_amount ?? 0;
    group.tour += item.tour ?? 0;
    if (item.tour == null) group.missing += 1;
  }
  return [...groups.values()].sort((a, b) => a.technician.user_name.localeCompare(b.technician.user_name));
}

const DETAIL_EN: Record<ServiceDetail, string> = {
  laser: "Laser", plasma: "Plasma", new: "New", debt: "Debt", retouch: "Retouch",
};

/** Nhãn dịch vụ chi tiết tiếng Anh (phiếu tour luôn tiếng Anh). */
export const detailLabelEn = (row: TourRow) =>
  row.service_detail ? `${DETAIL_EN[row.service_detail]}${row.service_session ? ` ${row.service_session}` : ""}` : "";
