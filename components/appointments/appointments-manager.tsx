"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button, Drawer, Form, Input, Select, Switch, Table, Tag, type TableProps } from "antd";
import { CalendarPlus, Search, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dayjs from "dayjs";
import { createAppointment, deleteAppointment, patchAppointment } from "@/app/(app)/appointments/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { DatePicker } from "@/components/common/date-picker";
import { EnumTag } from "@/components/common/enum-tag";
import { InlineMultiSelect, InlineSelect } from "@/components/common/inline-select";
import { useConfirm } from "@/components/common/confirm-action";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { CUSTOMER_OPTIONS } from "@/lib/customer-options";
import { optionLabel, serviceName } from "@/lib/customers";
import { toast } from "@/lib/toast";
import type { Appointment, AppointmentCustomer, AppointmentPatch } from "@/types/appointment";
import type { Service } from "@/types/service";

export function AppointmentsManager({ appointments, customers, staff, services, initialCustomer }: {
  appointments: Appointment[];
  customers: AppointmentCustomer[];
  staff: (StaffRef & { status: string })[];
  services: Service[];
  initialCustomer: string;
}) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [customerFilter, setCustomerFilter] = useState(initialCustomer);
  const [arrival, setArrival] = useState("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [rows, patchOptimistic] = useOptimistic(appointments,
    (state: Appointment[], patch: AppointmentPatch & { id: string }) =>
      state.map((row) => row.id === patch.id ? { ...row, ...patch } : row));

  const save = (id: string, patch: AppointmentPatch) => start(async () => {
    // Keep an unsaved note draft on error instead of rolling the text back.
    if (patch.note === undefined) patchOptimistic({ id, ...patch });
    try {
      const result = await patchAppointment(id, patch);
      if (result.error) toast.error(result.error);
      else toast.success(t("saved"));
    } catch { toast.error(t("saveError")); }
  });

  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
  const sourceTag = (source: string | null) => {
    const option = CUSTOMER_OPTIONS.find((o) => o.kind === "source" && o.value === source);
    return source ? <EnumTag label={option ? optionLabel(option, locale) : source} color={option?.color} /> : "—";
  };
  const filtered = rows.filter((row) => {
    const customer = customerMap.get(row.customer_id);
    return customer && (!customerFilter || row.customer_id === customerFilter)
      && (!date || dayjs(row.scheduled_at).format("YYYY-MM-DD") === date)
      && (arrival === "all" || row.checked_in === (arrival === "arrived"))
      && `${customer.full_name} ${customer.phone}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  });
  const resetPage = () => setPage(1);
  const columns: TableProps<Appointment>["columns"] = [
    { title: t("name"), width: 180, fixed: "left", render: (_, row) =>
      <span className="font-medium">{customerMap.get(row.customer_id)?.full_name}</span> },
    { title: t("phone"), width: 160, render: (_, row) => customerMap.get(row.customer_id)?.phone },
    { title: t("source"), width: 140, render: (_, row) => sourceTag(customerMap.get(row.customer_id)?.source ?? null) },
    { title: t("date"), width: 220, sorter: (a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at),
      render: (_, row) => <AppointmentDate inline value={row.scheduled_at} disabled={pending} onSave={(iso) => save(row.id, { scheduled_at: iso })} /> },
    { title: t("confirmation"), width: 170, render: (_, row) => <InlineSelect
      value={row.checked_in ? "arrived" : "waiting"} disabled={pending} ariaLabel={t("confirmation")}
      display={<Tag color={row.checked_in ? "green" : "default"} className="me-0">{row.checked_in ? t("arrived") : t("notArrived")}</Tag>}
      options={[{ value: "arrived", label: t("arrived") }, { value: "waiting", label: t("notArrived") }]}
      onSave={(value) => save(row.id, { checked_in: value === "arrived" })} /> },
    { title: t("services"), width: 220, render: (_, row) => <InlineMultiSelect
      value={row.service_ids} disabled={pending} ariaLabel={t("services")}
      display={row.service_ids.length ? <div className="flex flex-wrap gap-1">{row.service_ids.map((id) => {
        const service = services.find((s) => s.id === id);
        return <Tag key={id} color="purple" className="me-0">{service ? serviceName(service, locale) : id}</Tag>;
      })}</div> : <span className="text-muted-foreground">{t("choose")}</span>}
      options={services.filter((s) => s.is_active || row.service_ids.includes(s.id)).map((s) => ({ value: s.id, label: serviceName(s, locale) }))}
      onSave={(service_ids) => save(row.id, { service_ids })} /> },
    { title: t("payment"), width: 160, render: (_, row) => <InlineSelect value={row.payment_method ?? ""}
      disabled={pending} ariaLabel={t("payment")} noneLabel={t("choose")}
      display={row.payment_method ? <EnumTag label={t(row.payment_method)} color="gold" /> : t("choose")}
      options={(["cash", "bank", "card"] as const).map((value) => ({ value, label: t(value) }))}
      onSave={(value) => save(row.id, { payment_method: (value || null) as Appointment["payment_method"] })} /> },
    { title: t("staff"), width: 170, render: (_, row) => <InlineSelect value={row.staff_id ?? ""}
      disabled={pending} ariaLabel={t("staff")} noneLabel={t("choose")}
      display={staff.find((s) => s.id === row.staff_id)?.user_name ?? t("choose")}
      options={staff.filter((s) => s.status === "active" || s.id === row.staff_id).map((s) => ({ value: s.id, label: staffLabel(s) }))}
      onSave={(value) => save(row.id, { staff_id: value || null })} /> },
    { title: t("note"), width: 300, render: (_, row) => <AppointmentNote value={row.note} disabled={pending}
      label={t("note")} onSave={(note) => save(row.id, { note })} /> },
    { key: "actions", width: 52, render: (_, row) => <Button type="text" danger disabled={pending}
      aria-label={t("remove")} icon={<Trash2 className="size-4" />} onClick={() => confirm({
        title: t("removeTitle"), content: t("removeBody", { name: customerMap.get(row.customer_id)?.full_name ?? "" }),
        okText: t("remove"), cancelText: t("cancel"), onOk: async () => {
          try {
            const result = await deleteAppointment(row.id);
            if (result.error) toast.error(result.error);
            else toast.success(t("removed"));
          } catch { toast.error(t("saveError")); }
        },
      })} /> },
  ];

  return <Page>
    <PageHeader title={t("title")} actions={<Button type="primary" icon={<CalendarPlus className="size-4" />}
      onClick={() => setCreating(true)}>{t("create")}</Button>} />
    <PageToolbar>
      <Input value={search} allowClear className="w-full sm:max-w-64" placeholder={t("search")}
        aria-label={t("search")} prefix={<Search className="size-4" />} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
      <DatePicker value={date} onChange={(v) => { setDate(v); resetPage(); }} placeholder={t("allDates")} className="w-44" />
      <Button onClick={() => { setDate(dayjs().format("YYYY-MM-DD")); resetPage(); }}>{t("today")}</Button>
      <Select value={arrival} aria-label={t("confirmation")} className="min-w-40" onChange={(v) => { setArrival(v); resetPage(); }}
        options={[{ value: "all", label: t("allArrivals") }, { value: "arrived", label: t("arrived") }, { value: "waiting", label: t("notArrived") }]} />
      {customerFilter ? <Button onClick={() => { setCustomerFilter(""); resetPage(); }}>{t("allCustomers")}</Button> : null}
      <span className="ml-auto text-sm text-muted-foreground" role="status">{pending ? t("saving") : t("count", { count: filtered.length })}</span>
    </PageToolbar>
    <Table className="surface overflow-hidden" rowKey="id" size="small" bordered sticky
      columns={columns} dataSource={filtered} scroll={{ x: 1800 }} locale={{ emptyText: t("empty") }}
      pagination={{ current: page, pageSize: 30, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }} />
    <CreateAppointmentDrawer open={creating} onClose={() => setCreating(false)} initialCustomer={customerFilter}
      customers={customers} staff={staff} services={services}
      onCreated={() => { setCreating(false); setDate(""); setCustomerFilter(""); setSearch(""); setArrival("all"); setPage(1); }} />
  </Page>;
}

function AppointmentNote({ value, disabled, label, onSave }: {
  value: string; disabled: boolean; label: string; onSave: (note: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setDraft(value); }
  return <Input.TextArea value={draft} disabled={disabled} aria-label={label} placeholder={label}
    variant="borderless" autoSize={{ minRows: 1, maxRows: 6 }} maxLength={10000}
    onChange={(e) => setDraft(e.target.value)} onBlur={() => {
      if (draft.trim() !== value) onSave(draft);
    }} />;
}

type CreateValues = Required<Pick<AppointmentPatch, "scheduled_at">> & Omit<AppointmentPatch, "scheduled_at"> & {
  customer_id: string;
};

function CreateAppointmentDrawer({ open, onClose, onCreated, initialCustomer, customers, staff, services }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialCustomer: string;
  customers: AppointmentCustomer[];
  staff: (StaffRef & { status: string })[];
  services: Service[];
}) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const [form] = Form.useForm<CreateValues>();
  const [pending, start] = useTransition();

  const onFinish = ({ customer_id, ...values }: CreateValues) => start(async () => {
    try {
      const result = await createAppointment(customer_id, { ...values, note: values.note ?? "" });
      if (result.error) toast.error(result.error);
      else { toast.success(t("saved")); onCreated(); }
    } catch { toast.error(t("saveError")); }
  });

  return <Drawer open={open} onClose={onClose} size={480} destroyOnHidden title={t("create")}
    closable={!pending} mask={{ closable: !pending }}
    footer={<div className="flex justify-end gap-2">
      <Button onClick={onClose} disabled={pending}>{t("cancel")}</Button>
      <Button type="primary" loading={pending} onClick={() => form.submit()}>{t("create")}</Button>
    </div>}>
    <Form form={form} layout="vertical" requiredMark={false} disabled={pending} onFinish={onFinish}
      initialValues={{ customer_id: initialCustomer || undefined, checked_in: false }}>
      <Form.Item name="customer_id" label={t("name")} rules={[{ required: true, message: t("chooseCustomer") }]}>
        <Select showSearch={{ optionFilterProp: "label" }} placeholder={t("chooseCustomer")}
          options={customers.map((c) => ({ value: c.id, label: `${c.full_name} · ${c.phone}` }))} />
      </Form.Item>
      <Form.Item name="scheduled_at" label={t("date")} trigger="onSave" rules={[{ required: true, message: t("chooseDate") }]}>
        <AppointmentDate onSave={() => {}} />
      </Form.Item>
      <Form.Item name="checked_in" label={t("confirmation")} valuePropName="checked">
        <Switch checkedChildren={t("arrived")} unCheckedChildren={t("notArrived")} />
      </Form.Item>
      <Form.Item name="service_ids" label={t("services")}>
        <Select mode="multiple" allowClear placeholder={t("choose")} optionFilterProp="label"
          options={services.filter((s) => s.is_active).map((s) => ({ value: s.id, label: serviceName(s, locale) }))} />
      </Form.Item>
      <Form.Item name="payment_method" label={t("payment")}>
        <Select allowClear placeholder={t("choose")}
          options={(["cash", "bank", "card"] as const).map((value) => ({ value, label: t(value) }))} />
      </Form.Item>
      <Form.Item name="staff_id" label={t("staff")}>
        <Select allowClear showSearch={{ optionFilterProp: "label" }} placeholder={t("choose")}
          options={staff.filter((s) => s.status === "active").map((s) => ({ value: s.id, label: staffLabel(s) }))} />
      </Form.Item>
      <Form.Item name="note" label={t("note")} className="mb-0">
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={10000} />
      </Form.Item>
    </Form>
  </Drawer>;
}
