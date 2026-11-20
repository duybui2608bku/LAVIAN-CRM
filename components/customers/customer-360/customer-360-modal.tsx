"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Avatar, Button, Modal, Result, Skeleton, Tabs, Tag } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, IdCard, NotebookPen, PanelRightOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dayjs from "dayjs";
import { getCustomer360 } from "@/app/(app)/customers/customer-360-actions";
import { EnumTag } from "@/components/common/enum-tag";
import { useCan } from "@/components/common/permissions";
import type { StaffRef } from "@/components/common/user-avatar";
import { MessagesTab, PhotosTab, TimelineTab } from "@/components/customers/customer-360/activity-tabs";
import { OverviewTab, PortraitTab, ServicesTab, SourceTag } from "@/components/customers/customer-360/profile-tabs";
import { customerFinance, latestPortrait, nextNeed } from "@/lib/customer-360";
import { CUSTOMER_OPTIONS } from "@/lib/customer-options";
import { optionLabel } from "@/lib/customers";
import { PORTRAIT_FIELDS, type Customer360, type ViewerRole } from "@/types/customer-360";

type TabKey = "overview" | "portrait" | "services" | "photos" | "messages" | "timeline" | "care";
// Tab mở đầu theo vai trò tài khoản (gợi ý D1).
const ROLE_TAB: Record<ViewerRole, TabKey> = { admin: "overview", telesales: "portrait", sales: "services", master: "overview" };

/** Tải hồ sơ 360° của 1 khách — key chung để các thao tác ghi invalidate. */
export function useCustomer360Query(customerId: string | null) {
  return useQuery({
    queryKey: ["customer-360", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const res = await getCustomer360(customerId!);
      if (res.error || !res.data) throw new Error(res.error);
      return res.data;
    },
  });
}

/**
 * Popup Customer Detail 360° — mở theo customer_id, dùng chung mọi trang.
 * `ids` = danh sách khách đang hiển thị ở bảng gọi popup (đúng thứ tự, đã bỏ trùng) cho nút Trước/Tiếp.
 * Popup không giữ bộ lọc: bảng cha giữ state của mình nên đóng popup không mất trang / vị trí cuộn.
 */
export function Customer360Modal({ customerId, ids, staff, onNavigate, onEdit, onClose }: {
  customerId: string | null;
  ids: string[];
  staff: StaffRef[];
  onNavigate: (id: string) => void;
  /** "Chuyển sang nhập liệu" (kèm lịch gần nhất của khách) — không truyền = mở Quản lý bán hàng lọc theo khách. */
  onEdit?: (customerId: string, appointmentId: string | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations("c360");
  const can = useCan();
  const { data, error, isPending } = useCustomer360Query(customerId);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["customer-360", customerId] });
  const [tab, setTab] = useState<TabKey | null>(null); // null = tab theo vai trò
  const [composing, setComposing] = useState(false);

  const index = customerId ? ids.indexOf(customerId) : -1;
  const go = (step: number) => { const id = ids[index + step]; if (id) { setComposing(false); onNavigate(id); } };
  const close = () => { setTab(null); setComposing(false); onClose(); };
  const active = tab ?? (data ? ROLE_TAB[data.role] : "overview");

  const editButton = customerId && (onEdit
    ? <Button icon={<PanelRightOpen className="size-4" />} onClick={() => { close(); onEdit(customerId, data ? customerFinance(data.appointments, 0, data.now).current?.appointment.id ?? null : null); }}>{t("toEdit")}</Button>
    : can("appointments.view") && <Link href={`/appointments?customer=${customerId}`} onClick={close}>
      <Button icon={<PanelRightOpen className="size-4" />}>{t("toEdit")}</Button>
    </Link>);

  // Kích thước cố định (không co giãn theo nội dung / tab / lúc đang tải): rộng 1360, cao 720, màn nhỏ thì vừa màn hình.
  // Desktop: thanh tab đứng yên, nội dung mỗi tab cuộn trong cùng 1 vùng; điện thoại: cuộn cả thân.
  return <Modal open={!!customerId} onCancel={close} width="min(1360px, calc(100vw - 32px))" destroyOnHidden centered
    styles={{ body: { height: "min(720px, calc(100vh - 220px))", overflowY: "auto" } }}
    title={<Header data={data} index={index} total={ids.length} onPrev={() => go(-1)} onNext={() => go(1)} />}
    footer={<div className="flex flex-wrap justify-end gap-2">
      <Button icon={<NotebookPen className="size-4" />} onClick={() => { setTab("timeline"); setComposing(true); }}>{t("quickNote")}</Button>
      {editButton}
    </div>}>
    {isPending ? <Skeleton active paragraph={{ rows: 10 }} />
      : error ? <Alert type="error" showIcon title={error.message} />
      : <div className="flex flex-col gap-4 lg:h-full">
        <Summary data={data} />
        <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
          <SideColumn data={data} />
          <Tabs activeKey={active} onChange={(k) => setTab(k as TabKey)}
            className="lg:h-full lg:[&_.ant-tabs-content]:h-full lg:[&_.ant-tabs-content-holder]:overflow-y-auto lg:[&_.ant-tabs-content-holder]:[scrollbar-gutter:stable] lg:[&_.ant-tabs-tabpane]:h-full"
            items={[
            { key: "overview", label: t("tabs.overview"), children: <OverviewTab data={data} staff={staff} /> },
            { key: "portrait", label: t("tabs.portrait"), children: <PortraitTab data={data} staff={staff} onSaved={refresh} /> },
            { key: "services", label: t("tabs.services"), children: <ServicesTab data={data} onSaved={refresh} /> },
            ...(data.can.photos ? [{ key: "photos", label: t("tabs.photos"), children: <PhotosTab data={data} /> }] : []),
            { key: "messages", label: t("tabs.messages"), children: <MessagesTab data={data} staff={staff} onSaved={refresh} /> },
            { key: "timeline", label: t("tabs.timeline"), children: <TimelineTab data={data} staff={staff} composing={composing} onSaved={refresh} /> },
            { key: "care", label: t("tabs.care"), children: <Result status="info" title={t("comingSoon")} subTitle={t("comingSoonDesc")} /> },
          ]} />
        </div>
      </div>}
  </Modal>;
}

function Header({ data, index, total, onPrev, onNext }: {
  data: Customer360 | undefined; index: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  const t = useTranslations("c360");
  const locale = useLocale();
  const c = data?.customer;
  const stage = c && CUSTOMER_OPTIONS.find((o) => o.kind === "stage" && o.value === c.stage);
  return <div className="flex flex-wrap items-center gap-3 pe-8">
    <Avatar src={c?.picture || undefined} size={44} className="shrink-0">{c?.full_name.charAt(0)}</Avatar>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="truncate text-lg font-semibold">{c?.full_name ?? t("title")}</span>
        {stage && <EnumTag label={optionLabel(stage, locale)} icon={stage.icon} color={stage.color} />}
      </div>
      <div className="min-h-4 text-xs font-normal text-muted-foreground tabular-nums">
        {[c?.phone, data && t(`hint.${data.role}`)].filter(Boolean).join(" · ")}
      </div>
    </div>
    {index >= 0 && <div className="flex items-center gap-1 font-normal">
      <Button size="small" aria-label={t("prev")} title={t("prev")} disabled={index <= 0} icon={<ChevronLeft className="size-4" />} onClick={onPrev} />
      <span className="min-w-12 text-center text-sm tabular-nums">{t("position", { index: index + 1, total })}</span>
      <Button size="small" aria-label={t("next")} title={t("next")} disabled={index >= total - 1} icon={<ChevronRight className="size-4" />} onClick={onNext} />
    </div>}
  </div>;
}

/** 3 ô tóm tắt đầu popup: Mong muốn / Nỗi lo / Nhu cầu tiếp theo. */
function Summary({ data }: { data: Customer360 }) {
  const t = useTranslations("c360");
  const latest = latestPortrait(data.portrait);
  const need = nextNeed(data.needs);
  const cell = (label: string, body: React.ReactNode) => <div className="rounded-lg border border-border p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="mt-1 line-clamp-2 font-medium">{body ?? <span className="font-normal text-muted-foreground">{t("summary.empty")}</span>}</div>
  </div>;
  return <div className="grid gap-3 sm:grid-cols-3">
    {cell(t("summary.wish"), latest.wish?.text)}
    {cell(t("summary.pain"), latest.pain?.text)}
    {cell(t("summary.next"), need && `${need.title} · ${t(`needs.status.${need.status}`)}`)}
  </div>;
}

/** Cột trái (ẩn trên điện thoại): chân dung nhanh + việc tiếp theo (lịch nhắc đang mở). */
function SideColumn({ data }: { data: Customer360 }) {
  const t = useTranslations("c360");
  const latest = latestPortrait(data.portrait);
  return <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto max-lg:hidden">
    <section className="rounded-lg border border-border p-3">
      <h3 className="mb-2 text-sm font-semibold">{t("quickPortrait")}</h3>
      <dl className="flex flex-col gap-2 text-sm">
        {PORTRAIT_FIELDS.map((f) => <div key={f}>
          <dt className="text-xs text-muted-foreground">{t(`portrait.fields.${f}`)}</dt>
          <dd className="line-clamp-2">{latest[f]
            ? <>{latest[f]!.text} <SourceTag source={latest[f]!.source} /></>
            : <span className="text-muted-foreground">—</span>}</dd>
        </div>)}
      </dl>
    </section>
    <section className="rounded-lg border border-border p-3">
      <h3 className="mb-2 text-sm font-semibold">{t("nextTasks")}</h3>
      {data.reminders.length ? <ul className="flex flex-col gap-2 text-sm">
        {data.reminders.map((r) => <li key={r.id}>
          <Tag color={Date.parse(r.remind_at) < data.now ? "red" : "blue"} className="me-0 tabular-nums">{dayjs(r.remind_at).format("DD/MM HH:mm")}</Tag>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{r.note}</p>
        </li>)}
      </ul> : <p className="text-sm text-muted-foreground">{t("noTasks")}</p>}
    </section>
  </aside>;
}

/** Nút mở hồ sơ 360° cạnh tên khách (các bảng mà tên đã là link hội thoại SMAX). */
export function Open360Button({ onClick }: { onClick: () => void }) {
  const t = useTranslations("appointments");
  return <Button type="text" size="small" aria-label={t("openProfile")} title={t("openProfile")}
    icon={<IdCard className="size-4" />} onClick={onClick} />;
}

/**
 * Gắn popup vào 1 bảng: `open(id)` mở hồ sơ; Trước/Tiếp đi theo `ids` (thứ tự bảng đang lọc).
 * Bấm sắp xếp cột → truyền `onTableChange` vào DataTable để Trước/Tiếp theo đúng thứ tự đã sắp.
 */
export function useCustomer360({ ids, staff, onEdit }: {
  ids: string[]; staff: StaffRef[]; onEdit?: (customerId: string, appointmentId: string | null) => void;
}) {
  const [current, setCurrent] = useState<string | null>(null);
  const [sortRank, setSortRank] = useState<Map<string, number> | null>(null);
  const list = useMemo(() => {
    const unique = [...new Set(ids)];
    return sortRank ? unique.sort((a, b) => (sortRank.get(a) ?? Infinity) - (sortRank.get(b) ?? Infinity)) : unique;
  }, [ids, sortRank]);
  // Tham số lỏng để dùng chung mọi kiểu dòng (chỉ cần id / customer_id).
  const onTableChange = (_p: unknown, _f: unknown, _s: unknown, extra: { action: string; currentDataSource: { id: string; customer_id?: string }[] }) => {
    if (extra.action !== "sort") return;
    const rank = new Map<string, number>();
    extra.currentDataSource.forEach((r, i) => { const id = r.customer_id ?? r.id; if (!rank.has(id)) rank.set(id, i); });
    setSortRank(rank);
  };
  return {
    open: setCurrent,
    onTableChange,
    modal: <Customer360Modal customerId={current} ids={list} staff={staff} onNavigate={setCurrent} onEdit={onEdit} onClose={() => setCurrent(null)} />,
  };
}
