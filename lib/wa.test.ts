// Self-check: `node --test lib/wa.test.ts` (Node ≥ 23).
import assert from "node:assert/strict";
import { test } from "node:test";
import { campaignIg, campaignWa, summarizeByWa, waNumber } from "./wa.ts";

test("waNumber: 4 số cuối của page WhatsApp trong link SMAX", () => {
  assert.equal(
    waNumber("https://smax.ai/bizs/x/chats/waw6281111858631?tid=waw6281287391544@s.whatsapp.net"),
    "WA-8631",
  );
  assert.equal(waNumber("https://smax.ai/bizs/x/chats/ig17841474444790127?tid=ig1"), null);
  assert.equal(waNumber(null), null);
});

test("campaignWa: WA<4 số> trong tên chiến dịch", () => {
  assert.equal(campaignWa("WA3455 - TONG HOP - 11/11"), "WA-3455");
  assert.equal(campaignWa("HOTGIRL - wa4943 - 9/11"), "WA-4943");
  assert.equal(campaignWa("WA55 - TONG HOP"), null); // tên cũ 2 số
  assert.equal(campaignWa("WA12345 - sai"), null);
  assert.equal(campaignWa("IG + WA - Testing content"), null);
});

test("campaignIg: token IG / IGonly / ONLYIG trong tên chiến dịch", () => {
  assert.equal(campaignIg("WA3455 + IG - HOTGIRL2"), true);
  assert.equal(campaignIg("WA4943 - IG - HOTGIRL & ANH - OFF ANDVANTAGE"), true);
  assert.equal(campaignIg("IGonly - TONG HOP - KHTN"), true);
  assert.equal(campaignIg("ONLYIG - MUI CAO & HA - MAY"), true);
  assert.equal(campaignIg("WA4943 - HOTGIRL - 9/11"), false);
  assert.equal(campaignIg("BIG SALE - DIGITAL"), false);
});

test("summarizeByWa: gộp theo số, nhiều tin nhắn trước, chưa gắn WA cuối", () => {
  const rows = summarizeByWa([
    { name: "WA3455 - A", messages: 10, spend: 100 },
    { name: "WA4943 - B", messages: 30, spend: 300 },
    { name: "WA3455 - C", messages: 25, spend: 50 },
    { name: "IG only", messages: 99, spend: 0 },
  ]);
  assert.deepEqual(rows, [
    { wa: "WA-3455", messages: 35, spend: 150 },
    { wa: "WA-4943", messages: 30, spend: 300 },
    { wa: null, messages: 99, spend: 0 },
  ]);
});
