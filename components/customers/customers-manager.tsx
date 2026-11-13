"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  Badge,
  Button,
  Form,
  Input,
  Modal,
  Tag,
  Tooltip,
  type TableProps,
} from "antd";
import dayjs from "dayjs";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarPlus,
  History,
  Info,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

import {
  addCustomerNote,
  createCustomer,
  deleteCustomer,
  patchCustomer,
  updateCustomer,
} from "@/app/(app)/customers/actions";
import { CreateAppointmentDrawer, type AppointmentStaff } from "@/components/appointments/appointments-manager";
import { ClearableSelect, type SelectOption } from "@/components/common/clearable-select";
import { useConfirm } from "@/components/common/confirm-action";
import { DataTable } from "@/components/common/data-table";
import { AppointmentHistoryDrawer } from "@/components/customers/appointment-history-drawer";
import { CustomerPipeline, type PipelineAppointment } from "@/components/customers/customer-pipeline";
import { FormDrawer } from "@/components/common/form-drawer";
import { ImageUpload } from "@/components/common/image-upload";
import { DatePicker, DateRangePicker } from "@/components/common/date-picker";
import { EnumTag } from "@/components/common/enum-tag";
import { InlineSelect } from "@/components/common/inline-select";
import { RegionSelect } from "@/components/common/region-select";
import { RowActions } from "@/components/common/row-actions";
import { SOURCE_OPTIONS, SourceIcon } from "@/components/common/source-icon";
import { staffLabel, UserAvatar } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { formatRupiah } from "@/lib/currency";
import { PROVINCES, regionNames } from "@/lib/id-regions";
import { createdAgeBucket, matchesCustomerFilters, optionLabel } from "@/lib/customers";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import { waColor, waNumber } from "@/lib/wa";
import type { Customer, CustomerInput, EnumKind, EnumOption } from "@/types/customer";
import type { Service } from "@/types/service";

type Staff = AppointmentStaff;

// Option theo bộ phận (Nhân viên = customer_care, Sales, Kỹ thuật viên):
// chỉ user đúng bộ phận + giá trị đang gán (user đổi bộ phận sau khi gán
// vẫn hiện — cùng triết lý option inactive).
const deptOptions = (staff: Staff[], dept: string, current?: string | null) =>
  staff
    .filter((s) => s.department === dept || s.id === current)
    .map((s) => ({ value: s.id, label: staffLabel(s) }));

const DASH = <span className="text-muted-foreground">—</span>;

// Màu tag Ngày tạo theo độ mới: hôm nay / ≤3 / ≤7 / ≤14 ngày / cũ hơn.
const AGE_COLORS = ["green", "cyan", "blue", "purple", "default"] as const;
const pad = (n: number) => String(n).padStart(2, "0");

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
};

export function CustomersManager({
  customers,
  staff,
  options,
  appointments,
  services,
}: {
  customers: Customer[];
  staff: Staff[];
  options: EnumOption[];
  appointments: PipelineAppointment[];
  services: Service[];
}) {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const locale = useLocale();
  const confirm = useConfirm();
  const [, start] = useTransition();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const [target, setTarget] = useState<Customer | "new" | null>(null);
  // Lưu id (không giữ object) để modal ghi chú tự nhận note mới sau revalidate.
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [apptFor, setApptFor] = useState<Customer | null>(null);
  const [createFor, setCreateFor] = useState<string | null>(null); // id khách đang tạo lịch hẹn
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
  // Avatar người ghi note — note chỉ lưu tên snapshot nên tra theo user_name.
  const staffAvatarByName = (name: string | null | undefined) =>
    name ? staff.find((s) => s.user_name === name)?.avatar_url : undefined;

  // Lịch hẹn gần nhất mỗi khách: lịch sắp tới sớm nhất; không có thì lịch đã qua mới nhất.
  const [now] = useState(() => Date.now());
  const nearestAppt = useMemo(() => {
    // Khoảng cách tới "bây giờ"; lịch đã qua cộng thêm số rất lớn để luôn xếp sau lịch sắp tới.
    const rank = (a: PipelineAppointment) => {
      const diff = Date.parse(a.scheduled_at) - now;
      return diff >= 0 ? diff : Number.MAX_SAFE_INTEGER / 2 - diff;
    };
    const map = new Map<string, PipelineAppointment>();
    for (const a of appointments) {
      const cur = map.get(a.customer_id);
      if (!cur || rank(a) < rank(cur)) map.set(a.customer_id, a);
    }
    return map;
  }, [appointments, now]);
  const apptCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) map.set(a.customer_id, (map.get(a.customer_id) ?? 0) + 1);
    return map;
  }, [appointments]);

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
      .map((o) => ({ value: o.value, label: <EnumTag label={optionLabel(o, locale)} color={o.color} icon={o.icon} /> }));
  // Option dạng tag (icon + màu) cho select sửa nhanh trên bảng — khớp ô hiển thị.
  const tagOptions = (kind: EnumKind, current?: string | null): SelectOption[] =>
    kindOptions(kind, current).map((o) => ({ value: o.value, label: tagFor(kind, o.value) }));

  const columns: TableProps<Customer>["columns"] = [
    {
      title: t("colCreated"),
      dataIndex: "created_at",
      render: (v: string) => {
        const d = new Date(v);
        return (
          <Tag
            color={AGE_COLORS[createdAgeBucket(v)]}
            title={`${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`}
            className="me-0 tabular-nums"
          >
            {`${pad(d.getDate())}-${pad(d.getMonth() + 1)}`}
          </Tag>
        );
      },
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
      title: t("region"),
      key: "region",
      width: 260,
      render: (_, c) => {
        const r = regionNames(c.region_code);
        // 1 hàng: "địa chỉ chi tiết, huyện/TP, tỉnh"; dài quá thì cắt "…", hover xem đủ.
        const text = [c.address_detail, r?.city, r?.province].filter(Boolean).join(", ");
        // Trống thì để ô trống (không "—").
        return text ? (
          <div title={text} className="max-w-[260px] truncate">
            {text}
          </div>
        ) : null;
      },
    },
    {
      title: t("colStage"),
      dataIndex: "stage",
      width: 150,
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
      title: t("colRating"),
      dataIndex: "rating",
      width: 140,
      render: (_, c) => (
        <InlineSelect
          value={c.rating ?? ""}
          display={tagFor("rating", c.rating)}
          options={tagOptions("rating", c.rating)}
          noneLabel={t("noneOption")}
          ariaLabel={t("colRating")}
          onSave={(v) => patchField(c.id, { rating: v || null })}
        />
      ),
    },
    {
      title: t("colDeposit"),
      dataIndex: "deposit_amount",
      width: 140,
      align: "right",
      render: (v: number | null) =>
        v ? <span className="tabular-nums">{formatRupiah(Number(v))}</span> : DASH,
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
            ) : (
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
    {
      title: t("colSource"),
      dataIndex: "source",
      width: 80,
      // Chỉ xem — nguồn tự tính từ số WA của hội thoại (WA / còn lại IG).
      render: (_, c) => <SourceIcon source={c.source} />,
    },
    {
      title: t("colWaNumber"),
      key: "wa_number",
      width: 100,
      render: (_, c) => {
        const wa = waNumber(c.thread?.link);
        return wa ? <Tag color={waColor(wa)} className="me-0">{wa}</Tag> : DASH;
      },
    },
    {
      title: t("colInstagram"),
      key: "instagram_username",
      width: 160,
      render: (_, c) =>
        c.instagram_username ? (
          <a
            href={`https://www.instagram.com/${c.instagram_username}`}
            target="_blank"
            rel="noreferrer"
          >
            {c.instagram_username}
          </a>
        ) : (
          DASH
        ),
    },
    ...(
      [
        // Sales, Kỹ thuật viên: ẩn khỏi trang (dữ liệu vẫn giữ; KTV tự điền khi nhận tour).
        ["staff_id", "colStaff", "customer_care"],
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
  // Số lọc đang bật (khoảng ngày tính 1) — có lọc thì hiện nút "Xoá bộ lọc".
  const activeCount =
    [filters.search, filters.stage, filters.rating, filters.source, filters.staffId, filters.province].filter(Boolean)
      .length + (filters.from || filters.to ? 1 : 0);

  return (
    <Page>
      <PageHeader title={t("title")} />

      <CustomerPipeline
        customers={rowsData}
        appointments={appointments}
        from={filters.from}
        to={filters.to}
      />

      {/* Thanh lọc: hiện thẳng mọi bộ lọc (ít trường, không cần gom vào popover). */}
      <PageToolbar>
        <Button type="primary" icon={<UserPlus className="size-4" />} onClick={() => setTarget("new")}>
          {t("create")}
        </Button>
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
          options={kindOptions("stage")}
          placeholder={t("allStage")}
          ariaLabel={t("colStage")}
        />
        <ClearableSelect
          className="min-w-36"
          value={filters.rating}
          onChange={(v) => setFilter("rating", v)}
          options={kindOptions("rating")}
          placeholder={t("allRating")}
          ariaLabel={t("colRating")}
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
          options={deptOptions(staff, "customer_care")}
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
        columns={columns}
        dataSource={filtered}
        page={page}
        onPageChange={setPage}
        empty={t("empty")}
      />

      <CustomerDialog
        open={target !== null}
        editing={editing}
        staff={staff}
        options={options}
        onClose={() => setTarget(null)}
      />

      {/* Ghi chú (icon Info): lịch sử mới nhất trước + ô thêm ghi chú */}
      <NotesModal
        customer={rowsData.find((c) => c.id === notesFor) ?? null}
        avatarOf={staffAvatarByName}
        onClose={() => setNotesFor(null)}
      />

      <AppointmentHistoryDrawer customer={apptFor} staff={staff} onClose={() => setApptFor(null)} />

      {/* key theo khách: form mới mỗi lần mở (không dính khách/giá trị lần trước). */}
      <CreateAppointmentDrawer
        key={createFor ?? ""}
        open={createFor !== null}
        initialCustomer={createFor ?? ""}
        customers={rowsData}
        staff={staff}
        services={services}
        onClose={() => setCreateFor(null)}
        onCreated={() => setCreateFor(null)}
      />
    </Page>
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
  rating?: string;
  staff_id?: string;
  lost_reason?: string;
  first_contact?: string;
  payment_confirm_url?: string | null;
  region_code?: string;
  address_detail?: string;
};

function CustomerDialog({
  open,
  editing,
  staff,
  options,
  onClose,
}: {
  open: boolean;
  editing: Customer | null;
  staff: Staff[];
  options: EnumOption[];
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
      .map((o) => ({ value: o.value, label: <EnumTag label={optionLabel(o, locale)} color={o.color} icon={o.icon} /> }));

  const onFinish = (v: Values) =>
    start(async () => {
      const input: CustomerInput = {
        full_name: v.full_name.trim(),
        phone: formatPhone(v.phone),
        social_name: v.social_name || null,
        stage: v.stage,
        rating: v.rating || null,
        lost_reason: v.lost_reason || null,
        staff_id: v.staff_id || null,
        // Sales/KTV đã ẩn khỏi form → giữ nguyên giá trị đang có.
        sales_id: editing?.sales_id ?? null,
        technician_id: editing?.technician_id ?? null,
        first_contact: v.first_contact || null,
        payment_confirm_url: v.payment_confirm_url || null,
        region_code: v.region_code || null,
        address_detail: v.address_detail || null,
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
    <FormDrawer
      open={open}
      onClose={onClose}
      width={560}
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
        initialValues={{
          full_name: editing?.full_name ?? "",
          phone: editing?.phone ?? "",
          social_name: editing?.social_name ?? "",
          stage: editing?.stage ?? "new_lead",
          rating: editing?.rating ?? "",
          staff_id: editing?.staff_id ?? "",
          lost_reason: editing?.lost_reason ?? "",
          first_contact: editing?.first_contact?.slice(0, 10) ?? "",
          payment_confirm_url: editing?.payment_confirm_url ?? null,
          region_code: editing?.region_code ?? "",
          address_detail: editing?.address_detail ?? "",
        }}
      >
        <Form.Item name="full_name" label={t("colName")} rules={required}>
          <Input />
        </Form.Item>
        <Form.Item name="phone" label={t("colPhone")} rules={required} normalize={normalizePhone}>
          <Input inputMode="tel" autoComplete="off" />
        </Form.Item>
        <Form.Item name="social_name" label={t("socialName")}>
          <Input />
        </Form.Item>
        <Form.Item name="region_code" label={t("region")}>
          <RegionSelect provinceLabel={t("province")} cityLabel={t("city")} />
        </Form.Item>
        <Form.Item name="address_detail" label={t("addressDetail")} rules={[{ max: 500 }]}>
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>
        {/* Giai đoạn + Đánh giá chung 1 hàng. */}
        <div className="grid grid-cols-2 gap-3">
          <Form.Item name="stage" label={t("colStage")}>
            <ClearableSelect
              clearable={false}
              options={selectOptions("stage", editing?.stage)}
              ariaLabel={t("colStage")}
            />
          </Form.Item>
          <Form.Item name="rating" label={t("colRating")}>
            <ClearableSelect
              options={selectOptions("rating", editing?.rating)}
              placeholder={t("noneOption")}
              ariaLabel={t("colRating")}
            />
          </Form.Item>
        </div>
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
        <Form.Item name="first_contact" label={t("colFirstContact")}>
          <DatePicker placeholder={t("pickDate")} />
        </Form.Item>
        <Form.Item name="payment_confirm_url" label={t("paymentConfirm")} className="mb-0">
          <ImageUpload paste label={t("uploadImage")} />
        </Form.Item>
      </Form>
    </FormDrawer>
  );
}
