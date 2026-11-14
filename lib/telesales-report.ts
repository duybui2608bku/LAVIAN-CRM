/**
 * Báo cáo Leader Telesales (/reports/telesales) — hàm thuần, có test (lib/telesales-report.test.ts).
 * Ngày là chuỗi `YYYY-MM-DD` theo giờ VN/WIB (UTC+7). Không import runtime từ file khác (node --test).
 *
 * Định nghĩa (kỳ = [from, to]):
 *  - Booking       = lịch có NGÀY TẠO trong kỳ.
 *  - Booking mới   = booking mà khách được TẠO trong kỳ.
 *  - Đã xác nhận / Khách hủy / Đổi lịch = booking theo trạng thái `booking_confirm`.
 *  - Lịch hẹn      = lịch có NGÀY HẸN trong kỳ; Khách đến = trong số đó đã check-in.
 *  - Show-up       = Khách đến / Lịch hẹn.
 */
import type { BookingStatus } from "@/types/appointment";

/** KPI tỉ lệ booking / hội thoại của Telesales. */
export const KPI_BOOKING_RATE = 0.12;

export type TelesalesAppointment = {
  id: string;
  created_at: string;
  scheduled_at: string;
  booking_confirm: BookingStatus;
  checked_in: boolean;
  staff_id: string | null;
  customer: { created_at: string; source: string | null };
};

export type TelesalesStaff = { id: string; user_name: string; avatar_url: string | null; smax_user_id: string | null };

export type PeriodStats = {
  /** Tin nhắn FB Ads; null = FB lỗi. */
  messages: number | null;
  bookings: number;
  newBookings: number;
  confirmed: number;
  cancelled: number;
  rescheduled: number;
  scheduled: number;
  arrived: number;
};

export type DayStat = { date: string; bookings: number; arrived: number };
/** Nguồn cố định thứ tự (màu theo nguồn, không theo hạng). */
export const BOOKING_SOURCES = ["instagrams", "whatsapp", "other"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export type StaffCounts = { bookings: number; scheduled: number; arrived: number };
export type StaffPerf = StaffCounts & {
  id: string;
  name: string;
  avatar_url: string | null;
  /** Hội thoại xử lý trên SMAX; null = chưa ghép ID SMAX hoặc SMAX lỗi. */
  conversations: number | null;
};

export type TelesalesReportData = {
  cur: PeriodStats;
  prev: PeriodStats;
  days: DayStat[];
  sources: Record<BookingSource, number>;
  staff: StaffPerf[];
  /** Booking/lịch hẹn của người ngoài danh sách Telesales hoặc chưa gán; null = không có. */
  other: StaffCounts | null;
};

/** Timestamp ISO → ngày theo UTC+7. */
export function vnDay(iso: string): string {
  return new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const inPeriod = (day: string, from: string, to: string) => day >= from && day <= to;

function periodStats(
  appts: readonly TelesalesAppointment[],
  fb: ReadonlyMap<string, number> | null,
  from: string,
  to: string,
): PeriodStats {
  const s: PeriodStats = {
    messages: null,
    bookings: 0,
    newBookings: 0,
    confirmed: 0,
    cancelled: 0,
    rescheduled: 0,
    scheduled: 0,
    arrived: 0,
  };
  if (fb) {
    s.messages = 0;
    for (const [day, n] of fb) if (inPeriod(day, from, to)) s.messages += n;
  }
  for (const a of appts) {
    if (inPeriod(vnDay(a.created_at), from, to)) {
      s.bookings++;
      if (inPeriod(vnDay(a.customer.created_at), from, to)) s.newBookings++;
      if (a.booking_confirm === "confirmed") s.confirmed++;
      else if (a.booking_confirm === "cancelled") s.cancelled++;
      else if (a.booking_confirm === "rescheduled") s.rescheduled++;
    }
    if (inPeriod(vnDay(a.scheduled_at), from, to)) {
      s.scheduled++;
      if (a.checked_in) s.arrived++;
    }
  }
  return s;
}

const sourceOf = (s: string | null): BookingSource =>
  s === "instagrams" || s === "whatsapp" ? s : "other";

export function buildTelesalesReport(input: {
  from: string;
  to: string;
  prev: { from: string; to: string };
  appointments: readonly TelesalesAppointment[];
  /** Tin nhắn FB theo ngày; null = FB lỗi. */
  fb: ReadonlyMap<string, number> | null;
  /** Hội thoại SMAX theo user_id; null = SMAX lỗi. */
  handled: ReadonlyMap<string, number> | null;
  staff: readonly TelesalesStaff[];
}): TelesalesReportData {
  const { from, to, appointments } = input;
  // Lịch trùng id (2 truy vấn created/scheduled gộp lại) chỉ đếm 1 lần.
  const appts = [...new Map(appointments.map((a) => [a.id, a])).values()];

  const days: DayStat[] = [];
  const dayIndex = new Map<string, DayStat>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const row = { date: d, bookings: 0, arrived: 0 };
    days.push(row);
    dayIndex.set(d, row);
  }

  const sources: Record<BookingSource, number> = { instagrams: 0, whatsapp: 0, other: 0 };
  const counts = new Map<string, StaffCounts>(input.staff.map((s) => [s.id, { bookings: 0, scheduled: 0, arrived: 0 }]));
  const other: StaffCounts = { bookings: 0, scheduled: 0, arrived: 0 };
  const bucket = (staffId: string | null) => (staffId && counts.get(staffId)) || other;

  for (const a of appts) {
    const created = vnDay(a.created_at);
    if (inPeriod(created, from, to)) {
      dayIndex.get(created)!.bookings++;
      sources[sourceOf(a.customer.source)]++;
      bucket(a.staff_id).bookings++;
    }
    const scheduled = vnDay(a.scheduled_at);
    if (inPeriod(scheduled, from, to)) {
      const b = bucket(a.staff_id);
      b.scheduled++;
      if (a.checked_in) {
        b.arrived++;
        dayIndex.get(scheduled)!.arrived++;
      }
    }
  }

  return {
    cur: periodStats(appts, input.fb, from, to),
    prev: periodStats(appts, input.fb, input.prev.from, input.prev.to),
    days,
    sources,
    staff: input.staff.map((s) => ({
      id: s.id,
      name: s.user_name,
      avatar_url: s.avatar_url,
      conversations: s.smax_user_id && input.handled ? (input.handled.get(s.smax_user_id) ?? 0) : null,
      ...counts.get(s.id)!,
    })),
    other: other.bookings || other.scheduled ? other : null,
  };
}

/**
 * Tổng bảng nhân viên (gồm dòng "Khác"). Hội thoại = tổng các NV đã ghép SMAX (null nếu không ai có số);
 * `convBookings` = booking của chính các NV đó → tỉ lệ booking/KPI dòng Tổng không bị booking "Khác" làm lệch.
 */
export function staffTotals(staff: readonly StaffPerf[], other: StaffCounts | null) {
  const rows: StaffCounts[] = [...staff, ...(other ? [other] : [])];
  const withConv = staff.filter((s) => s.conversations != null);
  return {
    conversations: withConv.length ? withConv.reduce((n, s) => n + s.conversations!, 0) : null,
    convBookings: withConv.reduce((n, s) => n + s.bookings, 0),
    bookings: rows.reduce((n, r) => n + r.bookings, 0),
    scheduled: rows.reduce((n, r) => n + r.scheduled, 0),
    arrived: rows.reduce((n, r) => n + r.arrived, 0),
  };
}

/** Tỉ lệ hoàn thành KPI = tỉ lệ booking / KPI (null khi chưa có hội thoại). */
export function kpiCompletion(bookings: number, conversations: number | null): number | null {
  return conversations ? bookings / conversations / KPI_BOOKING_RATE : null;
}
