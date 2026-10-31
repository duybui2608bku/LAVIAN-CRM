-- Simple appointment sheet, independent of legacy appointments/revenue tables.
create table public.clinic_appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  scheduled_at timestamptz not null,
  checked_in boolean not null default false,
  service_ids uuid[] not null default '{}',
  payment_method text check (payment_method in ('cash', 'bank', 'card')),
  staff_id uuid references public.profiles(id) on delete set null,
  note text not null default '' check (length(note) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index clinic_appointments_customer_time_idx
  on public.clinic_appointments (customer_id, scheduled_at) where deleted_at is null;

create index clinic_appointments_date_idx on public.clinic_appointments (scheduled_at)
  where deleted_at is null;

create trigger clinic_appointments_updated before update on public.clinic_appointments
  for each row execute function public.set_updated_at();

alter table public.clinic_appointments enable row level security;

-- Shared internal CRM, same customer visibility for all active staff.
create policy clinic_appointments_staff on public.clinic_appointments
  for all to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));

-- Override Supabase default privileges too: clients can only soft-delete.
revoke all on public.clinic_appointments from anon, authenticated;
grant select, insert, update on public.clinic_appointments to authenticated;
