import dayjs from "dayjs";

import type { Reminder, ReminderState } from "@/types/reminder";

/** Tạm tắt tính năng nhắc hẹn (menu, cột Nhắc hẹn, trang calendar). Chuông vẫn bật cho Khách tiềm năng. */
export const REMINDERS_ENABLED = false;

export const REMINDER_COLORS: Record<ReminderState, string> = {
  overdue: "red",
  today: "orange",
  upcoming: "blue",
  done: "default",
};

/** Trạng thái lịch nhắc so với `now` (ngày theo giờ máy — nhân viên ở cùng múi giờ cơ sở). */
export function reminderState(r: Pick<Reminder, "remind_at" | "done_at">, now: number): ReminderState {
  if (r.done_at) return "done";
  const at = dayjs(r.remind_at);
  if (at.isSame(now, "day")) return at.valueOf() < now ? "overdue" : "today";
  return at.valueOf() < now ? "overdue" : "upcoming";
}

/** Lịch nhắc chưa xong sớm nhất (kể cả quá hạn) — hiển thị ở cột Nhắc hẹn. */
export function nextPending<T extends Pick<Reminder, "remind_at" | "done_at">>(list: T[]): T | undefined {
  return list
    .filter((r) => !r.done_at)
    .sort((a, b) => Date.parse(a.remind_at) - Date.parse(b.remind_at))[0];
}

/**
 * Giờ nhắc gợi ý: 9:00 một ngày trước lịch hẹn nếu còn ở tương lai; không thì 1 giờ nữa (làm tròn phút 0).
 */
export function suggestRemindAt(appointmentAt: string | undefined, now: number): string {
  if (appointmentAt) {
    const before = dayjs(appointmentAt).subtract(1, "day").hour(9).minute(0).second(0).millisecond(0);
    if (before.valueOf() > now) return before.toISOString();
  }
  return dayjs(now).add(1, "hour").minute(0).second(0).millisecond(0).toISOString();
}
