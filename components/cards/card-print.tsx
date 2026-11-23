"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import logo from "@/app/assets/logo.png";
import { useServiceGroups } from "@/components/common/service-groups";
import { cardMoney, isTourable } from "@/lib/cards";
import { formatIdr } from "@/lib/currency";
import type { TreatmentCard } from "@/types/card";
import type { Service } from "@/types/service";

const noopSubscribe = () => () => {};
const METHOD_EN = { cash: "Cash", bank: "Bank transfer", card: "Card" } as const;

/**
 * Thẻ liệu trình bản in A4 cho khách ký — cố ý tiếng Anh (khách Indonesia, như tờ bảng giá giấy).
 * Ẩn trên màn hình, chỉ hiện khi in (CSS `.card-print` trong globals.css); nút "In thẻ" gọi window.print() → "Save as PDF".
 */
export function CardPrint({ card, services, consultant, used }: {
  card: TreatmentCard;
  services: Service[];
  consultant: string; // người tạo thẻ (Beauty Consultant)
  used: (itemId: string) => number;
}) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const groups = useServiceGroups();
  if (!mounted) return null;
  const money = cardMoney(card);
  const subtotal = card.items.reduce((s, i) => s + i.price, 0);
  const refunded = card.items.reduce((s, i) => s + (i.refund_amount ?? 0), 0);
  const paid = card.payments.reduce((s, p) => s + p.amount, 0);
  const service = (id: string) => services.find((s) => s.id === id);
  const payments = [...card.payments].sort((a, b) => a.paid_at.localeCompare(b.paid_at));

  return createPortal(
    <div className="card-print" lang="en">
      <header className="cp-head">
        <div className="cp-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh in, không cần tối ưu next/image */}
          <img src={logo.src} alt="Lavian Beauty Center" />
          <div>
            <div className="cp-brand-name">LAVIAN</div>
            <div className="cp-brand-sub">BEAUTY CENTER</div>
          </div>
        </div>
        <div className="cp-title">
          <h1>Treatment Card</h1>
          <table>
            <tbody>
              <tr><th>Card No.</th><td className="cp-code">{card.code}</td></tr>
              <tr><th>Date</th><td>{dayjs(card.created_at).format("DD MMM YYYY")}</td></tr>
            </tbody>
          </table>
        </div>
      </header>

      <section className="cp-customer">
        <div><span>Customer name</span><b>{card.customer?.full_name ?? ""}</b></div>
        <div><span>Phone</span><b>{card.customer?.phone ?? ""}</b></div>
        <div className="cp-wide"><span>Address</span><b>{card.customer?.address_detail ?? ""}</b></div>
        <div><span>Beauty consultant</span><b>{consultant}</b></div>
      </section>

      <table className="cp-table">
        <thead>
          <tr><th className="cp-no">No.</th><th>Category</th><th>Service</th><th className="num">Sessions</th><th className="num">Price (IDR)</th></tr>
        </thead>
        <tbody>
          {card.items.map((item, i) => {
            const s = service(item.service_id);
            return <tr key={item.id} className={item.refunded_at ? "cp-refunded" : undefined}>
              <td className="cp-no">{i + 1}</td>
              <td>{s ? groups.name(s.group_id) : ""}</td>
              <td>
                {s?.name ?? "—"}
                {item.refunded_at ? <div className="cp-sub">Refunded {formatIdr(item.refund_amount ?? 0)} · {dayjs(item.refunded_at).format("DD/MM/YYYY")}</div> : null}
              </td>
              <td className="num">{item.refunded_at || !isTourable(item) ? "—" : `${used(item.id)} / ${item.sessions}`}</td>
              <td className="num">{formatIdr(item.price)}</td>
            </tr>;
          })}
        </tbody>
      </table>

      <div className="cp-bottom">
        <div className="cp-left">
          {payments.length ? <>
            <h2>Payments</h2>
            <table className="cp-table cp-small">
              <thead><tr><th>Date</th><th>Method</th><th className="num">Amount (IDR)</th></tr></thead>
              <tbody>
                {payments.map((p) => <tr key={p.id}>
                  <td>{dayjs(p.paid_at).format("DD/MM/YYYY")}</td>
                  <td>{METHOD_EN[p.method]}{p.note ? ` · ${p.note}` : ""}</td>
                  <td className="num">{p.amount < 0 ? `−${formatIdr(-p.amount)}` : formatIdr(p.amount)}</td>
                </tr>)}
              </tbody>
            </table>
          </> : null}
          {card.note ? <><h2>Note</h2><p className="cp-note">{card.note}</p></> : null}
        </div>
        <table className="cp-totals">
          <tbody>
            <tr><th>Subtotal</th><td>{formatIdr(subtotal)}</td></tr>
            {refunded ? <tr><th>Refunded</th><td>−{formatIdr(refunded)}</td></tr> : null}
            <tr className="cp-strong"><th>Total payment</th><td>{formatIdr(money.value)}</td></tr>
            {card.deposit_used ? <tr><th>Deposit (DP)</th><td>{formatIdr(card.deposit_used)}</td></tr> : null}
            {paid ? <tr><th>Paid amount</th><td>{formatIdr(paid)}</td></tr> : null}
            {card.refunded_at ? <tr><th>Card refunded {dayjs(card.refunded_at).format("DD/MM/YYYY")}</th><td>−{formatIdr(card.refund_amount ?? 0)}</td></tr> : null}
            <tr className="cp-due"><th>{money.due < 0 ? "To refund" : "Balance due"}</th><td>{formatIdr(Math.abs(money.due))}</td></tr>
          </tbody>
        </table>
      </div>

      <p className="cp-ack">I confirm the services, sessions and prices listed above.</p>
      <div className="cp-sign">
        <div><i /><span>Customer signature</span><small>{card.customer?.full_name ?? ""}</small></div>
        <div><i /><span>Beauty consultant</span><small>{consultant}</small></div>
      </div>

      <footer className="cp-foot">Lavian Beauty Center · {card.code} · Printed {dayjs().format("DD/MM/YYYY HH:mm")}</footer>
    </div>,
    document.body,
  );
}
