import { requireAdmin } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import {
  calculateSalesPerformance,
  FINANCIAL_TIME_ZONE,
  isValidDateRange,
  type SalesCustomerRow,
  type SalesLedgerRow,
  type SalesStaffRow,
} from "@/lib/financial";
import { supaRange } from "@/lib/marketing";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1_000;
const CUSTOMER_BATCH_SIZE = 200;

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Cohort: khách chưa xóa mềm, TẠO trong kỳ (đã quy đổi giờ VN). */
async function getCohortCustomers(
  supabase: SupabaseClient,
  start: string,
  end: string,
): Promise<SalesCustomerRow[]> {
  const rows: SalesCustomerRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, sales_id")
      .is("deleted_at", null)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    const page = (data ?? []) as SalesCustomerRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** Mọi sổ (trọn đời) của các khách trong cohort — helper tự lọc sổ đã báo giá. */
async function getCustomerLedgers(
  supabase: SupabaseClient,
  customerIds: string[],
): Promise<SalesLedgerRow[]> {
  const rows: SalesLedgerRow[] = [];

  for (let index = 0; index < customerIds.length; index += CUSTOMER_BATCH_SIZE) {
    const ids = customerIds.slice(index, index + CUSTOMER_BATCH_SIZE);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("service_ledgers")
        .select("customer_id, total_amount")
        .in("customer_id", ids)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;

      const page = (data ?? []) as SalesLedgerRow[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }

  return rows;
}

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
    const [staffRes, customers] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, user_name, department")
        .order("user_name"),
      getCohortCustomers(supabase, range.start, range.end),
    ]);
    if (staffRes.error) throw staffRes.error;
    const ledgers = await getCustomerLedgers(
      supabase,
      customers.map((c) => c.id),
    );

    return Response.json({
      data: calculateSalesPerformance(
        (staffRes.data as SalesStaffRow[]) ?? [],
        customers,
        ledgers,
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
