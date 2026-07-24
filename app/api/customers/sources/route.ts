import { requireAdmin } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import {
  calculateSourceStats,
  FINANCIAL_TIME_ZONE,
  isValidDateRange,
  type SourceAmountRow,
  type SourceCustomerRow,
  type SourceOptionRow,
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

/** Quan hệ nhiều-một PostgREST trả object, vài shape trả mảng 1 phần tử. */
function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type LedgerRow = {
  total_amount: number | string | null;
  customers: { source: string | null } | { source: string | null }[] | null;
};

type UpsaleRow = {
  amount: number | string | null;
  appointments:
    | { customers: { source: string | null } | { source: string | null }[] | null }
    | { customers: { source: string | null } | { source: string | null }[] | null }[]
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

    const [options, customers, ledgers, upsales] = await Promise.all([
      // Kể cả option đã tắt: khách cũ vẫn cần nhãn + màu.
      fetchPaged<SourceOptionRow>((start, end) =>
        supabase
          .from("enum_options")
          .select("value, label_vi, label_en, label_id, color, sort_order")
          .eq("kind", "source")
          .order("sort_order")
          .order("value")
          .range(start, end),
      ),
      // Data = khách TẠO trong kỳ, chưa xóa mềm.
      fetchPaged<SourceCustomerRow & { id: string }>((start, end) =>
        supabase
          .from("customers")
          .select("id, source")
          .is("deleted_at", null)
          .gte("created_at", range.start)
          .lt("created_at", range.end)
          .order("id")
          .range(start, end),
      ),
      // Doanh thu gốc = sổ tạo trong kỳ, quy về nguồn của khách sở hữu sổ.
      fetchPaged<LedgerRow>((start, end) =>
        supabase
          .from("service_ledgers")
          .select("total_amount, customers!inner(source)")
          .gte("created_at", range.start)
          .lt("created_at", range.end)
          .order("id")
          .range(start, end),
      ),
      // Upsale tạo trong kỳ → lịch hẹn → khách → nguồn.
      fetchPaged<UpsaleRow>((start, end) =>
        supabase
          .from("appointment_upsales")
          .select("amount, appointments!inner(customers!inner(source))")
          .gte("created_at", range.start)
          .lt("created_at", range.end)
          .order("id")
          .range(start, end),
      ),
    ]);

    const baseAmounts: SourceAmountRow[] = ledgers.map((row) => ({
      source: one(row.customers)?.source ?? null,
      amount: row.total_amount,
    }));
    const upsaleAmounts: SourceAmountRow[] = upsales.map((row) => ({
      source: one(one(row.appointments)?.customers ?? null)?.source ?? null,
      amount: row.amount,
    }));

    const data = calculateSourceStats(
      options,
      customers,
      baseAmounts,
      upsaleAmounts,
    );

    return Response.json({
      data,
      totals: data.reduce(
        (total, row) => ({
          data: total.data + row.data,
          revenue: total.revenue + row.revenue,
        }),
        { data: 0, revenue: 0 },
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
