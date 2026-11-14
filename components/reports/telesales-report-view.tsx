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
import { change, ratio } from "@/lib/reports";
import {
  BOOKING_SOURCES,
  KPI_BOOKING_RATE,
  kpiCompletion,
  staffTotals,
  type BookingSource,
  type DayStat,
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

  const num = (v: number | null) => (v == null ? "—" : v.toLocaleString(locale));
  const pct = (v: number | null) =>
    v == null ? "—" : `${(v * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  const ddmm = (d: string) => dayjs(d).format("DD/MM");
  const rangeText = (a: string, b: string) => (a === b ? ddmm(a) : `${ddmm(a)} – ${ddmm(b)}`);

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
        description={
          report && !report.error
            ? t("subtitle", { range: rangeText(range.from, range.to), prev: rangeText(report.previous.from, report.previous.to) })
            : t("subtitleShort")
        }
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
            <Funnel
              loading={!report}
              steps={[
                { label: t("card.messages"), value: cur?.messages ?? null },
                { label: t("card.bookings"), value: cur?.bookings ?? null },
                { label: t("card.confirmed"), value: cur?.confirmed ?? null },
                { label: t("card.arrived"), value: cur?.arrived ?? null },
              ]}
              num={num}
              pct={pct}
            />
          </Section>
          <Section icon={TrendingUp} title={t("trend")} tip={t("tip.trend")}>
            <Trend days={data?.days ?? []} num={num} ddmm={ddmm} />
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

function Funnel({
  steps,
  loading,
  num,
  pct,
}: {
  steps: { label: string; value: number | null }[];
  loading: boolean;
  num: (v: number | null) => string;
  pct: (v: number | null) => string;
}) {
  const t = useTranslations("telesales");
  const max = Math.max(0, ...steps.map((s) => s.value ?? 0));
  const top = steps[0].value;
  if (!loading && max === 0) return <p className="py-10 text-center text-sm text-muted-foreground">{t("noData")}</p>;
  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-medium">{s.label}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold">{num(s.value)}</span>
              {i > 0 ? <span className="text-muted-foreground"> · {pct(ratio(s.value, top))}</span> : null}
            </span>
          </div>
          {/* Thanh căn giữa, rộng theo giá trị → dáng phễu; 1 hue, đậm dần theo tầng. */}
          <div className="flex h-6 justify-center rounded-sm bg-muted/60">
            {loading ? (
              <span className="h-full w-1/2 animate-pulse rounded-sm bg-muted" />
            ) : (
              <span
                className="h-full rounded-sm bg-primary transition-[width] duration-500"
                style={{
                  width: max ? `${Math.max(((s.value ?? 0) / max) * 100, s.value ? 2 : 0)}%` : 0,
                  opacity: 0.45 + (0.55 * (i + 1)) / steps.length,
                }}
              />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Trend({ days, num, ddmm }: { days: DayStat[]; num: (v: number | null) => string; ddmm: (d: string) => string }) {
  const t = useTranslations("telesales");
  const max = Math.max(0, ...days.flatMap((d) => [d.bookings, d.arrived]));
  const legend = (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ background: "var(--chart-1)" }} />
        {t("card.bookings")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ background: "var(--chart-3)" }} />
        {t("card.arrived")}
      </span>
    </div>
  );
  if (!days.length || max === 0)
    return (
      <>
        {legend}
        <p className="py-10 text-center text-sm text-muted-foreground">{t("noData")}</p>
      </>
    );
  const step = Math.ceil(days.length / 8); // tối đa ~8 nhãn trục
  const h = (v: number) => `${Math.max((v / max) * 100, v ? 3 : 0)}%`;
  return (
    <div className="flex flex-col gap-2">
      {legend}
      <div className="relative flex h-44 items-end gap-0.5 border-b border-border sm:gap-1">
        <span className="absolute top-0 left-0 text-[10px] text-muted-foreground tabular-nums">{num(max)}</span>
        {days.map((d) => (
          <Tooltip
            key={d.date}
            title={
              <span className="flex flex-col">
                <span className="font-medium">{ddmm(d.date)}</span>
                <span>
                  {t("card.bookings")}: {num(d.bookings)}
                </span>
                <span>
                  {t("card.arrived")}: {num(d.arrived)}
                </span>
              </span>
            }
          >
            <div className="flex h-full min-w-0 flex-1 items-end justify-center gap-px rounded-t-sm hover:bg-muted/60">
              <span className="w-1/2 max-w-4 rounded-t-sm" style={{ height: h(d.bookings), background: "var(--chart-1)" }} />
              <span className="w-1/2 max-w-4 rounded-t-sm" style={{ height: h(d.arrived), background: "var(--chart-3)" }} />
            </div>
          </Tooltip>
        ))}
      </div>
      <div className="flex gap-0.5 sm:gap-1">
        {days.map((d, i) => (
          <span key={d.date} className="min-w-0 flex-1 text-center text-[10px] whitespace-nowrap text-muted-foreground">
            {i % step === 0 ? ddmm(d.date) : ""}
          </span>
        ))}
      </div>
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
    <div className="flex flex-wrap items-center justify-center gap-4">
      <div className="relative size-36 shrink-0">
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
          <span className="text-xl font-semibold tabular-nums">{sources ? num(total) : "—"}</span>
          <span className="text-xs text-muted-foreground">{t("card.bookings")}</span>
        </div>
      </div>
      <ul className="flex min-w-36 flex-col gap-1.5 text-sm">
        {BOOKING_SOURCES.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: SOURCE_COLOR[s] }} />
            <span className="flex-1 truncate">{t(`source.${s}`)}</span>
            <span className="tabular-nums">
              <span className="font-medium">{sources ? num(sources[s]) : "—"}</span>
              <span className="text-xs text-muted-foreground"> ({total ? pct(sources![s] / total) : "—"})</span>
            </span>
          </li>
        ))}
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
    if (k == null) return <span className="text-muted-foreground">—</span>;
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
  const showUp = (r: StaffCounts) => (
    <span className="tabular-nums whitespace-nowrap">
      {num(r.arrived)}
      <span className="text-muted-foreground"> ({pct(ratio(r.arrived, r.scheduled))})</span>
    </span>
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
            <span className="font-medium">{r.name || "—"}</span>
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
            <span className="cursor-help text-muted-foreground">—</span>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">—</span>
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
