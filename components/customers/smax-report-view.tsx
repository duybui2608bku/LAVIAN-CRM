"use client";

import * as React from "react";
import { Alert, Button } from "antd";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";

import { getSmaxReport } from "@/app/(app)/customers/smax-report/actions";
import { ClearableSelect } from "@/components/common/clearable-select";
import { DateRangePicker } from "@/components/common/date-picker";
import { initialRange } from "@/components/common/date-range-filter";
import { StatCard } from "@/components/common/stat-card";
import {
  bookingNew,
  CHANNEL_LABEL,
  ChannelTable,
  FollowupTable,
  pickChannel,
  STATUS_COLOR,
  StaffTable,
  useFormat,
} from "@/components/customers/smax-report-tables";
import { PageToolbar } from "@/components/layout/page";
import { INBOX_CHANNELS, INBOX_STAFF, INBOX_STATUSES, UNASSIGNED, type ChannelCounts, type InboxChannel, type InboxCounts } from "@/lib/smax-inbox";
import { cn } from "@/lib/utils";

type Result = Awaited<ReturnType<typeof getSmaxReport>>;

// Cùng màu nguồn với donut trang Leader Telesales.
const CHANNEL_COLOR: Record<InboxChannel, string> = { wa: "var(--chart-3)", ig: "var(--chart-5)" };

type Card = {
  key: string;
  value: (c: InboxCounts) => number;
  /** Tỉ lệ = value / mẫu số (đều chia cho Khách mới; tooltip ở `smaxReport.rate.<key>`). */
  of?: (c: InboxCounts) => number;
  hint?: (c: InboxCounts) => string;
};

export function SmaxReportView() {
  const t = useTranslations("smaxReport");
  const tf = useTranslations("smaxFollowup");
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

  const cards: Card[] = [
    { key: "reEngaged", value: (c) => c.reEngaged },
    { key: "newCustomers", value: (c) => c.conversations },
    {
      key: "bookingTotal",
      value: (c) => c.booking,
      of: (c) => c.conversations,
      hint: (c) => t("hint.deposit", { n: num(c.deposit) }),
    },
    { key: "bookingNew", value: bookingNew, of: (c) => c.conversations, hint: (c) => t("hint.bookingOld", { n: num(c.bookingOld) }) },
    { key: "showUp", value: (c) => c.showUp, of: (c) => c.conversations, hint: (c) => t("hint.showUpSameDay", { n: num(c.showUpSameDay) }) },
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
              value={
                sum ? (
                  <span className="flex items-baseline gap-2">
                    {num(c.value(sum))}
                    {c.of ? (
                      <span className="text-sm font-medium text-muted-foreground" title={t(`rate.${c.key}`)}>
                        {pct(c.value(sum), c.of(sum))}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  "-"
                )
              }
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
          <span className="text-xs text-muted-foreground">{t("card.bookingTotal")}</span>
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
