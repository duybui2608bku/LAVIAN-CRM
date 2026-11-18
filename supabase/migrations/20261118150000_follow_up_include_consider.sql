-- Mục đích: lịch nhắc follow-up (customers.follow_up_at) áp cho cả stage Cân nhắc (consider),
--   không chỉ Tiềm năng (potential). Trang /customers/potential gộp 2 stage này.
-- Chạy SAU 20261118130000_potential_customers.sql. Chạy lại an toàn (create or replace).
-- Chỉ đổi điều kiện `c.stage = 'potential'` → `c.stage in ('potential', 'consider')`; cron giữ nguyên.

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
  where c.stage in ('potential', 'consider')
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
  where c.stage in ('potential', 'consider')
    and c.deleted_at is null
    and c.follow_up_at is not null
    and (c.follow_up_at at time zone 'Asia/Ho_Chi_Minh')::date <= d.today
  group by c.staff_id, d.today;
$$;

revoke execute on function public.notify_daily_follow_ups() from public, anon, authenticated;
