// Mốc ngày nhanh cho mọi bộ lọc khoảng ngày (báo cáo, marketing, khách hàng, lịch hẹn).
// Thuần chuỗi `YYYY-MM-DD` + số học Date.UTC → không phụ thuộc timezone máy; `today` do nơi gọi truyền vào.

export const DATE_PRESETS = [
  "today",
  "yesterday",
  "thisWeek",
  "lastWeek",
  "last7",
  "last30",
  "thisMonth",
  "lastMonth",
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];
export type DateRange = { from: string; to: string };

const p2 = (n: number) => String(n).padStart(2, "0");
const parts = (ymd: string) => ymd.split("-").map(Number) as [number, number, number];
const fmt = (t: Date) => `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

export function shiftDays(ymd: string, n: number): string {
  const [y, m, d] = parts(ymd);
  return fmt(utc(y, m, d + n));
}

/** Khoảng ngày của 1 mốc. Tuần bắt đầu thứ Hai. */
export function presetRange(preset: DatePreset, today: string): DateRange {
  const [y, m, d] = parts(today);
  // getUTCDay: 0 = CN … 6 = T7 → số ngày lùi về thứ Hai.
  const sinceMonday = (utc(y, m, d).getUTCDay() + 6) % 7;
  const monday = shiftDays(today, -sinceMonday);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y1 = shiftDays(today, -1);
      return { from: y1, to: y1 };
    }
    case "thisWeek":
      return { from: monday, to: today };
    case "lastWeek":
      return { from: shiftDays(monday, -7), to: shiftDays(monday, -1) };
    case "last7":
      return { from: shiftDays(today, -6), to: today };
    case "last30":
      return { from: shiftDays(today, -29), to: today };
    case "thisMonth":
      return { from: fmt(utc(y, m, 1)), to: today };
    case "lastMonth":
      return { from: fmt(utc(y, m - 1, 1)), to: fmt(utc(y, m, 0)) };
  }
}

/** Mốc khớp đúng khoảng đang chọn (null = tuỳ chỉnh). Mốc đầu tiên khớp thắng (vd. Thứ Hai: Hôm nay ≡ Tuần này). */
export function matchPreset(range: DateRange, today: string): DatePreset | null {
  return (
    DATE_PRESETS.find((p) => {
      const r = presetRange(p, today);
      return r.from === range.from && r.to === range.to;
    }) ?? null
  );
}
