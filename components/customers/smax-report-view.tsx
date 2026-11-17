"use client";

import * as React from "react";
import { Alert, Button, Table, Tooltip, type TableProps } from "antd";
import { useLocale, useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";

import { getSmaxReport } from "@/app/(app)/customers/smax-report/actions";
import { ClearableSelect } from "@/components/common/clearable-select";
import { MetricList } from "@/components/common/metric-list";
import { useIsMobile } from "@/hooks/use-is-mobile";
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
  type FollowupCounts,
  type FollowupReport,
  type InboxChannel,
  type InboxCounts,
  type InboxReport,
  type InboxStatus,
} from "@/lib/smax-inbox";
import { cn } from "@/lib/utils";

type Result = Awaited<ReturnType<typeof getSmaxReport>>;
type Avatars = Result["avatars"];

const CHANNEL_LABEL: Record<InboxChannel, string> = { wa: "WhatsApp", ig: "Instagram" };
// Cùng màu nguồn với donut trang Leader Telesales.
const CHANNEL_COLOR: Record<InboxChannel, string> = { wa: "var(--chart-3)", ig: "var(--chart-5)" };

/** Số theo trạng thái của một kênh, hoặc cộng mọi kênh khi không lọc nguồn. */
const pickChannel = (c: ChannelCounts, channel: InboxChannel | "") => (channel ? c[channel] : sumChannels(c));
/** Booking của khách mới = tổng Booking − Booking khách cũ. */
const bookingNew = (c: InboxCounts) => c.booking - c.bookingOld;

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
  const tf = useTranslations("smaxFollowup");
  const { num } = useFormat();
  const [range, setRange] = React.useState(() => initialRange("today"));
  const [staff, setStaff] = React.useState("");
  const [channel, setChannel] = React.useState<InboxChannel | "">("");
  const [result, setResult] = React.useState<Result | null>(null);
  const [pending, startTransition] = React.useTransition();
  const requestId = React.useRef(0);

  const load = React.useCallback(() => {
    const current = ++requestId.current;
    startTransition(async () => {
      const next = await getSmaxReport(range.from, range.to);
      if (current === requestId.current) setResult(next);
    });
  }, [range]);
  React.useEffect(load, [load]);

  const report = result?.data?.inbox ?? null;
  // Lọc Telesales / nguồn chỉ đổi phạm vi số liệu (tính sẵn ở server) — không gọi lại API.
  const scope: ChannelCounts | null = report
    ? staff
      ? (report.staff.find((s) => s.alias === staff)?.counts ?? null)
      : report.total
    : null;
  const sum = scope ? pickChannel(scope, channel) : null;
  const loading = !result;
  /** "WA x · IG y" khi đang xem mọi nguồn. */
  const split = (f: (c: InboxCounts) => number) => (scope && !channel ? `WA ${num(f(scope.wa))} · IG ${num(f(scope.ig))}` : null);

  const cards: { key: string; value: (c: InboxCounts) => number; hint?: (c: InboxCounts) => React.ReactNode }[] = [
    { key: "reEngaged", value: (c) => c.reEngaged, hint: () => split((c) => c.reEngaged) },
    { key: "newCustomers", value: (c) => c.conversations, hint: () => split((c) => c.conversations) },
    {
      key: "bookingTotal",
      value: (c) => c.booking,
      hint: (c) => [split((c) => c.booking), t("hint.deposit", { n: num(c.deposit) })].filter(Boolean).join(" · "),
    },
    { key: "bookingNew", value: bookingNew, hint: (c) => t("hint.bookingOld", { n: num(c.bookingOld) }) },
    { key: "showUp", value: (c) => c.showUp, hint: () => split((c) => c.showUp) },
  ];

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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 max-sm:[&>*:last-child]:col-span-2">
          {cards.map((c) => (
            <StatCard
              key={c.key}
              label={t(`card.${c.key}`)}
              loading={loading}
              value={sum ? num(c.value(sum)) : "-"}
              hint={sum ? c.hint?.(sum) : undefined}
            />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-10">
          <Section title={t("byChannel")} className="lg:col-span-7">
            <ChannelTable scope={scope} channel={channel} loading={loading} />
          </Section>
          <Section title={t("bySource")} className="lg:col-span-3">
            <BookingDonut scope={scope} />
          </Section>
        </div>

        {!staff ? (
          <>
            <Section
              title={t("byStaff")}
              extra={
                <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground max-sm:hidden">
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
            <Section title={tf("byStaff")}>
              <FollowupTable report={result?.data?.followup ?? null} avatars={result?.avatars} loading={loading} onPick={setStaff} />
            </Section>
          </>
        ) : null}
      </div>
    </>
  );
}

function Section({
  title,
  extra,
  className,
  children,
}: {
  title: string;
  extra?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("surface flex min-w-0 flex-col gap-3 p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

/** Donut Tổng Booking theo nguồn (WA / IG) của phạm vi đang xem. */
function BookingDonut({ scope }: { scope: ChannelCounts | null }) {
  const t = useTranslations("smaxReport");
  const { num, pct } = useFormat();
  const total = scope ? INBOX_CHANNELS.reduce((n, c) => n + scope[c].booking, 0) : 0;
  const R = 37;
  const W = 22; // vòng dày
  const C = 2 * Math.PI * R;
  const GAP = scope && INBOX_CHANNELS.every((c) => scope[c].booking) ? 1.5 : 0; // khe giữa 2 lát
  let offset = 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
      <div className="relative size-44 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={t("bySource")}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--muted)" strokeWidth={W} />
          {scope && total > 0
            ? INBOX_CHANNELS.map((c) => {
                const len = (scope[c].booking / total) * C;
                const el = len ? (
                  <circle
                    key={c}
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    stroke={CHANNEL_COLOR[c]}
                    strokeWidth={W}
                    strokeDasharray={`${Math.max(len - GAP, 0.5)} ${C}`}
                    strokeDashoffset={-offset}
                  >
                    <title>{`${CHANNEL_LABEL[c]}: ${num(scope[c].booking)} (${pct(scope[c].booking, total)})`}</title>
                  </circle>
                ) : null;
                offset += len;
                return el;
              })
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{total ? num(total) : "-"}</span>
          <span className="text-xs text-muted-foreground">Booking</span>
        </div>
      </div>
      <ul className="flex w-full max-w-56 flex-col gap-2 text-sm">
        {INBOX_CHANNELS.map((c) => {
          const n = scope?.[c].booking ?? 0;
          return (
            <li key={c} className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-sm" style={{ background: CHANNEL_COLOR[c] }} />
              <span className="flex-1 truncate">{CHANNEL_LABEL[c]}</span>
              <span className="tabular-nums">
                {n ? (
                  <>
                    <span className="font-medium">{num(n)}</span>
                    <span className="text-xs text-muted-foreground"> ({pct(n, total)})</span>
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

/** Nhãn trạng thái kèm chấm màu (dùng trong lưới số điện thoại). */
function StatusLabel({ status }: { status: InboxStatus }) {
  const t = useTranslations("smaxReport");
  return (
    <span className="flex items-center gap-1">
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[status] }} />
      <span className="truncate">{t(`status.${status}`)}</span>
    </span>
  );
}

/** Tên Telesales + avatar ("Chưa gán" mờ, không avatar). */
function StaffName({ alias, name, avatars }: { alias: string; name: string; avatars?: Avatars }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2 whitespace-nowrap font-medium", alias === UNASSIGNED && "text-muted-foreground")}>
      {alias === UNASSIGNED ? null : <UserAvatar src={avatars?.[alias]} size={24} />}
      <span className="truncate">{name}</span>
    </span>
  );
}

type ChannelRow = { key: string; label: string; counts: InboxCounts; strong?: boolean };

/** Bảng theo kênh (mẫu "Inbox destination"): WA / IG / Tổng × trạng thái, ô kèm % theo dòng. */
function ChannelTable({ scope, channel, loading }: { scope: ChannelCounts | null; channel: InboxChannel | ""; loading: boolean }) {
  const t = useTranslations("smaxReport");
  const { num, pct } = useFormat();
  const mobile = useIsMobile();
  // Lọc nguồn → chỉ còn dòng kênh đó (không cần dòng Tổng).
  const rows: ChannelRow[] = !scope
    ? []
    : channel
      ? [{ key: channel, label: CHANNEL_LABEL[channel], counts: scope[channel] }]
      : [
          ...INBOX_CHANNELS.map((c) => ({ key: c, label: CHANNEL_LABEL[c], counts: scope[c] })),
          { key: "total", label: t("total"), counts: sumChannels(scope), strong: true },
        ];

  if (mobile)
    return (
      <MetricList
        className="-mx-4"
        loading={loading}
        rows={rows.map((r) => ({
          key: r.key,
          title: r.label,
          strong: r.strong,
          aside: (
            <span className="text-sm">
              <span className="font-semibold">{num(r.counts.conversations)}</span>{" "}
              <span className="text-xs text-muted-foreground">{t("card.newCustomers")}</span>
            </span>
          ),
          metrics: INBOX_STATUSES.map((s) => ({
            label: <StatusLabel status={s} />,
            value: num(r.counts[s]),
            sub: pct(r.counts[s], r.counts.conversations),
          })),
        }))}
      />
    );

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
  report: InboxReport | null;
  channel: InboxChannel | "";
  avatars?: Avatars;
  loading: boolean;
  onPick: (alias: string) => void;
}) {
  const t = useTranslations("smaxReport");
  const { num, pct } = useFormat();
  const mobile = useIsMobile();
  const rows: StaffRow[] = (report?.staff ?? [])
    .map((s) => {
      const sum = pickChannel(s.counts, channel);
      return { alias: s.alias, name: s.alias === UNASSIGNED ? t("unassigned") : s.name, sum, all: sum.conversations, bar: statusTotal(sum) };
    })
    // Nhiều hội thoại mới nhất lên đầu; "Chưa gán" luôn cuối.
    .sort((a, b) => Number(a.alias === UNASSIGNED) - Number(b.alias === UNASSIGNED) || b.all - a.all || b.sum.booking - a.sum.booking);

  const bar = (r: StaffRow) =>
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
    );
  const name = (r: StaffRow) => <StaffName alias={r.alias} name={r.name} avatars={avatars} />;

  if (mobile)
    return (
      <MetricList
        className="-mx-4"
        loading={loading}
        rows={rows.map((r) => ({
          key: r.alias,
          title: name(r),
          onClick: () => onPick(r.alias),
          aside: (
            <span className="text-sm">
              <span className="font-semibold">{num(r.all)}</span>{" "}
              <span className="text-xs text-muted-foreground">{t("card.newCustomers")}</span>
            </span>
          ),
          metrics: [
            { label: <StatusLabel status="booking" />, value: num(r.sum.booking), sub: pct(r.sum.booking, r.all) },
            { label: t("bookingNew"), value: num(bookingNew(r.sum)) },
            ...INBOX_STATUSES.slice(1).map((s) => ({ label: <StatusLabel status={s} />, value: num(r.sum[s]) })),
          ],
          footer: bar(r),
        }))}
      />
    );

  const columns: TableProps<StaffRow>["columns"] = [
    {
      key: "name",
      title: t("staff"),
      render: (_, r) => name(r),
    },
    // Cột New Booking ngay sau Booking (đã nằm trong số Booking).
    ...[...INBOX_STATUSES.slice(0, 1), "bookingNew" as const, ...INBOX_STATUSES.slice(1)].map((s) => ({
      key: s,
      title: s === "bookingNew" ? t("bookingNew") : t(`status.${s}`),
      align: "right" as const,
      render: (_: unknown, r: StaffRow) => <span className="tabular-nums">{num(s === "bookingNew" ? bookingNew(r.sum) : r.sum[s])}</span>,
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
      render: (_, r) => bar(r),
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

type FollowupRow = { alias: string; name: string; c: FollowupCounts };

/** Bảng Follow up (bào data cũ) theo Telesales; bấm dòng để lọc theo người đó. */
function FollowupTable({
  report,
  avatars,
  loading,
  onPick,
}: {
  report: FollowupReport | null;
  avatars?: Avatars;
  loading: boolean;
  onPick: (alias: string) => void;
}) {
  const t = useTranslations("smaxFollowup");
  const tr = useTranslations("smaxReport");
  const { num, pct } = useFormat();
  const mobile = useIsMobile();
  const rows: FollowupRow[] = (report?.staff ?? [])
    .map((s) => ({ alias: s.alias, name: s.alias === UNASSIGNED ? tr("unassigned") : s.name, c: s.counts }))
    // Bào nhiều nhất lên đầu; "Chưa gán" luôn cuối.
    .sort((a, b) => Number(a.alias === UNASSIGNED) - Number(b.alias === UNASSIGNED) || b.c.worked - a.c.worked);
  const name = (r: FollowupRow) => <StaffName alias={r.alias} name={r.name} avatars={avatars} />;

  if (mobile)
    return (
      <MetricList
        className="-mx-4"
        loading={loading}
        rows={rows.map((r) => ({
          key: r.alias,
          title: name(r),
          onClick: () => onPick(r.alias),
          aside: (
            <span className="text-sm">
              <span className="font-semibold">{num(r.c.worked)}</span>{" "}
              <span className="text-xs text-muted-foreground">{t("worked")}</span>
            </span>
          ),
          metrics: [
            { label: t("bookingOld"), value: num(r.c.bookingOld) },
            { label: t("showUp"), value: num(r.c.showUp) },
            { label: t("quality"), value: num(r.c.converted), sub: pct(r.c.converted, r.c.worked) },
            { label: t("bookingNew"), value: num(r.c.bookingNew) },
            { label: t("bookingTotal"), value: <span className="font-semibold">{num(r.c.bookingNew + r.c.bookingOld)}</span> },
          ],
        }))}
      />
    );

  const numCol = (key: keyof FollowupCounts, title: string, strong?: boolean) => ({
    key,
    title,
    align: "right" as const,
    render: (_: unknown, r: FollowupRow) => <span className={cn("tabular-nums", strong && "font-semibold")}>{num(r.c[key])}</span>,
  });

  const columns: TableProps<FollowupRow>["columns"] = [
    {
      key: "name",
      title: tr("staff"),
      render: (_, r) => name(r),
    },
    numCol("worked", t("worked"), true),
    numCol("bookingOld", t("bookingOld")),
    numCol("showUp", t("showUp")),
    {
      key: "quality",
      title: t("quality"),
      align: "right",
      render: (_, r) => (
        <span className="whitespace-nowrap tabular-nums">
          {num(r.c.converted)}
          <span className="ml-1.5 text-xs text-muted-foreground">{pct(r.c.converted, r.c.worked)}</span>
        </span>
      ),
    },
    numCol("bookingNew", t("bookingNew")),
    {
      key: "bookingTotal",
      title: t("bookingTotal"),
      align: "right",
      render: (_, r) => <span className="font-semibold tabular-nums">{num(r.c.bookingNew + r.c.bookingOld)}</span>,
    },
  ];

  return (
    <Table<FollowupRow>
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
