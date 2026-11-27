/**
 * Báo cáo /reports — hàm thuần (dùng được cả server lẫn client, có test).
 * Ngày là chuỗi `YYYY-MM-DD` theo giờ VN/WIB (UTC+7), số học Date.UTC — không dính timezone máy.
 * Định nghĩa Đặt cọc / Đặt lịch: lib/kpi.ts (dùng chung với Báo cáo Telesales + pipeline /customers).
 */
import { hasDeposit, vnDay } from "./kpi.ts";

export { vnDay };

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

export type ReportSources = {
  /** null = FB lỗi. Ngày không có trong map = 0. */
  fb: Map<string, { spend: number; messages: number }> | null;
  /** Khách tạo trong khoảng (Data); Đặt cọc = trong số đó có tiền cọc > 0. null = DB lỗi. */
  customers: { id: string; created_at: string; deposit_amount: number | null }[] | null;
  /** Lịch hẹn (ngày tạo) — Đặt lịch = số lịch TẠO trong ngày. null = DB lỗi. */
  appointments: { created_at: string }[] | null;
  /** Tiền thu ở thẻ liệu trình (thẻ chưa huỷ): cọc trừ vào thẻ theo giờ bán thẻ + từng lần thu (âm = hoàn) theo giờ thu. */
  money: { at: string; amount: number }[] | null;
};

/** Dựng dòng theo ngày cho khoảng [from, to] (tăng dần). Đặt cọc tính trong số Data của ngày; Đặt lịch = lịch tạo trong ngày. */
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
      bookings: src.appointments ? 0 : null,
      revenue: src.money ? 0 : null,
    });
  }
  for (const c of src.customers ?? []) {
    const row = rows.get(vnDay(c.created_at));
    if (!row) continue;
    row.data! += 1;
    if (hasDeposit(c.deposit_amount)) row.deposits! += 1;
  }
  for (const a of src.appointments ?? []) {
    const row = rows.get(vnDay(a.created_at));
    if (row) row.bookings! += 1;
  }
  for (const m of src.money ?? []) {
    const row = rows.get(vnDay(m.at));
    if (row) row.revenue! += m.amount;
  }
  return [...rows.values()];
}

/** Hoa hồng Sales (sếp chốt 2026-11-22) = 5% tiền thực thu của thẻ, tính cho người tạo thẻ. */
export const SALES_RATE = 0.05;

/** Tiền thực thu theo Sales trong kỳ [from, to] (ngày VN): cọc trừ vào thẻ + các lần thu; hoàn tiền (âm) trừ ngược. */
export function salesCommission(money: { at: string; amount: number; seller: string }[], from: string, to: string) {
  const by = new Map<string, number>();
  for (const m of money) {
    const day = vnDay(m.at);
    if (day >= from && day <= to) by.set(m.seller, (by.get(m.seller) ?? 0) + m.amount);
  }
  return [...by].map(([seller, collected]) => ({ seller, collected, commission: Math.round(collected * SALES_RATE) }))
    .sort((a, b) => b.collected - a.collected);
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
