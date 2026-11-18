"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Calendar, Empty, Input } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";

import { ClearableSelect } from "@/components/common/clearable-select";
import { useCan, useCurrentUserId } from "@/components/common/permissions";
import type { StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { ReminderFormModal, assigneeOptions } from "@/components/reminders/reminder-form-modal";
import { ReminderItem } from "@/components/reminders/reminder-item";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { reminderState } from "@/lib/reminders";
import { cn } from "@/lib/utils";
import type { ReminderState, ReminderWithCustomer } from "@/types/reminder";

type Status = "" | "pending" | "overdue" | "done";

const BADGE: Record<ReminderState, "error" | "warning" | "processing" | "default"> = {
  overdue: "error",
  today: "warning",
  upcoming: "processing",
  done: "default",
};
const MAX_CHIPS = 3;
const dayKey = (v: string | Dayjs) => dayjs(v).format("YYYY-MM-DD");

/**
 * Trang calendar lịch nhắc hẹn: lịch tháng (desktop: chip giờ + tên khách; điện thoại: chấm)
 * + panel bên phải liệt kê lịch nhắc ngày đang chọn (hoặc mọi lịch quá hạn khi lọc "Quá hạn").
 * Lọc client-side: nhân viên phụ trách, trạng thái, tên/SĐT khách.
 */
export function RemindersCalendar({
  title,
  reminders,
  staff,
  initialDate,
}: {
  title: string;
  reminders: ReminderWithCustomer[];
  staff: StaffRef[];
  initialDate?: string;
}) {
  const t = useTranslations("reminders");
  const tc = useTranslations("common");
  const can = useCan();
  const canEdit = can("customers.edit");
  const me = useCurrentUserId();
  const mobile = useIsMobile();
  const [now] = useState(() => Date.now());

  const [selected, setSelected] = useState(() => dayjs(initialDate ?? undefined));
  // Mặc định "Của tôi" nếu mình có lịch nhắc được giao; không thì xem tất cả.
  const [assignee, setAssignee] = useState(() => (me && reminders.some((r) => r.assignee_id === me) ? me : ""));
  const [status, setStatus] = useState<Status>("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ReminderWithCustomer | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reminders.filter((r) => {
      if (assignee && r.assignee_id !== assignee) return false;
      const s = reminderState(r, now);
      if (status === "pending" && s === "done") return false;
      if (status === "overdue" && s !== "overdue") return false;
      if (status === "done" && s !== "done") return false;
      if (!q) return true;
      return (
        !!r.customer &&
        (r.customer.full_name.toLowerCase().includes(q) || (r.customer.phone ?? "").includes(q))
      );
    });
  }, [reminders, assignee, status, search, now]);

  const byDay = useMemo(() => {
    const map = new Map<string, ReminderWithCustomer[]>();
    for (const r of filtered) {
      const k = dayKey(r.remind_at);
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return map;
  }, [filtered]);

  // Đếm nhanh (theo nhân viên + tìm kiếm, bỏ qua lọc trạng thái) cho nút Hôm nay / Quá hạn.
  const counts = useMemo(() => {
    let today = 0;
    let overdue = 0;
    for (const r of reminders) {
      if (assignee && r.assignee_id !== assignee) continue;
      const s = reminderState(r, now);
      if (s === "overdue") overdue++;
      else if (s === "today") today++;
    }
    return { today, overdue };
  }, [reminders, assignee, now]);

  // Lọc "Quá hạn": panel liệt kê mọi lịch quá hạn (thường rải nhiều ngày); còn lại theo ngày đang chọn.
  const overdueMode = status === "overdue";
  const panelItems = overdueMode ? filtered : byDay.get(dayKey(selected)) ?? [];

  const goToday = () => {
    setSelected(dayjs());
    if (status === "overdue") setStatus("");
  };

  const dateCell = (d: Dayjs) => {
    const items = byDay.get(dayKey(d));
    if (!items?.length) return null;
    if (mobile) {
      // Lịch thu gọn: chấm màu theo lịch "gấp" nhất trong ngày.
      const worst = items.map((r) => reminderState(r, now)).sort((a, b) => order(a) - order(b))[0];
      return (
        <div className="flex justify-center">
          <Badge status={BADGE[worst]} />
        </div>
      );
    }
    return (
      <ul className="m-0 list-none space-y-0.5 p-0">
        {items.slice(0, MAX_CHIPS).map((r) => (
          <li key={r.id} className="truncate text-xs leading-5">
            <Badge
              status={BADGE[reminderState(r, now)]}
              text={
                <span className={cn("text-xs", r.done_at && "text-muted-foreground line-through")}>
                  <span className="tabular-nums">{dayjs(r.remind_at).format("HH:mm")}</span> {r.customer?.full_name}
                </span>
              }
            />
          </li>
        ))}
        {items.length > MAX_CHIPS && (
          <li className="text-xs text-muted-foreground">{t("more", { n: items.length - MAX_CHIPS })}</li>
        )}
      </ul>
    );
  };

  const activeFilters = !!(assignee || status || search);

  return (
    <Page>
      <PageHeader title={title} description={t("pageHint")} />

      <PageToolbar>
        <Button onClick={goToday}>
          {t("today")}
          {counts.today > 0 && <Badge count={counts.today} size="small" color="orange" />}
        </Button>
        <Button
          danger={counts.overdue > 0}
          type={overdueMode ? "primary" : "default"}
          onClick={() => setStatus(overdueMode ? "" : "overdue")}
        >
          {t("state.overdue")}
          {counts.overdue > 0 && !overdueMode && <Badge count={counts.overdue} size="small" />}
        </Button>
        <ClearableSelect
          className="min-w-44"
          value={assignee}
          onChange={setAssignee}
          options={[
            ...(me ? [{ value: me, label: t("mine") }] : []),
            ...assigneeOptions(staff).filter((o) => o.value !== me),
          ]}
          placeholder={t("allStaff")}
          ariaLabel={t("assignee")}
        />
        <ClearableSelect
          className="min-w-36"
          value={status}
          onChange={(v) => setStatus(v as Status)}
          options={(["pending", "overdue", "done"] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))}
          placeholder={t("status.all")}
          ariaLabel={t("statusLabel")}
        />
        <Input
          allowClear
          className="w-full sm:max-w-56"
          prefix={<Search className="size-4 text-muted-foreground" />}
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {activeFilters && (
          <Button
            type="text"
            icon={<X className="size-4" />}
            onClick={() => {
              setAssignee("");
              setStatus("");
              setSearch("");
            }}
          >
            {tc("clearFilters")}
          </Button>
        )}
      </PageToolbar>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="surface overflow-hidden px-3 pb-2">
          <Calendar
            fullscreen={!mobile}
            value={selected}
            onSelect={(d, info) => {
              setSelected(d);
              // Bấm 1 ngày khi đang lọc Quá hạn → quay về xem theo ngày.
              if (info.source === "date" && overdueMode) setStatus("");
            }}
            cellRender={(d, info) => (info.type === "date" ? dateCell(d) : info.originNode)}
          />
        </div>

        <section className="surface flex flex-col gap-3 p-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:overflow-y-auto">
          <header className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold first-letter:uppercase">
              {overdueMode ? t("state.overdue") : selected.format("dddd, DD/MM/YYYY")}
            </h2>
            <span className="text-sm text-muted-foreground">{t("count", { n: panelItems.length })}</span>
          </header>
          {panelItems.length ? (
            panelItems.map((r) => (
              <ReminderItem
                key={r.id}
                reminder={r}
                customer={r.customer}
                staff={staff}
                now={now}
                timeFormat={overdueMode ? "DD-MM HH:mm" : "HH:mm"}
                canEdit={canEdit}
                onEdit={() => setEditing(r)}
              />
            ))
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("emptyDay")} />
          )}
          <p className="m-0 text-xs text-muted-foreground">{t("createHint")}</p>
        </section>
      </div>

      {editing && (
        <ReminderFormModal
          open
          customerId={editing.customer_id}
          customerName={editing.customer?.full_name ?? ""}
          editing={editing}
          defaults={editing}
          staff={staff}
          onClose={() => setEditing(null)}
        />
      )}
    </Page>
  );
}

// Thứ tự "gấp": quá hạn → hôm nay → sắp tới → đã xong.
const order = (s: ReminderState) => ["overdue", "today", "upcoming", "done"].indexOf(s);
