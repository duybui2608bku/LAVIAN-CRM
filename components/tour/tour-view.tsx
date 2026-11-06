"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DatePicker, Select, Switch, Tag, type TableProps } from "antd";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { DataTable } from "@/components/common/data-table";
import { StatCard } from "@/components/common/stat-card";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { ALL_TECHNICIANS, groupByTechnician, toItem, type TourGroup, type TourItem, type TourRow } from "@/components/tour/tour-data";
import { TourSlips } from "@/components/tour/tour-slips";
import { formatRupiah } from "@/lib/currency";
import { toast } from "@/lib/toast";

const DASH = <span className="text-muted-foreground">—</span>;

/** Dòng bảng: lịch hẹn, hoặc dòng nhóm KTV (`group`) có `children` khi gom nhóm. */
type TableRow = (TourItem & { group?: undefined; children?: undefined })
  | { id: string; group: TourGroup; children: TourItem[] };

/**
 * Tiền tour theo tháng (chỉ đọc). `technicians` != null → admin: chọn KTV hoặc "Tất cả",
 * thêm cột Nhân viên, gom nhóm theo nhân viên, xuất Excel và phiếu tour PDF.
 */
export function TourView({ rows, month, technicianId, technicians, staff }: {
  rows: TourRow[];
  month: string;
  technicianId: string;
  technicians: StaffRef[] | null;
  staff: StaffRef[];
}) {
  const t = useTranslations("tour");
  const ta = useTranslations("appointments");
  const router = useRouter();
  const isAdmin = technicians != null;
  const isAll = technicianId === ALL_TECHNICIANS;
  const [grouped, setGrouped] = useState(true);
  const [exporting, setExporting] = useState(false);

  const monthStart = dayjs(`${month}-01`);
  const items = rows.filter((row) => dayjs(row.scheduled_at).isSame(monthStart, "month")).map(toItem);
  const groups = isAdmin ? groupByTechnician(items, staff) : [];
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const totalTour = items.reduce((sum, row) => sum + (row.tour ?? 0), 0);
  const totalBill = items.reduce((sum, row) => sum + (row.bill_amount ?? 0), 0);
  const missing = items.filter((row) => row.tour == null).length;
  const showGroups = isAll && grouped;

  const go = (next: { month?: string; technician?: string }) => {
    const qs = new URLSearchParams({ month: next.month ?? month });
    const tech = next.technician ?? technicianId;
    if (isAdmin && tech !== ALL_TECHNICIANS) qs.set("technician", tech);
    router.push(`/tour?${qs}`);
  };

  const detailText = (row: TourItem) =>
    row.service_detail ? `${ta(`detail_${row.service_detail}`)}${row.service_session ? ` ${row.service_session}` : ""}` : "";

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { downloadTourExcel } = await import("@/components/tour/tour-export");
      await downloadTourExcel(groups, month, {
        technician: t("staff"), date: t("date"), customer: t("customer"), service: ta("serviceDetail"),
        bill: ta("bill"), rate: "%", tour: ta("tour"), subtotal: t("subtotal"), total: t("grandTotal"),
        detail: detailText,
      });
    } catch {
      toast.error(t("exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  const columns: TableProps<TableRow>["columns"] = [
    ...(isAdmin ? [{
      title: t("staff"), width: 200,
      render: (_: unknown, row: TableRow) => {
        if (row.group) return <span className="font-medium">{staffLabel(row.group.technician)}</span>;
        if (showGroups) return null;
        const s = row.technician_id ? staffById.get(row.technician_id) : undefined;
        return s ? staffLabel(s) : DASH;
      },
    }] : []),
    { title: t("date"), width: 150, render: (_, row) => row.group
      ? <span className="text-muted-foreground">{t("groupCount", { count: row.group.rows.length })}</span>
      : dayjs(row.scheduled_at).format("DD/MM/YYYY HH:mm") },
    { title: t("customer"), render: (_, row) => row.group
      ? (row.group.missing ? <Tag color="warning" className="me-0">{t("missing", { count: row.group.missing })}</Tag> : null)
      : <span className="font-medium">{row.customer?.full_name ?? "—"}</span> },
    { title: ta("serviceDetail"), width: 160, render: (_, row) => row.group ? null : row.service_detail
      ? <Tag color="cyan" className="me-0">{detailText(row)}</Tag>
      : DASH },
    { title: ta("bill"), width: 150, align: "right", render: (_, row) => {
      const value = row.group ? row.group.bill : row.bill_amount;
      return value == null ? DASH : <span className={row.group ? "tabular-nums font-semibold" : "tabular-nums"}>{formatRupiah(value)}</span>;
    } },
    { title: "%", width: 70, align: "right", render: (_, row) =>
      row.group ? null : row.rate == null ? DASH : `${Math.round(row.rate * 100)}%` },
    { title: ta("tour"), width: 140, align: "right", render: (_, row) => {
      const value = row.group ? row.group.tour : row.tour;
      return value == null ? DASH : <span className="tabular-nums font-semibold">{formatRupiah(value)}</span>;
    } },
  ];

  const dataSource: TableRow[] = showGroups
    ? groups.map((g) => ({ id: `group:${g.technician.id}`, group: g, children: g.rows }))
    : items;

  return <Page>
    <PageHeader title={t("title")} actions={isAdmin ? <>
      <Button icon={<FileSpreadsheet className="size-4" />} loading={exporting} disabled={!items.length} onClick={exportExcel}>
        {t("exportExcel")}
      </Button>
      <Button icon={<Printer className="size-4" />} disabled={!items.length} onClick={() => window.print()}>
        {t("exportSlip")}
      </Button>
    </> : undefined} />
    <PageToolbar>
      <DatePicker picker="month" value={monthStart} allowClear={false} format="MM/YYYY" aria-label={t("month")}
        onChange={(d) => d && go({ month: d.format("YYYY-MM") })} />
      {technicians ? <Select className="min-w-56" value={technicianId} aria-label={t("technician")}
        showSearch={{ optionFilterProp: "title" }}
        options={[
          { value: ALL_TECHNICIANS, title: t("allTechnicians"), label: t("allTechnicians") },
          ...technicians.map((s) => ({ value: s.id, title: s.user_name, label: staffLabel(s) })),
        ]}
        onChange={(id) => go({ technician: id })} /> : null}
      {isAll ? <label className="flex items-center gap-2 text-sm">
        <Switch size="small" checked={grouped} onChange={setGrouped} />{t("groupByStaff")}
      </label> : null}
    </PageToolbar>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard label={t("totalTour")} value={formatRupiah(totalTour)} />
      <StatCard label={t("totalBill")} value={formatRupiah(totalBill)} />
      <StatCard label={t("count")} value={items.length} tone="warning"
        hint={missing ? t("missing", { count: missing }) : undefined} />
    </div>
    <DataTable<TableRow> columns={columns} dataSource={dataSource} pageSize={50} empty={t("empty")} />
    {isAdmin ? <TourSlips groups={groups} month={month} /> : null}
  </Page>;
}
