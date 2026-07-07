import assert from "node:assert/strict";
import { test } from "node:test";

import { formatISODate, parseISODate } from "./date.ts";

test("parse ↔ format round-trip theo local (không lệch ngày)", () => {
  const d = parseISODate("2026-07-07");
  assert.ok(d);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 6); // tháng 7 = index 6
  assert.equal(d.getDate(), 7);
  assert.equal(formatISODate(d), "2026-07-07");
});

test("giá trị trống / không hợp lệ", () => {
  assert.equal(parseISODate(""), undefined);
  assert.equal(parseISODate(null), undefined);
  assert.equal(parseISODate("khong-phai-ngay"), undefined);
  assert.equal(formatISODate(undefined), "");
  assert.equal(formatISODate(null), "");
});

test("format có zero-pad", () => {
  assert.equal(formatISODate(new Date(2026, 0, 5)), "2026-01-05");
});
