"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Button, Image, type TableProps } from "antd";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";
import { CalendarPlus, MessageCircleMore } from "lucide-react";

import { patchAppointment } from "@/app/(app)/appointments/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import {
  AppointmentNotesDrawer,
  BookingStatusTag,
  CreateAppointmentDrawer,
  type AppointmentStaff,
} from "@/components/appointments/appointments-manager";
import { DASH, StatusDot } from "@/components/common/cells";
import { ClearableSelect } from "@/components/common/clearable-select";
import { DataTable } from "@/components/common/data-table";
import { MessagesModal, type MessagesCustomer } from "@/components/appointments/messages-modal";
import { useCustomer360 } from "@/components/customers/customer-360/customer-360-modal";
import { ClearFilters, SearchInput } from "@/components/common/filter-controls";
import { InlineSelect } from "@/components/common/inline-select";
import { NamePhone } from "@/components/common/name-phone";
import { NoteCell } from "@/components/common/notes";
import { useCan } from "@/components/common/permissions";
import { StatCard } from "@/components/common/stat-card";
import { staffName, staffOptions } from "@/components/common/user-avatar";
import { SourceCell } from "@/components/customers/customers-manager";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { formatRupiah } from "@/lib/currency";
import { matchesNameOrPhone } from "@/lib/customers";
import { toast } from "@/lib/toast";
import {
  BOOKING_STATUSES,
  type Appointment,
  type AppointmentCustomer,
  type AppointmentPatch,
} from "@/types/appointment";
import type { Customer } from "@/types/customer";
import type { Service } from "@/types/service";
import { useServiceGroups } from "@/components/common/service-groups";

/** Khách kèm cột cần cho bảng Booking (cọc + nguồn). */
export type BookingCustomer = AppointmentCustomer & {
  deposit_amount: number | null;
  payment_confirm_url: string | null; // ảnh xác nhận thanh toán cọc
  instagram_username: string | null;
};

type Tab = "today" | "tomorrow" | "action" | "all";
type Status = (typeof BOOKING_STATUSES)[number] | "show_up";

/** Trạng thái hiển thị: đã check-in → Đã đến, còn lại theo xác nhận lịch. */
const statusOf = (a: Appointment): Status => (a.checked_in ? "show_up" : a.booking_confirm);
/** Cần xử lý: lịch từ hôm nay trở đi, chưa đến, còn chờ xác nhận hoặc cần đổi lịch. */
const needsAction = (a: Appointment, today: string) =>
  !a.checked_in &&
  (a.booking_confirm === "pending" || a.booking_confirm === "rescheduled") &&
  dayjs(a.scheduled_at).format("YYYY-MM-DD") >= today;

export function BookingsManager({
  appointments,
  customers,
  staff,
  services,
}: {
  appointments: Appointment[];
  customers: BookingCustomer[];
  staff: AppointmentStaff[];
  services: Service[];
}) {
  const groups = useServiceGroups();
  const t = useTranslations("bookings");
  const ta = useTranslations("appointments");
  const tc = useTranslations("customers");
  const can = useCan();
  const canEdit = can("appointments.edit");
  const [, start] = useTransition();

  const [tab, setTab] = useState<Tab>("today");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [staffId, setStaffId] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [notesId, setNotesId] = useState<string | null>(null);
  const [today] = useState(() => dayjs().format("YYYY-MM-DD"));
  const tomorrow = dayjs(today).add(1, "day").format("YYYY-MM-DD");

  const [rows, patchOptimistic] = useOptimistic(appointments, (state: Appointment[], p: AppointmentPatch & { id: string }) =>
    state.map((a) => (a.id === p.id ? { ...a, ...p } : a)),
  );

  const save = (id: string, patch: AppointmentPatch) =>
    start(async () => {
      patchOptimistic({ id, ...patch });
      const res = await patchAppointment(id, patch);
      if (res.error) toast.error(res.error);
      else toast.success(ta("saved"));
    });

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  // Dịch vụ chi tiết nếu đã điền, chưa thì nhóm dịch vụ Telesales chọn.
  const serviceText = (a: Appointment) =>
    (a.service_ids.length
      ? a.service_ids.map((id) => {
          const s = serviceMap.get(id);
          return s ? s.name : "";
        })
      : a.service_categories.map(groups.name)
    )
      .filter(Boolean)
      .join(", ");

  const statusLabel = (s: Status) => (s === "show_up" ? ta("showUp") : ta(`bookingStatus.${s}`));
  const statusTag = (s: Status) =>
    s === "show_up" ? <StatusDot color="green" label={statusLabel(s)} /> : <BookingStatusTag status={s} />;
  // Option select = chữ trần; chấm màu chỉ ở ô hiển thị.
  const statusOptions = BOOKING_STATUSES.map((value) => ({ value, label: statusLabel(value) }));

  // Lịch của khách đã xoá không hiện.
  const visible = useMemo(() => rows.filter((a) => customerMap.has(a.customer_id)), [rows, customerMap]);

  // Card tính trên toàn bộ lịch (không theo bộ lọc).
  const counts = useMemo(() => {
    const c = { today: 0, pending: 0, action: 0, showUp: 0 };
    for (const a of visible) {
      const isToday = dayjs(a.scheduled_at).format("YYYY-MM-DD") === today;
      if (isToday) {
        c.today++;
        if (a.checked_in) c.showUp++;
        else if (a.booking_confirm === "pending") c.pending++;
      }
      if (needsAction(a, today)) c.action++;
    }
    return c;
  }, [visible, today]);

  const q = search.trim().toLowerCase();
  const filtered = visible
    .filter((a) => {
      const day = dayjs(a.scheduled_at).format("YYYY-MM-DD");
      const c = customerMap.get(a.customer_id)!;
      return (
        (tab === "all" ||
          (tab === "today" && day === today) ||
          (tab === "tomorrow" && day === tomorrow) ||
          (tab === "action" && needsAction(a, today))) &&
        (!status || statusOf(a) === status) &&
        (!staffId || a.staff_id === staffId) &&
        (!q || matchesNameOrPhone(c.full_name, c.phone, q) || serviceText(a).toLowerCase().includes(q))
      );
    })
    // Tất cả: lịch mới nhất trước; các tab khác theo giờ hẹn tăng dần.
    .sort((a, b) => (tab === "all" ? -1 : 1) * (Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at)));

  // Lọc đổi → về trang 1 (điều chỉnh ngay trong render, không effect).
  const filterKey = `${tab}|${search}|${status}|${staffId}`;
  const [seenKey, setSeenKey] = useState(filterKey);
  if (seenKey !== filterKey) {
    setSeenKey(filterKey);
    setPage(1);
  }

  // Popup 360°: Trước/Tiếp theo khách của danh sách đang lọc.
  const c360 = useCustomer360({ ids: filtered.map((a) => a.customer_id), staff });
  const [chatFor, setChatFor] = useState<MessagesCustomer | null>(null); // modal tin SMAX

  const columns: TableProps<Appointment>["columns"] = [
    {
      title: t("colSchedule"),
      key: "schedule",
      width: 130,
      render: (_, a) => (
        <div className="leading-tight tabular-nums">
          <AppointmentDate
            inline
            format="HH:mm"
            value={a.scheduled_at}
            disabled={!canEdit}
            onSave={(iso) => save(a.id, { scheduled_at: iso })}
          />
          <div className="mt-0.5 text-xs text-muted-foreground">{dayjs(a.scheduled_at).format("DD/MM/YYYY")}</div>
        </div>
      ),
    },
    {
      title: t("colCustomer"),
      key: "customer",
      width: 260,
      render: (_, a) => {
        const c = customerMap.get(a.customer_id)!;
        const svc = serviceText(a);
        // Bấm tên → popup hồ sơ 360°; tin SMAX mở ở cột Tin nhắn.
        return (
          <NamePhone
            phone={c.phone}
            title={c.full_name}
            extra={svc ? <span title={svc}> · {svc}</span> : null}
            name={
              <button
                type="button"
                title={ta("openProfile")}
                onClick={() => c360.open(c.id)}
                className="max-w-full truncate text-start font-medium hover:text-primary hover:underline"
              >
                {c.full_name}
              </button>
            }
          />
        );
      },
    },
    // Tin nhắn: icon mở modal 30 tin SMAX gần nhất (chưa có hội thoại → "—").
    {
      title: ta("messages"),
      key: "messages",
      width: 90,
      align: "center",
      render: (_, a) => {
        const c = customerMap.get(a.customer_id)!;
        return c.thread_link ? (
          <Button
            type="text"
            size="small"
            aria-label={ta("viewMessages")}
            title={ta("viewMessages")}
            icon={<MessageCircleMore className="size-4" />}
            onClick={() => setChatFor(c)}
          />
        ) : DASH;
      },
    },
    {
      title: t("colDeposit"),
      key: "deposit",
      width: 170,
      align: "right",
      // Có ảnh xác nhận thanh toán → thumbnail nhỏ cạnh số tiền, bấm mở preview to (giống trang Khách hàng).
      render: (_, a) => {
        const c = customerMap.get(a.customer_id);
        const amount = c?.deposit_amount ?? 0;
        return amount > 0 || c?.payment_confirm_url ? (
          <div className="flex items-center justify-end gap-2">
            {c?.payment_confirm_url ? (
              <Image
                src={c.payment_confirm_url}
                alt={tc("paymentConfirm")}
                width={28}
                height={28}
                className="rounded border border-border object-cover"
              />
            ) : null}
            {amount > 0 ? <span className="tabular-nums">{formatRupiah(amount)}</span> : null}
          </div>
        ) : DASH;
      },
    },
    {
      title: t("colTele"),
      key: "staff",
      width: 150,
      render: (_, a) => (
        <InlineSelect
          value={a.staff_id ?? ""}
          display={staffName(staff, a.staff_id)}
          options={staffOptions(staff, a.staff_id)}
          noneLabel={ta("choose")}
          ariaLabel={t("colTele")}
          disabled={!canEdit}
          onSave={(v) => save(a.id, { staff_id: v || null })}
        />
      ),
    },
    {
      title: t("colSource"),
      key: "source",
      width: 150,
      render: (_, a) => {
        const c = customerMap.get(a.customer_id)!;
        return <SourceCell customer={{ ...c, thread: c.thread_link ? { link: c.thread_link } : null } as unknown as Customer} />;
      },
    },
    {
      title: t("colStatus"),
      key: "status",
      width: 160,
      // Đã đến do Sales xác nhận ở trang Lịch hẹn — ở đây chỉ hiển thị.
      render: (_, a) =>
        a.checked_in ? (
          statusTag("show_up")
        ) : (
          <InlineSelect
            value={a.booking_confirm}
            display={statusTag(a.booking_confirm)}
            options={statusOptions}
            ariaLabel={t("colStatus")}
            disabled={!canEdit}
            onSave={(v) => save(a.id, { booking_confirm: v as Appointment["booking_confirm"] })}
          />
        ),
    },
    {
      title: t("colNote"),
      key: "note",
      width: 280,
      render: (_, a) => (
        <NoteCell notes={a.notes} label={t("colNote")} emptyText={canEdit ? `+ ${ta("addNote")}` : "—"} onOpen={() => setNotesId(a.id)} />
      ),
    },
  ];

  const activeFilters = [search, status, staffId].filter(Boolean).length;
  const notesFor = notesId ? rows.find((a) => a.id === notesId) ?? null : null;

  return (
    <Page>
      <PageHeader title={t("title")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("kpiToday")} value={counts.today} />
        <StatCard label={t("kpiPending")} value={counts.pending} />
        <StatCard label={t("kpiAction")} value={counts.action} tone={counts.action ? "destructive" : "muted"} />
        <StatCard label={t("kpiShowUp")} value={counts.showUp} />
      </div>

      <PageToolbar>
        {canEdit && (
          <Button type="primary" icon={<CalendarPlus className="size-4" />} onClick={() => setCreating(true)}>
            {t("create")}
          </Button>
        )}
        <SearchInput placeholder={t("searchPlaceholder")} value={search} onChange={setSearch} />
        {/* Lọc nhanh dạng nút như Sales Management; nút đang chọn viền màu chính. */}
        {(["today", "tomorrow", "action", "all"] as const).map((k) => (
          <Button
            key={k}
            aria-pressed={tab === k}
            type={tab === k ? "primary" : "default"}
            ghost={tab === k}
            onClick={() => setTab(k)}
          >
            {t(`tab.${k}`)}
          </Button>
        ))}
        <ClearableSelect
          className="min-w-40"
          value={status}
          onChange={setStatus}
          options={[...BOOKING_STATUSES, "show_up" as const].map((s) => ({ value: s, label: statusLabel(s) }))}
          placeholder={t("allStatus")}
          ariaLabel={t("colStatus")}
        />
        <ClearableSelect
          className="min-w-40"
          value={staffId}
          onChange={setStaffId}
          options={staffOptions(staff)}
          placeholder={t("allTele")}
          ariaLabel={t("colTele")}
        />
        <ClearFilters
          show={activeFilters > 0}
          onClick={() => {
            setSearch("");
            setStatus("");
            setStaffId("");
          }}
        />
      </PageToolbar>

      <DataTable
        columns={columns}
        dataSource={filtered}
        onChange={c360.onTableChange}
        scroll={{ x: 1300 }}
        page={page}
        onPageChange={setPage}
        pageSize={30}
        empty={t("empty")}
      />

      {/* Ghi chú lịch hẹn (timeline): bấm ô Ghi chú để xem / thêm. */}
      <AppointmentNotesDrawer
        appointment={notesFor}
        field="notes"
        customerName={notesFor ? customers.find((c) => c.id === notesFor.customer_id)?.full_name ?? "" : ""}
        staff={staff}
        canEdit={canEdit}
        onClose={() => setNotesId(null)}
      />

      <CreateAppointmentDrawer
        open={creating}
        onClose={() => setCreating(false)}
        initialCustomer=""
        customers={customers}
        staff={staff}
        onCreated={() => setCreating(false)}
      />
      {c360.modal}
      <MessagesModal customer={chatFor} onClose={() => setChatFor(null)} />
    </Page>
  );
}
