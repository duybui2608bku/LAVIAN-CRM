## 1. DB

- [x] 1.1 Migration `20261123160000_card_code_refund_delete.sql`: cột hoàn thẻ, hàm tiền tố mã, RPC tạo thẻ đặt mã, đổi mã thẻ cũ, RPC hoàn thẻ / xoá DV, guard thẻ đã hoàn (thẻ, DV, thanh toán, tour), `journey_due_source` bỏ thẻ đã hoàn

## 2. Logic

- [x] 2.1 `cardMoney` tính thẻ đã hoàn; `journeyDue` / sync lộ trình bỏ thẻ đã hoàn; `auditEntries` ghi hoàn thẻ + xoá DV
- [x] 2.2 Test

## 3. Server actions

- [x] 3.1 `deleteCardItem`, `refundCard` (thay `refundCardItem`); `openCard` bỏ thẻ đã hoàn
- [x] 3.2 Báo cáo doanh thu trừ tiền hoàn thẻ

## 4. UI

- [x] 4.1 Drawer thẻ: nút Xoá DV (xác nhận), nhấp đúp sửa số buổi, nút Hoàn thẻ, dòng hoàn trong Thanh toán, trạng thái Đã hoàn
- [x] 4.2 Danh sách thẻ: lọc Đã hoàn; bản in: dòng Refunded
