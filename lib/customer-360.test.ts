import assert from "node:assert/strict";
import { test } from "node:test";
import { canSeeFinance, canSeePhotos, currentAppointment, customerRole, latestPortrait, mergeTimeline, portraitText } from "./customer-360.ts";

const p = (department: string | null, role = "user") => ({ role, department });

test("vai trò + 2 quy tắc ẩn: tài chính, ảnh B/A", () => {
  assert.equal(customerRole(p(null, "admin")), "admin");
  assert.equal(customerRole(p("technician")), "master");
  assert.equal(customerRole(p("sales")), "sales");
  assert.equal(customerRole(p("telesales_leader")), "telesales");
  for (const d of ["sales", "telesales_leader"]) assert.equal(canSeeFinance(p(d)), true);
  for (const d of ["telesales", "technician", null]) assert.equal(canSeeFinance(p(d)), false);
  assert.equal(canSeeFinance(p(null, "admin")), true);
  for (const d of ["sales", "technician", null]) assert.equal(canSeePhotos(p(d)), true);
  for (const d of ["telesales", "telesales_leader"]) assert.equal(canSeePhotos(p(d)), false);
  assert.equal(canSeePhotos(p("telesales", "admin")), true);
  assert.equal(canSeePhotos(null), false);
});

test("đơn hiện tại: lịch sắp tới sớm nhất, không có thì lịch đã qua gần nhất", () => {
  const now = Date.parse("2026-11-20T00:00:00Z");
  const a = (id: string, scheduled_at: string) => ({ id, scheduled_at });
  assert.equal(currentAppointment([a("old", "2026-11-01T03:00:00Z"), a("far", "2026-12-01T03:00:00Z"), a("next", "2026-11-22T03:00:00Z")], now)?.id, "next");
  assert.equal(currentAppointment([a("o1", "2026-10-01T03:00:00Z"), a("o2", "2026-11-01T03:00:00Z")], now)?.id, "o2");
  assert.equal(currentAppointment([], now), null);
});

test("chân dung mới nhất từng mục; nhu cầu tiếp theo; dòng thời gian mới nhất trước", () => {
  const e = (id: string, field: "wish" | "pain", created_at: string) =>
    ({ id, field, text: id, source: "customer" as const, message_ref: null, created_by: null, created_at });
  const latest = latestPortrait([e("p1", "pain", "2026-11-01T00:00:00Z"), e("p2", "pain", "2026-11-02T00:00:00Z"), e("w1", "wish", "2026-11-01T00:00:00Z")]);
  assert.equal(latest.pain?.id, "p2");
  assert.equal(latest.wish?.id, "w1");
  assert.equal(latest.behavior, undefined);

  const merged = mergeTimeline([
    { kind: "sales", items: [{ at: "2026-11-02T00:00:00Z", id: "s" }] },
    { kind: "log", items: [{ at: "2026-11-03T00:00:00Z", id: "l" }, { at: "2026-11-01T00:00:00Z", id: "l0" }] },
  ]);
  assert.deepEqual(merged.map((m) => `${m.kind}:${m.id}`), ["log:l", "sales:s", "log:l0"]);
  assert.deepEqual(merged.filter((m) => m.kind === "sales").map((m) => m.id), ["s"]);
});

test("chân dung theo ngôn ngữ: vi → text, còn lại → text_en nếu có", () => {
  const ai = { text: "Muốn lông mày tự nhiên", text_en: "Wants natural brows" };
  assert.equal(portraitText(ai, "vi"), "Muốn lông mày tự nhiên");
  assert.equal(portraitText(ai, "en"), "Wants natural brows");
  assert.equal(portraitText(ai, "id"), "Wants natural brows");
  assert.equal(portraitText({ text: "Sợ đau", text_en: null }, "en"), "Sợ đau");
});
