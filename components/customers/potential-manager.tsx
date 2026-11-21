"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Button, Input, type TableProps } from "antd";
import dayjs from "dayjs";
import { useLocale, useTranslations } from "next-intl";
import { MessageSquareText, Search, X } from "lucide-react";

import { convertPotentialCustomer, patchCustomer } from "@/app/(app)/customers/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { CreateAppointmentDrawer, VisitStatusTag, type AppointmentStaff } from "@/components/appointments/appointments-manager";
import { ClearableSelect } from "@/components/common/clearable-select";
import { DataTable } from "@/components/common/data-table";
import { Open360Button, useCustomer360 } from "@/components/customers/customer-360/customer-360-modal";
import { EnumTag } from "@/components/common/enum-tag";
import { InlineSelect } from "@/components/common/inline-select";
import { useCan } from "@/components/common/permissions";
import { StatCard } from "@/components/common/stat-card";
import { staffLabel } from "@/components/common/user-avatar";
import type { PipelineAppointment } from "@/components/customers/customer-pipeline";
import { CustomerNotesDrawer, SourceCell } from "@/components/customers/customers-manager";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { nearestByCustomer } from "@/lib/appointments";
import { CONVERTED_STATUS } from "@/lib/customer-options";
import { matchesNameOrPhone, optionLabel } from "@/lib/customers";
import { reminderState } from "@/lib/reminders";
import { toast } from "@/lib/toast";
import type { Customer, EnumOption } from "@/types/customer";
import { TELESALES_DEPARTMENTS } from "@/types/user";
import { useServiceGroups } from "@/components/common/service-groups";

type Tab = "all" | "overdue" | "today" | "upcoming";
type Patch = { staff_id?: string | null; potential_status?: string | null; follow_up_at?: string | null };

const DASH = <span className="text-muted-foreground">—</span>;

/** Trạng thái hạn follow-up = chữ nhỏ màu ngữ nghĩa (không tag — ô đã có giờ hẹn là điểm nhấn). */
const FOLLOW_UP_TONE: Record<Exclude<Tab, "all">, string> = {
  overdue: "text-destructive",
  today: "text-warning",
  upcoming: "text-muted-foreground",
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
  const tCommon = useTranslations("common");
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

  // Option select = chữ trần; tag màu chỉ ở ô hiển thị trên bảng.
  const statusDefs = options.filter((o) => o.kind === "potential_status");
  const statusOptions = statusDefs.map((o) => ({ value: o.value, label: optionLabel(o, locale) }));
  const statusTag = (v: string | null | undefined) => {
    const o = statusDefs.find((x) => x.value === v);
    return o ? <EnumTag label={optionLabel(o, locale)} color={o.color} /> : DASH;
  };
  // Trang gộp 2 stage: khách Cân nhắc ghi chữ nhạt để phân biệt với Tiềm năng (1 ô tối đa 1 tag).
  const considerOpt = options.find((o) => o.kind === "stage" && o.value === "consider");
  const teleOptions = staff
    .filter((s) => TELESALES_DEPARTMENTS.includes(s.department ?? ""))
    .map((s) => ({ value: s.id, label: staffLabel(s) }));
  const staffDisplay = (id: string | null) => {
    const s = id ? staff.find((x) => x.id === id) : undefined;
    return s ? staffLabel(s) : DASH;
  };

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
              <div className="truncate font-medium" title={c.full_name}>
                {c.thread?.link ? (
                  <a href={c.thread.link} target="_blank" rel="noreferrer" title={tc("openThread")}>
                    {c.full_name}
                  </a>
                ) : (
                  c.full_name
                )}
              </div>
              {/* SĐT · nhóm dịch vụ của lịch gần nhất (như ô Khách hàng ở Sales Management). */}
              <div className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
                {[c.phone, groups.label(nearestAppt.get(c.id)?.service_categories) || groups.label(c.service_categories)].filter(Boolean).join(" · ")}
              </div>
              {last ? (
                <div className="mt-0.5 max-w-72 truncate text-xs text-muted-foreground" title={last}>
                  {last}
                </div>
              ) : null}
            </div>
            <Button
              type="text"
              size="small"
              aria-label={tc("viewNotes")}
              title={tc("viewNotes")}
              icon={<MessageSquareText className="size-4" />}
              onClick={() => setNotesFor(c.id)}
            />
            <Open360Button onClick={() => c360.open(c.id)} />
          </div>
        );
      },
    },
    // Danh sách việc follow-up (đã sắp theo giờ liên hệ lại) → cột hành động đứng ngay sau tên.
    {
      title: t("colFollowUp"),
      key: "followUp",
      width: 180,
      render: (_, c) => {
        const s = followUpState(c.follow_up_at, now);
        return (
          <div className="leading-tight">
            <AppointmentDate
              inline
              value={c.follow_up_at}
              disabled={!canEdit}
              onSave={(iso) => patchField(c.id, { follow_up_at: iso })}
            />
            {s ? <div className={`mt-0.5 text-xs ${FOLLOW_UP_TONE[s]}`}>{t(`tab.${s}`)}</div> : null}
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
          <div className="mt-0.5 text-xs text-muted-foreground">
            {c.stage === "consider" && considerOpt ? `${optionLabel(considerOpt, locale)} · ` : null}
            {t("followUps", { n: c.notes?.length ?? 0 })}
          </div>
        </div>
      ),
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
          display={staffDisplay(c.staff_id)}
          options={[
            ...teleOptions,
            ...(c.staff_id && !teleOptions.some((o) => o.value === c.staff_id)
              ? [{ value: c.staff_id, label: staffDisplay(c.staff_id) }]
              : []),
          ]}
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
      render: (v: string) => (
        <div className="leading-tight tabular-nums">
          <div>{dayjs(v).format("DD/MM/YYYY")}</div>
          <div className="text-xs text-muted-foreground">{dayjs(v).format("HH:mm")}</div>
        </div>
      ),
    },
  ];

  const activeFilters = [search, staffId, status].filter(Boolean).length;

  return (
    <Page>
      <PageHeader title={t("title")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("kpiTotal")} value={rows.length} />
        <StatCard
          label={t("kpiOverdue")}
          value={<span className={counts.overdue ? "text-destructive" : undefined}>{counts.overdue}</span>}
        />
        <StatCard label={t("kpiToday")} value={counts.today} />
        <StatCard label={t("kpiConverted")} value={convertedToday} />
      </div>

      <PageToolbar>
        <Input
          allowClear
          className="w-full sm:max-w-72"
          prefix={<Search className="size-4 text-muted-foreground" />}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
          options={teleOptions}
          placeholder={t("allTele")}
          ariaLabel={t("colTele")}
        />
        {activeFilters > 0 && (
          <Button
            type="text"
            icon={<X className="size-4" />}
            onClick={() => {
              setSearch("");
              setStaffId("");
              setStatus("");
            }}
          >
            {tCommon("clearFilters")}
          </Button>
        )}
      </PageToolbar>

      <DataTable columns={columns} dataSource={filtered} page={page} onPageChange={setPage} empty={t("empty")}
        onChange={c360.onTableChange} />
      {c360.modal}

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
