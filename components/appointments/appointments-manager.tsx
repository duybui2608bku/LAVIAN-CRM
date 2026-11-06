"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button, Form, Input, InputNumber, Select, Switch, Tag, type TableProps } from "antd";
import { CalendarPlus, Search, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dayjs from "dayjs";
import { createAppointment, deleteAppointment, patchAppointment } from "@/app/(app)/appointments/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { DataTable } from "@/components/common/data-table";
import { DatePicker } from "@/components/common/date-picker";
import { FormDrawer } from "@/components/common/form-drawer";
import { RowActions } from "@/components/common/row-actions";
import { EnumTag } from "@/components/common/enum-tag";
import { InlineMultiSelect, InlineSelect, matchWords } from "@/components/common/inline-select";
import { useConfirm } from "@/components/common/confirm-action";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import {
  decodeDetail, encodeDetail, MAX_SESSION, SESSION_DETAILS, tourAmount, tourRate, type ServiceDetail,
} from "@/lib/appointments";
import { formatRupiah, sanitizeCurrencyInput } from "@/lib/currency";
import { CUSTOMER_OPTIONS } from "@/lib/customer-options";
import { optionLabel, serviceName } from "@/lib/customers";
import { toast } from "@/lib/toast";
import type { Appointment, AppointmentCustomer, AppointmentPatch } from "@/types/appointment";
import type { Service } from "@/types/service";

export type AppointmentStaff = StaffRef & { status: string; department: string | null };

// Mỗi cột người phụ trách chỉ chọn người đúng bộ phận (giữ người đang gán để vẫn hiển thị).
const STAFF_FIELDS = [["staff_id", "staff", "customer_care"], ["technician_id", "technician", "technician"]] as const;
const staffOptions = (staff: AppointmentStaff[], department: string, current?: string | null) => staff
  .filter((s) => s.id === current || (s.status === "active" && s.department === department))
  .map((s) => ({ value: s.id, label: staffLabel(s) }));

type T = ReturnType<typeof useTranslations<"appointments">>;

const detailLabel = (t: T, detail: ServiceDetail, session: number | null) =>
  session ? `${t(`detail_${detail}`)} ${session}` : t(`detail_${detail}`);

// Thứ tự theo nghiệp vụ: Laser, Plasma, New, Debt, Retouch. Nhãn kèm % tour để chọn là biết.
function detailOptions(t: T) {
  const leaf = (detail: ServiceDetail, session: number | null) => ({
    value: encodeDetail(detail, session),
    label: `${detailLabel(t, detail, session)} · ${Math.round(tourRate(detail, session) * 100)}%`,
  });
  const sessions = (detail: (typeof SESSION_DETAILS)[number]) => ({
    label: t(`detail_${detail}`),
    options: Array.from({ length: MAX_SESSION }, (_, i) => leaf(detail, i + 1)),
  });
  return [sessions("laser"), sessions("plasma"), leaf("new", null), leaf("debt", null), sessions("retouch")];
}

export function AppointmentsManager({ appointments, customers, staff, services, initialCustomer }: {
  appointments: Appointment[];
  customers: AppointmentCustomer[];
  staff: AppointmentStaff[];
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
    ...STAFF_FIELDS.map(([field, label, department]) => ({ key: field, title: t(label), width: 170,
      render: (_: unknown, row: Appointment) => <InlineSelect value={row[field] ?? ""}
        disabled={pending} ariaLabel={t(label)} noneLabel={t("choose")}
        display={staff.find((s) => s.id === row[field])?.user_name ?? t("choose")}
        options={staffOptions(staff, department, row[field])}
        onSave={(value) => save(row.id, { [field]: value || null })} /> })),
    { title: t("serviceDetail"), width: 170, render: (_, row) => <InlineSelect searchable
      value={encodeDetail(row.service_detail, row.service_session)} disabled={pending}
      ariaLabel={t("serviceDetail")} noneLabel={t("choose")} options={detailOptions(t)}
      display={row.service_detail
        ? <Tag color="cyan" className="me-0">{detailLabel(t, row.service_detail, row.service_session)}</Tag>
        : t("choose")}
      onSave={(value) => save(row.id, decodeDetail(value))} /> },
    { title: t("bill"), width: 150, render: (_, row) => <AppointmentBill value={row.bill_amount}
      disabled={pending} label={t("bill")} onSave={(bill_amount) => save(row.id, { bill_amount })} /> },
    { title: t("tour"), width: 120, align: "right", render: (_, row) => {
      const tour = tourAmount(row.service_detail, row.service_session, row.bill_amount);
      return tour == null ? <span className="text-muted-foreground">—</span>
        : <span className="tabular-nums font-medium">{formatRupiah(tour)}</span>;
    } },
    { title: t("note"), width: 300, render: (_, row) => <AppointmentNote value={row.note} disabled={pending}
      label={t("note")} onSave={(note) => save(row.id, { note })} /> },
    { key: "actions", width: 56, align: "right", fixed: "right", render: (_, row) => <RowActions label={t("remove")}
      items={[{ icon: <Trash2 className="size-4" />, label: t("remove"), danger: true, disabled: pending, onSelect: () => confirm({
        title: t("removeTitle"), content: t("removeBody", { name: customerMap.get(row.customer_id)?.full_name ?? "" }),
        okText: t("remove"), cancelText: t("cancel"), onOk: async () => {
          try {
            const result = await deleteAppointment(row.id);
            if (result.error) toast.error(result.error);
            else toast.success(t("removed"));
          } catch { toast.error(t("saveError")); }
        },
      }) }]} /> },
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
    </PageToolbar>
    <DataTable columns={columns} dataSource={filtered} scroll={{ x: 2410 }} empty={t("empty")}
      page={page} onPageChange={setPage} pageSize={30} />
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

const formatBill = (v: number | string | undefined) => (v === undefined || v === "" ? "" : Number(v).toLocaleString("id-ID"));
const parseBill = (v: string | undefined) => sanitizeCurrencyInput(v ?? "") as unknown as number;

function AppointmentBill({ value, disabled, label, onSave }: {
  value: number | null; disabled: boolean; label: string; onSave: (bill: number | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setDraft(value); }
  return <InputNumber<number> value={draft} disabled={disabled} aria-label={label} placeholder="Rp"
    variant="borderless" size="small" min={0} precision={0} controls={false} className="w-full tabular-nums"
    formatter={formatBill} parser={parseBill}
    onChange={(v) => setDraft(v ?? null)}
    onBlur={() => { if (draft !== value) onSave(draft); }}
    onPressEnter={(e) => e.currentTarget.blur()} />;
}

type CreateValues = Required<Pick<AppointmentPatch, "scheduled_at">> & Omit<AppointmentPatch, "scheduled_at"> & {
  customer_id: string;
  detail?: string;
};

function CreateAppointmentDrawer({ open, onClose, onCreated, initialCustomer, customers, staff, services }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialCustomer: string;
  customers: AppointmentCustomer[];
  staff: AppointmentStaff[];
  services: Service[];
}) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const [form] = Form.useForm<CreateValues>();
  const [pending, start] = useTransition();

  const onFinish = ({ customer_id, detail, ...values }: CreateValues) => start(async () => {
    try {
      const result = await createAppointment(customer_id, {
        ...values, ...decodeDetail(detail ?? ""), bill_amount: values.bill_amount ?? null, note: values.note ?? "",
      });
      if (result.error) toast.error(result.error);
      else { toast.success(t("saved")); onCreated(); }
    } catch { toast.error(t("saveError")); }
  });

  return <FormDrawer open={open} onClose={onClose} title={t("create")} submitText={t("create")}
    pending={pending} onSubmit={() => form.submit()}>
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
      {STAFF_FIELDS.map(([field, label, department]) => <Form.Item key={field} name={field} label={t(label)}>
        <Select allowClear showSearch={{ optionFilterProp: "label" }} placeholder={t("choose")}
          options={staffOptions(staff, department)} />
      </Form.Item>)}
      <div className="grid grid-cols-2 gap-3">
        <Form.Item name="detail" label={t("serviceDetail")}>
          <Select allowClear placeholder={t("choose")} options={detailOptions(t)}
            showSearch={{ filterOption: (input, option) => matchWords(input, option?.label) }} />
        </Form.Item>
        <Form.Item name="bill_amount" label={t("bill")}>
          <InputNumber<number> className="w-full" min={0} precision={0} controls={false} placeholder="Rp"
            formatter={formatBill} parser={parseBill} />
        </Form.Item>
      </div>
      <Form.Item name="note" label={t("note")} className="mb-0">
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={10000} />
      </Form.Item>
    </Form>
  </FormDrawer>;
}
