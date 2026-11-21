-- ============================================================================
-- Migration: Nhóm dịch vụ trên khách hàng — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Chạy lại an toàn.
-- Phụ thuộc: 20261118140000_service_categories.sql (clinic_appointments.service_categories) đã chạy.
-- Chạy TRƯỚC khi deploy code (/customers, /customers/potential, /lead-form select cột mới).
--
-- Nội dung:
--   * customers.service_categories: nhóm dịch vụ khách quan tâm (alis | bibir | laser, chọn nhiều).
--     Bắt buộc (kiểm ở app) khi stage Tiềm năng / Cân nhắc / Đã đặt lịch / Đã mua — khách Tiềm năng /
--     Cân nhắc chưa có lịch hẹn nên trước đây không có chỗ lưu nhóm dịch vụ.
--   * Backfill khách cũ từ lịch hẹn gần nhất có nhóm dịch vụ.
--   KHÔNG thêm constraint bắt buộc ở DB: khách cũ chưa có nhóm + sửa stage inline vẫn cho lưu.
-- ============================================================================

alter table public.customers
  add column if not exists service_categories text[] not null default '{}';

alter table public.customers drop constraint if exists customers_service_categories_check;
alter table public.customers
  add constraint customers_service_categories_check
  check (service_categories <@ array['alis', 'bibir', 'laser']::text[]);

comment on column public.customers.service_categories is
  'Nhóm dịch vụ khách quan tâm: alis | bibir | laser (bắt buộc ở form khi stage potential/consider/booked/purchase)';

-- Backfill: khách chưa có nhóm → lấy nhóm của lịch hẹn mới nhất có nhóm.
update public.customers c
set service_categories = a.service_categories
from (
  select distinct on (customer_id) customer_id, service_categories
  from public.clinic_appointments
  where deleted_at is null and cardinality(service_categories) > 0
  order by customer_id, scheduled_at desc
) a
where a.customer_id = c.id
  and cardinality(c.service_categories) = 0;
