-- Mục đích: thông báo lịch nhắc CHỈ gửi cho Telesales phụ trách khách (customers.staff_id),
--           không gửi theo người phụ trách chọn tay nữa → bỏ cột customer_reminders.assignee_id.
--   Người nhận phải: là staff_id của khách, bộ phận telesales/telesales_leader, status active,
--   khách chưa xoá. Khách chưa có Telesales → không ai nhận.
-- Chạy SAU 20261118090000_customer_reminders_notifications.sql. Chạy lại an toàn.

-- 1. Bỏ người phụ trách riêng (lịch nhắc thuộc Telesales của khách; đổi Telesales → lịch nhắc đi theo).
drop trigger if exists customer_reminders_notify_assigned on public.customer_reminders;
drop index if exists public.customer_reminders_assignee_idx;
alter table public.customer_reminders drop column if exists assignee_id;

-- 2. Có người khác tạo lịch nhắc cho khách → báo Telesales phụ trách khách (người tạo là chính họ thì thôi).
create or replace function public.notify_reminder_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, data, link)
  select c.staff_id,
         'reminder_assigned',
         jsonb_build_object(
           'customer', c.full_name,
           'remind_at', new.remind_at,
           'by', (select p.user_name from public.profiles p where p.id = auth.uid())
         ),
         '/customers/reminders?date=' || to_char(new.remind_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')
  from public.customers c
  join public.profiles s on s.id = c.staff_id
  where c.id = new.customer_id
    and c.deleted_at is null
    and s.status = 'active'
    and s.department::text in ('telesales', 'telesales_leader')
    and c.staff_id is distinct from auth.uid();
  return new;
end;
$$;

revoke execute on function public.notify_reminder_created() from public, anon, authenticated;

drop trigger if exists customer_reminders_notify_created on public.customer_reminders;
create trigger customer_reminders_notify_created
  after insert on public.customer_reminders
  for each row execute function public.notify_reminder_created();

drop function if exists public.notify_reminder_assigned();

-- 3. Tổng hợp 8:00 sáng: gom theo Telesales phụ trách khách.
create or replace function public.notify_daily_reminders()
returns void
language sql
security definer
set search_path = ''
as $$
  with d as (select (now() at time zone 'Asia/Ho_Chi_Minh')::date as today)
  insert into public.notifications (user_id, kind, data, link)
  select c.staff_id,
         'reminder_digest',
         jsonb_build_object(
           'today', count(*) filter (where (r.remind_at at time zone 'Asia/Ho_Chi_Minh')::date = d.today),
           'overdue', count(*) filter (where (r.remind_at at time zone 'Asia/Ho_Chi_Minh')::date < d.today),
           'date', d.today
         ),
         '/customers/reminders?date=' || d.today::text
  from public.customer_reminders r
  cross join d
  join public.customers c on c.id = r.customer_id and c.deleted_at is null
  join public.profiles s on s.id = c.staff_id
    and s.status = 'active'
    and s.department::text in ('telesales', 'telesales_leader')
  where r.done_at is null
    and (r.remind_at at time zone 'Asia/Ho_Chi_Minh')::date <= d.today
  group by c.staff_id, d.today;
$$;

revoke execute on function public.notify_daily_reminders() from public, anon, authenticated;
