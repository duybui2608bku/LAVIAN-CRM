// Import type tương đối (không alias @/) để chạy được `node --test` trực tiếp.
import type { Appointment, AppointmentStatus } from "../types/appointment";

/** Thứ tự nhóm trạng thái trong ngày — khớp cách nhân viên đọc sheet:
 *  Đã đến → Hoàn tất → Đã đặt lịch → Chờ xác nhận → No-show → Hủy. */
export const STATUS_ORDER: Record<AppointmentStatus, number> = {
  checked_in: 1,
  completed: 2,
  booked: 3,
  pending_confirmation: 4,
  no_show: 5,
  cancelled: 6,
};

/** Ngày local `YYYY-MM-DD` của một timestamp ISO (lịch hẹn nhạy giờ địa phương —
 *  cắt 10 ký tự UTC sẽ lệch ngày với giờ sáng ở UTC+7).
 *  ponytail: lặp lại 3 dòng của lib/date.formatISODate — import runtime sẽ làm
 *  file này hết chạy được bằng `node --test` (node đòi extension, tsc cấm). */
export function localDay(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Giờ local `HH:mm` của một timestamp ISO. */
export function localTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Sisa — còn nợ: (Paid nếu đã chốt, chưa thì Price) trừ DP, không âm. */
export function outstanding(a: Appointment): number {
  const base = a.final_amount ?? a.expected_amount ?? 0;
  return Math.max(base - a.deposit_amount, 0);
}

/** Tổng doanh thu ngày = tổng final_amount các lịch đã hoàn tất. */
export function dayTotal(list: Appointment[]): number {
  return list
    .filter((a) => a.status === "completed")
    .reduce((sum, a) => sum + (a.final_amount ?? 0), 0);
}

export interface AppointmentFilters {
  waiting?: boolean; // tab Chờ xếp lịch: scheduled_at null, chưa hủy
  day?: string; // YYYY-MM-DD — ngày local của scheduled_at
  search?: string; // tên/phone khách
  status?: string;
  staffId?: string;
  serviceId?: string;
}

/** Vị từ lọc lịch hẹn phía client (tách thuần để test được). */
export function matchesAppointmentFilters(
  a: Appointment,
  f: AppointmentFilters,
): boolean {
  if (f.waiting) {
    if (a.scheduled_at !== null || a.status === "cancelled") return false;
  } else if (f.day) {
    if (!a.scheduled_at || localDay(a.scheduled_at) !== f.day) return false;
  }
  const q = (f.search ?? "").trim().toLowerCase();
  if (q) {
    const hay =
      `${a.customer?.full_name ?? ""} ${a.customer?.phone ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.status && a.status !== f.status) return false;
  if (f.staffId && a.staff_id !== f.staffId) return false;
  if (f.serviceId && !a.service_ids?.includes(f.serviceId)) return false;
  return true;
}

/** Sắp xếp để render nhóm theo trạng thái, trong nhóm theo giờ tăng dần. */
export function sortForDayView(list: Appointment[]): Appointment[] {
  return [...list].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""),
  );
}

/** Gom lịch theo ngày local (bỏ lịch chưa có ngày), trong ngày sắp theo giờ. */
export function groupByDay(list: Appointment[]): Map<string, Appointment[]> {
  const map = new Map<string, Appointment[]>();
  for (const a of list) {
    if (!a.scheduled_at) continue;
    const key = localDay(a.scheduled_at);
    const bucket = map.get(key);
    if (bucket) bucket.push(a);
    else map.set(key, [a]);
  }
  for (const bucket of map.values())
    bucket.sort((x, y) => x.scheduled_at!.localeCompare(y.scheduled_at!));
  return map;
}

export interface LaneItem {
  a: Appointment;
  lane: number; // cột con trong ngày (0-based)
  lanes: number; // tổng cột con của cụm chồng giờ chứa lịch này
}

/** Xếp lane cho các lịch chồng giờ trong CÙNG một ngày (calendar tuần):
 *  greedy theo giờ bắt đầu — lịch vào lane trống sớm nhất; các lịch trong
 *  cùng cụm giao nhau chia đều bề rộng (`lanes`). */
export function assignLanes(list: Appointment[]): LaneItem[] {
  const sorted = [...list]
    .filter((a) => a.scheduled_at)
    .sort((x, y) => x.scheduled_at!.localeCompare(y.scheduled_at!));

  const items: LaneItem[] = [];
  const laneEnds: number[] = []; // mốc kết thúc (ms) hiện tại của từng lane
  let clusterStart = 0; // index item đầu của cụm chồng giờ đang mở
  let clusterEnd = -Infinity;

  const closeCluster = () => {
    const width =
      Math.max(...items.slice(clusterStart).map((i) => i.lane)) + 1;
    for (let i = clusterStart; i < items.length; i++) items[i].lanes = width;
  };

  for (const a of sorted) {
    const start = new Date(a.scheduled_at!).getTime();
    const end = start + a.duration_minutes * 60_000;
    if (items.length > clusterStart && start >= clusterEnd) {
      closeCluster();
      clusterStart = items.length;
      laneEnds.length = 0;
    }
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    items.push({ a, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (items.length > clusterStart) closeCluster();
  return items;
}
