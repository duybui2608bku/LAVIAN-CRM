"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Table,
  Tag,
  Tooltip,
  type TableProps,
} from "antd";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarDays,
  CalendarPlus,
  Info,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Wallet,
} from "lucide-react";

import {
  addCustomerNote,
  createCustomer,
  deleteCustomer,
  patchCustomer,
  updateCustomer,
} from "@/app/(app)/customers/actions";
import { AppointmentDialog } from "@/components/appointments/appointment-dialog";
import { PaymentLine } from "@/components/appointments/payments-dialog";
import { AppointmentStatusTag } from "@/components/appointments/status-tag";
import { ClearableSelect, type SelectOption } from "@/components/common/clearable-select";
import { useConfirm } from "@/components/common/confirm-action";
import { DatePicker, DateRangePicker } from "@/components/common/date-picker";
import { EnumTag } from "@/components/common/enum-tag";
import { InlineMultiSelect, InlineSelect } from "@/components/common/inline-select";
import { MultiSelect } from "@/components/common/multi-select";
import { RowActions } from "@/components/common/row-actions";
import { staffLabel, UserAvatar, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import {
  customerPayments,
  customerTotalPaid,
  outstanding,
  paidTotal,
} from "@/lib/appointments";
import { formatRupiah } from "@/lib/currency";
import { matchesCustomerFilters, optionLabel, serviceName } from "@/lib/customers";
import { toast } from "@/lib/toast";
import type { Appointment } from "@/types/appointment";
import type { Customer, CustomerInput, EnumKind, EnumOption } from "@/types/customer";
import type { Service } from "@/types/service";

type Staff = StaffRef & { department?: string | null };

// Option theo bộ phận (Nhân viên = customer_care, Sales, Kỹ thuật viên):
// chỉ user đúng bộ phận + giá trị đang gán (user đổi bộ phận sau khi gán
// vẫn hiện — cùng triết lý option inactive).
const deptOptions = (staff: Staff[], dept: string, current?: string | null) =>
  staff
    .filter((s) => s.department === dept || s.id === current)
    .map((s) => ({ value: s.id, label: staffLabel(s) }));

// ponytail: phân trang client (data đã tải sẵn); đổi sang server-side
// nếu danh sách vượt vài nghìn dòng.
const PAGE_SIZE = 20;

const DASH = <span className="text-muted-foreground">—</span>;

type Filters = {
  search: string;
  stage: string;
  source: string;
  staffId: string;
  salesId: string;
  technicianId: string;
  serviceId: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  stage: "",
  source: "",
  staffId: "",
  salesId: "",
  technicianId: "",
  serviceId: "",
  from: "",
  to: "",
};

type Patch = {
  stage?: string;
  source?: string | null;
  staff_id?: string | null;
  sales_id?: string | null;
  technician_id?: string | null;
  service_ids?: string[];
};

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
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const [target, setTarget] = useState<Customer | "new" | null>(null);
  // Lưu id (không giữ object) để modal ghi chú tự nhận note mới sau revalidate.
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [bookingFor, setBookingFor] = useState<Customer | null>(null);
  const [apptsFor, setApptsFor] = useState<Customer | null>(null);
  const [paymentsFor, setPaymentsFor] = useState<Customer | null>(null);
  const [page, setPage] = useState(1);

  // Sửa inline hiện ngay, không chờ server. React tự trả về dữ liệu server khi
  // transition kết thúc — action lỗi thì ô tự quay lại giá trị cũ.
  const [rowsData, patchOptimistic] = useOptimistic(
    customers,
    (state: Customer[], patch: Patch & { id: string }) =>
      state.map((c) => (c.id === patch.id ? { ...c, ...patch } : c)),
  );

  const apptsOf = (customerId: string) =>
    appointments.filter((a) => a.customer_id === customerId);
  // Toàn bộ dòng tiền của khách (dedupe sổ chung) — cho dialog lịch sử thanh toán.
  const paymentsOf = (customerId: string) => customerPayments(apptsOf(customerId));

  // Tag (theo locale) cho một value bất kỳ — dùng cả option inactive để hiện dữ
  // liệu cũ; value mất option hiển thị thô trong tag trung tính.
  const tagFor = (kind: EnumKind, value: string | null) => {
    if (!value) return DASH;
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
    return s ? staffLabel(s) : DASH;
  };
  // Avatar người ghi note — note chỉ lưu tên snapshot nên tra theo user_name.
  const staffAvatarByName = (name: string | null | undefined) =>
    name ? staff.find((s) => s.user_name === name)?.avatar_url : undefined;

  const filtered = useMemo(
    () => rowsData.filter((c) => matchesCustomerFilters(c, filters)),
    [rowsData, filters],
  );

  // Lọc đổi → về trang 1. Điều chỉnh ngay trong render (không effect).
  const [seenFilters, setSeenFilters] = useState(filters);
  if (seenFilters !== filters) {
    setSeenFilters(filters);
    setPage(1);
  }

  // Tag tên dịch vụ đã gắn (theo locale, fallback vi); trống → "—".
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

  const askDelete = (c: Customer) =>
    confirm({
      title: t("deleteConfirm"),
      content: t("deleteConfirmBody", { name: c.full_name }),
      okText: t("delete"),
      cancelText: t("cancel"),
      onOk: async () => {
        const res = await deleteCustomer(c.id);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(t("deleteOk"));
      },
    });

  // Inline edit 1 trường từ bảng.
  const patchField = (id: string, patch: Patch) =>
    start(async () => {
      patchOptimistic({ id, ...patch });
      const res = await patchCustomer(id, patch);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("updateOk"));
    });

  // Option cho Select: active + giá trị hiện tại (kể cả inactive), theo sort_order.
  const kindOptions = (kind: EnumKind, current?: string | null): SelectOption[] =>
    options
      .filter((o) => o.kind === kind && (o.is_active || o.value === current))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => ({ value: o.value, label: optionLabel(o, locale) }));
  // Option dạng tag (icon + màu) cho select sửa nhanh trên bảng — khớp ô hiển thị.
  const tagOptions = (kind: EnumKind, current?: string | null): SelectOption[] =>
    kindOptions(kind, current).map((o) => ({ value: o.value, label: tagFor(kind, o.value) }));
  // Option dịch vụ: active + dịch vụ đang gắn (kể cả inactive, để bỏ được).
  const serviceOptions = (current: string[] = []): SelectOption[] =>
    services
      .filter((s) => s.is_active || current.includes(s.id))
      .map((s) => ({ value: s.id, label: serviceName(s, locale) }));

  const columns: TableProps<Customer>["columns"] = [
    {
      title: t("colCreated"),
      dataIndex: "created_at",
      render: (v: string) => (
        <span className="text-muted-foreground">{new Date(v).toLocaleDateString()}</span>
      ),
    },
    {
      title: t("colName"),
      dataIndex: "full_name",
      render: (_, c) =>
        // Có hội thoại SMAX → tên chính là link mở hội thoại.
        c.thread?.link ? (
          <a
            href={c.thread.link}
            target="_blank"
            rel="noreferrer"
            title={t("openThread")}
            className="font-medium"
          >
            {c.full_name}
          </a>
        ) : (
          <span className="font-medium">{c.full_name}</span>
        ),
    },
    { title: t("colPhone"), dataIndex: "phone" },
    {
      title: t("colStage"),
      dataIndex: "stage",
      render: (_, c) => (
        <InlineSelect
          value={c.stage}
          display={tagFor("stage", c.stage)}
          options={tagOptions("stage", c.stage)}
          ariaLabel={t("colStage")}
          onSave={(v) => patchField(c.id, { stage: v })}
        />
      ),
    },
    {
      title: t("colSource"),
      dataIndex: "source",
      render: (_, c) => (
        <InlineSelect
          value={c.source ?? ""}
          display={tagFor("source", c.source)}
          options={tagOptions("source", c.source)}
          noneLabel={t("noneOption")}
          ariaLabel={t("colSource")}
          onSave={(v) => patchField(c.id, { source: v || null })}
        />
      ),
    },
    {
      title: t("colServices"),
      dataIndex: "service_ids",
      render: (_, c) => (
        <InlineMultiSelect
          value={c.service_ids}
          options={serviceOptions(c.service_ids)}
          display={serviceTags(c.service_ids)}
          ariaLabel={t("colServices")}
          onSave={(v) => patchField(c.id, { service_ids: v })}
        />
      ),
    },
    ...(
      [
        ["staff_id", "colStaff", "customer_care"],
        ["sales_id", "colSales", "sales"],
        ["technician_id", "colTechnician", "technician"],
      ] as const
    ).map(([field, label, dept]) => ({
      title: t(label),
      key: field,
      render: (_: unknown, c: Customer) => (
        <InlineSelect
          value={c[field] ?? ""}
          display={staffDisplay(c[field])}
          options={deptOptions(staff, dept, c[field])}
          noneLabel={t("noneOption")}
          ariaLabel={t(label)}
          onSave={(v) => patchField(c.id, { [field]: v || null })}
        />
      ),
    })),
    {
      title: t("colNotes"),
      key: "notes",
      align: "center",
      render: (_, c) => {
        const last = c.notes?.at(-1);
        return (
          // Hover: xem ghi chú gần nhất; bấm: lịch sử + thêm ghi chú.
          <Tooltip
            title={last ? <NotePreview note={last} /> : t("addNote")}
            placement="left"
          >
            <Badge
              count={c.notes?.length ?? 0}
              size="small"
              overflowCount={9}
              color="var(--primary)"
            >
              <Button
                type="text"
                size="small"
                aria-label={t("viewNotes")}
                icon={<Info className="size-4" />}
                onClick={() => setNotesFor(c.id)}
              />
            </Badge>
          </Tooltip>
        );
      },
    },
    {
      title: t("colActions"),
      key: "actions",
      align: "right",
      fixed: "right",
      render: (_, c) => (
        <RowActions
          label={t("colActions")}
          items={[
            {
              icon: <CalendarPlus className="size-4" />,
              label: tAppt("book"),
              onSelect: () => setBookingFor(c),
            },
            {
              icon: <CalendarDays className="size-4" />,
              label: tAppt("title"),
              count: apptsOf(c.id).length,
              disabled: apptsOf(c.id).length === 0,
              onSelect: () => setApptsFor(c),
            },
            {
              icon: <Wallet className="size-4" />,
              label: tAppt("payments"),
              count: paymentsOf(c.id).length,
              disabled: paymentsOf(c.id).length === 0,
              onSelect: () => setPaymentsFor(c),
            },
            {
              icon: <Pencil className="size-4" />,
              label: t("edit"),
              onSelect: () => setTarget(c),
            },
            {
              icon: <Trash2 className="size-4" />,
              label: t("delete"),
              danger: true,
              onSelect: () => askDelete(c),
            },
          ]}
        />
      ),
    },
  ];

  const editing = target && target !== "new" ? target : null;
  const apptList = apptsFor ? apptsOf(apptsFor.id) : [];
  const paymentList = paymentsFor ? paymentsOf(paymentsFor.id) : [];

  return (
    <Page>
      <PageHeader
        title={t("title")}
        actions={
          <>
            <Button
              icon={<RefreshCw className="size-4" />}
              loading={pending}
              onClick={() => start(() => router.refresh())}
            >
              {t("reload")}
            </Button>
            <Button
              type="primary"
              icon={<UserPlus className="size-4" />}
              onClick={() => setTarget("new")}
            >
              {t("create")}
            </Button>
          </>
        }
      />

      {/* Thanh lọc */}
      <PageToolbar>
        <Input
          allowClear
          className="w-full sm:max-w-56"
          prefix={<Search className="size-4 text-muted-foreground" />}
          placeholder={t("searchPlaceholder")}
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
        />
        <ClearableSelect
          className="min-w-36"
          value={filters.stage}
          onChange={(v) => setFilter("stage", v)}
          options={kindOptions("stage")}
          placeholder={t("allStage")}
          ariaLabel={t("colStage")}
        />
        <ClearableSelect
          className="min-w-36"
          value={filters.source}
          onChange={(v) => setFilter("source", v)}
          options={kindOptions("source")}
          placeholder={t("allSource")}
          ariaLabel={t("colSource")}
        />
        <ClearableSelect
          className="min-w-36"
          value={filters.staffId}
          onChange={(v) => setFilter("staffId", v)}
          options={deptOptions(staff, "customer_care")}
          placeholder={t("allStaff")}
          ariaLabel={t("colStaff")}
        />
        <ClearableSelect
          className="min-w-36"
          value={filters.salesId}
          onChange={(v) => setFilter("salesId", v)}
          options={deptOptions(staff, "sales")}
          placeholder={t("allSales")}
          ariaLabel={t("colSales")}
        />
        <ClearableSelect
          className="min-w-36"
          value={filters.technicianId}
          onChange={(v) => setFilter("technicianId", v)}
          options={deptOptions(staff, "technician")}
          placeholder={t("allTechnician")}
          ariaLabel={t("colTechnician")}
        />
        <ClearableSelect
          className="min-w-36"
          value={filters.serviceId}
          onChange={(v) => setFilter("serviceId", v)}
          options={serviceOptions()}
          placeholder={t("allServices")}
          ariaLabel={t("colServices")}
        />
        <DateRangePicker
          from={filters.from}
          to={filters.to}
          onChange={(r) => setFilters((f) => ({ ...f, ...r }))}
        />
      </PageToolbar>

      <Table
        className="surface overflow-hidden"
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={filtered}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: t("empty") }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          onChange: setPage,
          showSizeChanger: false,
          hideOnSinglePage: false,
          showTotal: (total, [from, to]) => t("pageInfo", { from, to, total }),
        }}
      />

      <CustomerDialog
        open={target !== null}
        editing={editing}
        staff={staff}
        options={options}
        services={services}
        onClose={() => setTarget(null)}
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
      />

      {/* Lịch sử lịch hẹn của 1 khách — mới nhất trước (page đã order desc) */}
      <Modal
        open={apptsFor !== null}
        onCancel={() => setApptsFor(null)}
        footer={null}
        title={tAppt("historyTitle", { name: apptsFor?.full_name ?? "" })}
      >
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
          {apptList.length === 0 && (
            <li className="text-sm text-muted-foreground">{tAppt("historyEmpty")}</li>
          )}
          {apptList.map((a) => (
            <li key={a.id} className="surface space-y-1 px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium tabular-nums">
                  {a.scheduled_at ? (
                    new Date(a.scheduled_at).toLocaleString(locale)
                  ) : (
                    <span className="text-muted-foreground">{tAppt("tabWaiting")}</span>
                  )}
                </span>
                <AppointmentStatusTag status={a.status} />
              </div>
              <div>{serviceTags(a.service_ids)}</div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {tAppt("colTotal")}:{" "}
                {a.ledger?.total_amount != null ? formatRupiah(a.ledger.total_amount) : "—"}
                {" · "}
                {tAppt("colPaid")}: {formatRupiah(paidTotal(a))}
                {outstanding(a) > 0 && (
                  <span className="text-destructive">
                    {" · "}
                    {tAppt("colOutstanding")}: {formatRupiah(outstanding(a))}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
        {/* Tổng đã trả của khách = Σ theo SỔ (dedupe — nhiều lịch chung sổ
            không cộng trùng) + dòng mồ côi của lịch không sổ */}
        {apptList.length > 0 && (
          <TotalPaid label={tAppt("totalPaid")} value={customerTotalPaid(apptList)} />
        )}
      </Modal>

      {/* Lịch sử thanh toán của 1 khách — mọi dòng tiền qua các sổ (dedupe sổ
          chung) + dòng của lịch không sổ, mới nhất trước. Chỉ xem — thu/hoàn
          thao tác ở /appointments (dialog Thanh toán theo sổ). */}
      <Modal
        open={paymentsFor !== null}
        onCancel={() => setPaymentsFor(null)}
        footer={null}
        title={tAppt("paymentsTitle", { name: paymentsFor?.full_name ?? "" })}
      >
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
          {paymentList.length === 0 && (
            <li className="text-sm text-muted-foreground">{tAppt("paymentsEmpty")}</li>
          )}
          {paymentList.map(({ payment, service_id }) => {
            const s = service_id ? services.find((x) => x.id === service_id) : undefined;
            return (
              <PaymentLine
                key={payment.id}
                payment={payment}
                staff={staff}
                serviceLabel={s ? serviceName(s, locale) : null}
              />
            );
          })}
        </ul>
        {paymentsFor && paymentList.length > 0 && (
          <TotalPaid
            label={tAppt("totalPaid")}
            value={customerTotalPaid(apptsOf(paymentsFor.id))}
          />
        )}
      </Modal>

      {/* Ghi chú (icon Info): lịch sử mới nhất trước + ô thêm ghi chú */}
      <NotesModal
        customer={rowsData.find((c) => c.id === notesFor) ?? null}
        avatarOf={staffAvatarByName}
        onClose={() => setNotesFor(null)}
      />
    </Page>
  );
}

function TotalPaid({ label, value }: { label: string; value: number }) {
  return (
    <p className="mt-3 border-t border-border pt-2 text-right text-sm tabular-nums">
      {label}: <span className="font-medium">{formatRupiah(value)}</span>
    </p>
  );
}

/** Nội dung tooltip: ghi chú gần nhất (người ghi · thời gian + nội dung). */
function NotePreview({ note }: { note: Customer["notes"][number] }) {
  return (
    <div className="max-w-64 space-y-0.5">
      <p className="text-xs opacity-70">
        {note.by ? `${note.by} · ` : ""}
        {new Date(note.at).toLocaleString()}
      </p>
      <p className="line-clamp-4 whitespace-pre-wrap">{note.text}</p>
    </div>
  );
}

/** Modal ghi chú của 1 khách: thêm ghi chú mới ở trên, lịch sử bên dưới. */
function NotesModal({
  customer,
  avatarOf,
  onClose,
}: {
  customer: Customer | null;
  avatarOf: (name: string | null | undefined) => string | null | undefined;
  onClose: () => void;
}) {
  const t = useTranslations("customers");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      if (!customer) return;
      const res = await addCustomerNote(customer.id, text);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("noteOk"));
      setText("");
    });

  const close = () => {
    setText("");
    onClose();
  };

  return (
    <Modal
      open={customer !== null}
      onCancel={close}
      footer={null}
      width={520}
      title={t("noteHistoryTitle", { name: customer?.full_name ?? "" })}
    >
      <div className="space-y-2">
        <Input.TextArea
          rows={3}
          autoFocus
          placeholder={t("addNotePlaceholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPressEnter={(e) => {
            // Ctrl/⌘ + Enter = lưu nhanh; Enter thường vẫn xuống dòng.
            if ((e.ctrlKey || e.metaKey) && text.trim()) save();
          }}
        />
        <div className="flex justify-end">
          <Button type="primary" loading={pending} disabled={!text.trim()} onClick={save}>
            {t("addNote")}
          </Button>
        </div>
      </div>

      {customer?.notes?.length ? (
        <ul className="mt-4 max-h-[50vh] space-y-3 overflow-y-auto border-t border-border pt-4">
          {[...customer.notes].reverse().map((n, i) => (
            <li key={i} className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {n.by ? (
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <UserAvatar src={avatarOf(n.by)} />
                    {n.by}
                  </span>
                ) : null}
                <span className="tabular-nums">{new Date(n.at).toLocaleString()}</span>
              </div>
              <p className="rounded bg-muted px-2.5 py-1.5 text-sm whitespace-pre-wrap">
                {n.text}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </Modal>
  );
}

type Values = {
  full_name: string;
  phone: string;
  social_name?: string;
  stage: string;
  source?: string;
  staff_id?: string;
  sales_id?: string;
  technician_id?: string;
  lost_reason?: string;
  first_contact?: string;
  service_ids?: string[];
};

function CustomerDialog({
  open,
  editing,
  staff,
  options,
  services,
  onClose,
}: {
  open: boolean;
  editing: Customer | null;
  staff: Staff[];
  options: EnumOption[];
  services: Service[];
  onClose: () => void;
}) {
  const t = useTranslations("customers");
  const locale = useLocale();
  const [form] = Form.useForm<Values>();
  const [pending, start] = useTransition();
  const stage = Form.useWatch("stage", form);

  // Option cho Select trong form: active + giá trị hiện tại (kể cả inactive).
  const selectOptions = (kind: EnumKind, current?: string | null): SelectOption[] =>
    options
      .filter((o) => o.kind === kind && (o.is_active || o.value === current))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => ({ value: o.value, label: optionLabel(o, locale) }));

  // Option dịch vụ: active + dịch vụ khách đang gắn (kể cả inactive, để bỏ được).
  const serviceOpts: SelectOption[] = services
    .filter((s) => s.is_active || editing?.service_ids.includes(s.id))
    .map((s) => ({ value: s.id, label: serviceName(s, locale) }));

  const onFinish = (v: Values) =>
    start(async () => {
      const input: CustomerInput = {
        full_name: v.full_name.trim(),
        phone: v.phone.trim(),
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
      onClose();
    });

  const required = [{ required: true, whitespace: true, message: t("required") }];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={560}
      destroyOnHidden
      title={editing ? t("editTitle") : t("createTitle")}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button type="primary" loading={pending} onClick={() => form.submit()}>
            {editing ? t("save") : t("createSubmit")}
          </Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={onFinish}
        initialValues={{
          full_name: editing?.full_name ?? "",
          phone: editing?.phone ?? "",
          social_name: editing?.social_name ?? "",
          stage: editing?.stage ?? "new_lead",
          source: editing?.source ?? "",
          staff_id: editing?.staff_id ?? "",
          sales_id: editing?.sales_id ?? "",
          technician_id: editing?.technician_id ?? "",
          lost_reason: editing?.lost_reason ?? "",
          first_contact: editing?.first_contact?.slice(0, 10) ?? "",
          service_ids: editing?.service_ids ?? [],
        }}
      >
        <Form.Item name="full_name" label={t("colName")} rules={required}>
          <Input />
        </Form.Item>
        <Form.Item name="phone" label={t("colPhone")} rules={required}>
          <Input />
        </Form.Item>
        <Form.Item name="social_name" label={t("socialName")}>
          <Input />
        </Form.Item>
        <Form.Item name="stage" label={t("colStage")}>
          <ClearableSelect
            clearable={false}
            options={selectOptions("stage", editing?.stage)}
            ariaLabel={t("colStage")}
          />
        </Form.Item>
        <Form.Item name="source" label={t("colSource")}>
          <ClearableSelect
            options={selectOptions("source", editing?.source)}
            placeholder={t("noneOption")}
            ariaLabel={t("colSource")}
          />
        </Form.Item>
        {stage === "lost" && (
          <Form.Item name="lost_reason" label={t("colLostReason")}>
            <ClearableSelect
              options={selectOptions("lost_reason", editing?.lost_reason)}
              placeholder={t("noneOption")}
              ariaLabel={t("colLostReason")}
            />
          </Form.Item>
        )}
        <Form.Item name="staff_id" label={t("colStaff")}>
          <ClearableSelect
            options={deptOptions(staff, "customer_care", editing?.staff_id)}
            placeholder={t("noneOption")}
            ariaLabel={t("colStaff")}
          />
        </Form.Item>
        <Form.Item name="sales_id" label={t("colSales")}>
          <ClearableSelect
            options={deptOptions(staff, "sales", editing?.sales_id)}
            placeholder={t("noneOption")}
            ariaLabel={t("colSales")}
          />
        </Form.Item>
        <Form.Item name="technician_id" label={t("colTechnician")}>
          <ClearableSelect
            options={deptOptions(staff, "technician", editing?.technician_id)}
            placeholder={t("noneOption")}
            ariaLabel={t("colTechnician")}
          />
        </Form.Item>
        <Form.Item name="first_contact" label={t("colFirstContact")}>
          <DatePicker placeholder={t("pickDate")} />
        </Form.Item>
        {serviceOpts.length > 0 && (
          <Form.Item name="service_ids" label={t("colServices")}>
            <MultiSelect
              options={serviceOpts}
              placeholder={t("pickServices")}
              ariaLabel={t("colServices")}
            />
          </Form.Item>
        )}
      </Form>
    </Drawer>
  );
}
