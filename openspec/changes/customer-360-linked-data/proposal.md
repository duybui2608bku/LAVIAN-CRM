# Proposal: customer-360-linked-data

## Why

Popup hồ sơ 360° (Giai đoạn 1) chỉ đọc lịch hẹn: tab Tài chính còn cộng `clinic_appointments.bill_amount/paid_amount` (đã bỏ khỏi UI từ khi có Thẻ liệu trình), tab Ảnh B/A chỉ có ảnh cũ ở `appointment_photos` (không còn chỗ tải mới). Dữ liệu thật của khách giờ nằm ở **thẻ liệu trình** (dịch vụ đã mua, số buổi, thanh toán, cọc trừ vào thẻ) và **tour** (buổi làm, ảnh trước/sau). Sếp cần hồ sơ gom **cả vòng đời khách** bằng cách nối các bảng theo `customer_id`.

## What Changes

- `getCustomer360` tải thêm `treatment_cards` (+ items, payments) và `tours` của khách theo `customer_id`. Không đổi DB: RLS hiện có đã chặn theo quyền (`cards.*`, `tour.*`).
- **Dịch vụ & Upsell:** thêm mục **Dịch vụ đã mua** (từ thẻ): tên DV, nhóm, mã thẻ, đã dùng x/y buổi (đếm tour gắn dòng thẻ), DV đã hoàn gạch ngang.
- **Tài chính** (chỉ admin / Sales / Leader Telesales như cũ) lấy hoàn toàn từ thẻ:
  - Tổng tích luỹ: Giá trị thẻ · Đã thu · Công nợ (thẻ chưa huỷ, công thức `cardMoney`); cọc chưa trừ vào thẻ cộng vào Đã thu; chưa có thẻ mà có cọc → Công nợ "Chưa xác định".
  - Danh sách thẻ: mã, ngày bán, trạng thái, giá trị / đã thu / công nợ.
  - Lịch sử thanh toán: tiền cọc (+ ảnh xác nhận chuyển khoản `payment_confirm_url`), từng lần thu ở thẻ (ngày, hình thức Tiền mặt/Chuyển khoản/Thẻ, mã thẻ, ghi chú, ảnh bill, số tiền; âm = hoàn khách).
- **Ảnh B/A:** gom ảnh Trước / Sau / Thêm của **tour** (theo ngày tour · dịch vụ · Lần) + ảnh cũ ở lịch hẹn.
- **Tổng quan:** thêm mục **Tour** (ngày, DV, Lần, Master, đã xác nhận).
- **Lịch sử & Ghi chú:** thêm 2 loại vào dòng thời gian: **Thẻ** (bán thẻ, thu / hoàn tiền) và **Tour**.
- Bỏ đọc `bill_amount/paid_amount` lịch hẹn ở hồ sơ; `customerFinance` (theo lịch hẹn) thay bằng `customerCardMoney` (`lib/cards.ts`, có test) + `currentAppointment` (nút "Chuyển sang nhập liệu").

## Non-goals

Sửa thẻ / tour từ popup (vẫn mở drawer thẻ, trang Tour), mở drawer thẻ từ popup, tab CSKH.

## Impact

- Server: `app/(app)/customers/customer-360-actions.ts`.
- Lib: `lib/cards.ts` (+test), `lib/customer-360.ts` (+test).
- UI: `components/customers/customer-360/{profile-tabs,activity-tabs,customer-360-modal}.tsx`.
- Types / i18n: `types/customer-360.ts`, `messages/{vi,en}.json`.
- Không đổi DB.
