"use client";

import * as React from "react";
import { Switch, Table, Tag, type TableColumnType } from "antd";
import { RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import {
  getAdsStats,
  updateCampaignStatus,
  type AdsStats,
} from "@/app/(app)/marketing/actions";
import { ConfirmAction } from "@/components/common/confirm-action";
import { DateRangePicker } from "@/components/common/date-picker";
import { PageHeader } from "@/components/layout/page";
import { formatISODate } from "@/lib/date";
import { toast } from "@/lib/toast";
import type { FbCampaign } from "@/lib/marketing";
import { cn } from "@/lib/utils";

/** Chia an toàn: thiếu số hoặc mẫu 0 → null ("—"). */
const ratio = (a: number | null, b: number | null) =>
  a != null && b ? Math.round(a / b) : null;

const LOCALE_TAG: Record<string, string> = { vi: "vi-VN", en: "en-US", id: "id-ID" };

// effective_status của Graph API → màu tag; trạng thái lạ hiện nguyên văn, màu mặc định.
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "green",
  PAUSED: "orange",
  CAMPAIGN_PAUSED: "orange",
  IN_PROCESS: "blue",
  WITH_ISSUES: "red",
  DELETED: "default",
  ARCHIVED: "default",
};

export function AdsStatsView() {
  const t = useTranslations("marketing");
  const locale = useLocale();
  const today = formatISODate(new Date());
  const [range, setRange] = React.useState({ from: today, to: today });
  const [stats, setStats] = React.useState<AdsStats | null>(null);
  const [pending, startTransition] = React.useTransition();
  const requestId = React.useRef(0);

  React.useEffect(() => {
    const current = ++requestId.current;
    startTransition(async () => {
      const next = await getAdsStats(range.from, range.to || range.from);
      if (current === requestId.current) setStats(next);
    });
  }, [range]);

  // Tiền FB theo currency của tài khoản ads, định dạng theo ngôn ngữ đang chọn.
  const currency = stats?.currency;
  const moneyFormat = new Intl.NumberFormat(
    LOCALE_TAG[locale] ?? locale,
    currency
      ? { style: "currency", currency, maximumFractionDigits: 0 }
      : { maximumFractionDigits: 0 },
  );
  const money = (n: number | null) => (n == null ? null : moneyFormat.format(n));
  const count = (n: number | null) => (n == null ? null : n.toLocaleString(locale));
  const e = stats?.errors;
  const s = stats;
  const cards: { key: string; value: string | null; error?: string }[] = [
    { key: "spend", value: money(s?.spend ?? null), error: e?.fb },
    { key: "messages", value: count(s?.messages ?? null), error: e?.fb },
    {
      key: "costPerMessage",
      value: money(ratio(s?.spend ?? null, s?.messages ?? null)),
      error: e?.fb,
    },
    { key: "leads", value: count(s?.leads ?? null), error: e?.smax },
    {
      key: "costPerLead",
      value: money(ratio(s?.spend ?? null, s?.leads ?? null)),
      error: e?.fb ?? e?.smax,
    },
    { key: "appointments", value: count(s?.appointments ?? null), error: e?.db },
    { key: "visited", value: count(s?.visited ?? null), error: e?.db },
  ];

  // Bật/tắt chiến dịch: FB nhận xong thì vá trạng thái tại chỗ, không tải lại cả trang.
  const [toggling, setToggling] = React.useState<string | null>(null);
  const toggleStatus = async (id: string, next: "ACTIVE" | "PAUSED") => {
    setToggling(id);
    const res = await updateCampaignStatus(id, next);
    setToggling(null);
    if (res.error) return toast.error(res.error);
    setStats(
      (prev) =>
        prev && {
          ...prev,
          campaigns:
            prev.campaigns?.map((c) =>
              c.id === id ? { ...c, status: next } : c,
            ) ?? null,
        },
    );
    toast.success(t("statusUpdated"));
  };
  const campaigns = stats?.campaigns ?? [];
  const accounts = [...new Set(campaigns.map((c) => c.accountName))];

  const statusLabel = (status: string) =>
    t.has(`status_${status}`) ? t(`status_${status}`) : status;
  const numSorter = (key: keyof FbCampaign) => (a: FbCampaign, b: FbCampaign) =>
    Number(a[key]) - Number(b[key]);
  const columns: TableColumnType<FbCampaign>[] = [
    {
      key: "status",
      title: t("colStatus"),
      dataIndex: "status",
      width: 150,
      // Chỉ ACTIVE/PAUSED bật tắt được; trạng thái khác (xoá, lưu trữ, lỗi…) giữ dạng tag.
      render: (status: string, r) => {
        if (status !== "ACTIVE" && status !== "PAUSED")
          return <Tag color={STATUS_COLOR[status]}>{statusLabel(status)}</Tag>;
        const active = status === "ACTIVE";
        return (
          <ConfirmAction
            title={t(active ? "confirmPause" : "confirmActivate")}
            danger={active}
            onConfirm={() => toggleStatus(r.id, active ? "PAUSED" : "ACTIVE")}
          >
            <Switch
              size="small"
              checked={active}
              loading={toggling === r.id}
              aria-label={statusLabel(status)}
            />
          </ConfirmAction>
        );
      },
      sorter: (a, b) => a.status.localeCompare(b.status),
    },
    {
      key: "name",
      title: t("colName"),
      dataIndex: "name",
      width: 320,
      ellipsis: { showTitle: true },
    },
    {
      key: "account",
      title: t("colAccount"),
      dataIndex: "accountName",
      width: 200,
      ellipsis: { showTitle: true },
      filters:
        accounts.length > 1
          ? accounts.map((a) => ({ text: a, value: a }))
          : undefined,
      onFilter: (value, r) => r.accountName === value,
      sorter: (a, b) => a.accountName.localeCompare(b.accountName),
    },
    {
      key: "spend",
      title: t("spend"),
      align: "right",
      width: 140,
      render: (_, r) => money(r.spend),
      sorter: numSorter("spend"),
      defaultSortOrder: "descend",
    },
    {
      key: "messages",
      title: t("messages"),
      align: "right",
      width: 110,
      render: (_, r) => r.messages.toLocaleString(locale),
      sorter: numSorter("messages"),
    },
    {
      key: "costPerMessage",
      title: t("costPerMessage"),
      align: "right",
      width: 160,
      render: (_, r) => money(ratio(r.spend, r.messages)) ?? "—",
      sorter: (a, b) =>
        (ratio(a.spend, a.messages) ?? Infinity) -
        (ratio(b.spend, b.messages) ?? Infinity),
    },
    {
      key: "impressions",
      title: t("colImpressions"),
      align: "right",
      width: 130,
      render: (_, r) => r.impressions.toLocaleString(locale),
      sorter: numSorter("impressions"),
    },
    {
      key: "reach",
      title: t("colReach"),
      align: "right",
      width: 130,
      render: (_, r) => r.reach.toLocaleString(locale),
      sorter: numSorter("reach"),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <>
            {stats && pending && (
              <RefreshCw className="size-4 shrink-0 animate-spin text-muted-foreground" />
            )}
            <DateRangePicker
              from={range.from}
              to={range.to}
              onChange={(next) =>
                setRange(next.from ? next : { from: today, to: today })
              }
              allowClear={false}
              className="w-full sm:w-64"
            />
          </>
        }
      />

      {stats?.error && <p className="text-sm text-destructive">{stats.error}</p>}

      <div
        className={cn(
          "grid grid-cols-2 gap-2 transition-opacity duration-200 sm:gap-3 lg:grid-cols-4",
          stats && pending && "opacity-60",
        )}
      >
        {cards.map((card) => (
          <div
            key={card.key}
            className="surface flex min-w-0 flex-col p-3 sm:p-4"
          >
            <p className="truncate text-xs font-medium text-muted-foreground">
              {t(card.key)}
            </p>
            <span className="mt-1 truncate text-lg font-semibold tracking-tight tabular-nums sm:text-2xl">
              {!stats ? (
                <span className="inline-block h-6 w-20 animate-pulse rounded-md bg-muted sm:h-7 sm:w-24" />
              ) : (
                (card.value ?? "—")
              )}
            </span>
            {card.error && (
              <p className="mt-1 text-xs text-destructive">{card.error}</p>
            )}
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("campaigns")}</h2>
        <Table
          className="surface overflow-hidden"
          rowKey="id"
          columns={columns}
          dataSource={campaigns}
          loading={!stats || pending}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
            showTotal: (total, [from, to]) =>
              t("totalCampaigns", { from, to, total }),
          }}
          scroll={{ x: 1340 }}
          size="middle"
          locale={{ emptyText: stats?.errors.campaigns ?? t("noCampaigns") }}
        />
      </section>
    </>
  );
}
