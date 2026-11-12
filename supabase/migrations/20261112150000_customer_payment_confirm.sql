-- Mục đích: lưu 1 ảnh xác nhận thanh toán (Payment confirm) cho khách hàng.
-- Nhập ở /customers (drawer) và Form SMAX (/lead-form). Giá trị = public URL ảnh (CDN qua /api/upload), null = chưa có.
-- Không phụ thuộc file khác. Chạy lại an toàn. RLS hiện có của customers đã bao cột mới.
alter table public.customers
  add column if not exists payment_confirm_url text;

comment on column public.customers.payment_confirm_url is 'URL ảnh xác nhận thanh toán (Payment confirm)';
