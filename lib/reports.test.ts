import assert from "node:assert/strict";
import { test } from "node:test";

import { buildDays, change, dayCount, previousRange, salesCommission, totals, vnDay } from "./reports.ts";

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

test("buildDays: Data + Đặt cọc (tiền cọc > 0) theo ngày tạo khách, Đặt lịch theo ngày tạo lịch, doanh thu theo tiền thu ở thẻ", () => {
  const rows = buildDays("2026-11-01", "2026-11-02", {
    fb: new Map([["2026-11-01", { spend: 100, messages: 4 }]]),
    customers: [
      { id: "a", created_at: "2026-11-01T02:00:00Z", deposit_amount: null },
      { id: "b", created_at: "2026-11-01T03:00:00Z", deposit_amount: 500_000 },
      { id: "c", created_at: "2026-11-01T18:00:00Z", deposit_amount: 200_000 }, // = 02/11 giờ VN
      { id: "d", created_at: "2026-10-30T03:00:00Z", deposit_amount: 100 }, // ngoài khoảng
    ],
    appointments: [
      { created_at: "2026-11-01T05:00:00Z" },
      { created_at: "2026-11-01T17:30:00Z" }, // = 02/11 giờ VN
      { created_at: "2026-10-29T05:00:00Z" }, // ngoài khoảng
    ],
    money: [
      { at: "2026-11-02T03:00:00Z", amount: 300 }, // cọc trừ vào thẻ
      { at: "2026-11-01T17:30:00Z", amount: 400 }, // = 02/11 giờ VN
      { at: "2026-11-02T05:00:00Z", amount: -200 }, // hoàn tiền khách
      { at: "2026-10-31T03:00:00Z", amount: 999 }, // ngoài khoảng
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
    appointments: null,
    money: [],
  });
  const t = totals(rows);
  assert.equal(t.spend, null);
  assert.equal(t.costPerData, null);
  assert.equal(t.data, 0);
  assert.equal(t.bookings, null);
  assert.equal(change(5, 0), null);
  assert.equal(change(15, 10), 0.5);
});

test("hoa hồng Sales = 5% tiền thực thu trong kỳ, hoàn tiền trừ ngược, theo người tạo thẻ", () => {
  const rows = salesCommission([
    { at: "2026-11-01T03:00:00Z", amount: 2_000_000, seller: "An" }, // cọc trừ vào thẻ
    { at: "2026-11-05T03:00:00Z", amount: 8_000_000, seller: "An" },
    { at: "2026-11-06T03:00:00Z", amount: -1_000_000, seller: "An" }, // hoàn khách
    { at: "2026-11-03T03:00:00Z", amount: 3_000_000, seller: "Bình" },
    { at: "2026-10-31T16:59:00Z", amount: 5_000_000, seller: "Bình" }, // 23:59 VN 31/10 → ngoài kỳ
  ], "2026-11-01", "2026-11-30");
  assert.deepEqual(rows, [
    { seller: "An", collected: 9_000_000, commission: 450_000 },
    { seller: "Bình", collected: 3_000_000, commission: 150_000 },
  ]);
});
