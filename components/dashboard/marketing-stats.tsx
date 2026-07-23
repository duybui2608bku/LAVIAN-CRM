"use client";

import * as React from "react";
import {
  Calculator,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CircleDollarSign,
  MapPinCheck,
  MessageCircle,
  Phone,
  RefreshCw,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { getMarketingStats, type DashboardStats } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/currency";
import { formatISODate, parseISODate } from "@/lib/date";
import { DateRangePicker } from "@/components/common/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CustomerCardKey =
  | "spend"
  | "costPerMessage"
  | "messages"
  | "leads"
  | "appointments"
  | "visited"
  | "revenue";

/* Màu nhấn per metric — lấy từ design token nên tự đổi theo dark mode. */
const TINT: Record<CustomerCardKey, string> = {
  spend: "var(--destructive)",
  costPerMessage: "var(--warning)",
  messages: "var(--info)",
  leads: "var(--chart-5)",
  appointments: "var(--primary)",
  visited: "var(--success)",
  revenue: "var(--chart-4)",
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

export function MarketingStats({ showSpend = false }: { showSpend?: boolean }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const comparisonLabel = locale === "vi" ? "so với kỳ trước" : locale === "id" ? "vs periode sebelumnya" : "vs previous period";
  const today = formatISODate(new Date());
  const [range, setRange] = React.useState({ from: today, to: today });
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [previousStats, setPreviousStats] = React.useState<DashboardStats | null>(null);
  const [pending, startTransition] = React.useTransition();
  const requestId = React.useRef(0);

  React.useEffect(() => {
    if (!range.from) return;
    const from = range.from;
    const to = range.to || range.from;
    const previousRange = getPreviousRange(from, to);
    const currentRequest = ++requestId.current;
    startTransition(async () => {
      const [current, previous] = await Promise.all([
        getMarketingStats(from, to, showSpend),
        getMarketingStats(previousRange.from, previousRange.to, showSpend),
      ]);
      if (currentRequest !== requestId.current) return;
      setStats(current);
      setPreviousStats(previous);
    });
  }, [range, showSpend]);

  const num = (n: number | null) => (n == null ? null : n.toLocaleString(locale));
  const costPerMessage =
    stats?.spend != null && stats.messages != null && stats.messages > 0
      ? Math.round(stats.spend / stats.messages)
      : null;
  const previousCostPerMessage =
    previousStats?.spend != null && previousStats.messages != null && previousStats.messages > 0
      ? Math.round(previousStats.spend / previousStats.messages)
      : null;
  const customerCards: {
    key: CustomerCardKey;
    icon: LucideIcon;
    value: string | null;
    current: number | null;
    previous: number | null;
    error?: string;
  }[] = [
    ...(showSpend
      ? [
          {
            key: "spend" as const,
            icon: CircleDollarSign,
            value: stats?.spend != null ? formatRupiah(stats.spend) : null,
            current: stats?.spend ?? null,
            previous: previousStats?.spend ?? null,
            error: stats?.errors.fb,
          },
          {
            key: "costPerMessage" as const,
            icon: Calculator,
            value: costPerMessage != null ? formatRupiah(costPerMessage) : null,
            current: costPerMessage,
            previous: previousCostPerMessage,
            error: stats?.errors.fb ?? stats?.errors.smax,
          },
        ]
      : []),
    { key: "messages", icon: MessageCircle, value: stats ? num(stats.messages) : null, current: stats?.messages ?? null, previous: previousStats?.messages ?? null, error: stats?.errors.smax },
    { key: "leads", icon: Phone, value: stats ? num(stats.leads) : null, current: stats?.leads ?? null, previous: previousStats?.leads ?? null, error: stats?.errors.smax },
    { key: "appointments", icon: CalendarCheck, value: stats ? num(stats.appointments) : null, current: stats?.appointments ?? null, previous: previousStats?.appointments ?? null, error: stats?.errors.db },
    { key: "visited", icon: MapPinCheck, value: stats ? num(stats.visited) : null, current: stats?.visited ?? null, previous: previousStats?.visited ?? null, error: stats?.errors.db },
    { key: "revenue", icon: CircleDollarSign, value: stats?.revenue != null ? formatRupiah(stats.revenue) : null, current: stats?.revenue ?? null, previous: previousStats?.revenue ?? null, error: stats?.errors.db },
  ];

  const appointmentCards = [
    { key: "totalAppointments", icon: CalendarCheck, tint: "var(--primary)", values: stats?.appointmentSummary.total },
    { key: "todayAppointments", icon: CalendarDays, tint: "var(--info)", values: stats?.appointmentSummary.today },
    { key: "tomorrowAppointments", icon: CalendarPlus, tint: "var(--chart-5)", values: stats?.appointmentSummary.tomorrow },
  ] as const;

  const value = (displayValue: string | null) =>
    !stats && pending ? (
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

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <DateRangePicker
          from={range.from}
          to={range.to}
          onChange={(next) => setRange(next.from ? next : { from: today, to: today })}
          placeholder={t("range")}
          clearLabel={t("clear")}
          className="w-full max-w-64"
        />
        {stats && pending && <RefreshCw className="size-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {stats?.error && <p className="text-sm text-destructive">{stats.error}</p>}

      <section className="space-y-4">
        <SectionTitle icon={Users} tint="var(--primary)">{t("customerSection")}</SectionTitle>
        <div className={cn("grid gap-4 transition-opacity duration-200 lg:grid-cols-2", pending && "opacity-60")}>
          <div className="grid gap-4 sm:grid-cols-2">
            {customerCards.map((card) => (
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
          <CustomerPieChart
            items={[
              { label: t("messages"), value: stats?.messages ?? null, color: TINT.messages },
              { label: t("leads"), value: stats?.leads ?? null, color: TINT.leads },
              { label: t("appointments"), value: stats?.appointments ?? null, color: TINT.appointments },
              { label: t("visited"), value: stats?.visited ?? null, color: TINT.visited },
            ]}
            locale={locale}
            loading={!stats && pending}
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle icon={CalendarCheck} tint="var(--info)">{t("appointmentSection")}</SectionTitle>
        <div className={cn("grid gap-4 transition-opacity duration-200 lg:grid-cols-3", pending && "opacity-60")}>
          {appointmentCards.map((card) => {
            const total = card.values?.total ?? null;
            const deposited = card.values?.deposited ?? null;
            const pct = total && deposited != null ? Math.min(100, (deposited / total) * 100) : 0;
            return (
              <div key={card.key} className="rounded-xl border bg-card p-4 shadow-xs transition-shadow duration-200 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-muted-foreground">{t(card.key)}</p>
                    <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value(num(total))}</div>
                  </div>
                  <IconChip icon={card.icon} tint={card.tint} />
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-success transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-2 shrink-0 rounded-full bg-success" />
                      {t("deposited")}
                    </p>
                    <p className="mt-1 font-semibold tabular-nums">{value(num(deposited))}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-2 shrink-0 rounded-full bg-muted-foreground/40" />
                      {t("notDeposited")}
                    </p>
                    <p className="mt-1 font-semibold tabular-nums">{value(num(card.values?.notDeposited ?? null))}</p>
                  </div>
                </div>
                {stats?.errors.db && <p className="mt-2 text-xs text-destructive">{stats.errors.db}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle icon={UsersRound} tint="var(--success)">{t("staffSection")}</SectionTitle>
        <div className={cn("overflow-hidden rounded-xl border bg-card shadow-xs transition-opacity duration-200", pending && "opacity-60")}>
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>{t("staffName")}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{t("staffCustomers")}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{t("staffPhoneLeads")}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{t("staffWhatsappLeads")}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{t("staffPhoneRate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.staffStats?.map((row, index) => (
                <TableRow key={row.userId}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <InitialAvatar name={row.name} index={index} />
                      {row.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.customers.toLocaleString(locale)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.phoneLeads.toLocaleString(locale)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.whatsappLeads.toLocaleString(locale)}</TableCell>
                  <TableCell>
                    <span className="flex items-center justify-end gap-2">
                      <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
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
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">{t("noStaffStats")}</TableCell>
                </TableRow>
              )}
              {!stats && pending && (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">{t("loading")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {stats?.errors.staff && <p className="text-sm text-destructive">{stats.errors.staff}</p>}
      </section>

      <section className="space-y-4">
        <SectionTitle icon={Timer} tint="var(--warning)">{t("replyTimeSection")}</SectionTitle>
        <div className={cn("overflow-hidden rounded-xl border bg-card shadow-xs transition-opacity duration-200", pending && "opacity-60")}>
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>{t("staffName")}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{t("replyTimeMin")}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{t("replyTimeMax")}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{t("replyTimeAverage")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.staffReplyTimes?.map((row, index) => (
                <TableRow key={row.userId}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <InitialAvatar name={row.name} index={index} />
                      {row.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-success">{replyTime(row.minimum)}</TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">{replyTime(row.maximum)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{replyTime(row.average)}</TableCell>
                </TableRow>
              ))}
              {!stats?.errors.replyTime && stats?.staffReplyTimes?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">{t("noReplyTimeStats")}</TableCell>
                </TableRow>
              )}
              {!stats && pending && (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">{t("loading")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {stats?.errors.replyTime && <p className="text-sm text-destructive">{stats.errors.replyTime}</p>}
      </section>

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

function MetricCard({
  label,
  icon,
  tint,
  value,
  error,
  growth,
  comparisonLabel,
  locale,
}: {
  label: string;
  icon: LucideIcon;
  tint: string;
  value: React.ReactNode;
  error?: string;
  growth: number | null;
  comparisonLabel: string;
  locale: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-muted-foreground">{label}</p>
          <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</div>
        </div>
        <IconChip icon={icon} tint={tint} />
      </div>
      {growth != null && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
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
          <span>{comparisonLabel}</span>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function CustomerPieChart({
  items,
  locale,
  loading,
}: {
  items: { label: string; value: number | null; color: string }[];
  locale: string;
  loading: boolean;
}) {
  const values = items.map((item) => Math.max(0, item.value ?? 0));
  const total = values.reduce((sum, item) => sum + item, 0);
  const circumference = 2 * Math.PI * 42;
  let offset = 0;

  return (
    <div className="flex min-h-64 items-center rounded-xl border bg-card p-5 shadow-xs">
      {loading ? (
        <div className="mx-auto size-44 animate-pulse rounded-full bg-muted" />
      ) : (
        <div className="grid w-full items-center gap-6 sm:grid-cols-[minmax(160px,1fr)_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[minmax(180px,1fr)_minmax(0,1fr)]">
          <div className="relative mx-auto aspect-square w-full max-w-52">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={items.map((item) => `${item.label}: ${item.value ?? 0}`).join(", ")}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--muted)" strokeWidth="14" />
              {total > 0 && items.map((item, index) => {
                const length = (values[index] / total) * circumference;
                const dashOffset = -offset;
                offset += length;
                return (
                  <circle
                    key={item.label}
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke={item.color}
                    strokeWidth="14"
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={dashOffset}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums">{total.toLocaleString(locale)}</span>
              <span className="text-xs text-muted-foreground">{locale === "vi" ? "Tổng" : locale === "id" ? "Total" : "Total"}</span>
            </div>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => {
              const percentage = total > 0 ? (values[index] / total) * 100 : 0;
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-semibold tabular-nums">{values[index].toLocaleString(locale)}</span>
                  <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                    {percentage.toLocaleString(locale, { maximumFractionDigits: 1 })}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
