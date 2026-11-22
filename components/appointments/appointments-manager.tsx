"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button, Form, Input, Popover, Select, Tag, type TableProps } from "antd";
import { CalendarPlus, MessageCircleMore, Rows3, Search, ShoppingCart, SquarePen } from "lucide-react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { addAppointmentNote, createAppointment, deleteAppointmentNote, patchAppointment } from "@/app/(app)/appointments/actions";
import { createCard } from "@/app/(app)/cards/actions";
import { CardDrawer, DueText, toursOfCard, type CardMe } from "@/components/cards/card-drawer";
import { CardItemsDrawer } from "@/components/cards/card-items-drawer";
import { runAction } from "@/components/tour/tour-drawer";
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
import { useCustomer360 } from "@/components/customers/customer-360/customer-360-modal";
import { staffLabel, UserAvatar, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { ARRIVED_STATUSES, appointmentStats, newCustomerAppointmentIds } from "@/lib/appointments";
import { cardMoney } from "@/lib/cards";
import { StatCard } from "@/components/common/stat-card";
import { matchesNameOrPhone } from "@/lib/customers";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import {
  BOOKING_STATUSES, BOOKING_STATUS_COLORS, VISIT_STATUSES, VISIT_STATUS_COLORS,
  type Appointment, type AppointmentCustomer, type AppointmentPatch, type VisitStatus,
} from "@/types/appointment";
import type { Service } from "@/types/service";
import { useServiceGroups } from "@/components/common/service-groups";
import type { TreatmentCard } from "@/types/card";
import type { Customer } from "@/types/customer";
import type { Tour } from "@/types/tour";
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

export function AppointmentsManager({ appointments, customers, staff, services, initialCustomer, visitChoices, cards, cardTours, cardMe }: {
  appointments: Appointment[];
  customers: AppointmentCustomer[];
  staff: AppointmentStaff[];
  services: Service[];
  initialCustomer: string;
  /** Status được chọn: Sales/admin mọi trạng thái, Master chỉ Đã thực hiện (rỗng = không đổi được). */
  visitChoices: VisitStatus[];
  cards: TreatmentCard[]; // thẻ liệu trình (Tài chính + cột Thẻ)
  cardTours: Tour[];
  cardMe: CardMe;
}) {
  const t = useTranslations("appointments");
  const tc = useTranslations("cards");
  const groups = useServiceGroups();
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
  const [notesOpen, setNotesOpen] = useState<{ id: string; field: AppointmentNoteField } | null>(null);
  const [teleNotesFor, setTeleNotesFor] = useState<AppointmentCustomer | null>(null);
  const [grouped, setGrouped] = useState(false);
  const [sellFor, setSellFor] = useState<Appointment | null>(null); // lịch đang bán thẻ (giỏ hàng)
  const [cardId, setCardId] = useState<string | null>(null);
  const [rows, patchOptimistic] = useOptimistic(appointments,
    (state: Appointment[], patch: AppointmentPatch & { id: string }) =>
      state.map((row) => row.id === patch.id ? { ...row, ...patch } : row));

  const save = (id: string, patch: AppointmentPatch) => start(async () => {
    patchOptimistic({ id, ...patch });
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
  // Thẻ đang hiệu lực theo lịch bán; cọc chưa trừ vào thẻ nào của khách (thẻ mới sẽ trừ phần này).
  const activeCards = cards.filter((c) => !c.cancelled_at);
  const cardByAppointment = new Map(activeCards.filter((c) => c.appointment_id).map((c) => [c.appointment_id!, c]));
  const depositLeft = (customerId: string) => Math.max((customerMap.get(customerId)?.deposit_amount ?? 0)
    - activeCards.filter((c) => c.customer_id === customerId).reduce((s, c) => s + c.deposit_used, 0), 0);
  const openCard = cardId ? cards.find((c) => c.id === cardId) : undefined;
  const stats = appointmentStats(filtered, (row) => {
    const card = cardByAppointment.get(row.id);
    return card ? cardMoney(card) : null;
  });
  // Popup 360°: Trước/Tiếp theo khách của bảng đang lọc; "Chuyển sang nhập liệu" → Drawer lịch gần nhất của khách.
  const c360 = useCustomer360({
    ids: filtered.map((row) => row.customer_id), staff,
    onEdit: (_, appointmentId) => setEditingId(appointmentId),
  });
  const editing = editingId ? rows.find((row) => row.id === editingId) ?? null : null;
  const notesFor = notesOpen ? rows.find((row) => row.id === notesOpen.id) ?? null : null;
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
    // Tên (bấm mở popup hồ sơ 360°; + chấm xanh = khách mới) + SĐT · nhóm DV (bấm nhóm để sửa) + icon ✎ mở drawer sửa lịch.
    { title: t("name"), width: 240, fixed: "left", render: (_, row) => {
      const customer = customerMap.get(row.customer_id);
      const cats = groups.label(row.service_categories);
      return <div className="flex items-center justify-between gap-1">
        <div className="min-w-0 flex-1">
        <NamePhone phone={customer?.phone} title={customer?.full_name}
          name={<><button type="button" aria-label={t("openProfile")} title={t("openProfile")} onClick={() => c360.open(row.customer_id)}
            className="font-medium hover:text-primary hover:underline">{customer?.full_name}</button>{newIds.has(row.id) && <span role="img" aria-label={t("newCustomer")} title={t("newCustomer")}
            className="ms-1 inline-block size-2 rounded-full bg-success align-super" />}</>}
          extra={cats || canEdit ? <>{" · "}<InlineMultiSelect
            value={row.service_categories} ariaLabel={t("serviceCategories")} disabled={!canEdit}
            display={cats || <span className="opacity-70">{t("addCategory")}</span>}
            options={groups.options}
            onSave={(c) => save(row.id, { service_categories: c })} /></> : null} />
        {/* Note Telesales (ghi chú gần nhất của khách, customers.notes) — dưới dòng SĐT, bấm mở drawer ghi chú khách. */}
        {customer?.notes?.length ? <button type="button" onClick={() => setTeleNotesFor(customer)}
          title={customer.notes.map((n) => n.text).join("\n\n")} aria-label={t("teleNote")}
          className="mt-0.5 block max-w-full cursor-pointer truncate text-left text-xs text-muted-foreground hover:text-primary">
          {customer.notes.at(-1)!.text}{customer.notes.length > 1 && ` (+${customer.notes.length - 1})`}
        </button> : null}
        {/* Ghi chú lịch hẹn (timeline notes) — dưới dòng SĐT: ghi chú mới nhất cắt "…", bấm mở drawer ghi chú. */}
        {row.notes.length > 0 && <button type="button" onClick={() => setNotesOpen({ id: row.id, field: "notes" })}
          title={row.notes.map((n) => n.text).join("\n\n")}
          className="mt-0.5 block max-w-full cursor-pointer truncate text-left text-xs text-muted-foreground hover:text-primary">
          {row.notes.at(-1)!.text}{row.notes.length > 1 && ` (+${row.notes.length - 1})`}
        </button>}
        </div>
        {/* Icon ✎ mở drawer Sửa lịch hẹn; Thông tin khách mở từ icon trong drawer đó. */}
        {customer && <Button type="text" size="small" aria-label={t("openEdit")} title={t("openEdit")}
          icon={<SquarePen className="size-4" />} onClick={() => setEditingId(row.id)} />}
      </div>;
    } },
    // Nguồn: icon + số WA nhận tin / username IG — giống Booking management & Khách hàng.
    { title: t("source"), width: 150, render: (_, row) => {
      const c = customerMap.get(row.customer_id);
      return c ? <SourceCell customer={{ ...c, thread: c.thread_link ? { link: c.thread_link } : null } as unknown as Customer} /> : null;
    } },
    // Thay cột Số WA: icon mở modal 30 tin SMAX gần nhất (khách chưa có hội thoại → "—").
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
      value={row.visit_status} ariaLabel={t("confirmation")} disabled={!canEdit || !visitChoices.length}
      display={<VisitStatusTag status={row.visit_status} />}
      options={visitOptions.map((o) => ({ ...o, disabled: o.value !== row.visit_status && !visitChoices.includes(o.value) }))}
      onSave={(value) => save(row.id, { visit_status: value as VisitStatus })} /> },
    // Cột Nhóm dịch vụ đã gộp vào ô Khách hàng (sau SĐT).
    // Thẻ liệu trình: có thẻ → chỉ mã thẻ (bấm mở thẻ xem chi tiết); khách đã đến chưa có thẻ → giỏ hàng bán thẻ.
    { title: tc("column"), width: 140, render: (_, row) => {
      const card = cardByAppointment.get(row.id);
      if (card) return <button type="button" onClick={() => setCardId(card.id)} className="cursor-pointer">
        <Tag color="purple" className="me-0">{card.code}</Tag>
      </button>;
      if (!cardMe.canEdit) return <span className="text-muted-foreground">—</span>;
      const arrived = ARRIVED_STATUSES.includes(row.visit_status);
      return <Button type="text" aria-label={t("sellCard")} title={arrived ? t("sellCard") : t("sellCardNeedsArrival")} disabled={!arrived}
        icon={<ShoppingCart className="size-4" />} onClick={() => setSellFor(row)} />;
    } },
    // Tài chính (từ thẻ): Giá trị thẻ / Đã thu / Công nợ; chưa có thẻ → cọc chưa trừ của khách.
    { title: t("finance"), width: 230, render: (_, row) => {
      const card = cardByAppointment.get(row.id);
      const line = (label: string, value: React.ReactNode) => <>
        <span className="text-muted-foreground">{label}</span><span className="text-right">{value}</span>
      </>;
      if (!card) return <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 tabular-nums">
        {line(t("deposit"), idr.format(depositLeft(row.customer_id)))}
      </div>;
      const m = cardMoney(card);
      return <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 tabular-nums">
        {line(t("cardValue"), idr.format(m.value))}
        {line(t("paidTotal"), <span className="text-success">{idr.format(m.collected)}</span>)}
        {line(t("due"), <DueText due={m.due} />)}
      </div>;
    } },
    // Nhân sự: Telesales · Sales · Master gộp 1 cột, đứng sát nhau trên 1 hàng (cột hẹp thì tự xuống dòng);
    // người chưa gán thì bỏ qua, hover thấy vai trò. Bấm → popup chọn Sales / Master (lưu ngay; Telesales chỉ xem).
    { title: t("staffColumn"), width: 300, render: (_, row) => {
      const people = ([["staff", row.staff_id], ["sales", row.sales_id], ["master", row.technician_id]] as const)
        .flatMap(([role, id]) => {
          const member = id ? staff.find((s) => s.id === id) : undefined;
          return member ? [{ role, member }] : [];
        });
      const display = people.length
        ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{people.map(({ role, member }) =>
          <span key={role} title={`${t(role)}: ${member.user_name}`} className="flex min-w-0 items-center gap-1.5">
            <UserAvatar src={member.avatar_url} />
            <span className="max-w-28 truncate">{member.user_name || "—"}</span>
          </span>)}</div>
        : <span className="text-muted-foreground">—</span>;
      if (!canEdit) return display;
      const tele = row.staff_id ? staff.find((s) => s.id === row.staff_id) : undefined;
      const pick = (field: "sales_id" | "technician_id", label: string, depts: string[], placeholder: string) =>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Select allowClear showSearch={{ optionFilterProp: "label" }} placeholder={placeholder} aria-label={label}
            value={row[field] ?? undefined} options={staffOptions(staff, row[field], depts)}
            onChange={(v?: string) => { if ((v ?? null) !== row[field]) save(row.id, { [field]: v ?? null }); }} />
        </label>;
      return <Popover trigger="click" placement="bottomLeft" title={t("staffColumn")} content={<div className="flex w-64 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("staff")}</span>
          <span className={tele ? undefined : "text-muted-foreground"}>{tele ? staffLabel(tele) : "—"}</span>
        </div>
        {pick("sales_id", t("sales"), ["sales"], t("choose"))}
        {pick("technician_id", t("master"), ["technician"], t("unassigned"))}
      </div>}>
        <button type="button" aria-label={t("staffColumn")} className="-mx-1 w-full cursor-pointer rounded px-1 py-0.5 text-left hover:bg-muted">
          {display}
        </button>
      </Popover>;
    } },
    // Cột Người tạo tạm ẩn — dữ liệu created_by vẫn ghi + vẫn tải.
    // Note Sales: ghi chú Sales gần nhất (tiêu đề + người ghi · nội dung), bấm mở drawer Ghi chú Sales.
    { title: t("salesNotesColumn"), width: 300, render: (_, row) => <NoteCell notes={row.sales_notes}
      label={t("salesNotesColumn")} emptyText={canEdit ? `+ ${t("addNote")}` : "—"} onOpen={() => setNotesOpen({ id: row.id, field: "sales_notes" })} /> },
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
        <DataTable columns={columns} dataSource={items} scroll={{ x: 1990 }} pageSize={30} onChange={c360.onTableChange} />
      </section> : null;
    }) : <DataTable columns={columns} dataSource={filtered} scroll={{ x: 1990 }} empty={t("empty")}
      page={page} onPageChange={setPage} pageSize={30} onChange={c360.onTableChange} />}
    <CreateAppointmentDrawer open={creating} onClose={() => setCreating(false)} initialCustomer={customerFilter}
      customers={customers} staff={staff}
      onCreated={() => { setCreating(false); setDates({ from: "", to: "" }); setCustomerFilter(""); setSearch(""); setVisit("all"); setBooking("all"); setPage(1); }} />
    <MessagesModal customer={chatFor} onClose={() => setChatFor(null)} />
    <AppointmentDrawer appointment={editing} customer={editing ? customerMap.get(editing.customer_id) : undefined}
      staff={staff} services={services} canEdit={canEdit} visitChoices={visitChoices}
      card={editing ? cardByAppointment.get(editing.id) : undefined} deposit={editing ? depositLeft(editing.customer_id) : 0}
      onViewInfo={setInfoFor} onOpenNotes={() => editingId && setNotesOpen({ id: editingId, field: "sales_notes" })} onClose={() => setEditingId(null)} />
    <AppointmentNotesDrawer appointment={notesFor} field={notesOpen?.field ?? "notes"} staff={staff} canEdit={canEdit}
      customerName={notesFor ? customerMap.get(notesFor.customer_id)?.full_name ?? "" : ""} onClose={() => setNotesOpen(null)} />
    <CustomerNotesDrawer customer={teleNotesFor} staff={staff} onClose={() => setTeleNotesFor(null)} />
    <CustomerInfoDrawer customer={infoFor} staff={staff} onClose={() => setInfoFor(null)} />
    {/* Bán thẻ liệu trình: chọn dịch vụ → thẻ mới trừ cọc chưa dùng của khách. */}
    <CardItemsDrawer open={sellFor !== null} services={services}
      title={tc("sellTitle", { name: sellFor ? customerMap.get(sellFor.customer_id)?.full_name ?? "" : "" })}
      submitText={tc("confirmSell")} deposit={sellFor ? depositLeft(sellFor.customer_id) : 0} onClose={() => setSellFor(null)}
      onSubmit={(items, note) => sellFor ? runAction(createCard({ customer_id: sellFor.customer_id, appointment_id: sellFor.id, items, note }),
        tc("created"), tc("saveError")) : Promise.resolve(false)} />
    {openCard ? <CardDrawer key={openCard.id} card={openCard} tours={toursOfCard(openCard, cardTours)} services={services}
      staff={staff} me={cardMe} onOpenCustomer={c360.open} onClose={() => setCardId(null)} /> : null}
    {c360.modal}
  </Page>;
}

export type AppointmentNoteField = "notes" | "sales_notes";

/**
 * Ghi chú timeline của 1 lịch: notes (ghi chú lịch hẹn / Telesales) hoặc sales_notes (ghi chú Sales).
 * Người có quyền sửa lịch thêm được; người ghi xoá được ghi chú của mình. Dùng ở Sales + Booking Management.
 */
export function AppointmentNotesDrawer({ appointment, field, customerName, staff, canEdit, onClose }: {
  appointment: Appointment | null;
  field: AppointmentNoteField;
  customerName: string;
  staff: StaffRef[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("appointments");
  const me = useCurrentUserId();
  const a = appointment;
  return <NotesDrawer open={a !== null} staff={staff} notes={a?.[field] ?? []}
    title={t(field === "sales_notes" ? "salesNotesTitle" : "notesTitle", { name: customerName })}
    onAdd={canEdit && a ? (input) => addAppointmentNote(a.id, field, input) : undefined}
    canDelete={(n) => canEdit && !!n.id && n.by_id === me}
    onDelete={(n) => a && n.id ? deleteAppointmentNote(a.id, field, n.id) : Promise.resolve({})}
    onClose={onClose} />;
}

type CreateValues = Required<Pick<AppointmentPatch, "scheduled_at">> & Omit<AppointmentPatch, "scheduled_at"> & {
  customer_id?: string;
  /** Tạo nhanh khách mới (stage Booking) — thay cho customer_id. */
  new_name?: string;
  new_phone?: string;
  /** Ghi chú lúc tạo → ghi chú đầu tiên trên timeline của lịch. */
  note?: string;
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
  const groups = useServiceGroups();
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
        <Select mode="multiple" allowClear placeholder={t("choose")} options={groups.options} />
      </Form.Item>
      <Form.Item name="note" label={t("note")} className="mb-0">
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={10000} />
      </Form.Item>
    </Form>
  </FormDrawer>;
}
