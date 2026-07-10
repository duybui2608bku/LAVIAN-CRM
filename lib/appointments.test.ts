// Self-check: `node --test lib/appointments.test.ts` (Node ≥ 23).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignLanes,
  dayTotal,
  groupByDay,
  localDay,
  matchesAppointmentFilters,
  outstanding,
  sortForDayView,
} from "./appointments.ts";
import type { Appointment } from "../types/appointment.ts";

const base: Appointment = {
  id: "1",
  customer_id: "c1",
  staff_id: "staff-1",
  scheduled_at: "2026-07-10T02:00:00.000Z", // 09:00 UTC+7
  duration_minutes: 60,
  status: "booked",
  source: "instagrams",
  payment_method: null,
  deposit_amount: 500,
  expected_amount: 5000,
  final_amount: null,
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
  customer: { full_name: "Nguyễn Văn A", phone: "0900123456" },
};

test("outstanding: fallback expected khi chưa chốt final, không âm", () => {
  assert.equal(outstanding(base), 4500); // expected 5000 - DP 500
  assert.equal(outstanding({ ...base, final_amount: 5200 }), 4700);
  assert.equal(
    outstanding({ ...base, final_amount: 300, deposit_amount: 500 }),
    0,
  );
  assert.equal(
    outstanding({ ...base, expected_amount: null, deposit_amount: 500 }),
    0,
  );
});

test("dayTotal: chỉ cộng final_amount của lịch completed", () => {
  const done = { ...base, status: "completed", final_amount: 1000 } as const;
  assert.equal(dayTotal([base, done, { ...done, final_amount: 250 }]), 1250);
  assert.equal(dayTotal([base]), 0);
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
