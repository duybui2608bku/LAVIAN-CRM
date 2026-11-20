"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Drawer, Empty, Skeleton, Tag, Timeline } from "antd";
import dayjs from "dayjs";
import { useLocale, useTranslations } from "next-intl";

import { getCustomerAppointments, type CustomerAppointmentsData } from "@/app/(app)/customers/actions";
import { NoteItem } from "@/components/common/notes";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { formatRupiah } from "@/lib/currency";
import { serviceName } from "@/lib/customers";
import { SERVICE_CATEGORY_LABELS, type ServiceCategory } from "@/types/service";
import {
  BOOKING_STATUSES, VISIT_STATUSES,
  type Appointment, type AppointmentLog, type AppointmentLogField, type BookingStatus, type VisitStatus,
} from "@/types/appointment";

// checked_in: log cũ (trước khi có Status 5 bước) — log mới ghi visit_status.
const FIELDS: AppointmentLogField[] = ["scheduled_at", "booking_confirm", "visit_status", "checked_in", "service_categories", "service_ids",
  "staff_id", "sales_id", "technician_id", "bill_amount", "paid_amount", "note", "sales_note"];
const ACTION_COLOR = { create: "green", update: "blue", delete: "red" } as const;
const fmt = (v: string, f = "DD-MM-YYYY HH:mm") => dayjs(v).format(f);

/** Drawer cột Lịch hẹn ở /customers: mọi lịch hẹn của khách + lịch sử thay đổi (ai, lúc nào, cũ → mới). */
export function AppointmentHistoryDrawer({
  customer,
  staff,
  onClose,
}: {
  customer: { id: string; full_name: string } | null;
  staff: StaffRef[];
  onClose: () => void;
}) {
  const t = useTranslations("customers.apptHistory");
  const tStatus = useTranslations("appointments.bookingStatus");
  const tVisit = useTranslations("appointments.visitStatus");
  const locale = useLocale();
  const [data, setData] = useState<(CustomerAppointmentsData & { error?: string; for: string; now: number }) | null>(null);
  const [loading, startLoading] = useTransition();
  const requestId = useRef(0);
  const customerId = customer?.id;

  // Mở drawer cho khách nào → tải lại dữ liệu khách đó; bỏ kết quả của request cũ.
  useEffect(() => {
    if (!customerId) return;
    const current = ++requestId.current;
    startLoading(async () => {
      const res = await getCustomerAppointments(customerId);
      if (current === requestId.current) setData({ ...res, for: customerId, now: Date.now() });
    });
  }, [customerId]);

  const now = data?.now ?? 0; // mốc "bây giờ" lấy lúc tải xong
  const staffOf = (id: unknown) => {
    const s = typeof id === "string" ? staff.find((x) => x.id === id) : undefined;
    return s ? staffLabel(s) : "—";
  };
  const servicesOf = (ids: unknown) => {
    if (!Array.isArray(ids) || ids.length === 0) return "—";
    return ids
      .map((id) => {
        const s = data?.services.find((x) => x.id === id);
        return s ? serviceName(s, locale) : String(id);
      })
      .join(", ");
  };
  const categoriesOf = (cats: unknown) =>
    Array.isArray(cats) && cats.length
      ? cats.map((c) => SERVICE_CATEGORY_LABELS[c as ServiceCategory] ?? String(c)).join(", ")
      : "—";
  const valueOf = (field: AppointmentLogField, v: unknown): React.ReactNode => {
    if (v === null || v === undefined || v === "") return "—";
    switch (field) {
      case "scheduled_at":
        return fmt(String(v));
      case "booking_confirm":
        return BOOKING_STATUSES.includes(v as BookingStatus) ? tStatus(v as BookingStatus) : String(v);
      case "visit_status":
        return VISIT_STATUSES.includes(v as VisitStatus) ? tVisit(v as VisitStatus) : String(v);
      case "checked_in":
        return v ? t("yes") : t("no");
      case "service_categories":
        return categoriesOf(v);
      case "service_ids":
        return servicesOf(v);
      case "staff_id":
      case "sales_id":
      case "technician_id":
        return staffOf(v);
      case "bill_amount":
      case "paid_amount":
        return formatRupiah(Number(v));
      case "note":
      case "sales_note":
        return <span className="whitespace-pre-wrap">{String(v)}</span>;
    }
  };

  const changeLines = (log: AppointmentLog) =>
    FIELDS.filter((f) => f in log.changes)
      .map((f) => ({ f, ...log.changes[f]! }))
      // Tạo mới: chỉ liệt kê giá trị có nội dung (bỏ ghi chú trống, chưa đến, không dịch vụ).
      .filter((c) => log.action !== "create" || (c.new !== "" && c.new !== false && c.new !== "pending" && !(Array.isArray(c.new) && !c.new.length) && c.new !== null))
      .map((c) => (
        <li key={c.f} className="flex flex-wrap items-center gap-x-1.5">
          <span className="text-muted-foreground">{t(`field.${c.f}`)}:</span>
          {log.action === "update" && (
            <>
              <span className="line-through opacity-60">{valueOf(c.f, c.old)}</span>
              <span aria-hidden>→</span>
            </>
          )}
          <span className="font-medium">{valueOf(c.f, c.new)}</span>
        </li>
      ));

  const apptCard = (a: Appointment) => {
    const upcoming = Date.parse(a.scheduled_at) >= now;
    return (
      <li key={a.id} className="space-y-1.5 rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color={upcoming ? "blue" : a.checked_in ? "green" : "default"} className="me-0 tabular-nums">
            {fmt(a.scheduled_at)}
          </Tag>
          <span className="text-xs text-muted-foreground">
            {upcoming ? t("upcoming") : a.checked_in ? t("checkedIn") : t("notCheckedIn")}
          </span>
        </div>
        <p className="text-sm">
          <span className="text-muted-foreground">{t("field.service_categories")}: </span>
          {categoriesOf(a.service_categories)}
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">{t("field.service_ids")}: </span>
          {servicesOf(a.service_ids)}
        </p>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{t("field.staff_id")}:</span>
          {staffOf(a.staff_id)}
        </div>
        {/* Ghi chú lịch hẹn (timeline) — mới nhất trước. */}
        {a.notes?.length ? <div className="space-y-2 pt-1">
          {[...a.notes].reverse().map((n) => <NoteItem key={n.id} note={n} staff={staff} clamp />)}
        </div> : null}
      </li>
    );
  };

  // Chỉ hiện dữ liệu của đúng khách đang mở (tránh nháy dữ liệu khách trước).
  const showData = data?.for === customerId && !loading;

  return (
    <Drawer
      open={customer !== null}
      onClose={onClose}
      size={560}
      destroyOnHidden
      title={customer ? t("title", { name: customer.full_name }) : ""}
    >
      {!showData || !data ? (
        <Skeleton active />
      ) : data.error ? (
        <p className="text-destructive">{data.error}</p>
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t("appointments", { count: data.appointments.length })}</h3>
            {data.appointments.length ? (
              <ul className="space-y-2">{data.appointments.map(apptCard)}</ul>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noAppointments")} />
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("history")}</h3>
            {data.logs.length ? (
              <Timeline
                items={data.logs.map((log) => ({
                  key: log.id,
                  color: ACTION_COLOR[log.action],
                  content: (
                    <div className="space-y-1 text-sm">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="tabular-nums">{fmt(log.created_at, "DD-MM-YYYY HH:mm:ss")}</span>
                        <span aria-hidden>·</span>
                        {log.actor_id ? staffOf(log.actor_id) : t("systemActor")}
                      </div>
                      <p className="font-medium">
                        {t(`action.${log.action}`)}
                        {log.appointment && (
                          <span className="tabular-nums"> {fmt(log.appointment.scheduled_at, "DD-MM HH:mm")}</span>
                        )}
                      </p>
                      <ul className="space-y-0.5">{changeLines(log)}</ul>
                    </div>
                  ),
                }))}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noHistory")} />
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}
