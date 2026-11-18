# Proposal: lead-form-remember-telesales

## Why

`/lead-form` nhúng trong Smax không có đăng nhập → mỗi lần mở form, Telesales phải chọn lại tên mình. Cần nhớ lựa chọn trên máy để lần sau khỏi chọn.

## What Changes

- Người dùng tự chọn Telesales trên form → lưu id vào `localStorage` (key `lavian-lead-staff`).
- Mở form / đổi khách / bấm "Gửi tiếp" → ô Telesales tự điền giá trị đã lưu (nếu người đó còn trong danh sách Telesales).
- Khách đã có trong CRM và đã có CSKH → vẫn hiện CSKH hiện tại (không ghi đè bằng giá trị đã lưu, tránh vô tình đổi người phụ trách khi Cập nhật). Khách chưa có CSKH → dùng giá trị đã lưu.
- Lưu theo trình duyệt từng máy (trong iframe Smax là kho riêng theo smax.ai). Không đổi backend.

## Capabilities

### Modified Capabilities
- `public-lead-form`: thêm requirement ghi nhớ Telesales.

## Impact

- `components/lead-form/lead-form.tsx`
