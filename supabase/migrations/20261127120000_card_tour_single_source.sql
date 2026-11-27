-- Mục đích (openspec card-tour-single-source, 2026-11-27):
--   1. Thẻ Mày hoặc thẻ Môi: 1 thẻ không có cùng lúc DV tạo tour của vùng Mày (alis + laser) và vùng Môi
--      (bibir + lips_treatment) → raise 'card_area_taken'. Thẻ cũ đã lẫn 2 vùng giữ nguyên (chỉ chặn dòng thêm mới).
--   2. Huỷ / Đổi lịch: nguồn duy nhất = clinic_appointments.visit_status; booking_confirm chỉ còn pending / confirmed.
--   3. Master: nguồn duy nhất = tours.technician_id → bỏ cột customers.technician_id + trigger tours_fill_customer_technician.
--      Viết lại trigger điền Master cho lịch hẹn: chỉ lịch cùng khách cùng ngày tour; chạy cả khi đổi ngày / chốt dự kiến /
--      xoá tour; trả / đổi / dời / xoá tour → gỡ Master cũ khỏi lịch (trừ lịch Đang thực hiện / Đã thực hiện).
--   4. Tiền cọc: nguồn duy nhất = customers.deposit_amount → không cho sửa giảm xuống dưới phần đã trừ vào thẻ chưa huỷ
--      (raise 'deposit_below_used').
-- Thứ tự chạy: sau 20261127100000_tour_master_to_appointment.sql.
--   ⚠ DEPLOY CODE TRƯỚC rồi mới chạy file này (code cũ còn đọc customers.technician_id → lỗi khi cột bị xoá).
-- Idempotent — chạy lại an toàn. Dán vào Supabase SQL Editor chạy tay.

-- 1. Thẻ Mày hoặc thẻ Môi (giữ nguyên chặn 1 DV / nhóm của 20261123160000) ------------------------------
create or replace function public.treatment_card_items_group_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group text;
  v_area  text;
begin
  -- Khoá thẻ: 2 người thêm DV cùng lúc không cùng lọt.
  perform 1 from public.treatment_cards
  where id = new.card_id and cancelled_at is null and refunded_at is null for update;
  if not found then
    raise exception 'card_cancelled' using errcode = 'P0001';
  end if;
  select group_id into v_group from public.services where id = new.service_id and tourable;
  if v_group is null then
    return new; -- dòng phụ: không giới hạn
  end if;
  if exists (
    select 1 from public.treatment_card_items i
    join public.services s on s.id = i.service_id
    where i.card_id = new.card_id and i.refunded_at is null and s.tourable and s.group_id = v_group
  ) then
    raise exception 'service_group_taken' using errcode = 'P0001';
  end if;
  -- Vùng chính (khớp AREA / areaTaken ở lib/cards.ts): laser → mày, lips_treatment → môi.
  v_area := case v_group when 'laser' then 'alis' when 'lips_treatment' then 'bibir' else v_group end;
  if v_area in ('alis', 'bibir') and exists (
    select 1 from public.treatment_card_items i
    join public.services s on s.id = i.service_id
    where i.card_id = new.card_id and i.refunded_at is null and s.tourable
      and (case s.group_id when 'laser' then 'alis' when 'lips_treatment' then 'bibir' else s.group_id end) in ('alis', 'bibir')
      and (case s.group_id when 'laser' then 'alis' when 'lips_treatment' then 'bibir' else s.group_id end) <> v_area
  ) then
    raise exception 'card_area_taken' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.treatment_card_items_group_guard() from public, anon, authenticated;

-- 2. Huỷ / Đổi lịch → visit_status ---------------------------------------------------------------------
update public.clinic_appointments
set visit_status = booking_confirm
where booking_confirm in ('cancelled', 'rescheduled') and visit_status = 'waiting';
update public.clinic_appointments
set booking_confirm = 'pending'
where booking_confirm in ('cancelled', 'rescheduled');

alter table public.clinic_appointments drop constraint if exists clinic_appointments_booking_confirm_check;
alter table public.clinic_appointments
  add constraint clinic_appointments_booking_confirm_check check (booking_confirm in ('pending', 'confirmed'));

-- 3. Master: bỏ cột Master của khách, trigger điền lịch hẹn mới ----------------------------------------
drop trigger if exists tours_fill_customer_technician on public.tours;
drop function if exists public.tours_fill_customer_technician();
alter table public.customers drop column if exists technician_id; -- index customers_technician_idx tự xoá theo

create or replace function public.tours_fill_appointment_master()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was boolean := tg_op = 'UPDATE' and old.technician_id is not null and old.deleted_at is null and not old.planned;
  v_is  boolean := new.technician_id is not null and new.deleted_at is null and not new.planned;
begin
  -- Tour rời lịch cũ (trả / đổi Master / dời ngày / đổi khách / xoá / về dự kiến) → gỡ Master cũ khỏi lịch ngày cũ,
  -- trừ lịch Đang / Đã thực hiện (check DB cần Master) hoặc Master đó còn tour thật khác cùng khách cùng ngày.
  if v_was and (not v_is or new.technician_id <> old.technician_id or new.tour_date <> old.tour_date
                or new.customer_id <> old.customer_id) then
    update public.clinic_appointments a
    set technician_id = null
    where a.deleted_at is null
      and a.customer_id = old.customer_id
      and (a.scheduled_at at time zone 'Asia/Ho_Chi_Minh')::date = old.tour_date
      and a.technician_id = old.technician_id
      and a.visit_status not in ('in_progress', 'done')
      and not exists (
        select 1 from public.tours t
        where t.id <> new.id and t.customer_id = old.customer_id and t.tour_date = old.tour_date
          and t.technician_id = old.technician_id and t.deleted_at is null and not t.planned);
  end if;
  -- Tour thật có Master → điền lịch cùng khách cùng ngày chưa có Master.
  if v_is then
    update public.clinic_appointments a
    set technician_id = new.technician_id
    where a.deleted_at is null
      and a.customer_id = new.customer_id
      and (a.scheduled_at at time zone 'Asia/Ho_Chi_Minh')::date = new.tour_date
      and a.technician_id is null;
  end if;
  return new;
end;
$$;
revoke execute on function public.tours_fill_appointment_master() from public, anon, authenticated;

drop trigger if exists tours_fill_appointment_master on public.tours;
create trigger tours_fill_appointment_master
  after insert or update of technician_id, tour_date, planned, deleted_at, customer_id on public.tours
  for each row execute function public.tours_fill_appointment_master();

-- 4. Tiền cọc không thấp hơn phần đã trừ vào thẻ --------------------------------------------------------
create or replace function public.customers_deposit_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.deposit_amount, 0) < coalesce(old.deposit_amount, 0)
     and coalesce(new.deposit_amount, 0) < (
       select coalesce(sum(c.deposit_used), 0) from public.treatment_cards c
       where c.customer_id = new.id and c.cancelled_at is null) then
    raise exception 'deposit_below_used' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.customers_deposit_guard() from public, anon, authenticated;

drop trigger if exists customers_deposit_guard on public.customers;
create trigger customers_deposit_guard
  before update of deposit_amount on public.customers
  for each row execute function public.customers_deposit_guard();
