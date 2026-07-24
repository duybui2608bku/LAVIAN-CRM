"use client";

import * as React from "react";
import {
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  Calculator,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  CircleDollarSign,
  HandCoins,
  MapPinCheck,
  MessageCircle,
  Phone,
  PieChart,
  ReceiptText,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { getMarketingStats, type DashboardStats } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";
import { formatRupiah, formatRupiahCompact } from "@/lib/currency";
import { formatISODate, parseISODate } from "@/lib/date";
import { DateRangePicker } from "@/components/common/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { optionLabel, serviceName } from "@/lib/customers";
import type { SalesPerformance, ServiceStats, SourceStats } from "@/lib/financial";

type CustomerCardKey =
  | "spend"
  | "costPerMessage"
  | "messages"
  | "leads"
  | "appointments"
  | "visited";

type FinancialMetricKey =
  | "financialRevenue"
  | "financialCollected"
  | "financialOutstanding"
  | "financialAov"
  | "financialUpsales";

interface ApiMetric {
  count: number;
  previousCount: number;
  growthPercent: number;
  deposited?: number;
  notDeposited?: number;
}

interface FunnelApiResponse {
  data: {
    messages: ApiMetric | null;
    leads: ApiMetric | null;
    appointments: ApiMetric | null;
    visited: ApiMetric | null;
  };
  errors: { smax?: string; db?: string };
  error?: { message?: string };
}

interface SummaryApiResponse {
  data: {
    selected: ApiMetric;
    newCustomer: ApiMetric;
    tomorrow: ApiMetric;
  };
  period: { from: string; to: string; today: string; tomorrow: string };
  error?: { message?: string };
}

interface TrendApiResponse {
  data: {
    date: string;
    data: number;
    appointments: number;
    visited: number;
  }[];
  period: { from: string; to: string; days: number };
  error?: { message?: string };
}

interface SalesApiResponse {
  data: SalesPerformance[];
  error?: { message?: string };
}

interface ServicesApiResponse {
  data: ServiceStats[];
  error?: { message?: string };
}

interface SourcesApiResponse {
  data: SourceStats[];
  totals: { data: number; revenue: number };
  error?: { message?: string };
}

interface FinancialApiResponse {
  data: {
    revenue: number;
    upsalesRevenue: number;
    collected: number;
    outstanding: number;
    aov: number;
    currency: string;
  };
  comparison: {
    growthPercent: {
      revenue: number;
      upsalesRevenue: number;
      collected: number;
      outstanding: number;
      aov: number;
    };
  };
  error?: {
    message?: string;
  };
}

/* Màu nhấn per metric — lấy từ design token nên tự đổi theo dark mode. */
const TINT: Record<CustomerCardKey, string> = {
  spend: "var(--destructive)",
  costPerMessage: "var(--warning)",
  messages: "var(--info)",
  leads: "var(--chart-5)",
  appointments: "var(--primary)",
  visited: "var(--success)",
};

const FINANCIAL_TINT: Record<FinancialMetricKey, string> = {
  financialRevenue: "var(--warning)",
  financialCollected: "var(--chart-4)",
  financialOutstanding: "var(--destructive)",
  financialAov: "var(--chart-5)",
  financialUpsales: "var(--success)",
};

const AVATAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function getPreviousRange(from: string, to: string) {
  const fromDate = parseISODate(from)!;
  const toDate = parseISODate(to)!;
  const numberOfDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  const previousTo = new Date(fromDate);
  previousTo.setDate(previousTo.getDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setDate(previousFrom.getDate() - numberOfDays + 1);
  return { from: formatISODate(previousFrom), to: formatISODate(previousTo) };
}

function getGrowthRate(current: number | null, previous: number | null) {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

async function fetchApi<T extends { error?: { message?: string } }>(
  url: string,
  fallbackMessage: string,
): Promise<{ stats: T | null; error: string | undefined }> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const payload = (await response.json()) as T;
    if (!response.ok) {
      throw new Error(payload.error?.message || fallbackMessage);
    }
    return { stats: payload, error: undefined };
  } catch (error) {
    return {
      stats: null,
      error: error instanceof Error ? error.message : fallbackMessage,
    };
  }
}

export function MarketingStats({
  showSpend = false,
  showFinancials = false,
  header,
}: {
  showSpend?: boolean;
  showFinancials?: boolean;
  header?: { title: string; description: string };
}) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const comparisonLabel = locale === "vi" ? "so với kỳ trước" : locale === "id" ? "vs periode sebelumnya" : "vs previous period";
  const today = formatISODate(new Date());
  const [range, setRange] = React.useState({ from: today, to: today });
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [previousStats, setPreviousStats] = React.useState<DashboardStats | null>(null);
  const [financialStats, setFinancialStats] =
    React.useState<FinancialApiResponse | null>(null);
  const [financialError, setFinancialError] = React.useState<string>();
  const [funnel, setFunnel] = React.useState<FunnelApiResponse | null>(null);
  const [funnelError, setFunnelError] = React.useState<string>();
  const [summary, setSummary] = React.useState<SummaryApiResponse | null>(null);
  const [summaryError, setSummaryError] = React.useState<string>();
  const [trend, setTrend] = React.useState<TrendApiResponse | null>(null);
  const [trendError, setTrendError] = React.useState<string>();
  const [sales, setSales] = React.useState<SalesApiResponse | null>(null);
  const [salesError, setSalesError] = React.useState<string>();
  const [services, setServices] = React.useState<ServicesApiResponse | null>(null);
  const [servicesError, setServicesError] = React.useState<string>();
  const [sources, setSources] = React.useState<SourcesApiResponse | null>(null);
  const [sourcesError, setSourcesError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const requestId = React.useRef(0);

  React.useEffect(() => {
    if (!range.from) return;
    const from = range.from;
    const to = range.to || range.from;
    const previousRange = getPreviousRange(from, to);
    const query = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const currentRequest = ++requestId.current;
    startTransition(async () => {
      const [
        current,
        previous,
        financial,
        funnelResult,
        summaryResult,
        trendResult,
        salesResult,
        servicesResult,
        sourcesResult,
      ] = await Promise.all([
          getMarketingStats(from, to, showSpend),
          // Kỳ trước chỉ còn phục vụ growth của 2 card spend.
          showSpend
            ? getMarketingStats(previousRange.from, previousRange.to, true)
            : Promise.resolve(null),
          showFinancials
            ? fetchApi<FinancialApiResponse>(
                `/api/finance/revenue${query}`,
                "Không thể tải số liệu doanh thu.",
              )
            : Promise.resolve({ stats: null, error: undefined }),
          fetchApi<FunnelApiResponse>(
            `/api/customers/funnel${query}`,
            "Không thể tải phễu khách hàng.",
          ),
          fetchApi<SummaryApiResponse>(
            `/api/appointments/summary${query}`,
            "Không thể tải thống kê lịch hẹn.",
          ),
          // Biểu đồ luôn là 7 ngày kết thúc ở ngày cuối của bộ lọc.
          fetchApi<TrendApiResponse>(
            `/api/appointments/trend?to=${encodeURIComponent(to)}`,
            "Không thể tải xu hướng 7 ngày.",
          ),
          fetchApi<SalesApiResponse>(
            `/api/sales/performance${query}`,
            "Không thể tải hiệu quả nhân viên sales.",
          ),
          fetchApi<ServicesApiResponse>(
            `/api/services/stats${query}`,
            "Không thể tải thống kê dịch vụ.",
          ),
          fetchApi<SourcesApiResponse>(
            `/api/customers/sources${query}`,
            "Không thể tải thống kê theo nguồn.",
          ),
        ]);
      if (currentRequest !== requestId.current) return;
      setStats(current);
      setPreviousStats(previous);
      setFinancialStats(financial.stats);
      setFinancialError(financial.error);
      setFunnel(funnelResult.stats);
      setFunnelError(funnelResult.error);
      setSummary(summaryResult.stats);
      setSummaryError(summaryResult.error);
      setTrend(trendResult.stats);
      setTrendError(trendResult.error);
      setSales(salesResult.stats);
      setSalesError(salesResult.error);
      setServices(servicesResult.stats);
      setServicesError(servicesResult.error);
      setSources(sourcesResult.stats);
      setSourcesError(sourcesResult.error);
    });
  }, [range, showFinancials, showSpend]);

  const num = (n: number | null) => (n == null ? null : n.toLocaleString(locale));
  const costPerMessage =
    stats?.spend != null && stats.messages != null && stats.messages > 0
      ? Math.round(stats.spend / stats.messages)
      : null;
  const previousCostPerMessage =
    previousStats?.spend != null && previousStats.messages != null && previousStats.messages > 0
      ? Math.round(previousStats.spend / previousStats.messages)
      : null;
  const spendCards: {
    key: CustomerCardKey;
    icon: LucideIcon;
    value: string | null;
    current: number | null;
    previous: number | null;
    error?: string;
  }[] = showSpend
    ? [
        {
          key: "spend",
          icon: CircleDollarSign,
          value: stats?.spend != null ? formatRupiah(stats.spend) : null,
          current: stats?.spend ?? null,
          previous: previousStats?.spend ?? null,
          error: stats?.errors.fb,
        },
        {
          key: "costPerMessage",
          icon: Calculator,
          value: costPerMessage != null ? formatRupiah(costPerMessage) : null,
          current: costPerMessage,
          previous: previousCostPerMessage,
          error: stats?.errors.fb ?? stats?.errors.smax,
        },
      ]
    : [];

  const funnelCards: {
    key: CustomerCardKey;
    icon: LucideIcon;
    metric: ApiMetric | null;
    error?: string;
  }[] = [
    { key: "messages", icon: MessageCircle, metric: funnel?.data.messages ?? null, error: funnel?.errors.smax },
    { key: "leads", icon: Phone, metric: funnel?.data.leads ?? null, error: funnel?.errors.smax },
    { key: "appointments", icon: CalendarCheck, metric: funnel?.data.appointments ?? null, error: funnel?.errors.db },
    { key: "visited", icon: MapPinCheck, metric: funnel?.data.visited ?? null, error: funnel?.errors.db },
  ];
  const messagesCount = funnel?.data.messages?.count ?? null;
  // % trên card phễu = tỉ lệ so bước đầu (Khách nhắn tin).
  const funnelShare = (count: number) =>
    messagesCount ? (count / messagesCount) * 100 : null;
  const totalConversion =
    messagesCount && funnel?.data.visited
      ? (funnel.data.visited.count / messagesCount) * 100
      : null;

  const financialCards: {
    key: FinancialMetricKey;
    icon: LucideIcon;
    value: number | undefined;
    growth: number | undefined;
  }[] = [
    {
      key: "financialRevenue",
      icon: HandCoins,
      value: financialStats?.data.revenue,
      growth: financialStats?.comparison.growthPercent.revenue,
    },
    {
      key: "financialCollected",
      icon: WalletCards,
      value: financialStats?.data.collected,
      growth: financialStats?.comparison.growthPercent.collected,
    },
    {
      key: "financialOutstanding",
      icon: ReceiptText,
      value: financialStats?.data.outstanding,
      growth: financialStats?.comparison.growthPercent.outstanding,
    },
    {
      key: "financialAov",
      icon: BadgeDollarSign,
      value: financialStats?.data.aov,
      growth: financialStats?.comparison.growthPercent.aov,
    },
    {
      key: "financialUpsales",
      icon: ArrowUpRight,
      value: financialStats?.data.upsalesRevenue,
      growth: financialStats?.comparison.growthPercent.upsalesRevenue,
    },
  ];

  // Label card "ngày chọn" tính từ period server trả (hôm nay giờ VN, không tin giờ máy client).
  const period = summary?.period;
  const formatDM = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
  const selectedLabel =
    !period || (period.from === period.today && period.to === period.today)
      ? t("todayAppointments")
      : t("appointmentsOn", {
          date:
            period.from === period.to
              ? formatDM(period.from)
              : `${formatDM(period.from)} – ${formatDM(period.to)}`,
        });

  const appointmentCards = [
    {
      key: "selected",
      label: selectedLabel,
      hint: undefined,
      icon: CalendarDays,
      tint: "var(--primary)",
      metric: summary?.data.selected ?? null,
      vsLabel: comparisonLabel,
    },
    {
      key: "newCustomer",
      label: t("newCustomerAppointments"),
      hint: t("newCustomerAppointmentsHint"),
      icon: CalendarClock,
      tint: "var(--info)",
      metric: summary?.data.newCustomer ?? null,
      vsLabel: comparisonLabel,
    },
    {
      key: "tomorrow",
      label: t("tomorrowAppointments"),
      hint: undefined,
      icon: CalendarPlus,
      tint: "var(--chart-5)",
      metric: summary?.data.tomorrow ?? null,
      // previousCount của "ngày mai" là hôm nay VN.
      vsLabel: t("vsToday"),
    },
  ];

  const trendSeries: TrendSeries[] = [
    { key: "data", label: t("serviceData"), color: "var(--info)" },
    { key: "appointments", label: t("appointments"), color: "var(--primary)" },
    { key: "visited", label: t("serviceArrived"), color: "var(--success)" },
  ];

  const value = (displayValue: string | null, loaded: boolean = !!stats) =>
    !loaded && pending ? (
      <span className="inline-block h-8 w-24 animate-pulse rounded-md bg-muted" />
    ) : (
      (displayValue ?? "—")
    );

  const replyTime = (seconds: number | null) => {
    if (seconds == null) return "—";
    const total = Math.round(seconds);
    const days = Math.floor(total / 86_400);
    const hours = Math.floor((total % 86_400) / 3_600);
    const minutes = Math.floor((total % 3_600) / 60);
    const remainingSeconds = total % 60;
    const parts = [
      days ? `${days}d` : "",
      hours ? `${hours}h` : "",
      minutes ? `${minutes}m` : "",
      remainingSeconds || total === 0 ? `${remainingSeconds}s` : "",
    ].filter(Boolean);
    return parts.slice(0, 2).join(" ");
  };

  // Hiệu quả + thời gian phản hồi trung bình ghép theo userId.
  // ponytail: staffStats là danh sách gốc — 2 nguồn SMAX cùng tập nhân viên.
  const replyAverages = new Map(
    (stats?.staffReplyTimes ?? []).map((row) => [row.userId, row.average] as const),
  );
  const staffRows = (stats?.staffStats ?? []).map((row) => ({
    ...row,
    replyAverage: replyAverages.get(row.userId) ?? null,
  }));
  const staffTotal = staffRows.reduce(
    (total, row) => ({
      customers: total.customers + row.customers,
      phoneLeads: total.phoneLeads + row.phoneLeads,
      whatsappLeads: total.whatsappLeads + row.whatsappLeads,
    }),
    { customers: 0, phoneLeads: 0, whatsappLeads: 0 },
  );

  const salesRows = sales?.data ?? [];
  const salesTotal = salesRows.reduce(
    (total, row) => ({
      customers: total.customers + row.customers,
      closed: total.closed + row.closedCustomers,
      revenue: total.revenue + row.revenue,
      bills: total.bills + row.billCount,
    }),
    { customers: 0, closed: 0, revenue: 0, bills: 0 },
  );

  // Chỉ hiện dịch vụ có phát sinh trong kỳ — API trả cả dịch vụ 0 số liệu.
  const serviceRows = (services?.data ?? []).filter(
    (row) => row.data > 0 || row.booked > 0 || row.orderCount > 0,
  );
  const servicesTotal = serviceRows.reduce(
    (total, row) => ({
      data: total.data + row.data,
      booked: total.booked + row.booked,
      arrived: total.arrived + row.arrived,
      revenue: total.revenue + row.revenue,
      orders: total.orders + row.orderCount,
    }),
    { data: 0, booked: 0, arrived: 0, revenue: 0, orders: 0 },
  );

  // Màu lát bánh lấy theo NGUỒN (enum_options.color) nên đổi bộ lọc không đổi màu.
  const sourceSlices = (sources?.data ?? []).map((row) => ({
    key: row.source ?? "__none__",
    label: row.source ? optionLabel(row, locale) : t("unknownSource"),
    color: row.color || "var(--muted-foreground)",
    data: row.data,
    revenue: row.revenue,
  }));

  return (
    <div className="space-y-8">
      <div
        className={cn(
          "flex gap-4",
          header
            ? "flex-col sm:flex-row sm:items-start sm:justify-between"
            : "items-center",
        )}
      >
        {header && (
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {header.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {header.description}
            </p>
          </div>
        )}
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <DateRangePicker
            from={range.from}
            to={range.to}
            onChange={(next) =>
              setRange(next.from ? next : { from: today, to: today })
            }
            placeholder={t("range")}
            clearLabel={t("clear")}
            className="w-full sm:w-64"
          />
          {(stats || financialStats) && pending && (
            <RefreshCw className="size-4 shrink-0 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {stats?.error && <p className="text-sm text-destructive">{stats.error}</p>}

      {showFinancials && (
        <section className="space-y-3">
          <div
            className={cn(
              "grid gap-3 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
              pending && "opacity-60",
            )}
          >
            {financialCards.map((card) => (
              <FinancialMetricCard
                key={card.key}
                label={t(card.key)}
                icon={card.icon}
                tint={FINANCIAL_TINT[card.key]}
                value={
                  card.value == null ? null : formatRupiah(card.value)
                }
                growth={card.growth ?? null}
                comparisonLabel={comparisonLabel}
                locale={locale}
                loading={!financialStats && pending}
              />
            ))}
          </div>
          {financialError && (
            <p className="text-sm text-destructive">{financialError}</p>
          )}
        </section>
      )}

      <section className="space-y-4">
        <SectionTitle icon={Users} tint="var(--primary)">{t("funnelSection")}</SectionTitle>
        {showSpend && (
          <div className={cn("grid gap-4 transition-opacity duration-200 sm:grid-cols-2", pending && "opacity-60")}>
            {spendCards.map((card) => (
              <MetricCard
                key={card.key}
                label={t(card.key)}
                icon={card.icon}
                tint={TINT[card.key]}
                value={value(card.value)}
                error={card.error}
                growth={getGrowthRate(card.current, card.previous)}
                comparisonLabel={comparisonLabel}
                locale={locale}
              />
            ))}
          </div>
        )}
        <div className={cn("flex flex-col gap-3 transition-opacity duration-200 xl:flex-row xl:items-stretch", pending && "opacity-60")}>
          {funnelCards.map((card, index) => (
            <React.Fragment key={card.key}>
              {index > 0 && (
                <ChevronRight className="hidden size-5 shrink-0 self-center text-muted-foreground/50 xl:block" />
              )}
              <div className="min-w-0 flex-1">
                <MetricCard
                  label={t(card.key)}
                  icon={card.icon}
                  tint={TINT[card.key]}
                  value={value(card.metric ? num(card.metric.count) : null, !!funnel)}
                  share={card.metric ? funnelShare(card.metric.count) : null}
                  error={card.error}
                  growth={card.metric?.growthPercent ?? null}
                  comparisonLabel={comparisonLabel}
                  locale={locale}
                />
              </div>
            </React.Fragment>
          ))}
        </div>
        {totalConversion != null && (
          <p className="text-center text-sm text-muted-foreground">
            {t("totalConversion", { from: t("messages"), to: t("visited") })}:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {totalConversion.toLocaleString(locale, { maximumFractionDigits: 1 })}%
            </span>
          </p>
        )}
        {funnelError && <p className="text-sm text-destructive">{funnelError}</p>}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-4">
          <SectionTitle icon={CalendarCheck} tint="var(--info)">{t("appointmentSection")}</SectionTitle>
          <div className={cn("grid gap-3 transition-opacity duration-200 sm:grid-cols-3", pending && "opacity-60")}>
            {appointmentCards.map((card) => {
              const total = card.metric?.count ?? null;
              const deposited = card.metric?.deposited ?? null;
              const pct = total && deposited != null ? Math.min(100, (deposited / total) * 100) : 0;
              return (
                // Card nén cho nửa hàng: hint chuyển sang title, deposit gộp 1 dòng.
                <div key={card.key} title={card.hint} className="rounded-xl border bg-card p-3 shadow-xs transition-shadow duration-200 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-xs font-medium text-muted-foreground">{card.label}</p>
                    <IconChip icon={card.icon} tint={card.tint} className="size-7 rounded-md" iconClassName="size-3.5" />
                  </div>
                  <div className="mt-1 text-xl font-bold tracking-tight tabular-nums">{value(num(total), !!summary)}</div>
                  {card.metric && (
                    <div className="mt-1.5">
                      <GrowthBadge growth={card.metric.growthPercent} label={card.vsLabel} locale={locale} />
                    </div>
                  )}
                  <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-success transition-[width] duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="size-1.5 shrink-0 rounded-full bg-success" />
                      <span className="truncate">{t("deposited")}</span>
                      <span className="font-semibold tabular-nums text-foreground">{num(deposited) ?? "—"}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                      <span className="truncate">{t("notDeposited")}</span>
                      <span className="font-semibold tabular-nums text-foreground">{num(card.metric?.notDeposited ?? null) ?? "—"}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {summaryError && <p className="text-sm text-destructive">{summaryError}</p>}
        </section>

        <section className="space-y-4">
          <SectionTitle icon={BarChart3} tint="var(--chart-2)">{t("trendSection")}</SectionTitle>
          <div className={cn("rounded-xl border bg-card p-4 shadow-xs transition-opacity duration-200", pending && "opacity-60")}>
            {trend ? (
              <TrendChart rows={trend.data} series={trendSeries} locale={locale} />
            ) : (
              <p className="flex h-44 items-center justify-center text-sm text-muted-foreground">
                {trendError ? "—" : t("loading")}
              </p>
            )}
          </div>
          {trendError && <p className="text-sm text-destructive">{trendError}</p>}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-4">
          <SectionTitle icon={UsersRound} tint="var(--success)">{t("staffSection")}</SectionTitle>
          <div className={cn("overflow-hidden rounded-xl border bg-card shadow-xs transition-opacity duration-200", pending && "opacity-60")}>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>{t("staffName")}</TableHead>
                  <TableHead className="text-right">{t("staffReplyAverage")}</TableHead>
                  <TableHead className="text-right">{t("staffCustomers")}</TableHead>
                  <TableHead className="text-right">{t("staffPhoneLeads")}</TableHead>
                  <TableHead className="text-right">{t("staffWhatsappLeads")}</TableHead>
                  <TableHead className="text-right">{t("staffPhoneRate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffRows.map((row, index) => (
                  <TableRow key={row.userId}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <InitialAvatar name={row.name} index={index} />
                        {row.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{replyTime(row.replyAverage)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.customers.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.phoneLeads.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.whatsappLeads.toLocaleString(locale)}</TableCell>
                    <TableCell>
                      <span className="flex items-center justify-end gap-2">
                        <span className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, row.phoneRate)}%` }}
                          />
                        </span>
                        <span className="tabular-nums">
                          {row.phoneRate.toLocaleString(locale, { maximumFractionDigits: 2 })}%
                        </span>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {!stats?.errors.staff && stats?.staffStats?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">{t("noStaffStats")}</TableCell>
                  </TableRow>
                )}
                {!stats && pending && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">{t("loading")}</TableCell>
                  </TableRow>
                )}
              </TableBody>
              {staffRows.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">{t("total")}</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{staffTotal.customers.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{staffTotal.phoneLeads.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{staffTotal.whatsappLeads.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
          {stats?.errors.staff && <p className="text-sm text-destructive">{stats.errors.staff}</p>}
          {stats?.errors.replyTime && <p className="text-sm text-destructive">{stats.errors.replyTime}</p>}
        </section>

        <section className="space-y-4">
          <SectionTitle icon={HandCoins} tint="var(--chart-4)">{t("salesSection")}</SectionTitle>
          <div className={cn("overflow-hidden rounded-xl border bg-card shadow-xs transition-opacity duration-200", pending && "opacity-60")}>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>{t("staffName")}</TableHead>
                  <TableHead className="text-right">{t("salesCustomers")}</TableHead>
                  <TableHead className="text-right">{t("revenue")}</TableHead>
                  <TableHead className="text-right">{t("salesAov")}</TableHead>
                  <TableHead className="text-right">{t("salesFailed")}</TableHead>
                  <TableHead className="text-right">{t("salesCloseRate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesRows.map((row, index) => (
                  <TableRow key={row.salesId}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <InitialAvatar name={row.userName} index={index} />
                        {row.userName}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.customers.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatRupiah(row.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(row.aov)}</TableCell>
                    <TableCell className="text-right tabular-nums">{(row.customers - row.closedCustomers).toLocaleString(locale)}</TableCell>
                    <TableCell>
                      <span className="flex items-center justify-end gap-2">
                        <span className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-success"
                            style={{ width: `${Math.min(100, row.closeRate)}%` }}
                          />
                        </span>
                        <span className="tabular-nums">
                          {row.closeRate.toLocaleString(locale, { maximumFractionDigits: 1 })}%
                        </span>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {!salesError && sales && salesRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">{t("noSalesStats")}</TableCell>
                  </TableRow>
                )}
                {!sales && pending && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">{t("loading")}</TableCell>
                  </TableRow>
                )}
              </TableBody>
              {salesRows.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">{t("total")}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{salesTotal.customers.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatRupiah(salesTotal.revenue)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatRupiah(salesTotal.bills === 0 ? 0 : salesTotal.revenue / salesTotal.bills)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {(salesTotal.customers - salesTotal.closed).toLocaleString(locale)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {(salesTotal.customers === 0
                        ? 0
                        : (salesTotal.closed / salesTotal.customers) * 100
                      ).toLocaleString(locale, { maximumFractionDigits: 1 })}%
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
          {salesError && <p className="text-sm text-destructive">{salesError}</p>}
        </section>

        <section className="space-y-4">
          <SectionTitle icon={Sparkles} tint="var(--chart-2)">{t("servicesSection")}</SectionTitle>
          <div className={cn("overflow-hidden rounded-xl border bg-card shadow-xs transition-opacity duration-200", pending && "opacity-60")}>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>{t("serviceCol")}</TableHead>
                  <TableHead className="text-right">{t("serviceData")}</TableHead>
                  <TableHead className="text-right">{t("serviceBooked")}</TableHead>
                  <TableHead className="text-right">{t("serviceArrived")}</TableHead>
                  <TableHead className="text-right">{t("revenue")}</TableHead>
                  <TableHead className="text-right">{t("salesAov")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceRows.map((row) => (
                  <TableRow key={row.serviceId}>
                    <TableCell className="font-medium">{serviceName(row, locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.data.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.booked.toLocaleString(locale)}</TableCell>
                    <TableCell>
                      <span className="flex items-center justify-end gap-2">
                        <span className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-success"
                            style={{ width: `${row.booked === 0 ? 0 : Math.min(100, (row.arrived / row.booked) * 100)}%` }}
                          />
                        </span>
                        <span className="tabular-nums">{row.arrived.toLocaleString(locale)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatRupiah(row.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(row.aov)}</TableCell>
                  </TableRow>
                ))}
                {!servicesError && services && serviceRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">{t("noServiceStats")}</TableCell>
                  </TableRow>
                )}
                {!services && pending && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">{t("loading")}</TableCell>
                  </TableRow>
                )}
              </TableBody>
              {serviceRows.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">{t("total")}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{servicesTotal.data.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{servicesTotal.booked.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{servicesTotal.arrived.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatRupiah(servicesTotal.revenue)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatRupiah(servicesTotal.orders === 0 ? 0 : servicesTotal.revenue / servicesTotal.orders)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
          {servicesError && <p className="text-sm text-destructive">{servicesError}</p>}
        </section>

        <section className="space-y-4">
          <SectionTitle icon={PieChart} tint="var(--chart-5)">{t("sourceSection")}</SectionTitle>
          <div className={cn("rounded-xl border bg-card p-4 shadow-xs transition-opacity duration-200", pending && "opacity-60")}>
            {sourceSlices.length === 0 ? (
              <p className="flex h-20 items-center justify-center text-sm text-muted-foreground">
                {sources || sourcesError ? t("noSourceStats") : t("loading")}
              </p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                <Donut
                  title={t("sourceDataChart")}
                  slices={[...sourceSlices].sort((a, b) => b.data - a.data)}
                  pick={(slice) => slice.data}
                  format={(value) => value.toLocaleString(locale)}
                  locale={locale}
                />
                <Donut
                  title={t("sourceRevenueChart")}
                  slices={[...sourceSlices].sort((a, b) => b.revenue - a.revenue)}
                  pick={(slice) => slice.revenue}
                  format={formatRupiah}
                  formatCenter={formatRupiahCompact}
                  locale={locale}
                />
              </div>
            )}
          </div>
          {sourcesError && <p className="text-sm text-destructive">{sourcesError}</p>}
        </section>
      </div>

    </div>
  );
}

/** Ô icon tô màu nhấn — nhận màu qua CSS var nên theme sáng/tối tự khớp. */
function IconChip({
  icon: Icon,
  tint,
  className,
  iconClassName,
}: {
  icon: LucideIcon;
  tint: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--tint)/12 text-(--tint) dark:bg-(--tint)/20",
        className,
      )}
      style={{ "--tint": tint } as React.CSSProperties}
    >
      <Icon className={cn("size-4.5", iconClassName)} />
    </span>
  );
}

function SectionTitle({ icon, tint, children }: { icon: LucideIcon; tint: string; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
      <IconChip icon={icon} tint={tint} className="size-7 rounded-md" iconClassName="size-4" />
      {children}
    </h2>
  );
}

/** Biểu đồ tròn thuần SVG — 2 donut không đáng để kéo thêm thư viện chart.
 *  Màu đi theo entity (nguồn), legend luôn có nhãn + số nên không nhận diện bằng màu đơn thuần. */
function Donut<T extends { key: string; label: string; color: string }>({
  title,
  slices,
  pick,
  format,
  formatCenter,
  locale,
}: {
  title: string;
  slices: T[];
  pick: (slice: T) => number;
  format: (value: number) => string;
  /** Tâm donut hẹp — mặc định dùng `format`, tiền thì truyền bản rút gọn. */
  formatCenter?: (value: number) => string;
  locale: string;
}) {
  const RADIUS = 42;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const GAP = 2; // khe hở giữa 2 lát cạnh nhau
  const rows = slices.filter((slice) => pick(slice) > 0);
  const total = rows.reduce((sum, slice) => sum + pick(slice), 0);
  const percent = (value: number) =>
    `${((value / total) * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  // Vị trí bắt đầu của mỗi lát = tổng độ dài các lát trước đó.
  const arcs = rows.reduce<{ slice: T; length: number; offset: number }[]>(
    (acc, slice) => {
      const previous = acc[acc.length - 1];
      return [
        ...acc,
        {
          slice,
          length: (pick(slice) / total) * CIRCUMFERENCE,
          offset: previous ? previous.offset + previous.length : 0,
        },
      ];
    },
    [],
  );

  return (
    <figure className="space-y-3">
      <figcaption className="text-sm font-medium text-muted-foreground">{title}</figcaption>
      <div className="flex justify-center">
        <div className="relative size-32">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={title}>
            <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--muted)" strokeWidth="12" />
            {arcs.map(({ slice, length, offset }) => {
              const drawn = Math.max(length - GAP, 0.5);
              return (
                <circle
                  key={slice.key}
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="12"
                  strokeDasharray={`${drawn} ${CIRCUMFERENCE - drawn}`}
                  strokeDashoffset={-offset}
                >
                  <title>{`${slice.label}: ${format(pick(slice))} (${percent(pick(slice))})`}</title>
                </circle>
              );
            })}
          </svg>
          <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-sm font-bold tabular-nums">
            {total === 0 ? "—" : (formatCenter ?? format)(total)}
          </span>
        </div>
      </div>
      <ul className="space-y-1.5">
        {rows.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
            <span className="truncate">{slice.label}</span>
            <span className="ml-auto shrink-0 font-medium tabular-nums">{format(pick(slice))}</span>
            <span className="w-12 shrink-0 text-right text-muted-foreground tabular-nums">{percent(pick(slice))}</span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="text-sm text-muted-foreground">—</li>
        )}
      </ul>
    </figure>
  );
}

type TrendRow = TrendApiResponse["data"][number];
type TrendSeries = {
  key: "data" | "appointments" | "visited";
  label: string;
  color: string;
};

/** Biểu đồ cột nhóm 7 ngày — 21 cột thuần CSS, không đáng kéo thêm thư viện chart.
 *  Cột nào cũng có nhãn chữ (legend + aria-label) nên không nhận diện bằng màu đơn thuần. */
function TrendChart({
  rows,
  series,
  locale,
}: {
  rows: TrendRow[];
  series: TrendSeries[];
  locale: string;
}) {
  const max = Math.max(1, ...rows.flatMap((row) => series.map((s) => row[s.key])));
  const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </figcaption>
      <div className="flex h-40 items-end gap-1.5">
        {rows.map((row) => (
          <div key={row.date} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5">
            {series.map((s) => {
              const text = `${s.label} ${dayLabel(row.date)}: ${row[s.key].toLocaleString(locale)}`;
              return (
                <span
                  key={s.key}
                  role="img"
                  aria-label={text}
                  title={text}
                  className="w-full rounded-t-sm transition-[height] duration-300"
                  style={{
                    background: s.color,
                    // Cột 0 vẫn để lại vạch mảnh — thấy ngày đó có mặt, chỉ là không có số.
                    height: row[s.key] === 0 ? "2px" : `${(row[s.key] / max) * 100}%`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {rows.map((row) => (
          <span
            key={row.date}
            className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground tabular-nums"
          >
            {dayLabel(row.date)}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Avatar chữ cái đầu (SMAX không trả avatar) — tên VN lấy chữ đầu của tên gọi (từ cuối). */
function InitialAvatar({ name, index }: { name: string; index: number }) {
  const initial = (name.trim().split(/\s+/).pop() ?? "").charAt(0).toUpperCase() || "?";
  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
    >
      {initial}
    </span>
  );
}

function GrowthBadge({
  growth,
  label,
  locale,
}: {
  growth: number;
  label: string;
  locale: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums",
          growth > 0 && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          growth < 0 && "bg-red-500/10 text-red-600 dark:text-red-400",
          growth === 0 && "bg-muted text-muted-foreground",
        )}
      >
        {growth > 0 && <TrendingUp className="size-3" />}
        {growth < 0 && <TrendingDown className="size-3" />}
        {growth > 0 ? "+" : ""}
        {growth.toLocaleString(locale, { maximumFractionDigits: 1 })}%
      </span>
      <span>{label}</span>
    </div>
  );
}

function MetricCard({
  label,
  icon,
  tint,
  value,
  share,
  error,
  growth,
  comparisonLabel,
  locale,
}: {
  label: string;
  icon: LucideIcon;
  tint: string;
  value: React.ReactNode;
  share?: number | null;
  error?: string;
  growth: number | null;
  comparisonLabel: string;
  locale: string;
}) {
  return (
    <div className="h-full rounded-xl border bg-card p-4 shadow-xs transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-muted-foreground">{label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight tabular-nums">{value}</span>
            {share != null && (
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {share.toLocaleString(locale, { maximumFractionDigits: 1 })}%
              </span>
            )}
          </div>
        </div>
        <IconChip icon={icon} tint={tint} />
      </div>
      {growth != null && (
        <div className="mt-3">
          <GrowthBadge growth={growth} label={comparisonLabel} locale={locale} />
        </div>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function FinancialMetricCard({
  label,
  icon,
  tint,
  value,
  growth,
  comparisonLabel,
  locale,
  loading,
}: {
  label: string;
  icon: LucideIcon;
  tint: string;
  value: string | null;
  growth: number | null;
  comparisonLabel: string;
  locale: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <IconChip icon={icon} tint={tint} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{label}</p>
          <div className="mt-1.5 truncate text-xl font-bold tracking-tight tabular-nums">
            {loading ? (
              <span className="inline-block h-7 w-28 animate-pulse rounded-md bg-muted" />
            ) : (
              (value ?? "—")
            )}
          </div>
          {growth != null && (
            <div className="mt-2 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <span
                className={cn(
                  "flex shrink-0 items-center gap-0.5 font-semibold tabular-nums",
                  growth > 0 && "text-emerald-600 dark:text-emerald-400",
                  growth < 0 && "text-red-600 dark:text-red-400",
                )}
              >
                {growth > 0 && <TrendingUp className="size-3" />}
                {growth < 0 && <TrendingDown className="size-3" />}
                {growth > 0 ? "+" : ""}
                {growth.toLocaleString(locale, {
                  maximumFractionDigits: 1,
                })}
                %
              </span>
              <span className="truncate">{comparisonLabel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

