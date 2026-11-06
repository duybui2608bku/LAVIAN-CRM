import assert from "node:assert/strict";
import { test } from "node:test";
import { appointmentPatchSchema, decodeDetail, encodeDetail, tourAmount } from "./appointments.ts";

test("appointment edits validate dates, IDs and whitelist; only bill_amount as money field", () => {
  for (const patch of [{}, { scheduled_at: "tomorrow" }, { scheduled_at: "2026-10-31" },
    { staff_id: "invalid" }, { checked_in: "yes" }, { payment_method: "crypto" },
    { service_ids: ["invalid"] }, { total_amount: 100 }, { customer_id: "another" },
    { bill_amount: -1 }, { bill_amount: 1.5 }]) {
    assert.equal(appointmentPatchSchema.safeParse(patch).success, false);
  }
  assert.deepEqual(appointmentPatchSchema.parse({ scheduled_at: "2026-10-31T10:00:00+07:00", note: " hello " }),
    { scheduled_at: "2026-10-31T10:00:00+07:00", note: "hello" });
  const id = "b102ac72-d890-479b-a51b-126494cf73ac";
  assert.deepEqual(appointmentPatchSchema.parse({ service_ids: [id, id] }), { service_ids: [id] });
  assert.equal(appointmentPatchSchema.safeParse({ payment_method: null, staff_id: null, checked_in: false, note: "" }).success, true);
  assert.equal(appointmentPatchSchema.safeParse({ bill_amount: 1000000 }).success, true);
  assert.equal(appointmentPatchSchema.safeParse({ bill_amount: null }).success, true);
});

test("service detail requires session only for laser/plasma/retouch", () => {
  const ok = (p: object) => appointmentPatchSchema.safeParse(p).success;
  assert.equal(ok({ service_detail: "retouch", service_session: 2 }), true);
  assert.equal(ok({ service_detail: "new", service_session: null }), true);
  assert.equal(ok({ service_detail: null, service_session: null }), true);
  assert.equal(ok({ service_detail: "laser", service_session: null }), false);
  assert.equal(ok({ service_detail: "laser", service_session: 11 }), false);
  assert.equal(ok({ service_detail: "laser", service_session: 0 }), false);
  assert.equal(ok({ service_detail: "new", service_session: 1 }), false);
  assert.equal(ok({ service_detail: "debt" }), false);
  assert.equal(ok({ service_detail: "botox", service_session: null }), false);
});

test("tour = bill × rate", () => {
  assert.equal(tourAmount("new", null, 1_000_000), 70_000);
  assert.equal(tourAmount("debt", null, 1_000_000), 70_000);
  assert.equal(tourAmount("retouch", 1, 1_000_000), 30_000);
  assert.equal(tourAmount("retouch", 2, 1_000_000), 0);
  assert.equal(tourAmount("laser", 3, 2_000_000), 0);
  assert.equal(tourAmount("plasma", 1, 2_000_000), 0);
  assert.equal(tourAmount(null, null, 1_000_000), null);
  assert.equal(tourAmount("new", null, null), null);
});

test("encode/decode combined select value", () => {
  assert.equal(encodeDetail("retouch", 2), "retouch:2");
  assert.equal(encodeDetail("new", null), "new");
  assert.equal(encodeDetail(null, null), "");
  assert.deepEqual(decodeDetail("laser:3"), { service_detail: "laser", service_session: 3 });
  assert.deepEqual(decodeDetail("debt"), { service_detail: "debt", service_session: null });
  assert.deepEqual(decodeDetail(""), { service_detail: null, service_session: null });
});
