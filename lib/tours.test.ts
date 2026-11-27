import assert from "node:assert/strict";
import { test } from "node:test";
import { firstTourIds, plannedDateError, tourBill, tourCommission, tourPatchSchema, tourStatus } from "./tours.ts";

const id = "b102ac72-d890-479b-a51b-126494cf73ac";

test("status is derived from technician + confirmation", () => {
  assert.equal(tourStatus({ technician_id: null, confirmed_at: null }), "pending");
  assert.equal(tourStatus({ technician_id: id, confirmed_at: null }), "claimed");
  assert.equal(tourStatus({ technician_id: id, confirmed_at: "2026-11-06T00:00:00Z" }), "confirmed");
});

test("patch: Loại tour (server tự tính lần); whitelist; images are http urls", () => {
  const ok = (p: object) => tourPatchSchema.safeParse(p).success;
  assert.equal(ok({ kind: "retouch" }), true);
  assert.equal(ok({ kind: null }), false); // Loại bắt buộc: không Loại thì mất khỏi Đến hạn + không tính công
  assert.equal(ok({ kind: "debt" }), false); // Debt chỉ còn ở dữ liệu cũ
  assert.equal(ok({ service_detail: "new", service_session: null }), false); // lần do server tính
  assert.equal(ok({}), false);
  assert.equal(ok({ confirmed_at: "2026-11-06T00:00:00Z" }), false);
  assert.equal(ok({ bill_amount: 500 }), false); // tiền tour lấy từ thẻ, không sửa ở tour
  assert.equal(ok({ payment_method: "cash" }), false);
  assert.equal(ok({ before_images: ["https://cdn.example.com/a.jpg"] }), true);
  assert.equal(ok({ before_images: ["javascript:alert(1)"] }), false);
});

test("công Master: Làm mới 7%, Dặm 3% mọi lần, Laser/Plasma 0%, Debt cũ 7%", () => {
  const c = (service_detail: string | null, bill_amount: number | null = 6_000_000) => tourCommission({ service_detail, bill_amount });
  assert.equal(c("new"), 420_000);
  assert.equal(c("retouch"), 180_000);
  assert.equal(c("laser"), 0);
  assert.equal(c("plasma"), 0);
  assert.equal(c("debt"), 420_000);
  assert.equal(c(null), 0);
  assert.equal(c("new", null), 0);
  assert.equal(c("retouch", 1_500_001), 45_000); // làm tròn
});

test("Hoá đơn = giá trọn gói chỉ ở tour thật đầu tiên của dòng thẻ", () => {
  const first = firstTourIds([
    { id: "dam", card_item_id: "i1", tour_date: "2026-12-20", created_at: "2026-11-01T00:00:00Z" },
    { id: "moi-b", card_item_id: "i1", tour_date: "2026-11-05", created_at: "2026-11-02T00:00:00Z" },
    { id: "moi-a", card_item_id: "i1", tour_date: "2026-11-05", created_at: "2026-11-01T00:00:00Z" }, // cùng ngày → tạo trước
    { id: "khac", card_item_id: "i2", tour_date: "2026-11-09", created_at: "2026-11-01T00:00:00Z" },
    { id: "cu", card_item_id: null, tour_date: "2026-11-01", created_at: "2026-11-01T00:00:00Z" },
  ]);
  assert.deepEqual([...first].sort(), ["khac", "moi-a"]);
  assert.equal(tourBill({ bill_amount: 500, billed: true }), 500);
  assert.equal(tourBill({ bill_amount: 500, billed: false }), null); // buổi sau: không cộng lại giá trọn gói
  assert.equal(tourBill({ bill_amount: 500 }), 500); // không tính billed → như cũ
  assert.equal(tourCommission({ bill_amount: 500_000, service_detail: "retouch" }), 15_000); // công vẫn trên giá cả dòng
});

test("pinning a planned date keeps the step order", () => {
  const tours = [
    { id: "real", tour_date: "2026-12-01", planned: false, date_pinned: false },
    { id: "p1", tour_date: "2027-01-01", planned: true, date_pinned: false },
    { id: "p2", tour_date: "2027-02-01", planned: true, date_pinned: false },
    { id: "p3", tour_date: "2027-03-01", planned: true, date_pinned: true },
  ];
  const today = "2026-12-10";
  assert.equal(plannedDateError("p2", "2027-02-15", today, tours), null);
  assert.deepEqual(plannedDateError("p2", "2026-12-09", today, tours), { key: "plannedPast" });
  assert.deepEqual(plannedDateError("p2", "2026-12-20", today, tours), { key: "plannedBeforePrev", date: "2027-01-01" }); // trước bước 1
  assert.deepEqual(plannedDateError("p1", "2026-12-01", "2026-11-01", tours), { key: "plannedBeforePrev", date: "2026-12-01" }); // trùng tour thật
  assert.deepEqual(plannedDateError("p2", "2027-03-05", today, tours), { key: "plannedAfterNext", date: "2027-03-01" }); // qua bước đã ghim
  assert.equal(plannedDateError("p3", "2027-06-01", today, tours), null); // bước cuối: dời xa thoải mái
  assert.equal(plannedDateError("real", "2027-06-01", today, tours), null); // không phải bước dự kiến
});
