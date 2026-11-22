"use client";

import { useState, useTransition } from "react";
import { Button, Checkbox, Divider, Input, InputNumber, Modal, Popover, Radio, Tag } from "antd";
import { Plus, RotateCcw, Route, Trash2, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import {
  addCardItems, addCardPayment, cancelCard, createCardTours, deleteCardPayment, refundCardItem,
} from "@/app/(app)/cards/actions";
import { CardItemsDrawer, MoneyInput } from "@/components/cards/card-items-drawer";
import { ConfirmAction } from "@/components/common/confirm-action";
import { DatePicker } from "@/components/common/date-picker";
import { FormDrawer } from "@/components/common/form-drawer";
import { useServiceGroups } from "@/components/common/service-groups";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { runAction, sessionText, TourDrawer, TourStatusTag, type TourMe } from "@/components/tour/tour-drawer";
import {
  CARD_PAYMENT_METHODS, cardDone, cardMoney, MAX_TOUR_SESSION, suggestRefund, type CardPaymentMethod,
} from "@/lib/cards";
import { formatRupiah } from "@/lib/currency";
import type { CardItem, TreatmentCard } from "@/types/card";
import type { Service } from "@/types/service";
import type { Tour } from "@/types/tour";

/** canEdit = cards.edit; canCancel = cards.delete + admin; tour = quyền mở drawer tour (menu Tour). */
export type CardMe = { id: string; isAdmin: boolean; canEdit: boolean; canCancel: boolean; tour: TourMe };

/** Số tour (buổi đã tạo, chưa xoá) theo dòng dịch vụ của thẻ. */
export const usageOf = (tours: Pick<Tour, "card_item_id">[]) => (itemId: string) =>
  tours.filter((t) => t.card_item_id === itemId).length;

export function CardStatusTag({ card, tours }: { card: TreatmentCard; tours: Pick<Tour, "card_item_id">[] }) {
  const t = useTranslations("cards");
  const status = card.cancelled_at ? "cancelled" : cardDone(card.items, usageOf(tours)) ? "done" : "active";
  return <Tag color={{ cancelled: "red", done: "green", active: "blue" }[status]} className="me-0">{t(`status.${status}`)}</Tag>;
}

/** Công nợ: dương = còn phải thu (cam), âm = phải hoàn khách (đỏ), 0 = "—". */
export function DueText({ due }: { due: number }) {
  const t = useTranslations("cards");
  if (!due) return <span className="text-muted-foreground">—</span>;
  return due > 0
    ? <span className="font-medium text-warning tabular-nums">{formatRupiah(due)}</span>
    : <span className="font-medium text-destructive tabular-nums" title={t("refundOwed")}>− {formatRupiah(-due)}</span>;
}

/**
 * Chi tiết thẻ liệu trình: tiền, dịch vụ (đã dùng x/y buổi, hoàn), thanh toán, lộ trình tour + tạo tour.
 * Cha giữ id và truyền `card` mới nhất (sau mỗi action server revalidate → props đổi).
 */
export function CardDrawer({ card, tours, services, staff, me, onClose }: {
  card: TreatmentCard;
  tours: Tour[]; // tour của thẻ này
  services: Service[];
  staff: StaffRef[];
  me: CardMe;
  onClose: () => void;
}) {
  const t = useTranslations("cards");
  const tt = useTranslations("tour");
  const groups = useServiceGroups();
  const [adding, setAdding] = useState(false);
  const [creatingTour, setCreatingTour] = useState(false);
  const [tourId, setTourId] = useState<string | null>(null);
  const money = cardMoney(card);
  const used = usageOf(tours);
  const active = !card.cancelled_at;
  const canEdit = me.canEdit && active;
  const serviceOf = (id: string) => services.find((s) => s.id === id);
  const itemOf = (id: string | null) => card.items.find((i) => i.id === id);
  const failed = t("saveError");
  const journey = [...tours].sort((a, b) => a.tour_date.localeCompare(b.tour_date));
  const openTour = tours.find((x) => x.id === tourId);

  return <FormDrawer open onClose={onClose} width={600} submitText={t("close")} onSubmit={onClose}
    footerExtra={me.canCancel && active ? <ConfirmAction title={t("cancelTitle")} description={t("cancelBody")}
      okText={t("cancelCard")} cancelText={t("back")}
      onConfirm={async () => { if (await runAction(cancelCard(card.id), t("cancelled"), failed)) onClose(); }}>
      <Button danger>{t("cancelCard")}</Button>
    </ConfirmAction> : null}
    title={<div className="min-w-0">
      <div className="flex items-center gap-2 text-lg font-semibold">{card.code} <CardStatusTag card={card} tours={tours} /></div>
      <div className="mt-1 text-xs font-normal text-muted-foreground">
        {[card.customer?.full_name, card.customer?.phone, dayjs(card.created_at).format("DD/MM/YYYY")].filter(Boolean).join(" · ")}
      </div>
    </div>}>
    {/* Tiền thẻ */}
    <dl className="mb-4 grid grid-cols-[1fr_auto] gap-y-2 rounded-lg border border-border p-4 text-sm tabular-nums">
      <dt className="text-muted-foreground">{t("value")}</dt><dd className="text-right font-medium">{formatRupiah(money.value)}</dd>
      <dt className="text-muted-foreground">{t("collected")}</dt><dd className="text-right text-success">{formatRupiah(money.collected)}</dd>
      <dt className="font-medium">{money.due < 0 ? t("refundOwed") : t("due")}</dt><dd className="text-right"><DueText due={money.due} /></dd>
    </dl>
    {card.note ? <p className="mb-4 whitespace-pre-line text-sm text-muted-foreground">{card.note}</p> : null}

    {/* Dịch vụ */}
    <div className="mb-2 flex items-center justify-between">
      <h3 className="font-semibold">{t("services")}</h3>
      {canEdit ? <Button size="small" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>{t("addService")}</Button> : null}
    </div>
    <ul className="mb-4 flex flex-col divide-y divide-border rounded-lg border border-border">
      {card.items.map((item) => {
        const s = serviceOf(item.service_id);
        const n = used(item.id);
        return <li key={item.id} className="flex items-start justify-between gap-3 p-3">
          <div className="min-w-0">
            <div className={item.refunded_at ? "font-medium line-through opacity-60" : "font-medium"}>{s?.name ?? "—"}</div>
            <div className="text-xs text-muted-foreground tabular-nums">{s ? `${groups.name(s.group_id)} · ` : ""}{formatRupiah(item.price)}</div>
            {item.refunded_at ? <div className="mt-1 text-xs text-destructive">
              {t("refundedLine", { amount: formatRupiah(item.refund_amount ?? 0), date: dayjs(item.refunded_at).format("DD/MM/YYYY") })}
              {item.refund_note ? ` · ${item.refund_note}` : ""}
            </div> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Tag color={n >= item.sessions ? "green" : n ? "blue" : "default"} className="me-0 tabular-nums">
              {t("usedSessions", { used: n, total: item.sessions })}
            </Tag>
            {canEdit && !item.refunded_at ? <RefundButton item={item} used={n} /> : null}
          </div>
        </li>;
      })}
    </ul>

    {/* Thanh toán */}
    <div className="mb-2 flex items-center justify-between">
      <h3 className="font-semibold">{t("payments")}</h3>
      {canEdit ? <PaymentButton cardId={card.id} /> : null}
    </div>
    <ul className="mb-4 flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
      {card.deposit_used ? <li className="flex justify-between gap-3 p-3">
        <span className="text-muted-foreground">{t("depositUsed")}</span>
        <span className="tabular-nums text-success">{formatRupiah(card.deposit_used)}</span>
      </li> : null}
      {[...card.payments].sort((a, b) => a.paid_at.localeCompare(b.paid_at)).map((p) => <li key={p.id} className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <div>{dayjs(p.paid_at).format("DD/MM/YYYY")} · {t(`method.${p.method}`)}
            {p.created_by ? <span className="text-muted-foreground"> · {staff.find((x) => x.id === p.created_by)?.user_name ?? "—"}</span> : null}
          </div>
          {p.note ? <div className="text-xs text-muted-foreground">{p.note}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={p.amount < 0 ? "tabular-nums text-destructive" : "tabular-nums text-success"}>
            {p.amount < 0 ? `− ${formatRupiah(-p.amount)}` : formatRupiah(p.amount)}
          </span>
          {me.isAdmin && active ? <ConfirmAction title={t("deletePaymentTitle")} okText={t("delete")} cancelText={t("back")}
            onConfirm={() => runAction(deleteCardPayment(p.id), t("saved"), failed)}>
            <Button type="text" size="small" aria-label={t("delete")} icon={<Trash2 className="size-4" />} />
          </ConfirmAction> : null}
        </div>
      </li>)}
      {!card.deposit_used && !card.payments.length ? <li className="p-3 text-muted-foreground">{t("noPayments")}</li> : null}
    </ul>

    {/* Lộ trình tour */}
    <div className="mb-2 flex items-center justify-between">
      <h3 className="font-semibold">{t("journey")}</h3>
      {canEdit && card.items.some((i) => !i.refunded_at)
        ? <Button size="small" type="primary" icon={<Route className="size-4" />} onClick={() => setCreatingTour(true)}>{t("createTour")}</Button> : null}
    </div>
    {journey.length ? <ol className="relative ms-2 border-s border-border">
      {journey.map((tour) => {
        const item = itemOf(tour.card_item_id);
        const tech = staff.find((s) => s.id === tour.technician_id);
        return <li key={tour.id} className="ms-4 pb-3">
          <span className="absolute -start-1.5 mt-2 size-3 rounded-full border-2 border-background bg-primary" />
          <button type="button" onClick={() => setTourId(tour.id)}
            className="w-full cursor-pointer rounded-md p-2 text-left hover:bg-muted">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium tabular-nums">{dayjs(tour.tour_date).format("DD/MM/YYYY")}</span>
              <TourStatusTag tour={tour} />
            </div>
            <div className="text-sm">{serviceOf(item?.service_id ?? tour.service_id)?.name ?? "—"}
              {tour.service_detail ? <span className="text-muted-foreground"> · {sessionText(tt, tour)}</span> : null}</div>
            <div className="text-xs text-muted-foreground">{tech ? staffLabel(tech) : tt("status_pending")}</div>
          </button>
        </li>;
      })}
    </ol> : <p className="text-sm text-muted-foreground">{t("noTours")}</p>}

    <CardItemsDrawer open={adding} title={t("addServiceTitle", { code: card.code })} submitText={t("addService")}
      services={services} onClose={() => setAdding(false)}
      onSubmit={(items) => runAction(addCardItems(card.id, items), t("saved"), failed)} />
    {creatingTour ? <CreateCardTourModal card={card} services={services} used={used} onClose={() => setCreatingTour(false)} /> : null}
    {openTour ? <TourDrawer key={openTour.id} tour={openTour} me={me.tour} services={services} staff={staff}
      customers={[]} onClose={() => setTourId(null)} /> : null}
  </FormDrawer>;
}

/** Hoàn 1 dịch vụ: gợi ý = giá × buổi chưa làm / tổng buổi. */
function RefundButton({ item, used }: { item: CardItem; used: number }) {
  const t = useTranslations("cards");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(suggestRefund(item.price, item.sessions, used));
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    if (await runAction(refundCardItem(item.id, { amount: amount ?? 0, note }), t("refundedToast"), t("saveError"))) setOpen(false);
  });
  return <Popover trigger="click" open={open} onOpenChange={setOpen} title={t("refundTitle")} content={<div className="flex w-64 flex-col gap-3">
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("refundAmount")}
      <MoneyInput value={amount} onChange={setAmount} ariaLabel={t("refundAmount")} />
      <span>{t("refundHint", { max: formatRupiah(item.price) })}</span>
    </label>
    <Input.TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("refundReason")} autoSize={{ minRows: 2 }} maxLength={2000} />
    <Button danger type="primary" loading={pending} disabled={amount == null || amount > item.price} onClick={save}>{t("refund")}</Button>
  </div>}>
    <Button size="small" type="text" aria-label={t("refund")} title={t("refund")} icon={<RotateCcw className="size-4" />} />
  </Popover>;
}

/** Thu tiền (số âm = hoàn tiền khách). */
function PaymentButton({ cardId }: { cardId: string }) {
  const t = useTranslations("cards");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<CardPaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    if (await runAction(addCardPayment(cardId, { amount: amount ?? 0, method, note }), t("saved"), t("saveError"))) {
      setOpen(false); setAmount(null); setNote("");
    }
  });
  return <Popover trigger="click" open={open} onOpenChange={setOpen} title={t("addPayment")} content={<div className="flex w-72 flex-col gap-3">
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("amount")}
      <MoneyInput value={amount} onChange={setAmount} min={-1e13} ariaLabel={t("amount")} />
      <span>{t("amountHint")}</span>
    </label>
    <Radio.Group optionType="button" value={method} onChange={(e) => setMethod(e.target.value)} className="flex! w-full"
      options={CARD_PAYMENT_METHODS.map((m) => ({ value: m, label: t(`method.${m}`), className: "flex-1 text-center" }))} />
    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note")} maxLength={2000} />
    <Button type="primary" loading={pending} disabled={!amount} onClick={save}>{t("addPayment")}</Button>
  </div>}>
    <Button size="small" icon={<Wallet className="size-4" />}>{t("addPayment")}</Button>
  </Popover>;
}

/** Tạo tour từ thẻ: chọn dịch vụ (mỗi DV 1 tour), Lần tự điền = số tour + 1, dịch vụ chi tiết suy từ lần. */
function CreateCardTourModal({ card, services, used, onClose }: {
  card: TreatmentCard;
  services: Service[];
  used: (itemId: string) => number;
  onClose: () => void;
}) {
  const t = useTranslations("cards");
  const tt = useTranslations("tour");
  const items = card.items.filter((i) => !i.refunded_at);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  // Mặc định chọn DV còn buổi; lần = số tour đã có + 1.
  const [picked, setPicked] = useState<Record<string, number | null>>(() => Object.fromEntries(items
    .filter((i) => used(i.id) < i.sessions).map((i) => [i.id, Math.min(used(i.id) + 1, MAX_TOUR_SESSION)])));
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const chosen = Object.entries(picked).filter((e): e is [string, number] => e[1] != null);
  const submit = () => start(async () => {
    const ok = await runAction(createCardTours(card.id, {
      tour_date: date, note, items: chosen.map(([card_item_id, session]) => ({ card_item_id, session })),
    }), t("toursCreated", { count: chosen.length }), t("saveError"));
    if (ok) onClose();
  });

  return <Modal open centered title={t("createTourTitle", { code: card.code })} onCancel={onClose} okText={t("createTour")} cancelText={t("back")}
    okButtonProps={{ loading: pending, disabled: !chosen.length || !date }} cancelButtonProps={{ disabled: pending }} onOk={submit}>
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">{tt("date")}
        <DatePicker value={date} onChange={(v) => setDate(v ?? "")} allowClear={false} />
      </label>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const s = services.find((x) => x.id === item.service_id);
          const n = picked[item.id];
          const on = n != null;
          return <li key={item.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <Checkbox checked={on} aria-label={s?.name}
              onChange={(e) => setPicked((p) => ({ ...p, [item.id]: e.target.checked ? Math.min(used(item.id) + 1, MAX_TOUR_SESSION) : null }))} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{s?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">
                {t("usedSessions", { used: used(item.id), total: item.sessions })}
                {on && n > item.sessions ? <span className="text-warning"> · {t("overSessions")}</span> : null}
              </div>
            </div>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">{tt("session")}
              <InputNumber<number> className="w-16" size="small" min={1} max={MAX_TOUR_SESSION} precision={0} disabled={!on}
                value={n ?? undefined} aria-label={tt("session")} onChange={(v) => setPicked((p) => ({ ...p, [item.id]: v ?? 1 }))} />
            </label>
          </li>;
        })}
      </ul>
      <Divider className="my-0" />
      <label className="flex flex-col gap-1 text-sm">{tt("note")}
        <Input.TextArea value={note} onChange={(e) => setNote(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} maxLength={10000} />
      </label>
    </div>
  </Modal>;
}

/** Tour của 1 thẻ (theo dòng dịch vụ). */
export const toursOfCard = (card: TreatmentCard, tours: Tour[]) =>
  tours.filter((x) => card.items.some((i) => i.id === x.card_item_id));
