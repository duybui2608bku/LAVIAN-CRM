import assert from "node:assert/strict";
import { test } from "node:test";
import { CUSTOMER_OPTIONS, instagramUsername, leadSource } from "./customer-options.ts";
import { isLocale, locales } from "../i18n/config.ts";

test("fixed stages and sources match the requested values", () => {
  assert.deepEqual(CUSTOMER_OPTIONS.filter((o) => o.kind === "stage").map((o) => o.value),
    ["new_lead", "consulting", "deposited", "booked", "visited", "returning", "lost"]);
  assert.deepEqual(CUSTOMER_OPTIONS.filter((o) => o.kind === "source").map((o) => o.value),
    ["instagrams", "whatsapp"]);
});

test("source: WA thread → whatsapp, otherwise instagrams", () => {
  assert.equal(leadSource("https://smax.ai/chats/waw84901234567?tid=1"), "whatsapp");
  assert.equal(leadSource("https://smax.ai/chats/ig123?tid=1"), "instagrams");
  assert.equal(leadSource(null), "instagrams");
});

test("instagram username: only valid IG characters", () => {
  assert.equal(instagramUsername("ariana.s_1"), "ariana.s_1");
  assert.equal(instagramUsername("x/../y"), null);
  assert.equal(instagramUsername(undefined), null);
  assert.equal(instagramUsername(null), null);
});

test("only Vietnamese and English are selectable", () => {
  assert.deepEqual(locales, ["en", "vi"]);
  assert.equal(isLocale("id"), false);
});
