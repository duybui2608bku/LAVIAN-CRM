"use client";

import * as React from "react";
import { Alert, Button, Progress, Table, Tooltip, type TableProps } from "antd";
import dayjs from "dayjs";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarPlus,
  CalendarX2,
  CircleAlert,
  Filter,
  Info,
  MessageCircle,
  PieChart,
  RefreshCw,
  Timer,
  TrendingUp,
  TriangleAlert,
  UserCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";

import { getTelesalesReport, type TelesalesReport } from "@/app/(app)/reports/telesales/actions";
import { DateRangeFilter, initialRange } from "@/components/common/date-range-filter";
import { UserAvatar } from "@/components/common/user-avatar";
import { PageHeader, PageToolbar } from "@/components/layout/page";
import { FunnelChart, TrendChart } from "@/components/reports/telesales-charts";
import { change, ratio } from "@/lib/reports";
import {
  BOOKING_SOURCES,
  KPI_BOOKING_RATE,
  kpiCompletion,
  staffTotals,
  type BookingSource,
  type PeriodStats,
  type StaffCounts,
  type StaffPerf,
} from "@/lib/telesales-report";
import { cn } from "@/lib/utils";

type Tone = "primary" | "info" | "success" | "warning" | "destructive";
const TONE: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

// Màu theo nguồn (cố định, không theo hạng). Đã chạy validator: cần nhãn + số trực tiếp (có ở legend).
const SOURCE_COLOR: Record<BookingSource, string> = {
  instagrams: "var(--chart-5)",
  whatsapp: "var(--chart-3)",
  other: "var(--muted-foreground)",
};

type CardKey = "messages" | "bookings" | "newBookings" | "confirmed" | "arrived" | "cancelled";
const CARDS: { key: CardKey; icon: React.ElementType; tone: Tone; lowerIsBetter?: boolean }[] = [
  { key: "messages", icon: MessageCircle, tone: "info" },
  { key: "bookings", icon: CalendarPlus, tone: "primary" },
  { key: "newBookings", icon: UserPlus, tone: "primary" },
  { key: "confirmed", icon: CalendarCheck, tone: "success" },
  { key: "arrived", icon: UserCheck, tone: "success" },
  { key: "cancelled", icon: CalendarX2, tone: "warning", lowerIsBetter: true },
];

const cardValue = (s: PeriodStats, k: CardKey): number | null =>
  k === "cancelled" ? s.cancelled + s.rescheduled : s[k];

export function TelesalesReportView() {
  const t = useTranslations("telesales");
  const locale = useLocale();
  const [range, setRange] = React.useState(() => initialRange("today"));
  const [report, setReport] = React.useState<TelesalesReport | null>(null);
  const [pending, startTransition] = React.useTransition();
  const requestId = React.useRef(0);

  const load = React.useCallback(() => {
    const current = ++requestId.current;
    startTransition(async () => {
      const next = await getTelesalesReport(range.from, range.to);
      if (current === requestId.current) setReport(next);
    });
  }, [range]);
  React.useEffect(load, [load]);

  // Không có dữ liệu (nguồn lỗi, chia cho 0...) → "-".
  const num = (v: number | null) => (v == null ? "-" : v.toLocaleString(locale));
  const pct = (v: number | null) =>
    v == null ? "-" : `${(v * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%`;

  const data = report?.data ?? null;
  const cur = data?.cur;
  const prev = data?.prev;

  const hints: Record<CardKey, string | undefined> = cur
    ? {
        messages: report?.errors.fb ? t("hint.fbError") : t("hint.previous", { value: num(prev!.messages) }),
        bookings: t("hint.bookingRate", { value: pct(ratio(cur.bookings, cur.messages)) }),
        newBookings: t("hint.newShare", { value: pct(ratio(cur.newBookings, cur.bookings)) }),
        confirmed: t("hint.confirmRate", { value: pct(ratio(cur.confirmed, cur.bookings)) }),
        arrived: t("hint.showUp", { value: pct(ratio(cur.arrived, cur.scheduled)), scheduled: num(cur.scheduled) }),
        cancelled: t("hint.cancel", {
          cancelled: num(cur.cancelled),
          rescheduled: num(cur.rescheduled),
          value: pct(ratio(cur.cancelled + cur.rescheduled, cur.bookings)),
        }),
      }
    : ({} as Record<CardKey, undefined>);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitleShort")}
        actions={
          <Button icon={<RefreshCw className={cn("size-4", pending && "animate-spin")} />} onClick={load}>
            {t("refresh")}
          </Button>
        }
      />

      <PageToolbar>
        <DateRangeFilter value={range} onChange={setRange} />
      </PageToolbar>

      {report?.error ? <Alert type="error" showIcon title={report.error} /> : null}
      {report && (report.errors.fb || report.errors.smax) ? (
        <Alert
          type="warning"
          showIcon
          title={t("sourceError")}
          description={[report.errors.fb && `Facebook Ads: ${report.errors.fb}`, report.errors.smax && `SMAX: ${report.errors.smax}`]
            .filter(Boolean)
            .join(" · ")}
        />
      ) : null}

      <div className={cn("flex flex-col gap-4 transition-opacity duration-200", pending && report && "opacity-60")}>
        {/* 6 thẻ số liệu */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          {CARDS.map(({ key, icon: Icon, tone, lowerIsBetter }) => {
            const value = cur ? cardValue(cur, key) : null;
            const delta = cur && prev ? change(value, cardValue(prev, key)) : null;
            const good = delta == null || delta === 0 ? null : lowerIsBetter ? delta < 0 : delta > 0;
            return (
              <div key={key} className="surface flex min-w-0 flex-col gap-2 p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONE[tone])}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground sm:text-sm">
                    {t(`card.${key}`)}
                  </span>
                  <Tooltip title={t(`tip.${key}`)}>
                    <Info className="size-3.5 shrink-0 cursor-help text-muted-foreground" aria-label={t(`tip.${key}`)} />
                  </Tooltip>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
                    {!report ? <span className="inline-block h-7 w-16 animate-pulse rounded-md bg-muted" /> : num(value)}
                  </span>
                  {delta != null ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
                        good ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
                      )}
                      title={t("hint.previous", { value: num(prev ? cardValue(prev, key) : null) })}
                    >
                      {delta > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                      {pct(Math.abs(delta))}
                    </span>
                  ) : null}
                </div>
                <p className="min-h-4 truncate text-xs text-muted-foreground" title={hints[key]}>
                  {hints[key]}
                </p>
              </div>
            );
          })}
        </div>

        {/* Phễu · Xu hướng · Tốc độ phản hồi */}
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
          <Section icon={Filter} title={t("funnel")} tip={t("tip.funnel")}>
            {!report ? (
              <ChartSkeleton />
            ) : (
              <FunnelChart
                ariaLabel={t("funnel")}
                steps={(["messages", "bookings", "confirmed", "arrived"] as const).map((k) => {
                  const v = cur ? cur[k] : null;
                  const share = ratio(v, cur?.messages ?? null);
                  return { label: t(`card.${k}`), value: num(v), detail: share == null ? undefined : pct(share) };
                })}
              />
            )}
          </Section>
          <Section icon={TrendingUp} title={t("trend")} tip={t("tip.trend")}>
            {!data ? (
              <ChartSkeleton />
            ) : (
              <TrendChart
                ariaLabel={t("trend")}
                labels={data.days.map((d) => dayjs(d.date).format("DD/MM"))}
                series={[
                  { label: t("card.newBookings"), data: data.days.map((d) => d.newBookings) },
                  { label: t("card.arrived"), data: data.days.map((d) => d.arrived) },
                ]}
              />
            )}
          </Section>
          <Section icon={Timer} title={t("response")} className="lg:col-span-2 xl:col-span-1">
            <Updating />
          </Section>
        </div>

        {/* Hiệu suất NV · Nguồn · Cảnh báo */}
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Section icon={UsersRound} title={t("staffTitle")} tip={t("tip.staff", { kpi: pct(KPI_BOOKING_RATE) })} className="lg:col-span-2 xl:col-span-1">
            <StaffTable staff={data?.staff ?? []} other={data?.other ?? null} loading={!report} num={num} pct={pct} />
          </Section>
          <Section icon={PieChart} title={t("sources")} tip={t("tip.sources")}>
            <Donut sources={data?.sources ?? null} num={num} pct={pct} />
          </Section>
          <Section icon={TriangleAlert} title={t("alerts")}>
            <Updating />
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({
  icon: Icon,
  title,
  tip,
  className,
  children,
}: {
  icon: React.ElementType;
  title: string;
  tip?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("surface flex min-w-0 flex-col gap-3 p-4", className)}>
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
        {tip ? (
          <Tooltip title={tip}>
            <Info className="size-3.5 cursor-help text-muted-foreground" aria-label={tip} />
          </Tooltip>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

function ChartSkeleton() {
  return <div className="h-60 animate-pulse rounded-lg bg-muted/60" />;
}

/** Ô "Đang cập nhật" (icon chấm than) cho phần chưa có dữ liệu. */
function Updating() {
  const t = useTranslations("telesales");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-warning/10 text-warning">
        <CircleAlert className="size-5" />
      </span>
      <p className="text-sm font-medium">{t("updating")}</p>
      <p className="max-w-56 text-xs text-muted-foreground">{t("updatingHint")}</p>
    </div>
  );
}

function Donut({
  sources,
  num,
  pct,
}: {
  sources: Record<BookingSource, number> | null;
  num: (v: number | null) => string;
  pct: (v: number | null) => string;
}) {
  const t = useTranslations("telesales");
  const total = sources ? BOOKING_SOURCES.reduce((n, s) => n + sources[s], 0) : 0;
  const R = 40;
  const C = 2 * Math.PI * R;
  const GAP = total && BOOKING_SOURCES.filter((s) => sources![s]).length > 1 ? 1.5 : 0; // khe 2px giữa lát
  let offset = 0;
  return (
    <div className="flex flex-1 flex-wrap items-center justify-center gap-x-8 gap-y-4 py-2">
      <div className="relative size-48 shrink-0 sm:size-52">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={t("sources")}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--muted)" strokeWidth="14" />
          {sources &&
            total > 0 &&
            BOOKING_SOURCES.map((s) => {
              const len = (sources[s] / total) * C;
              const el = len ? (
                <circle
                  key={s}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={SOURCE_COLOR[s]}
                  strokeWidth="14"
                  strokeDasharray={`${Math.max(len - GAP, 0.5)} ${C}`}
                  strokeDashoffset={-offset}
                >
                  <title>{`${t(`source.${s}`)}: ${num(sources[s])} (${pct(sources[s] / total)})`}</title>
                </circle>
              ) : null;
              offset += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums">{total ? num(total) : "-"}</span>
          <span className="text-sm text-muted-foreground">{t("card.bookings")}</span>
        </div>
      </div>
      <ul className="flex min-w-44 flex-col gap-2.5 text-sm">
        {BOOKING_SOURCES.map((s) => {
          const n = sources?.[s] ?? 0;
          return (
            <li key={s} className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-sm" style={{ background: SOURCE_COLOR[s] }} />
              <span className="flex-1 truncate">{t(`source.${s}`)}</span>
              {/* Không có booking → chỉ "-" (không "0 (-)"). */}
              <span className="tabular-nums">
                {n ? (
                  <>
                    <span className="font-medium">{num(n)}</span>
                    <span className="text-xs text-muted-foreground"> ({pct(n / total)})</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type StaffRow = (StaffPerf | (StaffCounts & { id: "__other"; conversations: null })) & { key: string };

function StaffTable({
  staff,
  other,
  loading,
  num,
  pct,
}: {
  staff: StaffPerf[];
  other: StaffCounts | null;
  loading: boolean;
  num: (v: number | null) => string;
  pct: (v: number | null) => string;
}) {
  const t = useTranslations("telesales");
  const rows: StaffRow[] = [
    ...staff.map((s) => ({ ...s, key: s.id })),
    ...(other ? [{ ...other, id: "__other" as const, conversations: null, key: "__other" }] : []),
  ];
  const total = staffTotals(staff, other);

  const kpiCell = (bookings: number, conversations: number | null) => {
    const k = kpiCompletion(bookings, conversations);
    if (k == null) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex min-w-28 items-center gap-2">
        <Progress
          percent={Math.min(k * 100, 100)}
          showInfo={false}
          size="small"
          strokeColor={k >= 1 ? "var(--success)" : k >= 0.8 ? "var(--warning)" : "var(--destructive)"}
          className="m-0! flex-1"
        />
        <span className="w-12 text-right text-xs font-medium tabular-nums">{pct(k)}</span>
      </div>
    );
  };
  // Không có lịch hẹn trong kỳ → chỉ "-" (không "0 (-)").
  const showUp = (r: StaffCounts) =>
    r.scheduled ? (
      <span className="tabular-nums whitespace-nowrap">
        {num(r.arrived)}
        <span className="text-muted-foreground"> ({pct(ratio(r.arrived, r.scheduled))})</span>
      </span>
    ) : (
      <span className="text-muted-foreground">-</span>
    );

  const columns: TableProps<StaffRow>["columns"] = [
    {
      key: "name",
      title: t("col.staff"),
      fixed: "left",
      render: (_, r) =>
        "name" in r ? (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <UserAvatar src={r.avatar_url} size={22} />
            <span className="font-medium">{r.name || "-"}</span>
          </span>
        ) : (
          <span className="whitespace-nowrap text-muted-foreground">{t("other")}</span>
        ),
    },
    {
      key: "conversations",
      title: (
        <Tooltip title={t("tip.conversations")}>
          <span className="cursor-help">{t("col.conversations")}</span>
        </Tooltip>
      ),
      align: "right",
      render: (_, r) =>
        r.conversations != null ? (
          <span className="tabular-nums">{num(r.conversations)}</span>
        ) : "name" in r ? (
          <Tooltip title={t("notMapped")}>
            <span className="cursor-help text-muted-foreground">-</span>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    { key: "bookings", title: t("col.bookings"), align: "right", render: (_, r) => <span className="tabular-nums">{num(r.bookings)}</span> },
    {
      key: "rate",
      title: t("col.bookingRate"),
      align: "right",
      render: (_, r) => <span className="tabular-nums">{pct(ratio(r.bookings, r.conversations))}</span>,
    },
    { key: "showUp", title: t("col.showUp"), align: "right", render: (_, r) => showUp(r) },
    { key: "kpi", title: t("col.kpi", { kpi: pct(KPI_BOOKING_RATE) }), render: (_, r) => kpiCell(r.bookings, r.conversations) },
  ];

  return (
    <Table<StaffRow>
      rowKey="key"
      size="small"
      loading={loading}
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ x: "max-content" }}
      locale={{ emptyText: t("noStaff") }}
      summary={() =>
        rows.length ? (
          <Table.Summary.Row className="bg-muted/40 font-semibold">
            <Table.Summary.Cell index={0}>{t("total")}</Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <span className="tabular-nums">{num(total.conversations)}</span>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">
              <span className="tabular-nums">{num(total.bookings)}</span>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right">
              <span className="tabular-nums">{pct(ratio(total.convBookings, total.conversations))}</span>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right">
              {showUp(total)}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={5}>{kpiCell(total.convBookings, total.conversations)}</Table.Summary.Cell>
          </Table.Summary.Row>
        ) : null
      }
    />
  );
}
