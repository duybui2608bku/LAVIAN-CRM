"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Pagination,
  Popover,
  Segmented,
  Table,
  Tag,
  type TableColumnType,
} from "antd";
import { useLocale, useTranslations } from "next-intl";
import {
  Ban,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  List,
  LogIn,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Undo2,
  UserX,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { addDays, addMonths, startOfWeek } from "date-fns";

import {
  deleteAppointment,
  rescheduleAppointment,
  setAppointmentStatus,
  setAppointmentTechnician,
} from "@/app/(app)/appointments/actions";
import {
  collectSuggestion,
  localTime,
  matchesAppointmentFilters,
  outstanding,
  paidTotal,
  payableTotal,
  sortForDayView,
  upsaleTotal,
} from "@/lib/appointments";
import { formatRupiah } from "@/lib/currency";
import { serviceName } from "@/lib/customers";
import { formatISODate, parseISODate } from "@/lib/date";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  AppointmentDialog,
  type CustomerRef,
} from "@/components/appointments/appointment-dialog";
import { AppointmentsCalendar } from "@/components/appointments/appointments-calendar";
import { AppointmentStatusTag } from "@/components/appointments/status-tag";
import { PaymentsDialog } from "@/components/appointments/payments-dialog";
import { UpsalesDialog } from "@/components/appointments/upsales-dialog";
import { ClearableSelect } from "@/components/common/clearable-select";
import { useConfirm } from "@/components/common/confirm-action";
import { CurrencyInput } from "@/components/common/currency-input";
import { DatePicker, TimePicker } from "@/components/common/date-picker";
import { ImageUpload } from "@/components/common/image-upload";
import { InlineSelect } from "@/components/common/inline-select";
import { RowActions } from "@/components/common/row-actions";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import {
  APPOINTMENT_STATUSES,
  PAYMENT_METHODS,
  type Appointment,
  type AppointmentStatus,
  type PaymentMethod,
} from "@/types/appointment";
import type { EnumOption } from "@/types/customer";
import type { Service } from "@/types/service";

// Dòng nhóm theo trạng thái chen giữa các lịch — như sheet gom Sudah Datang / Booking.
type GroupRow = { id: string; group: AppointmentStatus; count: number };
type Row = Appointment | GroupRow;
const isGroup = (r: Row): r is GroupRow => "group" in r;

const DASH = <span className="text-muted-foreground">—</span>;

// ponytail: phân trang client (data đã tải sẵn) — giống /customers.
const PAGE_SIZE = 20;

export function AppointmentsManager({
  appointments,
  customers,
  staff,
  currentUserId,
  currentUserIsAdmin,
  options,
  services,
}: {
  appointments: Appointment[];
  customers: CustomerRef[];
  staff: StaffRef[];
  currentUserId: string;
  currentUserIsAdmin: boolean;
  options: EnumOption[];
  services: Service[];
}) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  const [tab, setTab] = useState<"day" | "waiting">("day");
  // view: bảng (mặc định) | calendar tuần | calendar tháng. `day` kiêm ngày neo calendar.
  const [view, setView] = useState<"table" | "week" | "month">("table");
  const [day, setDay] = useState(() => formatISODate(new Date()));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [target, setTarget] = useState<Appointment | "new" | null>(null);
  // Lưu id (không giữ object) để dialog Thanh toán tự nhận dữ liệu mới sau refresh.
  const [payFor, setPayFor] = useState<string | null>(null);
  const payAppt = appointments.find((a) => a.id === payFor) ?? null;
  const [upsaleFor, setUpsaleFor] = useState<string | null>(null);
  const upsaleAppt = appointments.find((a) => a.id === upsaleFor) ?? null;
  const [page, setPage] = useState(1);

  // Đổi trạng thái / kỹ thuật viên hiện ngay, không chờ server. React tự trả về
  // dữ liệu server khi transition kết thúc — action lỗi thì dòng quay lại như cũ.
  const [rowsData, patchOptimistic] = useOptimistic(
    appointments,
    (state: Appointment[], patch: Partial<Appointment> & { id: string }) =>
      state.map((a) => (a.id === patch.id ? { ...a, ...patch } : a)),
  );

  // "Khách cũ": lịch tạo TRƯỚC lịch hiện tại (badge trên bảng) / đã có lịch
  // bất kỳ (badge trong drawer tạo). Suy từ data đã nạp, không thêm cột DB.
  const { returningIds, firstApptAt } = useMemo(() => {
    const first = new Map<string, string>();
    for (const a of appointments) {
      const cur = first.get(a.customer_id);
      if (!cur || a.created_at < cur) first.set(a.customer_id, a.created_at);
    }
    return {
      returningIds: new Set(appointments.map((a) => a.customer_id)),
      firstApptAt: first,
    };
  }, [appointments]);
  const isReturningRow = (a: Appointment) =>
    (firstApptAt.get(a.customer_id) ?? a.created_at) < a.created_at;

  const filtered = useMemo(
    () =>
      sortForDayView(
        rowsData.filter((a) =>
          matchesAppointmentFilters(a, {
            waiting: tab === "waiting",
            day: tab === "day" ? day : undefined,
            search,
            status,
            technicianId,
            serviceId,
          }),
        ),
      ),
    [rowsData, tab, day, search, status, technicianId, serviceId],
  );

  // Calendar: lọc search/kỹ thuật viên/service, KHÔNG lọc ngày.
  const calendarList = useMemo(
    () =>
      rowsData.filter((a) =>
        matchesAppointmentFilters(a, { search, technicianId, serviceId }),
      ),
    [rowsData, search, technicianId, serviceId],
  );

  // Lọc đổi → về trang 1. Điều chỉnh ngay trong render (không effect) nên
  // không tốn thêm một lượt vẽ; `current` vẫn kẹp page trong [1, totalPages].
  const filterKey = [tab, day, search, status, technicianId, serviceId].join("|");
  const [seenFilterKey, setSeenFilterKey] = useState(filterKey);
  if (seenFilterKey !== filterKey) {
    setSeenFilterKey(filterKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const offset = (current - 1) * PAGE_SIZE;
  const rows = filtered.slice(offset, offset + PAGE_SIZE);
  // Chèn dòng nhóm mỗi khi trạng thái đổi (rows đã sort theo trạng thái).
  const tableRows: Row[] = rows.flatMap((a, i) =>
    i === 0 || rows[i - 1].status !== a.status
      ? [
          {
            id: `group-${a.status}`,
            group: a.status,
            count: filtered.filter((x) => x.status === a.status).length,
          },
          a,
        ]
      : [a],
  );

  const anchorDate = parseISODate(day) ?? new Date();
  const shiftCalendar = (dir: 1 | -1) =>
    setDay(
      formatISODate(
        view === "week" ? addDays(anchorDate, dir * 7) : addMonths(anchorDate, dir),
      ),
    );
  const calendarLabel = (() => {
    if (view === "week") {
      const s = startOfWeek(anchorDate, { weekStartsOn: 1 });
      return `${s.toLocaleDateString(locale)} – ${addDays(s, 6).toLocaleDateString(locale)}`;
    }
    return anchorDate.toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
  })();

  const fmt = (n: number) => formatRupiah(n);
  const statusTag = (s: AppointmentStatus) => (
    <AppointmentStatusTag status={s} />
  );
  const technicianDisplay = (id: string | null) => {
    const s = id ? staff.find((x) => x.id === id) : undefined;
    return s ? staffLabel(s) : DASH;
  };
  const serviceTags = (ids: string[]) => {
    if (!ids?.length) return DASH;
    return (
      <div className="flex max-w-56 flex-wrap gap-1">
        {ids.map((id) => {
          const s = services.find((x) => x.id === id);
          return s ? (
            <Tag key={id} className="me-0">
              {serviceName(s, locale)}
            </Tag>
          ) : null;
        })}
      </div>
    );
  };

  const statusOptions = APPOINTMENT_STATUSES.map((s) => ({
    value: s,
    label: t(`status_${s}`),
  }));
  const assignedTechnicianIds = new Set(
    appointments.flatMap((a) => (a.technician_id ? [a.technician_id] : [])),
  );
  const technicianOptions = staff
    .filter(
      (s) =>
        (s.department === "technician" && s.status === "active") ||
        assignedTechnicianIds.has(s.id),
    )
    .map((s) => ({ value: s.id, label: staffLabel(s) }));
  const serviceOptions = services
    .filter((s) => s.is_active)
    .map((s) => ({ value: s.id, label: serviceName(s, locale) }));

  const changeStatus = (
    a: Appointment,
    next: AppointmentStatus,
    extra?: {
      total_amount?: number | null;
      payment_method?: PaymentMethod | null;
      collect?: { amount: number; image_url?: string | null };
    },
  ) =>
    start(async () => {
      patchOptimistic({ id: a.id, status: next });
      const res = await setAppointmentStatus(a.id, next, extra);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("statusOk"));
    });

  const changeTechnician = (
    appointment: Appointment,
    technicianId: string | null,
  ) =>
    start(async () => {
      patchOptimistic({ id: appointment.id, technician_id: technicianId });
      const res = await setAppointmentTechnician(
        appointment.id,
        technicianId,
      );
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("technicianUpdated"));
    });

  const askDelete = (a: Appointment) =>
    confirm({
      title: t("deleteConfirm"),
      content: t("deleteConfirmBody", { name: a.customer?.full_name ?? "" }),
      okText: t("delete"),
      cancelText: t("cancel"),
      onOk: async () => {
        const res = await deleteAppointment(a.id);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(t("deleteOk"));
      },
    });

  // Action nhanh theo trạng thái (Status Mapping trong design).
  const quickActions = (a: Appointment) => {
    const iconBtn = (
      title: string,
      onClick: () => void,
      icon: React.ReactNode,
    ) => (
      <Button
        key={title}
        type="text"
        size="small"
        title={title}
        aria-label={title}
        disabled={pending}
        onClick={onClick}
        icon={icon}
      />
    );
    switch (a.status) {
      case "pending_confirmation":
        return [
          <ReschedulePopover key="r" appointment={a} disabled={pending} />,
          iconBtn(t("cancelAppt"), () => changeStatus(a, "cancelled"), (
            <Ban className="size-4" />
          )),
        ];
      case "booked":
        return [
          iconBtn(t("checkIn"), () => changeStatus(a, "checked_in"), (
            <LogIn className="size-4" />
          )),
          <ReschedulePopover key="r" appointment={a} disabled={pending} />,
          iconBtn(t("noShow"), () => changeStatus(a, "no_show"), (
            <UserX className="size-4" />
          )),
          iconBtn(t("cancelAppt"), () => changeStatus(a, "cancelled"), (
            <Ban className="size-4" />
          )),
        ];
      case "checked_in":
        return [
          <CompletePopover
            key="c"
            appointment={a}
            disabled={pending}
            onComplete={(extra) => changeStatus(a, "completed", extra)}
          />,
          // Bấm nhầm "đã đến" → quay lại booked (xóa checked_in_at ở server).
          iconBtn(t("undoCheckIn"), () => changeStatus(a, "booked"), (
            <Undo2 className="size-4" />
          )),
          // Khách đến nhưng không làm dịch vụ → hủy (giữ checked_in_at để thống kê).
          iconBtn(t("cancelAppt"), () => changeStatus(a, "cancelled"), (
            <Ban className="size-4" />
          )),
        ];
      case "completed":
        return [
          // Bấm nhầm "hoàn tất" → quay lại checked_in (xóa completed_at).
          iconBtn(t("undoComplete"), () => changeStatus(a, "checked_in"), (
            <Undo2 className="size-4" />
          )),
        ];
      case "no_show":
      case "cancelled":
        return [
          iconBtn(t("rebook"), () => changeStatus(a, "booked"), (
            <RotateCcw className="size-4" />
          )),
        ];
      default:
        return [];
    }
  };

  const amountCell = (v: number | null, cls?: string) => (
    <span className={cn("tabular-nums", cls)}>{v ? fmt(v) : "—"}</span>
  );

  // Cột khai báo theo lịch hẹn; `cell` render 1 lịch (dòng nhóm xử lý riêng ở dưới).
  type Col = Pick<TableColumnType<Row>, "title" | "key" | "align" | "fixed"> & {
    cell: (a: Appointment) => React.ReactNode;
  };
  const baseColumns: Col[] = [
    {
      title: t("colTime"),
      key: "time",
      cell: (a) =>
        a.scheduled_at ? (
          <span className="font-medium tabular-nums">{localTime(a.scheduled_at)}</span>
        ) : (
          <span className="text-muted-foreground tabular-nums" title={t("noDate")}>
            {new Date(a.created_at).toLocaleDateString()}
          </span>
        ),
    },
    {
      title: t("colCustomer"),
      key: "customer",
      cell: (a) => (
        <>
          <div className="flex items-center gap-1.5 font-medium">
            {a.customer?.full_name ?? "—"}
            {isReturningRow(a) && (
              <Tag color="blue" className="me-0">
                {t("returningCustomer")}
              </Tag>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{a.customer?.phone}</div>
        </>
      ),
    },
    { title: t("colServices"), key: "services", cell: (a) => serviceTags(a.service_ids) },
    {
      title: t("colTechnician"),
      key: "technician",
      cell: (a) => (
        <InlineSelect
          value={a.technician_id ?? ""}
          display={technicianDisplay(a.technician_id)}
          options={technicianOptions}
          noneLabel={t("noneOption")}
          ariaLabel={t("colTechnician")}
          onSave={(value) => changeTechnician(a, value || null)}
        />
      ),
    },
    { title: t("colStatus"), key: "status", cell: (a) => statusTag(a.status) },
    {
      title: t("colTotal"),
      key: "total",
      align: "right",
      cell: (a) => amountCell(payableTotal(a), "text-muted-foreground"),
    },
    {
      title: t("colUpsale"),
      key: "upsale",
      align: "right",
      cell: (a) => amountCell(upsaleTotal(a.upsales)),
    },
    { title: t("colPaid"), key: "paid", align: "right", cell: (a) => amountCell(paidTotal(a)) },
    {
      title: t("colOutstanding"),
      key: "outstanding",
      align: "right",
      cell: (a) => {
        const owed = outstanding(a);
        return amountCell(owed > 0 ? owed : null, owed > 0 ? "font-medium text-destructive" : "text-muted-foreground");
      },
    },
    {
      title: t("colNote"),
      key: "note",
      cell: (a) =>
        a.booking_note || a.internal_note ? (
          <span
            className="block max-w-48 truncate text-xs text-muted-foreground"
            title={[a.booking_note, a.internal_note].filter(Boolean).join("\n")}
          >
            {a.booking_note ?? a.internal_note}
          </span>
        ) : (
          DASH
        ),
    },
    {
      title: t("colActions"),
      key: "actions",
      align: "right",
      fixed: "right",
      cell: (a) => (
        <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
          {quickActions(a)}
          <RowActions
            label={t("colActions")}
            items={[
              {
                icon: <TrendingUp className="size-4" />,
                label: t("upsales"),
                count: a.upsales.length,
                onSelect: () => setUpsaleFor(a.id),
              },
              {
                icon: <Wallet className="size-4" />,
                label: t("payments"),
                count: a.ledger?.payments.length ?? a.payments.length,
                onSelect: () => setPayFor(a.id),
              },
              {
                icon: <Pencil className="size-4" />,
                label: t("edit"),
                onSelect: () => setTarget(a),
              },
              {
                icon: <Trash2 className="size-4" />,
                label: t("delete"),
                danger: true,
                onSelect: () => askDelete(a),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  // Dòng nhóm: ô đầu trải hết bề ngang (colSpan), các ô còn lại ẩn.
  const columns: TableColumnType<Row>[] = baseColumns.map(({ cell, ...col }, i) => ({
    ...col,
    onCell: (r) => (isGroup(r) ? { colSpan: i === 0 ? baseColumns.length : 0 } : {}),
    render: (_, r) =>
      !isGroup(r) ? (
        cell(r)
      ) : i === 0 ? (
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {statusTag(r.group)}
          {r.count}
        </span>
      ) : null,
  }));

  const waitingCount = appointments.filter((a) =>
    matchesAppointmentFilters(a, { waiting: true }),
  ).length;

  return (
    <Page>
      <PageHeader
        title={t("title")}
        actions={
          <>
            {/* Toggle bảng ↔ calendar */}
            <Segmented
              value={view === "table" ? "table" : "calendar"}
              onChange={(v) => setView(v === "table" ? "table" : "week")}
              options={[
                { value: "table", icon: <List className="size-4" />, title: t("viewTable") },
                { value: "calendar", icon: <CalendarDays className="size-4" />, title: t("viewCalendar") },
              ]}
            />
            <Button
              icon={<RefreshCw className="size-4" />}
              loading={pending}
              onClick={() => start(() => router.refresh())}
            >
              {t("reload")}
            </Button>
            <Button
              type="primary"
              icon={<CalendarPlus className="size-4" />}
              onClick={() => setTarget("new")}
            >
              {t("create")}
            </Button>
          </>
        }
      />

      {/* Tab: Trong ngày / Chờ xếp lịch — chỉ ở view bảng;
          view calendar thay bằng segmented Tuần/Tháng + điều hướng. */}
      <PageToolbar>
        {view === "table" ? (
          <>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: "day", label: t("tabDay") },
                {
                  value: "waiting",
                  label: (
                    <span className="flex items-center gap-1.5">
                      {t("tabWaiting")}
                      <span className="text-xs text-muted-foreground">{waitingCount}</span>
                    </span>
                  ),
                },
              ]}
            />
            {tab === "day" && (
              <DatePicker
                value={day}
                onChange={(d) => setDay(d || formatISODate(new Date()))}
                placeholder={t("pickDate")}
                allowClear={false}
                className="w-40"
              />
            )}
          </>
        ) : (
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={(["week", "month"] as const).map((k) => ({ value: k, label: t(k) }))}
            />
            <div className="flex items-center gap-1">
              <Button
                type="text"
                title={t("prev")}
                aria-label={t("prev")}
                icon={<ChevronLeft className="size-4" />}
                onClick={() => shiftCalendar(-1)}
              />
              <Button onClick={() => setDay(formatISODate(new Date()))}>{t("today")}</Button>
              <Button
                type="text"
                title={t("next")}
                aria-label={t("next")}
                icon={<ChevronRight className="size-4" />}
                onClick={() => shiftCalendar(1)}
              />
            </div>
            <span className="text-sm font-medium">{calendarLabel}</span>
          </>
        )}
        <Input
          allowClear
          className="w-full sm:max-w-52"
          prefix={<Search className="size-4 text-muted-foreground" />}
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {view === "table" && tab === "day" && (
          <ClearableSelect
            className="min-w-36"
            value={status}
            onChange={setStatus}
            options={statusOptions}
            placeholder={t("allStatus")}
            ariaLabel={t("colStatus")}
          />
        )}
        <ClearableSelect
          className="min-w-36"
          value={technicianId}
          onChange={setTechnicianId}
          options={technicianOptions}
          placeholder={t("allTechnicians")}
          ariaLabel={t("colTechnician")}
        />
        <ClearableSelect
          className="min-w-36"
          value={serviceId}
          onChange={setServiceId}
          options={serviceOptions}
          placeholder={t("allServices")}
          ariaLabel={t("colServices")}
        />
      </PageToolbar>

      {view !== "table" ? (
        <AppointmentsCalendar
          appointments={calendarList}
          view={view}
          anchor={day}
          onPick={(a) => setTarget(a)}
          onPickDay={(d) => {
            setDay(d);
            setTab("day");
            setView("table");
          }}
        />
      ) : (
        <div className="surface overflow-hidden">
          <Table<Row>
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={tableRows}
            pagination={false}
            scroll={{ x: "max-content" }}
            rowClassName={(r) => (isGroup(r) ? "bg-muted/60" : "")}
            locale={{ emptyText: t("empty") }}
          />
          {/* Phân trang tách khỏi Table: dòng nhóm không tính vào 20 dòng/trang. */}
          {filtered.length > 0 && (
            <div className="flex justify-end border-t border-border px-4 py-2">
              <Pagination
                size="small"
                current={current}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                onChange={setPage}
                showSizeChanger={false}
                showTotal={(total, [from, to]) => t("pageInfo", { from, to, total })}
              />
            </div>
          )}
        </div>
      )}

      <AppointmentDialog
        open={target !== null}
        editing={target && target !== "new" ? target : null}
        customers={customers}
        staff={staff}
        options={options}
        services={services}
        appointments={appointments}
        returningIds={returningIds}
        onClose={() => setTarget(null)}
        onOpenPayments={(id) => setPayFor(id)}
      />

      <PaymentsDialog
        appointment={payAppt}
        staff={staff}
        currentUserId={currentUserId}
        services={services}
        onClose={() => setPayFor(null)}
      />

      <UpsalesDialog
        appointment={upsaleAppt}
        staff={staff}
        services={services}
        currentUserId={currentUserId}
        currentUserIsAdmin={currentUserIsAdmin}
        onClose={() => setUpsaleFor(null)}
      />
    </Page>
  );
}

/** Popover dời lịch / chốt ngày cho lịch chờ xếp (DatePicker + giờ). */
function ReschedulePopover({
  appointment,
  disabled,
}: {
  appointment: Appointment;
  disabled?: boolean;
}) {
  const t = useTranslations("appointments");
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const iso = new Date(`${date}T${time || "09:00"}`).toISOString();
      const res = await rescheduleAppointment(appointment.id, iso);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("statusOk"));
      setOpen(false);
    });

  return (
    <Popover
      open={open}
      trigger="click"
      placement="bottomRight"
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          const cur = appointment.scheduled_at ? new Date(appointment.scheduled_at) : null;
          setDate(cur ? formatISODate(cur) : "");
          setTime(cur ? localTime(cur.toISOString()) : "09:00");
        }
      }}
      content={
        <div className="flex w-60 flex-col gap-2">
          <DatePicker value={date} onChange={setDate} placeholder={t("pickDate")} />
          <TimePicker value={time} onChange={setTime} />
          <div className="flex justify-end">
            <Button type="primary" size="small" loading={pending} disabled={!date} onClick={save}>
              {t("save")}
            </Button>
          </div>
        </div>
      }
    >
      <Button
        type="text"
        size="small"
        title={t("reschedule")}
        aria-label={t("reschedule")}
        disabled={disabled}
        icon={<CalendarClock className="size-4" />}
      />
    </Popover>
  );
}

/** Popover hoàn tất: tổng giá liệu trình (→ SỔ chung) + tiền thu lần này
 *  (→ dòng sổ, kèm ảnh) + phương thức, rồi chuyển completed. */
function CompletePopover({
  appointment,
  disabled,
  onComplete,
}: {
  appointment: Appointment;
  disabled?: boolean;
  onComplete: (extra: {
    total_amount: number | null;
    payment_method: PaymentMethod | null;
    collect?: { amount: number; image_url?: string | null };
  }) => void;
}) {
  const t = useTranslations("appointments");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [collect, setCollect] = useState("");
  const [method, setMethod] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const submit = () => {
    setOpen(false);
    const collectNum = collect === "" ? 0 : Number(collect);
    onComplete({
      total_amount: amount === "" ? null : Number(amount),
      payment_method: (method || null) as PaymentMethod | null,
      collect: collectNum > 0 ? { amount: collectNum, image_url: imageUrl } : undefined,
    });
  };

  return (
    <Popover
      open={open}
      trigger="click"
      placement="bottomRight"
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setAmount(appointment.ledger?.total_amount?.toString() ?? "");
          // Thu lần này: chỉ gợi ý khi sổ chưa có tiền của lịch khác —
          // khách cũ nối sổ thì để trống, nhân viên nhập số thực thu.
          const suggest = collectSuggestion(appointment);
          setCollect(suggest != null ? String(suggest) : "");
          setMethod(appointment.payment_method ?? "");
          setImageUrl(null);
        }
      }}
      content={
        <div className="flex w-68 flex-col gap-2">
          <CurrencyInput value={amount} onChange={setAmount} placeholder={t("totalAmount")} />
          <CurrencyInput value={collect} onChange={setCollect} placeholder={t("collectNow")} />
          <ClearableSelect
            value={method}
            onChange={setMethod}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`method_${m}`) }))}
            placeholder={t("paymentMethod")}
            ariaLabel={t("paymentMethod")}
          />
          <ImageUpload
            value={imageUrl}
            onChange={setImageUrl}
            label={t("receiptImage")}
            className="w-24"
          />
          <div className="flex justify-end">
            <Button type="primary" size="small" onClick={submit}>
              {t("complete")}
            </Button>
          </div>
        </div>
      }
    >
      <Button
        type="text"
        size="small"
        title={t("complete")}
        aria-label={t("complete")}
        disabled={disabled}
        icon={<CheckCheck className="size-4" />}
      />
    </Popover>
  );
}
