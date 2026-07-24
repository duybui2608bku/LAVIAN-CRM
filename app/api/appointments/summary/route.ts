import {
  getGrowthRate,
  getPreviousFinancialRange,
  isValidDateRange,
} from "@/lib/financial";
import { addDays, supaRange } from "@/lib/marketing";
import { normalizeError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

const TIME_ZONE = "Asia/Ho_Chi_Minh";

function metric(count: number, previousCount: number, deposited?: number) {
  return {
    count,
    previousCount,
    growthPercent: getGrowthRate(count, previousCount),
    ...(deposited == null
      ? {}
      : { deposited, notDeposited: count - deposited }),
  };
}

/** Thống kê lịch hẹn: `selected`/`newCustomer` theo khoảng `from`/`to` (mặc định hôm nay
 *  giờ VN), `tomorrow` cố định ngày mai VN — mỗi chỉ số kèm growth so cùng kỳ liền trước. */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Chưa đăng nhập." } },
        { status: 401 },
      );
    }

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const tomorrow = addDays(today, 1);

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

    const scheduledCount = (fromDay: string, toDay: string) => {
      const range = supaRange(fromDay, toDay);
      return supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("scheduled_at", range.start)
        .lt("scheduled_at", range.end);
    };
    // "Lịch hẹn trong ngày": lịch TẠO trong kỳ của khách cũng TẠO trong kỳ (khách mới).
    const newCustomerCount = (fromDay: string, toDay: string) => {
      const range = supaRange(fromDay, toDay);
      return supabase
        .from("appointments")
        .select("id, customers!inner(id)", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", range.start)
        .lt("created_at", range.end)
        .is("customers.deleted_at", null)
        .gte("customers.created_at", range.start)
        .lt("customers.created_at", range.end);
    };

    // Lịch có ≥1 payment kind deposit (khớp appointmentBreakdown của getMarketingStats)
    // — head-count qua !inner nên không dính trần 1.000 row.
    const scheduledDeposited = (fromDay: string, toDay: string) => {
      const range = supaRange(fromDay, toDay);
      return supabase
        .from("appointments")
        .select("id, appointment_payments!inner(id)", {
          count: "exact",
          head: true,
        })
        .is("deleted_at", null)
        .gte("scheduled_at", range.start)
        .lt("scheduled_at", range.end)
        .eq("appointment_payments.kind", "deposit");
    };
    const newCustomerDeposited = (fromDay: string, toDay: string) => {
      const range = supaRange(fromDay, toDay);
      return supabase
        .from("appointments")
        .select("id, customers!inner(id), appointment_payments!inner(id)", {
          count: "exact",
          head: true,
        })
        .is("deleted_at", null)
        .gte("created_at", range.start)
        .lt("created_at", range.end)
        .is("customers.deleted_at", null)
        .gte("customers.created_at", range.start)
        .lt("customers.created_at", range.end)
        .eq("appointment_payments.kind", "deposit");
    };

    const results = await Promise.all([
      scheduledCount(from, to),
      scheduledCount(previous.from, previous.to),
      newCustomerCount(from, to),
      newCustomerCount(previous.from, previous.to),
      scheduledCount(tomorrow, tomorrow),
      // Cùng kỳ của "ngày mai" luôn là hôm nay VN — khoảng chọn có thể là ngày khác.
      scheduledCount(today, today),
      // Deposit chỉ cần cho kỳ hiện tại (card không hiện breakdown kỳ trước).
      scheduledDeposited(from, to),
      newCustomerDeposited(from, to),
      scheduledDeposited(tomorrow, tomorrow),
    ]);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    const [
      selectedCount,
      previousSelected,
      newCount,
      previousNew,
      tomorrowCount,
      todayCount,
      selectedDeposited,
      newDeposited,
      tomorrowDeposited,
    ] = results.map((result) => result.count ?? 0);

    return Response.json({
      data: {
        selected: metric(selectedCount, previousSelected, selectedDeposited),
        newCustomer: metric(newCount, previousNew, newDeposited),
        tomorrow: metric(tomorrowCount, todayCount, tomorrowDeposited),
      },
      period: {
        from,
        to,
        previous,
        today,
        tomorrow,
        timezone: TIME_ZONE,
      },
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return Response.json(
      { error: { code: normalized.code, message: normalized.message } },
      { status: normalized.status ?? 500 },
    );
  }
}
