import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateFinancialGrowth,
  calculateFinancialMetrics,
  calculateSalesPerformance,
  calculateServiceStats,
  calculateSourceStats,
  getPreviousFinancialRange,
  isValidDateRange,
} from "./financial.ts";

test("thống kê theo nguồn: data + doanh thu (gồm upsales), nguồn lạ và khách chưa gắn nguồn", () => {
  const options = [
    { value: "facebook", label_vi: "Facebook", label_en: "Facebook", label_id: null, color: "#3b82f6", sort_order: 0 },
    { value: "instagram", label_vi: "Instagram", label_en: null, label_id: null, color: "#ec4899", sort_order: 10 },
  ];

  assert.deepEqual(
    calculateSourceStats(
      options,
      [
        { source: "facebook" },
        { source: "facebook" },
        { source: "instagram" },
        { source: "tiktok" }, // option đã xoá → giữ giá trị thô làm nhãn
        { source: null }, // chưa gắn nguồn
      ],
      [
        { source: "instagram", amount: 3_000_000 },
        { source: "facebook", amount: "1000000" },
        { source: "facebook", amount: null }, // sổ chưa báo giá
      ],
      [{ source: "instagram", amount: 500_000 }],
    ),
    [
      {
        source: "instagram",
        label_vi: "Instagram",
        label_en: null,
        label_id: null,
        color: "#ec4899",
        data: 1,
        revenue: 3_500_000,
        baseRevenue: 3_000_000,
        upsalesRevenue: 500_000,
      },
      {
        source: "facebook",
        label_vi: "Facebook",
        label_en: "Facebook",
        label_id: null,
        color: "#3b82f6",
        data: 2,
        revenue: 1_000_000,
        baseRevenue: 1_000_000,
        upsalesRevenue: 0,
      },
      {
        source: "tiktok",
        label_vi: "tiktok",
        label_en: null,
        label_id: null,
        color: null,
        data: 1,
        revenue: 0,
        baseRevenue: 0,
        upsalesRevenue: 0,
      },
      {
        source: null,
        label_vi: "",
        label_en: null,
        label_id: null,
        color: null,
        data: 1,
        revenue: 0,
        baseRevenue: 0,
        upsalesRevenue: 0,
      },
    ],
  );
});

test("thống kê theo nguồn: nguồn không phát sinh gì không có dòng", () => {
  assert.deepEqual(
    calculateSourceStats(
      [{ value: "facebook", label_vi: "Facebook", label_en: null, label_id: null, color: "#3b82f6", sort_order: 0 }],
      [],
      [],
      [],
    ),
    [],
  );
});

const service = (id: string, name_vi: string) => ({
  id,
  name_vi,
  name_en: null,
  name_id: null,
  is_active: true,
});

test("thống kê dịch vụ: data/chốt lịch/khách đến/doanh thu gồm upsales/AOV", () => {
  const [triet, phun] = calculateServiceStats(
    [service("s1", "Triệt lông"), service("s2", "Phun môi")],
    [{ service_id: "s1" }, { service_id: "s1" }, { service_id: "s2" }],
    [
      { service_id: "s1", checked_in_at: "2026-07-02T03:00:00Z" },
      // đến rồi hủy: vẫn giữ mốc check-in → tính là đã đến
      { service_id: "s1", checked_in_at: "2026-07-03T03:00:00Z" },
      { service_id: "s1", checked_in_at: null },
      { service_id: "s2", checked_in_at: null },
    ],
    [
      { service_id: "s1", total_amount: 20_000 },
      { service_id: "s1", total_amount: "10000" },
      { service_id: "s1", total_amount: null }, // chưa báo giá → bỏ
      { service_id: "s2", total_amount: 5_000 },
    ],
    // upsale dịch vụ s2 phát sinh trên lịch của s1 → tính cho s2
    [{ service_id: "s2", amount: 6_000 }],
  );

  assert.deepEqual(triet, {
    serviceId: "s1",
    name_vi: "Triệt lông",
    name_en: null,
    name_id: null,
    isActive: true,
    data: 2,
    booked: 3,
    arrived: 2,
    revenue: 30_000,
    baseRevenue: 30_000,
    upsalesRevenue: 0,
    orderCount: 2,
    aov: 15_000,
  });
  assert.deepEqual(phun, {
    serviceId: "s2",
    name_vi: "Phun môi",
    name_en: null,
    name_id: null,
    isActive: true,
    data: 1,
    booked: 1,
    arrived: 0,
    revenue: 11_000,
    baseRevenue: 5_000,
    upsalesRevenue: 6_000,
    orderCount: 2,
    aov: 5_500,
  });
});

test("thống kê dịch vụ: chỉ có upsale vẫn ra AOV, dịch vụ rỗng không chia 0", () => {
  assert.deepEqual(
    calculateServiceStats(
      [service("s1", "Chỉ upsale"), service("s2", "Không phát sinh")],
      [],
      [],
      [],
      [
        { service_id: "s1", amount: 3_000 },
        { service_id: "s1", amount: 2_000 },
      ],
    ),
    [
      {
        serviceId: "s1",
        name_vi: "Chỉ upsale",
        name_en: null,
        name_id: null,
        isActive: true,
        data: 0,
        booked: 0,
        arrived: 0,
        revenue: 5_000,
        baseRevenue: 0,
        upsalesRevenue: 5_000,
        orderCount: 2,
        aov: 2_500,
      },
      {
        serviceId: "s2",
        name_vi: "Không phát sinh",
        name_en: null,
        name_id: null,
        isActive: true,
        data: 0,
        booked: 0,
        arrived: 0,
        revenue: 0,
        baseRevenue: 0,
        upsalesRevenue: 0,
        orderCount: 0,
        aov: 0,
      },
    ],
  );
});

test("isValidDateRange kiểm tra ngày thực và thứ tự khoảng", () => {
  assert.equal(isValidDateRange("2026-07-01", "2026-07-31"), true);
  assert.equal(isValidDateRange("2026-02-29", "2026-03-01"), false);
  assert.equal(isValidDateRange("2026-07-31", "2026-07-01"), false);
  assert.equal(isValidDateRange("01-07-2026", "2026-07-31"), false);
});

test("tính Doanh thu, Doanh số upsales, Thực thu, Công nợ và AOV", () => {
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
    [{ amount: 250 }, { amount: "350" }],
  );

  assert.deepEqual(metrics, {
    revenue: 3_000,
    upsalesRevenue: 600,
    collected: 500,
    outstanding: 750,
    aov: 1_500,
    orderCount: 2,
  });
});

test("kỳ không có dữ liệu tài chính trả các chỉ số bằng 0", () => {
  assert.deepEqual(calculateFinancialMetrics([], [], [], []), {
    revenue: 0,
    upsalesRevenue: 0,
    collected: 0,
    outstanding: 0,
    aov: 0,
    orderCount: 0,
  });
});

test("doanh số theo sales: đủ chỉ số, sổ chưa báo giá và khách không bill không tính chốt", () => {
  const rows = calculateSalesPerformance(
    [
      { id: "s1", user_name: "An", department: "sales" },
      { id: "s2", user_name: "Bình", department: "sales" },
      { id: "kt", user_name: "Kỹ", department: "technician" },
      { id: "ex", user_name: "Cũ", department: null },
    ],
    [
      { id: "c1", sales_id: "s1" },
      { id: "c2", sales_id: "s1" },
      { id: "c3", sales_id: "s1" },
      { id: "c4", sales_id: "s1" },
      { id: "c5", sales_id: "ex" },
      { id: "c6", sales_id: null },
    ],
    [
      { customer_id: "c1", total_amount: 10_000 },
      { customer_id: "c1", total_amount: "5000" },
      { customer_id: "c2", total_amount: 15_000 },
      { customer_id: "c3", total_amount: null },
      { customer_id: "c5", total_amount: 2_000 },
      { customer_id: "c6", total_amount: 999 },
    ],
  );

  assert.deepEqual(rows, [
    {
      salesId: "s1",
      userName: "An",
      customers: 4,
      closedCustomers: 2,
      closeRate: 50,
      revenue: 30_000,
      billCount: 3,
      aov: 10_000,
    },
    {
      salesId: "ex",
      userName: "Cũ",
      customers: 1,
      closedCustomers: 1,
      closeRate: 100,
      revenue: 2_000,
      billCount: 1,
      aov: 2_000,
    },
    {
      salesId: "s2",
      userName: "Bình",
      customers: 0,
      closedCustomers: 0,
      closeRate: 0,
      revenue: 0,
      billCount: 0,
      aov: 0,
    },
  ]);
});

test("doanh số theo sales: không có profile khớp → mảng rỗng", () => {
  assert.deepEqual(
    calculateSalesPerformance([], [{ id: "c1", sales_id: "ghost" }], []),
    [],
  );
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
        upsalesRevenue: 300,
        collected: 50,
        outstanding: 0,
        aov: 75,
        orderCount: 2,
      },
      {
        revenue: 100,
        upsalesRevenue: 200,
        collected: 100,
        outstanding: 0,
        aov: 50,
        orderCount: 0,
      },
    ),
    {
      revenue: 50,
      upsalesRevenue: 50,
      collected: -50,
      outstanding: 0,
      aov: 50,
      orderCount: 100,
    },
  );
});
