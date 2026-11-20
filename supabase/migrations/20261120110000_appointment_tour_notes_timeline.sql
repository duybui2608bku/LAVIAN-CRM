-- ============================================================================
-- Migration: Ghi chú lịch hẹn + ghi chú tour chuyển sang timeline — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc: 20261120090000_appointment_sales_notes.sql (cùng định dạng ghi chú) đã chạy.
-- Chạy TRƯỚC khi deploy code (trang /appointments, /customers/bookings, /tour select cột mới).
--
-- Nội dung:
--   * clinic_appointments.notes, tours.notes: mảng ghi chú, mỗi phần tử
--       {id uuid, title text|null, text, at ISO, by tên người ghi|null, by_id profile id|null}
--     (giống clinic_appointments.sales_notes). Server action ghi at / by / by_id.
--   * Chuyển cột note cũ (1 ô text) thành ghi chú đầu tiên. Không biết ai ghi → by/by_id null,
--     thời gian = updated_at. Cột note giữ lại để rollback, code không dùng nữa.
--   * Trigger log lịch hẹn KHÔNG theo dõi notes (ghi chú đã có người ghi + thời gian).
-- ============================================================================

alter table public.clinic_appointments
  add column if not exists notes jsonb not null default '[]'::jsonb;
alter table public.clinic_appointments drop constraint if exists clinic_appointments_notes_check;
alter table public.clinic_appointments
  add constraint clinic_appointments_notes_check check (jsonb_typeof(notes) = 'array');
comment on column public.clinic_appointments.notes is 'Ghi chú lịch hẹn (timeline): [{id, title, text, at, by, by_id}]';

alter table public.tours
  add column if not exists notes jsonb not null default '[]'::jsonb;
alter table public.tours drop constraint if exists tours_notes_check;
alter table public.tours
  add constraint tours_notes_check check (jsonb_typeof(notes) = 'array');
comment on column public.tours.notes is 'Ghi chú tour (timeline): [{id, title, text, at, by, by_id}]';

-- Chuyển dữ liệu cũ — chỉ dòng chưa có ghi chú mới (chạy lại không nhân đôi).
update public.clinic_appointments
set notes = jsonb_build_array(jsonb_build_object(
  'id', gen_random_uuid(), 'title', null, 'text', note,
  'at', to_jsonb(updated_at), 'by', null, 'by_id', null))
where btrim(note) <> '' and notes = '[]'::jsonb;

-- tours có trigger tours_protect_confirmation chặn sửa tour đã xác nhận → tạm tắt khi chuyển dữ liệu.
alter table public.tours disable trigger user;
update public.tours
set notes = jsonb_build_array(jsonb_build_object(
  'id', gen_random_uuid(), 'title', null, 'text', note,
  'at', to_jsonb(updated_at), 'by', null, 'by_id', null))
where btrim(note) <> '' and notes = '[]'::jsonb;
alter table public.tours enable trigger user;

-- ============================================================================
-- ROLLBACK:
--   alter table public.clinic_appointments drop column if exists notes;
--   alter table public.tours drop column if exists notes;
-- ============================================================================
