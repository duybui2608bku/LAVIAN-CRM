-- Chân dung khách: thêm danh mục ẩn `general` (ghi chú thô nhân viên nhập — AI tự tách ra 6 mục chân dung).
-- Chạy sau 20261120120000_customer_360.sql. Chạy lại an toàn.
alter table public.customer_portrait_entries drop constraint if exists customer_portrait_entries_field_check;
alter table public.customer_portrait_entries add constraint customer_portrait_entries_field_check
  check (field in ('general', 'wish', 'pain', 'preference', 'behavior', 'communication', 'personality'));
comment on column public.customer_portrait_entries.field is
  'Mục chân dung; general = ghi chú thô (ẩn trên UI), AI tách ra các mục còn lại';
