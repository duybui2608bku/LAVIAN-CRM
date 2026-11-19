# Tasks: appointment-finance-master

## 1. Database

- [x] 1.1 Migration `20261119110000_appointment_bill_technician.sql`: cột `bill_amount`, `technician_id` (+ index), trigger log theo dõi 2 cột mới

## 2. Backend

- [x] 2.1 `types/appointment.ts`: `bill_amount`, `technician_id` vào `Appointment`, `AppointmentPatch`, `AppointmentLogField`
- [x] 2.2 `lib/appointments.ts`: schema nhận 2 field; `validateReferences` kiểm KTV bộ phận `technician`
- [x] 2.3 Action `getCustomerDetail(customerId)` (gác `appointments.view`)
- [x] 2.4 Page `/appointments` select 2 cột mới + `deposit_amount` của khách

## 3. Frontend

- [x] 3.1 Ẩn cột Telesales, bỏ cột Nhóm DV → nhóm DV sau SĐT (sửa inline)
- [x] 3.2 Cột Tài chính (Deposit + Giá trị DV sửa inline) và cột Master
- [x] 3.3 `CustomerInfoDrawer` + icon mở ở ô Khách hàng
- [x] 3.4 Drawer lịch sử lịch hẹn hiển thị Master / Giá trị DV
- [x] 3.5 i18n vi/en

## 4. Kiểm chứng

- [x] 4.1 tsc + eslint + 87 test sạch (test schema cũ "không nhận technician_id/bill_amount" đổi theo quy tắc mới)
- [x] 4.2 Chạy migration trên Supabase Lavian (2026-11-19 qua MCP; thử trong khối rollback: sửa bill sinh log, số âm bị chặn)
- [ ] 4.3 Xem trên trình duyệt
