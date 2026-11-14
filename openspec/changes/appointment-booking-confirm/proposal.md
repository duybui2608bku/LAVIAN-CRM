## Why

Khách đặt lịch xong, vài ngày sau CSKH liên hệ lại để chắc khách còn nhu cầu và đến đúng ngày. Cần đánh dấu
lịch hẹn "Đã xác nhận / Chưa xác nhận" để theo dõi và sau này thống kê (tỉ lệ xác nhận, xác nhận → đến).

## What Changes

- DB: cột mới `clinic_appointments.booking_confirm boolean not null default false` (lịch cũ = chưa xác nhận).
  Trigger log `log_clinic_appointment_change` theo dõi thêm `booking_confirm` (ai xác nhận, lúc nào → dùng cho thống kê).
  Migration `20261114090000_appointment_booking_confirm.sql`.
- `/appointments`: cột "Xác nhận lịch" (sửa inline Đã xác nhận / Chưa xác nhận, Tag xanh / cam) đặt sau cột Ngày giờ;
  bộ lọc toolbar theo trạng thái xác nhận. Form tạo lịch không có ô này (lịch mới luôn chưa xác nhận).
- `/customers` drawer lịch sử lịch hẹn: hiển thị thay đổi trường `booking_confirm`.
- Form SMAX: không đổi (insert dùng default `false`).

## Impact

- `supabase/migrations/20261114090000_appointment_booking_confirm.sql`, `lib/appointments.ts`, `types/appointment.ts`,
  `app/(app)/appointments/page.tsx`, `components/appointments/appointments-manager.tsx`,
  `components/customers/appointment-history-drawer.tsx`, `messages/{en,vi}.json`.
- Chạy migration TRƯỚC khi deploy code (trang `/appointments` select cột mới).
