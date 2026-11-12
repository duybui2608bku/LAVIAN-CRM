-- Mục đích: chuẩn hoá SĐT khách về dạng di động Indonesia 0xxx-xxxx-xxxx
--           (giống lib/phone.ts#formatPhone):
--   * bỏ ký tự không phải số; đầu "62" → bỏ; thiếu "0" đầu → thêm "0"
--   * chỉ đổi khi đầu số là 081/082/083/085/087/088/089 và dài 10–13 số
--   * nhóm 4-4-còn lại: phần giữa = min(4, ceil((n-4)/2))
--     vd 0812-1214-1243 (12 số), 0811-1011-23558 (13 số), 0811-9727-970 (11 số)
--   * số khác (nước ngoài, cố định...) giữ nguyên.
-- Thứ tự chạy: độc lập. Idempotent — chạy lại không đổi gì thêm.
-- Dán vào Supabase SQL Editor chạy tay.

with norm as (
  select id, phone,
         case when d like '0%' then d else '0' || d end as d
  from (
    select id, phone,
           regexp_replace(regexp_replace(phone, '\D', '', 'g'), '^62', '') as d
    from public.customers
  ) s
),
fmt as (
  select id, phone, d,
         least(4, ceil((length(d) - 4) / 2.0))::int as mid
  from norm
  where d ~ '^08[1235789]' and length(d) between 10 and 13
)
update public.customers c
set phone = substr(f.d, 1, 4) || '-' || substr(f.d, 5, f.mid) || '-' || substr(f.d, 5 + f.mid)
from fmt f
where c.id = f.id
  and c.phone is distinct from substr(f.d, 1, 4) || '-' || substr(f.d, 5, f.mid) || '-' || substr(f.d, 5 + f.mid);
