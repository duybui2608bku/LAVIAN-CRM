## C. Bịt lỗ tiền

- [x] C.1 Migration: quyền cột + policy thẻ / DV / thanh toán / tour, trigger guard, RPC security definer + cọc ≤ giá trị thẻ
- [x] C.2 Migration: bảng `card_audit` + trigger nhật ký
- [x] C.3 `cancelCard` chặn khi đã thu tiền; `createCardTours` chặn vượt số buổi (trừ admin)

## A. Hoa hồng

- [x] A.1 `services.tourable` + ô "Tạo tour" ở bảng giá; DV không tạo tour bị loại khỏi modal Tạo tour, buổi, hoàn thành, Đến hạn
- [x] A.2 `tourCommission` (Làm mới 7%, Dặm 3%, Laser/Plasma 0%, Debt cũ 7%) + test; cột/tổng Công ở trang Tour, Excel, phiếu tour
- [x] A.3 Báo cáo: Hoa hồng Sales = 5% tiền thực thu theo người tạo thẻ

## B. Đến hạn cho Telesales

- [x] B.1 `journeyDue` theo vùng + test kịch bản đa vùng
- [x] B.2 `/customers/journey`: tính ở server, phụ trách = Telesales của khách, "Đã hẹn" theo lịch hẹn sắp tới, nút chat
- [x] B.3 Bỏ tab Đến hạn ở `/cards`; modal Tạo tour chỉ tick sẵn DV đang đến hạn; ô Loại không xoá trống

## D. Lịch sử thao tác thẻ

- [x] D.1 Migration `card_audit.card_id` + ghi đổi ngày tour + cho `cards.view` đọc
- [x] D.2 `auditEntries` + test; mục Lịch sử thao tác trong drawer thẻ
- [x] D.3 Chạy migration `20261122160000_card_audit_history.sql` (2026-11-22, Supabase Lavian)

## Kiểm tra

- [x] tsc + eslint + node --test
- [x] memory-bank
- [x] Chạy migration `20261122150000_card_controls_commission.sql` (2026-11-22, Supabase Lavian)
- [ ] Xem trên trình duyệt (cần đăng nhập)
