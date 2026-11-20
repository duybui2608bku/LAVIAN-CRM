"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  Badge,
  Button,
  Form,
  Image,
  Input,
  Modal,
  Tag,
  Popover,
  type TableProps,
} from "antd";
import dayjs from "dayjs";
import { useLocale, useTranslations } from "next-intl";
import {
  BellPlus,
  CalendarPlus,
  History,
  Info,
  PanelRightOpen,
  Search,
  UserPlus,
  X,
} from "lucide-react";

import {
  addCustomerNote,
  createCustomer,
  patchCustomer,
  updateCustomer,
} from "@/app/(app)/customers/actions";
import { NoteItem, NotesDrawer } from "@/components/common/notes";
import { CreateAppointmentDrawer, VisitStatusTag, type AppointmentStaff } from "@/components/appointments/appointments-manager";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { ClearableSelect, type SelectOption } from "@/components/common/clearable-select";
import { useCan } from "@/components/common/permissions";
import { useIsMobile, useMedia } from "@/hooks/use-is-mobile";
import { DataTable } from "@/components/common/data-table";
import { NamePhone } from "@/components/common/name-phone";
import { AppointmentHistoryDrawer } from "@/components/customers/appointment-history-drawer";
import { CustomerPipeline, type PipelineAppointment } from "@/components/customers/customer-pipeline";
import { CustomerRemindersPopover } from "@/components/reminders/customer-reminders-popover";
import { FormDrawer } from "@/components/common/form-drawer";
import { ImageUpload } from "@/components/common/image-upload";
import { DatePicker, DateRangePicker } from "@/components/common/date-picker";
import { EnumTag } from "@/components/common/enum-tag";
import { InlineSelect } from "@/components/common/inline-select";
import { RegionSelect } from "@/components/common/region-select";
import { SOURCE_OPTIONS, SourceIcon } from "@/components/common/source-icon";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { nearestByCustomer } from "@/lib/appointments";
import { formatRupiah } from "@/lib/currency";
import { PROVINCES } from "@/lib/id-regions";
import { matchesCustomerFilters, optionLabel } from "@/lib/customers";
import { instagramUsername, isFollowUpStage, phoneOptional, SHOW_UP_STAGE } from "@/lib/customer-options";
import { formatPhone, isValidPhone, normalizePhone } from "@/lib/phone";
import { nextPending, REMINDER_COLORS, reminderState } from "@/lib/reminders";
import { toast } from "@/lib/toast";
import { waColor, waNumber } from "@/lib/wa";
import type { Customer, CustomerInput, CustomerNote, EnumKind, EnumOption } from "@/types/customer";
import type { Reminder } from "@/types/reminder";
import { TELESALES_DEPARTMENTS } from "@/types/user";

type Staff = AppointmentStaff;

// Option theo bộ phận (Nhân viên = telesales + leader, Sales, Kỹ thuật viên):
// chỉ user đúng bộ phận + giá trị đang gán (user đổi bộ phận sau khi gán
// vẫn hiện — cùng triết lý option inactive).
const deptOptions = (staff: Staff[], dept: string, current?: string | null) =>
  staff
    .filter((s) => (dept === "telesales" ? TELESALES_DEPARTMENTS.includes(s.department ?? "") : s.department === dept) || s.id === current)
    .map((s) => ({ value: s.id, label: staffLabel(s) }));

const DASH = <span className="text-muted-foreground">—</span>;

// Rộng drawer theo số cột form (1 cột giữ 560 như các drawer khác).
const DRAWER_WIDTH = { 1: 560, 2: 720, 3: 1000 } as const;

type Filters = {
  search: string;
  stage: string;
  rating: string;
  source: string;
  staffId: string;
  province: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  stage: "",
  rating: "",
  source: "",
  staffId: "",
  province: "",
  from: "",
  to: "",
};

type Patch = {
  stage?: string;
  rating?: string | null;
  staff_id?: string | null;
  sales_id?: string | null;
  technician_id?: string | null;
  follow_up_at?: string | null;
};

export function CustomersManager({
  customers,
  staff,
  options,
  appointments,
  stages,
  title,
  reminders,
}: {
  /** Có = hiện cột Nhắc hẹn (Booking management). */
  reminders?: Reminder[];
  /** Trang con lọc sẵn theo stage (vd Booking management): ẩn pipeline, ô lọc stage chỉ còn các stage này. */
  stages?: readonly string[];
  title?: string;
  customers: Customer[];
  staff: Staff[];
  options: EnumOption[];
  appointments: PipelineAppointment[];
}) {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const locale = useLocale();
  const can = useCan();
  const canEdit = can("customers.edit");
  const [, start] = useTransition();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const [target, setTarget] = useState<Customer | "new" | null>(null);
  // Lưu id (không giữ object) để modal ghi chú tự nhận note mới sau revalidate.
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [apptFor, setApptFor] = useState<Customer | null>(null);
  const [createFor, setCreateFor] = useState<string | null>(null); // id khách đang tạo lịch hẹn
  // Đổi stage inline sang Tiềm năng / Cân nhắc: chờ chọn lịch nhắc rồi mới lưu.
  const [followUp, setFollowUp] = useState<{ id: string; stage: string; at: string | null } | null>(null);
  const [page, setPage] = useState(1);

  // Sửa inline hiện ngay, không chờ server. React tự trả về dữ liệu server khi
  // transition kết thúc — action lỗi thì ô tự quay lại giá trị cũ.
  const [rowsData, patchOptimistic] = useOptimistic(
    customers,
    (state: Customer[], patch: Patch & { id: string }) =>
      state.map((c) => (c.id === patch.id ? { ...c, ...patch } : c)),
  );

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

  // Lịch hẹn gần nhất mỗi khách: lịch sắp tới sớm nhất; không có thì lịch đã qua mới nhất.
  const [now] = useState(() => Date.now());
  const nearestAppt = useMemo(() => nearestByCustomer(appointments, now), [appointments, now]);
  const apptCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) map.set(a.customer_id, (map.get(a.customer_id) ?? 0) + 1);
    return map;
  }, [appointments]);

  const remindersOf = useMemo(() => {
    const map = new Map<string, Reminder[]>();
    for (const r of reminders ?? []) map.set(r.customer_id, [...(map.get(r.customer_id) ?? []), r]);
    return map;
  }, [reminders]);
  // Lịch hẹn sắp tới của khách (gợi ý giờ nhắc + tin nhắn mẫu).
  const upcomingAppt = (id: string) => {
    const a = nearestAppt.get(id);
    return a && Date.parse(a.scheduled_at) >= now ? a.scheduled_at : undefined;
  };

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

  // Option cho Select (lọc + sửa inline): active + giá trị hiện tại (kể cả inactive), theo sort_order.
  // Chữ trần — tag màu chỉ ở ô hiển thị trên bảng (`tagFor`).
  const kindOptions = (kind: EnumKind, current?: string | null): SelectOption[] =>
    options
      .filter((o) => o.kind === kind && (o.is_active || o.value === current))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => ({ value: o.value, label: optionLabel(o, locale) }));

  const columns: TableProps<Customer>["columns"] = [
    {
      title: t("colCreated"),
      key: "created",
      dataIndex: "created_at",
      width: 120,
      // 2 hàng như Customers Management / Sales Management: ngày đầy đủ trên, giờ nhỏ dưới.
      render: (v: string) => (
        <div className="leading-tight tabular-nums">
          <div>{dayjs(v).format("DD/MM/YYYY")}</div>
          <div className="text-xs text-muted-foreground">{dayjs(v).format("HH:mm")}</div>
        </div>
      ),
    },
    {
      title: t("colName"),
      dataIndex: "full_name",
      render: (_, c) => (
        // Hover ô tên → hiện nút mở drawer sửa (thay cột Thao tác). Cảm ứng: luôn hiện.
        <div className="group flex items-center gap-1">
          {/* Gộp Tên + SĐT; có hội thoại SMAX → tên chính là link mở hội thoại. */}
          <NamePhone
            phone={c.phone}
            title={c.full_name}
            name={
              c.thread?.link ? (
                <a href={c.thread.link} target="_blank" rel="noreferrer" title={t("openThread")}>
                  {c.full_name}
                </a>
              ) : (
                c.full_name
              )
            }
          />
          {canEdit && (
            <Button
              type="text"
              size="small"
              aria-label={t("editTitle")}
              title={t("editTitle")}
              icon={<PanelRightOpen className="size-4" />}
              className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
              onClick={() => setTarget(c)}
            />
          )}
        </div>
      ),
    },
    {
      title: t("colStage"),
      dataIndex: "stage",
      width: 150,
      render: (_, c) => (
        <InlineSelect
          value={c.stage}
          display={tagFor("stage", c.stage)}
          // Show-up tự chuyển theo Clinic confirmation → không chọn tay (chỉ hiện khi khách đang ở Show-up).
          options={kindOptions("stage", c.stage).filter((o) => o.value !== SHOW_UP_STAGE || o.value === c.stage)}
          ariaLabel={t("colStage")}
          // Trang lọc theo stage (Booking management): chỉ xem stage, không đổi.
          disabled={!canEdit || !!stages}
          onSave={(v) =>
            isFollowUpStage(v)
              ? setFollowUp({ id: c.id, stage: v, at: c.follow_up_at ?? null })
              : patchField(c.id, { stage: v })
          }
        />
      ),
    },
    // Sales Status: Status của lịch gần nhất (cùng lịch với cột Lịch hẹn) — Sales đổi ở trang Lịch hẹn.
    {
      title: t("colSalesStatus"),
      key: "salesStatus",
      width: 150,
      render: (_, c) => {
        const a = nearestAppt.get(c.id);
        return a ? <VisitStatusTag status={a.visit_status} /> : DASH;
      },
    },
    {
      title: t("colDeposit"),
      dataIndex: "deposit_amount",
      width: 140,
      align: "right",
      // Có ảnh xác nhận thanh toán → thumbnail nhỏ cạnh số tiền, bấm mở preview to (antd Image).
      render: (v: number | null, c) =>
        v || c.payment_confirm_url ? (
          <div className="flex items-center justify-end gap-2">
            {c.payment_confirm_url && (
              <Image
                src={c.payment_confirm_url}
                alt={t("paymentConfirm")}
                width={28}
                height={28}
                className="rounded border border-border object-cover"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {v ? <span className="tabular-nums">{formatRupiah(Number(v))}</span> : null}
          </div>
        ) : DASH,
    },
    {
      title: t("colAppointment"),
      key: "appointment",
      width: 170,
      render: (_, c) => {
        const a = nearestAppt.get(c.id);
        const d = a && dayjs(a.scheduled_at);
        // Sắp tới = xanh dương; đã qua: đã đến = xanh lá, chưa đến = xám.
        const color = !a ? undefined : Date.parse(a.scheduled_at) >= now ? "blue" : a.checked_in ? "green" : "default";
        return (
          <div className="flex items-center gap-1">
            {d ? (
              <Tag color={color} title={d.format("DD-MM-YYYY HH:mm")} className="me-0 tabular-nums">
                {d.format("DD-MM HH:mm")}
              </Tag>
            ) : can("appointments.edit") && (
              // Chưa có lịch → nút mở drawer tạo lịch hẹn cho khách này.
              <Button
                type="text"
                size="small"
                aria-label={t("addAppointment")}
                title={t("addAppointment")}
                icon={<CalendarPlus className="size-4" />}
                onClick={() => setCreateFor(c.id)}
              />
            )}
            {/* Mở drawer: toàn bộ lịch hẹn + lịch sử thay đổi; badge = số lịch chưa xoá. */}
            <Badge count={apptCount.get(c.id) ?? 0} size="small" overflowCount={99}>
              <Button
                type="text"
                size="small"
                aria-label={t("viewAppointments")}
                title={t("viewAppointments")}
                icon={<History className="size-4" />}
                onClick={() => setApptFor(c)}
              />
            </Badge>
          </div>
        );
      },
    },
    ...(reminders
      ? [
          {
            title: t("colReminder"),
            key: "reminder",
            width: 150,
            // Lịch nhắc chưa xong sớm nhất (màu: quá hạn/hôm nay/sắp tới) + số chưa xong; bấm mở popover tại chỗ.
            render: (_: unknown, c: Customer) => {
              const list = remindersOf.get(c.id) ?? [];
              const next = nextPending(list);
              const pendingCount = list.filter((r) => !r.done_at).length;
              return (
                <CustomerRemindersPopover
                  customer={c}
                  reminders={list}
                  staff={staff}
                  appointmentAt={upcomingAppt(c.id)}
                  now={now}
                  canEdit={canEdit}
                >
                  {next ? (
                    <Badge count={pendingCount > 1 ? pendingCount : 0} size="small">
                      <Tag
                        color={REMINDER_COLORS[reminderState(next, now)]}
                        className="me-0 cursor-pointer tabular-nums"
                        title={t("viewReminders")}
                      >
                        {dayjs(next.remind_at).format("DD-MM HH:mm")}
                      </Tag>
                    </Badge>
                  ) : (
                    <Badge count={list.length} size="small" color="var(--muted-foreground)">
                      <Button
                        type="text"
                        size="small"
                        aria-label={t("viewReminders")}
                        title={t("viewReminders")}
                        icon={<BellPlus className="size-4" />}
                      />
                    </Badge>
                  )}
                </CustomerRemindersPopover>
              );
            },
          },
        ]
      : []),
    {
      title: t("colSource"),
      key: "source",
      width: 170,
      render: (_, c) => <SourceCell customer={c} />,
    },
    ...(
      [
        // Sales, Kỹ thuật viên: ẩn khỏi trang (dữ liệu vẫn giữ; KTV tự điền khi nhận tour).
        ["staff_id", "colStaff", "telesales"],
      ] as const
    ).map(([field, label, dept]) => ({
      title: t(label),
      key: field,
      width: 160,
      render: (_: unknown, c: Customer) => (
        <InlineSelect
          value={c[field] ?? ""}
          display={staffDisplay(c[field])}
          options={deptOptions(staff, dept, c[field])}
          noneLabel={t("noneOption")}
          ariaLabel={t(label)}
          disabled={!canEdit}
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
          <Popover
            content={last ? <div className="max-w-64"><NoteItem note={last} staff={staff} clamp /></div> : t("addNote")}
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
          </Popover>
        );
      },
    },
  ];

  // Booking management: Lịch hẹn lên cột đầu, Ngày tạo xuống cuối (sort ổn định giữ thứ tự còn lại).
  const rank = (key: unknown) => (key === "appointment" ? -2 : key === "reminder" ? -1 : key === "created" ? 1 : 0);
  const tableColumns = stages ? [...columns].sort((a, b) => rank(a.key) - rank(b.key)) : columns;

  const editing = target && target !== "new" ? target : null;
  // Số lọc đang bật (khoảng ngày tính 1) — có lọc thì hiện nút "Xoá bộ lọc".
  const activeCount =
    [filters.search, filters.stage, filters.rating, filters.source, filters.staffId, filters.province].filter(Boolean)
      .length + (filters.from || filters.to ? 1 : 0);

  return (
    <Page>
      <PageHeader title={title ?? t("title")} />

      {!stages && (
        <CustomerPipeline
          customers={rowsData}
          appointments={appointments}
          from={filters.from}
          to={filters.to}
        />
      )}

      {/* Thanh lọc: hiện thẳng mọi bộ lọc (ít trường, không cần gom vào popover). */}
      <PageToolbar>
        {canEdit && (
          <Button type="primary" icon={<UserPlus className="size-4" />} onClick={() => setTarget("new")}>
            {t("create")}
          </Button>
        )}
        <Input
          allowClear
          className="w-full sm:max-w-64"
          prefix={<Search className="size-4 text-muted-foreground" />}
          placeholder={t("searchPlaceholder")}
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
        />
        <ClearableSelect
          className="min-w-36"
          value={filters.stage}
          onChange={(v) => setFilter("stage", v)}
          options={kindOptions("stage").filter((o) => !stages || stages.includes(String(o.value)))}
          placeholder={t("allStage")}
          ariaLabel={t("colStage")}
        />
        <ClearableSelect
          className="min-w-36"
          value={filters.source}
          onChange={(v) => setFilter("source", v)}
          options={SOURCE_OPTIONS}
          placeholder={t("allSource")}
          ariaLabel={t("colSource")}
        />
        <ClearableSelect
          className="min-w-36"
          value={filters.staffId}
          onChange={(v) => setFilter("staffId", v)}
          options={deptOptions(staff, "telesales")}
          placeholder={t("allStaff")}
          ariaLabel={t("colStaff")}
        />
        <ClearableSelect
          className="min-w-36"
          value={filters.province}
          onChange={(v) => setFilter("province", v)}
          options={PROVINCES}
          placeholder={t("allProvince")}
          ariaLabel={t("province")}
          searchable
        />
        <DateRangePicker
          from={filters.from}
          to={filters.to}
          onChange={(r) => setFilters((f) => ({ ...f, ...r }))}
        />
        {activeCount > 0 && (
          <Button type="text" icon={<X className="size-4" />} onClick={() => setFilters(EMPTY_FILTERS)}>
            {tc("clearFilters")}
          </Button>
        )}
      </PageToolbar>

      <DataTable
        columns={tableColumns}
        dataSource={filtered}
        page={page}
        onPageChange={setPage}
        empty={t("empty")}
      />

      <CustomerDialog
        open={target !== null}
        editing={editing}
        lockStage={!!stages}
        staff={staff}
        options={options}
        onClose={() => setTarget(null)}
      />

      {/* Ghi chú (icon Info): lịch sử mới nhất trước + ô thêm ghi chú */}
      <CustomerNotesDrawer
        customer={rowsData.find((c) => c.id === notesFor) ?? null}
        staff={staff}
        onClose={() => setNotesFor(null)}
      />

      <AppointmentHistoryDrawer customer={apptFor} staff={staff} onClose={() => setApptFor(null)} />

      {/* Tiềm năng / Cân nhắc bắt buộc lịch nhắc — huỷ thì stage giữ nguyên. */}
      <Modal
        open={followUp !== null}
        title={t("followUpAt")}
        okText={t("save")}
        okButtonProps={{ disabled: !followUp?.at }}
        destroyOnHidden
        onCancel={() => setFollowUp(null)}
        onOk={() => {
          if (!followUp?.at) return;
          patchField(followUp.id, { stage: followUp.stage, follow_up_at: followUp.at });
          setFollowUp(null);
        }}
      >
        <AppointmentDate
          className="w-full"
          value={followUp?.at}
          onSave={(at) => setFollowUp((f) => f && { ...f, at })}
        />
      </Modal>

      {/* key theo khách: form mới mỗi lần mở (không dính khách/giá trị lần trước). */}
      <CreateAppointmentDrawer
        key={createFor ?? ""}
        open={createFor !== null}
        initialCustomer={createFor ?? ""}
        customers={rowsData}
        staff={staff}
        onClose={() => setCreateFor(null)}
        onCreated={() => setCreateFor(null)}
      />
    </Page>
  );
}


/**
 * Ô Nguồn (chỉ xem): icon nguồn + số WA nhận tin (WhatsApp) hoặc username IG (Instagram).
 * Khách có kênh thứ hai (`other_channel`, vd IG → WA) → 2 hàng, kênh nhắn trước ở trên.
 */
export function SourceCell({ customer: c }: { customer: Customer }) {
  const o = c.other_channel;
  const rows = [{ source: c.source, wa: waNumber(c.thread?.link), ig: c.instagram_username }];
  if (o && o.source !== c.source) rows.push({ source: o.source, wa: waNumber(o.link), ig: instagramUsername(o.username) });
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r) => (
        <div key={r.source ?? ""} className="flex items-center gap-1.5">
          <SourceIcon source={r.source} />
          {r.wa ? (
            <Tag color={waColor(r.wa)} className="me-0">{r.wa}</Tag>
          ) : r.ig ? (
            <a href={`https://www.instagram.com/${r.ig}`} target="_blank" rel="noreferrer" className="truncate">
              {r.ig}
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Ghi chú Telesales của 1 khách (customers.notes) trên drawer ghi chú dùng chung — chỉ thêm, không xoá. */
export function CustomerNotesDrawer({
  customer,
  staff,
  onClose,
}: {
  customer: { id: string; full_name: string; notes?: CustomerNote[] | null } | null;
  staff: StaffRef[];
  onClose: () => void;
}) {
  const t = useTranslations("customers");
  const canEdit = useCan()("customers.edit");
  return (
    <NotesDrawer
      open={customer !== null}
      title={t("noteHistoryTitle", { name: customer?.full_name ?? "" })}
      notes={customer?.notes ?? []}
      staff={staff}
      onAdd={canEdit && customer ? (input) => addCustomerNote(customer.id, input) : undefined}
      onClose={onClose}
    />
  );
}

type Values = {
  full_name: string;
  phone: string;
  social_name?: string;
  stage: string;
  rating?: string;
  staff_id?: string;
  first_contact?: string;
  payment_confirm_url?: string | null;
  region_code?: string;
  address_detail?: string;
  follow_up_at?: string | null;
};

function CustomerDialog({
  open,
  editing,
  lockStage,
  staff,
  options,
  onClose,
}: {
  open: boolean;
  editing: Customer | null;
  /** Sửa khách ở trang lọc theo stage → không đổi stage (tạo mới vẫn chọn được). */
  lockStage: boolean;
  staff: Staff[];
  options: EnumOption[];
  onClose: () => void;
}) {
  const t = useTranslations("customers");
  const locale = useLocale();
  const [form] = Form.useForm<Values>();
  const stage = Form.useWatch("stage", form);
  const [pending, start] = useTransition();

  // Option cho Select trong form: active + giá trị hiện tại (kể cả inactive).
  const selectOptions = (kind: EnumKind, current?: string | null): SelectOption[] =>
    options
      .filter((o) => o.kind === kind && (o.is_active || o.value === current))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => ({ value: o.value, label: optionLabel(o, locale) }));

  const onFinish = (v: Values) =>
    start(async () => {
      const input: CustomerInput = {
        full_name: v.full_name.trim(),
        phone: formatPhone(v.phone),
        social_name: v.social_name || null,
        stage: lockStage && editing ? editing.stage : v.stage,
        rating: v.rating || null,
        staff_id: v.staff_id || null,
        // Sales/KTV đã ẩn khỏi form → giữ nguyên giá trị đang có.
        sales_id: editing?.sales_id ?? null,
        technician_id: editing?.technician_id ?? null,
        first_contact: v.first_contact || null,
        payment_confirm_url: v.payment_confirm_url || null,
        region_code: v.region_code || null,
        address_detail: v.address_detail || null,
        follow_up_at: v.follow_up_at ?? null,
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

  // Màn càng thấp → càng nhiều cột (drawer rộng ra) để form không phải cuộn dọc.
  // ponytail: ngưỡng đo tay theo bộ field hiện tại — thêm/bớt field thì chỉnh lại.
  const mobile = useIsMobile();
  const tall = useMedia("(min-height: 1000px)", false);
  const mid = useMedia("(min-height: 720px)", true);
  const cols = mobile || tall ? 1 : mid ? 2 : 3;

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      width={DRAWER_WIDTH[cols]}
      pending={pending}
      title={editing ? t("editTitle") : t("createTitle")}
      submitText={editing ? t("save") : t("createSubmit")}
      onSubmit={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={onFinish}
        className="grid gap-x-4"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        initialValues={{
          full_name: editing?.full_name ?? "",
          phone: editing?.phone ?? "",
          social_name: editing?.social_name ?? "",
          stage: editing?.stage ?? "", // khách mới: bắt buộc chọn, không mặc định
          rating: editing?.rating ?? "",
          staff_id: editing?.staff_id ?? "",
          first_contact: editing?.first_contact?.slice(0, 10) ?? "",
          payment_confirm_url: editing?.payment_confirm_url ?? null,
          region_code: editing?.region_code ?? "",
          address_detail: editing?.address_detail ?? "",
          follow_up_at: editing?.follow_up_at ?? null,
        }}
      >
        <Form.Item name="full_name" label={t("colName")} rules={required}>
          <Input />
        </Form.Item>
        <Form.Item
          name="phone"
          label={t("colPhone")}
          rules={[
            // Sửa khách Instagram: được để trống (khách chưa cho SĐT). Tạo tay vẫn bắt buộc.
            ...(phoneOptional(editing?.source) ? [] : required),
            { validator: (_, v?: string) => (!v || isValidPhone(v) ? Promise.resolve() : Promise.reject(new Error(t("phoneInvalid")))) },
          ]}
          normalize={normalizePhone}
        >
          <Input inputMode="tel" autoComplete="off" />
        </Form.Item>
        <Form.Item name="social_name" label={t("socialName")}>
          <Input />
        </Form.Item>
        {/* Thứ tự xếp theo hàng: 2–3 cột vẫn đọc tự nhiên (định danh → trạng thái → địa chỉ/ảnh). */}
        <Form.Item name="stage" label={t("colStage")} rules={required}>
          <ClearableSelect
            clearable={false}
            placeholder={t("chooseStage")}
            options={selectOptions("stage", editing?.stage).filter(
              (o) => o.value !== SHOW_UP_STAGE || o.value === editing?.stage,
            )}
            disabled={lockStage && !!editing}
            ariaLabel={t("colStage")}
          />
        </Form.Item>
        {isFollowUpStage(stage) && (
          <Form.Item name="follow_up_at" label={t("followUpAt")} trigger="onSave"
            rules={[{ required: true, message: t("followUpRequired") }]}>
            <AppointmentDate className="w-full" onSave={() => {}} />
          </Form.Item>
        )}
        {/* Đánh giá đang ẩn khỏi UI — giữ field ẩn để lưu form không xoá giá trị cũ. */}
        <Form.Item name="rating" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="staff_id" label={t("colStaff")}>
          <ClearableSelect
            options={deptOptions(staff, "telesales", editing?.staff_id)}
            placeholder={t("noneOption")}
            ariaLabel={t("colStaff")}
          />
        </Form.Item>
        <Form.Item name="first_contact" label={t("colFirstContact")}>
          <DatePicker placeholder={t("pickDate")} />
        </Form.Item>
        <Form.Item name="region_code" label={t("region")}>
          <RegionSelect provinceLabel={t("province")} cityLabel={t("city")} />
        </Form.Item>
        <Form.Item name="address_detail" label={t("addressDetail")} rules={[{ max: 500 }]}>
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>
        <Form.Item name="payment_confirm_url" label={t("paymentConfirm")} className="mb-0">
          <ImageUpload paste label={t("uploadImage")} />
        </Form.Item>
      </Form>
    </FormDrawer>
  );
}
