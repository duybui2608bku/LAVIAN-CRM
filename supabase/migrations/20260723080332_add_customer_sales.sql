-- Nhân viên Sales phụ trách khách hàng.
alter table public.customers
  add column if not exists sales_id uuid
  references public.profiles(id) on delete set null;

create index if not exists customers_sales_idx
  on public.customers (sales_id) where deleted_at is null;
