# Design: customer-reminders

## Dữ liệu
- `customer_reminders(id, customer_id → customers on delete cascade, assignee_id → profiles set null, remind_at timestamptz, note text, done_at, created_by default auth.uid(), created_at)`. Xoá cứng. RLS: profile active toàn quyền (giống customers).
- `notifications(id, user_id → profiles cascade, kind text, data jsonb, link text, read_at, created_at)`. Chữ hiển thị dựng ở client theo `kind` + `data` (đủ 3 ngôn ngữ). RLS: chỉ đọc/cập nhật dòng của mình; không ai insert trực tiếp — chỉ function `security definer`.
- Realtime: `alter publication supabase_realtime add table notifications` (Realtime tôn trọng RLS → mỗi user chỉ nhận dòng của mình).

## Thông báo
- `notify_daily_reminders()` — gom theo `assignee_id` các lịch chưa xong có ngày (giờ `Asia/Ho_Chi_Minh`) = hôm nay hoặc quá hạn; chỉ tạo thông báo khi có lịch hôm nay hoặc quá hạn. `cron.schedule('daily-reminder-digest', '0 1 * * *')` = 8:00 giờ VN.
- Trigger `after insert or update of assignee_id` → `reminder_assigned` khi người giao ≠ người nhận.
- Client: chuông tải 20 thông báo mới nhất, subscribe `postgres_changes INSERT` lọc `user_id=eq.<uid>`; mở popover → đánh dấu đã đọc tất cả.

## UI
- Bookings: cột `reminder` ngay sau Lịch hẹn. Tag lịch nhắc kế tiếp (đỏ quá hạn / cam hôm nay / xanh sắp tới), badge số lịch chưa xong. Drawer `CustomerRemindersDrawer` = danh sách + nút thêm (Modal form).
- Form: thời điểm (DatePicker showTime như AppointmentDate), người phụ trách (telesales; mặc định = CSKH của khách, không có thì chính mình), nội dung tin nhắn (mặc định mẫu có tên khách + giờ hẹn kế tiếp). Gợi ý giờ nhắc: 1 ngày trước lịch hẹn 9:00 nếu còn ở tương lai, không thì 1 giờ sau.
- Trang calendar: antd `Calendar` (desktop: chip trong ô ngày; điện thoại: chấm + số), panel phải danh sách ngày đã chọn dùng chung `ReminderItem` với drawer.
- Lọc client-side (dữ liệu nhỏ, cùng triết lý `/customers`).

## Không làm (ponytail)
- Không push/email, không thông báo từng phút theo giờ nhắc, không lặp lịch nhắc định kỳ. Thêm khi cần.
