import assert from "node:assert/strict";
import { test } from "node:test";

import { buildDays, change, dayCount, previousRange, totals, vnDay } from "./reports.ts";

test("previousRange lấy kỳ liền trước cùng số ngày", () => {
  assert.equal(dayCount("2026-11-01", "2026-11-07"), 7);
  assert.deepEqual(previousRange("2026-11-01", "2026-11-07"), {
    from: "2026-10-25",
    to: "2026-10-31",
  });
  assert.deepEqual(previousRange("2026-03-01", "2026-03-01"), {
    from: "2026-02-28",
    to: "2026-02-28",
  });
});

test("vnDay đổi UTC sang ngày UTC+7", () => {
  assert.equal(vnDay("2026-11-08T16:59:59Z"), "2026-11-08");
  assert.equal(vnDay("2026-11-08T17:00:00Z"), "2026-11-09");
});

test("buildDays đếm Data/Đặt cọc/Đặt lịch theo ngày tạo khách + doanh thu theo tour", () => {
  const rows = buildDays("2026-11-01", "2026-11-02", {
    fb: new Map([["2026-11-01", { spend: 100, messages: 4 }]]),
    customers: [
      { id: "a", created_at: "2026-11-01T02:00:00Z", stage: "new_lead" },
      { id: "b", created_at: "2026-11-01T03:00:00Z", stage: "deposited" },
      { id: "c", created_at: "2026-11-01T18:00:00Z", stage: "visited" }, // = 02/11 giờ VN
      { id: "d", created_at: "2026-10-30T03:00:00Z", stage: "booked" }, // ngoài khoảng
    ],
    bookedIds: new Set(["a"]),
    tours: [
      { tour_date: "2026-11-02", bill_amount: 500 },
      { tour_date: "2026-11-02", bill_amount: null },
    ],
  });
  assert.deepEqual(rows, [
    { date: "2026-11-01", spend: 100, messages: 4, data: 2, deposits: 1, bookings: 1, revenue: 0 },
    { date: "2026-11-02", spend: 0, messages: 0, data: 1, deposits: 1, bookings: 1, revenue: 500 },
  ]);
  const t = totals(rows);
  assert.equal(t.costPerMessage, 25);
  assert.equal(t.costPerData, 100 / 3);
  assert.equal(t.revenue, 500);
});

test("nguồn lỗi → null, chia cho 0 → null", () => {
  const rows = buildDays("2026-11-01", "2026-11-01", {
    fb: null,
    customers: [],
    bookedIds: null,
    tours: [],
  });
  const t = totals(rows);
  assert.equal(t.spend, null);
  assert.equal(t.costPerData, null);
  assert.equal(t.data, 0);
  assert.equal(t.bookings, null);
  assert.equal(change(5, 0), null);
  assert.equal(change(15, 10), 0.5);
});
