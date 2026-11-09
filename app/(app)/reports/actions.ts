"use server";

import { requireAdmin } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { fetchFbAdsDaily, supaRange } from "@/lib/marketing";
import { buildDays, dayCount, previousRange, type DayRow } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;
const PAGE = 1000; // PostgREST trả tối đa 1000 dòng/lần

export interface Report {
  /** Currency tài khoản ads (vd. "IDR"); null khi FB lỗi. */
  currency: string | null;
  /** Kỳ đang xem + kỳ liền trước cùng số ngày, tăng dần theo ngày. */
  rows: DayRow[];
  previous: { from: string; to: string };
  errors: { fb?: string; db?: string };
  error?: string;
}

/** Đọc hết các trang của 1 query Supabase (dữ liệu cả năm có thể > 1000 dòng). */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += PAGE) {
    const { data, error } = await page(i, i + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** Báo cáo theo khoảng ngày VN `YYYY-MM-DD` (kèm kỳ trước để so sánh). */
export async function getReport(from: string, to: string): Promise<Report> {
  await requireAdmin();
  const previous = YMD_RE.test(from) && YMD_RE.test(to) ? previousRange(from, to) : { from, to };
  const report: Report = { currency: null, rows: [], previous, errors: {} };
  if (!YMD_RE.test(from) || !YMD_RE.test(to) || from > to)
    return { ...report, error: "Khoảng ngày không hợp lệ." };
  if (dayCount(from, to) > MAX_DAYS)
    return { ...report, error: `Chọn tối đa ${MAX_DAYS} ngày.` };

  const start = previous.from;
  const supabase = await createClient();
  const range = supaRange(start, to);

  const [fb, customers, booked, tours] = await Promise.allSettled([
    fetchFbAdsDaily(start, to),
    fetchAll<{ id: string; created_at: string; stage: string }>((a, b) =>
      supabase
        .from("customers")
        .select("id, created_at, stage")
        .is("deleted_at", null)
        .gte("created_at", range.start)
        .lt("created_at", range.end)
        .order("created_at")
        .range(a, b),
    ),
    fetchAll<{ customer_id: string }>((a, b) =>
      supabase
        .from("clinic_appointments")
        .select("customer_id")
        .is("deleted_at", null)
        .order("id")
        .range(a, b),
    ),
    fetchAll<{ tour_date: string; bill_amount: number | null }>((a, b) =>
      supabase
        .from("tours")
        .select("tour_date, bill_amount")
        .is("deleted_at", null)
        .gte("tour_date", start)
        .lte("tour_date", to)
        .order("id")
        .range(a, b),
    ),
  ]);

  if (fb.status === "fulfilled") report.currency = fb.value.currency;
  else report.errors.fb = normalizeError(fb.reason).message;
  const dbError = [customers, booked, tours].find((r) => r.status === "rejected");
  if (dbError) report.errors.db = normalizeError(dbError.reason).message;

  report.rows = buildDays(start, to, {
    fb: fb.status === "fulfilled" ? fb.value.days : null,
    customers: customers.status === "fulfilled" ? customers.value : null,
    bookedIds: booked.status === "fulfilled" ? new Set(booked.value.map((r) => r.customer_id)) : null,
    tours: tours.status === "fulfilled" ? tours.value : null,
  });
  return report;
}
