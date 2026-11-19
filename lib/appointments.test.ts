import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canConfirmShowUp, appointmentPatchSchema, nearestByCustomer, newCustomerAppointmentIds, ARRIVED_STATUSES, BOOKING_STATUS_VALUES, SERVICE_CATEGORY_VALUES, VISIT_STATUS_VALUES,
} from "./appointments.ts";

test("appointment edits validate dates, IDs and whitelist; no tour fields", () => {
  for (const patch of [{}, { scheduled_at: "tomorrow" }, { scheduled_at: "2026-10-31" },
    { staff_id: "invalid" }, { checked_in: true }, { service_ids: ["invalid"] },
    { customer_id: "another" }, { payment_method: "cash" }, { service_detail: "new" }]) {
    assert.equal(appointmentPatchSchema.safeParse(patch).success, false);
  }
  assert.deepEqual(appointmentPatchSchema.parse({ scheduled_at: "2026-10-31T10:00:00+07:00", note: " hello " }),
    { scheduled_at: "2026-10-31T10:00:00+07:00", note: "hello" });
  const id = "b102ac72-d890-479b-a51b-126494cf73ac";
  assert.deepEqual(appointmentPatchSchema.parse({ service_ids: [id, id] }), { service_ids: [id] });
  assert.equal(appointmentPatchSchema.safeParse({ staff_id: null, visit_status: "waiting", note: "" }).success, true);
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

test("Status lịch hẹn: 5 giá trị khớp VISIT_STATUSES, từ chối giá trị lạ", async () => {
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

test("nhóm dịch vụ: khớp SERVICE_CATEGORIES, bỏ trùng, từ chối giá trị lạ", async () => {
  const { SERVICE_CATEGORIES } = await import("../types/service.ts");
  assert.deepEqual([...SERVICE_CATEGORY_VALUES], [...SERVICE_CATEGORIES]);
  assert.deepEqual(appointmentPatchSchema.parse({ service_categories: ["alis", "bibir", "alis"] }), { service_categories: ["alis", "bibir"] });
  assert.deepEqual(appointmentPatchSchema.parse({ service_categories: [] }), { service_categories: [] });
  for (const v of [["shading"], "alis", null]) {
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
