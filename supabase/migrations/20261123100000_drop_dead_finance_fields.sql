-- Mục đích: tài chính chỉ còn ở thẻ liệu trình → drop các cột tiền / ghi chú đời cũ không còn tác dụng.
--   clinic_appointments: bill_amount, paid_amount (0 dòng có giá trị), note, sales_note (đã chuyển sang notes / sales_notes jsonb).
--   tours: bill_amount (= giá dòng thẻ, app đọc qua embed treatment_card_items.price), payment_method,
--          note (đã chuyển sang notes), claimed_at, confirmed_by (chỉ ghi, không ai đọc; lịch sử ở card_audit).
-- Tiền cọc GIỮ ở customers (deposit_amount, payment_confirm_url).
-- Thứ tự: deploy code mới TRƯỚC, rồi chạy file này. Chạy lại an toàn (idempotent).
-- Nhật ký cũ (clinic_appointment_logs.changes, card_audit) vẫn giữ nguyên các key cũ để xem lịch sử.

-- 0. Tiền tour đọc từ dòng thẻ → người có quyền tour / báo cáo (vd. Master) phải đọc được treatment_card_items.
--    Ghi đè policy của 20261122130000_rls_by_permission.sql (chạy lại file đó thì chạy lại file này sau).
drop policy if exists treatment_card_items_read on public.treatment_card_items;
create policy treatment_card_items_read on public.treatment_card_items for select to authenticated
  using ((select public.has_permission('cards.view', 'cards.edit', 'cards.delete',
    'tour.view', 'tour.edit', 'tour.delete', 'reports.view')));

-- 1. Trigger log lịch hẹn: bỏ 4 cột sắp drop khỏi danh sách theo dõi.
create or replace function public.log_clinic_appointment_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
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

  foreach f in array array['scheduled_at', 'booking_confirm', 'visit_status', 'service_categories', 'service_ids',
    'staff_id', 'sales_id', 'technician_id'] loop
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
$function$;

-- 2. Guard tour thẻ: bỏ điều kiện bill_amount (tiền tour không còn lưu ở tour).
create or replace function public.tours_card_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
$function$;

-- 3. Khoá tour đã xác nhận: bỏ confirmed_by.
create or replace function public.tours_protect_confirmation()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() and (
    old.confirmed_at is not null
    or new.confirmed_at is distinct from old.confirmed_at
  ) then
    raise exception 'Tour đã xác nhận — chỉ admin được sửa' using errcode = '42501';
  end if;
  return new;
end;
$function$;

-- 4. Nhật ký thẻ cho tour: tạo lại trigger không còn cột bill_amount (trigger phụ thuộc cột → phải tạo lại trước khi drop).
drop trigger if exists tours_audit on public.tours;
create trigger tours_audit
  after insert or update of tour_date, service_detail, service_session, card_item_id, customer_id, service_id,
    technician_id, confirmed_at, deleted_at or delete
  on public.tours for each row execute function public.card_audit_log();

-- 5. Drop cột (check constraint / default / FK của cột tự mất theo).
alter table public.clinic_appointments
  drop column if exists bill_amount,
  drop column if exists paid_amount,
  drop column if exists note,
  drop column if exists sales_note;

alter table public.tours
  drop column if exists bill_amount,
  drop column if exists payment_method,
  drop column if exists note,
  drop column if exists claimed_at,
  drop column if exists confirmed_by;
