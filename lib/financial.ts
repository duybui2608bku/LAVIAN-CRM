export const FINANCIAL_TIME_ZONE = "Asia/Ho_Chi_Minh";

export type FinancialLedgerRow = {
  id: string;
  total_amount: number | string | null;
};

export type FinancialPaymentRow = {
  ledger_id?: string | null;
  kind: "deposit" | "payment" | "refund";
  amount: number | string;
};

export interface FinancialMetrics {
  revenue: number;
  collected: number;
  outstanding: number;
  aov: number;
  orderCount: number;
}

export type FinancialGrowth = {
  [Key in keyof FinancialMetrics]: number;
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Kiểm tra ngày lịch thực, không chỉ kiểm tra hình dạng `YYYY-MM-DD`. */
export function isValidDateRange(from: string, to: string): boolean {
  const isValidDay = (value: string) => {
    if (!YMD_RE.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  };

  return isValidDay(from) && isValidDay(to) && from <= to;
}

/** Kỳ liền trước, liên tục và có cùng số ngày với kỳ đang chọn. */
export function getPreviousFinancialRange(from: string, to: string) {
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  const duration = toTime - fromTime + 86_400_000;
  const previousToTime = fromTime - 86_400_000;
  const previousFromTime = previousToTime - duration + 86_400_000;
  const ymd = (time: number) => new Date(time).toISOString().slice(0, 10);

  return {
    from: ymd(previousFromTime),
    to: ymd(previousToTime),
  };
}

export function getGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function calculateFinancialGrowth(
  current: FinancialMetrics,
  previous: FinancialMetrics,
): FinancialGrowth {
  return {
    revenue: getGrowthRate(current.revenue, previous.revenue),
    collected: getGrowthRate(current.collected, previous.collected),
    outstanding: getGrowthRate(current.outstanding, previous.outstanding),
    aov: getGrowthRate(current.aov, previous.aov),
    orderCount: getGrowthRate(current.orderCount, previous.orderCount),
  };
}

function signedAmount(payment: FinancialPaymentRow): number {
  const amount = Number(payment.amount);
  return payment.kind === "refund" ? -amount : amount;
}

/**
 * Doanh thu/AOV/Công nợ dùng cohort sổ tạo trong kỳ.
 * Thực thu dùng mọi dòng tiền phát sinh trong kỳ.
 */
export function calculateFinancialMetrics(
  ledgers: FinancialLedgerRow[],
  lifetimeLedgerPayments: FinancialPaymentRow[],
  periodPayments: FinancialPaymentRow[],
): FinancialMetrics {
  const quotedLedgers = ledgers.filter(
    (ledger) =>
      ledger.total_amount !== null &&
      Number.isFinite(Number(ledger.total_amount)),
  );
  const revenue = quotedLedgers.reduce(
    (total, ledger) => total + Number(ledger.total_amount),
    0,
  );

  const paidByLedger = new Map<string, number>();
  for (const payment of lifetimeLedgerPayments) {
    if (!payment.ledger_id) continue;
    paidByLedger.set(
      payment.ledger_id,
      (paidByLedger.get(payment.ledger_id) ?? 0) + signedAmount(payment),
    );
  }

  const outstanding = quotedLedgers.reduce(
    (total, ledger) =>
      total +
      Math.max(
        Number(ledger.total_amount) - (paidByLedger.get(ledger.id) ?? 0),
        0,
      ),
    0,
  );
  const collected = periodPayments.reduce(
    (total, payment) => total + signedAmount(payment),
    0,
  );
  const orderCount = quotedLedgers.length;

  return {
    revenue,
    collected,
    outstanding,
    aov: orderCount === 0 ? 0 : revenue / orderCount,
    orderCount,
  };
}
