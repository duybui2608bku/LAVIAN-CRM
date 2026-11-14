"use client";

import * as React from "react";
import { Switch, Table, Tag, type TableColumnType } from "antd";

import { StatCard } from "@/components/common/stat-card";
import { AlertCircle, RefreshCw } from "lucide-react";
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
import { campaignWa, summarizeByWa, waColor } from "@/lib/wa";
import { useCan } from "@/components/common/permissions";

/** Chia an toàn: thiếu số hoặc mẫu 0 → null ("—"). */
const ratio = (a: number | null, b: number | null) =>
  a != null && b ? Math.round(a / b) : null;

const LOCALE_TAG: Record<string, string> = { vi: "vi-VN", en: "en-US" };

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
  const canEdit = useCan()("marketing.edit");
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
  const cards: { key: string; value: string | null }[] = [
    { key: "spend", value: money(s?.spend ?? null) },
    { key: "messages", value: count(s?.messages ?? null) },
    { key: "costPerMessage", value: money(ratio(s?.spend ?? null, s?.messages ?? null)) },
    { key: "leads", value: count(s?.leads ?? null) },
    { key: "costPerLead", value: money(ratio(s?.spend ?? null, s?.leads ?? null)) },
  ];
  // Lỗi từng nguồn hiện 1 lần ở đầu trang (trước đây lặp lại dưới nhiều card).
  const errorLines = [...new Set([stats?.error, e?.fb, e?.smax].filter(Boolean))] as string[];

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
  // Tin nhắn theo số WA (theo tên chiến dịch) trong khoảng ngày đang chọn.
  const byWa = summarizeByWa(campaigns);

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
        if (!canEdit) return <Switch size="small" checked={active} disabled aria-label={statusLabel(status)} />;
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
      key: "wa",
      title: t("colWa"),
      width: 110,
      render: (_, r) => {
        const wa = campaignWa(r.name);
        return wa ? (
          <Tag color={waColor(wa)} className="me-0">
            {wa}
          </Tag>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      filters: byWa.map((g) => ({ text: g.wa ?? t("waUnknown"), value: g.wa ?? "" })),
      onFilter: (value, r) => (campaignWa(r.name) ?? "") === value,
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

      {errorLines.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 space-y-0.5 break-words">
            {errorLines.map((m) => (
              <p key={m}>{m}</p>
            ))}
          </div>
        </div>
      )}

      <div
        className={cn(
          "grid grid-cols-2 gap-3 transition-opacity duration-200 lg:grid-cols-5",
          stats && pending && "opacity-60",
        )}
      >
        {cards.map((card) => (
          <StatCard
            key={card.key}
            label={t(card.key)}
            value={card.value ?? "—"}
            loading={!stats}
          />
        ))}
      </div>

      {byWa.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>{t("byWa")}</SectionTitle>
          {/* Luôn 1 hàng: N cột bằng nhau; chữ co giãn theo bề rộng ô (container query). */}
          <div
            className={cn(
              "surface grid divide-x divide-border overflow-hidden transition-opacity duration-200",
              pending && "opacity-60",
            )}
            style={{ gridTemplateColumns: `repeat(${byWa.length}, minmax(0, 1fr))` }}
          >
            {byWa.map((g) => (
              <div
                key={g.wa ?? "none"}
                className="@container flex min-w-0 flex-col items-center gap-1 px-1 py-3 text-center"
              >
                {g.wa ? (
                  <Tag
                    color={waColor(g.wa)}
                    className="me-0 max-w-full truncate px-1 text-[clamp(10px,10cqi,12px)] @min-[5.5rem]:px-2"
                  >
                    <span className="hidden @min-[5.5rem]:inline">WA-</span>
                    {g.wa.slice(3)}
                  </Tag>
                ) : (
                  <span className="max-w-full truncate text-[clamp(10px,10cqi,12px)] leading-[22px] text-muted-foreground">
                    {t("waUnknown")}
                  </span>
                )}
                <span
                  className={cn(
                    "font-semibold leading-none tracking-tight tabular-nums",
                    !g.wa && "text-muted-foreground",
                  )}
                  style={{ fontSize: "clamp(0.95rem, 24cqi, 1.75rem)" }}
                >
                  {g.messages.toLocaleString(locale)}
                </span>
                <span className="hidden text-xs text-muted-foreground @min-[5.5rem]:block">
                  {t("waMessagesLabel")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle>{t("campaigns")}</SectionTitle>
        <div className="surface overflow-hidden">
          <Table
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
            scroll={{ x: 1350 }}
            size="middle"
            locale={{ emptyText: stats?.errors.campaigns ?? t("noCampaigns") }}
          />
        </div>
      </section>
    </>
  );
}

/** Tiêu đề phần: nhỏ, chữ hoa, màu phụ — để số liệu nổi bật hơn tiêu đề. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}
