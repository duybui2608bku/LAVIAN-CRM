-- Mục đích: lưu khu vực (Indonesia) + địa chỉ chi tiết của khách hàng.
-- region_code: mã Kemendagri — '31' = chỉ chọn tỉnh, '31.71' = tỉnh + huyện/thành phố; null = chưa có.
--   Danh sách tên vùng nằm ở lib/id-regions.json (không lưu bảng trong DB).
-- address_detail: địa chỉ chi tiết (số nhà, đường...) dạng text tự do.
-- Không phụ thuộc file khác. Chạy lại an toàn. RLS hiện có của customers đã bao cột mới.
alter table public.customers
  add column if not exists region_code text,
  add column if not exists address_detail text;

alter table public.customers
  drop constraint if exists customers_region_code_format;
alter table public.customers
  add constraint customers_region_code_format
  check (region_code is null or region_code ~ '^\d{2}(\.\d{2})?$');

comment on column public.customers.region_code is
  'Mã vùng Kemendagri: tỉnh (31) hoặc huyện/thành phố (31.71)';
comment on column public.customers.address_detail is
  'Địa chỉ chi tiết (số nhà, đường...)';
