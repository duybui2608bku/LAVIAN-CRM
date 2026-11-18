# Tasks: customer-reminders

## 1. Database
- [x] 1.1 Migration `customer_reminders` + `notifications` + RLS + realtime + trigger giao việc + `pg_cron` 8h

## 2. Lịch nhắc ở Booking management
- [x] 2.1 `types/reminder.ts`, server actions `app/(app)/customers/reminders/actions.ts`
- [x] 2.2 `components/reminders/*`: form modal, item, drawer theo khách
- [x] 2.3 Cột Nhắc hẹn trong `customers-manager.tsx` (chỉ trang bookings), nạp dữ liệu ở `customers-view.tsx`

## 3. Trang calendar
- [x] 3.1 `app/(app)/customers/reminders/page.tsx` + `components/reminders/reminders-calendar.tsx` + menu sidebar

## 4. Thông báo
- [x] 4.1 `notification-bell.tsx` realtime + đánh dấu đã đọc; truyền `userId` từ layout

## 5. Kiểm chứng
- [x] 5.1 i18n vi/en (repo chỉ còn 2 locale), tsc + eslint + test
- [x] 5.2 Chạy migration trên Supabase
- [ ] 5.3 Xem tay
