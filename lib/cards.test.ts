import assert from "node:assert/strict";
import { test } from "node:test";
import { cardDone, cardMoney, cardPaymentSchema, cardTourSchema, suggestRefund, tourDetailFor, tourSessionOf } from "./cards.ts";

const id = "b102ac72-d890-479b-a51b-126494cf73ac";
const id2 = "c102ac72-d890-479b-a51b-126494cf73ac";

test("tiền thẻ: giá trị − hoàn, cọc + thu, công nợ (âm = phải hoàn khách)", () => {
  const card = {
    deposit_used: 300_000,
    items: [{ price: 6_000_000, refund_amount: null }, { price: 1_000_000, refund_amount: 1_000_000 }],
    payments: [{ amount: 2_000_000 }],
  };
  assert.deepEqual(cardMoney(card), { value: 6_000_000, collected: 2_300_000, due: 3_700_000 });
  assert.equal(cardMoney({ ...card, payments: [{ amount: 6_000_000 }] }).due, -300_000);
  assert.equal(cardMoney({ ...card, payments: [{ amount: 6_000_000 }, { amount: -300_000 }] }).due, 0);
});

test("gợi ý hoàn theo buổi chưa làm", () => {
  assert.equal(suggestRefund(4_000_000, 5, 2), 2_400_000);
  assert.equal(suggestRefund(4_000_000, 1, 0), 4_000_000);
  assert.equal(suggestRefund(4_000_000, 2, 3), 0);
});

test("thẻ hoàn thành khi mọi DV chưa hoàn đã dùng đủ buổi", () => {
  const items = [{ id: "a", sessions: 2, refunded_at: null }, { id: "b", sessions: 1, refunded_at: "x" }];
  assert.equal(cardDone(items, (i) => (i === "a" ? 2 : 0)), true);
  assert.equal(cardDone(items, () => 1), false);
  assert.equal(cardDone([{ id: "b", sessions: 1, refunded_at: "x" }], () => 0), false); // hoàn hết ≠ hoàn thành
});

test("dịch vụ chi tiết tour suy từ dịch vụ + lần", () => {
  const ombre = { group_id: "alis", name: "Ombre" };
  assert.deepEqual(tourDetailFor(ombre, 1), { service_detail: "new", service_session: null });
  assert.deepEqual(tourDetailFor(ombre, 2), { service_detail: "retouch", service_session: 1 });
  assert.deepEqual(tourDetailFor(ombre, 3), { service_detail: "retouch", service_session: 2 });
  assert.deepEqual(tourDetailFor({ group_id: "laser", name: "Laser Removal (once)" }, 3), { service_detail: "laser", service_session: 3 });
  assert.deepEqual(tourDetailFor({ group_id: "eyeliner_treatment", name: "Laser Removal (once)" }, 1), { service_detail: "laser", service_session: 1 });
  assert.deepEqual(tourDetailFor({ group_id: "lips_treatment", name: "Lip Spray Removal (plasma)" }, 2), { service_detail: "plasma", service_session: 2 });
});

test("Lần của tour ↔ dịch vụ chi tiết (đi rồi về giữ nguyên)", () => {
  for (const s of [{ group_id: "alis", name: "Ombre" }, { group_id: "laser", name: "Laser Removal (once)" }]) {
    for (const n of [1, 2, 3, 20]) assert.equal(tourSessionOf(tourDetailFor(s, n)), n);
  }
  assert.equal(tourSessionOf({ service_detail: "debt", service_session: null }), 1);
  assert.equal(tourSessionOf({ service_detail: null, service_session: null }), null);
});

test("schema thanh toán + tạo tour", () => {
  assert.equal(cardPaymentSchema.safeParse({ amount: 0, method: "cash" }).success, false);
  assert.equal(cardPaymentSchema.safeParse({ amount: -500, method: "bank" }).success, true);
  assert.equal(cardPaymentSchema.safeParse({ amount: 500, method: "gold" }).success, false);
  const tour = { tour_date: "2026-11-22", items: [{ card_item_id: id, session: 1 }, { card_item_id: id2, session: 2 }] };
  assert.equal(cardTourSchema.safeParse(tour).success, true);
  assert.equal(cardTourSchema.safeParse({ ...tour, items: [tour.items[0], tour.items[0]] }).success, false);
  assert.equal(cardTourSchema.safeParse({ ...tour, items: [] }).success, false);
});
