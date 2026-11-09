"use client";

import * as React from "react";
import { Alert, Button, Segmented, Table, Tooltip } from "antd";
import dayjs from "dayjs";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  Calculator,
  HandCoins,
  MessageCircle,
  Phone,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { getReport, type Report } from "@/app/(app)/reports/actions";
import { DataTable } from "@/components/common/data-table";
import { DateRangePicker } from "@/components/common/date-picker";
import { PageHeader, PageToolbar } from "@/components/layout/page";
import { formatRupiah, IDR_CURRENCY } from "@/lib/currency";
import {
  AD_MONEY,
  change,
  LOWER_IS_BETTER,
  METRICS,
  ratio,
  totals,
  type DayRow,
  type Metric,
  type Totals,
} from "@/lib/reports";
import { cn } from "@/lib/utils";

type Tone = "primary" | "info" | "success" | "warning";
const TONE: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
};
const BAR: Record<Tone, string> = {
  primary: "bg-primary",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
};

const META: Record<Metric, { icon: React.ElementType; tone: Tone }> = {
  spend: { icon: Wallet, tone: "primary" },
  messages: { icon: MessageCircle, tone: "info" },
  costPerMessage: { icon: Calculator, tone: "info" },
  data: { icon: Phone, tone: "success" },
  costPerData: { icon: Calculator, tone: "success" },
  deposits: { icon: HandCoins, tone: "warning" },
  bookings: { icon: CalendarCheck, tone: "primary" },
  revenue: { icon: ReceiptText, tone: "success" },
};

const FB_METRICS: ReadonlySet<Metric> = new Set(["spend", "messages", "costPerMessage", "costPerData"]);

const PRESETS = ["today", "yesterday", "last7", "last30", "thisMonth", "lastMonth"] as const;
type Preset = (typeof PRESETS)[number];

function presetRange(p: Preset): { from: string; to: string } {
  const d = dayjs();
  const f = (x: dayjs.Dayjs) => x.format("YYYY-MM-DD");
  switch (p) {
    case "today":
      return { from: f(d), to: f(d) };
    case "yesterday":
      return { from: f(d.subtract(1, "day")), to: f(d.subtract(1, "day")) };
    case "last7":
      return { from: f(d.subtract(6, "day")), to: f(d) };
    case "last30":
      return { from: f(d.subtract(29, "day")), to: f(d) };
    case "thisMonth":
      return { from: f(d.startOf("month")), to: f(d) };
    case "lastMonth": {
      const m = d.subtract(1, "month");
      return { from: f(m.startOf("month")), to: f(m.endOf("month")) };
    }
  }
}

/** Chỉ số của 1 ngày (dòng bảng / cột biểu đồ). */
const dayTotals = (r: DayRow): Totals => totals([r]);

export function ReportsView() {
  const t = useTranslations("reports");
  const locale = useLocale();
  const [range, setRange] = React.useState(() => presetRange("last7"));
  const [report, setReport] = React.useState<Report | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [chartMetric, setChartMetric] = React.useState<Metric>("data");
  const requestId = React.useRef(0);

  const load = React.useCallback(() => {
    const current = ++requestId.current;
    startTransition(async () => {
      const next = await getReport(range.from, range.to || range.from);
      if (current === requestId.current) setReport(next);
    });
  }, [range]);
  React.useEffect(load, [load]);

  // ---- Định dạng ----
  const currency = report?.currency;
  const adMoney = new Intl.NumberFormat(
    locale,
    currency ? { style: "currency", currency, maximumFractionDigits: 0 } : { maximumFractionDigits: 0 },
  );
  const fmt = (m: Metric, v: number | null): string => {
    if (v == null) return "—";
    if (m === "revenue") return formatRupiah(v);
    if (AD_MONEY.has(m)) return adMoney.format(Math.round(v));
    return v.toLocaleString(locale);
  };
  const pct = (v: number | null) =>
    v == null ? "—" : `${(v * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  const ddmm = (d: string) => dayjs(d).format("DD/MM");
  const weekday = (d: string) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const rangeText = (a: string, b: string) => (a === b ? ddmm(a) : `${ddmm(a)} – ${ddmm(b)}`);

  // ---- Chia kỳ hiện tại / kỳ trước ----
  const to = range.to || range.from;
  const rows = report?.rows.filter((r) => r.date >= range.from && r.date <= to) ?? [];
  const prevRows = report ? report.rows.filter((r) => r.date < range.from) : [];
  const cur = report ? totals(rows) : null;
  const prev = report ? totals(prevRows) : null;
  const errorOf = (m: Metric) => (FB_METRICS.has(m) ? report?.errors.fb : report?.errors.db);

  const activePreset = PRESETS.find((p) => {
    const r = presetRange(p);
    return r.from === range.from && r.to === to;
  });

  // ROAS chỉ có nghĩa khi tiền quảng cáo cùng đơn vị Rupiah với doanh thu.
  const roas = currency === IDR_CURRENCY ? ratio(cur?.revenue ?? null, cur?.spend ?? null) : null;

  const hints: Partial<Record<Metric, string>> = {
    data: cur ? t("hint.ofMessages", { pct: pct(ratio(cur.data, cur.messages)) }) : undefined,
    deposits: cur ? t("hint.ofData", { pct: pct(ratio(cur.deposits, cur.data)) }) : undefined,
    bookings: cur ? t("hint.ofData", { pct: pct(ratio(cur.bookings, cur.data)) }) : undefined,
    revenue: roas != null ? t("hint.roas", { x: roas.toLocaleString(locale, { maximumFractionDigits: 2 }) }) : undefined,
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        description={
          report && !report.error
            ? t("subtitle", { range: rangeText(range.from, to), prev: rangeText(report.previous.from, report.previous.to) })
            : t("subtitleShort")
        }
        actions={
          <Button icon={<RefreshCw className={cn("size-4", pending && "animate-spin")} />} onClick={load}>
            {t("refresh")}
          </Button>
        }
      />

      <PageToolbar>
        <div className="overflow-x-auto">
          <Segmented<Preset | "custom">
            value={activePreset ?? "custom"}
            onChange={(v) => v !== "custom" && setRange(presetRange(v))}
            options={[
              ...PRESETS.map((p) => ({ value: p, label: t(`preset.${p}`) })),
              ...(activePreset ? [] : [{ value: "custom" as const, label: t("preset.custom") }]),
            ]}
          />
        </div>
        <DateRangePicker
          from={range.from}
          to={to}
          allowClear={false}
          onChange={(r) => r.from && setRange({ from: r.from, to: r.to || r.from })}
        />
      </PageToolbar>

      {report?.error ? <Alert type="error" showIcon title={report.error} /> : null}
      {report && (report.errors.fb || report.errors.db) ? (
        <Alert
          type="warning"
          showIcon
          title={t("sourceError")}
          description={[
            report.errors.fb && `Facebook Ads: ${report.errors.fb}`,
            report.errors.db && `CRM: ${report.errors.db}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      ) : null}

      {/* 8 chỉ số */}
      <div
        className={cn(
          "grid grid-cols-2 gap-3 transition-opacity duration-200 lg:grid-cols-4",
          pending && report && "opacity-60",
        )}
      >
        {METRICS.map((m) => {
          const value = cur?.[m] ?? null;
          const delta = change(value, prev?.[m] ?? null);
          const good = delta == null || delta === 0 ? null : LOWER_IS_BETTER.has(m) ? delta < 0 : delta > 0;
          const { icon: Icon, tone } = META[m];
          const hero = m === "revenue";
          return (
            <div
              key={m}
              className={cn(
                "surface flex min-w-0 flex-col gap-2 p-3 sm:p-4",
                hero && "border-primary/30 bg-linear-to-br from-primary/10 to-card",
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONE[tone])}>
                  <Icon className="size-4" />
                </span>
                <span className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{t(`metric.${m}`)}</span>
              </div>
              <div className="truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
                {!report ? (
                  <span className="inline-block h-7 w-24 animate-pulse rounded-md bg-muted" />
                ) : value == null && errorOf(m) ? (
                  <Tooltip title={errorOf(m)}>
                    <span className="text-muted-foreground">—</span>
                  </Tooltip>
                ) : (
                  <span title={fmt(m, value)}>{fmt(m, value)}</span>
                )}
              </div>
              <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {delta != null ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums",
                      m === "spend"
                        ? "bg-muted text-muted-foreground"
                        : good
                          ? "bg-success/10 text-success"
                          : "bg-destructive/10 text-destructive",
                    )}
                    title={t("vsPrevious", { value: fmt(m, prev?.[m] ?? null) })}
                  >
                    {delta > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {pct(Math.abs(delta))}
                  </span>
                ) : null}
                {hints[m] ? <span className="truncate text-muted-foreground">{hints[m]}</span> : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_3fr]">
        <Funnel
          title={t("funnel")}
          steps={(["messages", "data", "deposits", "bookings"] as const).map((m) => ({
            key: m,
            label: t(`metric.${m}`),
            value: cur?.[m] ?? null,
          }))}
          format={(m, v) => fmt(m, v)}
          pct={pct}
          roas={roas != null ? t("hint.roas", { x: roas.toLocaleString(locale, { maximumFractionDigits: 2 }) }) : null}
        />

        <section className="surface flex min-w-0 flex-col gap-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <TrendingUp className="size-4 text-primary" />
              {t("trend")}
            </h2>
            <Segmented<Metric>
              size="small"
              className="max-w-full overflow-x-auto"
              value={chartMetric}
              onChange={setChartMetric}
              options={(["spend", "messages", "data", "deposits", "bookings", "revenue"] as const).map((m) => ({
                value: m,
                label: t(`metric.${m}`),
              }))}
            />
          </div>
          <TrendBars
            rows={rows}
            value={(r) => dayTotals(r)[chartMetric]}
            label={(r) => `${weekday(r.date)} ${ddmm(r.date)}: ${fmt(chartMetric, dayTotals(r)[chartMetric])}`}
            tick={ddmm}
          />
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("daily")}</h2>
        <DataTable<DayRow>
          rowKey="date"
          loading={pending && !report}
          dataSource={[...rows].reverse()}
          pageSize={31}
          columns={[
            {
              key: "date",
              title: t("date"),
              dataIndex: "date",
              fixed: "left",
              render: (d: string) => (
                <span className="whitespace-nowrap">
                  <span className="text-muted-foreground">{weekday(d)}</span> {ddmm(d)}
                </span>
              ),
            },
            ...METRICS.map((m) => ({
              key: m,
              title: t(`metric.${m}`),
              align: "right" as const,
              render: (_: unknown, r: DayRow) => (
                <span className="tabular-nums whitespace-nowrap">{fmt(m, dayTotals(r)[m])}</span>
              ),
            })),
          ]}
          summary={() =>
            cur ? (
              <Table.Summary>
                <Table.Summary.Row className="bg-muted/50 font-semibold">
                  <Table.Summary.Cell index={0}>{t("total")}</Table.Summary.Cell>
                  {METRICS.map((m, i) => (
                    <Table.Summary.Cell key={m} index={i + 1} align="right">
                      <span className="tabular-nums whitespace-nowrap">{fmt(m, cur[m])}</span>
                    </Table.Summary.Cell>
                  ))}
                </Table.Summary.Row>
              </Table.Summary>
            ) : null
          }
        />
      </section>
    </>
  );
}

/** Phễu ngang: thanh dài theo tỷ lệ so với bước đầu, kèm % chuyển đổi từ bước trước. */
function Funnel({
  title,
  steps,
  format,
  pct,
  roas,
}: {
  title: string;
  steps: { key: Metric; label: string; value: number | null }[];
  format: (m: Metric, v: number | null) => string;
  pct: (v: number | null) => string;
  roas: string | null;
}) {
  const t = useTranslations("reports");
  const max = Math.max(1, ...steps.map((s) => s.value ?? 0));
  return (
    <section className="surface flex min-w-0 flex-col gap-3 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {roas ? (
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">{roas}</span>
        ) : null}
      </div>
      <ol className="flex flex-col gap-2.5">
        {steps.map((s, i) => {
          const conv = i > 0 ? ratio(s.value, steps[i - 1].value) : null;
          return (
            <li key={s.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="flex items-baseline gap-2">
                  {i > 0 ? (
                    <span className="text-xs text-muted-foreground">{t("conversion", { pct: pct(conv) })}</span>
                  ) : null}
                  <span className="font-semibold tabular-nums">{format(s.key, s.value)}</span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-500", BAR[META[s.key].tone])}
                  style={{ width: `${((s.value ?? 0) / max) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Biểu đồ cột theo ngày bằng CSS (không thêm thư viện chart). */
function TrendBars({
  rows,
  value,
  label,
  tick,
}: {
  rows: DayRow[];
  value: (r: DayRow) => number | null;
  label: (r: DayRow) => string;
  tick: (d: string) => string;
}) {
  const t = useTranslations("reports");
  const values = rows.map(value);
  const max = Math.max(0, ...values.map((v) => v ?? 0));
  if (!rows.length || values.every((v) => v == null))
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("noData")}</p>;
  // Nhãn trục: tối đa ~8 mốc để không chồng chữ.
  const step = Math.ceil(rows.length / 8);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-44 items-end gap-0.5 border-b border-border sm:gap-1">
        {rows.map((r, i) => {
          const v = values[i] ?? 0;
          return (
            <Tooltip key={r.date} title={label(r)}>
              <div className="group flex h-full min-w-0 flex-1 items-end">
                <div
                  className="w-full rounded-t-sm bg-primary/70 transition-[height] duration-500 group-hover:bg-primary"
                  style={{ height: max ? `${Math.max((v / max) * 100, v ? 2 : 0)}%` : 0 }}
                />
              </div>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex gap-0.5 sm:gap-1">
        {rows.map((r, i) => (
          <span key={r.date} className="min-w-0 flex-1 overflow-visible text-center text-[10px] whitespace-nowrap text-muted-foreground">
            {i % step === 0 ? tick(r.date) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
