import assert from "node:assert/strict";
import { test } from "node:test";
import { tourPatchSchema, tourStatus } from "./tours.ts";

const id = "b102ac72-d890-479b-a51b-126494cf73ac";

test("status is derived from technician + confirmation", () => {
  assert.equal(tourStatus({ technician_id: null, confirmed_at: null }), "pending");
  assert.equal(tourStatus({ technician_id: id, confirmed_at: null }), "claimed");
  assert.equal(tourStatus({ technician_id: id, confirmed_at: "2026-11-06T00:00:00Z" }), "confirmed");
});

test("patch: Loại tour (server tự tính lần); whitelist; images are http urls", () => {
  const ok = (p: object) => tourPatchSchema.safeParse(p).success;
  assert.equal(ok({ kind: "retouch" }), true);
  assert.equal(ok({ kind: null }), true);
  assert.equal(ok({ kind: "debt" }), false); // Debt chỉ còn ở dữ liệu cũ
  assert.equal(ok({ service_detail: "new", service_session: null }), false); // lần do server tính
  assert.equal(ok({}), false);
  assert.equal(ok({ confirmed_at: "2026-11-06T00:00:00Z" }), false);
  assert.equal(ok({ bill_amount: 500 }), false); // tiền tour lấy từ thẻ, không sửa ở tour
  assert.equal(ok({ payment_method: "cash" }), false);
  assert.equal(ok({ before_images: ["https://cdn.example.com/a.jpg"] }), true);
  assert.equal(ok({ before_images: ["javascript:alert(1)"] }), false);
});
