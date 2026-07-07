// Self-check: `node --test lib/customers.test.ts` (Node ≥ 23).
import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesCustomerFilters, optionLabel } from "./customers.ts";
import type { Customer, EnumOption } from "../types/customer.ts";

const base: Customer = {
  id: "1",
  full_name: "Nguyễn Văn A",
  phone: "0900123456",
  social_link: null,
  source: "instagrams",
  stage: "new_lead",
  lost_reason: null,
  staff_id: "staff-1",
  first_contact: null,
  notes: [],
  created_at: "2026-07-05T10:00:00.000Z",
  updated_at: "2026-07-05T10:00:00.000Z",
  deleted_at: null,
};

test("không lọc gì -> luôn khớp", () => {
  assert.equal(matchesCustomerFilters(base, {}), true);
});

test("tìm theo tên và theo phone (không phân biệt hoa thường)", () => {
  assert.equal(matchesCustomerFilters(base, { search: "văn a" }), true);
  assert.equal(matchesCustomerFilters(base, { search: "0900" }), true);
  assert.equal(matchesCustomerFilters(base, { search: "xyz" }), false);
});

test("lọc stage / source / staff", () => {
  assert.equal(matchesCustomerFilters(base, { stage: "new_lead" }), true);
  assert.equal(matchesCustomerFilters(base, { stage: "lost" }), false);
  assert.equal(matchesCustomerFilters(base, { source: "whatsapp" }), false);
  assert.equal(matchesCustomerFilters(base, { staffId: "staff-2" }), false);
});

test("khoảng ngày created_at (bao gồm biên)", () => {
  assert.equal(matchesCustomerFilters(base, { from: "2026-07-05" }), true);
  assert.equal(matchesCustomerFilters(base, { from: "2026-07-06" }), false);
  assert.equal(matchesCustomerFilters(base, { to: "2026-07-05" }), true);
  assert.equal(matchesCustomerFilters(base, { to: "2026-07-04" }), false);
  assert.equal(
    matchesCustomerFilters(base, { from: "2026-07-01", to: "2026-07-31" }),
    true,
  );
});

test("optionLabel theo locale, fallback vi", () => {
  const opt: EnumOption = {
    id: "o1",
    kind: "stage",
    value: "new_lead",
    label_vi: "Khách mới",
    label_en: "New lead",
    label_id: "Prospek baru",
    sort_order: 10,
    is_active: true,
    created_at: "",
    updated_at: "",
  };
  assert.equal(optionLabel(opt, "vi"), "Khách mới");
  assert.equal(optionLabel(opt, "en"), "New lead");
  assert.equal(optionLabel(opt, "id"), "Prospek baru");
  assert.equal(optionLabel(opt, "fr"), "Khách mới");
});
