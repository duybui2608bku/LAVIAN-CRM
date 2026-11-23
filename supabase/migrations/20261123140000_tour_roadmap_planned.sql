-- ============================================================================
-- Migration: Tour dự kiến — lộ trình mày tự động (OpenSpec: brow-tour-roadmap) — LAVIAN-CRM
-- Copy toàn bộ file vào Supabase SQL Editor, chạy 1 lần. Chạy lại an toàn.
-- Phụ thuộc (đã chạy): 20261122130000_rls_by_permission.sql, 20261122150000_card_controls_commission.sql,
--   20261123100000_drop_dead_finance_fields.sql.
-- Chạy TRƯỚC khi deploy code nhánh có lộ trình tour.
--
-- Nội dung:
--   1. tours.planned: tour dự kiến do hệ thống sinh (app tự tính lại). Dự kiến thì chưa có KTV, chưa xác nhận.
--   2. RLS tours_insert: thêm tour.edit/delete tạo tour DỰ KIẾN. tours_update: Sales (cards.edit) sửa được tour DỰ KIẾN
--      (sinh lại lộ trình, chốt lịch); tour thật vẫn cần tour.edit/delete.
--   3. RPC journey_due_source (Đến hạn): bỏ tour dự kiến — chỉ tour thật mới là "đã hẹn".
-- ============================================================================

-- 1. Cột + ràng buộc ---------------------------------------------------------------
alter table public.tours add column if not exists planned boolean not null default false;

alter table public.tours drop constraint if exists tours_planned_check;
alter table public.tours add constraint tours_planned_check
  check (not planned or (technician_id is null and confirmed_at is null));

-- 2. RLS tạo / sửa tour -------------------------------------------------------------
-- Tạo: như cũ (cards.edit, tour gắn thẻ) + tour.edit được tạo tour DỰ KIẾN (sinh lại lộ trình khi dời / xoá tour).
drop policy if exists tours_insert on public.tours;
create policy tours_insert on public.tours for insert to authenticated
  with check (
    card_item_id is not null and (
      (select public.has_permission('cards.edit'))
      or (planned and (select public.has_permission('tour.edit', 'tour.delete')))
    )
  );

drop policy if exists tours_update on public.tours;
create policy tours_update on public.tours for update to authenticated
  using (
    (select public.has_permission('tour.edit', 'tour.delete'))
    or (planned and (select public.has_permission('cards.edit')))
  )
  with check (
    (select public.has_permission('tour.edit', 'tour.delete'))
    or ((select public.has_permission('cards.edit')) and technician_id is null and confirmed_at is null)
  );

-- 3. Nguồn Đến hạn: bỏ tour dự kiến ------------------------------------------------
create or replace function public.journey_due_source(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cards as (
    select c.id, c.customer_id from public.treatment_cards c where c.cancelled_at is null
  )
  select jsonb_build_object(
    'cards', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'customer_id', c.customer_id, 'cancelled_at', null,
        'items', (select coalesce(jsonb_agg(jsonb_build_object(
            'id', i.id, 'service_id', i.service_id, 'sessions', i.sessions, 'refunded_at', i.refunded_at,
            'service', jsonb_build_object('group_id', s.group_id, 'tourable', s.tourable))), '[]'::jsonb)
          from public.treatment_card_items i join public.services s on s.id = i.service_id
          where i.card_id = c.id)))
      from cards c), '[]'::jsonb),
    'tours', coalesce((select jsonb_agg(jsonb_build_object(
        'card_item_id', t.card_item_id, 'tour_date', t.tour_date,
        'service_detail', t.service_detail, 'service_session', t.service_session))
      from public.tours t
      join public.treatment_card_items i on i.id = t.card_item_id
      join cards c on c.id = i.card_id
      where t.deleted_at is null and not t.planned), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(jsonb_build_object(
        'id', k.id, 'full_name', k.full_name, 'phone', k.phone, 'staff_id', k.staff_id,
        'thread_link', k.thread ->> 'link',
        'next_at', (select min(a.scheduled_at) from public.clinic_appointments a
          where a.customer_id = k.id and a.deleted_at is null and a.scheduled_at >= p_since
            and a.visit_status is distinct from 'cancelled' and a.visit_status is distinct from 'rescheduled')))
      from public.customers k
      where k.id in (select customer_id from cards)), '[]'::jsonb)
  )
  where public.has_permission('customers.view', 'cards.view');
$$;
revoke execute on function public.journey_due_source(timestamptz) from public, anon;
grant execute on function public.journey_due_source(timestamptz) to authenticated;

-- Kiểm tra:
--   select column_name, data_type, column_default from information_schema.columns
--   where table_schema = 'public' and table_name = 'tours' and column_name = 'planned';
--   select polname, pg_get_expr(polqual, polrelid) from pg_policy where polrelid = 'public.tours'::regclass;
