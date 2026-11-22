"use client";

import { useState } from "react";
import { Button, Select, Tag, type TableProps } from "antd";
import { MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { DataTable } from "@/components/common/data-table";
import { NamePhone } from "@/components/common/name-phone";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { useCustomer360 } from "@/components/customers/customer-360/customer-360-modal";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { kindText } from "@/components/tour/tour-drawer";
import type { Tour } from "@/types/tour";

/** 1 việc đến hạn (tính ở server từ `journey_due_source` — không có tiền). */
export type DueRow = {
  key: string;
  customer: { id: string; full_name: string; phone: string; staff_id: string | null; thread_link: string | null; next_at: string | null };
  task: "laser_check" | "retouch";
  n: number;
  due: string; // YYYY-MM-DD
  service: string;
  last: Pick<Tour, "tour_date" | "service_detail" | "service_session">;
};

const RANGES = ["todo", "soon", "booked", "all"] as const;
const SOON_DAYS = 7;
const UNASSIGNED = "none";

/** Số ngày từ hôm nay tới hạn (âm = quá hạn). */
const daysLeft = (due: string) => dayjs(due).diff(dayjs().format("YYYY-MM-DD"), "day");
/** SĐT Indonesia 08… → wa.me/628… */
const waLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "").replace(/^0/, "62")}`;

/**
 * Khách hàng → Đến hạn liệu trình: Telesales gọi khách kiểm tra laser (20 ngày) / dặm (45 ngày).
 * Đặt lịch hẹn → "Đã hẹn" (ẩn khỏi Cần gọi); tạo tour mới trong thẻ → mục tự hết. Telesales mặc định thấy khách của mình.
 */
export function JourneyDueTable({ rows, staff, me }: {
  rows: DueRow[];
  staff: StaffRef[];
  me: { id: string; telesales: boolean };
}) {
  const t = useTranslations("journey");
  const tt = useTranslations("tour");
  const [range, setRange] = useState<(typeof RANGES)[number]>("todo");
  const [owner, setOwner] = useState(me.telesales ? me.id : "all");
  const [page, setPage] = useState(1);
  const staffById = new Map(staff.map((s) => [s.id, s]));
  // Khách chưa gán Telesales / Telesales đã nghỉ → "Chưa phân" để leader chia lại.
  const ownerOf = (r: DueRow) => {
    const s = r.customer.staff_id ? staffById.get(r.customer.staff_id) : undefined;
    return s && s.status !== "banned" ? s.id : UNASSIGNED;
  };
  const owners = [...new Set(rows.map(ownerOf))].filter((id) => id !== UNASSIGNED)
    .map((id) => staffById.get(id)!).sort((a, b) => a.user_name.localeCompare(b.user_name));
  const filtered = rows.filter((r) => {
    const d = daysLeft(r.due);
    const booked = !!r.customer.next_at;
    return (owner === "all" || ownerOf(r) === owner) && (range === "all"
      || (range === "booked" ? booked : !booked && (range === "todo" ? d <= 0 : d > 0 && d <= SOON_DAYS)));
  });
  const c360 = useCustomer360({ ids: filtered.map((r) => r.customer.id), staff });

  const columns: TableProps<DueRow>["columns"] = [
    { title: t("dueDate"), width: 150, fixed: "left", render: (_, r) => {
      const d = daysLeft(r.due);
      return <div className="leading-tight tabular-nums">
        {dayjs(r.due).format("DD/MM/YYYY")}
        <div>{d < 0 ? <Tag color="red" className="me-0">{t("overdueDays", { n: -d })}</Tag>
          : d === 0 ? <Tag color="orange" className="me-0">{t("dueToday")}</Tag>
          : <Tag color={d <= SOON_DAYS ? "blue" : "default"} className="me-0">{t("daysLeft", { n: d })}</Tag>}</div>
      </div>;
    } },
    { title: t("customer"), width: 200, render: (_, r) => <NamePhone phone={r.customer.phone} name={
      <button type="button" title={t("openProfile")} aria-label={t("openProfile")} className="font-medium hover:text-primary hover:underline"
        onClick={() => c360.open(r.customer.id)}>{r.customer.full_name}</button>} /> },
    { title: t("task"), width: 230, render: (_, r) => <div className="leading-tight">
      <Tag color={r.task === "laser_check" ? "gold" : "cyan"} className="me-0">
        {r.task === "laser_check" ? t("taskCheck", { kind: tt(`detail_${r.last.service_detail ?? "laser"}`) })
          : `${tt("detail_retouch")} ${r.n}`}
      </Tag>
      <div className="mt-1 text-xs text-muted-foreground">{r.service}</div>
      {r.customer.next_at ? <Tag color="green" className="mt-1 me-0">
        {t("booked", { date: dayjs(r.customer.next_at).format("DD/MM HH:mm") })}
      </Tag> : null}
    </div> },
    { title: t("lastTour"), width: 170, render: (_, r) => <span className="tabular-nums">
      {dayjs(r.last.tour_date).format("DD/MM/YYYY")}<span className="text-muted-foreground"> · {kindText(tt, r.last)}</span>
    </span> },
    { title: t("telesales"), width: 170, render: (_, r) => {
      const id = ownerOf(r);
      return id === UNASSIGNED ? <span className="text-muted-foreground">{t("unassigned")}</span> : staffLabel(staffById.get(id)!);
    } },
    { title: t("contact"), width: 130, render: (_, r) => <div className="flex gap-1">
      <Button size="small" type="text" href={`tel:${r.customer.phone}`} aria-label={t("call")} title={t("call")}
        icon={<Phone className="size-4" />} />
      {/* Ưu tiên chat SMAX (tin vào lịch sử hội thoại); khách không có hội thoại SMAX → WhatsApp. */}
      <Button size="small" type="text" target="_blank" rel="noopener noreferrer"
        href={r.customer.thread_link || waLink(r.customer.phone)}
        aria-label={r.customer.thread_link ? t("chat") : t("whatsapp")} title={r.customer.thread_link ? t("chat") : t("whatsapp")}
        icon={<MessageCircle className="size-4" />} />
    </div> },
  ];

  return <Page>
    <PageHeader title={t("title")} />
    <p className="-mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
    <PageToolbar>
      <Select value={range} aria-label={t("dueRange")} className="min-w-40" onChange={(v) => { setRange(v); setPage(1); }}
        options={RANGES.map((v) => ({ value: v, label: t(`range.${v}`) }))} />
      <Select value={owner} aria-label={t("telesales")} className="min-w-48" showSearch={{ optionFilterProp: "title" }}
        onChange={(v) => { setOwner(v); setPage(1); }}
        options={[{ value: "all", title: t("allTelesales"), label: t("allTelesales") },
          ...owners.map((s) => ({ value: s.id, title: s.user_name, label: staffLabel(s) })),
          { value: UNASSIGNED, title: t("unassigned"), label: t("unassigned") }]} />
    </PageToolbar>
    <DataTable columns={columns} dataSource={filtered} rowKey="key" scroll={{ x: 1050 }} empty={t("dueEmpty")}
      page={page} onPageChange={setPage} />
    {c360.modal}
  </Page>;
}
