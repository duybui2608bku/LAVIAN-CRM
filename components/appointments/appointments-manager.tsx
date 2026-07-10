"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
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
  UserX,
} from "lucide-react";
import { addDays, addMonths, startOfWeek } from "date-fns";

import {
  deleteAppointment,
  rescheduleAppointment,
  setAppointmentStatus,
} from "@/app/(app)/appointments/actions";
import {
  dayTotal,
  localTime,
  matchesAppointmentFilters,
  sortForDayView,
} from "@/lib/appointments";
import { serviceName } from "@/lib/customers";
import { formatISODate, parseISODate } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  AppointmentDialog,
  type CustomerRef,
} from "@/components/appointments/appointment-dialog";
import { AppointmentsCalendar } from "@/components/appointments/appointments-calendar";
import { AppointmentStatusTag } from "@/components/appointments/status-tag";
import { ClearableSelect } from "@/components/common/clearable-select";
import { DatePicker } from "@/components/common/date-picker";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
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
  APPOINTMENT_STATUSES,
  PAYMENT_METHODS,
  type Appointment,
  type AppointmentStatus,
  type PaymentMethod,
} from "@/types/appointment";
import type { EnumOption } from "@/types/customer";
import type { Service } from "@/types/service";

export function AppointmentsManager({
  appointments,
  customers,
  staff,
  options,
  services,
}: {
  appointments: Appointment[];
  customers: CustomerRef[];
  staff: StaffRef[];
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
  const [staffId, setStaffId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [target, setTarget] = useState<Appointment | "new" | null>(null);
  const [deleting, setDeleting] = useState<Appointment | null>(null);

  const filtered = useMemo(
    () =>
      sortForDayView(
        appointments.filter((a) =>
          matchesAppointmentFilters(a, {
            waiting: tab === "waiting",
            day: tab === "day" ? day : undefined,
            search,
            status,
            staffId,
            serviceId,
          }),
        ),
      ),
    [appointments, tab, day, search, status, staffId, serviceId],
  );

  // Calendar: lọc search/staff/service, KHÔNG lọc ngày (lưới tự gom theo ngày).
  const calendarList = useMemo(
    () =>
      appointments.filter((a) =>
        matchesAppointmentFilters(a, { search, staffId, serviceId }),
      ),
    [appointments, search, staffId, serviceId],
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

  const fmt = (n: number) => n.toLocaleString(locale);
  const statusTag = (s: AppointmentStatus) => (
    <AppointmentStatusTag status={s} />
  );
  const staffDisplay = (id: string | null) => {
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
  const staffOptions = staff.map((s) => ({ value: s.id, label: staffLabel(s) }));
  const serviceOptions = services
    .filter((s) => s.is_active)
    .map((s) => ({ value: s.id, label: serviceName(s, locale) }));

  const changeStatus = (
    a: Appointment,
    next: AppointmentStatus,
    extra?: { final_amount?: number | null; payment_method?: PaymentMethod | null },
  ) =>
    start(async () => {
      const res = await setAppointmentStatus(a.id, next, extra);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("statusOk"));
      router.refresh();
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
      router.refresh();
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

  const completedCount = filtered.filter((a) => a.status === "completed").length;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Tab: Trong ngày / Chờ xếp lịch (thay sheet DP CUS) — chỉ ở view bảng;
          view calendar thay bằng segmented Tuần/Tháng + điều hướng. */}
      <div className="flex flex-wrap items-end gap-2">
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
            <span className="pb-1 text-sm font-medium">{calendarLabel}</span>
          </>
        )}
        <div className="relative w-full sm:max-w-[200px]">
          <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="h-8 pl-8"
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
          value={staffId}
          onValueChange={setStaffId}
          options={staffOptions}
          placeholder={t("allStaff")}
          clearLabel={t("clear")}
          ariaLabel={t("colStaff")}
        />
        <ClearableSelect
          value={serviceId}
          onValueChange={setServiceId}
          options={serviceOptions}
          placeholder={t("allServices")}
          clearLabel={t("clear")}
          ariaLabel={t("colServices")}
        />
      </div>

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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colTime")}</TableHead>
              <TableHead>{t("colCustomer")}</TableHead>
              <TableHead>{t("colServices")}</TableHead>
              <TableHead>{t("colStaff")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead className="text-right">{t("colExpected")}</TableHead>
              <TableHead className="text-right">{t("colDeposit")}</TableHead>
              <TableHead className="text-right">{t("colFinal")}</TableHead>
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
              filtered.map((a, i) => {
                const outstandingAmt = Math.max(
                  (a.final_amount ?? a.expected_amount ?? 0) - a.deposit_amount,
                  0,
                );
                return (
                  <Fragment key={a.id}>
                    {/* Row nhóm theo trạng thái — như cách sheet gom Sudah Datang / Booking */}
                    {(i === 0 || filtered[i - 1].status !== a.status) && (
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
                        <div className="font-medium">
                          {a.customer?.full_name ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.customer?.phone}
                        </div>
                      </TableCell>
                      <TableCell>{serviceBadges(a.service_ids)}</TableCell>
                      <TableCell>{staffDisplay(a.staff_id)}</TableCell>
                      <TableCell>{statusTag(a.status)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {a.expected_amount != null ? fmt(a.expected_amount) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.deposit_amount ? fmt(a.deposit_amount) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.final_amount != null ? fmt(a.final_amount) : "—"}
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
                        <Button
                          size="sm"
                          variant="ghost"
                          title={t("edit")}
                          aria-label={t("edit")}
                          disabled={pending}
                          onClick={() => setTarget(a)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title={t("delete")}
                          aria-label={t("delete")}
                          disabled={pending}
                          onClick={() => setDeleting(a)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      )}

      {/* Tổng doanh thu ngày — thay sheet REPORT thủ công */}
      {view === "table" && tab === "day" && (
        <p className="text-right text-sm text-muted-foreground">
          {t("dayTotal", {
            total: fmt(dayTotal(filtered)),
            count: completedCount,
          })}
        </p>
      )}

      <AppointmentDialog
        open={target !== null}
        editing={target && target !== "new" ? target : null}
        customers={customers}
        staff={staff}
        options={options}
        services={services}
        onClose={() => setTarget(null)}
        onDone={() => router.refresh()}
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
    </div>
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
  const router = useRouter();
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
      router.refresh();
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
            {pending ? t("saving") : t("save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Popover hoàn tất: nhập số chốt (Paid) + phương thức rồi chuyển completed. */
function CompletePopover({
  appointment,
  disabled,
  onComplete,
}: {
  appointment: Appointment;
  disabled?: boolean;
  onComplete: (extra: {
    final_amount: number | null;
    payment_method: PaymentMethod | null;
  }) => void;
}) {
  const t = useTranslations("appointments");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setAmount(
            (appointment.final_amount ?? appointment.expected_amount)?.toString() ??
              "",
          );
          setMethod(appointment.payment_method ?? "");
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
      <PopoverContent align="end" className="w-64 space-y-2">
        <Input
          type="number"
          min={0}
          placeholder={t("final")}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
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
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setOpen(false);
              onComplete({
                final_amount: amount === "" ? null : Number(amount),
                payment_method: (method || null) as PaymentMethod | null,
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
