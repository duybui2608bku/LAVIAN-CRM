// Import type tương đối (không alias @/) để chạy được `node --test` trực tiếp.
import type {
  Appointment,
  AppointmentPayment,
  AppointmentStatus,
  AppointmentUpsale,
  ServiceLedger,
} from "../types/appointment";

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

/** Đã thu ròng từ một danh sách dòng tiền: Σ(deposit + payment) − Σ(refund). */
export function sumPayments(
  payments: Pick<AppointmentPayment, "kind" | "amount">[] | null | undefined,
): number {
  return (payments ?? []).reduce(
    (sum, p) => sum + (p.kind === "refund" ? -p.amount : p.amount),
    0,
  );
}

/** Tổng doanh số upsale được ghi trực tiếp dưới một lịch hẹn. */
export function upsaleTotal(
  upsales: Pick<AppointmentUpsale, "amount">[] | null | undefined,
): number {
  return (upsales ?? []).reduce((sum, row) => sum + row.amount, 0);
}

/** Tổng giá phải thanh toán của sổ = giá liệu trình gốc + mọi upsale thuộc sổ. */
export function payableTotal(a: Appointment): number | null {
  if (!a.ledger) return null;
  const upsales = upsaleTotal(a.ledger.upsales);
  if (a.ledger.total_amount == null && upsales === 0) return null;
  return (a.ledger.total_amount ?? 0) + upsales;
}

/** Đã thu của SỔ (mọi buổi hẹn của liệu trình). */
export function ledgerPaid(l: ServiceLedger): number {
  return sumPayments(l.payments);
}

/** Đã thu hiển thị cho một lịch hẹn: theo SỔ nó thuộc về; lịch không sổ
 *  (dữ liệu cũ không dịch vụ) fallback Σ dòng tiền gắn trực tiếp lịch. */
export function paidTotal(a: Appointment): number {
  return a.ledger ? ledgerPaid(a.ledger) : sumPayments(a.payments);
}

/** Còn nợ: (giá liệu trình + upsale) − Đã thu, không âm. Không sổ = 0. */
export function outstanding(a: Appointment): number {
  const total = payableTotal(a);
  if (total == null) return 0;
  return Math.max(total - ledgerPaid(a.ledger!), 0);
}

/** Gợi ý "Thu lần này" khi hoàn tất lịch: phần còn thiếu của sổ — CHỈ khi mọi
 *  dòng tiền hiện có là của CHÍNH lịch này (vd. cọc buổi đầu). Khách cũ nối sổ
 *  đã có tiền buổi trước → null (không tự điền, tránh ghi nhầm thành thu mới). */
export function collectSuggestion(a: Appointment): number | null {
  const total = payableTotal(a);
  if (total == null) return null;
  if (a.ledger!.payments.some((p) => p.appointment_id !== a.id)) return null;
  return Math.max(total - ledgerPaid(a.ledger!), 0);
}

/** Row PostgREST nested của appointments (dùng chung 2 page query). */
export interface AppointmentRow
  extends Omit<Appointment, "service_ids" | "upsales" | "payments" | "ledger"> {
  appointment_services: { service_id: string }[] | null;
  appointment_upsales: AppointmentUpsale[] | null;
  appointment_payments: AppointmentPayment[] | null;
  ledger:
    | (Omit<ServiceLedger, "payments" | "upsales"> & {
        appointment_payments: AppointmentPayment[] | null;
      })
    | null;
}

const byPaidAtDesc = (x: AppointmentPayment, y: AppointmentPayment) =>
  y.paid_at.localeCompare(x.paid_at);

/** Chuẩn hóa row nested → Appointment (dòng tiền mới nhất trước). */
export function normalizeAppointmentRow(row: AppointmentRow): Appointment {
  const {
    appointment_services,
    appointment_upsales,
    appointment_payments,
    ledger,
    ...a
  } = row;
  let mapped: Appointment["ledger"] = null;
  if (ledger) {
    const { appointment_payments: lp, ...l } = ledger;
    mapped = {
      ...l,
      payments: [...(lp ?? [])].sort(byPaidAtDesc),
      upsales: [],
    };
  }
  return {
    ...a,
    service_ids: (appointment_services ?? []).map((r) => r.service_id),
    upsales: [...(appointment_upsales ?? [])].sort((x, y) =>
      y.created_at.localeCompare(x.created_at),
    ),
    payments: [...(appointment_payments ?? [])].sort(byPaidAtDesc),
    ledger: mapped,
  };
}

/** Gắn tổng upsale vào từng sổ từ các lịch đã nạp, không yêu cầu FK trực tiếp
 *  `appointment_upsales.ledger_id` nên tương thích schema hiện tại. */
export function hydrateLedgerUpsales(list: Appointment[]): Appointment[] {
  const byLedger = new Map<string, AppointmentUpsale[]>();
  for (const appointment of list) {
    if (!appointment.ledger_id) continue;
    const rows = byLedger.get(appointment.ledger_id) ?? [];
    rows.push(...appointment.upsales);
    byLedger.set(appointment.ledger_id, rows);
  }
  return list.map((appointment) => ({
    ...appointment,
    ledger: appointment.ledger
      ? {
          ...appointment.ledger,
          upsales: byLedger.get(appointment.ledger.id) ?? [],
        }
      : null,
  }));
}

/** Tổng đã trả của một khách qua danh sách lịch hẹn: Σ Đã thu của các SỔ khác
 *  nhau (nhiều lịch chung sổ KHÔNG cộng trùng) + dòng mồ côi của lịch không sổ. */
export function customerTotalPaid(list: Appointment[]): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const a of list) {
    if (a.ledger) {
      if (seen.has(a.ledger.id)) continue;
      seen.add(a.ledger.id);
      sum += ledgerPaid(a.ledger);
    } else {
      sum += sumPayments(a.payments);
    }
  }
  return sum;
}

/** Mọi dòng tiền của một khách qua danh sách lịch hẹn: gom theo các SỔ khác
 *  nhau (nhiều lịch chung sổ KHÔNG lặp dòng) + dòng gắn lịch không sổ; kèm
 *  service_id của sổ để gắn nhãn dịch vụ. Mới nhất trước. */
export function customerPayments(
  list: Appointment[],
): { payment: AppointmentPayment; service_id: string | null }[] {
  const seen = new Set<string>();
  const rows: { payment: AppointmentPayment; service_id: string | null }[] = [];
  for (const a of list) {
    if (a.ledger) {
      if (seen.has(a.ledger.id)) continue;
      seen.add(a.ledger.id);
      for (const p of a.ledger.payments)
        rows.push({ payment: p, service_id: a.ledger.service_id });
    } else {
      for (const p of a.payments) rows.push({ payment: p, service_id: null });
    }
  }
  return rows.sort((x, y) => byPaidAtDesc(x.payment, y.payment));
}

export interface AppointmentFilters {
  waiting?: boolean; // tab Chờ xếp lịch: scheduled_at null, chưa hủy
  day?: string; // YYYY-MM-DD — ngày local của scheduled_at
  search?: string; // tên/phone khách
  status?: string;
  technicianId?: string;
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
  if (f.technicianId && a.technician_id !== f.technicianId) return false;
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
