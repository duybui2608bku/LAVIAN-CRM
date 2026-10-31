import assert from "node:assert/strict";
import { test } from "node:test";
import { appointmentPatchSchema, customerAppointment } from "./appointments.ts";
import type { Appointment } from "../types/appointment.ts";

test("appointment edits validate dates, IDs and whitelist; no financial fields", () => {
  for (const patch of [{}, { scheduled_at: "tomorrow" }, { scheduled_at: "2026-10-31" },
    { staff_id: "invalid" }, { checked_in: "yes" }, { payment_method: "crypto" },
    { service_ids: ["invalid"] }, { total_amount: 100 }, { customer_id: "another" }]) {
    assert.equal(appointmentPatchSchema.safeParse(patch).success, false);
  }
  assert.deepEqual(appointmentPatchSchema.parse({ scheduled_at: "2026-10-31T10:00:00+07:00", note: " hello " }),
    { scheduled_at: "2026-10-31T10:00:00+07:00", note: "hello" });
  const id = "b102ac72-d890-479b-a51b-126494cf73ac";
  assert.deepEqual(appointmentPatchSchema.parse({ service_ids: [id, id] }), { service_ids: [id] });
  assert.equal(appointmentPatchSchema.safeParse({ payment_method: null, staff_id: null, checked_in: false, note: "" }).success, true);
});

test("customer cell uses nearest upcoming visit, skips checked-in; input order is preserved", () => {
  const row = (id: string, day: number, checked_in = false) => ({ id, scheduled_at: `2026-11-${day}T10:00:00Z`, checked_in }) as Appointment;
  const rows = [row("later", 15), row("past", 10), row("arrived", 12, true), row("next", 13)];
  assert.equal(customerAppointment(rows, Date.parse("2026-11-11T00:00:00Z"))?.id, "next");
  assert.equal(customerAppointment(rows, Date.parse("2026-12-01T00:00:00Z")), undefined);
  assert.equal(rows[0].id, "later");
  assert.equal(customerAppointment([], Date.now()), undefined);
});
