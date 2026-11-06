## 1. Database

- [x] 1.1 Migration `tours` (bảng, index, RLS, trigger khoá xác nhận, chép dữ liệu cũ)
- [x] 1.2 Migration xoá 5 cột tour khỏi `clinic_appointments` (chạy sau deploy)

## 2. Lịch hẹn

- [x] 2.1 Gỡ thanh toán/KTV/dịch vụ chi tiết/bill/tour khỏi types, schema, actions, page, manager, test
- [x] 2.2 `deleteService` chặn khi còn tour

## 3. Tour

- [x] 3.1 `lib/tours.ts` (+test): schema patch, tỷ lệ, thực thu, trạng thái
- [x] 3.2 Server actions: tạo, nhận, trả, sửa, xác nhận, xoá
- [x] 3.3 Page `/tour` theo vai trò; menu "Tour"
- [x] 3.4 Drawer tour + ô chụp ảnh (camera, nén, lưu ngay)
- [x] 3.5 KTV: tab Chờ nhận / Tour của tôi (thẻ, mobile)
- [x] 3.6 Admin/CSKH: bảng, lọc, xác nhận, Excel + phiếu PDF
- [x] 3.7 i18n vi/en

## 4. Verification

- [ ] 4.1 test, tsc, lint, build; xem trên preview; memory-bank
