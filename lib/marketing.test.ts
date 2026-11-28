import assert from "node:assert/strict";
import { test } from "node:test";

import {
  destinationPlatforms,
  fetchFbAds,
  fetchFbCampaigns,
  smaxRange,
  supaRange,
} from "./marketing.ts";

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
      const first = url.pathname.includes("1494701561142295");
      // Chỉ hỏi đúng chiến dịch có số liệu của tài khoản đó, kể cả đã lưu trữ.
      assert.deepEqual(JSON.parse(url.searchParams.get("filtering")!), [
        { field: "id", operator: "IN", value: first ? ["c1"] : ["c2"] },
      ]);
      assert.ok(JSON.parse(url.searchParams.get("effective_status")!).includes("ARCHIVED"));
      if (!first) return Response.json({ error: { message: "Invalid parameter" } }, { status: 400 });
      return Response.json({
        data: [
          {
            id: "c1",
            effective_status: "ACTIVE",
            adsets: { data: [{ destination_type: "MESSAGING_INSTAGRAM_DIRECT_WHATSAPP" }] },
          },
          { id: "c9", effective_status: "PAUSED" },
        ],
      });
    }
    assert.equal(url.searchParams.get("level"), "campaign");
    const isFirst = url.pathname.includes("1494701561142295");
    return Response.json({
      data: isFirst
        ? [
            { campaign_id: "c1", campaign_name: "A", account_id: "1494701561142295", spend: "100", impressions: "50", reach: "40" },
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
      { id: "c2", name: "B", accountId: "", accountName: "—", status: "UNKNOWN", platforms: null, spend: 300, messages: 6, impressions: 900, reach: 700 },
      { id: "c1", name: "A", accountId: "1494701561142295", accountName: "—", status: "ACTIVE", platforms: ["wa", "ig"], spend: 100, messages: 0, impressions: 50, reach: 40 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.FB_TOKEN = originalToken;
  }
});

test("destinationPlatforms: destination_type nhóm QC → wa / ig", () => {
  assert.deepEqual(destinationPlatforms(["WHATSAPP"]), ["wa"]);
  assert.deepEqual(destinationPlatforms(["INSTAGRAM_DIRECT"]), ["ig"]);
  assert.deepEqual(destinationPlatforms(["MESSAGING_INSTAGRAM_DIRECT_WHATSAPP"]), ["wa", "ig"]);
  assert.deepEqual(destinationPlatforms(["WHATSAPP", "INSTAGRAM_DIRECT"]), ["wa", "ig"]);
  assert.deepEqual(destinationPlatforms(["LEAD_FROM_IG_DIRECT", "MESSENGER"]), ["ig"]);
  assert.deepEqual(destinationPlatforms(["ON_POST", "WEBSITE", "MESSENGER"]), []);
});
