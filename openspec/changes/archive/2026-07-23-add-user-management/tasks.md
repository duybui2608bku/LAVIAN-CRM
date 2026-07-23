## 1. Database (migration copy tay)

- [x] 1.1 Tạo `supabase/migrations/<timestamp>_user_management.sql`: 2 enum `user_role` (admin|user) + `user_status` (active|banned) (bọc idempotent)
- [x] 1.2 Tạo bảng `public.profiles` (id uuid PK FK auth.users ON DELETE CASCADE, email, user_name, avatar_url, role, status, created_at) + index trên `user_name`, `email`
- [x] 1.3 Hàm `public.is_admin()` SECURITY DEFINER + bật RLS + policy: user đọc chính mình, admin đọc/sửa mọi hồ sơ
- [x] 1.4 Hàm `public.handle_new_user()` SECURITY DEFINER + trigger AFTER INSERT trên `auth.users` (điền email + user_name/avatar_url từ metadata, role=user, status=active) + backfill hồ sơ cho user đã có
- [x] 1.5 Đoạn seed cuối file: nâng 1 email thành `admin` (chú thích để người dùng tự điền) + block comment hướng dẫn rollback

## 2. Cấu hình & Supabase client

- [x] 2.1 Thêm `SUPABASE_SECRET_KEY` (server-only, không NEXT_PUBLIC) vào `.env.example` + `.env.local` (placeholder + chú thích)
- [x] 2.2 Tạo `lib/supabase/admin.ts`: client service_role, chú thích "SERVER-ONLY", export factory (+ `server-only` guard)
- [x] 2.3 Thêm `types/user.ts`: kiểu `Profile`, `UserRole`, `UserStatus`

## 3. Proxy (bảo vệ route)

- [x] 3.1 Viết lại `proxy.ts`: sau `getClaims()` phân nhánh — chưa đăng nhập + route bảo vệ → `/login`; đã đăng nhập vào `/login` → `/`
- [x] 3.2 Truy vấn `profiles(role,status)` của user hiện tại; `banned` → `/banned`; route `/users` mà `role≠admin` → `/`
- [x] 3.3 Khai báo route công khai (`/login`, `/banned`) + giữ matcher loại trừ tài nguyên tĩnh

## 4. Đăng nhập / đăng xuất

- [x] 4.1 Server Actions `lib/actions/auth.ts`: `signIn` (signInWithPassword, lỗi chung) + `signOut` (→ `/login`)
- [x] 4.2 Trang `app/login/page.tsx` + form client (react-hook-form + zod, shadcn) gọi `signIn`, toast lỗi
- [x] 4.3 Trang `app/banned/page.tsx`: thông báo tài khoản bị khoá + nút đăng xuất (gọi `signOut`)
- [x] 4.4 Nút/menu đăng xuất trên `AppHeader` (hiển thị user_name/email)

## 5. Quản lý user (admin)

- [x] 5.1 Server Actions `app/(app)/users/actions.ts`: `createUser`, `setUserStatus` (ban/unban), `resetPassword` — mỗi action kiểm tra người gọi `role=admin` trước khi dùng admin client
- [x] 5.2 Trang `app/(app)/users/page.tsx` (server, chỉ admin): fetch `profiles`, render bảng (shadcn table) email/tên/role/status/ngày tạo
- [x] 5.3 Ô tìm kiếm (client) lọc theo `user_name`/email; nút "Tạo user" mở dialog form (email, mật khẩu, tên, avatar_url, checkbox admin)
- [x] 5.4 Hành động mỗi dòng: Cấm/Bỏ cấm, Đặt lại mật khẩu (dialog nhập mật khẩu mới) — Server Action + `router.refresh()` + toast (bỏ React Query — đơn giản hơn cho dữ liệu SSR)
- [x] 5.5 Thêm mục "Người dùng" vào sidebar (chỉ hiện với admin)

## 6. i18n & hoàn thiện

- [x] 6.1 Thêm namespace `auth` + `users` (+ `nav.users`) vào `messages/{vi,en,id}.json`
- [x] 6.2 `next build` PASS; smoke test proxy: chưa-login `/` & `/users` → 307 `/login`, `/login` & `/banned` render đúng. ⏳ Luồng đăng nhập/tạo/cấm/reset cần người dùng chạy migration + điền `SUPABASE_SECRET_KEY` rồi thử tay.
- [x] 6.3 Rà soát ponytail (không React Query thừa, proxy có ceiling ghi chú) + cập nhật `memory-bank/README.md`
