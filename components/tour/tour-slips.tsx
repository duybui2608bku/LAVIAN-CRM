"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import { detailLabelEn, type TourGroup } from "@/components/tour/tour-data";
import { formatRupiah } from "@/lib/currency";

const noopSubscribe = () => () => {};

/**
 * Phiếu tour tiếng Anh — mỗi KTV một trang. Ẩn trên màn hình, chỉ hiện khi in
 * (CSS `.tour-print` trong globals.css). Nút "Phiếu tour (PDF)" gọi window.print().
 */
export function TourSlips({ groups, month }: { groups: TourGroup[]; month: string }) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;
  const period = dayjs(`${month}-01`).locale("en").format("MMMM YYYY");
  const printed = dayjs().format("DD/MM/YYYY HH:mm");

  return createPortal(
    <div className="tour-print" lang="en">
      {groups.map((g) => (
        <section key={g.technician.id} className="tour-slip">
          <header className="tour-slip-head">
            <h1>TOUR SLIP</h1>
            <table className="tour-slip-meta">
              <tbody>
                <tr><th>Technician</th><td>{g.technician.user_name}</td></tr>
                <tr><th>Period</th><td>{period}</td></tr>
                <tr><th>Printed</th><td>{printed}</td></tr>
              </tbody>
            </table>
          </header>

          <table className="tour-slip-table">
            <thead>
              <tr>
                <th>No.</th><th>Date</th><th>Customer</th><th>Service</th>
                <th className="num">Bill</th><th className="num">Rate</th><th className="num">Tour</th>
              </tr>
            </thead>
            <tbody>
              {[...g.rows].reverse().map((row, i) => (
                <tr key={row.id}>
                  <td>{i + 1}</td>
                  <td>{dayjs(row.scheduled_at).format("DD/MM/YYYY")}</td>
                  <td>{row.customer?.full_name ?? "—"}</td>
                  <td>{detailLabelEn(row) || "—"}</td>
                  <td className="num">{row.bill_amount == null ? "—" : formatRupiah(row.bill_amount)}</td>
                  <td className="num">{row.rate == null ? "—" : `${Math.round(row.rate * 100)}%`}</td>
                  <td className="num">{row.tour == null ? "—" : formatRupiah(row.tour)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total ({g.rows.length} appointments)</td>
                <td className="num">{formatRupiah(g.bill)}</td>
                <td />
                <td className="num">{formatRupiah(g.tour)}</td>
              </tr>
            </tfoot>
          </table>

          {g.missing ? (
            <p className="tour-slip-note">
              {g.missing} appointment(s) missing bill or service detail are not included in the tour total.
            </p>
          ) : null}

          <p className="tour-slip-amount">Total tour payable: <strong>{formatRupiah(g.tour)}</strong></p>

          <div className="tour-slip-sign">
            <div><span>Technician</span><i />{g.technician.user_name}</div>
            <div><span>Approved by</span><i />Manager</div>
          </div>
        </section>
      ))}
    </div>,
    document.body,
  );
}
