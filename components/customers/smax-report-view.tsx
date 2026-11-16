"use client";

import * as React from "react";
import { Alert, Button, Table, Tooltip, type TableProps } from "antd";
import { useLocale, useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";

import { getInboxReport } from "@/app/(app)/customers/smax-report/actions";
import { ClearableSelect } from "@/components/common/clearable-select";
import { DateRangeFilter, initialRange } from "@/components/common/date-range-filter";
import { StatCard } from "@/components/common/stat-card";
import { PageHeader, PageToolbar } from "@/components/layout/page";
import {
  INBOX_STAFF,
  INBOX_STATUSES,
  statusTotal,
  sumChannels,
  UNASSIGNED,
  type ChannelCounts,
  type InboxCounts,
  type InboxStatus,
} from "@/lib/smax-inbox";
import { cn } from "@/lib/utils";

type Result = Awaited<ReturnType<typeof getInboxReport>>;

// Màu trạng thái dùng chung cho thanh phân bổ + chấm chú thích.
const STATUS_COLOR: Record<InboxStatus, string> = {
  booking: "var(--success)",
  followUp: "var(--info)",
  pending: "var(--warning)",
};

function useFormat() {
  const locale = useLocale();
  return {
    num: (v: number) => v.toLocaleString(locale),
    pct: (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "-"),
  };
}

export function SmaxReportView() {
  const t = useTranslations("smaxReport");
  const { num, pct } = useFormat();
  const [range, setRange] = React.useState(() => initialRange("today"));
  const [staff, setStaff] = React.useState("");
  const [result, setResult] = React.useState<Result | null>(null);
  const [pending, startTransition] = React.useTransition();
  const requestId = React.useRef(0);

  const load = React.useCallback(() => {
    const current = ++requestId.current;
    startTransition(async () => {
      const next = await getInboxReport(range.from, range.to);
      if (current === requestId.current) setResult(next);
    });
  }, [range]);
  React.useEffect(load, [load]);

  const report = result?.data ?? null;
  // Lọc Telesales chỉ đổi phạm vi số liệu (tính sẵn ở server) — không gọi lại API.
  const scope: ChannelCounts | null = report
    ? staff
      ? (report.staff.find((s) => s.alias === staff)?.counts ?? null)
      : report.total
    : null;
  const sum = scope ? sumChannels(scope) : null;
  const all = sum ? statusTotal(sum) : 0;
  const loading = !result;

  const staffOptions = [
    ...INBOX_STAFF.map((s) => ({ value: s.alias, label: s.name })),
    { value: UNASSIGNED, label: t("unassigned") },
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button icon={<RefreshCw className={cn("size-4", pending && "animate-spin")} />} onClick={load}>
            {t("refresh")}
          </Button>
        }
      />

      <PageToolbar>
        <DateRangeFilter value={range} onChange={setRange} />
        <ClearableSelect
          value={staff}
          onChange={setStaff}
          options={staffOptions}
          placeholder={t("allStaff")}
          ariaLabel={t("staff")}
          className="w-48 max-sm:w-full"
          searchable
        />
      </PageToolbar>

      {result?.error ? <Alert type="error" showIcon title={result.error} /> : null}

      <div className={cn("flex flex-col gap-4 transition-opacity duration-200", pending && result && "opacity-60")}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={t("card.total")}
            loading={loading}
            value={sum ? num(all) : "-"}
            hint={sum ? t("hint.total", { untagged: num(sum.untagged) }) : undefined}
          />
          {INBOX_STATUSES.map((s) => (
            <StatCard
              key={s}
              loading={loading}
              label={
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                  {t(`status.${s}`)}
                </span>
              }
              value={
                sum ? (
                  <span className="flex items-baseline gap-2">
                    {num(sum[s])}
                    <span className="text-sm font-medium text-muted-foreground">{pct(sum[s], all)}</span>
                  </span>
                ) : (
                  "-"
                )
              }
              hint={
                scope
                  ? [`WA ${num(scope.wa[s])} · IG ${num(scope.ig[s])}`, s === "booking" && sum ? t("hint.deposit", { n: num(sum.deposit) }) : null]
                      .filter(Boolean)
                      .join(" · ")
                  : undefined
              }
            />
          ))}
        </div>

        <Section title={t("byChannel")}>
          <ChannelTable scope={scope} loading={loading} />
        </Section>

        {!staff ? (
          <Section
            title={t("byStaff")}
            extra={
              <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {INBOX_STATUSES.map((s) => (
                  <span key={s} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                    {t(`status.${s}`)}
                  </span>
                ))}
              </span>
            }
          >
            <StaffTable report={report} loading={loading} onPick={setStaff} />
          </Section>
        ) : null}

        <p className="text-xs text-muted-foreground">{t("tagNote")}</p>
      </div>

    </>
  );
}

function Section({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="surface flex min-w-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

type ChannelRow = { key: string; label: string; counts: InboxCounts; strong?: boolean };

/** Bảng theo kênh (mẫu "Inbox destination"): WA / IG / Tổng × trạng thái, ô kèm % theo dòng. */
function ChannelTable({ scope, loading }: { scope: ChannelCounts | null; loading: boolean }) {
  const t = useTranslations("smaxReport");
  const { num, pct } = useFormat();
  const rows: ChannelRow[] = scope
    ? [
        { key: "wa", label: "WhatsApp", counts: scope.wa },
        { key: "ig", label: "Instagram", counts: scope.ig },
        { key: "total", label: t("total"), counts: sumChannels(scope), strong: true },
      ]
    : [];

  const columns: TableProps<ChannelRow>["columns"] = [
    { key: "label", title: t("channel"), render: (_, r) => <span className={cn(r.strong ? "font-semibold" : "font-medium")}>{r.label}</span> },
    ...INBOX_STATUSES.map((s) => ({
      key: s,
      title: t(`status.${s}`),
      align: "right" as const,
      render: (_: unknown, r: ChannelRow) => (
        <span className="whitespace-nowrap tabular-nums">
          <span className={cn(r.strong && "font-semibold")}>{num(r.counts[s])}</span>
          <span className="ml-1.5 text-xs text-muted-foreground">{pct(r.counts[s], statusTotal(r.counts))}</span>
        </span>
      ),
    })),
    {
      key: "all",
      title: t("total"),
      align: "right",
      render: (_, r) => <span className="font-semibold tabular-nums">{num(statusTotal(r.counts))}</span>,
    },
  ];

  return (
    <Table<ChannelRow>
      rowKey="key"
      columns={columns}
      dataSource={rows}
      pagination={false}
      size="middle"
      loading={loading}
      scroll={{ x: "max-content" }}
      rowClassName={(r) => (r.strong ? "bg-muted/40" : "")}
    />
  );
}

type StaffRow = { alias: string; name: string; sum: InboxCounts; all: number };

/** Bảng theo Telesales: số theo trạng thái + thanh phân bổ; bấm dòng để lọc theo người đó. */
function StaffTable({
  report,
  loading,
  onPick,
}: {
  report: Result["data"];
  loading: boolean;
  onPick: (alias: string) => void;
}) {
  const t = useTranslations("smaxReport");
  const { num, pct } = useFormat();
  const rows: StaffRow[] = (report?.staff ?? [])
    .map((s) => {
      const sum = sumChannels(s.counts);
      return { alias: s.alias, name: s.alias === UNASSIGNED ? t("unassigned") : s.name, sum, all: statusTotal(sum) };
    })
    // Nhiều hội thoại nhất lên đầu; "Chưa gán" luôn cuối.
    .sort((a, b) => Number(a.alias === UNASSIGNED) - Number(b.alias === UNASSIGNED) || b.all - a.all);

  const columns: TableProps<StaffRow>["columns"] = [
    {
      key: "name",
      title: t("staff"),
      render: (_, r) => (
        <span className={cn("whitespace-nowrap font-medium", r.alias === UNASSIGNED && "text-muted-foreground")}>{r.name}</span>
      ),
    },
    ...INBOX_STATUSES.map((s) => ({
      key: s,
      title: t(`status.${s}`),
      align: "right" as const,
      render: (_: unknown, r: StaffRow) => <span className="tabular-nums">{num(r.sum[s])}</span>,
    })),
    { key: "all", title: t("total"), align: "right", render: (_, r) => <span className="font-semibold tabular-nums">{num(r.all)}</span> },
    {
      key: "rate",
      title: t("bookingRate"),
      align: "right",
      render: (_, r) => <span className="tabular-nums">{pct(r.sum.booking, r.all)}</span>,
    },
    {
      key: "bar",
      title: t("distribution"),
      width: 200,
      render: (_, r) =>
        r.all ? (
          <Tooltip title={INBOX_STATUSES.map((s) => `${t(`status.${s}`)}: ${num(r.sum[s])}`).join(" · ")}>
            <div className="flex h-2 w-full min-w-32 overflow-hidden rounded-full bg-muted">
              {INBOX_STATUSES.map((s) => (
                <div key={s} style={{ width: `${(r.sum[s] / r.all) * 100}%`, background: STATUS_COLOR[s] }} />
              ))}
            </div>
          </Tooltip>
        ) : (
          <div className="h-2 w-full min-w-32 rounded-full bg-muted" />
        ),
    },
  ];

  return (
    <Table<StaffRow>
      rowKey="alias"
      columns={columns}
      dataSource={rows}
      pagination={false}
      size="middle"
      loading={loading}
      scroll={{ x: "max-content" }}
      onRow={(r) => ({ onClick: () => onPick(r.alias), className: "cursor-pointer" })}
    />
  );
}
