# Tasks: appointment-visit-status

## 1. Database

- [x] 1.1 Migration `20261119120000_appointment_visit_status.sql`: cột `visit_status` + backfill, trigger BEFORE đồng bộ `checked_in`, tạo lại trigger Show-up bắt `visit_status`, trigger log theo dõi `visit_status`

## 2. Backend

- [x] 2.1 `types/appointment.ts`: `VISIT_STATUSES`, màu, `visit_status` vào `Appointment` / `AppointmentPatch` / log field
- [x] 2.2 `lib/appointments.ts`: schema `visit_status` thay `checked_in`; helper `nearestByCustomer` dùng chung
- [x] 2.3 Actions `/appointments`: gác Sales theo `visit_status`

## 3. Frontend

- [x] 3.1 `/appointments`: cột Status 5 trạng thái + bộ lọc
- [x] 3.2 `/customers`: cột Sales Status sau Stage
- [x] 3.3 `/customers/potential`: tải lịch hẹn, cột Sales Status sau Status
- [x] 3.4 Drawer lịch sử hiển thị thay đổi Status; i18n vi/en

## 4. Kiểm chứng

- [x] 4.1 tsc + eslint + 89 test sạch
- [x] 4.2 Chạy migration trên Supabase Lavian (2026-11-19 qua MCP; backfill 3 lịch đã đến → arrived, 0 lệch; thử trong khối rollback 5 tình huống đều đúng)
- [ ] 4.3 Xem trên trình duyệt
