import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addDays,
  fetchSmaxStaffReplyTimes,
  smaxRange,
  supaRange,
} from "./marketing.ts";

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

test("fetchSmaxStaffReplyTimes gửi đúng payload và map tên theo user_id", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.SMAX_TOKEN;
  process.env.SMAX_TOKEN = "test-token";
  globalThis.fetch = async (_input, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), {
      page_pids: [],
      apply_all: true,
      from: "2026-06-16 17:00:00 +00:00",
      to: "2026-07-18 16:59:59 +00:00",
      target: "customer_and_page",
      type: "time_reply",
      key_time: "30_days",
      tag_aliases: [],
      top: 10,
    });
    return new Response(
      JSON.stringify({
        status: 200,
        data: {
          reply_time: [
            {
              user_id: "6a16a474ed08922940fa8a94",
              reply_time_min: 1,
              reply_time_max: 502600,
              reply_time_average: 21233.93615520282,
            },
          ],
        },
      }),
    );
  };

  try {
    assert.deepEqual(await fetchSmaxStaffReplyTimes("2026-06-17", "2026-07-18"), [
      {
        userId: "6a16a474ed08922940fa8a94",
        name: "Tiara Kania",
        minimum: 1,
        maximum: 502600,
        average: 21233.93615520282,
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.SMAX_TOKEN;
    else process.env.SMAX_TOKEN = originalToken;
  }
});
