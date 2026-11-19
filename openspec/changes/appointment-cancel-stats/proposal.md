## Why

Sales Management (`/appointments`): Status lịch hẹn mới có 5 bước, thiếu **Hủy lịch** (khách báo không đến nữa). Sếp muốn thêm dải số liệu trên bảng (theo ảnh mẫu): Tổng khách hàng, Khách đã đến, Hủy / Đổi lịch, Chưa đến, Giá trị dịch vụ, Tổng thực thu, Còn phải thu (triệu IDR).

## What Changes

- `visit_status` thêm `cancelled` (Hủy lịch, tag đỏ). Không tính là đã đến (`checked_in = false`), giống Chưa đến / Đổi lịch.
- Dải 7 thẻ số liệu (`StatCard`) trên thanh lọc, **tính theo bộ lọc đang áp** (ngày, tìm, trạng thái, xác nhận lịch):
  - Tổng khách hàng = số lịch hẹn; Khách đã đến = arrived/in_progress/done; Hủy / Đổi lịch = cancelled + rescheduled; Chưa đến = waiting.
  - Giá trị dịch vụ = Σ `bill_amount`; Tổng thực thu = Σ (Deposit khách + `paid_amount`); Còn phải thu = Σ max(Giá trị DV − Thực thu, 0). Hiện theo **triệu IDR**, 1 số lẻ.
- Hàm thuần `appointmentStats` ở `lib/appointments.ts` (+test), dùng chung công thức với drawer Sửa lịch hẹn (`appointmentMoney`).

## Impact

- Migration `supabase/migrations/20261119140000_appointment_visit_cancelled.sql` (check constraint + trigger `sync_appointment_checked_in`). Chạy trước khi deploy.
- Sửa: `types/appointment.ts`, `lib/appointments.ts` (+test), `components/appointments/{appointments-manager,appointment-drawer}.tsx`, `messages/{vi,en}.json`.
- Deposit là của khách → khách có nhiều lịch trong bộ lọc thì Deposit được cộng mỗi lịch.
