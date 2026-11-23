"use server";

import { requirePermission } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { fetchFbAdsDaily, supaRange } from "@/lib/marketing";
import { buildDays, dayCount, previousRange, salesCommission, type DayRow } from "@/lib/reports";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;
type Seller = { user_name: string } | null;

export interface Report {
  /** Currency tài khoản ads (vd. "IDR"); null khi FB lỗi. */
  currency: string | null;
  /** Kỳ đang xem + kỳ liền trước cùng số ngày, tăng dần theo ngày. */
  rows: DayRow[];
  /** Hoa hồng Sales kỳ đang xem (5% tiền thực thu, theo người tạo thẻ); null = DB lỗi. */
  sales: ReturnType<typeof salesCommission> | null;
  previous: { from: string; to: string };
  errors: { fb?: string; db?: string };
  error?: string;
}

/** Báo cáo theo khoảng ngày VN `YYYY-MM-DD` (kèm kỳ trước để so sánh). */
export async function getReport(from: string, to: string): Promise<Report> {
  await requirePermission("reports.view");
  const previous = YMD_RE.test(from) && YMD_RE.test(to) ? previousRange(from, to) : { from, to };
  const report: Report = { currency: null, rows: [], sales: null, previous, errors: {} };
  if (!YMD_RE.test(from) || !YMD_RE.test(to) || from > to)
    return { ...report, error: "Khoảng ngày không hợp lệ." };
  if (dayCount(from, to) > MAX_DAYS)
    return { ...report, error: `Chọn tối đa ${MAX_DAYS} ngày.` };

  const start = previous.from;
  const supabase = await createClient();
  const range = supaRange(start, to);

  const [fb, customers, booked, cards, payments, refunds] = await Promise.allSettled([
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
    // Doanh thu = tiền thu ở thẻ liệu trình (Đã thu = cọc trừ vào thẻ + các lần thu), bỏ thẻ đã huỷ. Kèm người tạo thẻ (hoa hồng Sales).
    fetchAll((a, b) =>
      supabase
        .from("treatment_cards")
        .select("created_at, deposit_used, seller:profiles!created_by(user_name)")
        .is("cancelled_at", null)
        .gt("deposit_used", 0)
        .gte("created_at", range.start)
        .lt("created_at", range.end)
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("treatment_card_payments")
        .select("paid_at, amount, card:treatment_cards!inner(cancelled_at, seller:profiles!created_by(user_name))")
        .is("card.cancelled_at", null)
        .gte("paid_at", range.start)
        .lt("paid_at", range.end)
        .order("id")
        .range(a, b),
    ),
    // Hoàn cả thẻ: trừ doanh thu vào ngày hoàn.
    fetchAll((a, b) =>
      supabase
        .from("treatment_cards")
        .select("refunded_at, refund_amount, seller:profiles!created_by(user_name)")
        .is("cancelled_at", null)
        .gt("refund_amount", 0)
        .gte("refunded_at", range.start)
        .lt("refunded_at", range.end)
        .order("id")
        .range(a, b),
    ),
  ]);

  if (fb.status === "fulfilled") report.currency = fb.value.currency;
  else report.errors.fb = normalizeError(fb.reason).message;
  const dbError = [customers, booked, cards, payments, refunds].find((r) => r.status === "rejected");
  if (dbError) report.errors.db = normalizeError(dbError.reason).message;

  // Join many-to-one trả object (kiểu suy ra của supabase-js là mảng).
  const money = cards.status === "fulfilled" && payments.status === "fulfilled" && refunds.status === "fulfilled" ? [
    ...(cards.value as unknown as { created_at: string; deposit_used: number; seller: Seller }[])
      .map((c) => ({ at: c.created_at, amount: c.deposit_used, seller: c.seller?.user_name ?? "—" })),
    ...(payments.value as unknown as { paid_at: string; amount: number; card: { seller: Seller } }[])
      .map((p) => ({ at: p.paid_at, amount: p.amount, seller: p.card.seller?.user_name ?? "—" })),
    ...(refunds.value as unknown as { refunded_at: string; refund_amount: number; seller: Seller }[])
      .map((c) => ({ at: c.refunded_at, amount: -c.refund_amount, seller: c.seller?.user_name ?? "—" })),
  ] : null;
  report.rows = buildDays(start, to, {
    fb: fb.status === "fulfilled" ? fb.value.days : null,
    customers: customers.status === "fulfilled" ? customers.value : null,
    bookedIds: booked.status === "fulfilled" ? new Set(booked.value.map((r) => r.customer_id)) : null,
    money,
  });
  report.sales = money && salesCommission(money, from, to);
  return report;
}
