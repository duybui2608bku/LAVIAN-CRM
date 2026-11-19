-- ============================================================================
-- Migration: Lịch hẹn có Thu thêm sau Deposit + Ghi chú Sales — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc: 20261119120000_appointment_visit_status.sql (trigger log bản mới nhất) đã chạy.
-- Chạy TRƯỚC khi deploy code (trang /appointments select 2 cột mới).
--
-- Nội dung:
--   * paid_amount: tiền thu thêm sau Deposit của lịch (IDR, >= 0, null = chưa thu).
--                  Thực thu = customers.deposit_amount + paid_amount (tính ở client).
--   * sales_note : ghi chú của Sales (khác cột note — ghi chú Telesales).
--   * Trigger log theo dõi thêm 2 cột trên.
-- ============================================================================

alter table public.clinic_appointments
  add column if not exists paid_amount bigint,
  add column if not exists sales_note text not null default '';

alter table public.clinic_appointments drop constraint if exists clinic_appointments_paid_amount_check;
alter table public.clinic_appointments
  add constraint clinic_appointments_paid_amount_check check (paid_amount is null or paid_amount >= 0);

comment on column public.clinic_appointments.paid_amount is 'Tiền thu thêm sau Deposit (IDR)';
comment on column public.clinic_appointments.sales_note is 'Ghi chú của Sales';

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

  foreach f in array array['scheduled_at', 'booking_confirm', 'visit_status', 'service_categories', 'service_ids',
    'staff_id', 'sales_id', 'technician_id', 'bill_amount', 'paid_amount', 'note', 'sales_note'] loop
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
-- ROLLBACK (trigger log: chạy lại bản trong 20261119120000):
--   alter table public.clinic_appointments drop column if exists paid_amount;
--   alter table public.clinic_appointments drop column if exists sales_note;
-- ============================================================================
