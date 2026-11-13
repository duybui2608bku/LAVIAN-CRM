// Self-check: `node --test lib/customers.test.ts` (Node ≥ 23).
import assert from "node:assert/strict";
import { test } from "node:test";
import { createdAgeBucket, matchesCustomerFilters, matchesNameOrPhone, optionLabel, serviceName } from "./customers.ts";
import type { Customer, EnumOption } from "../types/customer.ts";
import type { Service } from "../types/service.ts";

const base: Customer = {
  id: "1",
  full_name: "Nguyễn Văn A",
  phone: "0900123456",
  social_name: null,
  picture: null,
  tags: [],
  thread: null,
  source: "instagrams",
  stage: "new_lead",
  lost_reason: null,
  staff_id: "staff-1",
  sales_id: "sales-1",
  technician_id: "tech-1",
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

test("lọc theo tỉnh (region_code tỉnh hoặc huyện/TP)", () => {
  assert.equal(matchesCustomerFilters({ ...base, region_code: "31" }, { province: "31" }), true);
  assert.equal(matchesCustomerFilters({ ...base, region_code: "31.71" }, { province: "31" }), true);
  assert.equal(matchesCustomerFilters({ ...base, region_code: "32.73" }, { province: "31" }), false);
  assert.equal(matchesCustomerFilters({ ...base, region_code: null }, { province: "31" }), false);
});

test("lọc theo kỹ thuật viên", () => {
  assert.equal(matchesCustomerFilters(base, { technicianId: "tech-1" }), true);
  assert.equal(matchesCustomerFilters(base, { technicianId: "tech-2" }), false);
  assert.equal(
    matchesCustomerFilters({ ...base, technician_id: null }, { technicianId: "tech-1" }),
    false,
  );
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

test("serviceName theo locale, fallback vi", () => {
  const svc: Service = {
    id: "s1",
    name_vi: "Chăm sóc da",
    name_en: "Skin care",
    name_id: null,
    sort_order: 10,
    is_active: true,
    created_at: "",
    updated_at: "",
  };
  assert.equal(serviceName(svc, "vi"), "Chăm sóc da");
  assert.equal(serviceName(svc, "en"), "Skin care");
  assert.equal(serviceName(svc, "id"), "Chăm sóc da");
});

test("tìm SĐT không phụ thuộc dấu '-' và đầu 62", () => {
  const m = matchesNameOrPhone;
  assert.equal(m("An", "0812-1214-1243", "081212"), true);
  assert.equal(m("An", "0812-1214-1243", "+62 812 1214"), true);
  assert.equal(m("An", "0812-1214-1243", "an"), true);
  assert.equal(m("An", "0812-1214-1243", "0899"), false);
});

test("createdAgeBucket: hôm nay / ≤3 / ≤7 / ≤14 / cũ hơn", () => {
  const now = new Date(2026, 10, 12, 9, 0);
  const at = (d: number, h = 12) => new Date(2026, 10, d, h).toISOString();
  assert.equal(createdAgeBucket(at(12, 0), now), 0);
  assert.equal(createdAgeBucket(at(11, 23), now), 1);
  assert.equal(createdAgeBucket(at(9), now), 1);
  assert.equal(createdAgeBucket(at(8), now), 2);
  assert.equal(createdAgeBucket(at(5), now), 2);
  assert.equal(createdAgeBucket(at(4), now), 3);
  assert.equal(createdAgeBucket(at(-2), now), 3); // 29-10 → 14 ngày
  assert.equal(createdAgeBucket(at(-3), now), 4);
});
