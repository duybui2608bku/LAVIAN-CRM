import assert from "node:assert/strict";
import { test } from "node:test";
import { canSeeFinance, canSeePhotos, customerFinance, customerRole, latestPortrait, mergeTimeline, nextNeed } from "./customer-360.ts";

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

test("tài chính 3 vùng: cọc tính 1 lần, Phải thu Chưa xác định khi có cọc mà giá = 0", () => {
  const now = Date.parse("2026-11-20T00:00:00Z");
  const a = (id: string, scheduled_at: string, bill_amount: number | null, paid_amount: number | null) => ({ id, scheduled_at, bill_amount, paid_amount });
  const f = customerFinance([
    a("old", "2026-11-01T03:00:00Z", 3_000_000, 2_500_000),
    a("next", "2026-11-22T03:00:00Z", 0, null),
  ], 500_000, now);
  assert.deepEqual(f.total, { bill: 3_000_000, collected: 3_000_000, due: 0 });
  assert.equal(f.current?.appointment.id, "next");
  assert.equal(f.current?.due, null); // có cọc, chưa chốt giá
  assert.deepEqual(f.history.map((h) => h.appointment.id), ["next", "old"]);
  // Không cọc, giá 0 → phải thu 0 (không phải Chưa xác định).
  assert.equal(customerFinance([a("x", "2026-11-22T03:00:00Z", 0, null)], 0, now).current?.due, 0);
  // Chỉ có lịch đã qua → đơn hiện tại = lịch gần nhất.
  assert.equal(customerFinance([a("o1", "2026-10-01T03:00:00Z", 1, 0), a("o2", "2026-11-01T03:00:00Z", 1, 0)], 0, now).current?.appointment.id, "o2");
  assert.equal(customerFinance([], 0, now).current, null);
});

test("chân dung mới nhất từng mục; nhu cầu tiếp theo; dòng thời gian mới nhất trước", () => {
  const e = (id: string, field: "wish" | "pain", created_at: string) =>
    ({ id, field, text: id, source: "customer" as const, message_ref: null, created_by: null, created_at });
  const latest = latestPortrait([e("p1", "pain", "2026-11-01T00:00:00Z"), e("p2", "pain", "2026-11-02T00:00:00Z"), e("w1", "wish", "2026-11-01T00:00:00Z")]);
  assert.equal(latest.pain?.id, "p2");
  assert.equal(latest.wish?.id, "w1");
  assert.equal(latest.behavior, undefined);

  const n = (id: string, status: string, created_at: string) => ({ id, status: status as "need", created_at });
  assert.equal(nextNeed([n("a", "consulting", "2026-11-01T00:00:00Z"), n("b", "won", "2026-11-05T00:00:00Z"), n("c", "need", "2026-11-03T00:00:00Z")])?.id, "c");
  assert.equal(nextNeed([n("b", "lost", "2026-11-05T00:00:00Z")]), null);

  const merged = mergeTimeline([
    { kind: "sales", items: [{ at: "2026-11-02T00:00:00Z", id: "s" }] },
    { kind: "log", items: [{ at: "2026-11-03T00:00:00Z", id: "l" }, { at: "2026-11-01T00:00:00Z", id: "l0" }] },
  ]);
  assert.deepEqual(merged.map((m) => `${m.kind}:${m.id}`), ["log:l", "sales:s", "log:l0"]);
  assert.deepEqual(merged.filter((m) => m.kind === "sales").map((m) => m.id), ["s"]);
});
