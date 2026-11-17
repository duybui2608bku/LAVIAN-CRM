"use client";

import * as React from "react";
import { Alert, Button, Table, Tooltip, type TableProps } from "antd";
import { useLocale, useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";

import { getInboxReport } from "@/app/(app)/customers/smax-report/actions";
import { ClearableSelect } from "@/components/common/clearable-select";
import { DateRangePicker } from "@/components/common/date-picker";
import { initialRange } from "@/components/common/date-range-filter";
import { UserAvatar } from "@/components/common/user-avatar";
import { StatCard } from "@/components/common/stat-card";
import { PageToolbar } from "@/components/layout/page";
import {
  INBOX_CHANNELS,
  INBOX_STAFF,
  INBOX_STATUSES,
  statusTotal,
  sumChannels,
  UNASSIGNED,
  type ChannelCounts,
  type InboxChannel,
  type InboxCounts,
  type InboxStatus,
} from "@/lib/smax-inbox";
import { cn } from "@/lib/utils";

type Result = Awaited<ReturnType<typeof getInboxReport>>;

const CHANNEL_LABEL: Record<InboxChannel, string> = { wa: "WhatsApp", ig: "Instagram" };

/** Số theo trạng thái của một kênh, hoặc cộng mọi kênh khi không lọc nguồn. */
const pickChannel = (c: ChannelCounts, channel: InboxChannel | "") => (channel ? c[channel] : sumChannels(c));

// Màu trạng thái dùng chung cho thanh phân bổ + chấm chú thích.
const STATUS_COLOR: Record<InboxStatus, string> = {
  booking: "var(--success)",
  potential: "var(--destructive)",
  followUp: "var(--info)",
  pending: "var(--warning)",
  spam: "var(--muted-foreground)",
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
  const [channel, setChannel] = React.useState<InboxChannel | "">("");
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
  // Lọc Telesales / nguồn chỉ đổi phạm vi số liệu (tính sẵn ở server) — không gọi lại API.
  const scope: ChannelCounts | null = report
    ? staff
      ? (report.staff.find((s) => s.alias === staff)?.counts ?? null)
      : report.total
    : null;
  const sum = scope ? pickChannel(scope, channel) : null;
  const all = sum?.conversations ?? 0;
  const loading = !result;

  const staffOptions = [
    ...INBOX_STAFF.map((s) => ({ value: s.alias, label: s.name })),
    { value: UNASSIGNED, label: t("unassigned") },
  ];

  return (
    <>
      <PageToolbar>
        <DateRangePicker
          from={range.from}
          to={range.to}
          allowClear={false}
          onChange={(r) => r.from && setRange({ from: r.from, to: r.to || r.from })}
        />
        <ClearableSelect
          value={staff}
          onChange={setStaff}
          options={staffOptions}
          placeholder={t("allStaff")}
          ariaLabel={t("staff")}
          className="w-48 max-sm:w-full"
          searchable
        />
        <ClearableSelect
          value={channel}
          onChange={(v) => setChannel(v as InboxChannel | "")}
          options={INBOX_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
          placeholder={t("allSources")}
          ariaLabel={t("source")}
          className="w-40 max-sm:w-full"
        />
        <Button icon={<RefreshCw className={cn("size-4", pending && "animate-spin")} />} onClick={load}>
          {t("refresh")}
        </Button>
      </PageToolbar>

      {result?.error ? <Alert type="error" showIcon title={result.error} /> : null}

      <div className={cn("flex flex-col gap-4 transition-opacity duration-200", pending && result && "opacity-60")}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
                  ? [
                      channel ? null : `WA ${num(scope.wa[s])} · IG ${num(scope.ig[s])}`,
                      ...(s === "booking" && sum
                        ? [t("hint.deposit", { n: num(sum.deposit) }), t("hint.bookingOld", { n: num(sum.bookingOld) })]
                        : []),
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : undefined
              }
            />
          ))}
        </div>

        <Section title={t("byChannel")}>
          <ChannelTable scope={scope} channel={channel} loading={loading} />
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
            <StaffTable report={report} channel={channel} avatars={result?.avatars} loading={loading} onPick={setStaff} />
          </Section>
        ) : null}
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
function ChannelTable({ scope, channel, loading }: { scope: ChannelCounts | null; channel: InboxChannel | ""; loading: boolean }) {
  const t = useTranslations("smaxReport");
  const { num, pct } = useFormat();
  // Lọc nguồn → chỉ còn dòng kênh đó (không cần dòng Tổng).
  const rows: ChannelRow[] = !scope
    ? []
    : channel
      ? [{ key: channel, label: CHANNEL_LABEL[channel], counts: scope[channel] }]
      : [
          ...INBOX_CHANNELS.map((c) => ({ key: c, label: CHANNEL_LABEL[c], counts: scope[c] })),
          { key: "total", label: t("total"), counts: sumChannels(scope), strong: true },
        ];

  const columns: TableProps<ChannelRow>["columns"] = [
    { key: "label", title: t("channel"), render: (_, r) => <span className={cn(r.strong ? "font-semibold" : "font-medium")}>{r.label}</span> },
    ...INBOX_STATUSES.map((s) => ({
      key: s,
      title: t(`status.${s}`),
      align: "right" as const,
      render: (_: unknown, r: ChannelRow) => (
        <span className="whitespace-nowrap tabular-nums">
          <span className={cn(r.strong && "font-semibold")}>{num(r.counts[s])}</span>
          <span className="ml-1.5 text-xs text-muted-foreground">{pct(r.counts[s], r.counts.conversations)}</span>
        </span>
      ),
    })),
    {
      key: "all",
      title: t("total"),
      align: "right",
      render: (_, r) => <span className="font-semibold tabular-nums">{num(r.counts.conversations)}</span>,
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

type StaffRow = { alias: string; name: string; sum: InboxCounts; all: number; bar: number };

/** Bảng theo Telesales: số theo trạng thái + thanh phân bổ; bấm dòng để lọc theo người đó. */
function StaffTable({
  report,
  channel,
  avatars,
  loading,
  onPick,
}: {
  report: Result["data"];
  channel: InboxChannel | "";
  avatars?: Result["avatars"];
  loading: boolean;
  onPick: (alias: string) => void;
}) {
  const t = useTranslations("smaxReport");
  const { num, pct } = useFormat();
  const rows: StaffRow[] = (report?.staff ?? [])
    .map((s) => {
      const sum = pickChannel(s.counts, channel);
      return { alias: s.alias, name: s.alias === UNASSIGNED ? t("unassigned") : s.name, sum, all: sum.conversations, bar: statusTotal(sum) };
    })
    // Nhiều hội thoại mới nhất lên đầu; "Chưa gán" luôn cuối.
    .sort((a, b) => Number(a.alias === UNASSIGNED) - Number(b.alias === UNASSIGNED) || b.all - a.all || b.sum.booking - a.sum.booking);

  const columns: TableProps<StaffRow>["columns"] = [
    {
      key: "name",
      title: t("staff"),
      render: (_, r) => (
        <span className={cn("flex items-center gap-2 whitespace-nowrap font-medium", r.alias === UNASSIGNED && "text-muted-foreground")}>
          {r.alias === UNASSIGNED ? null : <UserAvatar src={avatars?.[r.alias]} size={24} />}
          {r.name}
        </span>
      ),
    },
    // Cột Old Booking ngay sau Booking (đã nằm trong số Booking).
    ...[...INBOX_STATUSES.slice(0, 1), "bookingOld" as const, ...INBOX_STATUSES.slice(1)].map((s) => ({
      key: s,
      title: s === "bookingOld" ? t("bookingOld") : t(`status.${s}`),
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
        r.bar ? (
          <Tooltip title={INBOX_STATUSES.map((s) => `${t(`status.${s}`)}: ${num(r.sum[s])}`).join(" · ")}>
            <div className="flex h-2 w-full min-w-32 overflow-hidden rounded-full bg-muted">
              {INBOX_STATUSES.map((s) => (
                <div key={s} style={{ width: `${(r.sum[s] / r.bar) * 100}%`, background: STATUS_COLOR[s] }} />
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
