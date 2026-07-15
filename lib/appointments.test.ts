// Self-check: `node --test lib/appointments.test.ts` (Node ≥ 23).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignLanes,
  collectSuggestion,
  customerPayments,
  customerTotalPaid,
  groupByDay,
  ledgerPaid,
  localDay,
  matchesAppointmentFilters,
  outstanding,
  paidTotal,
  sortForDayView,
} from "./appointments.ts";
import type {
  Appointment,
  AppointmentPayment,
  ServiceLedger,
} from "../types/appointment.ts";

const pay = (
  kind: AppointmentPayment["kind"],
  amount: number,
): AppointmentPayment => ({
  id: `p-${kind}-${amount}`,
  ledger_id: "l1",
  appointment_id: "1",
  kind,
  amount,
  payment_method: null,
  image_url: null,
  note: null,
  paid_at: "2026-07-09T10:00:00.000Z",
  created_by: null,
  created_at: "2026-07-09T10:00:00.000Z",
});

const ledger = (
  payments: AppointmentPayment[],
  total: number | null = 5000,
): ServiceLedger => ({
  id: "l1",
  customer_id: "c1",
  service_id: "s1",
  total_amount: total,
  closed_at: null,
  created_by: null,
  created_at: "2026-07-09T10:00:00.000Z",
  updated_at: "2026-07-09T10:00:00.000Z",
  payments,
});

const base: Appointment = {
  id: "1",
  customer_id: "c1",
  staff_id: "staff-1",
  scheduled_at: "2026-07-10T02:00:00.000Z", // 09:00 UTC+7
  duration_minutes: 60,
  status: "booked",
  source: "instagrams",
  payment_method: null,
  ledger_id: "l1",
  booking_note: null,
  internal_note: null,
  confirmed_at: null,
  checked_in_at: null,
  completed_at: null,
  cancelled_at: null,
  created_by: null,
  updated_by: null,
  created_at: "2026-07-09T10:00:00.000Z",
  updated_at: "2026-07-09T10:00:00.000Z",
  deleted_at: null,
  service_ids: ["s1"],
  ledger: ledger([pay("deposit", 500)]),
  payments: [pay("deposit", 500)],
  customer: { full_name: "Nguyễn Văn A", phone: "0900123456" },
};

test("paidTotal: cộng deposit/payment, trừ refund — theo sổ", () => {
  assert.equal(paidTotal(base), 500);
  assert.equal(
    paidTotal({
      ...base,
      ledger: ledger([pay("deposit", 500), pay("payment", 1000)]),
    }),
    1500,
  );
  assert.equal(
    paidTotal({
      ...base,
      ledger: ledger([pay("deposit", 500), pay("refund", 500)]),
    }),
    0, // hoàn cọc = dòng refund, không sửa dòng cũ
  );
  assert.equal(paidTotal({ ...base, ledger: ledger([]) }), 0);
});

test("paidTotal: lịch không sổ fallback dòng tiền gắn lịch", () => {
  const orphan = { ...base, ledger_id: null, ledger: null };
  assert.equal(paidTotal(orphan), 500);
  assert.equal(paidTotal({ ...orphan, payments: [] }), 0);
});

test("outstanding: tổng giá sổ − đã thu, không âm; không sổ = 0", () => {
  assert.equal(outstanding(base), 4500); // tổng 5000 − đã thu 500
  assert.equal(
    outstanding({ ...base, ledger: ledger([pay("deposit", 500)], 300) }),
    0,
  );
  assert.equal(
    outstanding({ ...base, ledger: ledger([pay("deposit", 500)], null) }),
    0,
  );
  assert.equal(outstanding({ ...base, ledger: null }), 0);
});

test("collectSuggestion: gợi ý phần còn thiếu, tắt khi sổ có tiền lịch khác", () => {
  assert.equal(collectSuggestion(base), 4500); // cọc 500 của CHÍNH lịch này
  assert.equal(collectSuggestion({ ...base, ledger: ledger([]) }), 5000);
  // Khách cũ nối sổ: dòng tiền của lịch trước → không tự điền.
  const prior = { ...pay("payment", 1000), appointment_id: "0" };
  assert.equal(
    collectSuggestion({ ...base, ledger: ledger([prior], 3000) }),
    null,
  );
  assert.equal(
    collectSuggestion({ ...base, ledger: ledger([], null) }),
    null, // sổ chưa báo giá
  );
  assert.equal(collectSuggestion({ ...base, ledger: null }), null);
});

test("hai lịch chung sổ hiện cùng Đã thu (lookup 2 chiều)", () => {
  const shared = ledger([pay("deposit", 200)], 500);
  const a1 = { ...base, id: "1", ledger: shared };
  const a2 = { ...base, id: "2", ledger: shared };
  assert.equal(paidTotal(a1), paidTotal(a2));
  assert.equal(outstanding(a1), 300);
  assert.equal(outstanding(a2), 300);
});

test("customerTotalPaid: dedupe theo sổ + cộng dòng mồ côi", () => {
  const shared = ledger([pay("deposit", 500)], 5000);
  const other: ServiceLedger = {
    ...ledger([pay("payment", 300)], 300),
    id: "l2",
    service_id: "s2",
  };
  const orphan = {
    ...base,
    id: "9",
    ledger_id: null,
    ledger: null,
    payments: [pay("deposit", 50)],
  };
  const list = [
    { ...base, id: "1", ledger: shared },
    { ...base, id: "2", ledger: shared }, // chung sổ — không đếm trùng
    { ...base, id: "3", ledger: other },
    orphan,
  ];
  assert.equal(customerTotalPaid(list), 500 + 300 + 50);
  assert.equal(ledgerPaid(shared), 500);
});

test("customerPayments: gom dòng theo sổ (dedupe) + mồ côi, mới nhất trước", () => {
  const p1 = { ...pay("deposit", 500), paid_at: "2026-07-01T10:00:00.000Z" };
  const p2 = { ...pay("payment", 1000), paid_at: "2026-07-03T10:00:00.000Z" };
  const shared = ledger([p1, p2]);
  const orphan = {
    ...base,
    id: "9",
    ledger_id: null,
    ledger: null,
    payments: [{ ...pay("payment", 50), paid_at: "2026-07-02T10:00:00.000Z" }],
  };
  const rows = customerPayments([
    { ...base, id: "1", ledger: shared },
    { ...base, id: "2", ledger: shared }, // chung sổ — không lặp dòng
    orphan,
  ]);
  assert.deepEqual(
    rows.map((r) => [r.payment.amount, r.service_id]),
    [
      [1000, "s1"],
      [50, null],
      [500, "s1"],
    ],
  );
});

test("lọc theo ngày dùng ngày LOCAL của scheduled_at", () => {
  const day = localDay(base.scheduled_at!); // theo timezone máy chạy test
  assert.equal(matchesAppointmentFilters(base, { day }), true);
  assert.equal(matchesAppointmentFilters(base, { day: "1999-01-01" }), false);
  assert.equal(
    matchesAppointmentFilters({ ...base, scheduled_at: null }, { day }),
    false,
  );
});

test("tab chờ xếp lịch: scheduled_at null và chưa hủy", () => {
  const waiting = { ...base, scheduled_at: null, status: "pending_confirmation" } as const;
  assert.equal(matchesAppointmentFilters(waiting, { waiting: true }), true);
  assert.equal(
    matchesAppointmentFilters(
      { ...waiting, status: "cancelled" },
      { waiting: true },
    ),
    false,
  );
  assert.equal(matchesAppointmentFilters(base, { waiting: true }), false);
});

test("lọc search theo tên/phone khách + status/staff/service", () => {
  assert.equal(matchesAppointmentFilters(base, { search: "văn a" }), true);
  assert.equal(matchesAppointmentFilters(base, { search: "0900" }), true);
  assert.equal(matchesAppointmentFilters(base, { search: "xyz" }), false);
  assert.equal(matchesAppointmentFilters(base, { status: "booked" }), true);
  assert.equal(matchesAppointmentFilters(base, { status: "cancelled" }), false);
  assert.equal(matchesAppointmentFilters(base, { staffId: "staff-2" }), false);
  assert.equal(matchesAppointmentFilters(base, { serviceId: "s1" }), true);
  assert.equal(matchesAppointmentFilters(base, { serviceId: "s2" }), false);
});

test("groupByDay: bỏ lịch chưa có ngày, trong ngày sắp theo giờ", () => {
  const later = { ...base, id: "2", scheduled_at: "2026-07-10T05:00:00.000Z" };
  const otherDay = {
    ...base,
    id: "3",
    scheduled_at: "2026-07-11T02:00:00.000Z",
  };
  const waiting = { ...base, id: "4", scheduled_at: null };
  const map = groupByDay([later, base, otherDay, waiting]);
  assert.equal(map.size, 2);
  assert.deepEqual(
    map.get(localDay(base.scheduled_at!))!.map((a) => a.id),
    ["1", "2"],
  );
  assert.deepEqual(
    map.get(localDay(otherDay.scheduled_at))!.map((a) => a.id),
    ["3"],
  );
});

test("assignLanes: không chồng giờ → 1 lane", () => {
  const next = { ...base, id: "2", scheduled_at: "2026-07-10T03:00:00.000Z" };
  const items = assignLanes([next, base]);
  assert.deepEqual(
    items.map((i) => [i.a.id, i.lane, i.lanes]),
    [
      ["1", 0, 1],
      ["2", 0, 1],
    ],
  );
});

test("assignLanes: chồng giờ chia 2 lane, cụm sau về lại 1 lane", () => {
  // base 09:00-10:00; b 09:30-10:30 (chồng); c 11:00-12:00 (cụm mới)
  const b = { ...base, id: "2", scheduled_at: "2026-07-10T02:30:00.000Z" };
  const c = { ...base, id: "3", scheduled_at: "2026-07-10T04:00:00.000Z" };
  const items = assignLanes([c, b, base]);
  assert.deepEqual(
    items.map((i) => [i.a.id, i.lane, i.lanes]),
    [
      ["1", 0, 2],
      ["2", 1, 2],
      ["3", 0, 1],
    ],
  );
});

test("assignLanes: lịch thứ 3 xen vào lane trống sau khi lane 0 kết thúc", () => {
  // base 09:00-10:00 (lane 0); b 09:30-11:00 (lane 1); c 10:00-11:00 → lane 0 lại
  const b = {
    ...base,
    id: "2",
    scheduled_at: "2026-07-10T02:30:00.000Z",
    duration_minutes: 90,
  };
  const c = { ...base, id: "3", scheduled_at: "2026-07-10T03:00:00.000Z" };
  const items = assignLanes([base, b, c]);
  assert.deepEqual(
    items.map((i) => [i.a.id, i.lane, i.lanes]),
    [
      ["1", 0, 2],
      ["2", 1, 2],
      ["3", 0, 2],
    ],
  );
});

test("sortForDayView: nhóm theo trạng thái rồi theo giờ", () => {
  const checkedIn = {
    ...base,
    id: "2",
    status: "checked_in",
    scheduled_at: "2026-07-10T05:00:00.000Z",
  } as const;
  const earlier = {
    ...base,
    id: "3",
    scheduled_at: "2026-07-10T01:00:00.000Z",
  };
  const sorted = sortForDayView([base, earlier, checkedIn]);
  assert.deepEqual(
    sorted.map((a) => a.id),
    ["2", "3", "1"], // checked_in trước, booked theo giờ tăng dần
  );
});
