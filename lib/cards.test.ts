import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cardDone, cardItemSessionsSchema, cardMoney, cardPaymentSchema, cardTourSchema, journeyDue, suggestRefund, suggestTourKind, tourKindDetail,
} from "./cards.ts";

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

test("Loại tour gợi ý + số lần theo tour cùng loại trước đó", () => {
  const ombre = { group_id: "alis", name: "Ombre" };
  const newTour = { tour_date: "2026-11-01", service_detail: "new" };
  assert.equal(suggestTourKind(ombre, []), "new");
  assert.equal(suggestTourKind(ombre, [newTour]), "retouch");
  assert.equal(suggestTourKind({ group_id: "laser", name: "Laser Removal (once)" }, [newTour]), "laser");
  assert.equal(suggestTourKind({ group_id: "eyeliner_treatment", name: "Laser Removal (once)" }, []), "laser");
  assert.equal(suggestTourKind({ group_id: "lips_treatment", name: "Lip Spray Removal (plasma)" }, []), "plasma");
  assert.deepEqual(tourKindDetail("new", "2026-12-01", [newTour]), { service_detail: "new", service_session: null });
  const retouch = { tour_date: "2026-12-15", service_detail: "retouch" };
  assert.deepEqual(tourKindDetail("retouch", "2026-12-01", [newTour, retouch]), { service_detail: "retouch", service_session: 1 });
  assert.deepEqual(tourKindDetail("retouch", "2027-02-01", [newTour, retouch]), { service_detail: "retouch", service_session: 2 });
  assert.deepEqual(tourKindDetail("laser", "2026-12-01", []), { service_detail: "laser", service_session: 1 });
});

test("đến hạn liệu trình: kiểm tra laser 20 ngày, dặm 45 ngày, hết buổi thì thôi", () => {
  const laser = { id: "L", sessions: 3, refunded_at: null };
  const brow = { id: "B", sessions: 2, refunded_at: null };
  const card = { id: "c1", cancelled_at: null, items: [laser, brow] };
  const tour = (card_item_id: string, tour_date: string, service_detail: string, service_session: number | null = 1) =>
    ({ card_item_id, tour_date, service_detail, service_session });
  const due = (tours: ReturnType<typeof tour>[], c = card) =>
    journeyDue([c], tours).map((d) => `${d.task}:${d.item.id}:${d.n}:${d.due}`);

  assert.deepEqual(due([]), []); // chưa làm buổi nào → chưa nhắc
  assert.deepEqual(due([tour("L", "2026-12-01", "laser")]), ["laser_check:L:1:2026-12-21"]);
  // Kiểm tra chưa OK → laser tiếp → hạn kiểm tra tính từ laser 2.
  assert.deepEqual(due([tour("L", "2026-12-01", "laser"), tour("L", "2026-12-21", "laser", 2)]), ["laser_check:L:2:2027-01-10"]);
  // Kiểm tra OK → làm mới mày → dặm sau 45 ngày.
  const ok = [tour("L", "2026-12-01", "laser"), tour("B", "2026-12-21", "new", null)];
  assert.deepEqual(due(ok), ["retouch:B:1:2027-02-04"]);
  // Dặm xong, hết 2 buổi → không còn gì.
  assert.deepEqual(due([...ok, tour("B", "2027-02-04", "retouch")]), []);
  // Thẻ còn 3 buổi mày → dặm lần 2 sau dặm 1.
  assert.deepEqual(due([...ok, tour("B", "2027-02-04", "retouch")], { ...card, items: [laser, { ...brow, sessions: 3 }] }),
    ["retouch:B:2:2027-03-21"]);
  // Laser hết buổi + mày đã hoàn → không còn buổi → không nhắc kiểm tra.
  const done = { ...card, items: [{ ...laser, sessions: 1 }, { ...brow, refunded_at: "x" }] };
  assert.deepEqual(due([tour("L", "2026-12-01", "laser")], done), []);
  assert.deepEqual(due([tour("L", "2026-12-01", "laser")], { ...card, cancelled_at: "x" }), []); // thẻ huỷ
});

test("schema thanh toán + tạo tour", () => {
  assert.equal(cardPaymentSchema.safeParse({ amount: 0, method: "cash" }).success, false);
  assert.equal(cardPaymentSchema.safeParse({ amount: -500, method: "bank" }).success, true);
  assert.equal(cardPaymentSchema.safeParse({ amount: 500, method: "gold" }).success, false);
  const tour = { tour_date: "2026-11-22", items: [{ card_item_id: id, kind: "laser" }, { card_item_id: id2, kind: "new" }] };
  assert.equal(cardTourSchema.safeParse(tour).success, true);
  assert.equal(cardTourSchema.safeParse({ ...tour, items: [tour.items[0], tour.items[0]] }).success, false);
  assert.equal(cardTourSchema.safeParse({ ...tour, items: [] }).success, false);
  assert.equal(cardTourSchema.safeParse({ ...tour, items: [{ card_item_id: id, kind: "debt" }] }).success, false);
  assert.equal(cardItemSessionsSchema.safeParse(0).success, false);
  assert.equal(cardItemSessionsSchema.safeParse(3).success, true);
});
