"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button, Form, Input, Select, Switch, Tag, type TableProps } from "antd";
import { CalendarPlus, Search, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dayjs from "dayjs";
import { createAppointment, deleteAppointment, patchAppointment } from "@/app/(app)/appointments/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { DataTable } from "@/components/common/data-table";
import { DatePicker } from "@/components/common/date-picker";
import { FormDrawer } from "@/components/common/form-drawer";
import { RowActions } from "@/components/common/row-actions";
import { InlineMultiSelect, InlineSelect } from "@/components/common/inline-select";
import { useConfirm } from "@/components/common/confirm-action";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { matchesNameOrPhone, serviceName } from "@/lib/customers";
import { waColor } from "@/lib/wa";
import { toast } from "@/lib/toast";
import type { Appointment, AppointmentCustomer, AppointmentPatch } from "@/types/appointment";
import type { Service } from "@/types/service";

export type AppointmentStaff = StaffRef & { status: string; department: string | null };

// Chỉ chọn CSKH (giữ người đang gán để vẫn hiển thị).
const staffOptions = (staff: AppointmentStaff[], current?: string | null) => staff
  .filter((s) => s.id === current || (s.status === "active" && s.department === "customer_care"))
  .map((s) => ({ value: s.id, label: staffLabel(s) }));

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
  const [, start] = useTransition();
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
  const filtered = rows.filter((row) => {
    const customer = customerMap.get(row.customer_id);
    return customer && (!customerFilter || row.customer_id === customerFilter)
      && (!date || dayjs(row.scheduled_at).format("YYYY-MM-DD") === date)
      && (arrival === "all" || row.checked_in === (arrival === "arrived"))
      && matchesNameOrPhone(customer.full_name, customer.phone, search);
  });
  const resetPage = () => setPage(1);
  const columns: TableProps<Appointment>["columns"] = [
    { title: t("name"), width: 180, fixed: "left", render: (_, row) =>
      <span className="font-medium">{customerMap.get(row.customer_id)?.full_name}</span> },
    { title: t("phone"), width: 160, render: (_, row) => customerMap.get(row.customer_id)?.phone },
    { title: t("wa"), width: 100, render: (_, row) => {
      const wa = customerMap.get(row.customer_id)?.wa;
      return wa ? <Tag color={waColor(wa)} className="me-0">{wa}</Tag> : <span className="text-muted-foreground">—</span>;
    } },
    { title: t("date"), width: 220, sorter: (a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at),
      render: (_, row) => <AppointmentDate inline value={row.scheduled_at} onSave={(iso) => save(row.id, { scheduled_at: iso })} /> },
    { title: t("confirmation"), width: 170, render: (_, row) => <InlineSelect
      value={row.checked_in ? "arrived" : "waiting"} ariaLabel={t("confirmation")}
      display={<Tag color={row.checked_in ? "green" : "default"} className="me-0">{row.checked_in ? t("arrived") : t("notArrived")}</Tag>}
      options={[{ value: "arrived", label: t("arrived") }, { value: "waiting", label: t("notArrived") }]}
      onSave={(value) => save(row.id, { checked_in: value === "arrived" })} /> },
    { title: t("services"), width: 220, render: (_, row) => <InlineMultiSelect
      value={row.service_ids} ariaLabel={t("services")}
      display={row.service_ids.length ? <div className="flex flex-wrap gap-1">{row.service_ids.map((id) => {
        const service = services.find((s) => s.id === id);
        return <Tag key={id} color="purple" className="me-0">{service ? serviceName(service, locale) : id}</Tag>;
      })}</div> : <span className="text-muted-foreground">{t("choose")}</span>}
      options={services.filter((s) => s.is_active || row.service_ids.includes(s.id)).map((s) => ({ value: s.id, label: serviceName(s, locale) }))}
      onSave={(service_ids) => save(row.id, { service_ids })} /> },
    { title: t("staff"), width: 170, render: (_, row) => <InlineSelect value={row.staff_id ?? ""}
      ariaLabel={t("staff")} noneLabel={t("choose")}
      display={(() => {
        const member = staff.find((s) => s.id === row.staff_id);
        return member ? staffLabel(member) : <span className="text-muted-foreground">{t("choose")}</span>;
      })()}
      options={staffOptions(staff, row.staff_id)}
      onSave={(value) => save(row.id, { staff_id: value || null })} /> },
    { title: t("note"), width: 300, render: (_, row) => <AppointmentNote value={row.note}
      label={t("note")} onSave={(note) => save(row.id, { note })} /> },
    { key: "actions", width: 56, align: "right", fixed: "right", render: (_, row) => <RowActions label={t("remove")}
      items={[{ icon: <Trash2 className="size-4" />, label: t("remove"), danger: true, onSelect: () => confirm({
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
    <PageHeader title={t("title")} />
    <PageToolbar>
      <Input value={search} allowClear className="w-full sm:max-w-64" placeholder={t("search")}
        aria-label={t("search")} prefix={<Search className="size-4" />} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
      <DatePicker value={date} onChange={(v) => { setDate(v); resetPage(); }} placeholder={t("allDates")} className="w-44" />
      <Button onClick={() => { setDate(dayjs().format("YYYY-MM-DD")); resetPage(); }}>{t("today")}</Button>
      <Select value={arrival} aria-label={t("confirmation")} className="min-w-40" onChange={(v) => { setArrival(v); resetPage(); }}
        options={[{ value: "all", label: t("allArrivals") }, { value: "arrived", label: t("arrived") }, { value: "waiting", label: t("notArrived") }]} />
      {customerFilter ? <Button onClick={() => { setCustomerFilter(""); resetPage(); }}>{t("allCustomers")}</Button> : null}
      <Button type="primary" icon={<CalendarPlus className="size-4" />}
        onClick={() => setCreating(true)}>{t("create")}</Button>
    </PageToolbar>
    <DataTable columns={columns} dataSource={filtered} scroll={{ x: 1640 }} empty={t("empty")}
      page={page} onPageChange={setPage} pageSize={30} />
    <CreateAppointmentDrawer open={creating} onClose={() => setCreating(false)} initialCustomer={customerFilter}
      customers={customers} staff={staff} services={services}
      onCreated={() => { setCreating(false); setDate(""); setCustomerFilter(""); setSearch(""); setArrival("all"); setPage(1); }} />
  </Page>;
}

function AppointmentNote({ value, label, onSave }: {
  value: string; label: string; onSave: (note: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setDraft(value); }
  return <Input.TextArea value={draft} aria-label={label} placeholder={label}
    variant="borderless" autoSize={{ minRows: 1, maxRows: 6 }} maxLength={10000}
    onChange={(e) => setDraft(e.target.value)} onBlur={() => {
      if (draft.trim() !== value) onSave(draft);
    }} />;
}

type CreateValues = Required<Pick<AppointmentPatch, "scheduled_at">> & Omit<AppointmentPatch, "scheduled_at"> & {
  customer_id: string;
};

// Dùng chung: /appointments (nút Thêm) và /customers (nút thêm lịch ở cột Lịch hẹn).
export function CreateAppointmentDrawer({ open, onClose, onCreated, initialCustomer, customers, staff, services }: {
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
  const staffId = Form.useWatch("staff_id", form);
  const customerStaff = (id?: string) => customers.find((c) => c.id === id)?.staff_id ?? undefined;

  const onFinish = ({ customer_id, ...values }: CreateValues) => start(async () => {
    try {
      const result = await createAppointment(customer_id, { ...values, note: values.note ?? "" });
      if (result.error) toast.error(result.error);
      else { toast.success(t("saved")); onCreated(); }
    } catch { toast.error(t("saveError")); }
  });

  return <FormDrawer open={open} onClose={onClose} title={t("create")} submitText={t("create")}
    pending={pending} onSubmit={() => form.submit()}>
    <Form form={form} layout="vertical" requiredMark={false} disabled={pending} onFinish={onFinish}
      // Chọn khách → CSKH tự điền theo khách (vẫn đổi được).
      onValuesChange={(changed: Partial<CreateValues>) => {
        if ("customer_id" in changed) form.setFieldValue("staff_id", customerStaff(changed.customer_id));
      }}
      initialValues={{ customer_id: initialCustomer || undefined, staff_id: customerStaff(initialCustomer), checked_in: false }}>
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
      <Form.Item name="staff_id" label={t("staff")}>
        <Select allowClear showSearch={{ optionFilterProp: "label" }} placeholder={t("choose")}
          options={staffOptions(staff, staffId)} />
      </Form.Item>
      <Form.Item name="note" label={t("note")} className="mb-0">
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={10000} />
      </Form.Item>
    </Form>
  </FormDrawer>;
}
