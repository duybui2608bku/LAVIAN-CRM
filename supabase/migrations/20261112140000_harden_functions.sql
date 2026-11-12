-- Migration: Siết quyền function — LAVIAN-CRM (OpenSpec: db-cleanup)
--
-- Mục đích: xử lý cảnh báo Supabase advisor (security):
--   - Function SECURITY DEFINER gọi được qua /rest/v1/rpc/* bởi anon/authenticated.
--   - set_updated_at thiếu search_path cố định.
--
-- Vì sao an toàn:
--   - Trigger / event trigger KHÔNG kiểm tra quyền EXECUTE lúc chạy (chỉ lúc CREATE TRIGGER),
--     nên revoke không ảnh hưởng handle_new_user, tours_fill_customer_technician, rls_auto_enable.
--   - is_admin() được policy RLS (role authenticated) và trigger tours_protect_confirmation gọi
--     dưới quyền người dùng → GIỮ cho authenticated, chỉ bỏ anon/public.
--   - Code không gọi .rpc() nào.
--
-- Thứ tự: sau 20261112130000_db_cleanup.sql. Chạy lại an toàn (revoke/alter idempotent).

-- Chỉ dùng làm trigger — không ai được gọi trực tiếp qua API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.tours_fill_customer_technician() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Dùng trong RLS cho user đã đăng nhập; khách chưa đăng nhập không cần.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Cố định search_path (body chỉ dùng now() thuộc pg_catalog).
alter function public.set_updated_at() set search_path = '';
