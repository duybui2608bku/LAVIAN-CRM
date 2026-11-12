-- Mục đích: staff (mọi user đã đăng nhập) được thêm/sửa/xoá dịch vụ, không chỉ admin.
-- Thay policy services_admin_write (is_admin) bằng services_write cho authenticated
-- (cùng kiểu customers_all). Chạy sau 20260710100000_services.sql. Chạy lại an toàn.

drop policy if exists services_admin_write on public.services;
drop policy if exists services_write on public.services;
create policy services_write on public.services
  for all to authenticated
  using (true) with check (true);
