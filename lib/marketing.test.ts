import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addDays,
  fetchFbAds,
  fetchFbCampaigns,
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

test("fetchFbAds cộng spend + tin nhắn của 2 tài khoản ads", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.FB_TOKEN;
  process.env.FB_TOKEN = "test-token";
  const accounts: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    accounts.push(url.pathname.split("/")[2]);
    assert.equal(url.searchParams.get("fields"), "spend,actions,account_currency");
    const empty = url.pathname.includes("405282048979489");
    return Response.json({
      data: empty
        ? []
        : [
            {
              spend: "1000.5",
              account_currency: "IDR",
              actions: [
                { action_type: "link_click", value: "99" },
                {
                  action_type:
                    "onsite_conversion.messaging_conversation_started_7d",
                  value: "12",
                },
              ],
            },
          ],
    });
  };
  try {
    assert.deepEqual(await fetchFbAds("2026-10-24", "2026-10-24"), {
      spend: 1000.5,
      messages: 12,
      currency: "IDR",
    });
    assert.deepEqual(accounts.sort(), [
      "act_1494701561142295",
      "act_405282048979489",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.FB_TOKEN = originalToken;
  }
});

test("fetchFbCampaigns lọc impressions > 0, trạng thái best-effort, sắp theo chi tiêu", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.FB_TOKEN;
  process.env.FB_TOKEN = "test-token";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.has("ids"), false);
    if (url.pathname.endsWith("/campaigns")) {
      assert.equal(url.searchParams.has("filtering"), false);
      const first = url.pathname.includes("1494701561142295");
      if (!first) return Response.json({ error: { message: "Invalid parameter" } }, { status: 400 });
      return Response.json({
        data: [
          { id: "c1", effective_status: "ACTIVE" },
          { id: "c9", effective_status: "PAUSED" },
        ],
      });
    }
    assert.equal(url.searchParams.get("level"), "campaign");
    const isFirst = url.pathname.includes("1494701561142295");
    return Response.json({
      data: isFirst
        ? [
            { campaign_id: "c1", campaign_name: "A", spend: "100", impressions: "50", reach: "40" },
            { campaign_id: "c0", campaign_name: "Zero", spend: "0", impressions: "0", reach: "0" },
          ]
        : [
            {
              campaign_id: "c2",
              campaign_name: "B",
              spend: "300",
              impressions: "900",
              reach: "700",
              actions: [
                { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "6" },
              ],
            },
          ],
    });
  };
  try {
    const rows = await fetchFbCampaigns("2026-10-24", "2026-10-24");
    assert.deepEqual(rows, [
      { id: "c2", name: "B", accountName: "—", status: "UNKNOWN", spend: 300, messages: 6, impressions: 900, reach: 700 },
      { id: "c1", name: "A", accountName: "—", status: "ACTIVE", spend: 100, messages: 0, impressions: 50, reach: 40 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.FB_TOKEN = originalToken;
  }
});
