-- Mục đích: thêm stage `potential` (Tiềm năng / Potential) cho khách hàng.
-- Chạy SAU 20261117120000_customer_show_up_stage.sql (file đó tạo check customers_stage_check).
-- Chạy lại an toàn: drop rồi tạo lại constraint.

alter table public.customers drop constraint if exists customers_stage_check;
alter table public.customers add constraint customers_stage_check
  check (stage in ('consulting', 'potential', 'deposited', 'booked', 'show_up'));
