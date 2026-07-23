-- ============================================================================
-- Migration: Bộ phận user + kỹ thuật viên cho khách hàng (LAVIAN-CRM)
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Thứ tự: chạy SAU 20260707120000_user_management.sql (profiles)
--         và 20260707140000_customers_and_enums.sql (customers).
-- ============================================================================

-- 1) Enum bộ phận (2 giá trị cố định — khớp pattern user_role/user_status) ---
do $$ begin
  create type public.user_department as enum ('customer_care', 'technician');
exception when duplicate_object then null; end $$;

-- 2) profiles.department (nullable — user cũ chưa gán bộ phận) ---------------
alter table public.profiles
  add column if not exists department public.user_department;

-- 3) customers.technician_id (cùng shape staff_id) ---------------------------
alter table public.customers
  add column if not exists technician_id uuid references public.profiles(id) on delete set null;

create index if not exists customers_technician_idx
  on public.customers (technician_id) where deleted_at is null;

-- ============================================================================
-- ROLLBACK (chạy nếu cần gỡ bỏ):
--   drop index if exists customers_technician_idx;
--   alter table public.customers drop column if exists technician_id;
--   alter table public.profiles drop column if exists department;
--   drop type if exists public.user_department;
-- ============================================================================
