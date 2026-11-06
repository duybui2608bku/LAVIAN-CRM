## 1. Data model

- [x] 1.1 Migration thêm `service_detail`, `service_session`, `bill_amount` vào `clinic_appointments` kèm check constraint

## 2. Logic & server

- [x] 2.1 `lib/appointments.ts`: schema patch có 3 trường mới + hàm `tourRate`/`tourAmount`; cập nhật test
- [x] 2.2 Type `Appointment`, query trang `/appointments` nạp 3 cột mới

## 3. UI

- [x] 3.1 `InlineSelect` hỗ trợ option nhóm + tìm kiếm
- [x] 3.2 Bảng lịch hẹn: cột Dịch vụ chi tiết, Bill (inline), Tour (chỉ đọc)
- [x] 3.3 Drawer tạo lịch hẹn: thêm Dịch vụ chi tiết + Bill
- [x] 3.4 i18n vi/en

## 4. Verification

- [x] 4.1 Chạy migration trên Supabase, tsc/lint/test, ghi memory-bank
