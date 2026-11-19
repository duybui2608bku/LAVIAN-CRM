-- Mục đích (OpenSpec: customer-phone-dedupe): 1 SĐT chỉ thuộc 1 khách chưa xoá.
--   Unique index phone trên khách chưa xoá (deleted_at is null) — chốt chặn cuối cho mọi đường tạo/sửa
--   (app đã kiểm tra trước để báo lỗi dễ hiểu). Thay index thường customers_phone_idx (thừa).
-- ⚠ CHỈ CHẠY SAU KHI đã xử lý hết khách trùng SĐT (xoá mềm bớt trong CRM), nếu không sẽ báo lỗi
--   "could not create unique index". Kiểm tra trước:
--   select phone, count(*) from public.customers where deleted_at is null group by phone having count(*) > 1;
-- Chạy lại an toàn.

create unique index if not exists customers_phone_active_uidx
  on public.customers (phone) where deleted_at is null;

drop index if exists public.customers_phone_idx;

-- Kiểm tra:
--   select indexname from pg_indexes where tablename = 'customers' and indexname like 'customers_phone%';
