"use client";

import * as React from "react";
import { Alert, Button, Switch, Table, Tooltip, type TableColumnType } from "antd";

import { StatusTag } from "@/components/common/cells";
import { Section } from "@/components/common/section";
import { StatCard } from "@/components/common/stat-card";
import { Calculator, CalendarCheck, CircleCheck, MessageCircle, RefreshCw, Sparkles, Wallet } from "lucide-react";
import type { IconTone } from "@/components/common/stat-card";

// Icon + màu thẻ số liệu — cùng bộ với trang Báo cáo.
const CARD_ICON: Record<string, [React.ElementType, IconTone]> = {
  spend: [Wallet, "primary"],
  messages: [MessageCircle, "info"],
  costPerMessage: [Calculator, "info"],
  leads: [Sparkles, "success"],
  costPerLead: [Calculator, "success"],
  colBooking: [CalendarCheck, "primary"],
  colShowUp: [CircleCheck, "success"],
};
import { useLocale, useTranslations } from "next-intl";

import {
  getAdsStats,
  updateCampaignStatus,
  type AdsStats,
} from "@/app/(app)/marketing/actions";
import { ConfirmAction } from "@/components/common/confirm-action";
import { DateRangePicker } from "@/components/common/date-picker";
import { MetricList } from "@/components/common/metric-list";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { PageHeader } from "@/components/layout/page";
import { formatISODate } from "@/lib/date";
import { toast } from "@/lib/toast";
import type { FbCampaign } from "@/lib/marketing";
import type { FunnelKey } from "@/lib/smax-inbox";
import { cn } from "@/lib/utils";
import { campaignIg, campaignWa, summarizeByWa } from "@/lib/wa";
import { useCan } from "@/components/common/permissions";
import { SourceIcon } from "@/components/common/source-icon";

/** Chia an toàn: thiếu số hoặc mẫu 0 → null ("—"). */
const ratio = (a: number | null, b: number | null) =>
  a != null && b ? Math.round(a / b) : null;

const LOCALE_TAG: Record<string, string> = { vi: "vi-VN", en: "en-US" };

/** Dòng bảng: chiến dịch, hoặc dòng con WA/IG (`platform`) của chiến dịch chạy cả 2 nền tảng. */
type CampaignRow = FbCampaign & { platform?: "wa" | "ig"; children?: CampaignRow[] };

// BM chứa cả 2 tài khoản ads (GOMI, RASA).
const FB_BUSINESS_ID = "1389222792022238";
const adsManagerUrl = (c: FbCampaign) =>
  `https://adsmanager.facebook.com/adsmanager/manage/campaigns?${new URLSearchParams({
    act: c.accountId,
    business_id: FB_BUSINESS_ID,
    nav_source: "no_referrer",
    treenav: "true",
    selected_campaign_ids: c.id,
  })}`;

// effective_status của Graph API → màu tag trạng thái; trạng thái lạ hiện nguyên văn, màu mặc định.
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
  const mobile = useIsMobile();
  // Điện thoại: danh sách chiến dịch (chi tiêu giảm dần), xem thêm 20 mỗi lần thay cho phân trang.
  const [mobileLimit, setMobileLimit] = React.useState(20);
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
  // Thiếu số hoặc bằng 0 → null, ô hiện "—".
  const money = (n: number | null) => (n ? moneyFormat.format(n) : null);
  const count = (n: number | null) => (n ? n.toLocaleString(locale) : null);
  const pct = new Intl.NumberFormat(LOCALE_TAG[locale] ?? locale, { style: "percent", maximumFractionDigits: 1 });
  // Đặt lịch kèm tỉ lệ so với Tin nhắn: "1 · 3%".
  const withRate = (booking: number | null, messages: number | null): React.ReactNode =>
    booking && messages ? (
      <>
        {count(booking)}{" "}
        <span className="text-[0.75em] font-normal text-muted-foreground">· {pct.format(booking / messages)}</span>
      </>
    ) : (
      count(booking)
    );
  const e = stats?.errors;
  const s = stats;
  const total = s?.potential?.total;
  // KH tiềm năng = khách mới của kỳ (không gồm purchase); Đặt lịch / Đến cơ sở = tag booking / purchase gắn trong kỳ.
  const cards: { key: string; value: React.ReactNode }[] = [
    { key: "spend", value: money(s?.spend ?? null) },
    { key: "messages", value: count(s?.messages ?? null) },
    { key: "costPerMessage", value: money(ratio(s?.spend ?? null, s?.messages ?? null)) },
    { key: "leads", value: count(total?.potential ?? null) },
    { key: "costPerLead", value: money(ratio(s?.spend ?? null, total?.potential ?? null)) },
    { key: "colBooking", value: withRate(total?.booking ?? null, s?.messages ?? null) },
    { key: "colShowUp", value: count(total?.showUp ?? null) },
  ];
  // Lỗi từng nguồn hiện 1 lần ở đầu trang (trước đây lặp lại dưới nhiều card).
  const errorLines = [...new Set([stats?.error, e?.fb, e?.potential].filter(Boolean))] as string[];

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
  // Khách tiềm năng: IG theo chiến dịch (ad_id), WA theo số WA của chiến dịch (nhiều camp chung 1 số → cùng số liệu).
  const potential = stats?.potential;
  const waCampaigns = new Map<string, number>();
  for (const c of campaigns) {
    const wa = campaignWa(c.name);
    if (wa) waCampaigns.set(wa, (waCampaigns.get(wa) ?? 0) + 1);
  }
  // Nền tảng = ĐÍCH nhắn tin theo destination_type nhóm QC (không lấy được → đoán theo tên); vị trí hiển thị
  // (video trên IG) không tính. Số WA luôn lấy từ tên (Meta không trả). Dòng con chỉ giữ nền tảng của nó.
  const platformsOf = (r: CampaignRow) => {
    const waOn = r.platforms ? r.platforms.includes("wa") : campaignWa(r.name) != null;
    const igOn = r.platforms ? r.platforms.includes("ig") : campaignIg(r.name);
    const wa = r.platform !== "ig" && waOn;
    return { wa, waNo: wa ? campaignWa(r.name) : null, ig: r.platform !== "wa" && igOn };
  };
  // Dòng cha luôn cộng khách IG gán qua ad_id: quảng cáo đích WA hiện trên IG vẫn có người nhắn thẳng vào IG.
  const funnelOf = (r: CampaignRow, key: FunnelKey) => {
    if (!potential) return null;
    const waNo = r.platform === "ig" ? null : campaignWa(r.name);
    const ig = r.platform !== "wa" ? (potential.byCampaign[r.id]?.[key] ?? 0) : 0;
    return ig + (waNo ? (potential.byWa[waNo]?.[key] ?? 0) : 0);
  };
  // Chạy cả WA + IG → bung 2 dòng con, phễu riêng từng bên (Meta không tách chi tiêu/tin nhắn theo đích).
  const rows: CampaignRow[] = campaigns.map((c) => {
    const { wa, ig } = platformsOf(c);
    return wa && ig ? { ...c, children: [{ ...c, platform: "wa" }, { ...c, platform: "ig" }] } : c;
  });
  // Ô số liệu từ phễu SMAX: lỗi → "—" kèm lỗi; số WA dùng chung nhiều chiến dịch → gạch chấm + tooltip.
  const funnelCell = (r: CampaignRow, text: React.ReactNode) => {
    if (text == null)
      return (
        <Tooltip title={e?.potential}>
          <span className="text-muted-foreground">—</span>
        </Tooltip>
      );
    const { waNo: wa } = platformsOf(r);
    const shared = wa ? (waCampaigns.get(wa) ?? 0) : 0;
    return shared > 1 ? (
      <Tooltip title={t("potentialSharedWa", { wa: wa!, count: shared })}>
        <span className="underline decoration-dotted underline-offset-4">{text}</span>
      </Tooltip>
    ) : (
      text
    );
  };
  // Phễu theo chiến dịch (hiện chỉ còn Đến cơ sở): cùng cách gán chiến dịch, cùng tooltip WA dùng chung / lỗi.
  const funnelColumn = (key: FunnelKey, title: string, width: number): TableColumnType<CampaignRow> => ({
    key,
    title,
    align: "right",
    width,
    render: (_, r) => funnelCell(r, count(funnelOf(r, key))),
    sorter: (a, b) => (funnelOf(a, key) ?? -1) - (funnelOf(b, key) ?? -1),
  });

  const statusLabel = (status: string) =>
    t.has(`status_${status}`) ? t(`status_${status}`) : status;
  const numSorter = (key: keyof FbCampaign) => (a: FbCampaign, b: FbCampaign) =>
    Number(a[key]) - Number(b[key]);
  const columns: TableColumnType<CampaignRow>[] = [
    {
      key: "status",
      title: t("colStatus"),
      dataIndex: "status",
      width: 96,
      // Chỉ ACTIVE/PAUSED bật tắt được; trạng thái khác (xoá, lưu trữ, lỗi…) hiện tag trạng thái.
      render: (status: string, r) => {
        if (status !== "ACTIVE" && status !== "PAUSED")
          return <StatusTag color={STATUS_COLOR[status]} label={statusLabel(status)} />;
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
      // Tài khoản QC thành dòng phụ dưới tên (bỏ cột riêng); filter tài khoản chuyển về cột này.
      render: (name: string, r) => (
        <div className="min-w-0">
          <a href={adsManagerUrl(r)} target="_blank" rel="noopener noreferrer" title={name} className="block truncate">
            {name}
          </a>
          <div className="truncate text-xs text-muted-foreground" title={r.accountName}>
            {r.accountName}
          </div>
        </div>
      ),
      filters: accounts.length > 1 ? accounts.map((a) => ({ text: a, value: a })) : undefined,
      onFilter: (value, r) => r.accountName === value,
    },
    {
      key: "platform",
      title: t("colPlatform"),
      width: 180,
      render: (_, r) => {
        const { wa, waNo, ig } = platformsOf(r);
        if (!wa && !ig) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="inline-flex items-center gap-1.5 align-middle">
            {wa && <SourceIcon source="whatsapp" className="size-4" />}
            {waNo}
            {r.platform === "wa" && !waNo && "WhatsApp"}
            {ig && <SourceIcon source="instagrams" className="size-4" />}
            {r.platform === "ig" && "Instagram"}
          </span>
        );
      },
      filters: [
        ...byWa.map((g) => ({ text: g.wa ?? t("waUnknown"), value: g.wa ?? "" })),
        { text: "Instagram", value: "ig" },
      ],
      onFilter: (value, r) => {
        const { waNo, ig } = platformsOf(r);
        return value === "ig" ? ig : (waNo ?? "") === value;
      },
    },
    {
      key: "spend",
      title: t("spend"),
      align: "right",
      width: 140,
      render: (_, r) => money(r.spend) ?? "—",
      sorter: numSorter("spend"),
      defaultSortOrder: "descend",
    },
    {
      key: "messages",
      title: t("messages"),
      align: "right",
      width: 110,
      render: (_, r) => count(r.messages) ?? "—",
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
    // KH tiềm năng / Đặt lịch / Tỉ lệ / Chi tiêu ÷ Đặt lịch theo chiến dịch đang sai (số WA dùng chung nhiều camp)
    // → tạm ẩn, xem theo từng số WA ở khối "Theo số WA" phía trên.
    funnelColumn("showUp", t("colShowUp"), 110),
    {
      key: "impressions",
      title: t("colImpressions"),
      align: "right",
      width: 130,
      render: (_, r) => count(r.impressions) ?? "—",
      sorter: numSorter("impressions"),
    },
    {
      key: "reach",
      title: t("colReach"),
      align: "right",
      width: 130,
      render: (_, r) => count(r.reach) ?? "—",
      sorter: numSorter("reach"),
    },
  ];

  // Dòng con WA/IG chỉ hiện nền tảng + phễu; các cột khác là số của cả chiến dịch (ở dòng cha).
  const SPLIT_KEYS = ["platform", "showUp"];
  const tableColumns = columns.map((c) =>
    SPLIT_KEYS.includes(String(c.key))
      ? c
      : {
          ...c,
          render: (v: unknown, r: CampaignRow, i: number) =>
            r.platform ? null : c.render ? c.render(v, r, i) : (v as React.ReactNode),
        },
  );

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
        <Alert type="error" showIcon title={errorLines.map((m) => <div key={m}>{m}</div>)} />
      )}

      <div
        className={cn(
          "grid grid-cols-2 gap-3 transition-opacity duration-200 lg:grid-cols-4 2xl:grid-cols-7 max-sm:[&>*:last-child]:col-span-2",
          stats && pending && "opacity-60",
        )}
      >
        {cards.map((card) => (
          <StatCard
            key={card.key}
            label={t(card.key)}
            icon={CARD_ICON[card.key]?.[0]}
            iconTone={CARD_ICON[card.key]?.[1]}
            value={card.value ?? "—"}
            loading={!stats}
          />
        ))}
      </div>

      {byWa.length > 0 && (
        <Section title={t("byWa")}>
          <div
            className={cn(
              // Màn lớn: mọi số WA (kể cả "Chưa gắn WA") chia đều trên 1 hàng.
              "grid grid-cols-2 gap-3 transition-opacity duration-200 sm:grid-cols-3 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none",
              pending && "opacity-60",
            )}
          >
            {byWa.map((g) => {
              // Phễu SMAX theo số WA (khách nhắn vào số đó) — "Chưa gắn WA" không có phễu.
              const f = g.wa ? potential?.byWa[g.wa] : undefined;
              const funnel = (n: React.ReactNode) => (g.wa && potential ? (n ?? "—") : "—");
              const lines: [string, React.ReactNode][] = [
                ["colPotential", funnel(count(f?.potential ?? 0))],
                ["colBooking", funnel(withRate(f?.booking ?? 0, g.messages))],
                ["costPerBooking", funnel(money(ratio(g.spend, f?.booking ?? 0)))],
              ];
              return (
                <div key={g.wa ?? "none"} className="surface flex min-w-0 flex-col gap-2 p-3 sm:p-4">
                  <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{g.wa ?? t("waUnknown")}</p>
                  <div className="flex items-baseline gap-1.5 truncate">
                    <span className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
                      {stats ? (count(g.messages) ?? "—") : <span className="inline-block h-7 w-16 animate-pulse rounded-md bg-muted" />}
                    </span>
                    <span className="text-xs text-muted-foreground">{t("messagesUnit")}</span>
                  </div>
                  <dl className="space-y-1 border-t border-border pt-2 text-xs">
                    {lines.map(([key, value]) => (
                      <div key={key} className="flex items-baseline justify-between gap-2">
                        <dt className="truncate text-muted-foreground">{t(key)}</dt>
                        <dd className="shrink-0 font-medium tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section title={t("campaigns")}>
        {mobile ? (
          <div className="surface overflow-hidden">
            <MetricList
              loading={!stats || pending}
              empty={stats?.errors.campaigns ?? t("noCampaigns")}
              rows={campaigns.slice(0, mobileLimit).map((r, i) => {
                const cell = (key: string) => {
                  const col = columns.find((c) => c.key === key)!;
                  return col.render!(r[col.dataIndex as keyof FbCampaign], r, i) as React.ReactNode;
                };
                return {
                  key: r.id,
                  title: (
                    <span className="flex min-w-0 flex-col items-start gap-1">
                      <a
                        href={adsManagerUrl(r)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="line-clamp-2 text-sm leading-snug"
                      >
                        {r.name}
                      </a>
                      {cell("platform")}
                    </span>
                  ),
                  aside: cell("status"),
                  metrics: (["spend", "messages", "costPerMessage", "showUp", "impressions", "reach"] as const).map((k) => ({
                    label: columns.find((c) => c.key === k)!.title as React.ReactNode,
                    value: cell(k),
                  })),
                };
              })}
            />
            {campaigns.length > mobileLimit ? (
              <Button type="text" block className="rounded-none border-t border-border" onClick={() => setMobileLimit((n) => n + 20)}>
                {t("showMore", { n: campaigns.length - mobileLimit })}
              </Button>
            ) : null}
          </div>
        ) : (
        <div className="surface overflow-hidden">
          <Table
            rowKey={(r) => (r.platform ? `${r.id}-${r.platform}` : r.id)}
            columns={tableColumns}
            dataSource={rows}
            expandable={{ expandIconColumnIndex: 2 }}
            loading={!stats || pending}
            pagination={{
              defaultPageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: [20, 50, 100],
              showTotal: (total, [from, to]) =>
                t("totalCampaigns", { from, to, total }),
            }}
            scroll={{ x: 1270 }}
            size="middle"
            locale={{ emptyText: stats?.errors.campaigns ?? t("noCampaigns") }}
          />
        </div>
        )}
      </Section>
    </>
  );
}

