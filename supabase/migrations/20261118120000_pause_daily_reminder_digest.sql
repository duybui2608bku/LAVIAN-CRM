-- Mục đích: TẠM TẮT tính năng nhắc hẹn — dừng cron `daily-reminder-digest` (8:00 VN) để không tạo
-- thông báo "hôm nay N lịch nhắc" trong lúc giao diện nhắc hẹn đang ẩn (REMINDERS_ENABLED = false).
-- Chạy sau: 20261118090000_customer_reminders_notifications.sql. Chạy lại an toàn.
-- Bật lại: đổi `active := false` thành `active := true` rồi chạy lại.
select cron.alter_job(jobid, active := false)
from cron.job
where jobname = 'daily-reminder-digest';
