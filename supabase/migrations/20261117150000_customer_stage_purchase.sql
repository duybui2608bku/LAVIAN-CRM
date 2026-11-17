-- Mục đích: thêm stage `purchase` (Purchase) cho khách hàng.
--   1. Mở rộng check customers_stage_check.
--   2. Trigger Show-up không hạ khách đã Purchase về Show-up khi có lịch mới được xác nhận.
-- Chạy SAU 20261117140000_customer_stage_potential.sql. Chạy lại an toàn.

alter table public.customers drop constraint if exists customers_stage_check;
alter table public.customers add constraint customers_stage_check
  check (stage in ('consulting', 'potential', 'deposited', 'booked', 'show_up', 'purchase'));

create or replace function public.sync_customer_show_up()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shown boolean := new.checked_in and new.deleted_at is null;
  was boolean := tg_op = 'UPDATE' and old.checked_in and old.deleted_at is null;
begin
  if shown and not was then
    update public.customers set stage = 'show_up'
    where id = new.customer_id and stage not in ('show_up', 'purchase');
  elsif was and not shown and not exists (
    select 1 from public.clinic_appointments a
    where a.customer_id = new.customer_id and a.id <> new.id and a.checked_in and a.deleted_at is null
  ) then
    update public.customers set stage = 'booked'
    where id = new.customer_id and stage = 'show_up';
  end if;
  return null;
end;
$$;

revoke execute on function public.sync_customer_show_up() from public, anon, authenticated;
