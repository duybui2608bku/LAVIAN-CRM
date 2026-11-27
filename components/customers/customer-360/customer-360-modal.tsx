"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Avatar, Button, Modal, Skeleton, Tabs } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, ChevronLeft, ChevronRight, NotebookPen, PanelRightOpen, Phone, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dayjs from "dayjs";
import { getCustomer360 } from "@/app/(app)/customers/customer-360-actions";
import { DASH, StatusTag } from "@/components/common/cells";
import { useCan } from "@/components/common/permissions";
import { Section } from "@/components/common/section";
import { SourceIcon } from "@/components/common/source-icon";
import { staffName, type StaffRef } from "@/components/common/user-avatar";
import { MessagesTab, PhotosTab, TimelineTab } from "@/components/customers/customer-360/activity-tabs";
import { OverviewTab, PortraitTab, ServicesTab, SourceTag } from "@/components/customers/customer-360/profile-tabs";
import { currentAppointment, latestPortrait, portraitText } from "@/lib/customer-360";
import { CUSTOMER_OPTIONS } from "@/lib/customer-options";
import { optionLabel } from "@/lib/customers";
import { PORTRAIT_FIELDS, type Customer360, type ViewerRole } from "@/types/customer-360";

type TabKey = "overview" | "portrait" | "services" | "photos" | "messages" | "timeline";
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
    ? <Button icon={<PanelRightOpen className="size-4" />} onClick={() => { close(); onEdit(customerId, data ? currentAppointment(data.appointments, data.now)?.id ?? null : null); }}>{t("toEdit")}</Button>
    : can("appointments.view") && <Link href={`/appointments?customer=${customerId}`} onClick={close}>
      <Button icon={<PanelRightOpen className="size-4" />}>{t("toEdit")}</Button>
    </Link>);

  // Kích thước cố định (không co giãn theo nội dung / tab / lúc đang tải): rộng 1360, cao 720, màn nhỏ thì vừa màn hình.
  // Desktop: thanh tab đứng yên, nội dung mỗi tab cuộn trong cùng 1 vùng; điện thoại: cuộn cả thân.
  return <Modal open={!!customerId} onCancel={close} width="min(1360px, calc(100vw - 32px))" destroyOnHidden centered
    styles={{ body: { height: "min(720px, calc(100vh - 220px))", overflowY: "auto" } }}
    title={<Header data={data} staff={staff} index={index} total={ids.length} onPrev={() => go(-1)} onNext={() => go(1)} />}
    footer={<div className="flex flex-wrap justify-end gap-2">
      <Button icon={<NotebookPen className="size-4" />} onClick={() => { setTab("timeline"); setComposing(true); }}>{t("quickNote")}</Button>
      {editButton}
    </div>}>
    {isPending ? <Skeleton active paragraph={{ rows: 10 }} />
      : error ? <Alert type="error" showIcon title={error.message} />
      : <div className="flex flex-col gap-4 lg:h-full">
        <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
          <SideColumn data={data} />
          <Tabs activeKey={active} onChange={(k) => setTab(k as TabKey)}
            className="lg:h-full lg:[&_.ant-tabs-content]:h-full lg:[&_.ant-tabs-content-holder]:overflow-y-auto lg:[&_.ant-tabs-content-holder]:[scrollbar-gutter:stable] lg:[&_.ant-tabs-tabpane]:h-full"
            items={[
            { key: "overview", label: t("tabs.overview"), children: <OverviewTab data={data} staff={staff} /> },
            { key: "portrait", label: t("tabs.portrait"), children: <PortraitTab data={data} staff={staff} onSaved={refresh} /> },
            { key: "services", label: t("tabs.services"), children: <ServicesTab data={data} staff={staff} onSaved={refresh} /> },
            ...(data.can.photos ? [{ key: "photos", label: t("tabs.photos"), children: <PhotosTab data={data} /> }] : []),
            { key: "messages", label: t("tabs.messages"), children: <MessagesTab data={data} staff={staff} onSaved={refresh} /> },
            { key: "timeline", label: t("tabs.timeline"), children: <TimelineTab data={data} staff={staff} composing={composing} onSaved={refresh} /> },
          ]} />
        </div>
      </div>}
  </Modal>;
}

/** Đầu popup: avatar + tên + trạng thái + SĐT, thông tin cơ bản (nguồn, liên hệ đầu, người phụ trách), nút Trước/Tiếp. */
function Header({ data, staff, index, total, onPrev, onNext }: {
  data: Customer360 | undefined; staff: StaffRef[]; index: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  const t = useTranslations("c360");
  const ta = useTranslations("appointments");
  const locale = useLocale();
  const c = data?.customer;
  const stage = c && CUSTOMER_OPTIONS.find((o) => o.kind === "stage" && o.value === c.stage);
  const info: [string, React.ReactNode][] = c ? [
    [t("source"), <span key="s" className="flex items-center gap-1.5"><SourceIcon source={c.source} />{c.source ?? DASH}</span>],
    [t("firstContact"), c.first_contact ? dayjs(c.first_contact).format("DD/MM/YYYY") : DASH],
    [ta("staff"), staffName(staff, c.staff_id)],
    [ta("sales"), staffName(staff, c.sales_id)],
    [ta("master"), staffName(staff, c.technician_id)],
  ] : [];
  // 2 tầng: danh tính (avatar · tên · trạng thái · SĐT) + Trước/Tiếp, rồi dải thông tin nhãn trên / giá trị dưới.
  return <div className="flex flex-col gap-3 pe-8 font-normal">
    <div className="flex items-center gap-3">
      <Avatar src={c?.picture || undefined} size={48} className="shrink-0 bg-accent text-lg font-semibold text-primary">{c?.full_name.charAt(0)}</Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-lg font-semibold leading-tight">{c?.full_name ?? t("title")}</span>
          {stage && <StatusTag label={optionLabel(stage, locale)} color={stage.color} />}
        </div>
        <div className="mt-1 flex min-h-5 items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
          {c?.phone && <><Phone className="size-3.5 shrink-0" aria-hidden />{c.phone}</>}
        </div>
      </div>
      {index >= 0 && <div className="flex shrink-0 items-center gap-1">
        <Button aria-label={t("prev")} title={t("prev")} disabled={index <= 0} icon={<ChevronLeft className="size-4" />} onClick={onPrev} />
        <span className="min-w-12 text-center text-sm text-muted-foreground tabular-nums">{t("position", { index: index + 1, total })}</span>
        <Button aria-label={t("next")} title={t("next")} disabled={index >= total - 1} icon={<ChevronRight className="size-4" />} onClick={onNext} />
      </div>}
    </div>
    {info.length > 0 && <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-muted px-4 py-2.5 text-sm sm:grid-cols-3 lg:grid-cols-5">
      {info.map(([label, value]) => <div key={label} className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 flex min-h-5 min-w-0 items-center tabular-nums">{value}</dd>
      </div>)}
    </dl>}
  </div>;
}

/** Cột trái (ẩn trên điện thoại): chân dung nhanh + việc tiếp theo (lịch nhắc đang mở). */
function SideColumn({ data }: { data: Customer360 }) {
  const t = useTranslations("c360");
  const locale = useLocale();
  const latest = latestPortrait(data.portrait);
  const filled = PORTRAIT_FIELDS.filter((f) => latest[f]).length;
  return <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-muted/40 p-4 max-lg:hidden">
    <Section title={t("quickPortrait")} icon={UserRound}
      extra={<span className="text-xs text-muted-foreground tabular-nums">{filled}/{PORTRAIT_FIELDS.length}</span>}>
      <dl className="flex flex-col gap-3 text-sm">
        {PORTRAIT_FIELDS.map((f) => <div key={f}>
          <dt className="text-xs text-muted-foreground">{t(`portrait.fields.${f}`)}</dt>
          <dd className="mt-0.5 line-clamp-3">{latest[f]
            ? <>{portraitText(latest[f]!, locale)} <SourceTag source={latest[f]!.source} /></>
            : DASH}</dd>
        </div>)}
      </dl>
    </Section>
    <Section title={t("nextTasks")} icon={BellRing} className="border-t border-border pt-4">
      {data.reminders.length ? <ul className="flex flex-col gap-2 text-sm">
        {data.reminders.map((r) => <li key={r.id} className="rounded-md border border-border bg-card px-3 py-2">
          <span className={`text-xs font-medium tabular-nums ${Date.parse(r.remind_at) < data.now ? "text-destructive" : "text-muted-foreground"}`}>{dayjs(r.remind_at).format("DD/MM HH:mm")}</span>
          <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap">{r.note}</p>
        </li>)}
      </ul> : <p className="text-sm text-muted-foreground">{t("noTasks")}</p>}
    </Section>
  </aside>;
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
