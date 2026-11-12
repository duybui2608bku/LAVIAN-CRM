-- Mục đích: KTV nhận tour (hoặc admin gán KTV cho tour) → KTV phụ trách của khách
--           (customers.technician_id) tự điền theo, CHỈ khi khách chưa có KTV.
--           Trigger security definer để KTV không cần quyền sửa bảng customers.
-- Thứ tự chạy: sau 20261106120000_tours.sql.
-- Idempotent — chạy lại an toàn. Dán vào Supabase SQL Editor chạy tay.

create or replace function public.tours_fill_customer_technician()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.technician_id is not null and new.deleted_at is null then
    update public.customers
    set technician_id = new.technician_id
    where id = new.customer_id
      and technician_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists tours_fill_customer_technician on public.tours;
create trigger tours_fill_customer_technician
  after insert or update of technician_id on public.tours
  for each row execute function public.tours_fill_customer_technician();

-- Dữ liệu cũ: khách chưa có KTV → lấy KTV của tour mới nhất đã có người nhận.
update public.customers c
set technician_id = t.technician_id
from (
  select distinct on (customer_id) customer_id, technician_id
  from public.tours
  where technician_id is not null and deleted_at is null
  order by customer_id, tour_date desc, created_at desc
) t
where c.id = t.customer_id
  and c.technician_id is null;
