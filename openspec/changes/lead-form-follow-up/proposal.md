# Proposal: lead-form-follow-up

## Why

Sếp làm rõ: ngày giờ chọn ở lead form khi khách là **Tiềm năng / Cân nhắc** là **lịch nhắc follow-up** (Telesales liên hệ lại), KHÔNG phải lịch hẹn tới chi nhánh. Bản trước tạo `clinic_appointments` cho 2 stage này → khách chưa chốt hiện ở Booking management / Lịch hẹn.

## What Changes

- Lead form: stage Tiềm năng / Cân nhắc → ô **Lịch nhắc follow-up** (bắt buộc, điền sẵn từ CRM) lưu `customers.follow_up_at`; ẩn Ngày hẹn + Nhóm dịch vụ, không tạo lịch hẹn. Stage khác giữ ô Ngày hẹn (bắt buộc khi vừa chọn Booking).
- `/customers/potential` gộp stage Cân nhắc (tag "Cân nhắc" ở cột Tình trạng); "Chuyển đổi đặt lịch" áp cho cả 2 stage.
- Cron báo đúng giờ + digest 8:00 quét cả `consider` (migration `20261118150000_follow_up_include_consider.sql`).

## Impact

- `lib/customer-options.ts`, `app/lead-form/actions.ts`, `components/lead-form/lead-form.tsx`, `app/(app)/customers/{actions.ts,potential/page.tsx}`, `components/customers/potential-manager.tsx`, `messages/{vi,en}.json`, migration mới.
