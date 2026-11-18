-- ============================================================================
-- Migration: Nhóm dịch vụ (Sulam Alis / Sulam Bibir / Laser) — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc: 20261117160000_appointment_sales_created_by.sql (trigger log) đã chạy.
-- Chạy TRƯỚC khi deploy code (trang /appointments, /services select cột mới).
--
-- Nội dung:
--   * services.category: dịch vụ hiện có = dịch vụ chi tiết của 1 nhóm (bắt buộc).
--     Backfill: tên có "lip" → bibir, "laser" → laser, còn lại → alis
--     (VIP Sulam alis + nano lip, USA Ink, Korea Ink → alis theo yêu cầu).
--   * clinic_appointments.service_categories: Telesales chọn nhóm (nhiều) khi tạo lịch;
--     dịch vụ chi tiết (service_ids) điền sau. Backfill lịch cũ từ nhóm của service_ids.
--   * Trigger log theo dõi thêm service_categories.
-- ============================================================================

-- 1. services.category ------------------------------------------------------
alter table public.services add column if not exists category text;

update public.services
set category = case
  when name_vi ilike 'VIP%' then 'alis'
  when name_vi ilike '%lip%' then 'bibir'
  when name_vi ilike '%laser%' then 'laser'
  else 'alis'
end
where category is null;

alter table public.services alter column category set not null;
alter table public.services drop constraint if exists services_category_check;
alter table public.services
  add constraint services_category_check check (category in ('alis', 'bibir', 'laser'));

comment on column public.services.category is 'Nhóm dịch vụ: alis (Sulam Alis) | bibir (Sulam Bibir) | laser';

-- 2. clinic_appointments.service_categories ---------------------------------
alter table public.clinic_appointments
  add column if not exists service_categories text[] not null default '{}';
alter table public.clinic_appointments drop constraint if exists clinic_appointments_service_categories_check;
alter table public.clinic_appointments
  add constraint clinic_appointments_service_categories_check
  check (service_categories <@ array['alis', 'bibir', 'laser']::text[]);

comment on column public.clinic_appointments.service_categories is 'Nhóm dịch vụ Telesales chọn khi tạo lịch (alis | bibir | laser)';

-- Backfill lịch cũ (chỉ lịch chưa có nhóm). Tắt trigger log để không sinh log "update" giả.
alter table public.clinic_appointments disable trigger user;
update public.clinic_appointments a
set service_categories = c.cats
from (
  select a2.id, array_agg(distinct s.category order by s.category) as cats
  from public.clinic_appointments a2
  join public.services s on s.id = any(a2.service_ids)
  group by a2.id
) c
where a.id = c.id and cardinality(a.service_categories) = 0;
alter table public.clinic_appointments enable trigger user;

-- 3. Trigger log theo dõi thêm service_categories ---------------------------
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

  foreach f in array array['scheduled_at', 'booking_confirm', 'checked_in', 'service_categories', 'service_ids', 'staff_id', 'sales_id', 'note'] loop
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
-- ROLLBACK (chạy nếu cần gỡ bỏ — trigger log: chạy lại bản trong 20261117160000):
--   alter table public.clinic_appointments drop column if exists service_categories;
--   alter table public.services drop column if exists category;
-- ============================================================================
