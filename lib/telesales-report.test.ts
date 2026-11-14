import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildTelesalesReport,
  kpiCompletion,
  staffTotals,
  vnDay,
  type TelesalesAppointment,
  type TelesalesStaff,
} from "./telesales-report.ts";

// Kỳ đang xem 13–14/11, kỳ trước 11–12/11. Giờ VN = UTC+7: "2026-11-12T17:00:00Z" = 00:00 ngày 13 VN.
const RANGE = { from: "2026-11-13", to: "2026-11-14", prev: { from: "2026-11-11", to: "2026-11-12" } };
const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
const OUTSIDER = "cccccccc-0000-0000-0000-000000000003";
const STAFF: TelesalesStaff[] = [
  { id: A, user_name: "Bulan", avatar_url: null, smax_user_id: "6a632201de8a302ce1dcec0f" },
  { id: B, user_name: "Ratih", avatar_url: null, smax_user_id: null },
];

let seq = 0;
function appt(p: Partial<TelesalesAppointment> & { created_at: string; scheduled_at: string }): TelesalesAppointment {
  return {
    id: `id-${++seq}`,
    booking_confirm: "pending",
    checked_in: false,
    staff_id: A,
    customer: { created_at: "2026-10-01T00:00:00Z", source: "instagrams" },
    ...p,
  };
}

test("vnDay: ranh giới 17:00 UTC", () => {
  assert.equal(vnDay("2026-11-12T16:59:59Z"), "2026-11-12");
  assert.equal(vnDay("2026-11-12T17:00:00Z"), "2026-11-13");
  assert.equal(vnDay("2026-11-13T09:00:00+07:00"), "2026-11-13");
});

test("thẻ số liệu: booking theo ngày tạo, khách đến theo ngày hẹn, trạng thái xác nhận", () => {
  const appointments = [
    // Tạo 00:00 VN ngày 13 → thuộc kỳ; khách mới tạo cùng kỳ → Booking mới; đã xác nhận.
    appt({ created_at: "2026-11-12T17:00:00Z", scheduled_at: "2026-11-20T03:00:00Z", booking_confirm: "confirmed",
      customer: { created_at: "2026-11-12T18:00:00Z", source: "whatsapp" } }),
    // Tạo 23:59 VN ngày 12 → kỳ TRƯỚC; hẹn ngày 14, đã đến → Khách đến kỳ này.
    appt({ created_at: "2026-11-12T16:59:00Z", scheduled_at: "2026-11-14T03:00:00Z", checked_in: true }),
    // Tạo trong kỳ, khách cũ, hủy.
    appt({ created_at: "2026-11-14T02:00:00Z", scheduled_at: "2026-11-25T03:00:00Z", booking_confirm: "cancelled", staff_id: B }),
    // Tạo trong kỳ, đổi lịch; hẹn trong kỳ nhưng chưa đến; người ngoài danh sách.
    appt({ created_at: "2026-11-13T02:00:00Z", scheduled_at: "2026-11-14T08:00:00Z", booking_confirm: "rescheduled",
      staff_id: OUTSIDER, customer: { created_at: "2026-11-01T00:00:00Z", source: null } }),
    // Ngoài cả 2 kỳ.
    appt({ created_at: "2026-11-15T02:00:00Z", scheduled_at: "2026-11-15T03:00:00Z", checked_in: true }),
  ];
  const fb = new Map([["2026-11-11", 5], ["2026-11-12", 7], ["2026-11-13", 10], ["2026-11-14", 20], ["2026-11-15", 99]]);
  const r = buildTelesalesReport({ ...RANGE, appointments, fb, handled: new Map(), staff: STAFF });

  assert.deepEqual(r.cur, {
    messages: 30, bookings: 3, newBookings: 1, confirmed: 1, cancelled: 1, rescheduled: 1, scheduled: 2, arrived: 1,
  });
  assert.deepEqual(r.prev, {
    messages: 12, bookings: 1, newBookings: 0, confirmed: 0, cancelled: 0, rescheduled: 0, scheduled: 0, arrived: 0,
  });
  assert.deepEqual(r.days, [
    { date: "2026-11-13", bookings: 2, newBookings: 1, arrived: 0 },
    { date: "2026-11-14", bookings: 1, newBookings: 0, arrived: 1 },
  ]);
  assert.deepEqual(r.sources, { instagrams: 1, whatsapp: 1, other: 1 });
});

test("FB lỗi → tin nhắn null; lịch trùng id chỉ đếm 1 lần", () => {
  const one = appt({ created_at: "2026-11-13T02:00:00Z", scheduled_at: "2026-11-13T05:00:00Z", checked_in: true });
  const r = buildTelesalesReport({ ...RANGE, appointments: [one, { ...one }], fb: null, handled: null, staff: STAFF });
  assert.equal(r.cur.messages, null);
  assert.equal(r.prev.messages, null);
  assert.equal(r.cur.bookings, 1);
  assert.equal(r.cur.arrived, 1);
  assert.equal(r.staff[0].bookings, 1);
});

test("hiệu suất nhân viên: ghép SMAX, dòng Khác, tổng và KPI", () => {
  const appointments = [
    appt({ created_at: "2026-11-13T02:00:00Z", scheduled_at: "2026-11-13T05:00:00Z", checked_in: true }),
    appt({ created_at: "2026-11-13T03:00:00Z", scheduled_at: "2026-11-20T05:00:00Z" }),
    appt({ created_at: "2026-11-14T03:00:00Z", scheduled_at: "2026-11-14T05:00:00Z", staff_id: B }),
    appt({ created_at: "2026-11-14T04:00:00Z", scheduled_at: "2026-11-14T06:00:00Z", staff_id: null, checked_in: true }),
    appt({ created_at: "2026-11-14T05:00:00Z", scheduled_at: "2026-11-30T06:00:00Z", staff_id: OUTSIDER }),
  ];
  const handled = new Map([["6a632201de8a302ce1dcec0f", 20], ["6a811194f1bc59f54aee4d14", 51]]);
  const r = buildTelesalesReport({ ...RANGE, appointments, fb: null, handled, staff: STAFF });

  assert.deepEqual(r.staff, [
    { id: A, name: "Bulan", avatar_url: null, conversations: 20, bookings: 2, scheduled: 1, arrived: 1 },
    // Chưa ghép ID SMAX → hội thoại null (không phải 0).
    { id: B, name: "Ratih", avatar_url: null, conversations: null, bookings: 1, scheduled: 1, arrived: 0 },
  ]);
  assert.deepEqual(r.other, { bookings: 2, scheduled: 1, arrived: 1 });

  const total = staffTotals(r.staff, r.other);
  assert.deepEqual(total, { conversations: 20, convBookings: 2, bookings: 5, scheduled: 3, arrived: 2 });
  // Tổng booking bảng = thẻ Booking.
  assert.equal(total.bookings, r.cur.bookings);
  assert.equal(total.arrived, r.cur.arrived);

  // 2 booking / 20 hội thoại = 10% → 83,3% KPI 12%.
  assert.ok(Math.abs(kpiCompletion(2, 20)! - 0.8333) < 0.001);
  assert.equal(kpiCompletion(3, 25), 1);
  assert.equal(kpiCompletion(5, 0), null);
  assert.equal(kpiCompletion(5, null), null);
});

test("SMAX lỗi → mọi NV hội thoại null; không có lịch ngoài danh sách → other null", () => {
  const r = buildTelesalesReport({
    ...RANGE,
    appointments: [appt({ created_at: "2026-11-13T02:00:00Z", scheduled_at: "2026-11-13T05:00:00Z" })],
    fb: new Map(),
    handled: null,
    staff: STAFF,
  });
  assert.deepEqual(r.staff.map((s) => s.conversations), [null, null]);
  assert.equal(r.other, null);
  assert.equal(r.cur.messages, 0);
  assert.equal(staffTotals(r.staff, r.other).conversations, null);
});

test("kỳ dài: đủ ngày, qua tháng", () => {
  const r = buildTelesalesReport({
    from: "2026-10-30", to: "2026-11-02", prev: { from: "2026-10-26", to: "2026-10-29" },
    appointments: [], fb: null, handled: null, staff: [],
  });
  assert.deepEqual(r.days.map((d) => d.date), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
});
