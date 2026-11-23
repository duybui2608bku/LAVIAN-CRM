-- ============================================================================
-- Migration: Mỗi nhóm chỉ 1 dịch vụ tạo tour trong 1 thẻ liệu trình — LAVIAN-CRM
-- Copy toàn bộ file vào Supabase SQL Editor, chạy 1 lần. Chạy lại an toàn.
-- Phụ thuộc (đã chạy): 20261122100000_treatment_cards.sql, services.tourable (service catalog).
--
-- Quy tắc (khớp groupTaken ở lib/cards.ts): thêm dòng DV tạo tour (services.tourable) vào thẻ mà thẻ đã có
-- dòng DV tạo tour CHƯA HOÀN cùng services.group_id → raise 'service_group_taken'.
-- Dòng phụ (mực, phí Master, sản phẩm — tourable = false) không tính. DV đã hoàn không chặn (bán lại kiểu khác được).
-- Áp cho cả RPC create_treatment_card (nhiều dòng 1 lệnh insert: trigger BEFORE ROW thấy các dòng trước của lệnh).
-- Chỉ chặn khi INSERT; dữ liệu cũ không bị ảnh hưởng.
-- ============================================================================

create or replace function public.treatment_card_items_group_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group text;
begin
  select group_id into v_group from public.services where id = new.service_id and tourable;
  if v_group is null then
    return new; -- dòng phụ: không giới hạn
  end if;
  -- Khoá thẻ: 2 người thêm DV cùng lúc không cùng lọt.
  perform 1 from public.treatment_cards where id = new.card_id for update;
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
revoke execute on function public.treatment_card_items_group_guard() from public, anon, authenticated;

drop trigger if exists treatment_card_items_group_guard on public.treatment_card_items;
create trigger treatment_card_items_group_guard before insert on public.treatment_card_items
  for each row execute function public.treatment_card_items_group_guard();
