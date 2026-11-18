-- Mục đích: trang Khách tiềm năng (/customers/potential).
--   1. Thêm stage `consider` (Consider / Cân nhắc).
--   2. Cột customers: potential_status (tình trạng), follow_up_at (ngày giờ liên hệ lại),
--      converted_at (lúc chuyển đổi sang Booking từ trang tiềm năng).
--   3. Thông báo cho Telesales phụ trách khách: đúng giờ liên hệ lại (cron 5 phút) + tổng hợp 8:00 VN.
-- Chạy SAU 20261117150000_customer_stage_purchase.sql và 20261118100000_reminders_notify_customer_telesales.sql
-- (dùng bảng notifications). Chạy lại an toàn.

-- 1. Stage Consider.
alter table public.customers drop constraint if exists customers_stage_check;
alter table public.customers add constraint customers_stage_check
  check (stage in ('consulting', 'potential', 'consider', 'deposited', 'booked', 'show_up', 'purchase'));

-- 2. Cột mới.
alter table public.customers add column if not exists potential_status text;
alter table public.customers add column if not exists follow_up_at timestamptz;
alter table public.customers add column if not exists converted_at timestamptz;

alter table public.customers drop constraint if exists customers_potential_status_check;
alter table public.customers add constraint customers_potential_status_check
  check (potential_status is null or potential_status in ('interested', 'considering', 'no_response', 'converted'));

create index if not exists customers_follow_up_idx
  on public.customers (follow_up_at)
  where follow_up_at is not null and deleted_at is null;

-- 3a. Đúng giờ liên hệ lại: mỗi mốc follow_up_at báo 1 lần (chống trùng qua notifications, không ghi
--     thêm cột vào customers để khỏi nhảy updated_at). Chỉ quét mốc trong 1 ngày gần nhất.
create or replace function public.notify_follow_ups_due()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, data, link)
  select c.staff_id,
         'follow_up_due',
         jsonb_build_object('customer_id', c.id, 'customer', c.full_name, 'follow_up_at', c.follow_up_at),
         '/customers/potential'
  from public.customers c
  join public.profiles s on s.id = c.staff_id
    and s.status = 'active'
    and s.department::text in ('telesales', 'telesales_leader')
  where c.stage = 'potential'
    and c.deleted_at is null
    and c.follow_up_at is not null
    and c.follow_up_at <= now()
    and c.follow_up_at > now() - interval '1 day'
    and not exists (
      select 1 from public.notifications n
      where n.kind = 'follow_up_due'
        and n.user_id = c.staff_id
        and n.data->>'customer_id' = c.id::text
        and (n.data->>'follow_up_at')::timestamptz = c.follow_up_at
    );
$$;

revoke execute on function public.notify_follow_ups_due() from public, anon, authenticated;

-- 3b. Tổng hợp 8:00 sáng: số khách tiềm năng cần liên hệ hôm nay / quá hạn (ngày trước), gom theo Telesales.
create or replace function public.notify_daily_follow_ups()
returns void
language sql
security definer
set search_path = ''
as $$
  with d as (select (now() at time zone 'Asia/Ho_Chi_Minh')::date as today)
  insert into public.notifications (user_id, kind, data, link)
  select c.staff_id,
         'follow_up_digest',
         jsonb_build_object(
           'today', count(*) filter (where (c.follow_up_at at time zone 'Asia/Ho_Chi_Minh')::date = d.today),
           'overdue', count(*) filter (where (c.follow_up_at at time zone 'Asia/Ho_Chi_Minh')::date < d.today),
           'date', d.today
         ),
         '/customers/potential'
  from public.customers c
  cross join d
  join public.profiles s on s.id = c.staff_id
    and s.status = 'active'
    and s.department::text in ('telesales', 'telesales_leader')
  where c.stage = 'potential'
    and c.deleted_at is null
    and c.follow_up_at is not null
    and (c.follow_up_at at time zone 'Asia/Ho_Chi_Minh')::date <= d.today
  group by c.staff_id, d.today;
$$;

revoke execute on function public.notify_daily_follow_ups() from public, anon, authenticated;

-- 4. Lịch chạy (cron.schedule cùng tên = cập nhật job cũ).
select cron.schedule('follow-up-due', '*/5 * * * *', 'select public.notify_follow_ups_due()');
select cron.schedule('daily-follow-up-digest', '0 1 * * *', 'select public.notify_daily_follow_ups()');

-- Kiểm tra:
--   select jobname, schedule, active from cron.job where jobname like '%follow-up%';
