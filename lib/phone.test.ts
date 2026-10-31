import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePhone } from "./phone.ts";

test("phone stays text, drops plus signs, and has no length limit", () => {
  assert.equal(normalizePhone("+72"), "72");
  assert.equal(normalizePhone("001"), "001");
  assert.equal(normalizePhone("7".repeat(100)), "7".repeat(100));
  assert.equal(normalizePhone(" +72 123-456 "), "72 123-456");
});
