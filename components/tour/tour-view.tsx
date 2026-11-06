"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DatePicker, Select, Table, Tag, type TableProps } from "antd";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { tourAmount, tourRate, type ServiceDetail } from "@/lib/appointments";
import { formatRupiah } from "@/lib/currency";

export type TourRow = {
  id: string;
  scheduled_at: string;
  service_detail: ServiceDetail | null;
  service_session: number | null;
  bill_amount: number | null;
  customer: { full_name: string } | null;
};

const DASH = <span className="text-muted-foreground">—</span>;

/** Tiền tour theo tháng của một kỹ thuật viên (chỉ đọc). `technicians` != null → admin, được chọn KTV. */
export function TourView({ rows, technicianId, technicians }: {
  rows: TourRow[];
  technicianId: string;
  technicians: StaffRef[] | null;
}) {
  const t = useTranslations("tour");
  const ta = useTranslations("appointments");
  const router = useRouter();
  const [month, setMonth] = useState(() => dayjs().startOf("month"));

  const monthRows = rows
    .filter((row) => dayjs(row.scheduled_at).isSame(month, "month"))
    .map((row) => ({ ...row, tour: tourAmount(row.service_detail, row.service_session, row.bill_amount) }));
  const totalTour = monthRows.reduce((sum, row) => sum + (row.tour ?? 0), 0);
  const totalBill = monthRows.reduce((sum, row) => sum + (row.bill_amount ?? 0), 0);
  const missing = monthRows.filter((row) => row.tour == null).length;

  const columns: TableProps<(typeof monthRows)[number]>["columns"] = [
    { title: t("date"), width: 150, render: (_, row) => dayjs(row.scheduled_at).format("DD/MM/YYYY HH:mm") },
    { title: t("customer"), render: (_, row) => <span className="font-medium">{row.customer?.full_name ?? "—"}</span> },
    { title: ta("serviceDetail"), width: 160, render: (_, row) => row.service_detail
      ? <Tag color="cyan" className="me-0">
          {ta(`detail_${row.service_detail}`)}{row.service_session ? ` ${row.service_session}` : ""}
        </Tag>
      : DASH },
    { title: ta("bill"), width: 150, align: "right", render: (_, row) =>
      row.bill_amount == null ? DASH : <span className="tabular-nums">{formatRupiah(row.bill_amount)}</span> },
    { title: "%", width: 70, align: "right", render: (_, row) =>
      row.service_detail ? `${Math.round(tourRate(row.service_detail, row.service_session) * 100)}%` : DASH },
    { title: ta("tour"), width: 140, align: "right", render: (_, row) =>
      row.tour == null ? DASH : <span className="tabular-nums font-medium">{formatRupiah(row.tour)}</span> },
  ];

  return <Page>
    <PageHeader title={t("title")} />
    <PageToolbar>
      <DatePicker picker="month" value={month} allowClear={false} format="MM/YYYY" aria-label={t("month")}
        onChange={(d) => d && setMonth(d.startOf("month"))} />
      {technicians ? <Select className="min-w-56" value={technicianId} aria-label={t("technician")}
        showSearch={{ optionFilterProp: "title" }}
        options={technicians.map((s) => ({ value: s.id, title: s.user_name, label: staffLabel(s) }))}
        onChange={(id) => router.push(`/tour?technician=${id}`)} /> : null}
    </PageToolbar>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat label={t("totalTour")} value={formatRupiah(totalTour)} strong />
      <Stat label={t("totalBill")} value={formatRupiah(totalBill)} />
      <Stat label={t("count")} value={String(monthRows.length)}
        hint={missing ? t("missing", { count: missing }) : undefined} />
    </div>
    <Table className="surface overflow-hidden" rowKey="id" size="small" bordered
      columns={columns} dataSource={monthRows} scroll={{ x: 800 }} locale={{ emptyText: t("empty") }}
      pagination={{ pageSize: 50, showSizeChanger: false, hideOnSinglePage: true }} />
  </Page>;
}

function Stat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return <div className="surface rounded-lg p-4">
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className={`mt-1 tabular-nums ${strong ? "text-2xl font-semibold" : "text-xl font-medium"}`}>{value}</div>
    {hint ? <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">{hint}</div> : null}
  </div>;
}
