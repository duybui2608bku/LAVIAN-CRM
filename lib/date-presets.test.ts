import assert from "node:assert/strict";
import { test } from "node:test";

import { DATE_PRESETS, matchPreset, presetRange } from "./date-presets.ts";

// 2026-11-14 là thứ Bảy.
const SAT = "2026-11-14";

test("mốc ngày cơ bản", () => {
  assert.deepEqual(presetRange("today", SAT), { from: SAT, to: SAT });
  assert.deepEqual(presetRange("yesterday", SAT), { from: "2026-11-13", to: "2026-11-13" });
  assert.deepEqual(presetRange("last7", SAT), { from: "2026-11-08", to: SAT });
  assert.deepEqual(presetRange("last30", SAT), { from: "2026-10-16", to: SAT });
});

test("tuần bắt đầu thứ Hai", () => {
  assert.deepEqual(presetRange("thisWeek", SAT), { from: "2026-11-09", to: SAT });
  assert.deepEqual(presetRange("lastWeek", SAT), { from: "2026-11-02", to: "2026-11-08" });
  // Chủ nhật vẫn thuộc tuần bắt đầu thứ Hai trước đó.
  assert.deepEqual(presetRange("thisWeek", "2026-11-15"), { from: "2026-11-09", to: "2026-11-15" });
  // Thứ Hai: tuần này = hôm nay.
  assert.deepEqual(presetRange("thisWeek", "2026-11-09"), { from: "2026-11-09", to: "2026-11-09" });
  // Tuần trước vắt qua năm.
  assert.deepEqual(presetRange("lastWeek", "2026-01-02"), { from: "2025-12-22", to: "2025-12-28" });
});

test("tháng này / tháng trước (cả tháng 2, qua năm)", () => {
  assert.deepEqual(presetRange("thisMonth", SAT), { from: "2026-11-01", to: SAT });
  assert.deepEqual(presetRange("lastMonth", SAT), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(presetRange("lastMonth", "2026-03-31"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(presetRange("lastMonth", "2028-03-05"), { from: "2028-02-01", to: "2028-02-29" });
  assert.deepEqual(presetRange("lastMonth", "2027-01-10"), { from: "2026-12-01", to: "2026-12-31" });
});

test("matchPreset nhận lại mốc, tuỳ chỉnh = null", () => {
  for (const p of DATE_PRESETS) {
    const hit = matchPreset(presetRange(p, SAT), SAT);
    assert.deepEqual(presetRange(hit!, SAT), presetRange(p, SAT));
  }
  assert.equal(matchPreset({ from: "2026-11-03", to: "2026-11-05" }, SAT), null);
});
