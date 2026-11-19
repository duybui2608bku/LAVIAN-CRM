-- ============================================================================
-- Migration: Lịch hẹn có Giá trị DV (bill) + Master (KTV) — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc: 20261118140000_service_categories.sql (trigger log bản mới nhất) đã chạy.
-- Chạy TRƯỚC khi deploy code (trang /appointments select 2 cột mới).
--
-- Nội dung:
--   * bill_amount  : giá trị dịch vụ của lịch (IDR, số nguyên >= 0, null = chưa nhập).
--   * technician_id: Master / KTV làm lịch (profiles bộ phận technician — kiểm ở server).
--   * Trigger log theo dõi thêm 2 cột trên.
-- ============================================================================

alter table public.clinic_appointments
  add column if not exists bill_amount bigint,
  add column if not exists technician_id uuid references public.profiles(id) on delete set null;

alter table public.clinic_appointments drop constraint if exists clinic_appointments_bill_amount_check;
alter table public.clinic_appointments
  add constraint clinic_appointments_bill_amount_check check (bill_amount is null or bill_amount >= 0);

create index if not exists clinic_appointments_technician_idx
  on public.clinic_appointments (technician_id) where technician_id is not null;

comment on column public.clinic_appointments.bill_amount is 'Giá trị dịch vụ của lịch hẹn (IDR)';
comment on column public.clinic_appointments.technician_id is 'Master / kỹ thuật viên làm lịch hẹn';

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

  foreach f in array array['scheduled_at', 'booking_confirm', 'checked_in', 'service_categories', 'service_ids',
    'staff_id', 'sales_id', 'technician_id', 'bill_amount', 'note'] loop
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
-- ROLLBACK (chạy nếu cần gỡ bỏ — trigger log: chạy lại bản trong 20261118140000):
--   alter table public.clinic_appointments drop column if exists bill_amount;
--   alter table public.clinic_appointments drop column if exists technician_id;
-- ============================================================================
