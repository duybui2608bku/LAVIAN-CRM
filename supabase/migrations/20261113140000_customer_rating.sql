-- Mục đích: đánh giá khách hàng (chọn 1) — potential | price_only | far | spam; null = chưa đánh giá.
-- Danh sách giá trị cố định trong code (lib/customer-options.ts, kind 'rating'), server validate — không check ở DB
-- để thêm giá trị mới không cần migration (giống cột stage).
-- Không phụ thuộc file khác. Chạy lại an toàn. RLS hiện có của customers đã bao cột mới.
alter table public.customers
  add column if not exists rating text;

comment on column public.customers.rating is
  'Đánh giá khách: potential | price_only | far | spam (null = chưa đánh giá)';
