import { normalizeError } from "@/lib/errors";
import { isValidDateRange } from "@/lib/financial";
import { addDays, supaRange } from "@/lib/marketing";
import { createClient } from "@/lib/supabase/server";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const DAYS = 7;

/** Xu hướng 7 ngày gần nhất (kết thúc ở `to`, mặc định hôm nay giờ VN) cho biểu đồ cột:
 *  Data (khách tạo trong ngày) / Lịch hẹn (theo ngày hẹn) / Khách đến (theo giờ check-in).
 *  Gác đăng nhập như /api/appointments/summary — chỉ là count, không có số tiền, và
 *  RLS đã cho mọi user đăng nhập đọc customers/appointments. */
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

    const to = new URL(request.url).searchParams.get("to") || today;
    if (!isValidDateRange(to, to)) {
      return Response.json(
        {
          error: {
            code: "INVALID_DATE_RANGE",
            message: "to phải là ngày hợp lệ dạng YYYY-MM-DD.",
          },
        },
        { status: 400 },
      );
    }

    const from = addDays(to, -(DAYS - 1));
    const days = Array.from({ length: DAYS }, (_, index) =>
      addDays(from, index),
    );

    const customerCount = (day: string) => {
      const range = supaRange(day, day);
      return supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", range.start)
        .lt("created_at", range.end);
    };
    const appointmentCount = (
      day: string,
      column: "scheduled_at" | "checked_in_at",
    ) => {
      const range = supaRange(day, day);
      return supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte(column, range.start)
        .lt(column, range.end);
    };

    // ponytail: 21 head-count nhỏ thay vì kéo row về gom theo ngày — không truyền row,
    // không dính trần 1.000 row của PostgREST. Cần 30–90 ngày thì đổi sang RPC group by.
    const results = await Promise.all(
      days.flatMap((day) => [
        customerCount(day),
        appointmentCount(day, "scheduled_at"),
        appointmentCount(day, "checked_in_at"),
      ]),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;

    const data = days.map((date, index) => {
      const [customers, appointments, visited] = results
        .slice(index * 3, index * 3 + 3)
        .map((result) => result.count ?? 0);
      return { date, data: customers, appointments, visited };
    });

    return Response.json({
      data,
      period: { from, to, days: DAYS, today, timezone: TIME_ZONE },
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return Response.json(
      { error: { code: normalized.code, message: normalized.message } },
      { status: normalized.status ?? 500 },
    );
  }
}
