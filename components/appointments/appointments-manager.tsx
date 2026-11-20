"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button, Form, Input, Select, Tag, type TableProps } from "antd";
import { CalendarPlus, MessageCircleMore, PanelRightOpen, Rows3, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dayjs from "dayjs";
import { addSalesNote, createAppointment, deleteSalesNote, patchAppointment } from "@/app/(app)/appointments/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { AppointmentDrawer } from "@/components/appointments/appointment-drawer";
import { MessagesModal } from "@/components/appointments/messages-modal";
import { DataTable } from "@/components/common/data-table";
import { NamePhone } from "@/components/common/name-phone";
import { DateRangePicker } from "@/components/common/date-picker";
import { FormDrawer } from "@/components/common/form-drawer";
import { InlineMultiSelect, InlineSelect } from "@/components/common/inline-select";
import { NoteCell, NotesDrawer } from "@/components/common/notes";
import { useCan, useCurrentUserId } from "@/components/common/permissions";
import { CustomerInfoDrawer } from "@/components/customers/customer-info-drawer";
import { CustomerNotesDrawer, SourceCell } from "@/components/customers/customers-manager";
import { staffLabel, UserAvatar, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { appointmentStats, newCustomerAppointmentIds } from "@/lib/appointments";
import { StatCard } from "@/components/common/stat-card";
import { matchesNameOrPhone, serviceName } from "@/lib/customers";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import {
  BOOKING_STATUSES, BOOKING_STATUS_COLORS, VISIT_STATUSES, VISIT_STATUS_COLORS,
  type Appointment, type AppointmentCustomer, type AppointmentPatch, type VisitStatus,
} from "@/types/appointment";
import { SERVICE_CATEGORY_LABELS, SERVICE_CATEGORY_OPTIONS, type Service, type ServiceCategory } from "@/types/service";
import type { Customer } from "@/types/customer";
import { TELESALES_DEPARTMENTS } from "@/types/user";

export type AppointmentStaff = StaffRef & { status: string; department: string | null };

const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
// Thứ tự nhóm khi "Nhóm theo xác nhận": Confirmed trước, còn lại giữ thứ tự gốc.
const GROUP_ORDER = ["confirmed", ...BOOKING_STATUSES.filter((s) => s !== "confirmed")] as const;
const million = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }); // 11.300.000 → "11,3" (triệu)

/** Tag Status lịch hẹn (Chưa đến / Đã đến / Đang thực hiện / Đã thực hiện / Đổi lịch) — dùng chung cột Sales Status. */
export function VisitStatusTag({ status }: { status: VisitStatus }) {
  const t = useTranslations("appointments.visitStatus");
  return <Tag color={VISIT_STATUS_COLORS[status]} className="me-0">{t(status)}</Tag>;
}

// Chỉ chọn user đang hoạt động của bộ phận (mặc định Telesales); giữ người đang gán để vẫn hiển thị.
export const staffOptions = (staff: AppointmentStaff[], current?: string | null, depts = TELESALES_DEPARTMENTS) => staff
  .filter((s) => s.id === current || (s.status === "active" && depts.includes(s.department ?? "")))
  .map((s) => ({ value: s.id, label: staffLabel(s) }));

export function AppointmentsManager({ appointments, customers, staff, services, initialCustomer, canShowUp }: {
  appointments: Appointment[];
  customers: AppointmentCustomer[];
  staff: AppointmentStaff[];
  services: Service[];
  initialCustomer: string;
  /** Status lịch hẹn (Đã đến, Đang thực hiện…) chỉ bộ phận Sales. */
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
  const [visit, setVisit] = useState("all");
  const [booking, setBooking] = useState("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [chatFor, setChatFor] = useState<AppointmentCustomer | null>(null);
  const [infoFor, setInfoFor] = useState<AppointmentCustomer | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notesId, setNotesId] = useState<string | null>(null);
  const [teleNotesFor, setTeleNotesFor] = useState<AppointmentCustomer | null>(null);
  const me = useCurrentUserId();
  const [grouped, setGrouped] = useState(false);
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
  const visitOptions = VISIT_STATUSES.map((value) => ({ value, label: t(`visitStatus.${value}`) }));
  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
  // Tính trên mọi lịch (không theo bộ lọc) — lọc ngày không làm khách cũ thành khách mới.
  const newIds = newCustomerAppointmentIds(rows);
  const filtered = rows.filter((row) => {
    const customer = customerMap.get(row.customer_id);
    return customer && (!customerFilter || row.customer_id === customerFilter)
      && inRange(dayjs(row.scheduled_at).format("YYYY-MM-DD"))
      && (visit === "all" || row.visit_status === visit)
      && (booking === "all" || row.booking_confirm === booking)
      && matchesNameOrPhone(customer.full_name, customer.phone, search);
  });
  const stats = appointmentStats(filtered, (id) => customerMap.get(id)?.deposit_amount);
  const editing = editingId ? rows.find((row) => row.id === editingId) ?? null : null;
  const notesFor = notesId ? rows.find((row) => row.id === notesId) ?? null : null;
  const resetPage = () => setPage(1);
  // Lọc nhanh 1 ngày: 0 = hôm nay, 1 = ngày mai.
  const pickDay = (offset: number) => {
    const d = dayjs().add(offset, "day").format("YYYY-MM-DD");
    setDates({ from: d, to: d }); resetPage();
  };
  const columns: TableProps<Appointment>["columns"] = [
    // Giờ to ở trên, ngày nhỏ bên dưới — giống cột lịch ở Booking management.
    { title: t("date"), width: 130, fixed: "left", sorter: (a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at),
      render: (_, row) => <div className="leading-tight tabular-nums">
        <AppointmentDate inline format="HH:mm" disabled={!canEdit} value={row.scheduled_at} onSave={(iso) => save(row.id, { scheduled_at: iso })} />
        <div className="mt-0.5 text-xs text-muted-foreground">{dayjs(row.scheduled_at).format("DD/MM/YYYY")}</div>
      </div> },
    // Tên (bấm mở drawer sửa lịch; + chấm xanh = khách mới) + SĐT · nhóm DV (bấm nhóm để sửa) + icon mở drawer sửa lịch.
    { title: t("name"), width: 240, fixed: "left", render: (_, row) => {
      const customer = customerMap.get(row.customer_id);
      const cats = row.service_categories.map((c) => SERVICE_CATEGORY_LABELS[c] ?? c).join(", ");
      return <div className="flex items-center justify-between gap-1">
        <div className="min-w-0 flex-1">
        <NamePhone phone={customer?.phone} title={customer?.full_name}
          name={<><button type="button" aria-label={t("openEdit")} onClick={() => setEditingId(row.id)}
            className="font-medium hover:text-primary hover:underline">{customer?.full_name}</button>{newIds.has(row.id) && <span role="img" aria-label={t("newCustomer")} title={t("newCustomer")}
            className="ms-1 inline-block size-2 rounded-full bg-success align-super" />}</>}
          extra={cats || canEdit ? <>{" · "}<InlineMultiSelect
            value={row.service_categories} ariaLabel={t("serviceCategories")} disabled={!canEdit}
            display={cats || <span className="opacity-70">{t("addCategory")}</span>}
            options={SERVICE_CATEGORY_OPTIONS}
            onSave={(c) => save(row.id, { service_categories: c as ServiceCategory[] })} /></> : null} />
        {/* Ghi chú lịch hẹn (trước là cột Note) — dưới dòng SĐT, dài thì cắt "…", hover xem đủ. */}
        {row.note && <div className="mt-0.5 truncate text-xs text-muted-foreground" title={row.note}>{row.note}</div>}
        </div>
        {/* Icon + tên đều mở drawer Sửa lịch hẹn; Thông tin khách mở từ icon trong drawer đó. */}
        {customer && <Button type="text" size="small" aria-label={t("openEdit")} title={t("openEdit")}
          icon={<PanelRightOpen className="size-4" />} onClick={() => setEditingId(row.id)} />}
      </div>;
    } },
    // Nguồn: icon + số WA nhận tin / username IG — giống Booking management & Khách hàng.
    { title: t("source"), width: 150, render: (_, row) => {
      const c = customerMap.get(row.customer_id);
      return c ? <SourceCell customer={{ ...c, thread: c.thread_link ? { link: c.thread_link } : null } as unknown as Customer} /> : null;
    } },
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
    // Status 5 bước (thay Clinic confirmation); Đã đến / Đang thực hiện / Đã thực hiện = khách đã đến (DB tự tính checked_in).
    { title: t("confirmation"), width: 170, render: (_, row) => <InlineSelect
      value={row.visit_status} ariaLabel={t("confirmation")} disabled={!canEdit || !canShowUp}
      display={<VisitStatusTag status={row.visit_status} />}
      options={visitOptions}
      onSave={(value) => save(row.id, { visit_status: value as VisitStatus })} /> },
    // Cột Nhóm dịch vụ đã gộp vào ô Khách hàng (sau SĐT).
    // Dịch vụ chi tiết: chỉ xem (không sửa trên bảng).
    { title: t("serviceDetails"), width: 220, render: (_, row) => row.service_ids.length
      ? <div className="flex flex-wrap gap-1">{row.service_ids.map((id) => {
        const service = services.find((s) => s.id === id);
        return <Tag key={id} color="purple" className="me-0">{service ? serviceName(service, locale) : id}</Tag>;
      })}</div>
      : <span className="text-muted-foreground">—</span> },
    // Tài chính: cọc của khách + giá trị DV của lịch — chỉ xem.
    { title: t("finance"), width: 230, render: (_, row) => <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 tabular-nums">
      <span className="text-muted-foreground">{t("deposit")}</span>
      <span className="text-right">{idr.format(customerMap.get(row.customer_id)?.deposit_amount ?? 0)}</span>
      <span className="text-muted-foreground">{t("bill")}</span>
      <span className="text-right">{idr.format(row.bill_amount ?? 0)}</span>
    </div> },
    // Nhân sự: Telesales · Sales · Master (KTV) gộp 1 cột, chỉ xem (sửa trong drawer);
    // đứng sát nhau trên 1 hàng (cột hẹp thì tự xuống dòng); người chưa gán thì bỏ qua, hover thấy vai trò.
    { title: t("staffColumn"), width: 300, render: (_, row) => {
      const people = ([["staff", row.staff_id], ["sales", row.sales_id], ["master", row.technician_id]] as const)
        .flatMap(([role, id]) => {
          const member = id ? staff.find((s) => s.id === id) : undefined;
          return member ? [{ role, member }] : [];
        });
      return people.length
        ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{people.map(({ role, member }) =>
          <span key={role} title={`${t(role)}: ${member.user_name}`} className="flex min-w-0 items-center gap-1.5">
            <UserAvatar src={member.avatar_url} />
            <span className="max-w-28 truncate">{member.user_name || "—"}</span>
          </span>)}</div>
        : <span className="text-muted-foreground">—</span>;
    } },
    // Cột Người tạo tạm ẩn — dữ liệu created_by vẫn ghi + vẫn tải.
    // Note Sales: ghi chú Sales gần nhất (tiêu đề + người ghi · nội dung), bấm mở drawer Ghi chú Sales.
    { title: t("salesNotesColumn"), width: 300, render: (_, row) => <NoteCell notes={row.sales_notes}
      label={t("salesNotesColumn")} emptyText={canEdit ? `+ ${t("addNote")}` : "—"} onOpen={() => setNotesId(row.id)} /> },
    // Note Telesales (sau Note Sales): chỉ nội dung ghi chú gần nhất của khách (customers.notes), bấm mở drawer ghi chú chung.
    { title: t("teleNote"), width: 300, render: (_, row) => {
      const customer = customerMap.get(row.customer_id);
      return <NoteCell notes={customer?.notes ?? []} contentOnly label={t("teleNote")} emptyText="—"
        onOpen={() => setTeleNotesFor(customer ?? null)} />;
    } },
    // Cột Thao tác (xoá lịch) đã bỏ khỏi UI — server action deleteAppointment vẫn giữ (gác appointments.delete).
  ];

  return <Page>
    <PageHeader title={t("title")} />
    {/* Số liệu theo bộ lọc đang áp (thứ tự khối: Thẻ số liệu → Thanh lọc, như Booking management). */}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      <StatCard label={t("statTotal")} value={stats.total} />
      <StatCard label={t("statArrived")} value={stats.arrived} />
      <StatCard label={t("statCancelled")} value={stats.cancelled} />
      <StatCard label={t("statWaiting")} value={stats.waiting} />
      <StatCard label={t("statBill")} value={million.format(stats.bill / 1e6)} hint={t("millionIdr")} />
      <StatCard label={t("statCollected")} value={million.format(stats.collected / 1e6)} hint={t("millionIdr")} />
      <StatCard label={t("statDue")} value={million.format(stats.due / 1e6)} hint={t("millionIdr")} />
    </div>
    <PageToolbar>
      {canEdit && <Button type="primary" icon={<CalendarPlus className="size-4" />}
        onClick={() => setCreating(true)}>{t("create")}</Button>}
      <Input value={search} allowClear className="w-full sm:max-w-64" placeholder={t("search")}
        aria-label={t("search")} prefix={<Search className="size-4" />} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
      <DateRangePicker from={dates.from} to={dates.to} onChange={(r) => { setDates(r); resetPage(); }} placeholder={t("allDates")} />
      <Button onClick={() => pickDay(0)}>{t("today")}</Button>
      <Button onClick={() => pickDay(1)}>{t("tomorrow")}</Button>
      <Select value={visit} aria-label={t("confirmation")} className="min-w-40" onChange={(v) => { setVisit(v); resetPage(); }}
        options={[{ value: "all", label: t("allArrivals") }, ...visitOptions]} />
      <Select value={booking} aria-label={t("bookingConfirm")} className="min-w-40" onChange={(v) => { setBooking(v); resetPage(); }}
        options={[{ value: "all", label: t("allBookingConfirms") }, ...statusOptions]} />
      <Button aria-pressed={grouped} type={grouped ? "primary" : "default"} ghost={grouped}
        icon={<Rows3 className="size-4" />} onClick={() => setGrouped(!grouped)}>{t("groupByConfirm")}</Button>
      {customerFilter ? <Button onClick={() => { setCustomerFilter(""); resetPage(); }}>{t("allCustomers")}</Button> : null}
    </PageToolbar>
    {/* Nhóm theo Xác nhận lịch: mỗi nhóm 1 bảng (phân trang riêng), nhóm trống ẩn; Confirmed lên đầu. */}
    {grouped && filtered.length ? GROUP_ORDER.map((s) => {
      const items = filtered.filter((row) => row.booking_confirm === s);
      return items.length ? <section key={s} className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Tag color={BOOKING_STATUS_COLORS[s]} className="me-0">{t(`bookingStatus.${s}`)}</Tag>
          <span className="font-normal text-muted-foreground">{t("count", { count: items.length })}</span>
        </h3>
        <DataTable columns={columns} dataSource={items} scroll={{ x: 2290 }} pageSize={30} />
      </section> : null;
    }) : <DataTable columns={columns} dataSource={filtered} scroll={{ x: 2290 }} empty={t("empty")}
      page={page} onPageChange={setPage} pageSize={30} />}
    <CreateAppointmentDrawer open={creating} onClose={() => setCreating(false)} initialCustomer={customerFilter}
      customers={customers} staff={staff}
      onCreated={() => { setCreating(false); setDates({ from: "", to: "" }); setCustomerFilter(""); setSearch(""); setVisit("all"); setBooking("all"); setPage(1); }} />
    <MessagesModal customer={chatFor} onClose={() => setChatFor(null)} />
    <AppointmentDrawer appointment={editing} customer={editing ? customerMap.get(editing.customer_id) : undefined}
      staff={staff} services={services} canEdit={canEdit} canShowUp={canShowUp}
      onViewInfo={setInfoFor} onOpenNotes={() => setNotesId(editingId)} onClose={() => setEditingId(null)} />
    {/* Ghi chú Sales của lịch (sales_notes): người có quyền sửa lịch thêm được; người ghi xoá được ghi chú của mình. */}
    <NotesDrawer open={notesFor !== null} staff={staff} notes={notesFor?.sales_notes ?? []}
      title={t("salesNotesTitle", { name: notesFor ? customerMap.get(notesFor.customer_id)?.full_name ?? "" : "" })}
      onAdd={canEdit && notesFor ? (input) => addSalesNote(notesFor.id, input) : undefined}
      canDelete={(n) => canEdit && !!n.id && n.by_id === me}
      onDelete={(n) => notesFor && n.id ? deleteSalesNote(notesFor.id, n.id) : Promise.resolve({})}
      onClose={() => setNotesId(null)} />
    <CustomerNotesDrawer customer={teleNotesFor} staff={staff} onClose={() => setTeleNotesFor(null)} />
    <CustomerInfoDrawer customer={infoFor} staff={staff} onClose={() => setInfoFor(null)} />
  </Page>;
}

export function AppointmentNote({ value, label, disabled, onSave }: {
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
export function CreateAppointmentDrawer({ open, onClose, onCreated, initialCustomer, customers, staff }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialCustomer: string;
  customers: AppointmentCustomer[];
  staff: AppointmentStaff[];
}) {
  const t = useTranslations("appointments");
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
          options={customers.map((c) => ({ value: c.id, label: [c.full_name, c.phone].filter(Boolean).join(" · ") }))} />
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
      {/* Telesales chỉ chọn nhóm; dịch vụ chi tiết điền sau trên bảng lịch hẹn / tour. */}
      <Form.Item name="service_categories" label={t("serviceCategories")}>
        <Select mode="multiple" allowClear placeholder={t("choose")} options={SERVICE_CATEGORY_OPTIONS} />
      </Form.Item>
      <Form.Item name="note" label={t("note")} className="mb-0">
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={10000} />
      </Form.Item>
    </Form>
  </FormDrawer>;
}
