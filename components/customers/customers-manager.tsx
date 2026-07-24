"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CalendarDays,
  CalendarPlus,
  ExternalLink,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Wallet,
} from "lucide-react";

import {
  staffLabel,
  UserAvatar,
  type StaffRef,
} from "@/components/common/user-avatar";
import {
  addCustomerNote,
  createCustomer,
  deleteCustomer,
  patchCustomer,
  updateCustomer,
} from "@/app/(app)/customers/actions";
import { formatRupiah } from "@/lib/currency";
import { matchesCustomerFilters, optionLabel, serviceName } from "@/lib/customers";
import {
  customerPayments,
  customerTotalPaid,
  outstanding,
  paidTotal,
} from "@/lib/appointments";
import { cn } from "@/lib/utils";
import { AppointmentDialog } from "@/components/appointments/appointment-dialog";
import { AppointmentStatusTag } from "@/components/appointments/status-tag";
import { PaymentLine } from "@/components/appointments/payments-dialog";
import {
  ClearableSelect,
  type SelectOption,
} from "@/components/common/clearable-select";
import { MultiSelect } from "@/components/common/multi-select";
import { DatePicker, DateRangePicker } from "@/components/common/date-picker";
import { EnumTag } from "@/components/common/enum-tag";
import { Badge } from "@/components/ui/badge";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Appointment } from "@/types/appointment";
import type {
  Customer,
  CustomerInput,
  EnumKind,
  EnumOption,
} from "@/types/customer";
import type { Service } from "@/types/service";

type Staff = StaffRef & { department?: string | null };

// Option theo bộ phận (Nhân viên = customer_care, Sales, Kỹ thuật viên):
// chỉ user đúng bộ phận + giá trị đang gán (user đổi bộ phận sau khi gán
// vẫn hiện — cùng triết lý option inactive).
const deptOptions = (staff: Staff[], dept: string, current?: string | null) =>
  staff
    .filter((s) => s.department === dept || s.id === current)
    .map((s) => ({ value: s.id, label: staffLabel(s) }));

// Class cho <textarea> ghi chú — khớp trông với <Input>.
const fieldCls =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const TAG_COLORS = [
  "#2563eb",
  "#0891b2",
  "#059669",
  "#65a30d",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#db2777",
  "#9333ea",
  "#7c3aed",
] as const;

const colorForTag = (index: number) => TAG_COLORS[index % TAG_COLORS.length];

export function CustomersManager({
  customers,
  appointments,
  staff,
  options,
  services,
}: {
  customers: Customer[];
  appointments: Appointment[];
  staff: Staff[];
  options: EnumOption[];
  services: Service[];
}) {
  const t = useTranslations("customers");
  const tAppt = useTranslations("appointments");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [staffId, setStaffId] = useState("");
  const [salesId, setSalesId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [target, setTarget] = useState<Customer | "new" | null>(null);
  const [historyFor, setHistoryFor] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [bookingFor, setBookingFor] = useState<Customer | null>(null);
  const [apptsFor, setApptsFor] = useState<Customer | null>(null);
  const [paymentsFor, setPaymentsFor] = useState<Customer | null>(null);

  const apptsOf = (customerId: string) =>
    appointments.filter((a) => a.customer_id === customerId);
  // Toàn bộ dòng tiền của khách (dedupe sổ chung) — cho dialog lịch sử thanh toán.
  const paymentsOf = (customerId: string) =>
    customerPayments(apptsOf(customerId));

  // Tag (theo locale) cho một value bất kỳ — dùng cả option inactive để hiện dữ
  // liệu cũ; value mất option hiển thị thô trong badge trung tính.
  const tagFor = (kind: EnumKind, value: string | null) => {
    if (!value) return <span className="text-muted-foreground">—</span>;
    const opt = options.find((o) => o.kind === kind && o.value === value);
    return (
      <EnumTag
        icon={opt?.icon}
        color={opt?.color}
        label={opt ? optionLabel(opt, locale) : value}
      />
    );
  };
  // Avatar + tên nhân viên cho cell bảng; chưa gán → "—" (không avatar).
  const staffDisplay = (id: string | null) => {
    const s = id ? staff.find((x) => x.id === id) : undefined;
    if (!s) return <span className="text-muted-foreground">—</span>;
    return staffLabel(s);
  };
  // Avatar người ghi note — note chỉ lưu tên snapshot nên tra theo user_name.
  const staffAvatarByName = (name: string | null | undefined) =>
    name ? staff.find((s) => s.user_name === name)?.avatar_url : undefined;

  const filtered = useMemo(
    () =>
      customers.filter((c) =>
        matchesCustomerFilters(c, {
          search,
          stage,
          source,
          staffId,
          salesId,
          technicianId,
          serviceId,
          from,
          to,
        }),
      ),
    [
      customers,
      search,
      stage,
      source,
      staffId,
      salesId,
      technicianId,
      serviceId,
      from,
      to,
    ],
  );

  // Badge tên dịch vụ đã gắn (theo locale, fallback vi); trống → "—".
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

  const confirmDelete = () => {
    const c = deleting;
    if (!c) return;
    setDeleting(null);
    start(async () => {
      const res = await deleteCustomer(c.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("deleteOk"));
      router.refresh();
    });
  };

  // Inline edit 1 trường từ bảng: lưu xong toast + refresh.
  const patchField = (
    id: string,
    patch: {
      stage?: string;
      source?: string | null;
      staff_id?: string | null;
      sales_id?: string | null;
      technician_id?: string | null;
      service_ids?: string[];
    },
  ) =>
    start(async () => {
      const res = await patchCustomer(id, patch);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("updateOk"));
      router.refresh();
    });

  // Option cho Select: active + giá trị hiện tại (kể cả inactive), theo sort_order.
  const kindOptions = (kind: EnumKind, current?: string | null) =>
    options
      .filter((o) => o.kind === kind && (o.is_active || o.value === current))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => ({ value: o.value, label: optionLabel(o, locale) }));
  // Bộ lọc dịch vụ: chỉ dịch vụ active (đồng nhất kindOptions không current).
  const serviceOptions = services
    .filter((s) => s.is_active)
    .map((s) => ({ value: s.id, label: serviceName(s, locale) }));
  // Option cho select gắn dịch vụ: active + dịch vụ đang gắn (kể cả inactive).
  const serviceSelectOptions = (current: string[]) =>
    services
      .filter((s) => s.is_active || current.includes(s.id))
      .map((s) => ({ value: s.id, label: serviceName(s, locale) }));

  const tagBadges = (tags: Customer["tags"]) => {
    if (!tags?.length) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="flex max-w-[220px] flex-wrap gap-1">
        {tags.map((tag, index) => {
          const key = tag.id ?? `${tag.name}-${index}`;
          const color = colorForTag(index);
          return (
            <Badge
              key={key}
              variant="outline"
              className="border"
              style={{
                borderColor: `${color}40`,
                backgroundColor: `${color}1a`,
                color,
              }}
            >
              {tag.name}
            </Badge>
          );
        })}
      </div>
    );
  };

  const editing = target && target !== "new" ? target : null;

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => start(() => router.refresh())}
            disabled={pending}
          >
            <RefreshCw className={cn("size-4", pending && "animate-spin")} />
            {t("reload")}
          </Button>
          <Button onClick={() => setTarget("new")}>
            <UserPlus className="size-4" />
            {t("create")}
          </Button>
        </div>
      </div>

      {/* Thanh lọc */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative w-full sm:max-w-[220px]">
          <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="h-8 pl-8"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ClearableSelect
          value={stage}
          onValueChange={setStage}
          options={kindOptions("stage")}
          placeholder={t("allStage")}
          clearLabel={t("clear")}
          ariaLabel={t("colStage")}
        />
        <ClearableSelect
          value={source}
          onValueChange={setSource}
          options={kindOptions("source")}
          placeholder={t("allSource")}
          clearLabel={t("clear")}
          ariaLabel={t("colSource")}
        />
        <ClearableSelect
          value={staffId}
          onValueChange={setStaffId}
          options={deptOptions(staff, "customer_care")}
          placeholder={t("allStaff")}
          clearLabel={t("clear")}
          ariaLabel={t("colStaff")}
        />
        <ClearableSelect
          value={salesId}
          onValueChange={setSalesId}
          options={deptOptions(staff, "sales")}
          placeholder={t("allSales")}
          clearLabel={t("clear")}
          ariaLabel={t("colSales")}
        />
        <ClearableSelect
          value={technicianId}
          onValueChange={setTechnicianId}
          options={deptOptions(staff, "technician")}
          placeholder={t("allTechnician")}
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
        <DateRangePicker
          from={from}
          to={to}
          onChange={(r) => {
            setFrom(r.from);
            setTo(r.to);
          }}
          placeholder={t("dateRange")}
          clearLabel={t("clearDate")}
          className="w-[240px]"
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colPhone")}</TableHead>
              <TableHead>{t("colTags")}</TableHead>
              <TableHead>{t("colStage")}</TableHead>
              <TableHead>{t("colSource")}</TableHead>
              <TableHead>{t("colServices")}</TableHead>
              <TableHead>{t("colStaff")}</TableHead>
              <TableHead>{t("colSales")}</TableHead>
              <TableHead>{t("colTechnician")}</TableHead>
              <TableHead>{t("colFirstContact")}</TableHead>
              <TableHead>{t("colCreated")}</TableHead>
              <TableHead>{t("colNotes")}</TableHead>
              <TableHead className="text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={13}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 truncate">{c.full_name}</span>
                      {c.thread?.link ? (
                        <a
                          href={c.thread.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
                          title={t("openThread")}
                          aria-label={t("openThread")}
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>{tagBadges(c.tags)}</TableCell>
                  <TableCell>
                    <InlineSelect
                      value={c.stage}
                      display={tagFor("stage", c.stage)}
                      options={kindOptions("stage", c.stage)}
                      ariaLabel={t("colStage")}
                      disabled={pending}
                      onSave={(v) => patchField(c.id, { stage: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineSelect
                      value={c.source ?? ""}
                      display={tagFor("source", c.source)}
                      options={kindOptions("source", c.source)}
                      noneLabel={t("noneOption")}
                      ariaLabel={t("colSource")}
                      disabled={pending}
                      onSave={(v) => patchField(c.id, { source: v || null })}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineServices
                      ids={c.service_ids}
                      options={serviceSelectOptions(c.service_ids)}
                      display={serviceBadges(c.service_ids)}
                      ariaLabel={t("colServices")}
                      disabled={pending}
                      onSave={(v) => patchField(c.id, { service_ids: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineSelect
                      value={c.staff_id ?? ""}
                      display={staffDisplay(c.staff_id)}
                      options={deptOptions(staff, "customer_care", c.staff_id)}
                      noneLabel={t("noneOption")}
                      ariaLabel={t("colStaff")}
                      disabled={pending}
                      onSave={(v) => patchField(c.id, { staff_id: v || null })}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineSelect
                      value={c.sales_id ?? ""}
                      display={staffDisplay(c.sales_id)}
                      options={deptOptions(staff, "sales", c.sales_id)}
                      noneLabel={t("noneOption")}
                      ariaLabel={t("colSales")}
                      disabled={pending}
                      onSave={(v) => patchField(c.id, { sales_id: v || null })}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineSelect
                      value={c.technician_id ?? ""}
                      display={staffDisplay(c.technician_id)}
                      options={deptOptions(staff, "technician", c.technician_id)}
                      noneLabel={t("noneOption")}
                      ariaLabel={t("colTechnician")}
                      disabled={pending}
                      onSave={(v) =>
                        patchField(c.id, { technician_id: v || null })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.first_contact
                      ? new Date(c.first_contact).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <QuickNote customerId={c.id} />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="relative"
                      title={t("viewNotes")}
                      aria-label={t("viewNotes")}
                      disabled={!c.notes?.length}
                      onClick={() => setHistoryFor(c)}
                    >
                      <Info className="size-4" />
                      {c.notes?.length ? (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                          {c.notes.length > 9 ? "9+" : c.notes.length}
                        </span>
                      ) : null}
                    </Button>
                  </TableCell>
                  <TableCell className="space-x-1 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      title={tAppt("book")}
                      aria-label={tAppt("book")}
                      disabled={pending}
                      onClick={() => setBookingFor(c)}
                    >
                      <CalendarPlus className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="relative"
                      title={tAppt("historyTitle", { name: c.full_name })}
                      aria-label={tAppt("historyTitle", { name: c.full_name })}
                      disabled={apptsOf(c.id).length === 0}
                      onClick={() => setApptsFor(c)}
                    >
                      <CalendarDays className="size-4" />
                      {apptsOf(c.id).length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                          {apptsOf(c.id).length > 9 ? "9+" : apptsOf(c.id).length}
                        </span>
                      )}
                    </Button>
                    <Button
                      className="relative"
                      size="sm"
                      variant="ghost"
                      title={tAppt("paymentsTitle", { name: c.full_name })}
                      aria-label={tAppt("paymentsTitle", { name: c.full_name })}
                      disabled={paymentsOf(c.id).length === 0}
                      onClick={() => setPaymentsFor(c)}
                    >
                      <Wallet className="size-4" />
                      {paymentsOf(c.id).length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                          {paymentsOf(c.id).length > 9
                            ? "9+"
                            : paymentsOf(c.id).length}
                        </span>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={t("edit")}
                      aria-label={t("edit")}
                      disabled={pending}
                      onClick={() => setTarget(c)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={t("delete")}
                      aria-label={t("delete")}
                      disabled={pending}
                      onClick={() => setDeleting(c)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CustomerDialog
        open={target !== null}
        editing={editing}
        staff={staff}
        options={options}
        services={services}
        onClose={() => setTarget(null)}
        onDone={() => router.refresh()}
      />

      {/* Đặt lịch hẹn cho 1 khách (khách bị khóa cứng trong dialog) */}
      <AppointmentDialog
        open={bookingFor !== null}
        editing={null}
        customerLock={bookingFor}
        customers={[]}
        staff={staff}
        options={options}
        services={services}
        appointments={appointments}
        returningIds={new Set(appointments.map((a) => a.customer_id))}
        onClose={() => setBookingFor(null)}
        onDone={() => router.refresh()}
      />

      {/* Lịch sử lịch hẹn của 1 khách — mới nhất trước (page đã order desc) */}
      <Dialog
        open={apptsFor !== null}
        onOpenChange={(o) => !o && setApptsFor(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {tAppt("historyTitle", { name: apptsFor?.full_name ?? "" })}
            </DialogTitle>
          </DialogHeader>
          <ul className="max-h-[60vh] space-y-3 overflow-y-auto">
            {apptsFor && apptsOf(apptsFor.id).length === 0 && (
              <li className="text-sm text-muted-foreground">
                {tAppt("historyEmpty")}
              </li>
            )}
            {(apptsFor ? apptsOf(apptsFor.id) : []).map((a) => (
              <li key={a.id} className="space-y-1 rounded-md border px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium tabular-nums">
                    {a.scheduled_at ? (
                      new Date(a.scheduled_at).toLocaleString(locale)
                    ) : (
                      <span className="text-muted-foreground">
                        {tAppt("tabWaiting")}
                      </span>
                    )}
                  </span>
                  <AppointmentStatusTag status={a.status} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {serviceBadges(a.service_ids)}
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {tAppt("colTotal")}:{" "}
                  {a.ledger?.total_amount != null
                    ? formatRupiah(a.ledger.total_amount)
                    : "—"}
                  {" · "}
                  {tAppt("colPaid")}: {formatRupiah(paidTotal(a))}
                  {outstanding(a) > 0 && (
                    <span className="text-destructive">
                      {" · "}
                      {tAppt("colOutstanding")}:{" "}
                      {formatRupiah(outstanding(a))}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
          {/* Tổng đã trả của khách = Σ theo SỔ (dedupe — nhiều lịch chung sổ
              không cộng trùng) + dòng mồ côi của lịch không sổ */}
          {apptsFor && apptsOf(apptsFor.id).length > 0 && (
            <p className="border-t pt-2 text-right text-sm tabular-nums">
              {tAppt("totalPaid")}:{" "}
              <span className="font-medium">
                {formatRupiah(customerTotalPaid(apptsOf(apptsFor.id)))}
              </span>
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Lịch sử thanh toán của 1 khách — mọi dòng tiền qua các sổ (dedupe sổ
          chung) + dòng của lịch không sổ, mới nhất trước. Chỉ xem — thu/hoàn
          thao tác ở /appointments (dialog Thanh toán theo sổ). */}
      <Dialog
        open={paymentsFor !== null}
        onOpenChange={(o) => !o && setPaymentsFor(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {tAppt("paymentsTitle", { name: paymentsFor?.full_name ?? "" })}
            </DialogTitle>
          </DialogHeader>
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {paymentsFor && paymentsOf(paymentsFor.id).length === 0 && (
              <li className="text-sm text-muted-foreground">
                {tAppt("paymentsEmpty")}
              </li>
            )}
            {(paymentsFor ? paymentsOf(paymentsFor.id) : []).map(
              ({ payment, service_id }) => {
                const s = service_id
                  ? services.find((x) => x.id === service_id)
                  : undefined;
                return (
                  <PaymentLine
                    key={payment.id}
                    payment={payment}
                    staff={staff}
                    serviceLabel={s ? serviceName(s, locale) : null}
                  />
                );
              },
            )}
          </ul>
          {paymentsFor && paymentsOf(paymentsFor.id).length > 0 && (
            <p className="border-t pt-2 text-right text-sm tabular-nums">
              {tAppt("totalPaid")}:{" "}
              <span className="font-medium">
                {formatRupiah(customerTotalPaid(apptsOf(paymentsFor.id)))}
              </span>
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Popconfirm xóa (AlertDialog dùng chung cho mọi dòng) */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmBody", { name: deleting?.full_name ?? "" })}
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

      {/* Lịch sử ghi chú (icon Info) — mới nhất trước */}
      <Dialog
        open={historyFor !== null}
        onOpenChange={(o) => !o && setHistoryFor(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("noteHistoryTitle", { name: historyFor?.full_name ?? "" })}
            </DialogTitle>
          </DialogHeader>
          <ul className="max-h-[60vh] space-y-3 overflow-y-auto">
            {[...(historyFor?.notes ?? [])].reverse().map((n, i) => (
              <li key={i} className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">
                    {new Date(n.at).toLocaleString()}
                  </span>
                  {n.by ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <UserAvatar src={staffAvatarByName(n.by)} />
                      {n.by}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <p className="rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm whitespace-pre-wrap">
                  {n.text}
                </p>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Nút Plus + Popover thêm ghi chú nhanh cho 1 khách. */
function QuickNote({ customerId }: { customerId: string }) {
  const t = useTranslations("customers");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await addCustomerNote(customerId, text);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("noteOk"));
      setText("");
      setOpen(false);
      router.refresh();
    });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          title={t("addNote")}
          aria-label={t("addNote")}
        >
          <Plus className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <textarea
          className={fieldCls + " h-auto min-h-16 resize-y py-1.5"}
          rows={3}
          autoFocus
          placeholder={t("addNotePlaceholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={pending || !text.trim()} onClick={save}>
            {pending && <RefreshCw className="animate-spin" />}
            {t("save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const NONE = "__none";

/** Select inline trong ô bảng: trigger là chính giá trị đang hiển thị (tag/tên). */
function InlineSelect({
  value,
  display,
  options,
  noneLabel,
  ariaLabel,
  disabled,
  onSave,
}: {
  value: string; // "" = chưa chọn
  display: React.ReactNode;
  options: { value: string; label: React.ReactNode }[];
  noneLabel?: string; // có = cho phép bỏ chọn
  ariaLabel: string;
  disabled?: boolean;
  onSave: (value: string) => void;
}) {
  return (
    <Select
      value={value || NONE}
      onValueChange={(v) => {
        const next = v === NONE ? "" : v;
        if (next !== value) onSave(next);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="-m-1 rounded-md border-none bg-transparent p-1 hover:bg-accent/50 data-[size=default]:h-auto dark:bg-transparent dark:hover:bg-accent/50 [&>svg]:size-3"
      >
        {/* item-aligned của Radix cần node SelectValue trong trigger để đo vị trí. */}
        <SelectValue>{display}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper">
        {noneLabel && (
          <SelectItem value={NONE} className="text-muted-foreground">
            {noneLabel}
          </SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Multi-select inline trong ô bảng: gom thay đổi, lưu 1 lần khi đóng popover. */
function InlineServices({
  ids,
  options,
  display,
  ariaLabel,
  disabled,
  onSave,
}: {
  ids: string[];
  options: SelectOption[];
  display: React.ReactNode;
  ariaLabel: string;
  disabled?: boolean;
  onSave: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[] | null>(null); // null = đang đóng
  return (
    <MultiSelect
      value={draft ?? ids}
      onValueChange={setDraft}
      onOpenChange={(open) => {
        if (open) {
          setDraft(ids);
          return;
        }
        // So như tập hợp (toggle có thể đổi thứ tự) — chỉ lưu khi thật sự đổi.
        if (
          draft &&
          (draft.length !== ids.length || draft.some((d) => !ids.includes(d)))
        ) {
          onSave(draft);
        }
        setDraft(null);
      }}
      options={options}
      ariaLabel={ariaLabel}
      disabled={disabled}
      className="-m-1 min-h-0 w-auto rounded-md border-none bg-transparent p-1 hover:bg-accent/50 dark:bg-transparent dark:hover:bg-accent/50 [&>svg]:size-3"
    >
      {display}
    </MultiSelect>
  );
}

const schema = z.object({
  full_name: z.string().min(1),
  phone: z.string().min(1),
  social_name: z.string().optional(),
  stage: z.string().min(1),
  source: z.string().optional(),
  staff_id: z.string().optional(),
  sales_id: z.string().optional(),
  technician_id: z.string().optional(),
  lost_reason: z.string().optional(),
  first_contact: z.string().optional(),
  service_ids: z.array(z.string()).optional(),
});
type Values = z.infer<typeof schema>;

function CustomerDialog({
  open,
  editing,
  staff,
  options,
  services,
  onClose,
  onDone,
}: {
  open: boolean;
  editing: Customer | null;
  staff: Staff[];
  options: EnumOption[];
  services: Service[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("customers");
  const locale = useLocale();
  const [pending, start] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    // values (deep-compare) tự nạp lại khi mở khách khác; typing không bị reset.
    values: {
      full_name: editing?.full_name ?? "",
      phone: editing?.phone ?? "",
      social_name: editing?.social_name ?? "",
      stage: editing?.stage ?? "new_lead",
      source: editing?.source ?? "",
      staff_id: editing?.staff_id ?? "",
      sales_id: editing?.sales_id ?? "",
      technician_id: editing?.technician_id ?? "",
      lost_reason: editing?.lost_reason ?? "",
      first_contact: editing?.first_contact
        ? editing.first_contact.slice(0, 10)
        : "",
      service_ids: editing?.service_ids ?? [],
    },
  });

  const stage = watch("stage");

  // Option cho Select trong form: active + giá trị hiện tại (kể cả inactive).
  const selectOptions = (kind: EnumKind, current?: string | null) =>
    options
      .filter(
        (o) => o.kind === kind && (o.is_active || o.value === current),
      )
      .sort((a, b) => a.sort_order - b.sort_order);

  // Option dịch vụ: active + dịch vụ khách đang gắn (kể cả inactive, để bỏ được).
  const serviceOpts: SelectOption[] = services
    .filter((s) => s.is_active || editing?.service_ids.includes(s.id))
    .map((s) => ({ value: s.id, label: serviceName(s, locale) }));

  const onSubmit = (v: Values) =>
    start(async () => {
      const input: CustomerInput = {
        full_name: v.full_name,
        phone: v.phone,
        social_name: v.social_name || null,
        source: v.source || null,
        stage: v.stage,
        lost_reason: v.lost_reason || null,
        staff_id: v.staff_id || null,
        sales_id: v.sales_id || null,
        technician_id: v.technician_id || null,
        first_contact: v.first_contact || null,
        service_ids: v.service_ids ?? [],
      };
      const res = editing
        ? await updateCustomer(editing.id, input)
        : await createCustomer(input);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? t("updateOk") : t("createOk"));
      reset();
      onClose();
      onDone();
    });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{editing ? t("editTitle") : t("createTitle")}</SheetTitle>
        </SheetHeader>
        {/* Footer nằm ngoài form (nút submit nối qua form id) — thân cuộn, footer dính đáy */}
        <form
          id="customer-form"
          onSubmit={handleSubmit(onSubmit)}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4"
        >
          <div className="grid gap-3">
            <Field label={t("colName")} error={errors.full_name && t("required")}>
              <Input {...register("full_name")} />
            </Field>
            <Field label={t("colPhone")} error={errors.phone && t("required")}>
              <Input {...register("phone")} />
            </Field>
          </div>

          <Field label={t("socialName")}>
            <Input {...register("social_name")} />
          </Field>

          <div className="grid gap-3">
            <Field label={t("colStage")}>
              <Controller
                control={control}
                name="stage"
                render={({ field }) => (
                  <ClearableSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    clearable={false}
                    options={selectOptions("stage", editing?.stage).map((o) => ({
                      value: o.value,
                      label: optionLabel(o, locale),
                    }))}
                    ariaLabel={t("colStage")}
                  />
                )}
              />
            </Field>
            <Field label={t("colSource")}>
              <Controller
                control={control}
                name="source"
                render={({ field }) => (
                  <ClearableSelect
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    options={selectOptions("source", editing?.source).map((o) => ({
                      value: o.value,
                      label: optionLabel(o, locale),
                    }))}
                    placeholder={t("noneOption")}
                    clearLabel={t("clear")}
                    ariaLabel={t("colSource")}
                  />
                )}
              />
            </Field>
          </div>

          {stage === "lost" && (
            <Field label={t("colLostReason")}>
              <Controller
                control={control}
                name="lost_reason"
                render={({ field }) => (
                  <ClearableSelect
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    options={selectOptions("lost_reason", editing?.lost_reason).map(
                      (o) => ({ value: o.value, label: optionLabel(o, locale) }),
                    )}
                    placeholder={t("noneOption")}
                    clearLabel={t("clear")}
                    ariaLabel={t("colLostReason")}
                  />
                )}
              />
            </Field>
          )}

          <div className="grid gap-3">
            <Field label={t("colStaff")}>
              <Controller
                control={control}
                name="staff_id"
                render={({ field }) => (
                  <ClearableSelect
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    options={deptOptions(
                      staff,
                      "customer_care",
                      editing?.staff_id,
                    )}
                    placeholder={t("noneOption")}
                    clearLabel={t("clear")}
                    ariaLabel={t("colStaff")}
                  />
                )}
              />
            </Field>
            <Field label={t("colSales")}>
              <Controller
                control={control}
                name="sales_id"
                render={({ field }) => (
                  <ClearableSelect
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    options={deptOptions(staff, "sales", editing?.sales_id)}
                    placeholder={t("noneOption")}
                    clearLabel={t("clear")}
                    ariaLabel={t("colSales")}
                  />
                )}
              />
            </Field>
            <Field label={t("colTechnician")}>
              <Controller
                control={control}
                name="technician_id"
                render={({ field }) => (
                  <ClearableSelect
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    options={deptOptions(
                      staff,
                      "technician",
                      editing?.technician_id,
                    )}
                    placeholder={t("noneOption")}
                    clearLabel={t("clear")}
                    ariaLabel={t("colTechnician")}
                  />
                )}
              />
            </Field>
            <Field label={t("colFirstContact")}>
              <Controller
                control={control}
                name="first_contact"
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t("pickDate")}
                  />
                )}
              />
            </Field>
          </div>

          {serviceOpts.length > 0 && (
            <Field label={t("colServices")}>
              <Controller
                control={control}
                name="service_ids"
                render={({ field }) => (
                  <MultiSelect
                    value={field.value ?? []}
                    onValueChange={field.onChange}
                    options={serviceOpts}
                    placeholder={t("pickServices")}
                    ariaLabel={t("colServices")}
                  />
                )}
              />
            </Field>
          )}

        </form>
        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="customer-form" disabled={pending}>
            {pending && <RefreshCw className="animate-spin" />}
            {editing ? t("save") : t("createSubmit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | false;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
