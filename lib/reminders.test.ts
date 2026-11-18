import assert from "node:assert/strict";
import { test } from "node:test";

import { nextPending, reminderState, suggestRemindAt } from "./reminders.ts";

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const now = at(2026, 11, 18, 10);

test("trạng thái lịch nhắc", () => {
  assert.equal(reminderState({ remind_at: iso(at(2026, 11, 18, 15)), done_at: null }, now), "today");
  assert.equal(reminderState({ remind_at: iso(at(2026, 11, 18, 9)), done_at: null }, now), "overdue");
  assert.equal(reminderState({ remind_at: iso(at(2026, 11, 17, 15)), done_at: null }, now), "overdue");
  assert.equal(reminderState({ remind_at: iso(at(2026, 11, 19, 9)), done_at: null }, now), "upcoming");
  assert.equal(reminderState({ remind_at: iso(at(2026, 11, 17, 9)), done_at: iso(now) }, now), "done");
});

test("lịch nhắc chưa xong sớm nhất", () => {
  const list = [
    { id: "a", remind_at: iso(at(2026, 11, 20)), done_at: null },
    { id: "b", remind_at: iso(at(2026, 11, 16)), done_at: iso(now) },
    { id: "c", remind_at: iso(at(2026, 11, 17)), done_at: null },
  ];
  assert.equal(nextPending(list)?.id, "c");
  assert.equal(nextPending([]), undefined);
});

test("gợi ý giờ nhắc", () => {
  // Hẹn 20/11 14:00 → nhắc 19/11 9:00.
  assert.equal(suggestRemindAt(iso(at(2026, 11, 20, 14)), now), iso(at(2026, 11, 19, 9)));
  // Hẹn 16:00 hôm nay → mốc 9:00 hôm qua đã qua → 1 giờ nữa (11:00).
  assert.equal(suggestRemindAt(iso(at(2026, 11, 18, 16)), now), iso(at(2026, 11, 18, 11)));
  assert.equal(suggestRemindAt(undefined, now), iso(at(2026, 11, 18, 11)));
});
