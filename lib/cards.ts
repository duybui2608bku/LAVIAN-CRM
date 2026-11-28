import { z } from "zod";

import { addDays } from "./date-presets.ts";

// Thẻ liệu trình — tiền + quy tắc dùng chung client/server. Literal (không import "@/…") để node --test chạy được.
export const CARD_PAYMENT_METHODS = ["cash", "bank", "card"] as const; // khớp check DB treatment_card_payments.method
export type CardPaymentMethod = (typeof CARD_PAYMENT_METHODS)[number];
export const MAX_TOUR_SESSION = 20; // khớp check tours.service_session

type MoneyItem = { price: number; refund_amount: number | null };
/** `refund_amount` của thẻ: hoàn cả thẻ (null = chưa hoàn). */
type MoneyCard = { deposit_used: number; items: MoneyItem[]; payments: { amount: number }[]; refund_amount?: number | null };

/**
 * Giá trị thẻ = Σ giá bán − Σ tiền hoàn DV (dữ liệu cũ); Đã thu = cọc trừ vào thẻ + Σ thanh toán (âm = đã hoàn khách)
 * − tiền hoàn thẻ; Công nợ = Giá trị − Đã thu (âm = phải hoàn khách).
 * Thẻ đã hoàn: Giá trị = Đã thu sau hoàn (phần cơ sở giữ lại) → Công nợ 0.
 */
export function cardMoney(card: MoneyCard) {
  const paid = card.deposit_used + card.payments.reduce((s, p) => s + p.amount, 0);
  if (card.refund_amount != null) {
    const collected = paid - card.refund_amount;
    return { value: collected, collected, due: 0 };
  }
  const value = card.items.reduce((s, i) => s + i.price - (i.refund_amount ?? 0), 0);
  return { value, collected: paid, due: value - paid };
}

/** Hoàn cả thẻ: tối đa = Đã thu (cọc trừ + thanh toán); gợi ý = giá × buổi chưa làm / tổng buổi của từng DV, không quá tối đa. */
type RefundItem = MoneyItem & { id: string; sessions: number; refunded_at: string | null } & ItemService;
export function cardRefundRange(card: Omit<MoneyCard, "items"> & { items: RefundItem[] }, used: (itemId: string) => number) {
  const max = Math.max(cardMoney(card).collected, 0);
  const left = card.items.filter((i) => !i.refunded_at)
    .reduce((s, i) => s + (isTourable(i) ? suggestRefund(i.price, i.sessions, used(i.id)) : i.price), 0);
  return { max, suggest: Math.min(left, max) };
}

/**
 * Khoảng tiền 1 lần thu được phép (khớp trigger DB treatment_card_payments_guard):
 * thu (dương) ≤ Công nợ còn lại; hoàn (âm) ≤ Σ đã thu qua thanh toán (cọc không hoàn ở đây).
 */
export function paymentRange(card: MoneyCard) {
  const paid = card.payments.reduce((s, p) => s + p.amount, 0);
  return { min: paid > 0 ? -paid : 0, max: Math.max(cardMoney(card).due, 0) };
}

/**
 * Tiền của 1 khách qua mọi thẻ chưa huỷ (hồ sơ 360°). Cọc chưa trừ vào thẻ nào vẫn là tiền đã thu.
 * Chưa có thẻ mà có cọc → Công nợ null ("Chưa xác định").
 */
export function customerCardMoney(cards: (MoneyCard & { cancelled_at: string | null })[], deposit: number | null | undefined) {
  const active = cards.filter((c) => !c.cancelled_at);
  const depositLeft = Math.max((deposit ?? 0) - active.reduce((s, c) => s + c.deposit_used, 0), 0);
  const value = active.reduce((s, c) => s + cardMoney(c).value, 0);
  const collected = depositLeft + active.reduce((s, c) => s + cardMoney(c).collected, 0);
  return { value, collected, depositLeft, due: !active.length && depositLeft > 0 ? null : value - collected };
}

/** Gợi ý tiền hoàn 1 dịch vụ = giá × buổi chưa làm / tổng buổi. */
export const suggestRefund = (price: number, sessions: number, used: number) =>
  Math.round((price * Math.max(sessions - used, 0)) / Math.max(sessions, 1));

/** DV của dòng thẻ (join `services`): `tourable = false` = mực, phí Master, sản phẩm — không tạo tour, không tính buổi. */
type ItemService = { service?: { group_id: string; tourable: boolean } | null };
export const isTourable = (item: ItemService) => item.service?.tourable !== false;

/**
 * Mỗi nhóm chỉ 1 DV tạo tour / thẻ (không ai làm 2 kiểu mày): `service` trùng nhóm với DV tạo tour trong `taken`?
 * Dòng phụ (mực, phí Master, sản phẩm) không tính. Khớp trigger DB treatment_card_items_group_guard.
 */
type GroupService = { group_id: string; tourable: boolean };
export const groupTaken = (service: GroupService, taken: GroupService[]) =>
  service.tourable && taken.some((s) => s.tourable && s.group_id === service.group_id);

/** Thẻ hoàn thành: mọi dịch vụ (tạo tour được) chưa hoàn đã dùng đủ số buổi. */
/** Trạng thái thẻ: huỷ / đã hoàn (khoá) / hoàn thành (đủ buổi) / đang dùng. */
export function cardStatus(card: { cancelled_at: string | null; refunded_at?: string | null; items: Parameters<typeof cardDone>[0] },
  used: (itemId: string) => number) {
  return card.cancelled_at ? "cancelled" : card.refunded_at ? "refunded" : cardDone(card.items, used) ? "done" : "active";
}

export function cardDone(items: ({ id: string; sessions: number; refunded_at: string | null } & ItemService)[], used: (itemId: string) => number) {
  const list = items.filter(isTourable);
  return list.some((i) => !i.refunded_at) && list.every((i) => i.refunded_at || used(i.id) >= i.sessions);
}

// ───────── Loại tour + lộ trình liệu trình (sếp chốt 2026-11-22) ─────────
// Laser (mày) / Plasma (môi) xoá cũ → kiểm tra sau 20 ngày: tour kế tiếp lại Laser = chưa OK, Làm mới = OK.
// Lộ trình dự kiến dùng cùng khoảng: Laser → Laser / Làm mới 20 ngày.
// Làm mới / Dặm xong → dặm sau 45 ngày nếu DV còn buổi.
// Môi (sếp chốt 2026-11-27): Plasma (hút dung dịch / CO2) → Làm mới → Dặm, mỗi bước 2 tháng = 60 ngày.
export const LASER_CHECK_DAYS = 20;
export const RETOUCH_DAYS = 45;
export const LIP_STEP_DAYS = 60;
/** Loại tour chọn được = tours.service_detail (debt chỉ còn ở dữ liệu cũ). Khớp tourPatchSchema.kind (lib/tours.ts). */
export const TOUR_KINDS = ["laser", "plasma", "new", "retouch"] as const;
export type TourKind = (typeof TOUR_KINDS)[number];

const LASER_GROUPS = ["laser", "eyeliner_treatment"];
const isRemoval = (detail: string | null) => detail === "laser" || detail === "plasma";
/** Vùng làm (mày / môi / mí): nhóm xoá cũ cùng vùng với nhóm phun — laser mày chỉ chặn dặm mày, không chặn môi. */
const AREA: Record<string, string> = { laser: "alis", lips_treatment: "bibir", eyeliner_treatment: "eyeliner" };
const areaOf = (groupId: string | undefined) => (groupId ? AREA[groupId] ?? groupId : "");
/** Khoảng cách (ngày) tới bước kế theo vùng: sau xoá cũ (laser / plasma) và sau Làm mới / Dặm. Vùng chưa chốt = như mày. */
const GAPS: Record<string, { removal: number; care: number }> = {
  alis: { removal: LASER_CHECK_DAYS, care: RETOUCH_DAYS },
  bibir: { removal: LIP_STEP_DAYS, care: LIP_STEP_DAYS },
};
const gapOf = (area: string) => GAPS[area] ?? GAPS.alis;

type KindTour = { tour_date: string; service_detail: string | null };
// Cùng ngày: tour xoá cũ (laser/plasma) xếp trước → tour Làm mới cùng ngày mới là "tour cuối".
const order = (a: KindTour, b: KindTour) =>
  a.tour_date.localeCompare(b.tour_date) || Number(isRemoval(b.service_detail)) - Number(isRemoval(a.service_detail));

/** Loại gợi ý cho tour mới của 1 dòng DV: nhóm Laser / tên "laser" → Laser; tên "plasma" → Plasma; chưa Làm mới → Làm mới; còn lại Dặm. */
export function suggestTourKind(service: { group_id: string; name: string }, itemTours: KindTour[]): TourKind {
  if (LASER_GROUPS.includes(service.group_id) || /laser/i.test(service.name)) return "laser";
  if (/plasma/i.test(service.name)) return "plasma";
  return itemTours.some((t) => t.service_detail === "new") ? "retouch" : "new";
}

/**
 * Giá trị lưu DB của Loại: Làm mới không có số; Laser / Plasma / Dặm số n = số tour cùng loại khác của dòng DV
 * có ngày ≤ ngày tour này + 1 (check DB: 1–20).
 * ponytail: đổi Loại / ngày 1 tour không đánh số lại các tour sau — chỉ là nhãn.
 */
export function tourKindDetail(kind: TourKind, date: string, others: KindTour[]) {
  if (kind === "new") return { service_detail: kind, service_session: null };
  const n = others.filter((t) => t.service_detail === kind && t.tour_date <= date).length + 1;
  return { service_detail: kind, service_session: Math.min(n, MAX_TOUR_SESSION) };
}

type DueItem = { id: string; service_id: string; sessions: number; refunded_at: string | null } & ItemService;
type DueCard = { cancelled_at: string | null; refunded_at?: string | null; items: DueItem[] };
type DueTour = KindTour & { card_item_id: string | null; service_session: number | null; planned?: boolean };
export type JourneyDue<C, T> = {
  card: C;
  item: DueItem;
  /** laser_check = Kiểm tra laser/plasma; retouch = Dặm lần `n`. */
  task: "laser_check" | "retouch";
  n: number;
  due: string; // YYYY-MM-DD
  last: T; // tour tính hạn
};

/**
 * Việc đến hạn của khách đang có liệu trình — tự tính từ thẻ + tour, không lưu. Tính riêng từng vùng (mày / môi / mí),
 * khoảng cách theo vùng (`GAPS`: mày 20 / 45, môi 60 / 60):
 * - Tour cuối của vùng là Laser/Plasma + vùng còn buổi → Kiểm tra laser (ngày tour + removal): đủ điều kiện phun mới chưa.
 * - Ngược lại, mỗi DV chưa hoàn còn buổi có tour cuối Làm mới / Dặm → Dặm (ngày tour + care).
 * Bỏ qua DV không tạo tour (mực, phí Master). Tour ngày tương lai cũng tính là "tour kế tiếp" (đã hẹn thì không nhắc lại).
 */
export function journeyDue<C extends DueCard, T extends DueTour>(cards: C[], tours: T[]): JourneyDue<C, T>[] {
  const out: JourneyDue<C, T>[] = [];
  const real = tours.filter((t) => !t.planned); // tour dự kiến chưa chốt với khách → vẫn nhắc
  const ofItem = (id: string) => real.filter((t) => t.card_item_id === id).sort(order);
  for (const card of cards) {
    if (card.cancelled_at || card.refunded_at) continue;
    const areas = new Map<string, DueItem[]>();
    for (const i of card.items.filter(isTourable)) {
      const key = areaOf(i.service?.group_id) || i.service_id;
      areas.set(key, [...(areas.get(key) ?? []), i]);
    }
    for (const [area, items] of areas) {
      const gap = gapOf(area);
      const open = items.filter((i) => !i.refunded_at && ofItem(i.id).length < i.sessions);
      const last = items.flatMap((item) => ofItem(item.id).map((tour) => ({ tour, item })))
        .sort((a, b) => order(a.tour, b.tour)).at(-1);
      if (last && isRemoval(last.tour.service_detail)) {
        if (open.length) out.push({ card, item: last.item, task: "laser_check", n: last.tour.service_session ?? 1,
          due: addDays(last.tour.tour_date, gap.removal), last: last.tour });
        continue;
      }
      for (const item of open) {
        const list = ofItem(item.id);
        const end = list.at(-1);
        if (!end || (end.service_detail !== "new" && end.service_detail !== "retouch")) continue;
        out.push({ card, item, task: "retouch", n: list.filter((t) => t.service_detail === "retouch").length + 1,
          due: addDays(end.tour_date, gap.care), last: end });
      }
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

// ───────── Lộ trình tour dự kiến (sếp chốt 2026-11-23: mày; 2026-11-27: môi) ─────────
/** Vùng có tour dự kiến tự sinh (= nhóm DV chính, xem AREA). Mí: thêm "eyeliner" khi sếp chốt. */
export const ROADMAP_AREAS = ["alis", "bibir"];

/**
 * Vùng chính của thẻ (sếp chốt 2026-11-27): 1 thẻ là thẻ Mày (alis + laser) HOẶC thẻ Môi (bibir + lips_treatment).
 * `service` (DV tạo tour) thuộc vùng chính khác vùng của DV tạo tour đã có trong `taken`? Khớp trigger DB card_area_taken.
 */
const mainArea = (s: GroupService) => (s.tourable && ROADMAP_AREAS.includes(areaOf(s.group_id)) ? areaOf(s.group_id) : null);
export const areaTaken = (service: GroupService, taken: GroupService[]) => {
  const area = mainArea(service);
  return !!area && taken.some((s) => { const other = mainArea(s); return !!other && other !== area; });
};

type PlanItem = { id: string; service_id: string; sessions: number; refunded_at: string | null }
  & { service?: { group_id: string; tourable: boolean; name?: string } | null };
type PlanTour = KindTour & { card_item_id: string | null };
/** `pinned` = ngày do người dùng sửa tay (giữ khi tính lại). */
export type RoadmapStep = { card_item_id: string; service_id: string; kind: TourKind; tour_date: string; pinned: boolean };

/** Loại của DV xoá cũ (nhóm Laser → Laser, tên "plasma" → Plasma); DV khác → null. */
const removalKind = (s: PlanItem["service"]) => {
  const kind = s ? suggestTourKind({ group_id: s.group_id, name: s.name ?? "" }, []) : null;
  return kind === "laser" || kind === "plasma" ? kind : null;
};

/**
 * Tour dự kiến còn lại của 1 thẻ chưa huỷ. `tours` = tour THẬT của thẻ (không dự kiến, chưa xoá).
 * Mỗi vùng (mày / môi): DV chính = nhóm của vùng, bước xoá = DV xoá cũ cùng vùng (Laser mày / Plasma môi); DV khác
 * của vùng (Dark Lip, Collagen…) không thuộc lộ trình. Neo = tour thật cuối (chưa có → không sinh). Chưa Làm mới → các
 * buổi xoá còn lại (số buổi dòng xoá = số tour xoá dự kiến), rồi Làm mới; sau đó Dặm tới hết buổi DV chính.
 * Khoảng cách theo vùng + Loại bước trước (`GAPS`): mày sau Laser 20 ngày, sau Làm mới / Dặm 45; môi mọi bước 60.
 * `pinned(itemId, k)` = ngày người dùng đã sửa tay cho bước dự kiến thứ k của dòng DV → giữ ngày đó, các bước sau tính tiếp từ nó.
 * `start` = ngày bước đầu khi vùng CHƯA có tour thật (lộ trình lập lúc bán thẻ); hàm = theo dòng DV của vùng; không có → không sinh.
 */
export function planRoadmap(
  items: PlanItem[], tours: PlanTour[], pinned?: (itemId: string, k: number) => string | null,
  start?: string | ((itemIds: string[]) => string | undefined),
): RoadmapStep[] {
  const out: RoadmapStep[] = [];
  for (const area of ROADMAP_AREAS) {
    const list = items.filter((i) => isTourable(i) && !i.refunded_at && areaOf(i.service?.group_id) === area);
    const main = list.find((i) => i.service?.group_id === area);
    const removal = list.find((i) => i !== main && removalKind(i.service));
    const own = [main, removal].filter((i): i is PlanItem => !!i);
    const real = tours.filter((t) => own.some((i) => i.id === t.card_item_id)).sort(order);
    const anchor = real.at(-1);
    const begin = typeof start === "function" ? start(own.map((i) => i.id)) : start;
    if (!own.length || (!anchor && !begin)) continue;
    const gap = gapOf(area);
    let date = anchor?.tour_date ?? begin!;
    let prev = anchor?.service_detail ?? null;
    let first = !anchor; // chưa có tour thật: bước đầu đúng ngày `start`, không cộng khoảng cách
    const push = (item: PlanItem, kind: TourKind) => {
      const pin = pinned?.(item.id, out.filter((s) => s.card_item_id === item.id).length) ?? null;
      date = pin ?? (first ? date : addDays(date, isRemoval(prev) ? gap.removal : gap.care));
      first = false;
      prev = kind;
      out.push({ card_item_id: item.id, service_id: item.service_id, kind, tour_date: date, pinned: pin != null });
    };
    const used = (item: PlanItem) => real.filter((t) => t.card_item_id === item.id).length;
    let mainLeft = main ? main.sessions - used(main) : 0;
    if (!real.some((t) => t.card_item_id === main?.id && t.service_detail === "new")) {
      for (let n = removal ? removal.sessions - used(removal) : 0; n > 0; n--) push(removal!, removalKind(removal!.service)!);
      if (main && mainLeft > 0) { push(main, "new"); mainLeft--; }
    }
    for (; main && mainLeft > 0; mainLeft--) push(main, "retouch");
  }
  return out;
}

const money = z.number().int().min(0).max(1e13);
const note = z.string().trim().max(2000).default("");
export const cardItemInputSchema = z.object({
  service_id: z.uuid(),
  price: money,
  sessions: z.number().int().min(1).max(100),
}).strict();
const items = z.array(cardItemInputSchema).min(1).max(30);

/** Lộ trình lập lúc bán thẻ: ngày bước đầu + ngày sửa tay của bước thứ k từng DV (theo service_id vì dòng thẻ chưa có id). */
export const cardPlanSchema = z.object({
  start: z.iso.date(),
  pins: z.array(z.object({ service_id: z.uuid(), k: z.number().int().min(0).max(100), date: z.iso.date() }).strict()).max(100),
}).strict();
export type CardPlan = z.infer<typeof cardPlanSchema>;

export const cardCreateSchema = z.object({
  customer_id: z.uuid(),
  appointment_id: z.uuid().nullable(),
  items,
  note,
  plan: cardPlanSchema.optional(),
}).strict();

export const cardItemsAddSchema = items;

export const cardRefundSchema = z.object({ amount: money, method: z.enum(CARD_PAYMENT_METHODS), note }).strict();

/** Sửa số buổi 1 DV trong thẻ (khớp check DB 1–100; server chặn thêm < số tour đã có). */
export const cardItemSessionsSchema = cardItemInputSchema.shape.sessions;

export const cardPaymentSchema = z.object({
  amount: z.number().int().min(-1e13).max(1e13).refine((v) => v !== 0),
  method: z.enum(CARD_PAYMENT_METHODS),
  note,
  images: z.array(z.url({ protocol: /^https?$/ })).max(30).default([]), // khớp check DB
}).strict();

export const cardTourSchema = z.object({
  tour_date: z.iso.date(),
  items: z.array(z.object({ card_item_id: z.uuid(), kind: z.enum(TOUR_KINDS) }).strict())
    .min(1).max(30).refine((list) => new Set(list.map((i) => i.card_item_id)).size === list.length),
  note: z.string().trim().max(10000).default(""),
}).strict();

/** 1 dòng nhật ký `card_audit` (trigger DB ghi mọi thay đổi thẻ / DV / thanh toán / tour). */
export type CardAudit = {
  id: number;
  table_name: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
  actor: string | null;
  at: string;
};
/** Khoá i18n `cards.history.*` + giá trị: `service` = id DV, `*amount` = tiền, `*date` = ngày, `*tech` = NV, `*kind` = loại tour. */
export type AuditEntry = { key: string; values: Record<string, unknown> };

/** Dòng nhật ký → các thao tác đáng kể. Rỗng = lưu lại y nguyên (drawer tour gửi lại bill / loại không đổi) → không hiện. */
export function auditEntries(a: CardAudit): AuditEntry[] {
  const o = a.old_row ?? {};
  const n = a.new_row ?? {};
  const r = a.op === "DELETE" ? o : n;
  const out: AuditEntry[] = [];
  // Tour: kèm ngày để phân biệt các tour cùng DV.
  const base = a.table_name === "tours" ? { service: r.service_id, date: r.tour_date } : { service: r.service_id };
  const add = (key: string, values: Record<string, unknown> = {}) => { out.push({ key, values: { ...base, ...values } }); };
  const changed = (k: string) => a.op === "UPDATE" && JSON.stringify(o[k]) !== JSON.stringify(n[k]);
  const kind = (x: Record<string, unknown>) => ({ service_detail: x.service_detail, service_session: x.service_session });
  let handled = ["updated_at"];
  switch (a.table_name) {
    case "treatment_cards":
      if (a.op === "INSERT") add("cardCreated");
      else if (a.op === "DELETE") add("cardDeleted");
      else if (changed("cancelled_at")) add(n.cancelled_at ? "cardCancelled" : "cardRestored");
      else if (changed("refunded_at") && n.refunded_at) add("cardRefunded", { amount: n.refund_amount });
      handled.push("cancelled_at", "cancelled_by", "refunded_at", "refunded_by", "refund_amount", "refund_method", "refund_note");
      break;
    case "treatment_card_items":
      if (a.op === "INSERT") add("itemAdded", { n: r.sessions, amount: r.price });
      else if (a.op === "DELETE") add("itemDeleted", { n: r.sessions, amount: r.price });
      else {
        if (changed("sessions")) add("sessions", { oldN: o.sessions, n: n.sessions });
        if (changed("refunded_at")) add(n.refunded_at ? "refunded" : "refundUndone", { amount: n.refund_amount });
        else if (changed("refund_amount")) add("refundEdited", { oldAmount: o.refund_amount, amount: n.refund_amount });
      }
      handled.push("sessions", "refunded_at", "refund_amount", "refund_note");
      break;
    case "treatment_card_payments":
      if (a.op !== "UPDATE") add(a.op === "INSERT" ? "payment" : "paymentDeleted", { amount: r.amount, method: r.method });
      break;
    case "tours":
      // Tour: chỉ các cột trigger theo dõi; đổi khách / DV của tour thẻ bị guard chặn (phải khớp DV trong thẻ).
      handled = Object.keys(n);
      if (a.op === "INSERT") add("tourCreated", { kind: kind(r) });
      else if (a.op === "DELETE" || (changed("deleted_at") && n.deleted_at)) add("tourDeleted");
      else {
        if (changed("deleted_at")) add("tourRestored");
        if (changed("card_item_id")) add(n.card_item_id ? "tourLinked" : "tourUnlinked");
        if (changed("tour_date")) add("tourDate", { oldDate: o.tour_date });
        if (changed("service_detail") || changed("service_session")) add("tourKind", { oldKind: kind(o), kind: kind(n) });
        if (changed("technician_id")) add("tourTech", { oldTech: o.technician_id, tech: n.technician_id });
        if (changed("confirmed_at")) add(n.confirmed_at ? "tourConfirmed" : "tourUnconfirmed");
      }
      break;
  }
  // Cột khác (admin sửa thẳng DB) — vẫn hiện để không sót.
  const other = Object.keys(n).filter((k) => changed(k) && !handled.includes(k));
  if (other.length) add("edited", { fields: other.join(", ") });
  return out;
}
