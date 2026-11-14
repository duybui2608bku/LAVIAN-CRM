## 1. Database

- [x] 1.1 Migration `20261114120000_leader_telesales_report.sql`: booking_confirm → text 4 trạng thái (+ log cũ),
      đổi tên enum bộ phận, `profiles.smax_user_id` + seed, quyền `telesales.view` cho `telesales_leader`

## 2. Bộ lọc ngày dùng chung

- [x] 2.1 `lib/date-presets.ts` (+ test): mốc ngày thuần string, tuần từ thứ Hai
- [x] 2.2 `DateRangePicker` có presets; `DateRangeFilter` (Segmented + picker) cho trang báo cáo
- [x] 2.3 Áp dụng: `/reports`, `/marketing`, `/customers`, `/appointments` (khoảng ngày hẹn)

## 3. Lịch hẹn + bộ phận + người dùng

- [x] 3.1 `types/appointment.ts` BOOKING_STATUSES; zod; cột/bộ lọc `/appointments`; drawer lịch sử
- [x] 3.2 Đổi `customer_care*` → `telesales*` trong code + i18n
- [x] 3.3 `/users`: cột "ID SMAX" sửa inline (admin), action `setUserSmaxId`

## 4. Báo cáo Leader Telesales

- [x] 4.1 Quyền `telesales.view` + route `/reports/telesales` + menu con Báo cáo
- [x] 4.2 `fetchSmaxHandledConversations` (lib/marketing.ts)
- [x] 4.3 `lib/telesales-report.ts` tính số liệu thuần (+ test)
- [x] 4.4 Server action `getTelesalesReport` + trang UI (thẻ, phễu, xu hướng, nguồn, phản hồi, bảng NV, cảnh báo)

## 5. Kiểm tra

- [x] 5.1 tsc + eslint + node --test + next build
- [x] 5.2 Dry-run migration trên DB thật (chạy 2 lần trong 1 khối rồi raise để rollback) — OK, DB nguyên trạng
- [x] 5.3 Memory bank
