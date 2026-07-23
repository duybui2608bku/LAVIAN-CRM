-- Đổi tên cột phân công lịch hẹn để phản ánh đúng nghiệp vụ.
-- RENAME giữ nguyên toàn bộ dữ liệu và khóa ngoại hiện có.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'appointments'
      and column_name = 'staff_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'appointments'
      and column_name = 'technician_id'
  ) then
    alter table public.appointments rename column staff_id to technician_id;
  end if;
end
$$;

drop index if exists public.appointments_staff_scheduled_idx;
create index if not exists appointments_technician_scheduled_idx
  on public.appointments (technician_id, scheduled_at)
  where deleted_at is null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_staff_id_fkey'
  ) and not exists (
    select 1 from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_technician_id_fkey'
  ) then
    alter table public.appointments
      rename constraint appointments_staff_id_fkey
      to appointments_technician_id_fkey;
  end if;
end
$$;

-- Chặn mọi ghi trực tiếp nếu profile không phải kỹ thuật viên đang hoạt động.
create or replace function public.enforce_appointment_technician()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.technician_id is not null and not exists (
    select 1
    from public.profiles
    where id = new.technician_id
      and department = 'technician'
      and status = 'active'
  ) then
    raise exception 'Appointment technician must be an active technician'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_appointment_technician()
  from public, anon, authenticated;

drop trigger if exists trg_appointments_enforce_technician
  on public.appointments;
create trigger trg_appointments_enforce_technician
  before insert or update of technician_id on public.appointments
  for each row execute function public.enforce_appointment_technician();
