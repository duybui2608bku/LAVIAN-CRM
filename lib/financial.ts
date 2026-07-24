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

export type FinancialUpsaleRow = {
  amount: number | string;
};

export interface FinancialMetrics {
  revenue: number;
  upsalesRevenue: number;
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
    upsalesRevenue: getGrowthRate(
      current.upsalesRevenue,
      previous.upsalesRevenue,
    ),
    collected: getGrowthRate(current.collected, previous.collected),
    outstanding: getGrowthRate(current.outstanding, previous.outstanding),
    aov: getGrowthRate(current.aov, previous.aov),
    orderCount: getGrowthRate(current.orderCount, previous.orderCount),
  };
}

export type SalesStaffRow = {
  id: string;
  user_name: string;
  department: string | null;
};

export type SalesCustomerRow = {
  id: string;
  sales_id: string | null;
};

export type SalesLedgerRow = {
  customer_id: string;
  total_amount: number | string | null;
};

export interface SalesPerformance {
  salesId: string;
  userName: string;
  customers: number;
  closedCustomers: number;
  closeRate: number; // %
  revenue: number;
  billCount: number;
  aov: number;
}

/**
 * Doanh số theo nhân viên Sales: cohort khách TẠO trong kỳ (customers),
 * bill = sổ service_ledgers ĐÃ báo giá (total_amount not null) của khách đó — trọn đời.
 * Danh sách sales = profiles department 'sales' ∪ sales_id xuất hiện trong cohort.
 */
export function calculateSalesPerformance(
  staff: SalesStaffRow[],
  customers: SalesCustomerRow[],
  ledgers: SalesLedgerRow[],
): SalesPerformance[] {
  const byCustomer = new Map<string, { revenue: number; bills: number }>();
  for (const ledger of ledgers) {
    if (
      ledger.total_amount === null ||
      !Number.isFinite(Number(ledger.total_amount))
    )
      continue;
    const acc = byCustomer.get(ledger.customer_id) ?? { revenue: 0, bills: 0 };
    acc.revenue += Number(ledger.total_amount);
    acc.bills += 1;
    byCustomer.set(ledger.customer_id, acc);
  }

  const assignedIds = new Set(
    customers.flatMap((c) => (c.sales_id ? [c.sales_id] : [])),
  );
  const rows = staff
    .filter((s) => s.department === "sales" || assignedIds.has(s.id))
    .map((s) => {
      const own = customers.filter((c) => c.sales_id === s.id);
      let revenue = 0;
      let billCount = 0;
      let closedCustomers = 0;
      for (const c of own) {
        const acc = byCustomer.get(c.id);
        if (!acc) continue;
        revenue += acc.revenue;
        billCount += acc.bills;
        closedCustomers += 1;
      }
      return {
        salesId: s.id,
        userName: s.user_name,
        customers: own.length,
        closedCustomers,
        closeRate: own.length === 0 ? 0 : (closedCustomers / own.length) * 100,
        revenue,
        billCount,
        aov: billCount === 0 ? 0 : revenue / billCount,
      };
    });

  return rows.sort(
    (a, b) => b.revenue - a.revenue || a.userName.localeCompare(b.userName),
  );
}

export type ServiceStatsServiceRow = {
  id: string;
  name_vi: string;
  name_en: string | null;
  name_id: string | null;
  is_active: boolean;
};

/** Một dòng `customer_services` của khách TẠO trong kỳ. */
export type ServiceDataRow = { service_id: string };

/** Một lượt lịch hẹn có `scheduled_at` trong kỳ (đã join `appointment_services`). */
export type ServiceAppointmentRow = {
  service_id: string;
  checked_in_at: string | null;
};

/** Sổ `service_ledgers` tạo trong kỳ. */
export type ServiceLedgerStatRow = {
  service_id: string;
  total_amount: number | string | null;
};

/** Record `appointment_upsales` tạo trong kỳ — `service_id` là dịch vụ ĐƯỢC bán thêm. */
export type ServiceUpsaleRow = { service_id: string; amount: number | string };

export interface ServiceStats {
  serviceId: string;
  name_vi: string;
  name_en: string | null;
  name_id: string | null;
  isActive: boolean;
  data: number;
  booked: number;
  arrived: number;
  revenue: number; // baseRevenue + upsalesRevenue
  baseRevenue: number;
  upsalesRevenue: number;
  orderCount: number;
  aov: number;
}

/**
 * Thống kê theo từng dịch vụ. Doanh thu LUÔN gồm upsales; upsale tính cho dịch
 * vụ được bán thêm (`service_id` của chính record), không phải dịch vụ gốc của lịch.
 * `orderCount` = sổ đã báo giá + record upsale — nếu chỉ đếm sổ thì dịch vụ chỉ
 * được upsale sẽ có doanh thu > 0 mà AOV chia 0.
 */
export function calculateServiceStats(
  services: ServiceStatsServiceRow[],
  dataRows: ServiceDataRow[],
  appointments: ServiceAppointmentRow[],
  ledgers: ServiceLedgerStatRow[],
  upsales: ServiceUpsaleRow[],
): ServiceStats[] {
  const count = (rows: { service_id: string }[]) => {
    const map = new Map<string, number>();
    for (const row of rows)
      map.set(row.service_id, (map.get(row.service_id) ?? 0) + 1);
    return map;
  };

  const dataCount = count(dataRows);
  const bookedCount = count(appointments);
  const arrivedCount = count(appointments.filter((a) => a.checked_in_at));

  const base = new Map<string, { revenue: number; orders: number }>();
  for (const ledger of ledgers) {
    if (
      ledger.total_amount === null ||
      !Number.isFinite(Number(ledger.total_amount))
    )
      continue;
    const acc = base.get(ledger.service_id) ?? { revenue: 0, orders: 0 };
    acc.revenue += Number(ledger.total_amount);
    acc.orders += 1;
    base.set(ledger.service_id, acc);
  }

  const upsale = new Map<string, { revenue: number; orders: number }>();
  for (const row of upsales) {
    if (!Number.isFinite(Number(row.amount))) continue;
    const acc = upsale.get(row.service_id) ?? { revenue: 0, orders: 0 };
    acc.revenue += Number(row.amount);
    acc.orders += 1;
    upsale.set(row.service_id, acc);
  }

  return services
    .map((service) => {
      const baseAcc = base.get(service.id) ?? { revenue: 0, orders: 0 };
      const upsaleAcc = upsale.get(service.id) ?? { revenue: 0, orders: 0 };
      const revenue = baseAcc.revenue + upsaleAcc.revenue;
      const orderCount = baseAcc.orders + upsaleAcc.orders;

      return {
        serviceId: service.id,
        name_vi: service.name_vi,
        name_en: service.name_en,
        name_id: service.name_id,
        isActive: service.is_active,
        data: dataCount.get(service.id) ?? 0,
        booked: bookedCount.get(service.id) ?? 0,
        arrived: arrivedCount.get(service.id) ?? 0,
        revenue,
        baseRevenue: baseAcc.revenue,
        upsalesRevenue: upsaleAcc.revenue,
        orderCount,
        aov: orderCount === 0 ? 0 : revenue / orderCount,
      };
    })
    .sort(
      (a, b) => b.revenue - a.revenue || a.name_vi.localeCompare(b.name_vi),
    );
}

export type SourceOptionRow = {
  value: string;
  label_vi: string;
  label_en: string | null;
  label_id: string | null;
  color: string | null;
  sort_order: number;
};

export type SourceCustomerRow = { source: string | null };

/** Một khoản tiền đã quy về nguồn của khách (sổ báo giá hoặc upsale). */
export type SourceAmountRow = {
  source: string | null;
  amount: number | string | null;
};

export interface SourceStats {
  source: string | null; // null = khách chưa gắn nguồn
  label_vi: string;
  label_en: string | null;
  label_id: string | null;
  color: string | null;
  data: number;
  revenue: number; // baseRevenue + upsalesRevenue
  baseRevenue: number;
  upsalesRevenue: number;
}

/**
 * Data + doanh thu theo NGUỒN khách hàng (vẽ biểu đồ tròn).
 * Nhãn/màu lấy từ `enum_options` kind 'source'; nguồn lạ (option đã xoá) giữ
 * nguyên giá trị thô làm nhãn, khách chưa gắn nguồn gom vào 1 dòng `source: null`.
 * Chỉ trả dòng CÓ phát sinh — pie không cần lát 0%.
 */
export function calculateSourceStats(
  options: SourceOptionRow[],
  customers: SourceCustomerRow[],
  baseAmounts: SourceAmountRow[],
  upsaleAmounts: SourceAmountRow[],
): SourceStats[] {
  const byOption = new Map(options.map((option) => [option.value, option]));
  const rows = new Map<string, SourceStats>();
  const NULL_KEY = " ";

  const rowFor = (source: string | null) => {
    const key = source ?? NULL_KEY;
    const existing = rows.get(key);
    if (existing) return existing;

    const option = source === null ? undefined : byOption.get(source);
    const created: SourceStats = {
      source,
      label_vi: option?.label_vi ?? source ?? "",
      label_en: option?.label_en ?? null,
      label_id: option?.label_id ?? null,
      color: option?.color ?? null,
      data: 0,
      revenue: 0,
      baseRevenue: 0,
      upsalesRevenue: 0,
    };
    rows.set(key, created);
    return created;
  };

  for (const customer of customers) rowFor(customer.source).data += 1;

  const addAmount = (list: SourceAmountRow[], field: "baseRevenue" | "upsalesRevenue") => {
    for (const item of list) {
      if (item.amount === null || !Number.isFinite(Number(item.amount))) continue;
      const row = rowFor(item.source);
      row[field] += Number(item.amount);
      row.revenue += Number(item.amount);
    }
  };
  addAmount(baseAmounts, "baseRevenue");
  addAmount(upsaleAmounts, "upsalesRevenue");

  const order = new Map(options.map((option) => [option.value, option.sort_order]));
  return [...rows.values()].sort(
    (a, b) =>
      b.revenue - a.revenue ||
      b.data - a.data ||
      (order.get(a.source ?? "") ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.source ?? "") ?? Number.MAX_SAFE_INTEGER),
  );
}

function signedAmount(payment: FinancialPaymentRow): number {
  const amount = Number(payment.amount);
  return payment.kind === "refund" ? -amount : amount;
}

/**
 * Doanh thu/AOV/Công nợ dùng cohort sổ tạo trong kỳ.
 * Doanh số upsales dùng các upsale được tạo trong kỳ.
 * Thực thu dùng mọi dòng tiền phát sinh trong kỳ.
 */
export function calculateFinancialMetrics(
  ledgers: FinancialLedgerRow[],
  lifetimeLedgerPayments: FinancialPaymentRow[],
  periodPayments: FinancialPaymentRow[],
  periodUpsales: FinancialUpsaleRow[],
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
  const upsalesRevenue = periodUpsales.reduce(
    (total, upsale) => total + Number(upsale.amount),
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
    upsalesRevenue,
    collected,
    outstanding,
    aov: orderCount === 0 ? 0 : revenue / orderCount,
    orderCount,
  };
}
