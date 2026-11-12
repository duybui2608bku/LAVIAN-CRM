import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPhone, normalizePhone } from "./phone.ts";

test("phone stays text, drops plus signs, and has no length limit", () => {
  assert.equal(normalizePhone("+72"), "72");
  assert.equal(normalizePhone("001"), "001");
  assert.equal(normalizePhone("7".repeat(100)), "7".repeat(100));
  assert.equal(normalizePhone(" +72 123-456 "), "72 123-456");
});

test("formatPhone: Indonesian mobile → 0xxx-xxxx-xxxx", () => {
  assert.equal(formatPhone("+6281295759045"), "0812-9575-9045");
  assert.equal(formatPhone("628129926516"), "0812-9926-516");
  assert.equal(formatPhone("62885810304734"), "0885-8103-04734");
  assert.equal(formatPhone("081212141243"), "0812-1214-1243");
  assert.equal(formatPhone("0811-1011-23558"), "0811-1011-23558");
  assert.equal(formatPhone("0895421360504"), "0895-4213-60504");
  assert.equal(formatPhone("08119727970"), "0811-9727-970");
  assert.equal(formatPhone("0856933186"), "0856-933-186");
  assert.equal(formatPhone("811-813-549"), "0811-813-549");
  assert.equal(formatPhone("812-9992-8328"), "0812-9992-8328");
  assert.equal(formatPhone("+083877253926"), "0838-7725-3926");
});

test("formatPhone: non-Indonesian-mobile kept as typed", () => {
  assert.equal(formatPhone("+84 912 345 678"), "84 912 345 678");
  assert.equal(formatPhone("021555"), "021555");
  assert.equal(formatPhone(""), "");
});
