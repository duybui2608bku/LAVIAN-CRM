import { requireAdmin } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import {
  calculateFinancialGrowth,
  calculateFinancialMetrics,
  FINANCIAL_TIME_ZONE,
  getPreviousFinancialRange,
  isValidDateRange,
  type FinancialMetrics,
  type FinancialLedgerRow,
  type FinancialPaymentRow,
  type FinancialUpsaleRow,
} from "@/lib/financial";
import { supaRange } from "@/lib/marketing";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1_000;
const LEDGER_BATCH_SIZE = 200;

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function getPeriodLedgers(
  supabase: SupabaseClient,
  start: string,
  end: string,
): Promise<FinancialLedgerRow[]> {
  const rows: FinancialLedgerRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("service_ledgers")
      .select("id, total_amount")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    const page = (data ?? []) as FinancialLedgerRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function getPeriodPayments(
  supabase: SupabaseClient,
  start: string,
  end: string,
): Promise<FinancialPaymentRow[]> {
  const rows: FinancialPaymentRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("appointment_payments")
      .select("ledger_id, kind, amount")
      .gte("paid_at", start)
      .lt("paid_at", end)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    const page = (data ?? []) as FinancialPaymentRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function getPeriodUpsales(
  supabase: SupabaseClient,
  start: string,
  end: string,
): Promise<FinancialUpsaleRow[]> {
  const rows: FinancialUpsaleRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("appointment_upsales")
      .select("amount")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    const page = (data ?? []) as FinancialUpsaleRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function getLifetimeLedgerPayments(
  supabase: SupabaseClient,
  ledgerIds: string[],
): Promise<FinancialPaymentRow[]> {
  const rows: FinancialPaymentRow[] = [];

  for (let index = 0; index < ledgerIds.length; index += LEDGER_BATCH_SIZE) {
    const ids = ledgerIds.slice(index, index + LEDGER_BATCH_SIZE);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("appointment_payments")
        .select("ledger_id, kind, amount")
        .in("ledger_id", ids)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;

      const page = (data ?? []) as FinancialPaymentRow[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }

  return rows;
}

async function getMetrics(
  supabase: SupabaseClient,
  from: string,
  to: string,
): Promise<FinancialMetrics> {
  const range = supaRange(from, to);
  const [ledgers, periodPayments, periodUpsales] = await Promise.all([
    getPeriodLedgers(supabase, range.start, range.end),
    getPeriodPayments(supabase, range.start, range.end),
    getPeriodUpsales(supabase, range.start, range.end),
  ]);
  const lifetimeLedgerPayments = await getLifetimeLedgerPayments(
    supabase,
    ledgers.map((ledger) => ledger.id),
  );

  return calculateFinancialMetrics(
    ledgers,
    lifetimeLedgerPayments,
    periodPayments,
    periodUpsales,
  );
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
    const previousPeriod = getPreviousFinancialRange(from, to);
    const [metrics, previousMetrics] = await Promise.all([
      getMetrics(supabase, from, to),
      getMetrics(supabase, previousPeriod.from, previousPeriod.to),
    ]);

    return Response.json({
      data: {
        ...metrics,
        currency: "IDR",
      },
      period: {
        from,
        to,
        timezone: FINANCIAL_TIME_ZONE,
        start: range.start,
        endExclusive: range.end,
      },
      comparison: {
        period: {
          ...previousPeriod,
          timezone: FINANCIAL_TIME_ZONE,
          start: supaRange(previousPeriod.from, previousPeriod.to).start,
          endExclusive: supaRange(previousPeriod.from, previousPeriod.to).end,
        },
        data: {
          ...previousMetrics,
          currency: "IDR",
        },
        growthPercent: calculateFinancialGrowth(metrics, previousMetrics),
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
