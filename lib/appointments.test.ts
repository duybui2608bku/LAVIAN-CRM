import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appointmentStats, canConfirmShowUp, canSetVisitStatus, validateVisitStatus, appointmentPatchSchema, nearestByCustomer, newCustomerAppointmentIds, ARRIVED_STATUSES, BOOKING_STATUS_VALUES, VISIT_STATUS_VALUES,
} from "./appointments.ts";

test("appointment edits validate dates, IDs and whitelist; no tour fields", () => {
  for (const patch of [{}, { scheduled_at: "tomorrow" }, { scheduled_at: "2026-10-31" },
    { staff_id: "invalid" }, { checked_in: true }, { service_ids: ["invalid"] },
    { customer_id: "another" }, { payment_method: "cash" }, { service_detail: "new" }]) {
    assert.equal(appointmentPatchSchema.safeParse(patch).success, false);
  }
  assert.deepEqual(appointmentPatchSchema.parse({ scheduled_at: "2026-10-31T10:00:00+07:00" }),
    { scheduled_at: "2026-10-31T10:00:00+07:00" });
  // Ghi chú không sửa qua patch (thêm từng ghi chú vào timeline).
  assert.equal(appointmentPatchSchema.safeParse({ note: "hello" }).success, false);
  const id = "b102ac72-d890-479b-a51b-126494cf73ac";
  assert.deepEqual(appointmentPatchSchema.parse({ service_ids: [id, id] }), { service_ids: [id] });
  assert.equal(appointmentPatchSchema.safeParse({ staff_id: null, visit_status: "waiting" }).success, true);
});

test("Master + Giá trị DV: uuid/null, số nguyên >= 0", () => {
  const id = "b102ac72-d890-479b-a51b-126494cf73ac";
  assert.deepEqual(appointmentPatchSchema.parse({ technician_id: id, bill_amount: 3500000 }), { technician_id: id, bill_amount: 3500000 });
  assert.deepEqual(appointmentPatchSchema.parse({ technician_id: null, bill_amount: null }), { technician_id: null, bill_amount: null });
  for (const patch of [{ technician_id: "invalid" }, { bill_amount: -1 }, { bill_amount: 1.5 }, { bill_amount: "1000" }]) {
    assert.equal(appointmentPatchSchema.safeParse(patch).success, false);
  }
});

test("trạng thái xác nhận lịch: 4 giá trị, khớp BOOKING_STATUSES, từ chối boolean cũ", async () => {
  const { BOOKING_STATUSES } = await import("../types/appointment.ts");
  assert.deepEqual([...BOOKING_STATUS_VALUES], [...BOOKING_STATUSES]);
  for (const v of BOOKING_STATUSES) {
    assert.deepEqual(appointmentPatchSchema.parse({ booking_confirm: v }), { booking_confirm: v });
  }
  for (const v of [true, false, "unconfirmed", "", null]) {
    assert.equal(appointmentPatchSchema.safeParse({ booking_confirm: v }).success, false);
  }
});

test("Status lịch hẹn: 6 giá trị khớp VISIT_STATUSES, từ chối giá trị lạ", async () => {
  const { VISIT_STATUSES } = await import("../types/appointment.ts");
  assert.deepEqual([...VISIT_STATUS_VALUES], [...VISIT_STATUSES]);
  for (const v of VISIT_STATUSES) assert.deepEqual(appointmentPatchSchema.parse({ visit_status: v }), { visit_status: v });
  for (const v of ["show_up", "", null, true]) assert.equal(appointmentPatchSchema.safeParse({ visit_status: v }).success, false);
});

test("nearestByCustomer: lịch sắp tới sớm nhất, không có thì lịch đã qua gần nhất", () => {
  const now = Date.parse("2026-11-19T10:00:00Z");
  const appt = (customer_id: string, scheduled_at: string) => ({ customer_id, scheduled_at });
  const map = nearestByCustomer([
    appt("a", "2026-11-10T10:00:00Z"), appt("a", "2026-11-25T10:00:00Z"), appt("a", "2026-11-20T10:00:00Z"),
    appt("b", "2026-11-01T10:00:00Z"), appt("b", "2026-11-18T10:00:00Z"),
  ], now);
  assert.equal(map.get("a")?.scheduled_at, "2026-11-20T10:00:00Z");
  assert.equal(map.get("b")?.scheduled_at, "2026-11-18T10:00:00Z");
  assert.equal(map.get("c"), undefined);
});

test("nhóm dịch vụ: mã service_groups, bỏ trùng, từ chối giá trị lạ", () => {
  assert.deepEqual(appointmentPatchSchema.parse({ service_categories: ["alis", "bibir", "alis"] }), { service_categories: ["alis", "bibir"] });
  assert.deepEqual(appointmentPatchSchema.parse({ service_categories: [] }), { service_categories: [] });
  for (const v of [["Shading"], ["a b"], "alis", null]) {
    assert.equal(appointmentPatchSchema.safeParse({ service_categories: v }).success, false);
  }
});

test("Clinic confirmation (Show-up): chỉ Sales + admin", () => {
  assert.equal(canConfirmShowUp({ role: "user", department: "sales" }), true);
  assert.equal(canConfirmShowUp({ role: "admin", department: null }), true);
  assert.equal(canConfirmShowUp({ role: "user", department: "telesales" }), false);
  assert.equal(canConfirmShowUp(null), false);
});

test("khách mới: chưa có lịch đã đến nào sớm hơn lịch này", () => {
  const appt = (id: string, customer_id: string, scheduled_at: string, visit_status: string) =>
    ({ id, customer_id, scheduled_at, visit_status });
  const ids = newCustomerAppointmentIds([
    appt("first", "a", "2026-11-18T03:00:00Z", "in_progress"), // lần đầu đến → mới
    appt("old1", "b", "2026-11-10T03:00:00Z", "done"), // lần đến đầu của b → mới
    appt("retouch", "b", "2026-11-18T08:00:00Z", "done"), // đã đến trước đó → cũ
    appt("upcoming", "b", "2026-11-25T08:00:00Z", "waiting"), // → cũ
    appt("missed", "c", "2026-11-10T03:00:00Z", "rescheduled"), // không đến
    appt("again", "c", "2026-11-18T03:00:00Z", "waiting"), // chưa từng đến → vẫn mới
  ]);
  assert.deepEqual([...ids].sort(), ["again", "first", "missed", "old1"]);
});

test("ARRIVED_STATUSES là tập con của VISIT_STATUSES", async () => {
  const { VISIT_STATUSES } = await import("../types/appointment.ts");
  for (const s of ARRIVED_STATUSES) assert.ok((VISIT_STATUSES as readonly string[]).includes(s));
});

test("Số liệu Sales Management: đếm theo Status + cộng tiền thẻ (công nợ âm không trừ)", () => {
  const money: Record<string, { value: number; collected: number; due: number }> = {
    a: { value: 3_500_000, collected: 2_500_000, due: 1_000_000 },
    b: { value: 2_000_000, collected: 2_300_000, due: -300_000 },
  };
  const row = (id: string, visit_status: string) => ({ id, visit_status });
  const s = appointmentStats([
    row("a", "done"), row("b", "in_progress"), row("c", "arrived"),
    row("d", "cancelled"), row("e", "rescheduled"), row("f", "waiting"),
  ], (r) => money[r.id]);
  assert.deepEqual(s, { total: 6, arrived: 3, cancelled: 2, waiting: 1, bill: 5_500_000, collected: 4_800_000, due: 1_000_000 });
});

test("Master chỉ được chọn Đã thực hiện; Sales/admin mọi trạng thái", () => {
  const master = { role: "user", department: "technician" };
  assert.equal(canSetVisitStatus(master, "done"), true);
  assert.equal(canSetVisitStatus(master, "in_progress"), false);
  assert.equal(canSetVisitStatus({ role: "user", department: "sales" }, "in_progress"), true);
  assert.equal(canSetVisitStatus({ role: "admin", department: null }, "cancelled"), true);
  assert.equal(canSetVisitStatus({ role: "user", department: "telesales" }, "done"), false);
});

test("Quy tắc E3: giá trị DV, Master/Sales theo trạng thái", () => {
  const cur = { visit_status: "arrived", technician_id: null, sales_id: null, bill_amount: null, paid_amount: 3_000_000 };
  // Đã thu 3.500.000 (cọc 500.000 + thu thêm 3.000.000) mà nhập giá 3.000.000 → lỗi.
  assert.deepEqual(validateVisitStatus({ bill_amount: 3_000_000 }, cur, 500_000), { code: "billBelowCollected", field: "bill_amount" });
  assert.equal(validateVisitStatus({ bill_amount: 3_500_000 }, cur, 500_000), null);
  assert.equal(validateVisitStatus({ bill_amount: 0 }, cur, 500_000), null); // 0 = chưa chốt giá
  assert.deepEqual(validateVisitStatus({ visit_status: "done" }, cur, 0), { code: "doneNeedsMaster", field: "technician_id" });
  assert.equal(validateVisitStatus({ visit_status: "done", technician_id: "m" }, cur, 0), null);
  assert.deepEqual(validateVisitStatus({ visit_status: "in_progress" }, cur, 0), { code: "inProgressNeedsStaff", field: "technician_id" });
  assert.equal(validateVisitStatus({ visit_status: "in_progress", sales_id: "s" }, cur, 0), null);
  // Lịch cũ vi phạm vẫn sửa được trường không liên quan.
  assert.equal(validateVisitStatus({ scheduled_at: "x" } as never, { ...cur, visit_status: "done" }, 0), null);
  // Gỡ Master khỏi lịch Đã thực hiện → lỗi.
  assert.deepEqual(validateVisitStatus({ technician_id: null }, { ...cur, visit_status: "done", technician_id: "m" }, 0)?.code, "doneNeedsMaster");
});
