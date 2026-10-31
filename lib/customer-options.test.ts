import assert from "node:assert/strict";
import { test } from "node:test";
import { CUSTOMER_OPTIONS } from "./customer-options.ts";
import { isLocale, locales } from "../i18n/config.ts";

test("fixed stages and sources match the requested values", () => {
  assert.deepEqual(CUSTOMER_OPTIONS.filter((o) => o.kind === "stage").map((o) => o.value),
    ["new_lead", "consulting", "deposited", "booked", "visited", "returning", "lost"]);
  assert.deepEqual(CUSTOMER_OPTIONS.filter((o) => o.kind === "source").map((o) => o.value),
    ["instagrams", "whatsapp", "referral", "walk_in", "smax", "other"]);
});

test("only Vietnamese and English are selectable", () => {
  assert.deepEqual(locales, ["en", "vi"]);
  assert.equal(isLocale("id"), false);
});
