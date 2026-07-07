-- ============================================================================
-- Migration: Storage bucket "images" (public) + RLS upload ảnh (LAVIAN-CRM)
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Không phụ thuộc migration khác (RLS trên storage.objects đã bật sẵn).
-- Quy ước path object: '{user_id}/....' -> thư mục cấp 1 = auth.uid() (chủ sở hữu).
-- Thứ tự: tạo/cập nhật bucket -> policy read/insert/update/delete.
-- ============================================================================

-- 1) Bucket public "images" --------------------------------------------------
--    public=true  -> file đọc công khai qua URL cố định (dùng <img> trực tiếp).
--    file_size_limit 5MB; chỉ nhận các định dạng ảnh phổ biến.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'images', 'images', true, 5242880,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) Policies trên storage.objects (RLS đã bật sẵn bởi Supabase) -------------

-- Đọc: công khai. Bucket public vốn phục vụ file qua CDN không cần policy,
-- policy này cho phép cả .list()/truy vấn API. Ai cũng đọc được trong 'images'.
drop policy if exists images_read on storage.objects;
create policy images_read on storage.objects
  for select
  using (bucket_id = 'images');

-- Upload: chỉ user đã đăng nhập, chỉ vào thư mục của chính mình.
drop policy if exists images_insert_own on storage.objects;
create policy images_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Ghi đè (upsert): chỉ file trong thư mục của mình.
drop policy if exists images_update_own on storage.objects;
create policy images_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Xóa: chỉ file trong thư mục của mình.
drop policy if exists images_delete_own on storage.objects;
create policy images_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ============================================================================
-- ROLLBACK (chạy nếu cần gỡ):
--   drop policy if exists images_read       on storage.objects;
--   drop policy if exists images_insert_own on storage.objects;
--   drop policy if exists images_update_own on storage.objects;
--   drop policy if exists images_delete_own on storage.objects;
--   delete from storage.buckets where id = 'images';   -- xóa hết object trước
-- ============================================================================
