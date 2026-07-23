## Why

LAVIAN-CRM chưa có bất kỳ cơ chế đăng nhập hay phân quyền nào — mọi trang trong shell `app/(app)/` đang mở công khai. Đây là tính năng nghiệp vụ đầu tiên: nền tảng xác thực + quản lý người dùng để khoá ứng dụng lại và cho admin cấp/kiểm soát tài khoản. Mọi tính năng CRM về sau đều phụ thuộc vào lớp này.

## What Changes

- **Bảng `public.profiles`** ánh xạ 1-1 với `auth.users`: `user_name`, `avatar_url`, `role` (`admin` | `user`), `status` (`active` | `banned`), `email`, `created_at`. Mật khẩu **không** lưu ở đây — sống trong `auth.users` do Supabase Auth quản lý.
- **Đăng nhập / đăng xuất** bằng email + mật khẩu (Supabase Auth, session qua cookie SSR). **BREAKING**: không có luồng tự đăng ký — chỉ admin tạo tài khoản.
- **Admin tạo user** qua Supabase Admin API chạy phía server (secret key server-only), đặt mật khẩu trực tiếp, `email_confirm=true`.
- **Trang quản lý user** (chỉ admin): danh sách, tạo user, cấm/bỏ cấm, nút đặt lại mật khẩu nhanh, lọc tìm theo `user_name` & email.
- **Proxy (`proxy.ts`)** nâng cấp từ chỉ-refresh-session thành cổng bảo vệ: chưa đăng nhập → `/login`; `status=banned` → `/banned`; route admin chỉ cho `role=admin`.
- **Trang `/banned`** ("Tài khoản bị khoá" + nút đăng xuất) và **trang `/login`**.
- **Migration SQL** trong `supabase/migrations/` (enum, bảng, RLS, index, trigger auto-tạo profile, seed admin) để copy vào Supabase SQL Editor.
- **Env mới**: `SUPABASE_SECRET_KEY` (server-only) cho Admin API.

## Capabilities

### New Capabilities
- `authentication`: đăng nhập/đăng xuất bằng email+mật khẩu, quản lý session SSR, bảo vệ route qua proxy (chặn chưa-đăng-nhập, chặn banned, giới hạn route admin theo role).
- `user-management`: admin tạo user, cấm/bỏ cấm, đặt lại mật khẩu, xem danh sách và lọc tìm; mô hình dữ liệu `profiles` (role + status) và RLS.

### Modified Capabilities
<!-- Không có: chưa tồn tại spec nào trong openspec/specs/. -->

## Impact

- **Mã nguồn:** `proxy.ts` (viết lại logic bảo vệ), `lib/supabase/` (thêm `admin.ts` server-only), route mới `app/login/`, `app/banned/`, `app/(app)/users/`, Server Actions cho auth + quản lý user, `components/` cho form/bảng.
- **Database:** bảng mới `public.profiles` + 2 enum + RLS + trigger + index (file migration để chạy tay).
- **Cấu hình:** `.env.example` / `.env.local` thêm `SUPABASE_SECRET_KEY`; `messages/{vi,en,id}.json` thêm namespace `auth` + `users`.
- **Phụ thuộc:** không thêm package mới (dùng `@supabase/*`, `react-hook-form`, `zod`, shadcn, React Query đã có).
- **Ngoài phạm vi:** self-service đổi/quên mật khẩu (cần SMTP), upload avatar (chỉ lưu `avatar_url`).
