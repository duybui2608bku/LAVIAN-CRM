"use client";

import { useState, useTransition } from "react";
import { Button, Collapse, Empty, Form, Input, Radio, Select, Tag } from "antd";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dayjs from "dayjs";
import { addCustomerNeed, addPortraitEntry, setNeedStatus } from "@/app/(app)/customers/customer-360-actions";
import { VisitStatusTag } from "@/components/appointments/appointments-manager";
import { SourceIcon } from "@/components/common/source-icon";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { useCustomerMessages } from "@/components/customers/customer-360/use-customer-messages";
import { formatRupiah } from "@/lib/currency";
import { customerFinance, latestPortrait, portraitText } from "@/lib/customer-360";
import { serviceName } from "@/lib/customers";
import { toast } from "@/lib/toast";
import {
  NEED_ORIGINS, NEED_STATUSES, NEED_STATUS_COLORS, PORTRAIT_FIELDS, PORTRAIT_SOURCES,
  type Customer360, type Customer360Appointment, type MessageRef, type NeedOrigin, type PortraitField, type PortraitSource,
} from "@/types/customer-360";
import { serviceCategoriesLabel } from "@/types/service";

const fmt = (iso: string, f = "DD/MM/YYYY HH:mm") => dayjs(iso).format(f);
const money = (v: number | null) => (v === null ? null : formatRupiah(v));

/** Nhãn nguồn chân dung: Khách nói (xanh lá) / NV nhận định (mặc định) / AI (tím). */
const SOURCE_COLORS: Record<PortraitSource, string | undefined> = { customer: "green", staff: undefined, ai: "purple" };
export function SourceTag({ source }: { source: PortraitSource }) {
  const t = useTranslations("c360.portrait.source");
  return <Tag color={SOURCE_COLORS[source]} className="me-0 align-middle text-xs">{t(source)}</Tag>;
}

const staffName = (staff: StaffRef[], id: string | null | undefined) => (id && staff.find((s) => s.id === id)?.user_name) || "—";

/** Dòng tên dịch vụ của lịch: "Sulam Alis – 9D Brows". */
function useApptServices(data: Customer360) {
  const locale = useLocale();
  return (a: Customer360Appointment) => [
    serviceCategoriesLabel(a.service_categories),
    a.service_ids.map((id) => { const s = data.services.find((x) => x.id === id); return s ? serviceName(s, locale) : ""; }).filter(Boolean).join(", "),
  ].filter(Boolean).join(" – ");
}

// ─────────────────────────── Tổng quan ───────────────────────────

export function OverviewTab({ data, staff }: { data: Customer360; staff: StaffRef[] }) {
  const t = useTranslations("c360");
  const ta = useTranslations("appointments");
  const services = useApptServices(data);
  const c = data.customer;
  const person = (id: string | null) => {
    const s = id ? staff.find((x) => x.id === id) : undefined;
    return s ? staffLabel(s) : <span className="text-muted-foreground">—</span>;
  };
  return <div className="flex flex-col gap-5">
    <section>
      <h3 className="mb-2 font-semibold">{t("info")}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
        <dt className="text-muted-foreground">{t("source")}</dt>
        <dd className="flex items-center gap-1.5"><SourceIcon source={c.source} />{c.source ?? "—"}</dd>
        <dt className="text-muted-foreground">{t("firstContact")}</dt>
        <dd className="tabular-nums">{c.first_contact ? dayjs(c.first_contact).format("DD/MM/YYYY") : "—"}</dd>
        <dt className="text-muted-foreground">{ta("staff")}</dt><dd>{person(c.staff_id)}</dd>
        <dt className="text-muted-foreground">{ta("sales")}</dt><dd>{person(c.sales_id)}</dd>
        <dt className="text-muted-foreground">{ta("master")}</dt><dd>{person(c.technician_id)}</dd>
      </dl>
    </section>
    {data.can.finance && <FinanceTotal data={data} />}
    <section>
      <h3 className="mb-2 font-semibold">{t("appointments", { count: data.appointments.length })}</h3>
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
              a.staff_id && `${staffName(staff, a.staff_id)} · ${ta("staff")}`,
              a.sales_id && `${staffName(staff, a.sales_id)} · ${ta("sales")}`,
              a.technician_id && `${staffName(staff, a.technician_id)} · ${ta("master")}`,
              ...a.performers.map((p) => `${staffName(staff, p.profile_id)} · ${ta(`performerRoles.${p.role}`)}`),
            ].filter(Boolean).join(", ") || "—"}
          </p>
        </li>)}
      </ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noAppointments")} />}
    </section>
  </div>;
}

// ─────────────────────────── Chân dung ───────────────────────────

type PortraitValues = { field: PortraitField; text: string; source: (typeof PORTRAIT_SOURCES)[number]; message?: string };

export function PortraitTab({ data, staff, onSaved }: { data: Customer360; staff: StaffRef[]; onSaved: () => void }) {
  const t = useTranslations("c360.portrait");
  const locale = useLocale();
  const [form] = Form.useForm<PortraitValues>();
  const [pending, start] = useTransition();
  // Tin khách gửi (để gắn làm nguồn gốc) — chỉ tải khi khách có hội thoại SMAX.
  const { data: messages } = useCustomerMessages(data.customer.thread_link ? data.customer.id : null);
  const inbound = (messages ?? data.smax_messages ?? []).filter((m) => !m.out && m.text);
  const latest = latestPortrait(data.portrait);

  const save = (v: PortraitValues) => start(async () => {
    const m = inbound.find((x) => x.id === v.message);
    const message_ref: MessageRef | null = m ? { id: m.id, at: m.at, text: m.text.slice(0, 2000) } : null;
    const res = await addPortraitEntry(data.customer.id, { field: v.field, text: v.text, source: v.source, message_ref });
    if (res.error) return void toast.error(res.error);
    toast.success(t("saved"));
    form.resetFields(["text", "message"]);
    onSaved();
  });

  return <div className="flex flex-col gap-5">
    <Form form={form} layout="vertical" requiredMark={false} disabled={pending} onFinish={save}
      initialValues={{ field: "wish", source: "customer" }} className="rounded-lg border border-border bg-muted/40 p-4">
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Form.Item name="field" label={t("field")}>
          <Select options={PORTRAIT_FIELDS.map((f) => ({ value: f, label: t(`fields.${f}`) }))} />
        </Form.Item>
        <Form.Item name="source" label={t("sourceLabel")}>
          <Radio.Group optionType="button" options={PORTRAIT_SOURCES.map((s) => ({ value: s, label: t(`source.${s}`) }))} />
        </Form.Item>
      </div>
      <Form.Item name="text" label={t("text")} rules={[{ required: true, whitespace: true, message: t("text") }, { max: 1000 }]}>
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={1000} showCount />
      </Form.Item>
      {inbound.length > 0 && <Form.Item name="message" label={t("message")}>
        <Select allowClear showSearch={{ optionFilterProp: "label" }} placeholder={t("messagePlaceholder")}
          options={[...inbound].reverse().map((m) => ({ value: m.id, label: `${fmt(m.at, "DD/MM HH:mm")} · ${m.text.slice(0, 120)}` }))} />
      </Form.Item>}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{t("immutable")}</span>
        <Button type="primary" htmlType="submit" loading={pending}>{t("add")}</Button>
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
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">{staffName(staff, cur.created_by)} · {fmt(cur.created_at)}</p>
            {all.length > 1 && <Collapse ghost size="small" className="-mx-3 mt-1" items={[{
              key: "h", label: <span className="text-xs">{t("history", { count: all.length })}</span>,
              children: <ul className="flex flex-col gap-2 text-xs">{all.map((e) => <li key={e.id}>
                <div className="text-muted-foreground tabular-nums">{fmt(e.created_at)} · {staffName(staff, e.created_by)} <SourceTag source={e.source} /></div>
                <p className="whitespace-pre-wrap">{portraitText(e, locale)}</p>
              </li>)}</ul>,
            }]} />}
          </> : <p className="mt-1 text-muted-foreground">{t("empty")}</p>}
        </section>;
      })}
    </div>
  </div>;
}

// ─────────────────────────── Dịch vụ & Upsell ───────────────────────────

type NeedValues = { title: string; service_id?: string; origin: NeedOrigin };

export function ServicesTab({ data, onSaved }: { data: Customer360; onSaved: () => void }) {
  const t = useTranslations("c360.needs");
  const tc = useTranslations("common");
  const locale = useLocale();
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
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{t("title")}</h3>
        {!adding && <Button size="small" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>{t("add")}</Button>}
      </div>
      {adding && <Form form={form} layout="vertical" requiredMark={false} disabled={pending} onFinish={add}
        initialValues={{ origin: "customer_asked" }} className="mb-3 rounded-lg border border-border bg-muted/40 p-4">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Form.Item name="title" label={t("name")} rules={[{ required: true, whitespace: true, message: t("name") }, { max: 200 }]}>
            <Input placeholder={t("namePlaceholder")} maxLength={200} autoFocus />
          </Form.Item>
          <Form.Item name="service_id" label={t("service")}>
            <Select allowClear showSearch={{ optionFilterProp: "label" }}
              options={data.services.filter((s) => s.is_active).map((s) => ({ value: s.id, label: serviceName(s, locale) }))} />
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
            <Tag className="me-0">[{t(`origin.${n.origin}`)}]</Tag>
            <Select size="small" value={n.status} className="ms-auto min-w-32" aria-label={t("history")} disabled={pending}
              onChange={(s) => changeStatus(n.id, s)}
              options={NEED_STATUSES.map((s) => ({ value: s, label: <Tag color={NEED_STATUS_COLORS[s]} className="me-0">{t(`status.${s}`)}</Tag> }))} />
          </div>
          {/* Lịch sử đổi trạng thái: mốc → mốc. */}
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {n.history.map((h) => `${t(`status.${h.status}`)} ${fmt(h.at, "DD/MM")}`).join(" → ")}
          </p>
        </li>)}
      </ul> : <p className="text-sm text-muted-foreground">{t("empty")}</p>}
    </section>
    {data.can.finance && <FinanceZones data={data} />}
  </div>;
}

/** Vùng 1: Tổng tích luỹ (Giá trị DV, Thực thu, Phải thu). */
function FinanceTotal({ data }: { data: Customer360 }) {
  const t = useTranslations("c360.finance");
  const ta = useTranslations("appointments");
  const f = customerFinance(data.appointments, data.customer.deposit_amount, data.now);
  return <section>
    <h3 className="mb-2 font-semibold">{t("total")}</h3>
    <div className="grid grid-cols-3 gap-3">
      {([[ta("bill"), money(f.total.bill)], [ta("paidTotal"), money(f.total.collected)], [ta("due"), money(f.total.due)]] as const)
        .map(([label, v]) => <div key={label} className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 font-semibold tabular-nums">{v ?? ta("dueUnknown")}</div>
        </div>)}
    </div>
  </section>;
}

/** Tài chính 3 vùng: Tổng tích luỹ · Đơn hiện tại · Lịch sử mua. */
function FinanceZones({ data }: { data: Customer360 }) {
  const t = useTranslations("c360.finance");
  const ta = useTranslations("appointments");
  const services = useApptServices(data);
  const f = customerFinance(data.appointments, data.customer.deposit_amount, data.now);
  const row = (label: string, v: string | null, className?: string) => <>
    <dt className="text-muted-foreground">{label}</dt><dd className={`text-right tabular-nums ${className ?? ""}`}>{v ?? ta("dueUnknown")}</dd>
  </>;
  return <>
    <FinanceTotal data={data} />
    <section>
      <h3 className="mb-2 font-semibold">{t("current")}</h3>
      {f.current ? <div className="rounded-lg border border-border p-3 text-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-medium tabular-nums">{fmt(f.current.appointment.scheduled_at)}</span>
          <span className="text-muted-foreground">{services(f.current.appointment)}</span>
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1">
          {row(ta("deposit"), money(f.current.deposit))}
          {row(ta("bill"), money(f.current.bill))}
          {row(ta("paidTotal"), money(f.current.collected), "text-success")}
          {row(ta("due"), money(f.current.due), "font-medium text-warning")}
        </dl>
      </div> : <p className="text-sm text-muted-foreground">{t("empty")}</p>}
    </section>
    <section>
      <h3 className="mb-2 font-semibold">{t("history")}</h3>
      {f.history.length ? <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {f.history.map((h) => <li key={h.appointment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <span className="tabular-nums">{fmt(h.appointment.scheduled_at, "DD/MM/YYYY")}</span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{services(h.appointment)}</span>
          <span className="tabular-nums">{ta("bill")}: {formatRupiah(h.bill)}</span>
          <span className="tabular-nums text-muted-foreground">{t("paid")}: {formatRupiah(h.paid)}</span>
        </li>)}
      </ul> : <p className="text-sm text-muted-foreground">{t("empty")}</p>}
    </section>
  </>;
}
