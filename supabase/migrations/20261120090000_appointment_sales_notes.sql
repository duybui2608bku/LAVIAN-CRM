-- ============================================================================
-- Migration: Ghi chú Sales dạng timeline cho lịch hẹn — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc: 20261119130000_appointment_paid_sales_note.sql (cột sales_note) đã chạy.
-- Chạy TRƯỚC khi deploy code (trang /appointments select cột mới).
--
-- Nội dung:
--   * sales_notes: mảng ghi chú Sales của lịch, mỗi phần tử
--       {id uuid, title text|null, text, at ISO, by tên người ghi|null, by_id profile id|null}
--     Server action ghi at / by / by_id (không tin client).
--   * Chuyển sales_note cũ (1 ô text) thành ghi chú đầu tiên của lịch.
--     Cột sales_note giữ lại để rollback, code không dùng nữa.
--   * Trigger log KHÔNG theo dõi sales_notes (ghi chú đã có người ghi + thời gian).
-- ============================================================================

alter table public.clinic_appointments
  add column if not exists sales_notes jsonb not null default '[]'::jsonb;

alter table public.clinic_appointments drop constraint if exists clinic_appointments_sales_notes_check;
alter table public.clinic_appointments
  add constraint clinic_appointments_sales_notes_check check (jsonb_typeof(sales_notes) = 'array');

comment on column public.clinic_appointments.sales_notes is 'Ghi chú Sales (timeline): [{id, title, text, at, by, by_id}]';

-- Chuyển dữ liệu cũ — chỉ lịch chưa có ghi chú mới (chạy lại không nhân đôi).
update public.clinic_appointments
set sales_notes = jsonb_build_array(jsonb_build_object(
  'id', gen_random_uuid(),
  'title', null,
  'text', sales_note,
  'at', to_jsonb(updated_at),
  'by', null,
  'by_id', null))
where btrim(sales_note) <> '' and sales_notes = '[]'::jsonb;

-- ============================================================================
-- ROLLBACK:
--   alter table public.clinic_appointments drop column if exists sales_notes;
-- ============================================================================
