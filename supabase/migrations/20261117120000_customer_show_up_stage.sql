-- Mục đích: thống nhất thuật ngữ "Show-up" cho khách đến phòng khám + stage Show-up tự động.
--   1. Stage `visited` → `show_up`; bỏ `new_lead` (→ consulting), `returning` (→ show_up), `lost` (→ consulting).
--   2. Bỏ default 'new_lead' (form bắt buộc chọn stage) + check stage chỉ còn 4 giá trị.
--   3. Trigger: Clinic confirmation (clinic_appointments.checked_in) = Show-up → khách `show_up`;
--      bỏ Show-up / xoá mềm lịch và khách không còn lịch Show-up nào → khách về `booked`.
--   4. Backfill: khách có lịch đã Show-up → `show_up`.
-- Phụ thuộc: 20261031065602_clinic_appointments.sql. Chạy TRƯỚC khi deploy code. Chạy lại an toàn.

update public.customers set stage = 'show_up' where stage in ('visited', 'returning');
update public.customers set stage = 'consulting' where stage in ('new_lead', 'lost');
update public.customers set lost_reason = null where lost_reason is not null;

update public.customers c set stage = 'show_up'
where c.stage <> 'show_up'
  and exists (select 1 from public.clinic_appointments a
              where a.customer_id = c.id and a.checked_in and a.deleted_at is null);

alter table public.customers alter column stage drop default;

alter table public.customers drop constraint if exists customers_stage_check;
alter table public.customers add constraint customers_stage_check
  check (stage in ('consulting', 'deposited', 'booked', 'show_up'));

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
    where id = new.customer_id and stage <> 'show_up';
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

drop trigger if exists clinic_appointments_sync_show_up on public.clinic_appointments;
create trigger clinic_appointments_sync_show_up
  after insert or update of checked_in, deleted_at on public.clinic_appointments
  for each row execute function public.sync_customer_show_up();

-- Kiểm tra:
--   select stage, count(*) from public.customers where deleted_at is null group by 1;
