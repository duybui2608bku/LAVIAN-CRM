-- ============================================================================
-- Migration: Status lịch hẹn thêm "Hủy lịch" (cancelled) — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc: 20261119120000_appointment_visit_status.sql đã chạy.
-- Chạy TRƯỚC khi deploy code (UI cho chọn Hủy lịch).
--
-- Nội dung:
--   * Check constraint visit_status nhận thêm 'cancelled'.
--   * Trigger sync_appointment_checked_in: cancelled = chưa đến (checked_in = false),
--     insert kiểu cũ checked_in=true + cancelled → arrived (như waiting/rescheduled).
-- ============================================================================

alter table public.clinic_appointments drop constraint if exists clinic_appointments_visit_status_check;
alter table public.clinic_appointments
  add constraint clinic_appointments_visit_status_check
  check (visit_status in ('waiting', 'arrived', 'in_progress', 'done', 'rescheduled', 'cancelled'));

comment on column public.clinic_appointments.visit_status is
  'Status lịch hẹn: waiting | arrived | in_progress | done | rescheduled | cancelled (Sales đổi). checked_in tính từ cột này.';

create or replace function public.sync_appointment_checked_in()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.checked_in and new.visit_status in ('waiting', 'rescheduled', 'cancelled') then
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

-- ============================================================================
-- ROLLBACK (đổi lịch cancelled về waiting trước, rồi chạy lại phần 1–2 của 20261119120000):
--   update public.clinic_appointments set visit_status = 'waiting' where visit_status = 'cancelled';
-- ============================================================================
