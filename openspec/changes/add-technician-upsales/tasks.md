## 1. Data model

- [x] 1.1 Tạo migration `appointment_upsales` với FK, ràng buộc số tiền, index, RLS và grants

## 2. Server and types

- [x] 2.1 Mở rộng type/query/normalizer lịch hẹn để nạp các record upsale con và tính tổng
- [x] 2.2 Thêm server actions tạo và xóa upsale với validation trạng thái, kỹ thuật viên và quyền xóa

## 3. User interface

- [x] 3.1 Thêm dialog upsale tại hàng thao tác lịch hẹn, gồm tổng tiền, danh sách, thêm và xóa
- [x] 3.2 Bổ sung nhãn upsale cho các locale hiện có

## 4. Verification

- [x] 4.1 Thêm test helper tổng upsale và chạy test/lint/typecheck/build phù hợp
- [x] 4.2 Validate OpenSpec strict và kiểm tra diff cuối

## 5. Requirement adjustments

- [x] 5.1 Cho phép mọi user đăng nhập tạo upsale ở lịch hợp lệ tại RLS, server action và UI
- [x] 5.2 Thêm server action và select inline cập nhật kỹ thuật viên trên bảng lịch hẹn
- [x] 5.3 Cập nhật bản dịch và chạy lại toàn bộ validation

## 6. Upsale service

- [x] 6.1 Bổ sung `service_id` bắt buộc vào migration, type và server validation
- [x] 6.2 Thêm select dịch vụ độc lập và nhãn dịch vụ trong dialog upsale
- [x] 6.3 Cập nhật test, bản dịch và chạy lại toàn bộ validation

## 7. Migration correction

- [x] 7.1 Hỗ trợ nâng cấp bảng upsale đã tồn tại và định danh rõ cột ngoài trong policy RLS

## 8. UI correction

- [x] 8.1 Render người tạo upsale dưới dạng JSX thay vì ép React element thành chuỗi

## 9. Upsale payment

- [x] 9.1 Gắn upsale với sổ và cộng upsale vào Tổng giá, công nợ, giới hạn thu tiền
- [x] 9.2 Bổ sung test và cập nhật OpenSpec theo hợp đồng thanh toán mới

## 10. API compatibility

- [x] 10.1 Bỏ nested relation chưa tồn tại và gom upsale theo `appointments.ledger_id`
