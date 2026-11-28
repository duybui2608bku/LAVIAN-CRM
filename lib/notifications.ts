import dayjs from "dayjs";

import { journeyDue } from "./cards.ts";
import { formatIdr } from "./currency.ts";

/** Dòng bảng `notifications` (chữ dựng ở client theo kind + data — migration 20261128100000). */
export type AppNotification = {
  id: string;
  kind: string;
  data: Record<string, unknown>;
  link: string | null;
  ref: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationIcon = "calendar" | "phone" | "digest" | "tour" | "card" | "document";

export const notificationIcon = (kind: string): NotificationIcon =>
  kind.endsWith("_digest") ? "digest"
    : kind === "follow_up_due" ? "phone"
      : kind.startsWith("tour_") ? "tour"
        : kind.startsWith("card_") ? "card"
          : kind.startsWith("document_") ? "document"
            : "calendar";

type Part = [key: string, values?: Record<string, string | number>];

const str = (v: unknown) => (v == null || v === "" ? "—" : String(v));
const time = (v: unknown) => (v ? dayjs(String(v)).format("DD-MM HH:mm") : "—");
const day = (v: unknown) => (v ? dayjs(String(v)).format("DD-MM") : "—");
const count = (v: unknown) => Number(v ?? 0);

/** Tổng hợp "hôm nay N · M quá hạn": bỏ phần = 0. */
const digest = (d: Record<string, unknown>, todayKey: string, overdueKey: string): Part[] =>
  [count(d.today) ? [todayKey, { n: count(d.today) }] as Part : null,
    count(d.overdue) ? [overdueKey, { n: count(d.overdue) }] as Part : null].filter((p): p is Part => !!p);

/** Khoá i18n (namespace `notify`) + tham số của 1 thông báo; nhiều phần nối bằng " · ". Kind lạ → []. */
export function notificationParts(n: Pick<AppNotification, "kind" | "data">): Part[] {
  const d = n.data ?? {};
  const customer = str(d.customer);
  switch (n.kind) {
    case "reminder_digest": return digest(d, "reminderToday", "reminderOverdue");
    case "follow_up_digest": return digest(d, "followUpToday", "followUpOverdue");
    case "journey_digest": return digest(d, "journeyToday", "journeyOverdue");
    case "reminder_assigned": return [["reminderAssigned", { by: str(d.by), customer, time: time(d.remind_at) }]];
    case "follow_up_due": return [["followUpDue", { customer, time: time(d.follow_up_at) }]];
    case "appointment_created":
    case "appointment_assigned":
    case "appointment_arrived":
    case "appointment_rescheduled":
    case "appointment_cancelled":
      return [[n.kind, { customer, time: time(d.scheduled_at) }]];
    case "tour_pending":
    case "tour_assigned":
    case "tour_rescheduled":
    case "tour_cancelled":
      return [[n.kind, { customer, date: day(d.tour_date) }]];
    case "card_created":
    case "card_payment":
    case "card_cancelled":
      return [[n.kind, { customer, code: str(d.code), amount: formatIdr(count(d.amount)) }]];
    case "card_refunded":
      return [[d.service ? "card_refunded_service" : "card_refunded",
        { customer, code: str(d.code), amount: formatIdr(count(d.amount)), service: str(d.service) }]];
    case "document_new":
    case "document_comment":
    case "document_reply":
      return [[n.kind, { by: str(d.by), title: str(d.title) }]];
    default: return [];
  }
}

/**
 * Thêm thông báo mới (realtime) vào đầu danh sách. Bản CHƯA ĐỌC cùng `ref` bị thay — khớp DB (notify_users xoá
 * bản chưa đọc cùng ref trước khi chèn), nên tải lại trang vẫn y như vậy.
 */
export function mergeNotification(list: AppNotification[], n: AppNotification, limit: number) {
  const rest = n.ref ? list.filter((x) => x.read_at || x.ref !== n.ref) : list;
  return [n, ...rest.filter((x) => x.id !== n.id)].slice(0, limit);
}

/** Ngày hôm nay (YYYY-MM-DD) theo UTC+7 — cùng mốc với cron / trang Đến hạn. */
export const todayUtc7 = (now = Date.now()) => new Date(now + 7 * 3_600_000).toISOString().slice(0, 10);

type JourneySource = {
  cards: (Parameters<typeof journeyDue>[0][number] & { customer_id: string })[];
  tours: Parameters<typeof journeyDue>[1];
  customers: { id: string; staff_id: string | null; next_at: string | null }[];
};

/**
 * Đếm việc Đến hạn liệu trình của 1 Telesales (giống tab "Cần gọi" ở /customers/journey: khách của mình,
 * chưa có lịch hẹn sắp tới): `today` = đến hạn hôm nay, `overdue` = đã quá hạn.
 */
export function journeyDigestCounts(src: JourneySource, me: string, today: string) {
  const customers = new Map(src.customers.map((c) => [c.id, c]));
  let dueToday = 0;
  let overdue = 0;
  for (const d of journeyDue(src.cards, src.tours)) {
    const c = customers.get(d.card.customer_id);
    if (!c || c.staff_id !== me || c.next_at || d.due > today) continue;
    if (d.due === today) dueToday++;
    else overdue++;
  }
  return { today: dueToday, overdue };
}
