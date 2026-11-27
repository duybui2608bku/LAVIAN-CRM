"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Divider, Empty, Image, Input, InputNumber, Modal, Popover, Radio, Select } from "antd";
import { History as HistoryIcon, Plus, Printer, RotateCcw, Route, Trash2, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import {
  addCardItems, addCardPayment, cancelCard, createCardTours, deleteCardItem, deleteCardPayment, getCardHistory, refundCard, updateCardItemSessions,
} from "@/app/(app)/cards/actions";
import { CardItemsDrawer } from "@/components/cards/card-items-drawer";
import { MoneyInput } from "@/components/common/money-input";
import { CardPrint } from "@/components/cards/card-print";
import { StatusTag } from "@/components/common/cells";
import { ConfirmAction } from "@/components/common/confirm-action";
import { DatePicker } from "@/components/common/date-picker";
import { FormDrawer } from "@/components/common/form-drawer";
import { Section } from "@/components/common/section";
import { useServiceGroups } from "@/components/common/service-groups";
import { staffName, type StaffRef } from "@/components/common/user-avatar";
import { PhotoField } from "@/components/tour/photo-field";
import { runAction, kindText, TourDrawer, TourStatusTag, type TourMe } from "@/components/tour/tour-drawer";
import {
  auditEntries, CARD_PAYMENT_METHODS, cardMoney, cardRefundRange, cardStatus, isTourable, journeyDue, paymentRange, suggestTourKind, TOUR_KINDS, tourKindDetail,
  type AuditEntry, type CardPaymentMethod, type TourKind,
} from "@/lib/cards";
import { formatRupiah } from "@/lib/currency";
import type { CardItem, TreatmentCard } from "@/types/card";
import type { Service } from "@/types/service";
import type { Tour } from "@/types/tour";

/** canEdit = cards.edit; canCancel = cards.delete + admin; tour = quyền mở drawer tour (menu Tour). */
export type CardMe = { id: string; isAdmin: boolean; canEdit: boolean; canCancel: boolean; tour: TourMe };

const CARD_DRAWER_WIDTH = 600;

/** Số tour (buổi đã tạo, chưa xoá) theo dòng dịch vụ của thẻ — bỏ tour dự kiến (chưa chốt lịch). */
export const usageOf = (tours: Pick<Tour, "card_item_id" | "planned">[]) => (itemId: string) =>
  tours.filter((t) => t.card_item_id === itemId && !t.planned).length;

export function CardStatusTag({ card, tours }: {
  card: Parameters<typeof cardStatus>[0]; tours: Pick<Tour, "card_item_id" | "planned">[];
}) {
  const t = useTranslations("cards");
  const status = cardStatus(card, usageOf(tours));
  return <StatusTag color={{ cancelled: "red", refunded: "orange", done: "green", active: "blue" }[status]} label={t(`status.${status}`)} />;
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
export function CardDrawer({ card, tours, services, staff, me, onOpenCustomer, onClose }: {
  card: TreatmentCard;
  tours: Tour[]; // tour của thẻ này
  services: Service[];
  staff: StaffRef[];
  me: CardMe;
  /** Bấm tên khách → popup hồ sơ 360° (trang cha giữ popup). */
  onOpenCustomer?: (customerId: string) => void;
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
  const active = !card.cancelled_at && !card.refunded_at; // thẻ huỷ / đã hoàn: chỉ xem
  const canEdit = me.canEdit && active;
  const serviceOf = (id: string) => services.find((s) => s.id === id);
  const itemOf = (id: string | null) => card.items.find((i) => i.id === id);
  const failed = t("saveError");
  const journey = [...tours].sort((a, b) => a.tour_date.localeCompare(b.tour_date));
  const openTour = tours.find((x) => x.id === tourId);
  const consultant = staff.find((s) => s.id === card.created_by)?.user_name ?? "";
  // Laser mày đang làm dở: đã có tour Laser, DV mày chưa Làm mới → hỏi kết quả (sạch / còn mực) để lộ trình tính lại.
  const browNew = tours.some((x) => !x.planned && x.service_detail === "new"
    && serviceOf(itemOf(x.card_item_id)?.service_id ?? "")?.group_id === "alis");
  const laserPending = (item: CardItem) => !item.refunded_at && !browNew && used(item.id) > 0
    && serviceOf(item.service_id)?.group_id === "laser" && card.items.some((i) => !i.refunded_at && serviceOf(i.service_id)?.group_id === "alis");

  return <><FormDrawer open onClose={onClose} width={CARD_DRAWER_WIDTH}
    footerExtra={<>
      {canEdit ? <RefundCardButton card={card} used={used} /> : null}
      {me.canCancel && active ? <ConfirmAction title={t("cancelTitle")} description={t("cancelBody")}
        okText={t("cancelCard")} cancelText={t("back")}
        onConfirm={async () => { if (await runAction(cancelCard(card.id), t("cancelled"), failed)) onClose(); }}>
        <Button danger>{t("cancelCard")}</Button>
      </ConfirmAction> : null}
      {/* In A4 cho khách ký: CardPrint (ẩn trên màn hình) + window.print() → "Save as PDF". */}
      <Button className="ms-auto" icon={<Printer className="size-4" />} onClick={() => window.print()}>{t("print")}</Button>
    </>}
    title={<div className="min-w-0">
      <div className="flex items-center gap-2 text-lg font-semibold">{card.code} <CardStatusTag card={card} tours={tours} /></div>
      <div className="mt-1 text-sm font-normal">
        {onOpenCustomer ? <button type="button" title={t("openProfile")} onClick={() => onOpenCustomer(card.customer_id)}
          className="hover:text-primary hover:underline">{card.customer?.full_name}</button> : card.customer?.full_name}
      </div>
    </div>}>
    <CardPrint card={card} services={services} consultant={consultant} used={used} />
    {/* Tiền thẻ */}
    <dl className="mb-4 grid grid-cols-[1fr_auto] gap-y-2 rounded-lg border border-border p-4 text-sm tabular-nums">
      <dt className="text-muted-foreground">{t("value")}</dt><dd className="text-right font-medium">{formatRupiah(money.value)}</dd>
      <dt className="text-muted-foreground">{t("collected")}</dt><dd className="text-right text-success">{formatRupiah(money.collected)}</dd>
      <dt className="font-medium">{money.due < 0 ? t("refundOwed") : t("due")}</dt><dd className="text-right"><DueText due={money.due} /></dd>
    </dl>
    {card.note ? <p className="mb-4 whitespace-pre-line text-sm text-muted-foreground">{card.note}</p> : null}

    <Section title={t("services")} className="mb-4"
        extra={canEdit ? <Button size="small" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>{t("addService")}</Button> : null}>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {card.items.map((item) => {
          const s = serviceOf(item.service_id);
          const n = used(item.id);
          return <li key={item.id} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className={item.refunded_at ? "font-medium line-through opacity-60" : "font-medium"}>{s?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground tabular-nums">{s ? `${groups.name(s.group_id)} · ` : ""}{formatRupiah(item.price)}</div>
              {canEdit && laserPending(item) ? <LaserResult item={item} used={n} /> : null}
              {item.refunded_at ? <div className="mt-1 text-xs text-destructive">
                {t("refundedLine", { amount: formatRupiah(item.refund_amount ?? 0), date: dayjs(item.refunded_at).format("DD/MM/YYYY") })}
                {item.refund_note ? ` · ${item.refund_note}` : ""}
              </div> : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {/* Mực / phí Master: không tạo tour → không có buổi. */}
              {isTourable(item) ? <SessionsCell item={item} used={n} editable={canEdit && !item.refunded_at} /> : null}
              {canEdit && !item.refunded_at ? <DeleteItemButton item={item} name={s?.name ?? ""} used={n}
                last={card.items.length < 2} /> : null}
            </div>
          </li>;
        })}
      </ul>
    </Section>

    <Section title={t("payments")} className="mb-4">
      {canEdit ? <PaymentForm card={card} /> : null}
      {card.deposit_used || card.payments.length || card.refunded_at ? <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
        {card.deposit_used ? <li className="flex justify-between gap-3 p-3">
          <span className="text-muted-foreground">{t("depositUsed")}</span>
          <span className="tabular-nums text-success">{formatRupiah(card.deposit_used)}</span>
        </li> : null}
        {[...card.payments].sort((a, b) => a.paid_at.localeCompare(b.paid_at)).map((p) => <li key={p.id} className="flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2">{dayjs(p.paid_at).format("DD/MM/YYYY")} · {t(`method.${p.method}`)}
              {p.created_by ? <span className="text-muted-foreground">{staffName(staff, p.created_by)}</span> : null}
            </div>
            {p.note ? <div className="text-xs text-muted-foreground">{p.note}</div> : null}
            {p.images.length ? <div className="mt-1 flex flex-wrap gap-1"><Image.PreviewGroup>
              {p.images.map((url) => <Image key={url} src={url} alt="" width={40} height={40} className="rounded object-cover" />)}
            </Image.PreviewGroup></div> : null}
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
        {/* Hoàn cả thẻ: dòng cuối, trừ vào Đã thu. */}
        {card.refunded_at ? <li className="flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 font-medium text-destructive">{t("cardRefund")} · {dayjs(card.refunded_at).format("DD/MM/YYYY")}
              {card.refund_method ? ` · ${t(`method.${card.refund_method}`)}` : ""}
              {card.refunded_by ? <span className="font-normal text-muted-foreground">{staffName(staff, card.refunded_by)}</span> : null}
            </div>
            {card.refund_note ? <div className="text-xs text-muted-foreground">{card.refund_note}</div> : null}
          </div>
          <span className="shrink-0 tabular-nums text-destructive">− {formatRupiah(card.refund_amount ?? 0)}</span>
        </li> : null}
      </ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noPayments")} />}
    </Section>

    <Section title={t("journey")} className="mb-4" extra={canEdit && card.items.some((i) => !i.refunded_at && isTourable(i))
        ? <Button size="small" type="primary" icon={<Route className="size-4" />} onClick={() => setCreatingTour(true)}>{t("createTour")}</Button> : null}>
      {journey.length ? <ol className="relative ms-2 border-s border-border">
        {journey.map((tour) => {
          const item = itemOf(tour.card_item_id);
          return <li key={tour.id} className={tour.planned ? "ms-4 pb-3 opacity-70" : "ms-4 pb-3"}>
            <span className={`absolute -start-1.5 mt-2 size-3 rounded-full border-2 ${tour.planned
              ? "border-dashed border-muted-foreground bg-background" : "border-background bg-primary"}`} />
            <button type="button" onClick={() => setTourId(tour.id)}
              className="w-full cursor-pointer rounded-md p-2 text-left hover:bg-muted">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium tabular-nums">{dayjs(tour.tour_date).format("DD/MM/YYYY")}</span>
                <TourStatusTag tour={tour} />
              </div>
              <div className="text-sm">{serviceOf(item?.service_id ?? tour.service_id)?.name ?? "—"}
                {tour.service_detail ? <span className="text-muted-foreground"> · {kindText(tt, tour)}</span> : null}</div>
              <div className="text-xs text-muted-foreground">{tour.planned ? tt("plannedShort")
                : tour.technician_id ? staffName(staff, tour.technician_id) : tt("status_pending")}</div>
            </button>
          </li>;
        })}
      </ol> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noTours")} />}
    </Section>
    <CardHistory card={card} tours={tours} services={services} staff={staff} />

    {creatingTour ? <CreateCardTourModal card={card} services={services} tours={tours} isAdmin={me.isAdmin}
      onClose={() => setCreatingTour(false)} /> : null}
    {openTour ? <TourDrawer key={openTour.id} tour={openTour} me={me.tour} services={services} staff={staff}
      customers={[]} onClose={() => setTourId(null)} /> : null}
  </FormDrawer>
  {/* Ngoài drawer thẻ (không lồng) → mở bên cạnh, drawer thẻ giữ nguyên để xem thẻ đang có DV gì. */}
  <CardItemsDrawer open={adding} title={t("addServiceTitle", { code: card.code })} submitText={t("addService")}
    services={services} existing={card.items.filter((i) => !i.refunded_at)} currentValue={money.value} beside={CARD_DRAWER_WIDTH}
    planned={tours.filter((x) => x.planned)}
    onClose={() => setAdding(false)} onSubmit={(items) => runAction(addCardItems(card.id, items), t("saved"), failed)} />
  </>;
}

/** Lịch sử thao tác (nhật ký DB: ai sửa buổi, hoàn, thu / xoá tiền, tạo / sửa / xoá tour) — bấm Xem mới tải. */
function CardHistory({ card, tours, services, staff }: { card: TreatmentCard; tours: Tour[]; services: Service[]; staff: StaffRef[] }) {
  const t = useTranslations("cards");
  const tt = useTranslations("tour");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const history = useQuery({
    queryKey: ["card-history", card.id],
    enabled: open,
    queryFn: async () => {
      const res = await getCardHistory(card.id);
      if (res.error) throw new Error(res.error);
      return res.rows ?? [];
    },
  });
  // Thao tác xong server revalidate → card / tours đổi → tải lại nhật ký.
  useEffect(() => { qc.invalidateQueries({ queryKey: ["card-history", card.id] }); }, [qc, card, tours]);

  const name = (id: unknown) => staff.find((s) => s.id === id)?.user_name ?? "—";
  const show = (k: string, v: unknown): string => {
    if (k === "service") return services.find((s) => s.id === v)?.name ?? "—";
    if (v == null) return "—";
    if (/amount$/i.test(k)) return (v as number) < 0 ? `− ${formatRupiah(-(v as number))}` : formatRupiah(v as number);
    if (/date$/i.test(k)) return dayjs(v as string).format("DD/MM/YYYY");
    if (/tech$/i.test(k)) return name(v);
    if (/kind$/i.test(k)) return kindText(tt, v as Pick<Tour, "service_detail" | "service_session">) || "—";
    if (k === "method") return t(`method.${v as CardPaymentMethod}`);
    return String(v);
  };
  // Cùng giao dịch (cùng giờ + người) = 1 lần thao tác, vd. tạo thẻ + các DV.
  const groups: { at: string; actor: string | null; lines: AuditEntry[] }[] = [];
  for (const row of history.data ?? []) {
    const lines = auditEntries(row);
    const last = groups[groups.length - 1];
    if (!lines.length) continue;
    if (last && last.at === row.at && last.actor === row.actor) last.lines.push(...lines);
    else groups.push({ at: row.at, actor: row.actor, lines });
  }

  return <Section title={t("history.title")} extra={<Button size="small" icon={<HistoryIcon className="size-4" />}
    loading={open && history.isFetching} onClick={() => setOpen((v) => !v)}>{t(open ? "history.hide" : "history.show")}</Button>}>
    {!open || history.isPending ? null
      : history.error ? <p className="text-sm text-destructive">{history.error.message}</p>
      : !groups.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("history.empty")} />
      : <ol className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
        {groups.map((g) => <li key={`${g.at}|${g.actor}`} className="p-3">
          <div className="text-xs text-muted-foreground tabular-nums">
            {dayjs(g.at).format("DD/MM/YYYY HH:mm")} · <span className="font-medium text-foreground">{g.actor ? name(g.actor) : t("history.system")}</span>
          </div>
          <ul className="mt-1 flex flex-col gap-0.5">
            {g.lines.map((e, i) => <li key={i}>
              {t(`history.${e.key}`, Object.fromEntries(Object.entries(e.values).map(([k, v]) => [k, show(k, v)])))}
            </li>)}
          </ul>
        </li>)}
      </ol>}
  </Section>;
}

/**
 * Số buổi "Đã dùng x/y" — nhấp đúp (hoặc Enter khi đang chọn) để sửa tại chỗ: Enter / rời ô = lưu, Esc = huỷ.
 * Không nhỏ hơn số tour đã có; hết buổi = xong liệu trình, không còn nhắc dặm / kiểm tra laser.
 */
function SessionsCell({ item, used, editable }: { item: CardItem; used: number; editable: boolean }) {
  const t = useTranslations("cards");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<number | null>(item.sessions);
  const [pending, start] = useTransition();
  const closed = useRef(false); // Enter / Esc đóng ô → bỏ qua blur theo sau
  const min = Math.max(used, 1);
  const open = () => { closed.current = false; setValue(item.sessions); setEditing(true); };
  const close = (save: boolean) => {
    if (closed.current) return;
    closed.current = true;
    setEditing(false);
    if (!save || value == null || value < min || value > 100 || value === item.sessions) return;
    start(async () => { await runAction(updateCardItemSessions(item.id, value), t("saved"), t("saveError")); });
  };
  if (editing) return <InputNumber<number> size="small" autoFocus className="w-20" min={min} max={100} precision={0}
    value={value} onChange={setValue} aria-label={t("sessions")} suffix={`/${item.sessions}`}
    onPressEnter={() => close(true)} onBlur={() => close(true)}
    onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(false); } }} />;
  const text = t("usedSessions", { used, total: item.sessions });
  const color = used >= item.sessions ? "text-success" : "text-muted-foreground";
  if (!editable) return <span className={`text-sm tabular-nums ${color}`}>{text}</span>;
  return <span role="button" tabIndex={0} title={t("editSessionsHint")} aria-label={`${text} — ${t("editSessionsHint")}`}
    onDoubleClick={open} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); open(); } }}
    className={`cursor-text rounded px-1 text-sm tabular-nums select-none hover:bg-muted ${color} ${pending ? "opacity-50" : ""}`}>
    {text}
  </span>;
}

/**
 * Kết quả laser (KTV báo sau buổi laser): Sạch → số buổi Laser = số đã làm (lên Làm mới luôn);
 * Còn mực → +1 buổi Laser. Lộ trình dự kiến tự tính lại theo số buổi (server sync).
 */
function LaserResult({ item, used }: { item: CardItem; used: number }) {
  const t = useTranslations("cards");
  const [pending, start] = useTransition();
  const set = (sessions: number) => start(async () => {
    await runAction(updateCardItemSessions(item.id, sessions), t("saved"), t("saveError"));
  });
  return <div className="mt-2 flex flex-wrap gap-2">
    <Button size="small" disabled={pending || item.sessions <= used} onClick={() => set(used)}>{t("laserClean")}</Button>
    {/* Đã có Laser dự kiến tiếp theo (số buổi > đã làm) → còn mực thì cứ theo lộ trình, không cần thêm. */}
    <Button size="small" disabled={pending || item.sessions > used || used >= 100} onClick={() => set(used + 1)}>
      {t("laserMore")}
    </Button>
  </div>;
}

/** Xoá 1 DV khỏi thẻ (nhật ký ghi lại) — chỉ khi DV chưa có tour và thẻ còn DV khác. */
function DeleteItemButton({ item, name, used, last }: { item: CardItem; name: string; used: number; last: boolean }) {
  const t = useTranslations("cards");
  const blocked = used > 0 ? t("error.itemHasTours") : last ? t("error.lastItem") : null;
  const button = <Button size="small" type="text" danger disabled={!!blocked} aria-label={t("deleteItem")}
    icon={<Trash2 className="size-4" />} />;
  if (blocked) return <span title={blocked}>{button}</span>;
  return <ConfirmAction title={t("deleteItemTitle", { name })} description={t("deleteItemBody")} okText={t("delete")} cancelText={t("back")}
    onConfirm={() => runAction(deleteCardItem(item.id), t("itemDeleted"), t("saveError"))}>
    <span title={t("deleteItem")}>{button}</span>
  </ConfirmAction>;
}

/** Hoàn cả thẻ: tiền hoàn ≤ Đã thu (gợi ý theo buổi chưa làm) → thẻ khoá, Công nợ 0, tour dự kiến bị xoá. */
function RefundCardButton({ card, used }: { card: TreatmentCard; used: (itemId: string) => number }) {
  const t = useTranslations("cards");
  const range = cardRefundRange(card, used);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(range.suggest);
  const [method, setMethod] = useState<CardPaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const over = amount != null && amount > range.max;
  const save = () => start(async () => {
    if (await runAction(refundCard(card.id, { amount: amount ?? 0, method, note }), t("cardRefunded"), t("saveError"))) setOpen(false);
  });
  return <Popover trigger="click" placement="topLeft" open={open} title={t("refundCardTitle")}
    onOpenChange={(v) => { setOpen(v); if (v) setAmount(range.suggest); }}
    content={<div className="flex w-72 flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t("refundCardBody")}</p>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("refundAmount")}
        <MoneyInput value={amount} onChange={setAmount} ariaLabel={t("refundAmount")} />
        {over ? <span className="text-destructive">{t("error.refundOverPaid")} ({formatRupiah(range.max)})</span>
          : <span>{t("refundCardHint", { max: formatRupiah(range.max) })}</span>}
      </label>
      {amount ? <Radio.Group optionType="button" value={method} onChange={(e) => setMethod(e.target.value)} className="flex! w-full"
        options={CARD_PAYMENT_METHODS.map((m) => ({ value: m, label: t(`method.${m}`), className: "flex-auto px-2! text-center whitespace-nowrap" }))} /> : null}
      <Input.TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("refundReason")} autoSize={{ minRows: 2 }} maxLength={2000} />
      <Button danger type="primary" loading={pending} disabled={amount == null || over || !note.trim()} onClick={save}>{t("refundCard")}</Button>
    </div>}>
    <Button danger icon={<RotateCcw className="size-4" />}>{t("refundCard")}</Button>
  </Popover>;
}

/** Form thu tiền hiện sẵn (số âm = hoàn tiền khách), kèm 0..n ảnh bill / chuyển khoản; Enter để lưu. */
function PaymentForm({ card }: { card: TreatmentCard }) {
  const t = useTranslations("cards");
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<CardPaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const range = paymentRange(card);
  // Vượt khoảng → báo ngay + khoá nút (DB cũng chặn: trigger treatment_card_payments_guard).
  const over = amount == null ? null
    : amount > range.max ? `${t("error.paymentOverDue")} (${formatRupiah(range.max)})`
    : amount < range.min ? `${t("error.refundOverPaid")} (${formatRupiah(-range.min)})`
    : null;
  const canSave = !!amount && !over && !pending;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    start(async () => {
      if (await runAction(addCardPayment(card.id, { amount: amount ?? 0, method, note, images }), t("saved"), t("saveError"))) {
        setAmount(null); setNote(""); setImages([]);
      }
    });
  };
  return <form onSubmit={save} className="mb-3 flex flex-col gap-3 rounded-lg border border-border p-3">
    <div className="flex flex-wrap items-start gap-3">
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted-foreground">{t("amount")}
        <MoneyInput value={amount} onChange={setAmount} min={-1e13} ariaLabel={t("amount")} />
        {over ? <span className="text-destructive">{over}</span> : <span>{t("amountHint")}</span>}
      </label>
      <Radio.Group optionType="button" value={method} onChange={(e) => setMethod(e.target.value)} className="mt-5"
        options={CARD_PAYMENT_METHODS.map((m) => ({ value: m, label: t(`method.${m}`), className: "whitespace-nowrap" }))} />
    </div>
    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note")} maxLength={2000} />
    <div className="flex flex-wrap items-end justify-between gap-3">
      <PhotoField label={t("paymentPhotos")} value={images} onChange={async (next) => setImages(next)} />
      <Button type="primary" htmlType="submit" loading={pending} disabled={!amount || !!over} icon={<Wallet className="size-4" />}>{t("addPayment")}</Button>
    </div>
  </form>;
}

/**
 * Tạo tour từ thẻ: chọn dịch vụ (mỗi DV 1 tour) + Loại — gợi ý Laser / Plasma theo DV, chưa Làm mới → Làm mới, còn lại Dặm.
 * Số lần server tự tính theo tour đã có; nhãn trong ô chọn là bản xem trước ("Dặm 1").
 * Chỉ DV tạo tour được (không mực / phí Master); vượt số buổi chỉ admin.
 */
function CreateCardTourModal({ card, services, tours, isAdmin, onClose }: {
  card: TreatmentCard;
  services: Service[];
  tours: Tour[];
  isAdmin: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("cards");
  const tt = useTranslations("tour");
  const items = card.items.filter((i) => !i.refunded_at && isTourable(i));
  const ofItem = (id: string) => tours.filter((x) => x.card_item_id === id && !x.planned); // tour dự kiến không tính buổi
  const suggest = (item: CardItem): TourKind => {
    const s = services.find((x) => x.id === item.service_id);
    return s ? suggestTourKind(s, ofItem(item.id)) : "new";
  };
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  // Tick sẵn DV đang đến hạn (kiểm tra laser / dặm); không có thì chỉ khi thẻ còn đúng 1 DV còn buổi — tránh tạo nhầm tour.
  const [picked, setPicked] = useState<Record<string, TourKind | null>>(() => {
    const due = new Set(journeyDue([card], tours).map((d) => d.item.id));
    const open = items.filter((i) => ofItem(i.id).length < i.sessions);
    const pick = due.size ? open.filter((i) => due.has(i.id)) : open.length === 1 ? open : [];
    return Object.fromEntries(pick.map((i) => [i.id, suggest(i)]));
  });
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const chosen = Object.entries(picked).filter((e): e is [string, TourKind] => e[1] != null);
  const submit = () => start(async () => {
    const ok = await runAction(createCardTours(card.id, {
      tour_date: date, note, items: chosen.map(([card_item_id, kind]) => ({ card_item_id, kind })),
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
          const kind = picked[item.id];
          const on = kind != null;
          const done = ofItem(item.id).length;
          const full = done >= item.sessions;
          return <li key={item.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <Checkbox checked={on} aria-label={s?.name} disabled={full && !isAdmin && !on}
              onChange={(e) => setPicked((p) => ({ ...p, [item.id]: e.target.checked ? suggest(item) : null }))} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{s?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">
                {t("usedSessions", { used: done, total: item.sessions })}
                {full ? <span className="text-warning"> · {t(isAdmin ? "overSessions" : "sessionsFull")}</span> : null}
              </div>
            </div>
            <Select<TourKind> size="small" className="w-28" disabled={!on} value={kind ?? undefined} aria-label={tt("kind")}
              onChange={(v) => setPicked((p) => ({ ...p, [item.id]: v }))}
              options={TOUR_KINDS.map((k) => ({ value: k, label: kindText(tt, tourKindDetail(k, date, ofItem(item.id))) }))} />
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
