import dayjs from "dayjs";
import type { TourGroup } from "@/components/tour/tour-data";

export type TourExcelLabels = {
  technician: string;
  date: string;
  customer: string;
  service: string;
  bill: string;
  rate: string;
  tour: string;
  subtotal: string;
  total: string;
  detail: (row: TourGroup["rows"][number]) => string;
};

/** Tải file Excel tour của tháng, gom theo KTV. exceljs được import động — không nằm trong bundle trang. */
export async function downloadTourExcel(groups: TourGroup[], month: string, labels: TourExcelLabels) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Tour ${month}`, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: labels.technician, width: 24 },
    { header: labels.date, width: 18 },
    { header: labels.customer, width: 28 },
    { header: labels.service, width: 14 },
    { header: labels.bill, width: 16, style: { numFmt: "#,##0" } },
    { header: labels.rate, width: 8, style: { numFmt: "0%" } },
    { header: labels.tour, width: 16, style: { numFmt: "#,##0" } },
  ];
  ws.getRow(1).font = { bold: true };

  const fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F0FB" } } as const;
  for (const g of groups) {
    for (const row of g.rows) {
      ws.addRow([
        g.technician.user_name,
        dayjs(row.scheduled_at).format("DD/MM/YYYY HH:mm"),
        row.customer?.full_name ?? "",
        labels.detail(row),
        row.bill_amount,
        row.rate,
        row.tour,
      ]);
    }
    const sub = ws.addRow([`${labels.subtotal} ${g.technician.user_name}`, `${g.rows.length}`, null, null, g.bill, null, g.tour]);
    sub.font = { bold: true };
    sub.eachCell((cell) => { cell.fill = fill; });
  }
  const count = groups.reduce((n, g) => n + g.rows.length, 0);
  const total = ws.addRow([
    labels.total, `${count}`, null, null,
    groups.reduce((n, g) => n + g.bill, 0), null,
    groups.reduce((n, g) => n + g.tour, 0),
  ]);
  total.font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `tour-${month}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
