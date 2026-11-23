-- ============================================================================
-- Migration: Mã thẻ theo dịch vụ chính + Hoàn cả thẻ + Xoá DV (OpenSpec: card-code-refund-delete) — LAVIAN-CRM
-- Copy toàn bộ file vào Supabase SQL Editor, chạy 1 lần. Chạy lại an toàn.
-- Thứ tự: SAU 20261123140000_tour_roadmap_planned.sql, 20261123120000_card_item_one_per_group.sql,
--   20261123110000_card_payment_limits.sql. Chạy TRƯỚC khi deploy code (code select treatment_cards.refunded_at).
--
-- Nội dung:
--   1. treatment_cards: cột hoàn thẻ (refunded_at, refunded_by, refund_amount, refund_method, refund_note).
--   2. Mã thẻ = tiền tố DV chính + số thứ tự chung ≥ 4 chữ số (ALIS0013, BIBIR0014). Thẻ cũ TLT000nn đổi mã, giữ số.
--   3. RPC create_treatment_card đặt mã theo DV chính (DV tạo tour giá cao nhất).
--   4. RPC refund_treatment_card: hoàn cả thẻ (tiền ≤ đã thu), xoá tour dự kiến.
--   5. RPC delete_treatment_card_item: xoá 1 DV chưa có tour thật (nhật ký card_audit tự ghi DELETE).
--   6. Guard: thẻ đã hoàn không sửa / thu tiền / thêm DV / gắn tour được nữa.
--   7. journey_due_source (Đến hạn): bỏ thẻ đã hoàn.
-- Tiền thẻ đã hoàn (lib/cards.ts cardMoney): Đã thu = cọc trừ + Σ thanh toán − tiền hoàn; Giá trị = Đã thu; Công nợ = 0.
-- ============================================================================

-- 1. Cột hoàn thẻ ----------------------------------------------------------------------------------
alter table public.treatment_cards add column if not exists refunded_at timestamptz;
alter table public.treatment_cards add column if not exists refunded_by uuid references public.profiles(id) on delete set null;
alter table public.treatment_cards add column if not exists refund_amount bigint;
alter table public.treatment_cards add column if not exists refund_method text;
alter table public.treatment_cards add column if not exists refund_note text not null default '';
create index if not exists treatment_cards_refunded_by_idx on public.treatment_cards (refunded_by);

alter table public.treatment_cards drop constraint if exists treatment_cards_refund_check;
alter table public.treatment_cards add constraint treatment_cards_refund_check check (
  ((refunded_at is null) = (refund_amount is null))
  and (refund_amount is null or refund_amount >= 0)
  and (refund_method is null or refund_method in ('cash', 'bank', 'card'))
  and length(refund_note) <= 2000
);

-- 2. Mã thẻ -----------------------------------------------------------------------------------------
-- Nhóm xoá cũ quy về vùng (khớp AREA ở lib/cards.ts); nhóm khác = id nhóm viết hoa, bỏ "_".
create or replace function public.card_code_prefix(p_group text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(replace(case p_group
    when 'laser' then 'alis'
    when 'lips_treatment' then 'bibir'
    when 'eyeliner_treatment' then 'eyeliner'
    else coalesce(nullif(p_group, ''), 'lv') end, '_', ''));
$$;
revoke execute on function public.card_code_prefix(text) from public, anon;

-- Số thứ tự ≥ 4 chữ số (lpad cắt chuỗi dài hơn → không dùng lpad trần).
create or replace function public.card_code_number(p_no bigint)
returns text
language sql
immutable
set search_path = ''
as $$ select lpad(p_no::text, greatest(4, length(p_no::text)), '0'); $$;
revoke execute on function public.card_code_number(bigint) from public, anon;

alter table public.treatment_cards alter column code
  set default 'LV' || public.card_code_number(nextval('public.treatment_card_code_seq'));

-- Thẻ cũ TLT000nn → <DV chính><nnnn>. Chạy lại: không còn mã TLT → bỏ qua.
update public.treatment_cards c
set code = coalesce((
    select public.card_code_prefix(s.group_id)
    from public.treatment_card_items i join public.services s on s.id = i.service_id
    where i.card_id = c.id
    order by s.tourable desc, i.price desc, i.created_at
    limit 1
  ), 'LV') || public.card_code_number(substr(c.code, 4)::bigint)
where c.code ~ '^TLT[0-9]+$';

-- 3. RPC tạo thẻ: đặt mã theo DV chính -----------------------------------------------------------------
create or replace function public.create_treatment_card(
  p_customer_id uuid, p_appointment_id uuid, p_items jsonb, p_note text default ''
) returns public.treatment_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deposit bigint;
  v_used bigint;
  v_total bigint;
  v_prefix text;
  v_card public.treatment_cards;
begin
  if not public.has_permission('cards.edit') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'card_needs_items' using errcode = 'P0001';
  end if;

  -- Khoá dòng khách: 2 người tạo thẻ cùng lúc không trừ trùng cọc.
  select coalesce(deposit_amount, 0)::bigint into v_deposit
  from public.customers where id = p_customer_id and deleted_at is null for update;
  if not found then raise exception 'customer_not_found' using errcode = 'P0001'; end if;

  if p_appointment_id is not null and not exists (
    select 1 from public.clinic_appointments
    where id = p_appointment_id and customer_id = p_customer_id and deleted_at is null
      and visit_status in ('arrived', 'in_progress', 'done')
  ) then
    raise exception 'appointment_not_arrived' using errcode = 'P0001';
  end if;

  select coalesce(sum(deposit_used), 0) into v_used
  from public.treatment_cards where customer_id = p_customer_id and cancelled_at is null;
  select coalesce(sum(x.price), 0) into v_total from jsonb_to_recordset(p_items) as x(price bigint);

  -- DV chính = dòng tạo tour giá cao nhất (không có → dòng giá cao nhất).
  select public.card_code_prefix(s.group_id) into v_prefix
  from jsonb_to_recordset(p_items) as x(service_id uuid, price bigint)
  join public.services s on s.id = x.service_id
  order by s.tourable desc, x.price desc
  limit 1;

  insert into public.treatment_cards (code, customer_id, appointment_id, deposit_used, note, created_by)
  values (coalesce(v_prefix, 'LV') || public.card_code_number(nextval('public.treatment_card_code_seq')),
    p_customer_id, p_appointment_id, least(greatest(v_deposit - v_used, 0), v_total), coalesce(p_note, ''), auth.uid())
  returning * into v_card;

  insert into public.treatment_card_items (card_id, service_id, price, sessions, created_by)
  select v_card.id, x.service_id, x.price, coalesce(x.sessions, 1), auth.uid()
  from jsonb_to_recordset(p_items) as x(service_id uuid, price bigint, sessions smallint);

  update public.customers set stage = 'purchase'
  where id = p_customer_id and stage is distinct from 'purchase';

  return v_card;
end;
$$;
revoke execute on function public.create_treatment_card(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.create_treatment_card(uuid, uuid, jsonb, text) to authenticated;

-- 4. RPC hoàn cả thẻ ------------------------------------------------------------------------------------
-- Tiền hoàn ≤ Đã thu (cọc trừ vào thẻ + Σ thanh toán). Thẻ khoá luôn; tour dự kiến bị xoá (tour thật giữ nguyên).
create or replace function public.refund_treatment_card(
  p_card_id uuid, p_amount bigint, p_method text, p_note text default ''
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card record;
  v_paid bigint;
begin
  if not public.has_permission('cards.edit') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id, deposit_used, cancelled_at, refunded_at into v_card
  from public.treatment_cards where id = p_card_id for update;
  if not found or v_card.cancelled_at is not null or v_card.refunded_at is not null then
    raise exception 'card_cancelled' using errcode = 'P0001';
  end if;
  select coalesce(sum(amount), 0) into v_paid from public.treatment_card_payments where card_id = p_card_id;
  if p_amount is null or p_amount < 0 or p_amount > v_card.deposit_used + v_paid then
    raise exception 'refund_over_paid' using errcode = 'P0001';
  end if;

  update public.treatment_cards
  set refunded_at = now(), refunded_by = auth.uid(), refund_amount = p_amount,
      refund_method = case when p_amount > 0 then p_method end, refund_note = coalesce(p_note, '')
  where id = p_card_id;

  delete from public.tours
  where planned and card_item_id in (select id from public.treatment_card_items where card_id = p_card_id);
end;
$$;
revoke execute on function public.refund_treatment_card(uuid, bigint, text, text) from public, anon;
grant execute on function public.refund_treatment_card(uuid, bigint, text, text) to authenticated;

-- 5. RPC xoá 1 DV khỏi thẻ ------------------------------------------------------------------------------
-- Chỉ DV chưa có tour thật (chưa xoá); thẻ phải còn DV khác (hết DV → huỷ / hoàn thẻ).
-- Tour dự kiến + tour đã xoá mềm của DV bị xoá hẳn (FK restrict) — nhật ký card_audit vẫn giữ.
create or replace function public.delete_treatment_card_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card uuid;
begin
  if not public.has_permission('cards.edit') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select card_id into v_card from public.treatment_card_items where id = p_item_id;
  if not found then raise exception 'item_refunded' using errcode = 'P0001'; end if;
  perform 1 from public.treatment_cards
  where id = v_card and cancelled_at is null and refunded_at is null for update;
  if not found then raise exception 'card_cancelled' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.treatment_card_items where card_id = v_card and id <> p_item_id) then
    raise exception 'card_needs_items' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.tours where card_item_id = p_item_id and deleted_at is null and not planned) then
    raise exception 'item_has_tours' using errcode = 'P0001';
  end if;

  delete from public.tours where card_item_id = p_item_id;
  delete from public.treatment_card_items where id = p_item_id;
end;
$$;
revoke execute on function public.delete_treatment_card_item(uuid) from public, anon;
grant execute on function public.delete_treatment_card_item(uuid) to authenticated;

-- 6. Guard: thẻ đã hoàn bị khoá ---------------------------------------------------------------------------
create or replace function public.treatment_cards_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.cancelled_at is not null or old.refunded_at is not null then
    raise exception 'card_cancelled' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Sửa dòng DV (số buổi): thẻ đã huỷ / hoàn → chặn (trừ admin), như DV đã hoàn.
create or replace function public.treatment_card_items_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() and (old.refunded_at is not null or exists (
    select 1 from public.treatment_cards where id = old.card_id and (cancelled_at is not null or refunded_at is not null)
  )) then
    raise exception 'item_refunded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Thêm DV: thẻ đã huỷ / hoàn → chặn; mỗi nhóm 1 DV tạo tour (như 20261123120000).
create or replace function public.treatment_card_items_group_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group text;
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
  return new;
end;
$$;

-- Thu tiền: thẻ đã hoàn → chặn; giới hạn như 20261123110000.
create or replace function public.treatment_card_payments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cancelled timestamptz;
  v_refunded  timestamptz;
  v_deposit   bigint;
  v_value     bigint;
  v_paid      bigint;
begin
  new.created_by := auth.uid();
  if not public.is_admin() then
    new.paid_at := now();
  end if;

  select cancelled_at, refunded_at, deposit_used into v_cancelled, v_refunded, v_deposit
  from public.treatment_cards where id = new.card_id for update;
  if v_cancelled is not null or v_refunded is not null then
    raise exception 'card_cancelled' using errcode = 'P0001';
  end if;

  select coalesce(sum(price - coalesce(refund_amount, 0)), 0) into v_value
  from public.treatment_card_items where card_id = new.card_id;
  select coalesce(sum(amount), 0) into v_paid
  from public.treatment_card_payments where card_id = new.card_id;

  if new.amount > 0 and new.amount > v_value - coalesce(v_deposit, 0) - v_paid then
    raise exception 'payment_over_due' using errcode = 'P0001';
  end if;
  if new.amount < 0 and -new.amount > greatest(v_paid, 0) then
    raise exception 'refund_over_paid' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Tour gắn thẻ: thẻ đã hoàn = như thẻ huỷ (không tạo / gắn tour mới). Còn lại như 20261123100000.
create or replace function public.tours_card_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
begin
  if new.card_item_id is null then
    if tg_op = 'UPDATE' and old.card_item_id is not null and not public.is_admin() then
      raise exception 'tour_card_locked' using errcode = '42501';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if not public.is_admin() and (
      new.card_item_id is distinct from old.card_item_id
      or new.customer_id is distinct from old.customer_id
      or new.service_id is distinct from old.service_id
    ) then
      raise exception 'tour_card_locked' using errcode = '42501';
    end if;
    if new.card_item_id = old.card_item_id and new.customer_id = old.customer_id and new.service_id = old.service_id then
      return new;
    end if;
  end if;
  select c.customer_id, c.cancelled_at, c.refunded_at as card_refunded_at, i.service_id, i.refunded_at into v
  from public.treatment_card_items i join public.treatment_cards c on c.id = i.card_id
  where i.id = new.card_item_id
  for update of i;
  if not found or v.cancelled_at is not null or v.card_refunded_at is not null or v.refunded_at is not null
     or v.customer_id is distinct from new.customer_id or v.service_id is distinct from new.service_id then
    raise exception 'tour_card_mismatch' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.treatment_cards_guard() from public, anon, authenticated;
revoke execute on function public.treatment_card_items_guard() from public, anon, authenticated;
revoke execute on function public.treatment_card_items_group_guard() from public, anon, authenticated;
revoke execute on function public.treatment_card_payments_guard() from public, anon, authenticated;
revoke execute on function public.tours_card_guard() from public, anon, authenticated;

-- 7. Đến hạn: bỏ thẻ đã hoàn (còn lại như 20261123140000) ----------------------------------------------
create or replace function public.journey_due_source(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cards as (
    select c.id, c.customer_id from public.treatment_cards c where c.cancelled_at is null and c.refunded_at is null
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
