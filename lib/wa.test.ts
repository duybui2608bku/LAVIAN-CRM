// Self-check: `node --test lib/wa.test.ts` (Node ≥ 23).
import assert from "node:assert/strict";
import { test } from "node:test";
import { campaignWa, summarizeByWa, waColor, waNumber } from "./wa.ts";

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

test("waColor: cùng số cùng màu, các số đã biết khác màu nhau", () => {
  assert.equal(waColor("WA-3455"), waColor("WA-3455"));
  const known = ["WA-3455", "WA-4943", "WA-8630", "WA-8631"].map(waColor);
  assert.equal(new Set(known).size, known.length);
});

test("summarizeByWa: gộp theo số, nhiều tin nhắn trước, chưa gắn WA cuối", () => {
  const rows = summarizeByWa([
    { name: "WA3455 - A", messages: 10 },
    { name: "WA4943 - B", messages: 30 },
    { name: "WA3455 - C", messages: 25 },
    { name: "IG only", messages: 99 },
  ]);
  assert.deepEqual(rows, [
    { wa: "WA-3455", messages: 35 },
    { wa: "WA-4943", messages: 30 },
    { wa: null, messages: 99 },
  ]);
});
