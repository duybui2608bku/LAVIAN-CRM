-- Mục đích (OpenSpec: card-controls-commission):
--   (A) Dịch vụ không tạo tour (mực, phí Master/Grandmaster, Serum) — services.tourable.
--   (C) Bịt lỗ tiền thẻ liệu trình ở DB: trước đây policy ghi `for all` theo cards.edit → Sales gọi REST
--       sửa/xoá được thanh toán, giá, cọc, người tạo thẻ, bỏ huỷ thẻ. Hoa hồng Sales/Master dựa trên các cột
--       này nên phải khoá. Thêm nhật ký card_audit (chỉ admin đọc).
--   RPC create_treatment_card: security definer + kiểm cards.edit; cọc trừ vào thẻ ≤ giá trị thẻ.
-- Thứ tự: SAU 20261122140000_reports_read_card_money.sql. Chạy TRƯỚC khi deploy code (code select services.tourable).
-- Chạy lại an toàn. Tương thích code cũ (code cũ chỉ ghi đúng các cột/luồng còn được phép).

-- 1. Dịch vụ không tạo tour ------------------------------------------------------------------------
alter table public.services add column if not exists tourable boolean not null default true;
comment on column public.services.tourable is 'false = dòng phụ (mực, phí Master, sản phẩm): không tạo tour, không tính buổi / Đến hạn';
-- Lần đầu: mực + phí Master/Grandmaster + Serum. Sửa sau ở Bảng giá (ô "Tạo tour").
update public.services set tourable = false
where tourable and (group_id in ('ink', 'handle_by') or name ilike '%serum%');

-- 2. Thẻ: tạo chỉ qua RPC; chỉ admin sửa, chỉ cột huỷ; không bỏ huỷ -------------------------------
revoke insert, update, delete on public.treatment_cards from authenticated;
grant update (cancelled_at, cancelled_by) on public.treatment_cards to authenticated;
drop policy if exists treatment_cards_write on public.treatment_cards;
drop policy if exists treatment_cards_cancel on public.treatment_cards;
create policy treatment_cards_cancel on public.treatment_cards for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.treatment_cards_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.cancelled_at is not null then
    raise exception 'card_cancelled' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists treatment_cards_guard on public.treatment_cards;
create trigger treatment_cards_guard before update on public.treatment_cards
  for each row execute function public.treatment_cards_guard();

-- 3. Dòng DV: chỉ sửa số buổi + hoàn; không xoá; DV đã hoàn không sửa lại (trừ admin) ----------------
revoke update, delete on public.treatment_card_items from authenticated;
grant update (sessions, refunded_at, refund_amount, refund_note) on public.treatment_card_items to authenticated;

create or replace function public.treatment_card_items_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.refunded_at is not null and not public.is_admin() then
    raise exception 'item_refunded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists treatment_card_items_guard on public.treatment_card_items;
create trigger treatment_card_items_guard before update on public.treatment_card_items
  for each row execute function public.treatment_card_items_guard();

-- 4. Thanh toán: chỉ thêm (người thu = người đăng nhập, ngày thu = now trừ admin); xoá chỉ admin ------
revoke update on public.treatment_card_payments from authenticated;
drop policy if exists treatment_card_payments_write on public.treatment_card_payments;
drop policy if exists treatment_card_payments_insert on public.treatment_card_payments;
drop policy if exists treatment_card_payments_delete on public.treatment_card_payments;
create policy treatment_card_payments_insert on public.treatment_card_payments for insert to authenticated
  with check ((select public.has_permission('cards.edit')));
create policy treatment_card_payments_delete on public.treatment_card_payments for delete to authenticated
  using ((select public.is_admin()));

create or replace function public.treatment_card_payments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_by := auth.uid();
  if not public.is_admin() then
    new.paid_at := now();
  end if;
  if exists (select 1 from public.treatment_cards where id = new.card_id and cancelled_at is not null) then
    raise exception 'card_cancelled' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists treatment_card_payments_guard on public.treatment_card_payments;
create trigger treatment_card_payments_guard before insert on public.treatment_card_payments
  for each row execute function public.treatment_card_payments_guard();

-- 5. Tour: tạo chỉ từ thẻ (cards.edit); khớp thẻ; khoá cột tiền / thẻ với người không phải admin ----------
drop policy if exists tours_insert on public.tours;
create policy tours_insert on public.tours for insert to authenticated
  with check ((select public.has_permission('cards.edit')) and card_item_id is not null);

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
      or new.bill_amount is distinct from old.bill_amount
      or new.customer_id is distinct from old.customer_id
      or new.service_id is distinct from old.service_id
    ) then
      raise exception 'tour_card_locked' using errcode = '42501';
    end if;
    if new.card_item_id = old.card_item_id and new.customer_id = old.customer_id and new.service_id = old.service_id then
      return new;
    end if;
  end if;
  -- Tour mới / đổi liên kết: khớp thẻ. Khoá dòng DV → hoàn DV chạy song song phải chờ.
  select c.customer_id, c.cancelled_at, i.service_id, i.refunded_at into v
  from public.treatment_card_items i join public.treatment_cards c on c.id = i.card_id
  where i.id = new.card_item_id
  for update of i;
  if not found or v.cancelled_at is not null or v.refunded_at is not null
     or v.customer_id is distinct from new.customer_id or v.service_id is distinct from new.service_id then
    raise exception 'tour_card_mismatch' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists tours_card_guard on public.tours;
create trigger tours_card_guard before insert or update on public.tours
  for each row execute function public.tours_card_guard();

-- 6. Nhật ký thay đổi tiền (chỉ admin đọc; chỉ trigger ghi) ------------------------------------------
create table if not exists public.card_audit (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     uuid not null,
  op         text not null,
  old_row    jsonb,
  new_row    jsonb,
  actor      uuid,
  at         timestamptz not null default now()
);
create index if not exists card_audit_row_idx on public.card_audit (row_id, at);
alter table public.card_audit enable row level security;
revoke all on public.card_audit from anon, authenticated;
grant select on public.card_audit to authenticated;
drop policy if exists card_audit_read on public.card_audit;
create policy card_audit_read on public.card_audit for select to authenticated
  using ((select public.is_admin()));

create or replace function public.card_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.card_audit (table_name, row_id, op, new_row, actor)
    values (tg_table_name, new.id, tg_op, to_jsonb(new), auth.uid());
  elsif tg_op = 'UPDATE' then
    insert into public.card_audit (table_name, row_id, op, old_row, new_row, actor)
    values (tg_table_name, new.id, tg_op, to_jsonb(old), to_jsonb(new), auth.uid());
  else
    insert into public.card_audit (table_name, row_id, op, old_row, actor)
    values (tg_table_name, old.id, tg_op, to_jsonb(old), auth.uid());
  end if;
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['treatment_cards', 'treatment_card_items', 'treatment_card_payments'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I
      for each row execute function public.card_audit_log()', t || '_audit', t);
  end loop;
end $$;
-- Tour: chỉ các cột ảnh hưởng tiền / hoa hồng (ảnh, ghi chú đổi liên tục — không ghi).
drop trigger if exists tours_audit on public.tours;
create trigger tours_audit
  after insert or update of bill_amount, service_detail, service_session, card_item_id, customer_id, service_id,
    technician_id, confirmed_at, deleted_at or delete
  on public.tours for each row execute function public.card_audit_log();

-- Hàm trigger: không ai gọi trực tiếp qua API (trigger không kiểm EXECUTE lúc chạy).
revoke execute on function public.treatment_cards_guard() from public, anon, authenticated;
revoke execute on function public.treatment_card_items_guard() from public, anon, authenticated;
revoke execute on function public.treatment_card_payments_guard() from public, anon, authenticated;
revoke execute on function public.tours_card_guard() from public, anon, authenticated;
revoke execute on function public.card_audit_log() from public, anon, authenticated;

-- 7. RPC tạo thẻ: security definer (bảng thẻ không còn insert trực tiếp) + cọc ≤ giá trị thẻ ------------
-- p_items: [{"service_id": uuid, "price": int, "sessions": int}, ...].
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

  insert into public.treatment_cards (customer_id, appointment_id, deposit_used, note, created_by)
  values (p_customer_id, p_appointment_id, least(greatest(v_deposit - v_used, 0), v_total), coalesce(p_note, ''), auth.uid())
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

-- 8. Nguồn dữ liệu "Đến hạn liệu trình" cho Telesales (không có quyền thẻ / tour) ----------------------
-- Trả đúng cột cần tính kiểm tra laser / dặm (KHÔNG có tiền) + khách (tên, SĐT, Telesales, link chat SMAX)
-- + lịch hẹn sắp tới gần nhất (từ p_since, bỏ lịch huỷ / dời). Không có quyền → null.
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
      where t.deleted_at is null), '[]'::jsonb),
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
