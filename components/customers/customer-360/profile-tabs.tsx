"use client";

import { useState, useTransition } from "react";
import { Button, Collapse, Empty, Form, Image, Input, Radio, Select } from "antd";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dayjs from "dayjs";
import { addCustomerNeed, addPortraitNote, setNeedStatus } from "@/app/(app)/customers/customer-360-actions";
import { VisitStatusTag } from "@/components/appointments/appointments-manager";
import { CardStatusTag, DueText, usageOf } from "@/components/cards/card-drawer";
import { DASH, StatusTag } from "@/components/common/cells";
import { Section } from "@/components/common/section";
import type { StaffRef } from "@/components/common/user-avatar";
import { kindText, TourStatusTag } from "@/components/tour/tour-drawer";
import { cardMoney, customerCardMoney, isTourable } from "@/lib/cards";
import { formatRupiah } from "@/lib/currency";
import { latestPortrait, portraitText } from "@/lib/customer-360";
import { toast } from "@/lib/toast";
import { useServiceGroups } from "@/components/common/service-groups";
import {
  NEED_ORIGINS, NEED_STATUSES, NEED_STATUS_COLORS, PORTRAIT_FIELDS, PORTRAIT_SOURCES,
  type Customer360, type Customer360Appointment, type Customer360Card, type NeedOrigin, type NeedStatus, type PortraitSource,
} from "@/types/customer-360";

const fmt = (iso: string, f = "DD/MM/YYYY HH:mm") => dayjs(iso).format(f);
const serviceName = (data: Customer360, id: string) => data.services.find((s) => s.id === id)?.name ?? "";

/** Nguồn chân dung (Khách nói / NV nhận định / AI) — chữ phụ sau nội dung. */
export function SourceTag({ source }: { source: PortraitSource }) {
  const t = useTranslations("c360.portrait.source");
  return <span className="text-xs text-muted-foreground">· {t(source)}</span>;
}

/** Tên nhân viên dạng chuỗi (ghép vào dòng chữ); không có → "—". */
const nameOf = (staff: StaffRef[], id: string | null | undefined) => (id && staff.find((s) => s.id === id)?.user_name) || "—";

/** Dòng tên dịch vụ của lịch: "Sulam Alis – 9D Brows". */
function useApptServices(data: Customer360) {
  const groups = useServiceGroups();
  return (a: Customer360Appointment) => [
    groups.label(a.service_categories),
    a.service_ids.map((id) => { const s = data.services.find((x) => x.id === id); return s ? s.name : ""; }).filter(Boolean).join(", "),
  ].filter(Boolean).join(" – ");
}

// ─────────────────────────── Tổng quan ───────────────────────────

export function OverviewTab({ data, staff }: { data: Customer360; staff: StaffRef[] }) {
  const t = useTranslations("c360");
  const ta = useTranslations("appointments");
  const tt = useTranslations("tour");
  const services = useApptServices(data);
  // Thông tin cơ bản (nguồn, liên hệ đầu, người phụ trách) nằm ở đầu popup (Header).
  return <div className="flex flex-col gap-5">
    {data.can.finance && <FinanceTotal data={data} />}
    <Section title={t("appointments", { count: data.appointments.length })}>
      {data.appointments.length ? <ul className="flex flex-col gap-2">
        {data.appointments.map((a) => <li key={a.id} className="rounded-lg border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium tabular-nums">{fmt(a.scheduled_at)}</span>
            <VisitStatusTag status={a.visit_status} />
            <span className="text-muted-foreground">{services(a)}</span>
          </div>
          {/* Người thực hiện: Telesales · Sales · Master + người thực hiện thêm kèm vai trò. */}
          <p className="mt-1 text-muted-foreground">
            {t("performers")}: {[
              a.staff_id && `${nameOf(staff, a.staff_id)} · ${ta("staff")}`,
              a.sales_id && `${nameOf(staff, a.sales_id)} · ${ta("sales")}`,
              a.technician_id && `${nameOf(staff, a.technician_id)} · ${ta("master")}`,
              ...a.performers.map((p) => `${nameOf(staff, p.profile_id)} · ${ta(`performerRoles.${p.role}`)}`),
            ].filter(Boolean).join(", ") || "—"}
          </p>
        </li>)}
      </ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noAppointments")} />}
    </Section>
    {/* Tour (buổi làm) nối theo customer_id — chỉ hiện khi có (RLS lọc theo quyền tour / thẻ). */}
    {data.tours.length > 0 && <Section title={t("tours", { count: data.tours.length })}>
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {data.tours.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <span className="tabular-nums">{fmt(r.tour_date, "DD/MM/YYYY")}</span>
          <span className="min-w-0 flex-1 truncate">{[serviceName(data, r.service_id), kindText(tt, r)].filter(Boolean).join(" · ")}</span>
          <span className="text-muted-foreground">{nameOf(staff, r.technician_id)}</span>
          <TourStatusTag tour={r} />
        </li>)}
      </ul>
    </Section>}
  </div>;
}

// ─────────────────────────── Chân dung ───────────────────────────

type PortraitValues = { text: string; source: (typeof PORTRAIT_SOURCES)[number] };

export function PortraitTab({ data, staff, onSaved }: { data: Customer360; staff: StaffRef[]; onSaved: () => void }) {
  const t = useTranslations("c360.portrait");
  const locale = useLocale();
  const [form] = Form.useForm<PortraitValues>();
  const [pending, start] = useTransition();
  const latest = latestPortrait(data.portrait);

  // Nhân viên ghi chú thô — AI tự nhận ra thuộc mục chân dung nào.
  const save = (v: PortraitValues) => start(async () => {
    const res = await addPortraitNote(data.customer.id, v);
    if (res.error) return void toast.error(res.error);
    if (res.warning) toast.warning(t("aiFailed", { reason: res.warning }));
    else if (!res.fields?.length) toast.warning(t("aiNothing"));
    else toast.success(t("saved", { fields: res.fields.map((f) => t(`fields.${f}`)).join(", ") }));
    form.resetFields(["text"]);
    onSaved();
  });

  return <div className="flex flex-col gap-5">
    <Form form={form} layout="vertical" requiredMark={false} disabled={pending} onFinish={save}
      initialValues={{ source: "customer" }} className="rounded-lg border border-border bg-muted/40 p-4">
      <Form.Item name="source" label={t("sourceLabel")}>
        <Radio.Group optionType="button" options={PORTRAIT_SOURCES.map((s) => ({ value: s, label: t(`source.${s}`) }))} />
      </Form.Item>
      <Form.Item name="text" label={t("text")} extra={t("textHint")}
        rules={[{ required: true, whitespace: true, message: t("text") }, { max: 1000 }]}>
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={1000} showCount placeholder={t("textPlaceholder")} />
      </Form.Item>
      <div className="flex justify-end">
        <Button type="primary" htmlType="submit" loading={pending}>{pending ? t("analyzing") : t("add")}</Button>
      </div>
    </Form>

    <div className="grid gap-3 sm:grid-cols-2">
      {PORTRAIT_FIELDS.map((f) => {
        const cur = latest[f];
        const all = data.portrait.filter((e) => e.field === f); // mới nhất trước
        return <section key={f} className="rounded-lg border border-border p-3 text-sm">
          <h4 className="font-semibold">{t(`fields.${f}`)}</h4>
          {cur ? <>
            <p className="mt-1 whitespace-pre-wrap">{portraitText(cur, locale)} <SourceTag source={cur.source} /></p>
            {cur.message_ref && <blockquote className="mt-1 border-s-2 border-border ps-2 text-xs text-muted-foreground">“{cur.message_ref.text}”</blockquote>}
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">{nameOf(staff, cur.created_by)} · {fmt(cur.created_at)}</p>
            {all.length > 1 && <Collapse ghost size="small" className="-mx-3 mt-1" items={[{
              key: "h", label: <span className="text-xs">{t("history", { count: all.length })}</span>,
              children: <ul className="flex flex-col gap-2 text-xs">{all.map((e) => <li key={e.id}>
                <div className="text-muted-foreground tabular-nums">{fmt(e.created_at)} · {nameOf(staff, e.created_by)} <SourceTag source={e.source} /></div>
                <p className="whitespace-pre-wrap">{portraitText(e, locale)}</p>
              </li>)}</ul>,
            }]} />}
          </> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("empty")} />}
        </section>;
      })}
    </div>
  </div>;
}

// ─────────────────────────── Dịch vụ & Upsell ───────────────────────────

type NeedValues = { title: string; service_id?: string; origin: NeedOrigin };

export function ServicesTab({ data, staff, onSaved }: { data: Customer360; staff: StaffRef[]; onSaved: () => void }) {
  const t = useTranslations("c360.needs");
  const tc = useTranslations("common");
  const [form] = Form.useForm<NeedValues>();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();

  const add = (v: NeedValues) => start(async () => {
    const res = await addCustomerNeed(data.customer.id, { title: v.title, service_id: v.service_id ?? null, origin: v.origin });
    if (res.error) return void toast.error(res.error);
    toast.success(t("saved"));
    form.resetFields();
    setAdding(false);
    onSaved();
  });
  const changeStatus = (id: string, status: (typeof NEED_STATUSES)[number]) => start(async () => {
    const res = await setNeedStatus(id, status);
    if (res.error) return void toast.error(res.error);
    onSaved();
  });

  return <div className="flex flex-col gap-5">
    <PurchasedServices data={data} />
    <Section title={t("title")}
      extra={!adding && <Button size="small" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>{t("add")}</Button>}>
      {adding && <Form form={form} layout="vertical" requiredMark={false} disabled={pending} onFinish={add}
        initialValues={{ origin: "customer_asked" }} className="rounded-lg border border-border bg-muted/40 p-4">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Form.Item name="title" label={t("name")} rules={[{ required: true, whitespace: true, message: t("name") }, { max: 200 }]}>
            <Input placeholder={t("namePlaceholder")} maxLength={200} autoFocus />
          </Form.Item>
          <Form.Item name="service_id" label={t("service")}>
            <Select allowClear showSearch={{ optionFilterProp: "label" }}
              options={data.services.filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
        </div>
        <Form.Item name="origin" label={t("originLabel")}>
          <Radio.Group optionType="button" options={NEED_ORIGINS.map((o) => ({ value: o, label: t(`origin.${o}`) }))} />
        </Form.Item>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setAdding(false)}>{tc("cancel")}</Button>
          <Button type="primary" htmlType="submit" loading={pending}>{t("add")}</Button>
        </div>
      </Form>}
      {data.needs.length ? <ul className="flex flex-col gap-2">
        {data.needs.map((n) => <li key={n.id} className="rounded-lg border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{n.title}</span>
            <span className="text-xs text-muted-foreground">{t(`origin.${n.origin}`)}</span>
            <Select size="small" value={n.status} className="ms-auto min-w-32" aria-label={t("history")} disabled={pending}
              onChange={(s) => changeStatus(n.id, s)}
              options={NEED_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
              // Option chữ trần; giá trị đang chọn hiện tag màu trạng thái.
              labelRender={({ value }) => <StatusTag color={NEED_STATUS_COLORS[value as NeedStatus]} label={t(`status.${value}`)} />} />
          </div>
          {/* Lịch sử đổi trạng thái: mốc → mốc. */}
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {n.history.map((h) => `${t(`status.${h.status}`)} ${fmt(h.at, "DD/MM")}`).join(" → ")}
          </p>
        </li>)}
      </ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("empty")} />}
    </Section>
    {data.can.finance && <FinanceZones data={data} staff={staff} />}
  </div>;
}

/** Dịch vụ đã mua: mọi dòng của thẻ chưa huỷ — đã dùng x/y buổi (đếm tour gắn dòng thẻ), DV đã hoàn gạch ngang. */
function PurchasedServices({ data }: { data: Customer360 }) {
  const t = useTranslations("c360");
  const tc = useTranslations("cards");
  const groups = useServiceGroups();
  const used = usageOf(data.tours);
  const rows = data.cards.filter((c) => !c.cancelled_at).flatMap((card) => card.items.map((item) => ({ card, item })));
  if (!rows.length) return null;
  return <Section title={t("purchased")}>
    <ul className="divide-y divide-border rounded-lg border border-border text-sm">
      {rows.map(({ card, item }) => {
        const s = data.services.find((x) => x.id === item.service_id);
        const n = used(item.id);
        return <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="min-w-0">
            <div className={item.refunded_at ? "font-medium line-through opacity-60" : "font-medium"}>{s?.name ?? DASH}</div>
            <div className="text-xs text-muted-foreground">{[s && groups.name(s.group_id), card.code].filter(Boolean).join(" · ")}</div>
          </div>
          {/* Mực / phí Master không tạo tour → không có buổi. */}
          {isTourable(item) && !item.refunded_at ? <span className={`shrink-0 tabular-nums ${n >= item.sessions ? "text-success" : "text-muted-foreground"}`}>
            {tc("usedSessions", { used: n, total: item.sessions })}
          </span> : null}
        </li>;
      })}
    </ul>
  </Section>;
}

/** Có `can.finance` → server đã select đủ cột tiền của thẻ (xem `cardFields`). */
type MoneyCard = Customer360Card & {
  deposit_used: number;
  items: (Customer360Card["items"][number] & { price: number; refund_amount: number | null })[];
  payments: NonNullable<Customer360Card["payments"]>;
};
const moneyCards = (data: Customer360) => data.cards as MoneyCard[];

/** Tổng tích luỹ từ thẻ chưa huỷ: Giá trị thẻ · Đã thu (gồm cọc chưa trừ) · Công nợ. */
function FinanceTotal({ data }: { data: Customer360 }) {
  const t = useTranslations("c360.finance");
  const tc = useTranslations("cards");
  const ta = useTranslations("appointments");
  const f = customerCardMoney(moneyCards(data), data.customer.deposit_amount);
  const cells: [string, React.ReactNode][] = [
    [tc("value"), formatRupiah(f.value)],
    [tc("collected"), formatRupiah(f.collected)],
    [f.due !== null && f.due < 0 ? tc("refundOwed") : tc("due"), f.due === null ? ta("dueUnknown") : <DueText due={f.due} />],
  ];
  return <Section title={t("total")}>
    <div className="grid grid-cols-3 gap-3">
      {cells.map(([label, v]) => <div key={label} className="rounded-lg border border-border p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 font-semibold tabular-nums">{v}</div>
      </div>)}
    </div>
    {f.depositLeft > 0 && <p className="mt-2 text-xs text-muted-foreground tabular-nums">{t("depositLeft", { amount: formatRupiah(f.depositLeft) })}</p>}
  </Section>;
}

/** Tài chính: Tổng tích luỹ · Thẻ liệu trình · Lịch sử thanh toán (cọc + từng lần thu / hoàn ở thẻ, kèm ảnh). */
function FinanceZones({ data, staff }: { data: Customer360; staff: StaffRef[] }) {
  const t = useTranslations("c360.finance");
  const tc = useTranslations("cards");
  const cards = moneyCards(data);
  // Thẻ đã huỷ không tính tiền (khớp Tổng tích luỹ + báo cáo doanh thu).
  const payments = cards.filter((c) => !c.cancelled_at).flatMap((c) => c.payments.map((p) => ({ ...p, code: c.code })))
    .sort((a, b) => b.paid_at.localeCompare(a.paid_at));
  const deposit = data.customer.deposit_amount ?? 0;
  const proof = data.customer.payment_confirm_url;
  const amount = (v: number) => <span className={`shrink-0 tabular-nums ${v < 0 ? "text-destructive" : "text-success"}`}>
    {v < 0 ? `− ${formatRupiah(-v)}` : formatRupiah(v)}</span>;
  const thumb = (url: string) => <Image key={url} src={url} alt="" width={40} height={40} className="rounded object-cover" />;
  return <>
    <FinanceTotal data={data} />
    <Section title={t("cards", { count: cards.length })}>
      {cards.length ? <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {cards.map((c) => {
          const m = cardMoney(c);
          return <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <span className="font-medium">{c.code}</span>
            <CardStatusTag card={c} tours={data.tours} />
            <span className="text-muted-foreground tabular-nums">{fmt(c.created_at, "DD/MM/YYYY")}</span>
            <span className="ms-auto flex flex-wrap items-center gap-x-3 tabular-nums">
              <span><span className="text-muted-foreground">{tc("value")}</span> {formatRupiah(m.value)}</span>
              <span><span className="text-muted-foreground">{tc("collected")}</span> {formatRupiah(m.collected)}</span>
              <span><span className="text-muted-foreground">{tc("due")}</span> <DueText due={m.due} /></span>
            </span>
          </li>;
        })}
      </ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noCards")} />}
    </Section>
    <Section title={t("payments")}>
      {deposit > 0 || payments.length ? <Image.PreviewGroup>
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {deposit > 0 && <li className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="flex items-center gap-2">{proof && thumb(proof)}{t("deposit")}</div>
            {amount(deposit)}
          </li>}
          {payments.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="tabular-nums">{fmt(p.paid_at, "DD/MM/YYYY")}</span> · {tc(`method.${p.method}`)} · {p.code}
                {p.created_by && <span className="text-muted-foreground">{nameOf(staff, p.created_by)}</span>}
              </div>
              {p.note && <div className="text-xs text-muted-foreground">{p.note}</div>}
              {p.images.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{p.images.map(thumb)}</div>}
            </div>
            {amount(p.amount)}
          </li>)}
        </ul>
      </Image.PreviewGroup> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noPayments")} />}
    </Section>
  </>;
}
