-- ============================================================================
-- Migration: Chặn thu tiền vượt giá trị thẻ liệu trình — LAVIAN-CRM
-- Copy toàn bộ file vào Supabase SQL Editor, chạy 1 lần. Chạy lại an toàn (create or replace).
-- Phụ thuộc (đã chạy): 20261122150000_card_controls_commission.sql (trigger treatment_card_payments_guard).
--
-- Quy tắc (khớp paymentRange ở lib/cards.ts):
--   - Thu (amount > 0): không vượt Công nợ = Σ(giá bán − tiền hoàn DV) − (cọc trừ vào thẻ + Σ thanh toán).
--   - Hoàn (amount < 0): không vượt Σ thanh toán đã thu (cọc không hoàn qua đây).
-- Khoá dòng thẻ (for update) để 2 người thu cùng lúc không cùng lọt qua.
-- ============================================================================

create or replace function public.treatment_card_payments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cancelled timestamptz;
  v_deposit   bigint;
  v_value     bigint;
  v_paid      bigint;
begin
  new.created_by := auth.uid();
  if not public.is_admin() then
    new.paid_at := now();
  end if;

  select cancelled_at, deposit_used into v_cancelled, v_deposit
  from public.treatment_cards where id = new.card_id for update;
  if v_cancelled is not null then
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
revoke execute on function public.treatment_card_payments_guard() from public, anon, authenticated;
