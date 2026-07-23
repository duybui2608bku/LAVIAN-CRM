# Proposal: login-remember-password

## Why

Nhân viên phải gõ lại email + mật khẩu mỗi lần đăng nhập. Cần "Ghi nhớ đăng nhập" để lần sau mở `/login` là form đã điền sẵn, bấm Đăng nhập là xong.

## What Changes

- Form `/login` thêm checkbox "Ghi nhớ đăng nhập" (mặc định tick). Đăng nhập với checkbox tick → lưu email + mật khẩu vào `localStorage`; bỏ tick → xoá đã lưu.
- Lần sau mở `/login`: form prefill từ `localStorage` (react-hook-form defaultValues, uncontrolled nên không lệch hydration).
- i18n key `auth.rememberMe` (vi/en/id).
- KHÔNG đổi backend/session — Supabase session vốn đã persist qua cookie; đây chỉ là prefill form.

## Capabilities

### Modified Capabilities
- `authentication`: thêm requirement ghi nhớ thông tin đăng nhập trên form login.

## Impact

- Sửa: `components/auth/login-form.tsx`, `messages/{vi,en,id}.json`.
- Bảo mật: mật khẩu lưu **plaintext trong localStorage** của trình duyệt (đánh đổi có chủ đích cho tiện dụng nội bộ — đã ghi comment `ponytail:`); máy dùng chung thì bỏ tick. Nâng cấp sau nếu cần: bỏ hẳn, dựa vào password manager của trình duyệt (form đã có `autocomplete` đúng chuẩn).
