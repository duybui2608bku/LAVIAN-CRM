"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Badge, Button, type TableProps } from "antd";
import { useLocale, useTranslations } from "next-intl";
import { MessageCircleMore, MessageSquareText } from "lucide-react";

import { convertPotentialCustomer, patchCustomer } from "@/app/(app)/customers/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { CreateAppointmentDrawer, VisitStatusTag, type AppointmentStaff } from "@/components/appointments/appointments-manager";
import { ClearableSelect } from "@/components/common/clearable-select";
import { DataTable } from "@/components/common/data-table";
import { MessagesModal, type MessagesCustomer } from "@/components/appointments/messages-modal";
import { useCustomer360 } from "@/components/customers/customer-360/customer-360-modal";
import { DASH, DateTimeCell, StatusDot } from "@/components/common/cells";
import { ClearFilters, SearchInput } from "@/components/common/filter-controls";
import { InlineSelect } from "@/components/common/inline-select";
import { useCan } from "@/components/common/permissions";
import { NamePhone } from "@/components/common/name-phone";
import { StatCard } from "@/components/common/stat-card";
import { staffName, staffOptions } from "@/components/common/user-avatar";
import type { PipelineAppointment } from "@/components/customers/customer-pipeline";
import { CustomerNotesDrawer, SourceCell } from "@/components/customers/customers-manager";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { nearestByCustomer } from "@/lib/appointments";
import { CONVERTED_STATUS } from "@/lib/customer-options";
import { matchesNameOrPhone, optionLabel } from "@/lib/customers";
import { reminderState } from "@/lib/reminders";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Customer, EnumOption } from "@/types/customer";
import { useServiceGroups } from "@/components/common/service-groups";

type Tab = "all" | "overdue" | "today" | "upcoming";
type Patch = { staff_id?: string | null; potential_status?: string | null; follow_up_at?: string | null };

/** Hạn follow-up tô màu chính ô giờ hẹn: quá hạn đỏ, hôm nay cam (input antd tự đặt màu chữ → cần `!`). */
const FOLLOW_UP_TONE: Partial<Record<Exclude<Tab, "all">, string>> = {
  overdue: "[&_input]:text-destructive!",
  today: "[&_input]:text-warning!",
};

/** Mốc liên hệ lại so với `now`: quá hạn (đã qua) / hôm nay (còn trong ngày) / sắp tới; chưa đặt → null. */
const followUpState = (at: string | null | undefined, now: number) =>
  at ? (reminderState({ remind_at: at, done_at: null }, now) as Exclude<Tab, "all">) : null;

export function PotentialManager({
  customers,
  staff,
  options,
  convertedToday,
  appointments,
}: {
  customers: Customer[];
  staff: AppointmentStaff[];
  options: EnumOption[];
  convertedToday: number;
  appointments: PipelineAppointment[];
}) {
  const groups = useServiceGroups();
  const t = useTranslations("potential");
  const tc = useTranslations("customers");
  const locale = useLocale();
  const can = useCan();
  const canEdit = can("customers.edit");
  const canBook = can("appointments.edit");
  const [, start] = useTransition();

  const [search, setSearch] = useState("");
  const [staffId, setStaffId] = useState("");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [chatFor, setChatFor] = useState<MessagesCustomer | null>(null); // modal tin SMAX
  const [convertFor, setConvertFor] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const nearestAppt = useMemo(() => nearestByCustomer(appointments, now), [appointments, now]);

  const [rows, patchOptimistic] = useOptimistic(customers, (state: Customer[], p: Patch & { id: string }) =>
    state.map((c) => (c.id === p.id ? { ...c, ...p } : c)),
  );

  const patchField = (id: string, patch: Patch) =>
    start(async () => {
      patchOptimistic({ id, ...patch });
      const res = await patchCustomer(id, patch);
      if (res.error) toast.error(res.error);
      else toast.success(tc("updateOk"));
    });

  // Option select = chữ trần; chấm màu chỉ ở ô hiển thị trên bảng.
  const statusDefs = options.filter((o) => o.kind === "potential_status");
  const statusOptions = statusDefs.map((o) => ({ value: o.value, label: optionLabel(o, locale) }));
  const statusTag = (v: string | null | undefined) => {
    const o = statusDefs.find((x) => x.value === v);
    return o ? <StatusDot label={optionLabel(o, locale)} color={o.color} /> : DASH;
  };
  // Trang gộp 2 stage: khách Cân nhắc ghi chữ nhạt để phân biệt với Tiềm năng.
  const considerOpt = options.find((o) => o.kind === "stage" && o.value === "consider");

  // Card số liệu tính trên toàn bộ khách tiềm năng (không theo bộ lọc).
  const counts = useMemo(() => {
    const c = { overdue: 0, today: 0 };
    for (const r of rows) {
      const s = followUpState(r.follow_up_at, now);
      if (s === "overdue" || s === "today") c[s]++;
    }
    return c;
  }, [rows, now]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(
        (c) =>
          (!q || matchesNameOrPhone(c.full_name, c.phone, q) || c.notes?.some((n) => n.text.toLowerCase().includes(q))) &&
          (!staffId || c.staff_id === staffId) &&
          (!status || c.potential_status === status) &&
          (tab === "all" || followUpState(c.follow_up_at, now) === tab),
      )
      // Hẹn sớm nhất lên đầu; chưa đặt hẹn xuống cuối (giữ thứ tự mới tạo trước).
      .sort((a, b) => (a.follow_up_at ? Date.parse(a.follow_up_at) : Infinity) - (b.follow_up_at ? Date.parse(b.follow_up_at) : Infinity));
  }, [rows, search, staffId, status, tab, now]);

  // Lọc đổi → về trang 1 (điều chỉnh ngay trong render, không effect).
  const filterKey = `${search}|${staffId}|${status}|${tab}`;
  const [seenKey, setSeenKey] = useState(filterKey);
  if (seenKey !== filterKey) {
    setSeenKey(filterKey);
    setPage(1);
  }

  // Popup 360°: Trước/Tiếp theo danh sách đang lọc.
  const c360 = useCustomer360({ ids: filtered.map((c) => c.id), staff });

  const columns: TableProps<Customer>["columns"] = [
    {
      title: t("colCustomer"),
      key: "customer",
      width: 320,
      render: (_, c) => {
        const last = c.notes?.at(-1)?.text;
        return (
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1 leading-tight">
              {/* Bấm tên → popup hồ sơ 360° (hội thoại SMAX mở bằng icon tin nhắn). */}
              <NamePhone
                phone={c.phone}
                title={c.full_name}
                name={
                  <button
                    type="button"
                    title={tc("openProfile")}
                    onClick={() => c360.open(c.id)}
                    className="max-w-full truncate text-start font-medium hover:text-primary hover:underline"
                  >
                    {c.full_name}
                  </button>
                }
              />
              {last ? (
                <div className="mt-0.5 max-w-72 truncate text-xs text-muted-foreground" title={last}>
                  {last}
                </div>
              ) : null}
            </div>
            {/* Badge = số lần liên hệ lại (ghi chú). */}
            <Badge count={c.notes?.length ?? 0} size="small" overflowCount={9} color="var(--primary)">
              <Button
                type="text"
                size="small"
                aria-label={tc("viewNotes")}
                title={tc("viewNotes")}
                icon={<MessageSquareText className="size-4" />}
                onClick={() => setNotesFor(c.id)}
              />
            </Badge>
          </div>
        );
      },
    },
    // Tin nhắn: icon mở modal 30 tin SMAX gần nhất (chưa có hội thoại → "—").
    {
      title: tc("colMessages"),
      key: "messages",
      width: 90,
      align: "center",
      render: (_, c) =>
        c.thread?.link ? (
          <Button
            type="text"
            size="small"
            onClick={() => setChatFor({ id: c.id, full_name: c.full_name, thread_link: c.thread?.link })}
            aria-label={tc("openThread")}
            title={tc("openThread")}
            icon={<MessageCircleMore className="size-4" />}
          />
        ) : DASH,
    },
    // Danh sách việc follow-up (đã sắp theo giờ liên hệ lại) → cột hành động đứng ngay sau tên.
    {
      title: t("colFollowUp"),
      key: "followUp",
      width: 180,
      render: (_, c) => {
        const s = followUpState(c.follow_up_at, now);
        return (
          <div className={cn(s && FOLLOW_UP_TONE[s])}>
            <AppointmentDate
              inline
              value={c.follow_up_at}
              disabled={!canEdit}
              onSave={(iso) => patchField(c.id, { follow_up_at: iso })}
            />
          </div>
        );
      },
    },
    {
      title: t("colStatus"),
      key: "status",
      width: 190,
      render: (_, c) => (
        <div className="leading-tight">
          <InlineSelect
            value={c.potential_status ?? ""}
            display={statusTag(c.potential_status)}
            // "Chuyển đổi đặt lịch" chỉ hiện khi được tạo lịch hẹn — chọn thì mở form, không lưu ngay.
            options={statusOptions.filter((o) => o.value !== CONVERTED_STATUS || canBook)}
            noneLabel={tc("noneOption")}
            ariaLabel={t("colStatus")}
            disabled={!canEdit}
            onSave={(v) =>
              v === CONVERTED_STATUS ? setConvertFor(c.id) : patchField(c.id, { potential_status: v || null })
            }
          />
          {c.stage === "consider" && considerOpt ? (
            <div className="mt-0.5 text-xs text-muted-foreground">{optionLabel(considerOpt, locale)}</div>
          ) : null}
        </div>
      ),
    },
    // Nhóm dịch vụ: của lịch gần nhất, chưa có thì của khách; không có → để trống.
    {
      title: tc("serviceCategories"),
      key: "serviceGroups",
      width: 140,
      render: (_, c) =>
        groups.label(nearestAppt.get(c.id)?.service_categories) || groups.label(c.service_categories),
    },
    // Sales Status: Status lịch gần nhất của khách (Sales đổi ở trang Lịch hẹn).
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
      title: t("colTele"),
      key: "staff",
      width: 160,
      render: (_, c) => (
        <InlineSelect
          value={c.staff_id ?? ""}
          display={staffName(staff, c.staff_id)}
          options={staffOptions(staff, c.staff_id)}
          noneLabel={tc("noneOption")}
          ariaLabel={t("colTele")}
          disabled={!canEdit}
          onSave={(v) => patchField(c.id, { staff_id: v || null })}
        />
      ),
    },
    { title: tc("colSource"), key: "source", width: 160, render: (_, c) => <SourceCell customer={c} /> },
    {
      title: tc("colCreated"),
      key: "created",
      dataIndex: "created_at",
      width: 120,
      render: (v: string) => <DateTimeCell value={v} />,
    },
  ];

  const activeFilters = [search, staffId, status].filter(Boolean).length;

  return (
    <Page>
      <PageHeader title={t("title")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("kpiTotal")} value={rows.length} />
        <StatCard label={t("kpiOverdue")} value={counts.overdue} tone={counts.overdue ? "destructive" : "muted"} />
        <StatCard label={t("kpiToday")} value={counts.today} />
        <StatCard label={t("kpiConverted")} value={convertedToday} />
      </div>

      <PageToolbar>
        <SearchInput placeholder={t("searchPlaceholder")} value={search} onChange={setSearch} />
        {/* Lọc nhanh dạng nút như Booking Management (Tìm → Tab → Trạng thái → Tele); nút đang chọn viền màu chính. */}
        {(["all", "overdue", "today", "upcoming"] as const).map((k) => (
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
          options={statusOptions}
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
            setStaffId("");
            setStatus("");
          }}
        />
      </PageToolbar>

      <DataTable columns={columns} dataSource={filtered} page={page} onPageChange={setPage} empty={t("empty")}
        onChange={c360.onTableChange} />
      {c360.modal}
      <MessagesModal customer={chatFor} onClose={() => setChatFor(null)} />

      <CustomerNotesDrawer
        customer={rows.find((c) => c.id === notesFor) ?? null}
        staff={staff}
        onClose={() => setNotesFor(null)}
      />

      {/* Chuyển đổi đặt lịch: tạo lịch hẹn xong mới chuyển khách sang Booking; đóng form = không đổi gì. */}
      <CreateAppointmentDrawer
        key={convertFor ?? ""}
        open={convertFor !== null}
        initialCustomer={convertFor ?? ""}
        customers={rows}
        staff={staff}
        onClose={() => setConvertFor(null)}
        onCreated={() => {
          const id = convertFor;
          setConvertFor(null);
          if (!id) return;
          start(async () => {
            const res = await convertPotentialCustomer(id);
            if (res.error) toast.error(res.error);
            else toast.success(t("convertedOk"));
          });
        }}
      />
    </Page>
  );
}
