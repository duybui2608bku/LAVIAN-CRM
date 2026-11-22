"use client";

import * as React from "react";
import { Alert, Button, Empty, Segmented, Table, Tooltip } from "antd";
import dayjs from "dayjs";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";

import { getReport, type Report } from "@/app/(app)/reports/actions";
import { DataTable } from "@/components/common/data-table";
import { MetricList } from "@/components/common/metric-list";
import { Section } from "@/components/common/section";
import { StatCard } from "@/components/common/stat-card";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { DateRangeFilter, initialRange } from "@/components/common/date-range-filter";
import { PageHeader, PageToolbar } from "@/components/layout/page";
import { formatRupiah, IDR_CURRENCY } from "@/lib/currency";
import {
  AD_MONEY,
  change,
  LOWER_IS_BETTER,
  METRICS,
  ratio,
  SALES_RATE,
  totals,
  type DayRow,
  type Metric,
  type Totals,
} from "@/lib/reports";
import { cn } from "@/lib/utils";

const FB_METRICS: ReadonlySet<Metric> = new Set(["spend", "messages", "costPerMessage", "costPerData"]);

/** Chỉ số của 1 ngày (dòng bảng / cột biểu đồ). */
const dayTotals = (r: DayRow): Totals => totals([r]);

export function ReportsView() {
  const t = useTranslations("reports");
  const locale = useLocale();
  const mobile = useIsMobile();
  const [range, setRange] = React.useState(() => initialRange("last7"));
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

  // ---- Chia kỳ hiện tại / kỳ trước ----
  const to = range.to || range.from;
  const rows = report?.rows.filter((r) => r.date >= range.from && r.date <= to) ?? [];
  const prevRows = report ? report.rows.filter((r) => r.date < range.from) : [];
  const cur = report ? totals(rows) : null;
  const prev = report ? totals(prevRows) : null;
  const errorOf = (m: Metric) => (FB_METRICS.has(m) ? report?.errors.fb : report?.errors.db);

  // ROAS chỉ có nghĩa khi tiền quảng cáo cùng đơn vị Rupiah với doanh thu.
  const roas = currency === IDR_CURRENCY ? ratio(cur?.revenue ?? null, cur?.spend ?? null) : null;

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <Button icon={<RefreshCw className={cn("size-4", pending && "animate-spin")} />} onClick={load}>
            {t("refresh")}
          </Button>
        }
      />

      <PageToolbar>
        <DateRangeFilter value={{ from: range.from, to }} onChange={setRange} />
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
          return (
            <StatCard
              key={m}
              label={t(`metric.${m}`)}
              loading={!report}
              value={
                value == null && errorOf(m) ? (
                  <Tooltip title={errorOf(m)}>
                    <span className="text-muted-foreground">—</span>
                  </Tooltip>
                ) : (
                  <span title={fmt(m, value)}>{fmt(m, value)}</span>
                )
              }
              hint={
                <span className="flex flex-wrap items-center gap-x-2">
                  {delta != null ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 font-medium tabular-nums",
                        m !== "spend" && (good ? "text-success" : "text-destructive"),
                      )}
                      title={t("vsPrevious", { value: fmt(m, prev?.[m] ?? null) })}
                    >
                      {delta > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                      {pct(Math.abs(delta))}
                    </span>
                  ) : null}
                  {/* ROAS hiện 1 chỗ duy nhất: dưới card Doanh thu. */}
                  {m === "revenue" && roas != null
                    ? t("hint.roas", { x: roas.toLocaleString(locale, { maximumFractionDigits: 2 }) })
                    : null}
                </span>
              }
            />
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
        />

        <Section
          className="surface p-4"
          title={t("trend")}
          extra={
            <Segmented<Metric>
              size="small"
              className="min-w-0 max-w-full overflow-x-auto"
              value={chartMetric}
              onChange={setChartMetric}
              options={(["spend", "messages", "data", "deposits", "bookings", "revenue"] as const).map((m) => ({
                value: m,
                label: t(`metric.${m}`),
              }))}
            />
          }
        >
          <TrendBars
            rows={rows}
            value={(r) => dayTotals(r)[chartMetric]}
            label={(r) => `${weekday(r.date)} ${ddmm(r.date)}: ${fmt(chartMetric, dayTotals(r)[chartMetric])}`}
            tick={ddmm}
          />
        </Section>
      </div>

      <Section title={t("daily")}>
        {mobile ? (
          <div className="surface overflow-hidden">
            <MetricList
              loading={pending && !report}
              rows={[
                ...(cur && rows.length > 1
                  ? [{ key: "total", title: t("total"), strong: true, metrics: METRICS.map((m) => ({ label: t(`metric.${m}`), value: fmt(m, cur[m]) })) }]
                  : []),
                ...[...rows].reverse().map((r) => ({
                  key: r.date,
                  title: (
                    <span>
                      <span className="text-muted-foreground">{weekday(r.date)}</span> {ddmm(r.date)}
                    </span>
                  ),
                  metrics: METRICS.map((m) => ({ label: t(`metric.${m}`), value: fmt(m, dayTotals(r)[m]) })),
                })),
              ]}
            />
          </div>
        ) : (
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
        )}
      </Section>

      {/* Hoa hồng Sales = 5% tiền thực thu của thẻ (cọc trừ vào thẻ + các lần thu − hoàn), theo người tạo thẻ. */}
      <Section title={t("salesCommission", { rate: SALES_RATE * 100 })}>
        <DataTable<NonNullable<Report["sales"]>[number]>
          rowKey="seller"
          loading={pending && !report}
          dataSource={report?.sales ?? []}
          empty={t("salesEmpty")}
          columns={[
            { key: "seller", title: t("seller"), dataIndex: "seller" },
            { key: "collected", title: t("collected"), align: "right", render: (_, r) =>
              <span className="tabular-nums">{formatRupiah(r.collected)}</span> },
            { key: "commission", title: t("commission"), align: "right", render: (_, r) =>
              <span className="font-medium tabular-nums">{formatRupiah(r.commission)}</span> },
          ]}
          summary={(data) => data.length > 1 ? (
            <Table.Summary>
              <Table.Summary.Row className="bg-muted/50 font-semibold">
                <Table.Summary.Cell index={0}>{t("total")}</Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <span className="tabular-nums">{formatRupiah(data.reduce((s, r) => s + r.collected, 0))}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <span className="tabular-nums">{formatRupiah(data.reduce((s, r) => s + r.commission, 0))}</span>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          ) : null}
        />
      </Section>
    </>
  );
}

/** Phễu ngang: thanh dài theo tỷ lệ so với bước đầu, kèm % chuyển đổi từ bước trước. */
function Funnel({
  title,
  steps,
  format,
  pct,
}: {
  title: string;
  steps: { key: Metric; label: string; value: number | null }[];
  format: (m: Metric, v: number | null) => string;
  pct: (v: number | null) => string;
}) {
  const t = useTranslations("reports");
  const max = Math.max(1, ...steps.map((s) => s.value ?? 0));
  return (
    <Section className="surface p-4" title={title}>
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
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${((s.value ?? 0) / max) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
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
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noData")} />;

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
