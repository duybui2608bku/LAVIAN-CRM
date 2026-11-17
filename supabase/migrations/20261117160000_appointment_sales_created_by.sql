-- ============================================================================
-- Migration: Lịch hẹn có Sales + Người tạo — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc: 20261114090000_appointment_booking_confirm.sql (trigger log) đã chạy.
-- Chạy TRƯỚC khi deploy code (trang /appointments select 2 cột mới).
--
-- Nội dung:
--   * sales_id: nhân viên bộ phận Sales phụ trách lịch (chọn tay trên bảng).
--   * created_by: người tạo lịch. Mặc định auth.uid() (tạo từ CRM); lead-form
--     (admin client, không có auth.uid) ghi tường minh = Telesales đã chọn.
--     Lịch cũ: lấy actor của log "create", không có thì lấy Telesales (staff_id).
--   * Trigger log theo dõi thêm sales_id; log "create" không có auth.uid → actor = created_by.
-- ============================================================================

alter table public.clinic_appointments
  add column if not exists sales_id uuid references public.profiles(id) on delete set null;
alter table public.clinic_appointments
  add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.clinic_appointments
  alter column created_by set default auth.uid();

comment on column public.clinic_appointments.sales_id is 'Nhân viên bộ phận Sales phụ trách lịch hẹn';
comment on column public.clinic_appointments.created_by is 'Người tạo lịch hẹn';

-- Backfill lịch cũ.
update public.clinic_appointments a
set created_by = l.actor_id
from (
  select distinct on (appointment_id) appointment_id, actor_id
  from public.clinic_appointment_logs
  where action = 'create' and actor_id is not null
  order by appointment_id, created_at
) l
where a.id = l.appointment_id and a.created_by is null;

update public.clinic_appointments
set created_by = staff_id
where created_by is null and staff_id is not null;

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

  foreach f in array array['scheduled_at', 'booking_confirm', 'checked_in', 'service_ids', 'staff_id', 'sales_id', 'note'] loop
    if (o -> f) is distinct from (n -> f) then
      diff := diff || jsonb_build_object(f, jsonb_build_object('old', o -> f, 'new', n -> f));
    end if;
  end loop;

  -- Update chỉ chạm updated_at / cột không theo dõi → không log.
  if act = 'update' and diff = '{}'::jsonb then
    return null;
  end if;

  insert into public.clinic_appointment_logs (appointment_id, customer_id, action, changes, actor_id)
  values (new.id, new.customer_id, act, diff,
    coalesce((select auth.uid()), case when act = 'create' then new.created_by end));
  return null;
end;
$$;

revoke execute on function public.log_clinic_appointment_change() from public, anon, authenticated;

-- ============================================================================
-- ROLLBACK (chạy nếu cần gỡ bỏ — trigger log: chạy lại bản trong 20261114090000):
--   alter table public.clinic_appointments drop column if exists sales_id;
--   alter table public.clinic_appointments drop column if exists created_by;
-- ============================================================================
