import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeNotification, notificationIcon, notificationParts, todayUtc7, type AppNotification } from "./notifications.ts";

const n = (id: string, ref: string | null, read = false): AppNotification => ({
  id, kind: "appointment_rescheduled", data: {}, link: null, ref, read_at: read ? "2026-11-28T00:00:00Z" : null,
  created_at: "2026-11-28T00:00:00Z",
});

test("gộp thông báo cùng ref: thay bản chưa đọc, giữ bản đã đọc", () => {
  const list = [n("a", "appt:1"), n("b", "appt:1", true), n("c", "appt:2")];
  assert.deepEqual(mergeNotification(list, n("d", "appt:1"), 20).map((x) => x.id), ["d", "b", "c"]);
  assert.deepEqual(mergeNotification(list, n("e", null), 2).map((x) => x.id), ["e", "a"]);
  assert.deepEqual(mergeNotification(list, n("a", "appt:9"), 20).map((x) => x.id), ["a", "b", "c"]); // không trùng id
});

test("chữ thông báo theo kind", () => {
  assert.deepEqual(notificationParts({ kind: "journey_digest", data: { today: 0, overdue: 3 } }), [["journeyOverdue", { n: 3 }]]);
  assert.deepEqual(notificationParts({ kind: "card_refunded", data: { code: "LV1", customer: "A", amount: 1000, service: "Mày" } })[0][0],
    "card_refunded_service");
  assert.equal(notificationParts({ kind: "tour_pending", data: { customer: "B", tour_date: "2026-12-01" } })[0][1]?.date, "01-12");
  assert.deepEqual(notificationParts({ kind: "unknown", data: {} }), []);
});

test("icon theo nhóm", () => {
  assert.equal(notificationIcon("follow_up_digest"), "digest");
  assert.equal(notificationIcon("tour_assigned"), "tour");
  assert.equal(notificationIcon("document_reply"), "document");
  assert.equal(notificationIcon("appointment_arrived"), "calendar");
});

test("ngày UTC+7", () => {
  assert.equal(todayUtc7(Date.parse("2026-11-28T17:30:00Z")), "2026-11-29");
  assert.equal(todayUtc7(Date.parse("2026-11-28T16:30:00Z")), "2026-11-28");
});
