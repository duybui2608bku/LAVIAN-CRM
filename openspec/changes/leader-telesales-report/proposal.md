## Why

Leader Telesales cần 1 trang theo dõi hiệu suất đội Telesales theo ngày/tuần/tháng: tin nhắn vào, booking,
xác nhận lịch, khách đến, khách hủy/đổi lịch, phễu chuyển đổi, nguồn booking và hiệu suất từng nhân viên
(hội thoại xử lý trên SMAX ↔ booking trong CRM, so với KPI booking 12%).

## What Changes

- **Bộ lọc ngày dùng chung** (`lib/date-presets.ts` + `DateRangeFilter`): Hôm nay, Hôm qua, Tuần này, Tuần trước
  (tuần bắt đầu thứ Hai), 7 ngày, 30 ngày, Tháng này, Tháng trước, Tùy chỉnh. `DateRangePicker` có sẵn các mốc
  này trong popup → áp dụng ở `/reports`, `/reports/telesales`, `/marketing`, `/customers`; `/appointments` đổi
  bộ lọc 1 ngày thành khoảng ngày (theo ngày hẹn).
- **Trạng thái xác nhận lịch 4 giá trị**: `clinic_appointments.booking_confirm` boolean → text
  `pending` (Chờ xác nhận) · `confirmed` (Đã xác nhận) · `cancelled` (Khách hủy) · `rescheduled` (Đổi lịch).
  Dữ liệu cũ + log lịch sử chuyển `true→confirmed`, `false→pending`.
- **Đổi tên bộ phận** `customer_care` → `telesales`, `customer_care_leader` → `telesales_leader` (giá trị enum DB).
- **Ghép nhân viên SMAX**: cột `profiles.smax_user_id` (unique), admin sửa inline ở `/users`; seed 3 nhân viên.
- **Quyền mới** `telesales.view` (module "Leader Telesales", route `/reports/telesales`), seed cho `telesales_leader`.
- **Menu "Báo cáo" thành menu cha**: Tổng quan (`/reports`, quyền `reports.view`) + Leader Telesales
  (`/reports/telesales`, quyền `telesales.view`).
- **Trang `/reports/telesales`**:
  - 6 thẻ (so với kỳ liền trước cùng số ngày): Tin nhắn (FB Ads), Booking, Booking mới, Đã xác nhận,
    Khách đến (+ Show-up), Khách hủy/Đổi lịch.
  - Phễu: Tin nhắn → Booking → Đã xác nhận → Khách đến (tầng "Khách tiềm năng" tạm ẩn).
  - Xu hướng theo ngày (Booking, Khách đến), Booking theo nguồn (donut), Tốc độ phản hồi = "Đang cập nhật".
  - Bảng hiệu suất Telesales: Hội thoại (SMAX `handled_conversations`), Booking, Tỉ lệ Booking, Show-up,
    Hoàn thành KPI (= tỉ lệ booking / 12%), dòng "Khác / chưa gán" + dòng Tổng. Bỏ cột SLA.
  - Cảnh báo & công việc cần xử lý = "Đang cập nhật". Section KPI tổng quan tạm ẩn.

## Định nghĩa số liệu (ngày theo giờ VN, kỳ = [from, to])

| Chỉ số | Cách tính |
|---|---|
| Tin nhắn | Σ `messaging_conversation_started_7d` FB Ads (2 tài khoản) trong kỳ |
| Booking | Lịch hẹn (chưa xoá, khách chưa xoá) có **ngày tạo** trong kỳ |
| Booking mới | Booking mà **khách được tạo trong kỳ** |
| Đã xác nhận | Booking có trạng thái `confirmed` |
| Khách hủy / Đổi lịch | Booking có trạng thái `cancelled` / `rescheduled` |
| Khách đến | Lịch có **ngày hẹn** trong kỳ và đã check-in |
| Show-up | Khách đến / lịch có ngày hẹn trong kỳ |
| Tỉ lệ booking | Booking / Tin nhắn (thẻ) · Booking / Hội thoại SMAX (bảng nhân viên) |
| Hoàn thành KPI | Tỉ lệ booking / 12% |

Booking/Khách đến của nhân viên tính theo `clinic_appointments.staff_id`.

## Impact

- Migration `20261114120000_leader_telesales_report.sql` — **đổi giá trị enum + kiểu cột**: code cũ và code mới
  KHÔNG chạy được với DB của nhau → chạy migration NGAY khi deploy code mới (cùng lúc merge).
- `lib/{date-presets,telesales-report,permissions,appointments,marketing}.ts` (+ test), `types/{user,appointment}.ts`,
  `components/common/{date-picker,date-range-filter}.tsx`, `components/layout/app-shell.tsx`,
  `components/reports/*`, `components/appointments/appointments-manager.tsx`,
  `components/customers/{customers-manager,appointment-history-drawer}.tsx`, `components/users/*`,
  `app/(app)/reports/telesales/*`, `app/(app)/users/actions.ts`, `messages/{en,vi}.json`.
- Env: dùng `FB_TOKEN`, `SMAX_TOKEN` sẵn có.
