import assert from "node:assert/strict";
import { test } from "node:test";
import {
  auditEntries, cardDone, cardItemSessionsSchema, cardMoney, cardRefundRange, cardStatus, customerCardMoney, cardPaymentSchema, cardTourSchema, groupTaken, journeyDue, paymentRange, planRoadmap, suggestRefund, suggestTourKind, tourKindDetail,
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

test("mỗi nhóm 1 DV tạo tour: trùng nhóm bị chặn, dòng phụ (mực / serum) không tính", () => {
  const ombre = { group_id: "alis", tourable: true };
  const shading = { group_id: "alis", tourable: true };
  const serum = { group_id: "laser", tourable: false };
  const laser = { group_id: "laser", tourable: true };
  assert.equal(groupTaken(shading, [ombre]), true);
  assert.equal(groupTaken(laser, [ombre]), false);
  assert.equal(groupTaken(laser, [serum]), false); // laser + serum cùng nhóm vẫn được
  assert.equal(groupTaken(serum, [laser]), false);
});

test("khoảng thu: thu ≤ công nợ, hoàn ≤ Σ đã thu qua thanh toán (không tính cọc)", () => {
  const card = { deposit_used: 300_000, items: [{ price: 6_000_000, refund_amount: null }], payments: [{ amount: 2_000_000 }] };
  assert.deepEqual(paymentRange(card), { min: -2_000_000, max: 3_700_000 });
  // Đã thu đủ → không thu thêm được; thu dư (hoàn DV sau khi trả đủ) → max 0, vẫn hoàn được.
  assert.equal(paymentRange({ ...card, payments: [{ amount: 5_700_000 }] }).max, 0);
  assert.deepEqual(paymentRange({ ...card, items: [{ price: 6_000_000, refund_amount: 1_000_000 }], payments: [{ amount: 5_700_000 }] }),
    { min: -5_700_000, max: 0 });
  // Chưa thu lần nào → không hoàn được.
  assert.equal(paymentRange({ ...card, payments: [] }).min, 0);
});

test("tiền khách qua mọi thẻ: bỏ thẻ huỷ, cọc chưa trừ tính là đã thu, chưa có thẻ mà có cọc → công nợ null", () => {
  const card = (deposit_used: number, price: number, paid: number, cancelled_at: string | null = null) =>
    ({ deposit_used, cancelled_at, items: [{ price, refund_amount: null }], payments: [{ amount: paid }] });
  assert.deepEqual(customerCardMoney([card(200_000, 5_000_000, 1_000_000), card(0, 9_000_000, 9_000_000, "x")], 500_000),
    { value: 5_000_000, collected: 1_500_000, depositLeft: 300_000, due: 3_500_000 });
  assert.deepEqual(customerCardMoney([], 500_000), { value: 0, collected: 500_000, depositLeft: 500_000, due: null });
  assert.equal(customerCardMoney([], null).due, 0);
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
  // Laser mày + phun mày: cùng vùng mày.
  const laser = { id: "L", service_id: "s-laser", sessions: 3, refunded_at: null, service: { group_id: "laser", tourable: true } };
  const brow = { id: "B", service_id: "s-brow", sessions: 2, refunded_at: null, service: { group_id: "alis", tourable: true } };
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

test("đến hạn theo vùng: laser mày không che dặm môi; cùng ngày làm mới là tour cuối; mực không tính", () => {
  const item = (id: string, group_id: string, sessions = 2, tourable = true) =>
    ({ id, service_id: `s-${id}`, sessions, refunded_at: null, service: { group_id, tourable } });
  const card = { id: "c2", cancelled_at: null, items: [
    item("LB", "laser", 3), item("B", "alis"), // mày
    item("PL", "lips_treatment"), item("P", "bibir"), // môi
    item("INK", "ink", 1, false), // mực: không tạo tour
  ] };
  const tour = (card_item_id: string, tour_date: string, service_detail: string, service_session: number | null = 1) =>
    ({ card_item_id, tour_date, service_detail, service_session });
  const due = (tours: ReturnType<typeof tour>[]) => journeyDue([card], tours).map((d) => `${d.task}:${d.item.id}:${d.due}`);

  // Laser mày 01/12 + Làm mới môi 05/12 → vẫn kiểm tra laser mày, kèm dặm môi (môi 60 ngày).
  assert.deepEqual(due([tour("LB", "2026-12-01", "laser"), tour("P", "2026-12-05", "new", null)]),
    ["laser_check:LB:2026-12-21", "retouch:P:2027-02-03"]);
  // Làm mới mày 01/11 + Plasma môi 10/11 → dặm mày vẫn còn, kèm kiểm tra plasma môi sau 60 ngày.
  assert.deepEqual(due([tour("B", "2026-11-01", "new", null), tour("PL", "2026-11-10", "plasma")]),
    ["retouch:B:2026-12-16", "laser_check:PL:2027-01-09"]);
  // Cùng ngày laser + làm mới mày → làm mới là tour cuối → chờ dặm.
  assert.deepEqual(due([tour("LB", "2026-12-01", "laser"), tour("B", "2026-12-01", "new", null)]), ["retouch:B:2027-01-15"]);
  // Hoàn thành không chờ dòng mực (không bao giờ có tour).
  const used = (id: string) => (id === "INK" ? 0 : id === "LB" ? 3 : 2);
  assert.equal(cardDone(card.items, used), true);
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

test("nhật ký thẻ → thao tác: sửa buổi, hoàn, thu / xoá tiền, tour; lưu y nguyên thì bỏ", () => {
  const row = (table_name: string, op: "INSERT" | "UPDATE" | "DELETE", old_row: object | null, new_row: object | null) =>
    auditEntries({ id: 1, table_name, op, old_row: old_row as Record<string, unknown>, new_row: new_row as Record<string, unknown>, actor: null, at: "" });
  const keys = (list: ReturnType<typeof auditEntries>) => list.map((e) => e.key);
  const item = { id: "i", card_id: "c", service_id: "s", price: 100, sessions: 2, refunded_at: null, refund_amount: null };

  assert.deepEqual(row("treatment_cards", "INSERT", null, { id: "c" }).map((e) => e.key), ["cardCreated"]);
  assert.deepEqual(row("treatment_card_items", "UPDATE", item, { ...item, sessions: 3 }),
    [{ key: "sessions", values: { service: "s", oldN: 2, n: 3 } }]);
  assert.deepEqual(row("treatment_card_items", "UPDATE", item, { ...item, refunded_at: "x", refund_amount: 50, refund_note: "đổi ý" }),
    [{ key: "refunded", values: { service: "s", amount: 50 } }]);
  assert.deepEqual(row("treatment_card_payments", "DELETE", { id: "p", card_id: "c", amount: -20, method: "cash" }, null),
    [{ key: "paymentDeleted", values: { service: undefined, amount: -20, method: "cash" } }]);
  assert.deepEqual(keys(row("treatment_cards", "UPDATE", { id: "c", cancelled_at: null, total: 1 }, { id: "c", cancelled_at: "x", total: 2 })),
    ["cardCancelled", "edited"]); // cột lạ vẫn hiện

  const tour = { id: "t", card_item_id: "i", service_id: "s", tour_date: "2026-11-22", service_detail: "new",
    service_session: null, technician_id: null, confirmed_at: null, deleted_at: null, notes: ["a"] };
  assert.deepEqual(row("tours", "UPDATE", tour, { ...tour, notes: ["b"] }), []); // lưu lại y nguyên / chỉ ghi chú
  assert.deepEqual(keys(row("tours", "UPDATE", tour, { ...tour, service_detail: "retouch", service_session: 1, technician_id: "m" })),
    ["tourKind", "tourTech"]);
  assert.deepEqual(keys(row("tours", "UPDATE", tour, { ...tour, deleted_at: "x" })), ["tourDeleted"]);
  assert.deepEqual(row("tours", "INSERT", null, tour)[0].values.kind, { service_detail: "new", service_session: null });
});

test("lộ trình dự kiến mày: laser 20 ngày, làm mới 20 ngày, dặm 45 ngày; tính lại theo tour thật", () => {
  const item = (id: string, group_id: string, sessions: number) =>
    ({ id, service_id: `s-${id}`, sessions, refunded_at: null as string | null, service: { group_id, tourable: true } });
  const laser = item("L", "laser", 2), brow = item("B", "alis", 2);
  const tour = (card_item_id: string, tour_date: string, service_detail: string) => ({ card_item_id, tour_date, service_detail });
  const plan = (items: ReturnType<typeof item>[], tours: ReturnType<typeof tour>[]) =>
    planRoadmap(items, tours).map((s) => `${s.kind}:${s.card_item_id}:${s.tour_date}`);

  assert.deepEqual(plan([laser, brow], []), []); // chưa có tour thật → chưa sinh
  // Mày + laser 2 buổi: Laser 1 thật → Laser 2, Làm mới, Dặm.
  const l1 = tour("L", "2026-12-01", "laser");
  assert.deepEqual(plan([laser, brow], [l1]), ["laser:L:2026-12-21", "new:B:2027-01-10", "retouch:B:2027-02-24"]);
  // Laser sạch sớm (số buổi laser = 1) → lên mới luôn.
  assert.deepEqual(plan([{ ...laser, sessions: 1 }, brow], [l1]), ["new:B:2026-12-21", "retouch:B:2027-02-04"]);
  // Laser 2 dời sang 23/12 (chốt lịch) → chuỗi sau dời theo.
  assert.deepEqual(plan([laser, brow], [l1, tour("L", "2026-12-23", "laser")]), ["new:B:2027-01-12", "retouch:B:2027-02-26"]);
  // Còn mực: laser 3 buổi, đã làm 2.
  assert.deepEqual(plan([{ ...laser, sessions: 3 }, brow], [l1, tour("L", "2026-12-21", "laser")]),
    ["laser:L:2027-01-10", "new:B:2027-01-30", "retouch:B:2027-03-16"]);
  // Chỉ mày: Làm mới → Dặm 45 ngày; đã có Làm mới thì laser còn buổi bị bỏ qua.
  assert.deepEqual(plan([brow], [tour("B", "2026-12-01", "new")]), ["retouch:B:2027-01-15"]);
  assert.deepEqual(plan([laser, brow], [tour("B", "2026-12-01", "new")]), ["retouch:B:2027-01-15"]);
  // Hết buổi / DV hoàn → không sinh.
  assert.deepEqual(plan([brow], [tour("B", "2026-12-01", "new"), tour("B", "2027-01-15", "retouch")]), []);
  assert.deepEqual(plan([laser, { ...brow, refunded_at: "x" }], [l1]), ["laser:L:2026-12-21"]);
  // Sửa tay ngày Làm mới (bước 0 của dòng B) → giữ ngày đó, Dặm tính tiếp từ nó.
  const pin = (itemId: string, k: number) => (itemId === "B" && k === 0 ? "2027-01-20" : null);
  assert.deepEqual(planRoadmap([laser, brow], [l1], pin).map((s) => `${s.kind}:${s.tour_date}`),
    ["laser:2026-12-21", "new:2027-01-20", "retouch:2027-03-06"]);
  // Lập lúc bán thẻ (chưa có tour thật): bước đầu đúng ngày bắt đầu, sau đó như thường.
  const plan0 = (items: ReturnType<typeof item>[], p?: typeof pin) =>
    planRoadmap(items, [], p, "2026-12-01").map((s) => `${s.kind}:${s.tour_date}${s.pinned ? "*" : ""}`);
  assert.deepEqual(plan0([laser, brow]), ["laser:2026-12-01", "laser:2026-12-21", "new:2027-01-10", "retouch:2027-02-24"]);
  assert.deepEqual(plan0([brow]), ["new:2026-12-01", "retouch:2027-01-15"]);
  assert.deepEqual(plan0([laser, brow], pin), ["laser:2026-12-01", "laser:2026-12-21", "new:2027-01-20*", "retouch:2027-03-06"]);
  assert.deepEqual(plan([laser, brow], []), []); // không có ngày bắt đầu → vẫn không sinh
});

test("lộ trình dự kiến môi: plasma → làm mới → dặm, mỗi bước 60 ngày; tính riêng với mày", () => {
  const item = (id: string, group_id: string, sessions: number, name = "") =>
    ({ id, service_id: `s-${id}`, sessions, refunded_at: null as string | null, service: { group_id, tourable: true, name } });
  const lip = item("P", "bibir", 2, "Nano Lip"), plasma = item("PL", "lips_treatment", 1, "Lip Spray Removal (plasma)");
  const tour = (card_item_id: string, tour_date: string, service_detail: string) => ({ card_item_id, tour_date, service_detail });
  const plan = (items: ReturnType<typeof item>[], tours: ReturnType<typeof tour>[], start?: Parameters<typeof planRoadmap>[3]) =>
    planRoadmap(items, tours, undefined, start).map((s) => `${s.kind}:${s.card_item_id}:${s.tour_date}`);

  // Môi làm mới luôn → dặm sau 2 tháng.
  assert.deepEqual(plan([lip], [tour("P", "2026-12-01", "new")]), ["retouch:P:2027-01-30"]);
  // Môi xoá sửa: Plasma → Làm mới (+60) → Dặm (+60).
  assert.deepEqual(plan([plasma, lip], [tour("PL", "2026-12-01", "plasma")]), ["new:P:2027-01-30", "retouch:P:2027-03-31"]);
  assert.deepEqual(plan([plasma, lip], [], "2026-12-01"), ["plasma:PL:2026-12-01", "new:P:2027-01-30", "retouch:P:2027-03-31"]);
  // DV môi khác của nhóm lips_treatment (Dark Lip) không thuộc lộ trình.
  assert.deepEqual(plan([item("D", "lips_treatment", 2, "Dark Lip Treatment")], [tour("D", "2026-12-01", "new")]), []);
  // Mày + môi cùng thẻ: tính độc lập, ngày bắt đầu theo vùng.
  const brow = item("B", "alis", 2, "Shading");
  assert.deepEqual(plan([brow, lip], [tour("B", "2026-12-01", "new"), tour("P", "2026-12-01", "new")]),
    ["retouch:B:2027-01-15", "retouch:P:2027-01-30"]);
  assert.deepEqual(plan([brow, lip], [], (ids) => (ids.includes("P") ? "2026-12-10" : "2026-12-01")),
    ["new:B:2026-12-01", "retouch:B:2027-01-15", "new:P:2026-12-10", "retouch:P:2027-02-08"]);
});

test("đến hạn bỏ tour dự kiến", () => {
  const brow = { id: "B", service_id: "s-B", sessions: 2, refunded_at: null, service: { group_id: "alis", tourable: true } };
  const card = { id: "c", cancelled_at: null, items: [brow] };
  const tours = [
    { card_item_id: "B", tour_date: "2026-12-01", service_detail: "new", service_session: null },
    { card_item_id: "B", tour_date: "2027-01-15", service_detail: "retouch", service_session: 1, planned: true },
  ];
  assert.deepEqual(journeyDue([card], tours).map((d) => `${d.task}:${d.due}`), ["retouch:2027-01-15"]);
});

test("hoàn cả thẻ: Đã thu trừ tiền hoàn, Giá trị = Đã thu, công nợ 0; gợi ý theo buổi chưa làm ≤ đã thu", () => {
  const items = [
    { id: "a", price: 4_000_000, sessions: 2, refunded_at: null, refund_amount: null, service: { group_id: "alis", tourable: true } },
    { id: "b", price: 1_000_000, sessions: 1, refunded_at: null, refund_amount: null, service: { group_id: "ink", tourable: false } },
  ];
  const card = { deposit_used: 1_000_000, items, payments: [{ amount: 5_000_000 }] };
  // Đã làm 1/2 buổi mày → gợi ý 2tr + mực 1tr.
  assert.deepEqual(cardRefundRange(card, (i) => (i === "a" ? 1 : 0)), { max: 6_000_000, suggest: 3_000_000 });
  assert.deepEqual(cardRefundRange({ ...card, payments: [] }, () => 0), { max: 1_000_000, suggest: 1_000_000 });
  assert.deepEqual(cardMoney({ ...card, refund_amount: 3_000_000 }), { value: 3_000_000, collected: 3_000_000, due: 0 });
  assert.deepEqual(cardMoney({ ...card, refund_amount: 0 }), { value: 6_000_000, collected: 6_000_000, due: 0 });
});

test("trạng thái thẻ: huỷ > đã hoàn > hoàn thành > đang dùng; thẻ đã hoàn không có Đến hạn", () => {
  const items = [{ id: "a", service_id: "s", sessions: 1, refunded_at: null }];
  assert.equal(cardStatus({ cancelled_at: null, refunded_at: "x", items }, () => 1), "refunded");
  assert.equal(cardStatus({ cancelled_at: "x", refunded_at: "x", items }, () => 0), "cancelled");
  assert.equal(cardStatus({ cancelled_at: null, items }, () => 1), "done");
  assert.equal(cardStatus({ cancelled_at: null, refunded_at: null, items }, () => 0), "active");
  const tours = [{ card_item_id: "a", tour_date: "2026-11-01", service_detail: "new", service_session: null }];
  const card = { cancelled_at: null, items: [{ ...items[0], sessions: 3 }] };
  assert.equal(journeyDue([card], tours).length, 1);
  assert.equal(journeyDue([{ ...card, refunded_at: "x" }], tours).length, 0);
});

test("nhật ký: hoàn thẻ, xoá DV kèm buổi + giá", () => {
  const card = { id: 1, actor: null, at: "", table_name: "treatment_cards", op: "UPDATE" as const };
  assert.deepEqual(auditEntries({ ...card, old_row: { refunded_at: null, refund_amount: null },
    new_row: { refunded_at: "x", refund_amount: 500, refund_note: "đổi ý", refunded_by: "u" } }).map((e) => [e.key, e.values.amount]),
  [["cardRefunded", 500]]);
  assert.deepEqual(auditEntries({ ...card, table_name: "treatment_card_items", op: "DELETE",
    old_row: { service_id: "s", sessions: 2, price: 900 }, new_row: null })[0].values, { service: "s", n: 2, amount: 900 });
});
