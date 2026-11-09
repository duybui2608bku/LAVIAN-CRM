/**
 * Báo cáo /reports — hàm thuần (dùng được cả server lẫn client, có test).
 * Ngày là chuỗi `YYYY-MM-DD` theo giờ VN/WIB (UTC+7), số học Date.UTC — không dính timezone máy.
 */

/** Từ "Đã đặt cọc" trở về sau trong phễu (dùng chung với pipeline /customers). */
export const DEPOSITED_OR_LATER = new Set(["deposited", "booked", "visited", "returning"]);
/** Giai đoạn chắc chắn đã đặt lịch (kể cả khi chưa nhập lịch hẹn vào hệ thống). */
const BOOKED_OR_LATER = new Set(["booked", "visited", "returning"]);

export const METRICS = [
  "spend",
  "messages",
  "costPerMessage",
  "data",
  "costPerData",
  "deposits",
  "bookings",
  "revenue",
] as const;
export type Metric = (typeof METRICS)[number];

/** Chỉ số tiền theo currency FB; doanh thu là Rupiah. */
export const AD_MONEY: ReadonlySet<Metric> = new Set(["spend", "costPerMessage", "costPerData"]);
/** Chỉ số chi phí: giảm = tốt. */
export const LOWER_IS_BETTER: ReadonlySet<Metric> = new Set(["costPerMessage", "costPerData"]);

/** Dòng 1 ngày. `null` = nguồn lỗi. */
export type DayRow = {
  date: string;
  spend: number | null;
  messages: number | null;
  data: number | null;
  deposits: number | null;
  bookings: number | null;
  revenue: number | null;
};
type Base = Omit<DayRow, "date">;
export type Totals = Record<Metric, number | null>;

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  const p = (x: number) => String(x).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

/** Số ngày của khoảng [from, to] (tính cả 2 đầu). */
export function dayCount(from: string, to: string): number {
  const ms = (s: string) => Date.parse(`${s}T00:00:00Z`);
  return Math.round((ms(to) - ms(from)) / 86_400_000) + 1;
}

/** Kỳ liền trước cùng số ngày. */
export function previousRange(from: string, to: string) {
  const n = dayCount(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

/** Timestamp ISO → ngày theo UTC+7. */
export function vnDay(iso: string): string {
  return new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);
}

export type ReportSources = {
  /** null = FB lỗi. Ngày không có trong map = 0. */
  fb: Map<string, { spend: number; messages: number }> | null;
  /** null = DB lỗi. */
  customers: { id: string; created_at: string; stage: string }[] | null;
  /** Khách có ≥ 1 lịch hẹn. */
  bookedIds: Set<string> | null;
  tours: { tour_date: string; bill_amount: number | null }[] | null;
};

/** Dựng dòng theo ngày cho khoảng [from, to] (tăng dần). Đặt cọc/Đặt lịch tính dồn trong số Data của ngày đó. */
export function buildDays(from: string, to: string, src: ReportSources): DayRow[] {
  const rows = new Map<string, DayRow>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const fb = src.fb?.get(d);
    rows.set(d, {
      date: d,
      spend: src.fb ? (fb?.spend ?? 0) : null,
      messages: src.fb ? (fb?.messages ?? 0) : null,
      data: src.customers ? 0 : null,
      deposits: src.customers ? 0 : null,
      bookings: src.customers && src.bookedIds ? 0 : null,
      revenue: src.tours ? 0 : null,
    });
  }
  for (const c of src.customers ?? []) {
    const row = rows.get(vnDay(c.created_at));
    if (!row) continue;
    row.data! += 1;
    if (DEPOSITED_OR_LATER.has(c.stage)) row.deposits! += 1;
    if (row.bookings != null && (src.bookedIds!.has(c.id) || BOOKED_OR_LATER.has(c.stage)))
      row.bookings += 1;
  }
  for (const t of src.tours ?? []) {
    const row = rows.get(t.tour_date);
    if (row) row.revenue! += t.bill_amount ?? 0;
  }
  return [...rows.values()];
}

/** Chia an toàn: thiếu số hoặc mẫu 0 → null ("—"). */
export const ratio = (a: number | null, b: number | null) =>
  a != null && b ? a / b : null;

const sum = (rows: DayRow[], k: keyof Base) =>
  rows.some((r) => r[k] == null) ? null : rows.reduce((s, r) => s + (r[k] as number), 0);

/** Tổng 8 chỉ số của các dòng (1 dòng = chỉ số của chính ngày đó). */
export function totals(rows: DayRow[]): Totals {
  const spend = sum(rows, "spend");
  const messages = sum(rows, "messages");
  const data = sum(rows, "data");
  return {
    spend,
    messages,
    costPerMessage: ratio(spend, messages),
    data,
    costPerData: ratio(spend, data),
    deposits: sum(rows, "deposits"),
    bookings: sum(rows, "bookings"),
    revenue: sum(rows, "revenue"),
  };
}

/** % thay đổi so với kỳ trước; kỳ trước 0/thiếu → null (không hiện). */
export function change(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / prev;
}
