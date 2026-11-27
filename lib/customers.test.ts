// Self-check: `node --test lib/customers.test.ts` (Node ≥ 23).
import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesCustomerFilters, matchesNameOrPhone, optionLabel } from "./customers.ts";
import type { Customer, EnumOption } from "../types/customer.ts";

const base: Customer = {
  id: "1",
  full_name: "Nguyễn Văn A",
  phone: "0900123456",
  social_name: null,
  picture: null,
  tags: [],
  thread: null,
  source: "instagrams",
  stage: "consulting",
  staff_id: "staff-1",
  sales_id: "sales-1",
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
  assert.equal(matchesCustomerFilters(base, { stage: "consulting" }), true);
  assert.equal(matchesCustomerFilters(base, { stage: "show_up" }), false);
  assert.equal(matchesCustomerFilters(base, { source: "whatsapp" }), false);
  assert.equal(matchesCustomerFilters(base, { staffId: "staff-2" }), false);
});

test("lọc theo đánh giá", () => {
  assert.equal(matchesCustomerFilters({ ...base, rating: "spam" }, { rating: "spam" }), true);
  assert.equal(matchesCustomerFilters({ ...base, rating: "potential" }, { rating: "spam" }), false);
  assert.equal(matchesCustomerFilters({ ...base, rating: null }, { rating: "spam" }), false);
});

test("lọc theo tỉnh (region_code tỉnh hoặc huyện/TP)", () => {
  assert.equal(matchesCustomerFilters({ ...base, region_code: "31" }, { province: "31" }), true);
  assert.equal(matchesCustomerFilters({ ...base, region_code: "31.71" }, { province: "31" }), true);
  assert.equal(matchesCustomerFilters({ ...base, region_code: "32.73" }, { province: "31" }), false);
  assert.equal(matchesCustomerFilters({ ...base, region_code: null }, { province: "31" }), false);
});

test("lọc theo Sales", () => {
  assert.equal(matchesCustomerFilters(base, { salesId: "sales-1" }), true);
  assert.equal(matchesCustomerFilters(base, { salesId: "sales-2" }), false);
  assert.equal(
    matchesCustomerFilters({ ...base, sales_id: null }, { salesId: "sales-1" }),
    false,
  );
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
  assert.equal(optionLabel(opt, "id"), "Khách mới");
  assert.equal(optionLabel(opt, "fr"), "Khách mới");
  // Nhãn en/id không bắt buộc — thiếu thì fallback tiếng Việt.
  assert.equal(optionLabel({ ...opt, label_en: null }, "en"), "Khách mới");
  assert.equal(optionLabel({ ...opt, label_id: null }, "id"), "Khách mới");
});

test("tìm SĐT không phụ thuộc dấu '-' và đầu 62", () => {
  const m = matchesNameOrPhone;
  assert.equal(m("An", "0812-1214-1243", "081212"), true);
  assert.equal(m("An", "0812-1214-1243", "+62 812 1214"), true);
  assert.equal(m("An", "0812-1214-1243", "an"), true);
  assert.equal(m("An", "0812-1214-1243", "0899"), false);
});

