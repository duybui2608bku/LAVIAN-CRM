# Proposal: customer-reminders

## Why

Khách Booking/Deposited hay quên giờ đến cơ sở. Nhân viên cần **lịch nhắc hẹn** để chủ động nhắn khách đúng lúc, một **lịch (calendar)** để xem mọi lịch nhắc theo ngày/nhân viên, và **thông báo** mỗi sáng để không bỏ sót.

## What Changes

- **DB:** bảng `customer_reminders` (khách, thời điểm nhắc, nội dung tin nhắn, đã xong). Bảng `notifications` (mỗi user, đã đọc) + publication Realtime. `pg_cron` chạy 8h sáng (giờ VN) tạo thông báo "hôm nay có N lịch nhắc (M quá hạn)" cho Telesales phụ trách khách. Trigger báo Telesales của khách khi người khác tạo lịch nhắc. **Thông báo chỉ gửi Telesales phụ trách khách** (`customers.staff_id`, đang hoạt động, bộ phận Telesales).
- **`/customers/bookings`:** cột **Nhắc hẹn** (lịch nhắc kế tiếp + số lịch chưa xong) → drawer lịch nhắc của khách: thêm/sửa/xoá, đánh dấu xong, mở hội thoại SMAX, sao chép tin nhắn.
- **Trang mới `/customers/reminders`** (menu con của Khách hàng): calendar tháng, chip lịch nhắc theo ngày; panel danh sách ngày đang chọn; bộ lọc nhanh Hôm nay / Quá hạn / Sắp tới, lọc nhân viên ("Của tôi"), trạng thái, tìm khách.
- **Chuông header:** danh sách thông báo thật, badge chưa đọc, cập nhật realtime, bấm mở trang lịch nhắc.

## Capabilities

### New Capabilities
- `customer-reminders`: lịch nhắc hẹn, trang calendar, thông báo realtime.

## Impact

- `supabase/migrations/20261118090000_customer_reminders_notifications.sql`, `20261118100000_reminders_notify_customer_telesales.sql`
- `app/(app)/customers/reminders/` (page + actions), `app/(app)/customers/customers-view.tsx`
- `components/reminders/*`, `components/customers/customers-manager.tsx`
- `components/layout/notification-bell.tsx`, `components/layout/app-shell.tsx`, `app/(app)/layout.tsx`
- `messages/{vi,en}.json`, `types/reminder.ts`
