-- Mục đích: log thay đổi lịch hẹn (clinic_appointments) — ai, lúc nào, trường nào, cũ → mới.
-- Ghi bằng trigger nên mọi đường ghi (trang /appointments, Form SMAX qua admin client) đều được log.
-- Admin client (Form SMAX) không có auth.uid() → actor_id null (UI hiện "Form SMAX").
-- Không backfill lịch cũ. Chạy TRƯỚC khi deploy code (trang /customers đọc bảng này). Chạy lại an toàn.

create table if not exists public.clinic_appointment_logs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.clinic_appointments(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  action text not null check (action in ('create', 'update', 'delete')),
  -- {field: {"old": ..., "new": ...}} — chỉ các trường thay đổi (create: giá trị ban đầu).
  changes jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists clinic_appointment_logs_customer_idx
  on public.clinic_appointment_logs (customer_id, created_at desc);
create index if not exists clinic_appointment_logs_appointment_idx
  on public.clinic_appointment_logs (appointment_id);
create index if not exists clinic_appointment_logs_actor_idx
  on public.clinic_appointment_logs (actor_id);

alter table public.clinic_appointment_logs enable row level security;

-- Chỉ đọc (profile active, giống clinic_appointments); không ai ghi trực tiếp — chỉ trigger.
drop policy if exists clinic_appointment_logs_read on public.clinic_appointment_logs;
create policy clinic_appointment_logs_read on public.clinic_appointment_logs
  for select to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));

revoke all on public.clinic_appointment_logs from anon, authenticated;
grant select on public.clinic_appointment_logs to authenticated;

create or replace function public.log_clinic_appointment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  f text;
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  n jsonb := to_jsonb(new);
  diff jsonb := '{}'::jsonb;
  act text := 'update';
begin
  if tg_op = 'INSERT' then
    act := 'create';
  elsif new.deleted_at is not null and old.deleted_at is null then
    act := 'delete';
  end if;

  foreach f in array array['scheduled_at', 'checked_in', 'service_ids', 'staff_id', 'note'] loop
    if (o -> f) is distinct from (n -> f) then
      diff := diff || jsonb_build_object(f, jsonb_build_object('old', o -> f, 'new', n -> f));
    end if;
  end loop;

  -- Update chỉ chạm updated_at / cột không theo dõi → không log.
  if act = 'update' and diff = '{}'::jsonb then
    return null;
  end if;

  insert into public.clinic_appointment_logs (appointment_id, customer_id, action, changes, actor_id)
  values (new.id, new.customer_id, act, diff, (select auth.uid()));
  return null;
end;
$$;

revoke execute on function public.log_clinic_appointment_change() from public, anon, authenticated;

drop trigger if exists clinic_appointments_log on public.clinic_appointments;
create trigger clinic_appointments_log
  after insert or update on public.clinic_appointments
  for each row execute function public.log_clinic_appointment_change();
