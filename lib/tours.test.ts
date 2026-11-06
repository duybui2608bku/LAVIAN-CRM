import assert from "node:assert/strict";
import { test } from "node:test";
import { tourAmount, tourCreateSchema, tourPatchSchema, tourStatus } from "./tours.ts";

const id = "b102ac72-d890-479b-a51b-126494cf73ac";

test("thực thu = bill × %", () => {
  assert.equal(tourAmount("new", null, 1_000_000), 70_000);
  assert.equal(tourAmount("debt", null, 1_000_000), 70_000);
  assert.equal(tourAmount("retouch", 1, 1_000_000), 30_000);
  assert.equal(tourAmount("retouch", 2, 1_000_000), 0);
  assert.equal(tourAmount("laser", 3, 2_000_000), 0);
  assert.equal(tourAmount("plasma", 1, 2_000_000), 0);
  assert.equal(tourAmount(null, null, 1_000_000), null);
  assert.equal(tourAmount("new", null, null), null);
  assert.equal(tourAmount("retouch", null, 1_000_000), null);
});

test("status is derived from technician + confirmation", () => {
  assert.equal(tourStatus({ technician_id: null, confirmed_at: null }), "pending");
  assert.equal(tourStatus({ technician_id: id, confirmed_at: null }), "claimed");
  assert.equal(tourStatus({ technician_id: id, confirmed_at: "2026-11-06T00:00:00Z" }), "confirmed");
});

test("create requires date, customer, service", () => {
  assert.deepEqual(tourCreateSchema.parse({ tour_date: "2026-11-06", customer_id: id, service_id: id }),
    { tour_date: "2026-11-06", customer_id: id, service_id: id, note: "" });
  assert.equal(tourCreateSchema.safeParse({ tour_date: "06/11/2026", customer_id: id, service_id: id }).success, false);
  assert.equal(tourCreateSchema.safeParse({ tour_date: "2026-11-06", customer_id: id }).success, false);
  assert.equal(tourCreateSchema.safeParse({ tour_date: "2026-11-06", customer_id: id, service_id: id, technician_id: id }).success, false);
});

test("patch: detail requires session only for laser/plasma/retouch; whitelist; images are http urls", () => {
  const ok = (p: object) => tourPatchSchema.safeParse(p).success;
  assert.equal(ok({ service_detail: "retouch", service_session: 2 }), true);
  assert.equal(ok({ service_detail: "new", service_session: null }), true);
  assert.equal(ok({ service_detail: null, service_session: null }), true);
  assert.equal(ok({ service_detail: "laser", service_session: null }), false);
  assert.equal(ok({ service_detail: "laser", service_session: 21 }), false);
  assert.equal(ok({ service_detail: "new", service_session: 1 }), false);
  assert.equal(ok({ service_detail: "debt" }), false);
  assert.equal(ok({}), false);
  assert.equal(ok({ confirmed_at: "2026-11-06T00:00:00Z" }), false);
  assert.equal(ok({ bill_amount: -1 }), false);
  assert.equal(ok({ payment_method: "crypto" }), false);
  assert.equal(ok({ before_images: ["https://cdn.example.com/a.jpg"] }), true);
  assert.equal(ok({ before_images: ["javascript:alert(1)"] }), false);
});
