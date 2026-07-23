import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateFinancialGrowth,
  calculateFinancialMetrics,
  getPreviousFinancialRange,
  isValidDateRange,
} from "./financial.ts";

test("isValidDateRange kiểm tra ngày thực và thứ tự khoảng", () => {
  assert.equal(isValidDateRange("2026-07-01", "2026-07-31"), true);
  assert.equal(isValidDateRange("2026-02-29", "2026-03-01"), false);
  assert.equal(isValidDateRange("2026-07-31", "2026-07-01"), false);
  assert.equal(isValidDateRange("01-07-2026", "2026-07-31"), false);
});

test("tính Doanh thu, Thực thu, Công nợ và AOV không cộng sổ chưa báo giá", () => {
  const metrics = calculateFinancialMetrics(
    [
      { id: "ledger-1", total_amount: 1_000 },
      { id: "ledger-2", total_amount: "2000" },
      { id: "ledger-3", total_amount: null },
    ],
    [
      { ledger_id: "ledger-1", kind: "deposit", amount: 300 },
      { ledger_id: "ledger-1", kind: "refund", amount: 50 },
      { ledger_id: "ledger-2", kind: "payment", amount: 2_500 },
    ],
    [
      { kind: "deposit", amount: 400 },
      { kind: "payment", amount: "200" },
      { kind: "refund", amount: 100 },
    ],
  );

  assert.deepEqual(metrics, {
    revenue: 3_000,
    collected: 500,
    outstanding: 750,
    aov: 1_500,
    orderCount: 2,
  });
});

test("kỳ không có sổ báo giá trả AOV bằng 0", () => {
  assert.deepEqual(calculateFinancialMetrics([], [], []), {
    revenue: 0,
    collected: 0,
    outstanding: 0,
    aov: 0,
    orderCount: 0,
  });
});

test("kỳ trước liên tục và có cùng số ngày", () => {
  assert.deepEqual(getPreviousFinancialRange("2026-07-22", "2026-07-22"), {
    from: "2026-07-21",
    to: "2026-07-21",
  });
  assert.deepEqual(getPreviousFinancialRange("2026-07-14", "2026-07-20"), {
    from: "2026-07-07",
    to: "2026-07-13",
  });
  assert.deepEqual(getPreviousFinancialRange("2026-07-30", "2026-08-05"), {
    from: "2026-07-23",
    to: "2026-07-29",
  });
});

test("tính tăng trưởng cho toàn bộ chỉ số tài chính", () => {
  assert.deepEqual(
    calculateFinancialGrowth(
      {
        revenue: 150,
        collected: 50,
        outstanding: 0,
        aov: 75,
        orderCount: 2,
      },
      {
        revenue: 100,
        collected: 100,
        outstanding: 0,
        aov: 50,
        orderCount: 0,
      },
    ),
    {
      revenue: 50,
      collected: -50,
      outstanding: 0,
      aov: 50,
      orderCount: 100,
    },
  );
});
