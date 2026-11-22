-- Mục đích: xem "Lịch sử thao tác" ngay trong drawer thẻ liệu trình (ai sửa số buổi, hoàn, thu / xoá tiền,
--   tạo / sửa / xoá tour...). card_audit đã ghi từ 20261122150000 nhưng chỉ có row_id → không lọc được theo thẻ
--   (tour / khoản thu đã xoá không còn id trong thẻ). Thêm card_id (trigger tự điền + điền lại dữ liệu cũ),
--   ghi thêm khi đổi ngày tour, cho người có quyền xem thẻ (cards.view) đọc nhật ký của thẻ.
-- Thứ tự: SAU 20261122150000_card_controls_commission.sql. Chạy lại an toàn.

alter table public.card_audit add column if not exists card_id uuid;
create index if not exists card_audit_card_idx on public.card_audit (card_id, at) where card_id is not null;

create or replace function public.card_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
begin
  insert into public.card_audit (table_name, row_id, card_id, op, old_row, new_row, actor)
  values (tg_table_name, (r->>'id')::uuid,
    case tg_table_name
      when 'treatment_cards' then (r->>'id')::uuid
      -- Tour bỏ liên kết thẻ: vẫn tính vào thẻ cũ.
      when 'tours' then (select i.card_id from public.treatment_card_items i
                         where i.id = coalesce(n->>'card_item_id', o->>'card_item_id')::uuid)
      else (r->>'card_id')::uuid
    end,
    tg_op, o, n, auth.uid());
  return null;
end;
$$;
revoke execute on function public.card_audit_log() from public, anon, authenticated;

-- Thêm tour_date: đổi ngày tour ảnh hưởng Đến hạn + kỳ tính công.
drop trigger if exists tours_audit on public.tours;
create trigger tours_audit
  after insert or update of tour_date, bill_amount, service_detail, service_session, card_item_id, customer_id, service_id,
    technician_id, confirmed_at, deleted_at or delete
  on public.tours for each row execute function public.card_audit_log();

-- Điền card_id cho dòng ghi trước đó.
update public.card_audit a set card_id = case a.table_name
    when 'treatment_cards' then a.row_id
    when 'tours' then (select i.card_id from public.treatment_card_items i
                       where i.id = coalesce(a.new_row->>'card_item_id', a.old_row->>'card_item_id')::uuid)
    else (coalesce(a.new_row, a.old_row)->>'card_id')::uuid end
where a.card_id is null;

-- Admin đọc hết; người xem được thẻ đọc nhật ký gắn với thẻ.
drop policy if exists card_audit_read on public.card_audit;
create policy card_audit_read on public.card_audit for select to authenticated
  using ((select public.is_admin()) or (card_id is not null and (select public.has_permission('cards.view'))));
