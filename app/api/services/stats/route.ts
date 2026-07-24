import { requireAdmin } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import {
  calculateServiceStats,
  FINANCIAL_TIME_ZONE,
  isValidDateRange,
  type ServiceAppointmentRow,
  type ServiceDataRow,
  type ServiceLedgerStatRow,
  type ServiceStatsServiceRow,
  type ServiceUpsaleRow,
} from "@/lib/financial";
import { supaRange } from "@/lib/marketing";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1_000;

/** Đọc hết bảng theo trang — PostgREST trả tối đa 1.000 row mỗi request. */
async function fetchPaged<T>(
  page: (from: number, to: number) => PromiseLike<{
    data: unknown;
    error: unknown;
  }>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    const chunk = (data ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) return rows;
  }
}

/** Lịch hẹn nhúng: PostgREST trả object cho quan hệ nhiều-một, mảng ở vài shape. */
type EmbeddedAppointmentRow = {
  service_id: string;
  appointments:
    | { checked_in_at: string | null }
    | { checked_in_at: string | null }[]
    | null;
};

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";
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

    const supabase = await createClient();
    const range = supaRange(from, to);

    const [services, dataRows, appointmentRows, ledgers, upsales] =
      await Promise.all([
        // Cả dịch vụ đã tắt: vẫn phải xem được số liệu lịch sử.
        fetchPaged<ServiceStatsServiceRow>((start, end) =>
          supabase
            .from("services")
            .select("id, name_vi, name_en, name_id, is_active")
            .order("sort_order")
            .order("id")
            .range(start, end),
        ),
        // Data = khách TẠO trong kỳ có gắn dịch vụ (PK kép nên mỗi khách 1 dòng/dịch vụ).
        fetchPaged<ServiceDataRow>((start, end) =>
          supabase
            .from("customer_services")
            .select("service_id, customers!inner(created_at, deleted_at)")
            .is("customers.deleted_at", null)
            .gte("customers.created_at", range.start)
            .lt("customers.created_at", range.end)
            .order("customer_id")
            .order("service_id")
            .range(start, end),
        ),
        // Chốt lịch = lượt lịch hẹn có ngày hẹn trong kỳ (mọi status).
        fetchPaged<EmbeddedAppointmentRow>((start, end) =>
          supabase
            .from("appointment_services")
            .select(
              "service_id, appointments!inner(checked_in_at, scheduled_at, deleted_at)",
            )
            .is("appointments.deleted_at", null)
            .gte("appointments.scheduled_at", range.start)
            .lt("appointments.scheduled_at", range.end)
            .order("appointment_id")
            .order("service_id")
            .range(start, end),
        ),
        fetchPaged<ServiceLedgerStatRow>((start, end) =>
          supabase
            .from("service_ledgers")
            .select("service_id, total_amount")
            .gte("created_at", range.start)
            .lt("created_at", range.end)
            .order("id")
            .range(start, end),
        ),
        fetchPaged<ServiceUpsaleRow>((start, end) =>
          supabase
            .from("appointment_upsales")
            .select("service_id, amount")
            .gte("created_at", range.start)
            .lt("created_at", range.end)
            .order("id")
            .range(start, end),
        ),
      ]);

    const appointments: ServiceAppointmentRow[] = appointmentRows.map((row) => {
      const appointment = Array.isArray(row.appointments)
        ? row.appointments[0]
        : row.appointments;
      return {
        service_id: row.service_id,
        checked_in_at: appointment?.checked_in_at ?? null,
      };
    });

    return Response.json({
      data: calculateServiceStats(
        services,
        dataRows,
        appointments,
        ledgers,
        upsales,
      ),
      currency: "IDR",
      period: {
        from,
        to,
        timezone: FINANCIAL_TIME_ZONE,
        start: range.start,
        endExclusive: range.end,
      },
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return Response.json(
      {
        error: {
          code: normalized.code,
          message: normalized.message,
        },
      },
      { status: normalized.status ?? 500 },
    );
  }
}
