@AGENTS.md

# Quy tắc dự án LAVIAN-CRM

## 1. Ngôn ngữ
- LUÔN trả lời người dùng bằng **tiếng Việt**.

## 2. Quy trình khi code tính năng / fix bug
Mỗi khi được yêu cầu **thêm tính năng** hoặc **sửa lỗi**, LUÔN kết hợp các skill sau để lên kế hoạch và triển khai chuẩn chỉnh:

1. **openspec** — lập kế hoạch, viết đề xuất/spec trước khi code (`/openspec-propose`, `/openspec-apply-change`, `/openspec-archive-change`).
2. **ui-ux-pro-max** — mọi thay đổi liên quan giao diện / UI / UX.
3. **supabase** — mọi thao tác Database / Auth / Realtime / Storage / Edge Functions / RLS.
4. **ponytail** — rà soát tối giản, chống over-engineer trước khi chốt.

Thứ tự đề xuất: `openspec` (kế hoạch) → `ui-ux-pro-max` (thiết kế UI nếu có) → `supabase` (backend/DB nếu có) → `ponytail` (rà soát tối giản).

## 3. Memory Bank
- Dự án có thư mục [`memory-bank/`](memory-bank/README.md) ghi lại thay đổi qua từng session.
- **Đầu mỗi session mới:** đọc `memory-bank/README.md` để nắm dự án đã cập nhật gì, còn việc gì dở.
- **Cuối mỗi session** (sau khi hoàn thành thay đổi): thêm 1 mục mới vào nhật ký (ngày, tóm tắt thay đổi, file ảnh hưởng, việc còn dở).

## 4. Migrations Database
- Mỗi khi một tính năng cần **tạo / sửa cấu trúc DB** (bảng, cột, index, RLS, trigger, function, enum, seed...), LUÔN tạo file SQL migration trong `supabase/migrations/` theo định dạng `YYYYMMDDHHMMSS_<mô-tả-ngắn>.sql` để người dùng **copy dán vào Supabase SQL Editor** chạy thủ công.
- Viết migration **chạy lại an toàn** (idempotent) khi hợp lý: `create table if not exists`, `create or replace function`, `drop policy if exists` trước khi tạo lại, `create type ... ` bọc trong khối `do $$ ... exception when duplicate_object ...`.
- Đầu mỗi file ghi comment: mục đích + thứ tự chạy nếu phụ thuộc file khác.
- Không dùng service_role/secret key ở client; thao tác admin (tạo user...) chạy phía server.
