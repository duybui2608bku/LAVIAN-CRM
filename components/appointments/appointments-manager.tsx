"use client";

import {
  Fragment,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { CurrencyInput } from "@/components/common/currency-input";
import { DatePicker } from "@/components/common/date-picker";
import { ImageUpload } from "@/components/common/image-upload";
import { RowActions } from "@/components/common/row-actions";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APPOINTMENT_STATUSES,
  PAYMENT_METHODS,
  type Appointment,
  type AppointmentStatus,
  type PaymentMethod,
} from "@/types/appointment";
import type { EnumOption } from "@/types/customer";
import type { Service } from "@/types/service";

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
  const [deleting, setDeleting] = useState<Appointment | null>(null);
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
    if (!s) return <span className="text-muted-foreground">—</span>;
    return staffLabel(s);
  };
  const serviceBadges = (ids: string[]) => {
    if (!ids?.length) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="flex max-w-[220px] flex-wrap gap-1">
        {ids.map((id) => {
          const s = services.find((x) => x.id === id);
          return s ? (
            <Badge key={id} variant="secondary">
              {serviceName(s, locale)}
            </Badge>
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

  const confirmDelete = () => {
    const a = deleting;
    if (!a) return;
    setDeleting(null);
    start(async () => {
      const res = await deleteAppointment(a.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("deleteOk"));
    });
  };

  // Action nhanh theo trạng thái (Status Mapping trong design).
  const quickActions = (a: Appointment) => {
    const iconBtn = (
      title: string,
      onClick: () => void,
      icon: React.ReactNode,
    ) => (
      <Button
        key={title}
        size="sm"
        variant="ghost"
        title={title}
        aria-label={title}
        disabled={pending}
        onClick={onClick}
      >
        {icon}
      </Button>
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

  return (
    <Page>
      <PageHeader
        title={t("title")}
        actions={
          <>
            {/* Toggle bảng ↔ calendar */}
            <div className="flex rounded-lg border p-0.5">
              <Button
                size="sm"
                variant={view === "table" ? "secondary" : "ghost"}
                className="h-7"
                title={t("viewTable")}
                aria-label={t("viewTable")}
                onClick={() => setView("table")}
              >
                <List className="size-4" />
              </Button>
              <Button
                size="sm"
                variant={view !== "table" ? "secondary" : "ghost"}
                className="h-7"
                title={t("viewCalendar")}
                aria-label={t("viewCalendar")}
                onClick={() => setView("week")}
              >
                <CalendarDays className="size-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => start(() => router.refresh())}
              disabled={pending}
            >
              <RefreshCw className={cn("size-4", pending && "animate-spin")} />
              {t("reload")}
            </Button>
            <Button onClick={() => setTarget("new")}>
              <CalendarPlus className="size-4" />
              {t("create")}
            </Button>
          </>
        }
      />

      {/* Tab: Trong ngày / Chờ xếp lịch (thay sheet DP CUS) — chỉ ở view bảng;
          view calendar thay bằng segmented Tuần/Tháng + điều hướng. */}
      <PageToolbar>
        {view === "table" ? (
          <>
            <div className="mr-2 flex rounded-lg border p-0.5">
              {(["day", "waiting"] as const).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={tab === k ? "secondary" : "ghost"}
                  className="h-7"
                  onClick={() => setTab(k)}
                >
                  {t(k === "day" ? "tabDay" : "tabWaiting")}
                  {k === "waiting" && (
                    <span className="text-xs text-muted-foreground">
                      {
                        appointments.filter((a) =>
                          matchesAppointmentFilters(a, { waiting: true }),
                        ).length
                      }
                    </span>
                  )}
                </Button>
              ))}
            </div>
            {tab === "day" && (
              <DatePicker
                value={day}
                onChange={setDay}
                placeholder={t("pickDate")}
                className="w-[160px]"
              />
            )}
          </>
        ) : (
          <>
            <div className="mr-2 flex rounded-lg border p-0.5">
              {(["week", "month"] as const).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={view === k ? "secondary" : "ghost"}
                  className="h-7"
                  onClick={() => setView(k)}
                >
                  {t(k)}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                title={t("prev")}
                aria-label={t("prev")}
                onClick={() => shiftCalendar(-1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => setDay(formatISODate(new Date()))}
              >
                {t("today")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                title={t("next")}
                aria-label={t("next")}
                onClick={() => shiftCalendar(1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <span className="text-sm font-medium">{calendarLabel}</span>
          </>
        )}
        <div className="relative w-full sm:max-w-[200px]">
          <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {view === "table" && tab === "day" && (
          <ClearableSelect
            value={status}
            onValueChange={setStatus}
            options={statusOptions}
            placeholder={t("allStatus")}
            clearLabel={t("clear")}
            ariaLabel={t("colStatus")}
          />
        )}
        <ClearableSelect
          value={technicianId}
          onValueChange={setTechnicianId}
          options={technicianOptions}
          placeholder={t("allTechnicians")}
          clearLabel={t("clear")}
          ariaLabel={t("colTechnician")}
        />
        <ClearableSelect
          value={serviceId}
          onValueChange={setServiceId}
          options={serviceOptions}
          placeholder={t("allServices")}
          clearLabel={t("clear")}
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colTime")}</TableHead>
              <TableHead>{t("colCustomer")}</TableHead>
              <TableHead>{t("colServices")}</TableHead>
              <TableHead>{t("colTechnician")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead className="text-right">{t("colTotal")}</TableHead>
              <TableHead className="text-right">{t("colUpsale")}</TableHead>
              <TableHead className="text-right">{t("colPaid")}</TableHead>
              <TableHead className="text-right">{t("colOutstanding")}</TableHead>
              <TableHead>{t("colNote")}</TableHead>
              <TableHead className="text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((a, i) => {
                const paidAmt = paidTotal(a);
                const outstandingAmt = outstanding(a);
                const upsaleAmt = upsaleTotal(a.upsales);
                const paymentCount = a.ledger?.payments.length ?? a.payments.length;
                return (
                  <Fragment key={a.id}>
                    {/* Row nhóm theo trạng thái — như cách sheet gom Sudah Datang / Booking */}
                    {(i === 0 || rows[i - 1].status !== a.status) && (
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={11} className="py-1.5">
                          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            {statusTag(a.status)}
                            {filtered.filter((x) => x.status === a.status).length}
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell className="font-medium tabular-nums">
                        {a.scheduled_at ? (
                          localTime(a.scheduled_at)
                        ) : (
                          <span
                            className="text-muted-foreground"
                            title={t("noDate")}
                          >
                            {new Date(a.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-medium">
                          {a.customer?.full_name ?? "—"}
                          {isReturningRow(a) && (
                            <Badge variant="info">{t("returningCustomer")}</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.customer?.phone}
                        </div>
                      </TableCell>
                      <TableCell>{serviceBadges(a.service_ids)}</TableCell>
                      <TableCell>
                        <InlineTechnicianSelect
                          value={a.technician_id ?? ""}
                          display={technicianDisplay(a.technician_id)}
                          options={technicianOptions}
                          noneLabel={t("noneOption")}
                          ariaLabel={t("colTechnician")}
                          onSave={(value) =>
                            changeTechnician(a, value || null)
                          }
                        />
                      </TableCell>
                      <TableCell>{statusTag(a.status)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {payableTotal(a) != null
                          ? fmt(payableTotal(a)!)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {upsaleAmt > 0 ? fmt(upsaleAmt) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {paidAmt ? fmt(paidAmt) : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          outstandingAmt > 0
                            ? "font-medium text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {outstandingAmt > 0 ? fmt(outstandingAmt) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {a.booking_note || a.internal_note ? (
                          <span
                            className="block truncate text-xs text-muted-foreground"
                            title={[a.booking_note, a.internal_note]
                              .filter(Boolean)
                              .join("\n")}
                          >
                            {a.booking_note ?? a.internal_note}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="space-x-0.5 text-right whitespace-nowrap">
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
                              count: paymentCount,
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
                              onSelect: () => setDeleting(a),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
        {filtered.length > 0 ? (
          <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-sm text-muted-foreground">
            <span>
              {t("pageInfo", {
                from: offset + 1,
                to: offset + rows.length,
                total: filtered.length,
              })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                title={t("prevPage")}
                aria-label={t("prevPage")}
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-1 tabular-nums">
                {current} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                title={t("nextPage")}
                aria-label={t("nextPage")}
                disabled={current >= totalPages}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      )}

      {/* Tổng doanh thu ngày đã bỏ — báo cáo doanh thu làm ở menu thống kê riêng */}

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

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmBody", {
                name: deleting?.customer?.full_name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

const NO_TECHNICIAN = "__none";

/** Select inline trong cột Kỹ thuật viên của bảng lịch hẹn. */
function InlineTechnicianSelect({
  value,
  display,
  options,
  noneLabel,
  ariaLabel,
  disabled,
  onSave,
}: {
  value: string;
  display: React.ReactNode;
  options: { value: string; label: React.ReactNode }[];
  noneLabel: string;
  ariaLabel: string;
  disabled?: boolean;
  onSave: (value: string) => void;
}) {
  return (
    <Select
      value={value || NO_TECHNICIAN}
      onValueChange={(selected) => {
        const next = selected === NO_TECHNICIAN ? "" : selected;
        if (next !== value) onSave(next);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="-m-1 rounded-md border-none bg-transparent p-1 hover:bg-accent/50 data-[size=default]:h-auto dark:bg-transparent dark:hover:bg-accent/50 [&>svg]:size-3"
      >
        <SelectValue>{display}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value={NO_TECHNICIAN} className="text-muted-foreground">
          {noneLabel}
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          const cur = appointment.scheduled_at
            ? new Date(appointment.scheduled_at)
            : null;
          setDate(cur ? formatISODate(cur) : "");
          setTime(cur ? localTime(cur.toISOString()) : "09:00");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          title={t("reschedule")}
          aria-label={t("reschedule")}
          disabled={disabled}
        >
          <CalendarClock className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-2">
        <DatePicker value={date} onChange={setDate} placeholder={t("pickDate")} />
        <Input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={pending || !date} onClick={save}>
            {pending && <RefreshCw className="animate-spin" />}
            {t("save")}
          </Button>
        </div>
      </PopoverContent>
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

  return (
    <Popover
      open={open}
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
    >
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          title={t("complete")}
          aria-label={t("complete")}
          disabled={disabled}
        >
          <CheckCheck className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <CurrencyInput
          value={amount}
          onValueChange={setAmount}
          placeholder={t("totalAmount")}
          aria-label={t("totalAmount")}
        />
        <CurrencyInput
          value={collect}
          onValueChange={setCollect}
          placeholder={t("collectNow")}
          aria-label={t("collectNow")}
        />
        <ClearableSelect
          value={method}
          onValueChange={setMethod}
          options={PAYMENT_METHODS.map((m) => ({
            value: m,
            label: t(`method_${m}`),
          }))}
          placeholder={t("paymentMethod")}
          clearLabel={t("clear")}
          ariaLabel={t("paymentMethod")}
          className="w-full"
        />
        <ImageUpload
          value={imageUrl}
          onChange={setImageUrl}
          label={t("receiptImage")}
          className="w-24"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setOpen(false);
              const collectNum = collect === "" ? 0 : Number(collect);
              onComplete({
                total_amount: amount === "" ? null : Number(amount),
                payment_method: (method || null) as PaymentMethod | null,
                collect:
                  collectNum > 0
                    ? { amount: collectNum, image_url: imageUrl }
                    : undefined,
              });
            }}
          >
            {t("complete")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
