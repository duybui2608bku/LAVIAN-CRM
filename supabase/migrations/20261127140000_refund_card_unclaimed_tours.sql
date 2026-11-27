-- Mục đích (openspec card-refund-tour-guard, 2026-11-27) — bug B3 trong docs/analysis/2026-11-27-phan-tich-da-vai-tro.md:
--   1. Hoàn cả thẻ: ngoài xoá tour dự kiến, xoá mềm luôn tour thật chưa có Master nhận (Chờ nhận) — như Huỷ thẻ.
--      Tour đã có Master nhận giữ nguyên (admin xử lý tay).
--   2. tours_card_guard: chặn nhận / gán Master (technician_id null → có) cho tour của thẻ đã huỷ / hoàn hoặc dòng DV
--      đã hoàn → raise 'card_cancelled'. Chặn ở DB nên gọi REST thẳng cũng không lọt.
-- Thứ tự chạy: sau 20261127120000_card_tour_single_source.sql. Chạy được trước hay sau deploy code
-- (code chỉ đổi câu báo lỗi). Idempotent — chạy lại an toàn. Dán vào Supabase SQL Editor chạy tay.
-- Dữ liệu cũ: 27/11 đã kiểm — không có tour chưa xoá nào thuộc thẻ huỷ / hoàn → không cần dọn.

-- 1. Hoàn cả thẻ ----------------------------------------------------------------------------------------
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

  -- Tour Chờ nhận: xoá mềm TRƯỚC khi khoá thẻ (sau đó guard chặn mọi lần nhận).
  update public.tours
  set deleted_at = now()
  where not planned and technician_id is null and deleted_at is null
    and card_item_id in (select id from public.treatment_card_items where card_id = p_card_id);

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

-- 2. Không nhận tour của thẻ đã huỷ / hoàn ---------------------------------------------------------------
-- Giữ nguyên logic của 20261123160000 + thêm khối "nhận / gán Master".
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
    -- Nhận / gán Master: thẻ hoặc dòng DV đã huỷ / hoàn → chặn (cả admin).
    if new.technician_id is not null and old.technician_id is null and exists (
      select 1 from public.treatment_card_items i join public.treatment_cards c on c.id = i.card_id
      where i.id = new.card_item_id
        and (c.cancelled_at is not null or c.refunded_at is not null or i.refunded_at is not null)
    ) then
      raise exception 'card_cancelled' using errcode = 'P0001';
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
revoke execute on function public.tours_card_guard() from public, anon, authenticated;
