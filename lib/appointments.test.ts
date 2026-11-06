import assert from "node:assert/strict";
import { test } from "node:test";
import { appointmentPatchSchema } from "./appointments.ts";

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
