-- ============================================================================
-- Migration: Bảng nối customer_services (khách hàng ↔ dịch vụ) — LAVIAN-CRM
-- Khóa ngoại thật 2 chiều: 1 khách gắn nhiều dịch vụ, 1 dịch vụ gắn nhiều khách.
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc migration trước (phải đã chạy):
--   - 20260707140000_customers_and_enums.sql (bảng customers)
--   - 20260710100000_services.sql            (bảng services)
-- ============================================================================

-- 1) Bảng nối -----------------------------------------------------------------
-- ponytail: chưa có thuộc tính trên quan hệ (giá, ngày mua...) — thêm cột khi cần.
create table if not exists public.customer_services (
  customer_id uuid not null references public.customers(id) on delete cascade,
  service_id  uuid not null references public.services(id)  on delete restrict,
  created_at  timestamptz not null default now(),
  primary key (customer_id, service_id)
);

-- PK kép đã phủ chiều tra theo customer_id; index riêng cho chiều lọc theo dịch vụ.
create index if not exists customer_services_service_idx
  on public.customer_services (service_id);

-- 2) RLS + grant (mọi user đăng nhập toàn quyền — đồng nhất bảng customers) ----
alter table public.customer_services enable row level security;

drop policy if exists customer_services_all on public.customer_services;
create policy customer_services_all on public.customer_services
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.customer_services to authenticated;

-- ============================================================================
-- ROLLBACK (chạy nếu cần gỡ bỏ):
--   drop table if exists public.customer_services;
