-- Mục đích: đồng bộ nguồn khách đã lưu thô từ Form SMAX (vd. platform "instagram")
-- về đúng `value` trong danh mục enum_options kind='source' (vd. "instagrams"),
-- để /customers hiện tag màu/icon thay vì chữ xám.
-- So khớp giống lib/customers.ts#resolveSource: chữ thường, bỏ ký tự đặc biệt,
-- khớp value hoặc label_vi/en/id. Không khớp → giữ nguyên.
-- Chạy lại an toàn (idempotent): chỉ đụng dòng có source chưa nằm trong danh mục.
-- Chạy sau: 20260707140000_customers_and_enums.sql.

with opts as (
  select value,
         unnest(array[value, label_vi, label_en, label_id]) as name
  from public.enum_options
  where kind = 'source'
),
keyed as (
  select distinct on (key) value, key
  from (
    select value, regexp_replace(lower(name), '[^a-z0-9]', '', 'g') as key
    from opts
    where name is not null
  ) k
  where key <> ''
  order by key, value
)
update public.customers c
set source = keyed.value
from keyed
where c.source is not null
  and c.source not in (select value from public.enum_options where kind = 'source')
  and regexp_replace(lower(c.source), '[^a-z0-9]', '', 'g') = keyed.key;

with opts as (
  select value,
         unnest(array[value, label_vi, label_en, label_id]) as name
  from public.enum_options
  where kind = 'source'
),
keyed as (
  select distinct on (key) value, key
  from (
    select value, regexp_replace(lower(name), '[^a-z0-9]', '', 'g') as key
    from opts
    where name is not null
  ) k
  where key <> ''
  order by key, value
)
update public.appointments a
set source = keyed.value
from keyed
where a.source is not null
  and a.source not in (select value from public.enum_options where kind = 'source')
  and regexp_replace(lower(a.source), '[^a-z0-9]', '', 'g') = keyed.key;
