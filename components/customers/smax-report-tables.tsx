"use client";

/** Các bảng của trang Smax report (Theo kênh, Theo Telesales, Follow up) + helper dùng chung với view. */
import * as React from "react";
import { Table, Tooltip, type TableProps } from "antd";
import { useLocale, useTranslations } from "next-intl";

import { MetricList } from "@/components/common/metric-list";
import { UserAvatar } from "@/components/common/user-avatar";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  INBOX_CHANNELS,
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

type Avatars = Record<string, string | null>;

export const CHANNEL_LABEL: Record<InboxChannel, string> = { wa: "WhatsApp", ig: "Instagram" };

/** Số theo trạng thái của một kênh, hoặc cộng mọi kênh khi không lọc nguồn. */
export const pickChannel = (c: ChannelCounts, channel: InboxChannel | "") => (channel ? c[channel] : sumChannels(c));
/** Booking của khách mới = tổng Booking − Booking khách cũ. */
export const bookingNew = (c: InboxCounts) => c.booking - c.bookingOld;

// Màu trạng thái dùng chung cho thanh phân bổ + chấm chú thích.
export const STATUS_COLOR: Record<InboxStatus, string> = {
  booking: "var(--success)",
  potential: "var(--destructive)",
  followUp: "var(--info)",
  pending: "var(--warning)",
  spam: "var(--muted-foreground)",
};

export function useFormat() {
  const locale = useLocale();
  return {
    num: (v: number) => v.toLocaleString(locale),
    pct: (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "-"),
  };
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
export function ChannelTable({ scope, channel, loading }: { scope: ChannelCounts | null; channel: InboxChannel | ""; loading: boolean }) {
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
export function StaffTable({
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
export function FollowupTable({
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
