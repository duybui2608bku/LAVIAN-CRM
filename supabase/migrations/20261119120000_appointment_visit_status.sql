-- ============================================================================
-- Migration: Trạng thái lịch hẹn 5 bước (Status) — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc: 20261119110000_appointment_bill_technician.sql (trigger log bản mới nhất)
--            và 20261117150000_customer_stage_purchase.sql (sync_customer_show_up) đã chạy.
-- Chạy TRƯỚC khi deploy code (trang /appointments, /customers select cột mới).
--
-- Nội dung:
--   * visit_status: waiting (Chưa đến) | arrived (Đã đến) | in_progress (Đang thực hiện)
--     | done (Đã thực hiện) | rescheduled (Đổi lịch). Backfill: checked_in → arrived.
--   * checked_in GIỮ LẠI, do trigger BEFORE tự tính = visit_status ∈ (arrived, in_progress, done),
--     nên báo cáo / API / pipeline / sync stage Show-up đang đọc checked_in không phải sửa.
--     Đường cũ chỉ ghi checked_in (lead form insert checked_in=false) được map ngược sang visit_status.
--   * Tạo lại trigger Show-up bắt thêm UPDATE OF visit_status: Postgres chỉ xét cột có trong
--     SET của câu UPDATE, cột do trigger BEFORE đổi không làm trigger "update of checked_in" chạy.
--   * Trigger log theo dõi visit_status thay cho checked_in (log cũ có checked_in vẫn hiển thị).
-- ============================================================================

-- 1. Cột + backfill ---------------------------------------------------------
alter table public.clinic_appointments
  add column if not exists visit_status text not null default 'waiting';
alter table public.clinic_appointments drop constraint if exists clinic_appointments_visit_status_check;
alter table public.clinic_appointments
  add constraint clinic_appointments_visit_status_check
  check (visit_status in ('waiting', 'arrived', 'in_progress', 'done', 'rescheduled'));

comment on column public.clinic_appointments.visit_status is
  'Status lịch hẹn: waiting | arrived | in_progress | done | rescheduled (Sales đổi). checked_in tính từ cột này.';

-- Tắt trigger user để backfill không sinh log / không chạm stage khách.
alter table public.clinic_appointments disable trigger user;
update public.clinic_appointments set visit_status = 'arrived'
where checked_in and visit_status = 'waiting';
alter table public.clinic_appointments enable trigger user;

-- 2. Trigger BEFORE: checked_in luôn khớp visit_status -----------------------
create or replace function public.sync_appointment_checked_in()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.checked_in and new.visit_status in ('waiting', 'rescheduled') then
      new.visit_status := 'arrived';
    else
      new.checked_in := new.visit_status in ('arrived', 'in_progress', 'done');
    end if;
  elsif new.visit_status is distinct from old.visit_status then
    new.checked_in := new.visit_status in ('arrived', 'in_progress', 'done');
  elsif new.checked_in is distinct from old.checked_in then
    new.visit_status := case when new.checked_in then 'arrived' else 'waiting' end;
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_appointment_checked_in() from public, anon, authenticated;

drop trigger if exists clinic_appointments_sync_checked_in on public.clinic_appointments;
create trigger clinic_appointments_sync_checked_in
  before insert or update on public.clinic_appointments
  for each row execute function public.sync_appointment_checked_in();

-- 3. Trigger Show-up bắt cả visit_status ------------------------------------
drop trigger if exists clinic_appointments_sync_show_up on public.clinic_appointments;
create trigger clinic_appointments_sync_show_up
  after insert or update of checked_in, visit_status, deleted_at on public.clinic_appointments
  for each row execute function public.sync_customer_show_up();

-- 4. Trigger log theo dõi visit_status ---------------------------------------
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
-- ROLLBACK (chạy nếu cần gỡ bỏ — trigger log: chạy lại bản trong 20261119110000), theo đúng thứ tự:
--   drop trigger if exists clinic_appointments_sync_show_up on public.clinic_appointments;
--   create trigger clinic_appointments_sync_show_up
--     after insert or update of checked_in, deleted_at on public.clinic_appointments
--     for each row execute function public.sync_customer_show_up();
--   drop trigger if exists clinic_appointments_sync_checked_in on public.clinic_appointments;
--   drop function if exists public.sync_appointment_checked_in();
--   alter table public.clinic_appointments drop column if exists visit_status;
-- ============================================================================
