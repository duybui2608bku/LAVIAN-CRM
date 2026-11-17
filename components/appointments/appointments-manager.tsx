"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button, Form, Input, Select, Tag, type TableProps } from "antd";
import { CalendarPlus, MessageCircleMore, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dayjs from "dayjs";
import { createAppointment, patchAppointment } from "@/app/(app)/appointments/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { MessagesModal } from "@/components/appointments/messages-modal";
import { DataTable } from "@/components/common/data-table";
import { DateRangePicker } from "@/components/common/date-picker";
import { FormDrawer } from "@/components/common/form-drawer";
import { InlineMultiSelect, InlineSelect } from "@/components/common/inline-select";
import { useCan } from "@/components/common/permissions";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { matchesNameOrPhone, serviceName } from "@/lib/customers";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import { BOOKING_STATUSES, BOOKING_STATUS_COLORS, type Appointment, type AppointmentCustomer, type AppointmentPatch } from "@/types/appointment";
import type { Service } from "@/types/service";
import { TELESALES_DEPARTMENTS } from "@/types/user";

export type AppointmentStaff = StaffRef & { status: string; department: string | null };

// Chỉ chọn user đang hoạt động của bộ phận (mặc định Telesales); giữ người đang gán để vẫn hiển thị.
const staffOptions = (staff: AppointmentStaff[], current?: string | null, depts = TELESALES_DEPARTMENTS) => staff
  .filter((s) => s.id === current || (s.status === "active" && depts.includes(s.department ?? "")))
  .map((s) => ({ value: s.id, label: staffLabel(s) }));

export function AppointmentsManager({ appointments, customers, staff, services, initialCustomer, canShowUp }: {
  appointments: Appointment[];
  customers: AppointmentCustomer[];
  staff: AppointmentStaff[];
  services: Service[];
  initialCustomer: string;
  /** Clinic confirmation (Show-up) chỉ bộ phận Sales. */
  canShowUp: boolean;
}) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const can = useCan();
  const canEdit = can("appointments.edit");
  const [, start] = useTransition();
  const [search, setSearch] = useState("");
  const [dates, setDates] = useState({ from: "", to: "" });
  const [customerFilter, setCustomerFilter] = useState(initialCustomer);
  const [arrival, setArrival] = useState("all");
  const [booking, setBooking] = useState("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [chatFor, setChatFor] = useState<AppointmentCustomer | null>(null);
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

  // Lọc theo ngày hẹn (giờ máy); chỉ chọn "từ" = đúng 1 ngày.
  const inRange = (day: string) => !dates.from || (day >= dates.from && day <= (dates.to || dates.from));
  const statusOptions = BOOKING_STATUSES.map((value) => ({ value, label: t(`bookingStatus.${value}`) }));
  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
  // Avatar + tên nhân viên; chưa có → placeholder mờ ("Chọn…" cho ô sửa được, "—" cho ô chỉ xem).
  const staffCell = (id: string | null, empty = t("choose")) => {
    const member = id ? staff.find((s) => s.id === id) : undefined;
    return member ? staffLabel(member) : <span className="text-muted-foreground">{empty}</span>;
  };
  const filtered = rows.filter((row) => {
    const customer = customerMap.get(row.customer_id);
    return customer && (!customerFilter || row.customer_id === customerFilter)
      && inRange(dayjs(row.scheduled_at).format("YYYY-MM-DD"))
      && (arrival === "all" || row.checked_in === (arrival === "show_up"))
      && (booking === "all" || row.booking_confirm === booking)
      && matchesNameOrPhone(customer.full_name, customer.phone, search);
  });
  const resetPage = () => setPage(1);
  const columns: TableProps<Appointment>["columns"] = [
    { title: t("date"), width: 220, fixed: "left", sorter: (a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at),
      render: (_, row) => <AppointmentDate inline disabled={!canEdit} value={row.scheduled_at} onSave={(iso) => save(row.id, { scheduled_at: iso })} /> },
    { title: t("name"), width: 180, fixed: "left", render: (_, row) =>
      <span className="font-medium">{customerMap.get(row.customer_id)?.full_name}</span> },
    { title: t("phone"), width: 160, render: (_, row) => customerMap.get(row.customer_id)?.phone },
    // Thay cột Số WA: icon mở modal 20 tin SMAX gần nhất (khách chưa có hội thoại → "—").
    { title: t("messages"), width: 100, align: "center", render: (_, row) => {
      const customer = customerMap.get(row.customer_id);
      return customer?.thread_link
        ? <Button type="text" size="small" aria-label={t("viewMessages")} title={t("viewMessages")}
          icon={<MessageCircleMore className="size-4" />} onClick={() => setChatFor(customer)} />
        : <span className="text-muted-foreground">—</span>;
    } },
    { title: t("bookingConfirm"), width: 160, render: (_, row) => <InlineSelect
      value={row.booking_confirm} ariaLabel={t("bookingConfirm")} disabled={!canEdit}
      display={<Tag color={BOOKING_STATUS_COLORS[row.booking_confirm]} className="me-0">{t(`bookingStatus.${row.booking_confirm}`)}</Tag>}
      options={statusOptions}
      onSave={(value) => save(row.id, { booking_confirm: value as Appointment["booking_confirm"] })} /> },
    { title: t("confirmation"), width: 170, render: (_, row) => <InlineSelect
      value={row.checked_in ? "show_up" : "waiting"} ariaLabel={t("confirmation")} disabled={!canEdit || !canShowUp}
      display={<Tag color={row.checked_in ? "green" : "default"} className="me-0">{row.checked_in ? t("showUp") : t("notShowUp")}</Tag>}
      options={[{ value: "show_up", label: t("showUp") }, { value: "waiting", label: t("notShowUp") }]}
      onSave={(value) => save(row.id, { checked_in: value === "show_up" })} /> },
    { title: t("services"), width: 220, render: (_, row) => <InlineMultiSelect
      value={row.service_ids} ariaLabel={t("services")} disabled={!canEdit}
      display={row.service_ids.length ? <div className="flex flex-wrap gap-1">{row.service_ids.map((id) => {
        const service = services.find((s) => s.id === id);
        return <Tag key={id} color="purple" className="me-0">{service ? serviceName(service, locale) : id}</Tag>;
      })}</div> : <span className="text-muted-foreground">{t("choose")}</span>}
      options={services.filter((s) => s.is_active || row.service_ids.includes(s.id)).map((s) => ({ value: s.id, label: serviceName(s, locale) }))}
      onSave={(service_ids) => save(row.id, { service_ids })} /> },
    { title: t("staff"), width: 170, render: (_, row) => <InlineSelect value={row.staff_id ?? ""}
      ariaLabel={t("staff")} noneLabel={t("choose")} disabled={!canEdit}
      display={staffCell(row.staff_id)}
      options={staffOptions(staff, row.staff_id)}
      onSave={(value) => save(row.id, { staff_id: value || null })} /> },
    { title: t("sales"), width: 170, render: (_, row) => <InlineSelect value={row.sales_id ?? ""}
      ariaLabel={t("sales")} noneLabel={t("choose")} disabled={!canEdit}
      display={staffCell(row.sales_id)}
      options={staffOptions(staff, row.sales_id, ["sales"])}
      onSave={(value) => save(row.id, { sales_id: value || null })} /> },
    // Cột Người tạo tạm ẩn — dữ liệu created_by vẫn ghi + vẫn tải; bật lại:
    // { title: t("createdBy"), width: 170, render: (_, row) => staffCell(row.created_by, "—") },
    { title: t("note"), width: 300, render: (_, row) => <AppointmentNote value={row.note}
      label={t("note")} disabled={!canEdit} onSave={(note) => save(row.id, { note })} /> },
    // Cột Thao tác (xoá lịch) đã bỏ khỏi UI — server action deleteAppointment vẫn giữ (gác appointments.delete).
  ];

  return <Page>
    <PageHeader title={t("title")} />
    <PageToolbar>
      <Input value={search} allowClear className="w-full sm:max-w-64" placeholder={t("search")}
        aria-label={t("search")} prefix={<Search className="size-4" />} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
      <DateRangePicker from={dates.from} to={dates.to} onChange={(r) => { setDates(r); resetPage(); }} placeholder={t("allDates")} />
      <Button onClick={() => { const d = dayjs().format("YYYY-MM-DD"); setDates({ from: d, to: d }); resetPage(); }}>{t("today")}</Button>
      <Select value={arrival} aria-label={t("confirmation")} className="min-w-40" onChange={(v) => { setArrival(v); resetPage(); }}
        options={[{ value: "all", label: t("allArrivals") }, { value: "show_up", label: t("showUp") }, { value: "waiting", label: t("notShowUp") }]} />
      <Select value={booking} aria-label={t("bookingConfirm")} className="min-w-40" onChange={(v) => { setBooking(v); resetPage(); }}
        options={[{ value: "all", label: t("allBookingConfirms") }, ...statusOptions]} />
      {customerFilter ? <Button onClick={() => { setCustomerFilter(""); resetPage(); }}>{t("allCustomers")}</Button> : null}
      {canEdit && <Button type="primary" icon={<CalendarPlus className="size-4" />}
        onClick={() => setCreating(true)}>{t("create")}</Button>}
    </PageToolbar>
    <DataTable columns={columns} dataSource={filtered} scroll={{ x: 1950 }} empty={t("empty")}
      page={page} onPageChange={setPage} pageSize={30} />
    <CreateAppointmentDrawer open={creating} onClose={() => setCreating(false)} initialCustomer={customerFilter}
      customers={customers} staff={staff} services={services}
      onCreated={() => { setCreating(false); setDates({ from: "", to: "" }); setCustomerFilter(""); setSearch(""); setArrival("all"); setBooking("all"); setPage(1); }} />
    <MessagesModal customer={chatFor} onClose={() => setChatFor(null)} />
  </Page>;
}

function AppointmentNote({ value, label, disabled, onSave }: {
  value: string; label: string; disabled?: boolean; onSave: (note: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setDraft(value); }
  return <Input.TextArea value={draft} aria-label={label} placeholder={label} disabled={disabled}
    variant="borderless" autoSize={{ minRows: 1, maxRows: 6 }} maxLength={10000}
    onChange={(e) => setDraft(e.target.value)} onBlur={() => {
      if (draft.trim() !== value) onSave(draft);
    }} />;
}

type CreateValues = Required<Pick<AppointmentPatch, "scheduled_at">> & Omit<AppointmentPatch, "scheduled_at"> & {
  customer_id?: string;
  /** Tạo nhanh khách mới (stage Booking) — thay cho customer_id. */
  new_name?: string;
  new_phone?: string;
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
  const [quick, setQuick] = useState(false); // khách chưa có trong CRM → nhập tên + SĐT
  const [search, setSearch] = useState("");
  const staffId = Form.useWatch("staff_id", form);
  const customerStaff = (id?: string) => customers.find((c) => c.id === id)?.staff_id ?? undefined;

  // Chuyển sang tạo nhanh: điền sẵn từ ô tìm (toàn số → SĐT, còn lại → tên).
  const startQuick = () => {
    const q = search.trim();
    form.setFieldsValue(/^[ds+().-]+$/.test(q) ? { new_phone: normalizePhone(q) } : { new_name: q });
    setQuick(true);
  };
  const close = () => { setQuick(false); onClose(); };

  const onFinish = ({ customer_id, new_name, new_phone, ...values }: CreateValues) => start(async () => {
    try {
      const customer = quick ? { full_name: new_name ?? "", phone: new_phone ?? "" } : customer_id ?? "";
      const result = await createAppointment(customer, { ...values, note: values.note ?? "" });
      if (result.error) toast.error(result.error);
      else { toast.success(t("saved")); setQuick(false); onCreated(); }
    } catch { toast.error(t("saveError")); }
  });

  const toggle = (label: string, onClick: () => void) =>
    <Button type="link" size="small" className="h-auto p-0" onClick={onClick}>{label}</Button>;

  return <FormDrawer open={open} onClose={close} title={t("create")} submitText={t("create")}
    pending={pending} onSubmit={() => form.submit()}>
    <Form form={form} layout="vertical" requiredMark={false} disabled={pending} onFinish={onFinish}
      // Chọn khách → Telesales tự điền theo khách (vẫn đổi được).
      onValuesChange={(changed: Partial<CreateValues>) => {
        if ("customer_id" in changed) form.setFieldValue("staff_id", customerStaff(changed.customer_id));
      }}
      initialValues={{ customer_id: initialCustomer || undefined, staff_id: customerStaff(initialCustomer) }}>
      {quick ? <>
        <div className="grid grid-cols-2 gap-x-4 max-sm:grid-cols-1">
          <Form.Item name="new_name" label={t("name")} rules={[{ required: true, whitespace: true, message: t("enterName") }, { max: 200 }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item name="new_phone" label={t("phone")} normalize={normalizePhone} rules={[
            { required: true, message: t("enterPhone") },
            { validator: (_, v?: string) => !v || isValidPhone(v) ? Promise.resolve() : Promise.reject(new Error(t("phoneInvalid"))) },
          ]}>
            <Input inputMode="tel" autoComplete="off" />
          </Form.Item>
        </div>
        <div className="-mt-3 mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{t("quickHint")}</span>
          {toggle(t("pickExisting"), () => setQuick(false))}
        </div>
      </> : <Form.Item name="customer_id" label={t("name")} rules={[{ required: true, message: t("chooseCustomer") }]}
        extra={toggle(t("quickCustomer"), startQuick)}>
        <Select showSearch={{ optionFilterProp: "label", onSearch: setSearch }} placeholder={t("chooseCustomer")}
          // Tìm không thấy → nút tạo nhanh ngay trong dropdown.
          notFoundContent={search.trim() ? toggle(t("quickCreate", { name: search.trim() }), startQuick) : undefined}
          options={customers.map((c) => ({ value: c.id, label: `${c.full_name} · ${c.phone}` }))} />
      </Form.Item>}
      <div className="grid grid-cols-2 gap-x-4 max-sm:grid-cols-1">
        <Form.Item name="staff_id" label={t("staff")}>
          <Select allowClear showSearch={{ optionFilterProp: "label" }} placeholder={t("choose")}
            options={staffOptions(staff, staffId)} />
        </Form.Item>
        <Form.Item name="scheduled_at" label={t("date")} trigger="onSave" rules={[{ required: true, message: t("chooseDate") }]}>
          <AppointmentDate className="w-full" onSave={() => {}} />
        </Form.Item>
      </div>
      <Form.Item name="service_ids" label={t("services")}>
        <Select mode="multiple" allowClear placeholder={t("choose")} optionFilterProp="label"
          options={services.filter((s) => s.is_active).map((s) => ({ value: s.id, label: serviceName(s, locale) }))} />
      </Form.Item>
      <Form.Item name="note" label={t("note")} className="mb-0">
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={10000} />
      </Form.Item>
    </Form>
  </FormDrawer>;
}
