import { requireAdmin } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import {
  getGrowthRate,
  getPreviousFinancialRange,
  isValidDateRange,
} from "@/lib/financial";
import { fetchSmaxStats, supaRange } from "@/lib/marketing";
import { createClient } from "@/lib/supabase/server";

const TIME_ZONE = "Asia/Ho_Chi_Minh";

type FunnelMetric = {
  count: number;
  previousCount: number;
  growthPercent: number;
} | null;

type CountResult = { count: number | null; error: unknown };

function metric(count: number, previousCount: number): FunnelMetric {
  return {
    count,
    previousCount,
    growthPercent: getGrowthRate(count, previousCount),
  };
}

/** Lấy count từ 1 cặp kết quả allSettled của Supabase; lỗi thì ném để nhánh gọi gom vào errors.db. */
function settledCount(result: PromiseSettledResult<CountResult>): number {
  if (result.status === "rejected") throw result.reason;
  if (result.value.error) throw result.value.error;
  return result.value.count ?? 0;
}

/** Phễu khách hàng theo khoảng ngày (mặc định hôm nay VN): nhắn tin / để lại SĐT /
 *  lịch hẹn / đã đến — mỗi chỉ số kèm growth so cùng kỳ liền trước, lỗi cô lập theo nguồn. */
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || today;
    const to = searchParams.get("to") || from;
    if (!isValidDateRange(from, to)) {
      return Response.json(
        {
          error: {
            code: "INVALID_DATE_RANGE",
            message:
              "from và to phải là ngày hợp lệ dạng YYYY-MM-DD, với from không sau to.",
          },
        },
        { status: 400 },
      );
    }
    const previous = getPreviousFinancialRange(from, to);

    const supabase = await createClient();
    const appointmentCount = (fromDay: string, toDay: string) => {
      const range = supaRange(fromDay, toDay);
      return supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("scheduled_at", range.start)
        .lt("scheduled_at", range.end);
    };
    const visitedCount = (fromDay: string, toDay: string) => {
      const range = supaRange(fromDay, toDay);
      return supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("stage", "visited")
        .gte("created_at", range.start)
        .lt("created_at", range.end);
    };

    const [smaxCur, smaxPrev, apptCur, apptPrev, visCur, visPrev] =
      await Promise.allSettled([
        fetchSmaxStats(from, to),
        fetchSmaxStats(previous.from, previous.to),
        appointmentCount(from, to),
        appointmentCount(previous.from, previous.to),
        visitedCount(from, to),
        visitedCount(previous.from, previous.to),
      ]);

    const data: Record<
      "messages" | "leads" | "appointments" | "visited",
      FunnelMetric
    > = { messages: null, leads: null, appointments: null, visited: null };
    const errors: { smax?: string; db?: string } = {};

    if (smaxCur.status === "fulfilled" && smaxPrev.status === "fulfilled") {
      data.messages = metric(smaxCur.value.messages, smaxPrev.value.messages);
      data.leads = metric(smaxCur.value.leads, smaxPrev.value.leads);
    } else {
      errors.smax = normalizeError(
        smaxCur.status === "rejected"
          ? smaxCur.reason
          : (smaxPrev as PromiseRejectedResult).reason,
      ).message;
    }

    try {
      data.appointments = metric(settledCount(apptCur), settledCount(apptPrev));
      data.visited = metric(settledCount(visCur), settledCount(visPrev));
    } catch (dbError) {
      data.appointments = null;
      data.visited = null;
      errors.db = normalizeError(dbError).message;
    }

    return Response.json({
      data,
      errors,
      period: { from, to, previous, today, timezone: TIME_ZONE },
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return Response.json(
      { error: { code: normalized.code, message: normalized.message } },
      { status: normalized.status ?? 500 },
    );
  }
}
