import assert from "node:assert/strict";
import { test } from "node:test";
import { tourPatchSchema, tourStatus } from "./tours.ts";

const id = "b102ac72-d890-479b-a51b-126494cf73ac";

test("status is derived from technician + confirmation", () => {
  assert.equal(tourStatus({ technician_id: null, confirmed_at: null }), "pending");
  assert.equal(tourStatus({ technician_id: id, confirmed_at: null }), "claimed");
  assert.equal(tourStatus({ technician_id: id, confirmed_at: "2026-11-06T00:00:00Z" }), "confirmed");
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
