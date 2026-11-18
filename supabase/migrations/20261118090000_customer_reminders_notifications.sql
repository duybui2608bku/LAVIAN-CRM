-- Mục đích: Lịch nhắc hẹn khách (customer_reminders) + thông báo trong app (notifications, Realtime)
--           + job pg_cron 8:00 sáng giờ VN báo "hôm nay có N lịch nhắc".
-- Chạy TRƯỚC khi deploy code (trang /customers/bookings, /customers/reminders và chuông header đọc 2 bảng này).
-- Không phụ thuộc migration mới nào khác (cần customers, profiles đã có). Chạy lại an toàn.

-- ─────────────────────────── 1. Lịch nhắc hẹn ───────────────────────────
create table if not exists public.customer_reminders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  -- Người phụ trách nhắn khách (nhận thông báo).
  assignee_id uuid references public.profiles(id) on delete set null,
  remind_at timestamptz not null,
  -- Nội dung tin nhắn sẽ gửi khách (nhân viên sao chép để nhắn).
  note text not null default '',
  done_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists customer_reminders_customer_idx on public.customer_reminders (customer_id);
create index if not exists customer_reminders_assignee_idx on public.customer_reminders (assignee_id);
create index if not exists customer_reminders_created_by_idx on public.customer_reminders (created_by);
create index if not exists customer_reminders_pending_idx
  on public.customer_reminders (remind_at) where done_at is null;

alter table public.customer_reminders enable row level security;

-- Mọi user đang hoạt động toàn quyền (cùng triết lý customers — CRM dùng chung cả nhóm).
drop policy if exists customer_reminders_all on public.customer_reminders;
create policy customer_reminders_all on public.customer_reminders
  for all to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));

revoke all on public.customer_reminders from anon;
grant select, insert, update, delete on public.customer_reminders to authenticated;

-- ─────────────────────────── 2. Thông báo ───────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 'reminder_digest' {today, overdue, date} | 'reminder_assigned' {customer, remind_at, by}
  -- Chữ hiển thị dựng ở client theo kind + data (đủ 3 ngôn ngữ).
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Chỉ đọc / đánh dấu đã đọc thông báo của mình. Không ai insert trực tiếp — chỉ function bên dưới.
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Realtime: client subscribe INSERT; Realtime tôn trọng RLS → mỗi user chỉ nhận dòng của mình.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- ─────────────────── 3. Thông báo khi được người khác giao lịch nhắc ───────────────────
create or replace function public.notify_reminder_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_id is null
     or new.assignee_id = auth.uid()
     or (tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id) then
    return new;
  end if;

  insert into public.notifications (user_id, kind, data, link)
  select new.assignee_id,
         'reminder_assigned',
         jsonb_build_object(
           'customer', c.full_name,
           'remind_at', new.remind_at,
           'by', (select p.user_name from public.profiles p where p.id = auth.uid())
         ),
         '/customers/reminders?date=' || to_char(new.remind_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')
  from public.customers c
  where c.id = new.customer_id;
  return new;
end;
$$;

revoke execute on function public.notify_reminder_assigned() from public, anon, authenticated;

drop trigger if exists customer_reminders_notify_assigned on public.customer_reminders;
create trigger customer_reminders_notify_assigned
  after insert or update of assignee_id on public.customer_reminders
  for each row execute function public.notify_reminder_assigned();

-- ─────────────────── 4. Tổng hợp 8:00 sáng giờ VN ───────────────────
-- Mỗi người phụ trách có lịch nhắc chưa xong hôm nay hoặc quá hạn → 1 thông báo.
create or replace function public.notify_daily_reminders()
returns void
language sql
security definer
set search_path = ''
as $$
  with d as (select (now() at time zone 'Asia/Ho_Chi_Minh')::date as today)
  insert into public.notifications (user_id, kind, data, link)
  select r.assignee_id,
         'reminder_digest',
         jsonb_build_object(
           'today', count(*) filter (where (r.remind_at at time zone 'Asia/Ho_Chi_Minh')::date = d.today),
           'overdue', count(*) filter (where (r.remind_at at time zone 'Asia/Ho_Chi_Minh')::date < d.today),
           'date', d.today
         ),
         '/customers/reminders?date=' || d.today::text
  from public.customer_reminders r
  cross join d
  join public.profiles p on p.id = r.assignee_id and p.status = 'active'
  where r.done_at is null
    and (r.remind_at at time zone 'Asia/Ho_Chi_Minh')::date <= d.today
  group by r.assignee_id, d.today;
$$;

-- Chỉ pg_cron (chạy bằng postgres) gọi — không mở cho Data API.
revoke execute on function public.notify_daily_reminders() from public, anon, authenticated;

create extension if not exists pg_cron;

-- 01:00 UTC = 08:00 giờ VN. cron.schedule cùng tên = cập nhật job cũ (chạy lại an toàn).
select cron.schedule('daily-reminder-digest', '0 1 * * *', 'select public.notify_daily_reminders()');
