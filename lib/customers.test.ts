// Self-check: `node --test lib/customers.test.ts` (Node ≥ 23).
import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesCustomerFilters, optionLabel, resolveSource, serviceName } from "./customers.ts";
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
  service_ids: [],
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

test("lọc theo dịch vụ đã gắn", () => {
  const withSvc = { ...base, service_ids: ["s1", "s2"] };
  assert.equal(matchesCustomerFilters(withSvc, { serviceId: "s1" }), true);
  assert.equal(matchesCustomerFilters(withSvc, { serviceId: "s9" }), false);
  assert.equal(matchesCustomerFilters(base, { serviceId: "s1" }), false);
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

test("resolveSource khớp value/nhãn không phân biệt hoa thường", () => {
  const opts = [
    { value: "instagrams", label_vi: "Instagram", label_en: "Instagram", label_id: null },
    { value: "whatsapp", label_vi: "WhatsApp", label_en: null, label_id: null },
    { value: "walk_in", label_vi: "Khách vãng lai", label_en: "Walk-in", label_id: null },
  ];
  assert.equal(resolveSource("instagram", opts), "instagrams");
  assert.equal(resolveSource("WHATSAPP", opts), "whatsapp");
  assert.equal(resolveSource("walk in", opts), "walk_in");
  assert.equal(resolveSource("tiktok", opts), null);
  assert.equal(resolveSource("", opts), null);
});
