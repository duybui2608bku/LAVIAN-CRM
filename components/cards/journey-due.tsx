"use client";

import { useState } from "react";
import { Select, Tag, type TableProps } from "antd";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import type { CardMe } from "@/components/cards/card-drawer";
import { DataTable } from "@/components/common/data-table";
import { NamePhone } from "@/components/common/name-phone";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { PageToolbar } from "@/components/layout/page";
import { kindText } from "@/components/tour/tour-drawer";
import type { JourneyDue } from "@/lib/cards";
import type { TreatmentCard } from "@/types/card";
import type { Service } from "@/types/service";
import type { Tour } from "@/types/tour";

export type DueRow = JourneyDue<TreatmentCard, Tour>;
const RANGES = ["all", "overdue", "today", "soon"] as const;
const SOON_DAYS = 7;

/** Số ngày từ hôm nay tới hạn (âm = quá hạn). */
const daysLeft = (due: string) => dayjs(due).diff(dayjs().format("YYYY-MM-DD"), "day");

/**
 * Tab "Đến hạn" ở Thẻ liệu trình: kiểm tra laser (20 ngày) / dặm (45 ngày) tự tính từ thẻ + tour (`journeyDue`).
 * Gọi khách xong → tạo tour mới trong thẻ là mục tự biến mất. Sales bán thẻ phụ trách; không phải admin mặc định thấy thẻ của mình.
 */
export function JourneyDueTable({ rows, staff, services, me, onOpenCard, onOpenCustomer }: {
  rows: DueRow[];
  staff: StaffRef[];
  services: Service[];
  me: CardMe;
  onOpenCard: (cardId: string) => void;
  onOpenCustomer: (customerId: string) => void;
}) {
  const t = useTranslations("cards");
  const tt = useTranslations("tour");
  const [range, setRange] = useState<(typeof RANGES)[number]>("all");
  const [seller, setSeller] = useState(me.isAdmin ? "all" : me.id);
  const [page, setPage] = useState(1);
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const sellers = [...new Set(rows.map((r) => r.card.created_by).filter((id): id is string => !!id))]
    .map((id) => staffById.get(id)).filter((s): s is StaffRef => !!s);
  const filtered = rows.filter((r) => {
    const d = daysLeft(r.due);
    return (seller === "all" || r.card.created_by === seller)
      && (range === "all" || (range === "overdue" ? d < 0 : range === "today" ? d === 0 : d > 0 && d <= SOON_DAYS));
  });

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
    { title: t("customer"), width: 200, render: (_, r) => <NamePhone phone={r.card.customer?.phone} name={
      <button type="button" title={t("openProfile")} aria-label={t("openProfile")} className="font-medium hover:text-primary hover:underline"
        onClick={(e) => { e.stopPropagation(); onOpenCustomer(r.card.customer_id); }}>{r.card.customer?.full_name ?? "—"}</button>} /> },
    { title: t("task"), width: 240, render: (_, r) => <div className="leading-tight">
      <Tag color={r.task === "laser_check" ? "gold" : "cyan"} className="me-0">
        {r.task === "laser_check" ? t("taskCheck", { kind: tt(`detail_${r.last.service_detail ?? "laser"}`) })
          : `${tt("detail_retouch")} ${r.n}`}
      </Tag>
      <div className="mt-1 text-xs text-muted-foreground">{services.find((s) => s.id === r.item.service_id)?.name ?? "—"}</div>
    </div> },
    { title: t("lastTour"), width: 170, render: (_, r) => <span className="tabular-nums">
      {dayjs(r.last.tour_date).format("DD/MM/YYYY")}<span className="text-muted-foreground"> · {kindText(tt, r.last)}</span>
    </span> },
    { title: t("code"), width: 120, render: (_, r) => <span className="font-medium text-primary">{r.card.code}</span> },
    { title: t("seller"), width: 170, render: (_, r) => {
      const s = r.card.created_by ? staffById.get(r.card.created_by) : undefined;
      return s ? staffLabel(s) : <span className="text-muted-foreground">—</span>;
    } },
  ];

  return <>
    <PageToolbar>
      <Select value={range} aria-label={t("dueRange")} className="min-w-40" onChange={(v) => { setRange(v); setPage(1); }}
        options={RANGES.map((v) => ({ value: v, label: t(`range.${v}`) }))} />
      <Select value={seller} aria-label={t("seller")} className="min-w-48" showSearch={{ optionFilterProp: "title" }}
        onChange={(v) => { setSeller(v); setPage(1); }}
        options={[{ value: "all", title: t("allSellers"), label: t("allSellers") },
          ...sellers.map((s) => ({ value: s.id, title: s.user_name, label: staffLabel(s) }))]} />
    </PageToolbar>
    <DataTable columns={columns} dataSource={filtered} rowKey={(r) => `${r.card.id}:${r.item.id}:${r.task}`}
      scroll={{ x: 1050 }} empty={t("dueEmpty")} page={page} onPageChange={setPage}
      onRow={(r) => ({ onClick: () => onOpenCard(r.card.id), className: "cursor-pointer" })} />
  </>;
}
