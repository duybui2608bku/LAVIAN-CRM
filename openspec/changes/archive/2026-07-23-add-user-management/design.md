## Context

Dự án đã có Supabase SSR (publishable key) và `proxy.ts` mới chỉ refresh session. Cần thêm lớp xác thực + phân quyền + quản lý user, chạy trên Next.js 16 (proxy thay middleware, `cookies()` async). Ràng buộc: không tự đăng ký, admin đặt mật khẩu trực tiếp, mật khẩu chỉ sống trong `auth.users`. Quy mô người dùng dự kiến nhỏ (nội bộ CRM).

## Goals / Non-Goals

**Goals:**
- Khoá toàn bộ shell `app/(app)/` sau đăng nhập; chặn tài khoản bị khoá.
- Admin CRUD tối thiểu cho user (tạo/cấm/bỏ cấm/đặt lại mật khẩu/tìm) qua Admin API server-side.
- Mô hình dữ liệu `profiles` + RLS an toàn, migration chạy tay được.

**Non-Goals:**
- Self-service đăng ký / đổi / quên mật khẩu (cần SMTP) — để sau.
- Upload avatar (chỉ lưu `avatar_url` dạng chuỗi).
- Phân quyền chi tiết hơn 2 role, audit log, phân trang nâng cao.

## Decisions

### 1. Mật khẩu ở `auth.users`, metadata ở `profiles`
Dùng Supabase Auth làm nguồn sự thật cho email + mật khẩu; `profiles` chỉ giữ `role`, `status`, `user_name`, `avatar_url`, `email` (bản sao tiện truy vấn), `created_at`. **Không** tự hash/lưu mật khẩu. → Lý do: bảo mật, tránh phát minh lại xác thực. Phương án loại bỏ: bảng `users` tự quản mật khẩu — bị loại vì rủi ro bảo mật.

### 2. Thao tác admin qua client server-only (`SUPABASE_SECRET_KEY`)
Thêm `lib/supabase/admin.ts` tạo client bằng secret key, **chỉ import trong Server Action** (không `NEXT_PUBLIC`, không import ở client component). Tạo user: `auth.admin.createUser({ email, password, email_confirm: true, user_metadata })`. Đặt lại mật khẩu: `auth.admin.updateUserById(id, { password })`. → Lý do: `createUser` với mật khẩu + xác nhận sẵn bắt buộc service_role; chạy server-side nên không lộ key. Mỗi Server Action admin **phải tự kiểm tra** người gọi có `role=admin` trước khi dùng admin client (service_role bypass RLS).

### 3. Proxy đọc `role`+`status` từ `profiles` mỗi request
Sau `getClaims()`: nếu không có user và path không công khai → `/login`; nếu có user, truy vấn `profiles(role,status)` của chính họ (RLS cho phép đọc chính mình) rồi áp luật: `banned` → `/banned`; path admin mà `role≠admin` → `/`; đã đăng nhập mà vào `/login` → `/`.
→ Lý do: đơn giản, một nguồn sự thật, không cần cấu hình custom access-token hook.
`ponytail: truy vấn profiles mỗi request; nếu độ trễ thành vấn đề, nhồi role/status vào JWT qua access-token hook.`
Phương án loại bỏ: nhồi claim vào JWT ngay từ đầu — bị loại vì thêm hook + rủi ro claim cũ (stale) khi ban.

### 4. RLS tránh đệ quy bằng hàm `SECURITY DEFINER`
Policy "admin đọc/sửa mọi hồ sơ" nếu tự truy vấn `profiles` để biết ai là admin sẽ gây đệ quy vô hạn. Giải: hàm `public.is_admin()` `SECURITY DEFINER` đọc `profiles` bỏ qua RLS; policy admin gọi hàm này. Policy user thường: `id = auth.uid()`.
→ Phương án loại bỏ: đọc role từ JWT claim trong policy — cùng lý do như (3).

### 5. Trigger tự tạo `profiles` khi có user mới
Hàm `public.handle_new_user()` `SECURITY DEFINER` chạy sau INSERT trên `auth.users`: chèn dòng `profiles` với `email`, `user_name`/`avatar_url` lấy từ `raw_user_meta_data`, `role` mặc định `user`, `status` `active`. Nếu admin tạo tài khoản admin, Server Action cập nhật `role` sau khi tạo (không tin `role` từ metadata để tránh leo thang quyền — dù hiện chỉ admin mới tạo được user).
→ Lý do: một đường tạo hồ sơ nhất quán cho mọi user.

### 6. Đăng nhập/đăng xuất bằng Server Action + form
`/login` là trang công khai (ngoài `app/(app)/`), form react-hook-form + zod, submit qua Server Action `signInWithPassword`. Banned không chặn ở bước login (proxy là cổng duy nhất) — user bị khoá đăng nhập xong sẽ bị proxy đẩy sang `/banned`. Đăng xuất: Server Action `signOut` → `/login`.

### 7. Danh sách user: fetch server + lọc client
Trang `/users` (server component, chỉ admin) đọc toàn bộ `profiles` qua RLS admin; ô tìm kiếm lọc phía client theo `user_name`/email.
`ponytail: lọc client đủ cho quy mô nội bộ nhỏ; chuyển sang truy vấn ilike + phân trang nếu danh sách lớn.`

## Risks / Trade-offs

- **Truy vấn profiles mỗi request trong proxy** → thêm 1 round-trip DB/req. Mitigation: quy mô nhỏ chấp nhận được; upgrade path đã ghi ở (3).
- **Rò rỉ `SUPABASE_SECRET_KEY`** nếu lỡ import ở client → toàn quyền DB. Mitigation: đặt trong `lib/supabase/admin.ts` với chú thích "server-only", không prefix `NEXT_PUBLIC`, chỉ gọi trong Server Action đã kiểm tra `role=admin`.
- **Sai policy RLS gây đệ quy** → dùng `is_admin()` SECURITY DEFINER (đã xử lý ở (4)); kèm self-check trong migration comment.
- **Tin `role` từ user_metadata** có thể leo thang quyền nếu về sau mở self-registration. Mitigation: trigger luôn đặt `role=user`; nâng quyền chỉ qua Server Action admin.
- **`email` nhân bản giữa `auth.users` và `profiles`** có thể lệch. Mitigation: coi `auth.users` là nguồn sự thật; các thao tác đổi email (ngoài phạm vi) sẽ cần đồng bộ.

## Migration Plan

1. Chạy file `supabase/migrations/<timestamp>_user_management.sql` trong Supabase SQL Editor: tạo enum → bảng `profiles` → index → RLS + `is_admin()` → trigger `handle_new_user` (kèm backfill hồ sơ cho user đã có, nếu có).
2. Chạy đoạn seed cuối file: điền email của bạn để nâng thành `admin` (hoặc tạo admin đầu tiên qua Dashboard rồi chạy seed).
3. Điền `SUPABASE_SECRET_KEY` vào `.env.local`.
4. Rollback: `drop` bảng `profiles`, 2 enum, 2 function, trigger (ghi sẵn trong comment cuối file).

## Open Questions

- Không có — các quyết định đã chốt theo lựa chọn của người dùng (admin đặt mật khẩu trực tiếp; phạm vi không gồm self-service password).
