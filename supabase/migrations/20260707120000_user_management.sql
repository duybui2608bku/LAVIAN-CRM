-- ============================================================================
-- Migration: User Management + Auth foundation (LAVIAN-CRM)
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần.
-- Idempotent ở mức hợp lý — chạy lại an toàn.
-- Thứ tự: enum -> bảng profiles -> index -> is_admin()+RLS
--         -> handle_new_user()+trigger -> backfill -> grant -> SEED admin.
-- ============================================================================

-- 1) Enums ------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_status as enum ('active', 'banned');
exception when duplicate_object then null; end $$;

-- 2) Bảng profiles (1-1 với auth.users; KHÔNG lưu mật khẩu) ------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  user_name  text not null default '',
  avatar_url text,
  role       public.user_role   not null default 'user',
  status     public.user_status not null default 'active',
  created_at timestamptz        not null default now()
);

-- 3) Index phục vụ lọc tìm theo tên / email ---------------------------------
create index if not exists profiles_user_name_idx on public.profiles (lower(user_name));
create index if not exists profiles_email_idx     on public.profiles (lower(email));

-- 4) is_admin() SECURITY DEFINER (tránh đệ quy RLS) + RLS --------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_self  on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select using (public.is_admin());

drop policy if exists profiles_admin_write  on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- 5) Trigger tự tạo profiles khi có user mới ở auth.users -------------------
--    role/status lấy mặc định từ cột (KHÔNG tin role từ metadata) để tránh
--    leo thang quyền; nâng quyền admin chỉ qua Server Action.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, user_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'user_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6) Backfill hồ sơ cho user đã tồn tại trước khi có trigger ----------------
insert into public.profiles (id, email, user_name, avatar_url)
select u.id, u.email,
       coalesce(u.raw_user_meta_data->>'user_name', ''),
       u.raw_user_meta_data->>'avatar_url'
from auth.users u
on conflict (id) do nothing;

-- 7) Quyền đọc cho client (RLS vẫn lọc theo dòng) ---------------------------
grant select on public.profiles to authenticated;

-- 8) SEED: nâng 1 tài khoản thành admin -------------------------------------
--    >>> THAY 'you@example.com' bằng email admin của bạn rồi chạy dòng dưới <<<
--    (Tạo admin đầu tiên: hoặc dùng Server Action tạo user rồi chạy dòng này,
--     hoặc tạo user qua Dashboard > Authentication > Users trước.)
update public.profiles set role = 'admin' where email = 'admin@lavian.com';

-- ============================================================================
-- ROLLBACK (chạy nếu cần gỡ bỏ):
--   drop trigger if exists on_auth_user_created on auth.users;
--   drop function if exists public.handle_new_user();
--   drop function if exists public.is_admin();
--   drop table if exists public.profiles;
--   drop type if exists public.user_status;
--   drop type if exists public.user_role;
-- ============================================================================
