-- ============================================================================
-- Migration: Bảng services (danh mục dịch vụ; chỉ tên tiếng Việt bắt buộc) — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc migration trước (phải đã chạy):
--   - 20260707120000_user_management.sql  (public.is_admin())
--   - 20260707140000_customers_and_enums.sql (public.set_updated_at())
-- ============================================================================

-- 1) Bảng dịch vụ ------------------------------------------------------------
-- ponytail: chưa có giá/thời lượng/mô tả — thêm cột khi nghiệp vụ cần.
create table if not exists public.services (
  id         uuid primary key default gen_random_uuid(),
  name_vi    text not null,
  name_en    text,
  name_id    text,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists services_sort_idx
  on public.services (sort_order);

-- 2) Trigger updated_at (tái dùng set_updated_at) -----------------------------
drop trigger if exists trg_services_updated on public.services;
create trigger trg_services_updated
  before update on public.services
  for each row execute function public.set_updated_at();

-- 3) RLS + grant (giống enum_options: đọc-authenticated, ghi-admin) -----------
alter table public.services enable row level security;

drop policy if exists services_read on public.services;
create policy services_read on public.services
  for select to authenticated using (true);

drop policy if exists services_admin_write on public.services;
create policy services_admin_write on public.services
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.services to authenticated;

-- ============================================================================
-- ROLLBACK (chạy nếu cần gỡ bỏ):
--   drop table if exists public.services;
