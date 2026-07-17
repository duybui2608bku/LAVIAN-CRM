import assert from "node:assert/strict";
import { test } from "node:test";

import { addDays, smaxRange, supaRange } from "./marketing.ts";

test("addDays cộng/trừ qua tháng và năm", () => {
  assert.equal(addDays("2026-07-17", -1), "2026-07-16");
  assert.equal(addDays("2026-07-01", -1), "2026-06-30");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
});

test("smaxRange: ngày VN = 17:00 UTC hôm trước → 16:59:59 UTC", () => {
  assert.deepEqual(smaxRange("2026-07-17", "2026-07-17"), {
    from: "2026-07-16 17:00:00 +00:00",
    to: "2026-07-17 16:59:59 +00:00",
  });
  assert.deepEqual(smaxRange("2026-07-01", "2026-07-17"), {
    from: "2026-06-30 17:00:00 +00:00",
    to: "2026-07-17 16:59:59 +00:00",
  });
});

test("supaRange: ISO UTC nửa mở phủ trọn ngày VN", () => {
  assert.deepEqual(supaRange("2026-07-17", "2026-07-17"), {
    start: "2026-07-16T17:00:00Z",
    end: "2026-07-17T17:00:00Z",
  });
});
