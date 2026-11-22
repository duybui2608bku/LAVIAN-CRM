-- ============================================================================
-- Migration: Thẻ liệu trình (OpenSpec: treatment-cards) — LAVIAN-CRM
-- Copy toàn bộ file vào Supabase SQL Editor, chạy 1 lần. Chạy lại an toàn.
-- Phụ thuộc (đã chạy): 20261121120000_service_catalog_v2.sql (bảng services mới),
--   20261106120000_tours.sql, 20261113150100_department_permissions.sql.
-- Chạy TRƯỚC khi deploy code nhánh claude/treatment-cards.
--
-- Nội dung:
--   1. treatment_cards: thẻ của khách (mã TLT00001), lịch hẹn bán thẻ, cọc đã trừ vào thẻ, huỷ thẻ.
--   2. treatment_card_items: dịch vụ trong thẻ — giá bán (snapshot, sửa được = giảm giá), số buổi, hoàn DV.
--   3. treatment_card_payments: các lần thu tiền (âm = hoàn tiền khách).
--   4. RPC create_treatment_card: tạo thẻ + dòng DV trong 1 transaction; cọc của khách chỉ trừ 1 lần
--      (thẻ mới nhận phần cọc chưa dùng ở thẻ khác chưa huỷ); khách → stage purchase.
--   5. tours.card_item_id: tour gắn dòng DV của thẻ (lộ trình).
--   6. Quyền cards.* cho bộ phận Sales (view/edit), Master (view).
-- Tiền: Giá trị thẻ = Σ giá bán − Σ tiền hoàn; Đã thu = cọc trừ + Σ thanh toán; Công nợ = hiệu (tính ở lib/cards.ts).
-- ============================================================================

-- 1. Thẻ ----------------------------------------------------------------------
create sequence if not exists public.treatment_card_code_seq;

create table if not exists public.treatment_cards (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique default 'TLT' || lpad(nextval('public.treatment_card_code_seq')::text, 5, '0'),
  customer_id    uuid not null references public.customers(id) on delete restrict,
  appointment_id uuid references public.clinic_appointments(id) on delete set null, -- lịch hẹn bán thẻ (Sales Management)
  deposit_used   bigint not null default 0 check (deposit_used >= 0), -- cọc của khách trừ vào thẻ này (IDR)
  note           text not null default '' check (length(note) <= 10000),
  cancelled_at   timestamptz,
  cancelled_by   uuid references public.profiles(id) on delete set null,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter sequence public.treatment_card_code_seq owned by public.treatment_cards.code;
create index if not exists treatment_cards_customer_idx on public.treatment_cards (customer_id);
-- 1 lịch hẹn chỉ có 1 thẻ đang hiệu lực (bán thêm → thêm DV vào thẻ đó).
create unique index if not exists treatment_cards_appointment_uidx on public.treatment_cards (appointment_id)
  where appointment_id is not null and cancelled_at is null;
create index if not exists treatment_cards_cancelled_by_idx on public.treatment_cards (cancelled_by);
create index if not exists treatment_cards_created_by_idx on public.treatment_cards (created_by);

drop trigger if exists trg_treatment_cards_updated on public.treatment_cards;
create trigger trg_treatment_cards_updated
  before update on public.treatment_cards
  for each row execute function public.set_updated_at();

-- 2. Dịch vụ trong thẻ ------------------------------------------------------------
create table if not exists public.treatment_card_items (
  id            uuid primary key default gen_random_uuid(),
  card_id       uuid not null references public.treatment_cards(id) on delete cascade,
  service_id    uuid not null references public.services(id) on delete restrict,
  price         bigint not null check (price >= 0), -- giá bán lúc bán (IDR), không đổi khi bảng giá đổi
  sessions      smallint not null default 1 check (sessions between 1 and 100), -- số buổi của liệu trình
  refunded_at   timestamptz,
  refund_amount bigint check (refund_amount >= 0),
  refund_note   text not null default '' check (length(refund_note) <= 2000),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint treatment_card_items_refund_check check (
    (refunded_at is null and refund_amount is null)
    or (refunded_at is not null and refund_amount is not null and refund_amount <= price)
  )
);
create index if not exists treatment_card_items_card_idx on public.treatment_card_items (card_id);
create index if not exists treatment_card_items_service_idx on public.treatment_card_items (service_id);
create index if not exists treatment_card_items_created_by_idx on public.treatment_card_items (created_by);

-- 3. Thanh toán -----------------------------------------------------------------
create table if not exists public.treatment_card_payments (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.treatment_cards(id) on delete cascade,
  amount     bigint not null check (amount <> 0), -- âm = hoàn tiền cho khách
  method     text not null check (method in ('cash', 'bank', 'card')),
  paid_at    timestamptz not null default now(),
  note       text not null default '' check (length(note) <= 2000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists treatment_card_payments_card_idx on public.treatment_card_payments (card_id);
create index if not exists treatment_card_payments_created_by_idx on public.treatment_card_payments (created_by);

-- RLS: CRM nội bộ như tours — mọi nhân viên active xem/ghi; quyền chi tiết ở server action (cards.*).
do $$
declare t text;
begin
  foreach t in array array['treatment_cards', 'treatment_card_items', 'treatment_card_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff', t);
    execute format($p$create policy %I on public.%I for all to authenticated
      using (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'))
      with check (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'))$p$,
      t || '_staff', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end $$;
-- Thẻ chỉ huỷ (cancelled_at), DV chỉ hoàn; thanh toán nhập nhầm thì admin xoá được.
grant delete on public.treatment_card_payments to authenticated;
grant usage on sequence public.treatment_card_code_seq to authenticated;

-- 4. RPC tạo thẻ ------------------------------------------------------------------
-- p_items: [{"service_id": uuid, "price": int, "sessions": int}, ...]. SECURITY INVOKER → vẫn qua RLS.
create or replace function public.create_treatment_card(
  p_customer_id uuid, p_appointment_id uuid, p_items jsonb, p_note text default ''
) returns public.treatment_cards
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deposit bigint;
  v_used bigint;
  v_card public.treatment_cards;
begin
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

  insert into public.treatment_cards (customer_id, appointment_id, deposit_used, note, created_by)
  values (p_customer_id, p_appointment_id, greatest(v_deposit - v_used, 0), coalesce(p_note, ''), auth.uid())
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

-- 5. Tour gắn thẻ -------------------------------------------------------------------
alter table public.tours add column if not exists card_item_id uuid
  references public.treatment_card_items(id) on delete restrict;
create index if not exists tours_card_item_idx on public.tours (card_item_id);

-- 6. Quyền bộ phận ----------------------------------------------------------------
update public.department_permissions
set permissions = array(select distinct unnest(permissions || array['cards.view', 'cards.edit']))
where department = 'sales';
update public.department_permissions
set permissions = array(select distinct unnest(permissions || array['cards.view']))
where department = 'technician';
