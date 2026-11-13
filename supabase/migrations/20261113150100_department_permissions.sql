-- Migration: phân quyền theo bộ phận (OpenSpec: department-permissions)
--
-- Mục đích:
--   Bảng public.department_permissions: mỗi bộ phận 1 dòng, cột `permissions` = mảng key `<module>.<action>`
--   (module: customers, appointments, tour, services, reports, marketing; action: view / edit / delete).
--   Admin (profiles.role = 'admin') luôn toàn quyền, không cần dòng ở đây.
--   App kiểm tra quyền ở proxy + server action (RLS các bảng nghiệp vụ giữ nguyên).
--   FK profiles.department → bảng này để proxy lấy quyền cùng 1 query (embed PostgREST).
--
-- Seed giữ nguyên hành vi trước đó: mọi bộ phận vào /customers + /services (toàn quyền), tạo/sửa/xoá
-- lịch hẹn từ drawer khách hàng (không có menu /appointments). Leader thêm menu /appointments.
-- Admin chỉnh lại ở /users → "Phân quyền".
--
-- Thứ tự: SAU 20261113150000_department_customer_care_leader.sql.
-- Bộ phận mới sau này: thêm giá trị enum + insert 1 dòng vào bảng này trước khi gán cho user.
-- Chạy lại an toàn (if not exists / on conflict / drop policy trước khi tạo).

begin;

create table if not exists public.department_permissions (
  department  public.user_department primary key,
  permissions text[] not null default '{}',
  updated_at  timestamptz not null default now()
);

insert into public.department_permissions (department, permissions)
select d, case when d = 'customer_care_leader'
  then array['customers.view','customers.edit','customers.delete','services.view','services.edit','services.delete',
             'appointments.view','appointments.edit','appointments.delete']
  else array['customers.view','customers.edit','customers.delete','services.view','services.edit','services.delete',
             'appointments.edit','appointments.delete']
  end
from unnest(enum_range(null::public.user_department)) as d
on conflict (department) do nothing;

do $$ begin
  alter table public.profiles
    add constraint profiles_department_permissions_fkey
    foreign key (department) references public.department_permissions (department) on update cascade;
exception when duplicate_object then null;
end $$;

drop trigger if exists department_permissions_updated_at on public.department_permissions;
create trigger department_permissions_updated_at
  before update on public.department_permissions
  for each row execute function public.set_updated_at();

alter table public.department_permissions enable row level security;

-- Đọc: mọi user đăng nhập (proxy/layout đọc quyền của chính mình). Ghi: chỉ admin.
drop policy if exists department_permissions_read on public.department_permissions;
create policy department_permissions_read on public.department_permissions
  for select to authenticated using (true);
drop policy if exists department_permissions_admin_update on public.department_permissions;
create policy department_permissions_admin_update on public.department_permissions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

commit;

-- Rollback (tham khảo):
--   alter table public.profiles drop constraint if exists profiles_department_permissions_fkey;
--   drop table if exists public.department_permissions;
