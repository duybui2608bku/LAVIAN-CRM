-- Mục đích: thông báo realtime (chỉ trên web) cho Quản lý đặt lịch, Quản lý bán hàng, Tour, Thẻ liệu trình,
--   Hành trình điều trị, Tài liệu. OpenSpec `realtime-notifications`.
-- Chạy SAU 20261118090000_customer_reminders_notifications.sql (bảng notifications + realtime). Chạy lại an toàn.
--
-- Chống spam / trùng / sai người — mọi thông báo đi qua notify_users():
--   • chỉ user active, KHÔNG gửi cho người thao tác;
--   • 1 thao tác (1 dòng thay đổi) → tối đa 1 thông báo / người (p_skip = người đã nhận ở bước trước);
--   • cùng đối tượng (`ref`) còn thông báo CHƯA ĐỌC → xoá bản cũ, chỉ giữ bản mới nhất.
-- Chữ hiển thị dựng ở client theo kind + data (lib/notifications.ts).

-- ─────────────────────────── 1. Cột ref + index ───────────────────────────
alter table public.notifications add column if not exists ref text;

create index if not exists notifications_ref_unread_idx
  on public.notifications (ref) where read_at is null and ref is not null;

-- Tổng hợp Hành trình điều trị: 1 / người / ngày (mở nhiều tab cùng lúc cũng không trùng).
create unique index if not exists notifications_journey_digest_uniq
  on public.notifications (user_id, kind, ref) where kind = 'journey_digest';

-- ─────────────────────────── 2. Hàm gửi chung ───────────────────────────
create or replace function public.notify_users(
  p_users uuid[], p_kind text, p_data jsonb, p_link text, p_ref text, p_actor uuid, p_skip uuid[]
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_users uuid[];
begin
  select coalesce(array_agg(p.id), '{}') into v_users
  from public.profiles p
  where p.id = any (p_users)
    and p.status = 'active'
    and p.id is distinct from p_actor
    and not (p.id = any (coalesce(p_skip, '{}')));

  if cardinality(v_users) = 0 then
    return v_users;
  end if;

  if p_ref is not null then
    delete from public.notifications n
    where n.ref = p_ref and n.read_at is null and n.user_id = any (v_users);
  end if;

  insert into public.notifications (user_id, kind, data, link, ref)
  select u, p_kind, p_data, p_link, p_ref from unnest(v_users) u;
  return v_users;
end;
$$;

revoke execute on function public.notify_users(uuid[], text, jsonb, text, text, uuid, uuid[]) from public, anon, authenticated;

-- ─────────────────────────── 3. Lịch hẹn ───────────────────────────
-- Gửi 1 sự kiện lịch hẹn cho Telesales / Sales / Master, mỗi nhóm 1 link mở được theo quyền bộ phận.
create or replace function public.notify_appointment_roles(
  p_tele uuid[], p_sales uuid[], p_master uuid[], p_kind text, p_data jsonb,
  p_customer uuid, p_at timestamptz, p_ref text, p_actor uuid, p_skip uuid[]
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v uuid[] := coalesce(p_skip, '{}');
begin
  v := v || public.notify_users(p_tele, p_kind, p_data, '/customers/bookings', p_ref, p_actor, v);
  v := v || public.notify_users(p_sales, p_kind, p_data, '/appointments?customer=' || p_customer, p_ref, p_actor, v);
  v := v || public.notify_users(p_master, p_kind, p_data,
    '/tour?month=' || to_char(p_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM'), p_ref, p_actor, v);
  return v;
end;
$$;

revoke execute on function public.notify_appointment_roles(uuid[], uuid[], uuid[], text, jsonb, uuid, timestamptz, text, uuid, uuid[])
  from public, anon, authenticated;

-- Ưu tiên trong 1 thao tác: Huỷ > Đến cơ sở > Đổi giờ > Giao Sales > Tạo mới (mỗi người tối đa 1 thông báo).
create or replace function public.notify_appointment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Lead form không có user đăng nhập → người tạo = Telesales đã chọn (created_by).
  v_actor uuid := coalesce(auth.uid(), case when tg_op = 'INSERT' then new.created_by end);
  v_done uuid[] := '{}';
  v_ref text := 'appt:' || new.id;
  v_data jsonb;
  v_sales uuid[];
begin
  if new.deleted_at is not null and (tg_op = 'INSERT' or old.deleted_at is not null) then
    return new;
  end if;

  select jsonb_build_object('customer', c.full_name, 'customer_id', new.customer_id, 'scheduled_at', new.scheduled_at,
           'old_at', case when tg_op = 'UPDATE' then old.scheduled_at end)
    into v_data
  from public.customers c where c.id = new.customer_id;

  -- Huỷ / xoá lịch
  if tg_op = 'UPDATE' and (new.deleted_at is not null
      or (new.visit_status = 'cancelled' and old.visit_status is distinct from 'cancelled')) then
    perform public.notify_appointment_roles(array[new.staff_id], array[new.sales_id], array[new.technician_id],
      'appointment_cancelled', v_data, new.customer_id, new.scheduled_at, v_ref, v_actor, v_done);
    return new;
  end if;

  -- Khách đến cơ sở — chưa có Sales phụ trách → cả bộ phận Sales (cần người ra đón).
  if new.checked_in and (tg_op = 'INSERT' or not old.checked_in) then
    v_sales := case when new.sales_id is not null then array[new.sales_id]
      else array(select p.id from public.profiles p where p.department::text = 'sales') end;
    v_done := public.notify_appointment_roles(array[new.staff_id], v_sales, array[new.technician_id],
      'appointment_arrived', v_data, new.customer_id, new.scheduled_at, v_ref, v_actor, v_done);
  end if;

  -- Đổi giờ hẹn
  if tg_op = 'UPDATE' and new.scheduled_at is distinct from old.scheduled_at then
    v_done := public.notify_appointment_roles(array[new.staff_id], array[new.sales_id], array[new.technician_id],
      'appointment_rescheduled', v_data, new.customer_id, new.scheduled_at, v_ref, v_actor, v_done);
  end if;

  -- Được giao Sales
  if new.sales_id is not null and (tg_op = 'INSERT' or new.sales_id is distinct from old.sales_id) then
    v_done := public.notify_appointment_roles('{}', array[new.sales_id], '{}',
      'appointment_assigned', v_data, new.customer_id, new.scheduled_at, v_ref, v_actor, v_done);
  end if;

  -- Người khác tạo lịch cho khách của Telesales
  if tg_op = 'INSERT' then
    perform public.notify_appointment_roles(array[new.staff_id], '{}', '{}',
      'appointment_created', v_data, new.customer_id, new.scheduled_at, v_ref, v_actor, v_done);
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_appointment_change() from public, anon, authenticated;

-- Không theo dõi technician_id: Master trên lịch hẹn do tour tự điền (tours_fill_appointment_master) → đã báo ở tour.
drop trigger if exists clinic_appointments_notify on public.clinic_appointments;
create trigger clinic_appointments_notify
  after insert or update of scheduled_at, visit_status, checked_in, sales_id, deleted_at on public.clinic_appointments
  for each row execute function public.notify_appointment_change();

-- ─────────────────────────── 4. Tour ───────────────────────────
-- Tour dự kiến (planned) không báo. "Chờ nhận" gộp 1 thông báo / khách / Master (ref theo khách);
-- khách hết tour chờ nhận → gỡ thông báo chờ nhận chưa đọc của mọi Master.
create or replace function public.notify_tour_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_done uuid[] := '{}';
  v_live boolean := new.deleted_at is null and not new.planned;
  v_was boolean := tg_op = 'UPDATE' and old.deleted_at is null and not old.planned;
  v_ref text := 'tour:' || new.id;
  v_link text := '/tour?month=' || to_char(new.tour_date, 'YYYY-MM');
  v_data jsonb;
begin
  if not v_live and not v_was then
    return new;
  end if;

  select jsonb_build_object('customer', c.full_name, 'tour_date', new.tour_date,
           'old_date', case when tg_op = 'UPDATE' then old.tour_date end)
    into v_data
  from public.customers c where c.id = new.customer_id;

  -- Huỷ tour đã có Master
  if v_was and not v_live and old.technician_id is not null then
    v_done := public.notify_users(array[old.technician_id], 'tour_cancelled', v_data, v_link, v_ref, v_actor, v_done);
  end if;

  if v_live and new.technician_id is not null then
    if not v_was or new.technician_id is distinct from old.technician_id then
      -- Người khác chọn Master (Master tự nhận → là người thao tác → không báo)
      v_done := public.notify_users(array[new.technician_id], 'tour_assigned', v_data, v_link, v_ref, v_actor, v_done);
    elsif new.tour_date is distinct from old.tour_date then
      v_done := public.notify_users(array[new.technician_id], 'tour_rescheduled', v_data, v_link, v_ref, v_actor, v_done);
    end if;
  end if;

  -- Tour chờ nhận mới (tạo mới, dự kiến → thật, bị bỏ Master, hoặc đổi ngày)
  if v_live and new.technician_id is null
     and (not v_was or old.technician_id is not null or new.tour_date is distinct from old.tour_date) then
    perform public.notify_users(
      array(select p.id from public.profiles p where p.department::text = 'technician'),
      'tour_pending', v_data, '/tour', 'tour_pending:' || new.customer_id, v_actor, v_done);
  end if;

  -- Hết tour chờ nhận của khách → gỡ thông báo chờ nhận chưa đọc
  if v_was and old.technician_id is null and (not v_live or new.technician_id is not null)
     and not exists (select 1 from public.tours t
                     where t.customer_id = new.customer_id and t.technician_id is null
                       and t.deleted_at is null and not t.planned) then
    delete from public.notifications n
    where n.ref = 'tour_pending:' || new.customer_id and n.read_at is null;
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_tour_change() from public, anon, authenticated;

drop trigger if exists tours_notify on public.tours;
create trigger tours_notify
  after insert or update of technician_id, tour_date, planned, deleted_at on public.tours
  for each row execute function public.notify_tour_change();

-- ─────────────────────────── 5. Thẻ liệu trình ───────────────────────────
-- Bán thẻ → Telesales của khách. Hoàn tiền → admin + Sales bán thẻ. Huỷ thẻ → Sales bán thẻ.
create or replace function public.notify_card_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_ref text := 'card:' || new.id;
  v_data jsonb;
begin
  select jsonb_build_object('customer', c.full_name, 'code', new.code, 'amount', new.refund_amount)
    into v_data
  from public.customers c where c.id = new.customer_id;

  if tg_op = 'INSERT' then
    perform public.notify_users(
      array(select c.staff_id from public.customers c
            join public.profiles s on s.id = c.staff_id and s.department::text in ('telesales', 'telesales_leader')
            where c.id = new.customer_id),
      'card_created', v_data, '/customers', v_ref, v_actor, '{}');
  elsif new.refunded_at is not null and old.refunded_at is null then
    perform public.notify_users(
      array(select p.id from public.profiles p where p.role = 'admin') || new.created_by,
      'card_refunded', v_data, '/cards', v_ref, v_actor, '{}');
  elsif new.cancelled_at is not null and old.cancelled_at is null then
    perform public.notify_users(array[new.created_by], 'card_cancelled', v_data, '/cards', v_ref, v_actor, '{}');
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_card_change() from public, anon, authenticated;

drop trigger if exists treatment_cards_notify on public.treatment_cards;
create trigger treatment_cards_notify
  after insert or update of refunded_at, cancelled_at on public.treatment_cards
  for each row execute function public.notify_card_change();

-- Hoàn 1 dịch vụ trong thẻ → admin + Sales bán thẻ.
create or replace function public.notify_card_item_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.refunded_at is null or old.refunded_at is not null then
    return new;
  end if;
  perform public.notify_users(
    array(select p.id from public.profiles p where p.role = 'admin') || k.created_by,
    'card_refunded',
    jsonb_build_object('customer', c.full_name, 'code', k.code, 'amount', new.refund_amount, 'service', s.name),
    '/cards', 'card:' || k.id, auth.uid(), '{}')
  from public.treatment_cards k
  join public.customers c on c.id = k.customer_id
  left join public.services s on s.id = new.service_id
  where k.id = new.card_id;
  return new;
end;
$$;

revoke execute on function public.notify_card_item_refund() from public, anon, authenticated;

drop trigger if exists treatment_card_items_notify on public.treatment_card_items;
create trigger treatment_card_items_notify
  after update of refunded_at on public.treatment_card_items
  for each row execute function public.notify_card_item_refund();

-- Thu tiền do người khác nhập → Sales bán thẻ (hoa hồng tính trên tiền thực thu). Số âm = hoàn → thêm admin.
create or replace function public.notify_card_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_users(
    case when new.amount < 0 then array(select p.id from public.profiles p where p.role = 'admin') else '{}' end
      || k.created_by,
    case when new.amount < 0 then 'card_refunded' else 'card_payment' end,
    jsonb_build_object('customer', c.full_name, 'code', k.code, 'amount', abs(new.amount)),
    '/cards', 'card:' || k.id, auth.uid(), '{}')
  from public.treatment_cards k
  join public.customers c on c.id = k.customer_id
  where k.id = new.card_id;
  return new;
end;
$$;

revoke execute on function public.notify_card_payment() from public, anon, authenticated;

drop trigger if exists treatment_card_payments_notify on public.treatment_card_payments;
create trigger treatment_card_payments_notify
  after insert on public.treatment_card_payments
  for each row execute function public.notify_card_payment();

-- ─────────────────────────── 6. Tài liệu ───────────────────────────
-- Tài liệu mới → ai xem được (cùng điều kiện can_view_document), trừ người tạo.
create or replace function public.notify_document_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_users(
    array(select p.id from public.profiles p
          where p.role = 'admin' or cardinality(new.departments) = 0 or p.department = any (new.departments)),
    'document_new',
    jsonb_build_object('title', new.title, 'by', (select p.user_name from public.profiles p where p.id = new.created_by)),
    '/documents/' || new.id, 'doc:' || new.id, coalesce(auth.uid(), new.created_by), '{}');
  return new;
end;
$$;

revoke execute on function public.notify_document_created() from public, anon, authenticated;

drop trigger if exists documents_notify on public.documents;
create trigger documents_notify
  after insert on public.documents
  for each row execute function public.notify_document_created();

-- Trả lời → người viết bình luận gốc; bình luận → tác giả tài liệu (không báo 2 lần). Gộp theo tài liệu.
create or replace function public.notify_document_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc record;
  v_data jsonb;
  v_done uuid[] := '{}';
  v_ref text := 'doc_comment:' || new.document_id;
  v_link text := '/documents/' || new.document_id;
begin
  select d.title, d.created_by into v_doc from public.documents d where d.id = new.document_id;
  v_data := jsonb_build_object('title', v_doc.title,
    'by', (select p.user_name from public.profiles p where p.id = new.user_id));

  if new.parent_id is not null then
    v_done := public.notify_users(array(select c.user_id from public.document_comments c where c.id = new.parent_id),
      'document_reply', v_data, v_link, v_ref, new.user_id, v_done);
  end if;
  perform public.notify_users(array[v_doc.created_by], 'document_comment', v_data, v_link, v_ref, new.user_id, v_done);
  return new;
end;
$$;

revoke execute on function public.notify_document_comment() from public, anon, authenticated;

drop trigger if exists document_comments_notify on public.document_comments;
create trigger document_comments_notify
  after insert on public.document_comments
  for each row execute function public.notify_document_comment();

-- ─────────────────────────── 7. Hành trình điều trị ───────────────────────────
-- Danh sách Đến hạn tự tính ở app (lib/cards.ts journeyDue) → app gọi RPC này lần đầu mở app trong ngày.
-- Chỉ ghi cho chính người gọi (Telesales), ngày ±1 quanh hôm nay, 1 / ngày nhờ unique index.
create or replace function public.notify_journey_digest(p_date date, p_today int, p_overdue int)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, data, link, ref)
  select p.id, 'journey_digest',
         jsonb_build_object('today', greatest(p_today, 0), 'overdue', greatest(p_overdue, 0), 'date', p_date),
         '/customers/journey', p_date::text
  from public.profiles p
  where p.id = (select auth.uid())
    and p.status = 'active'
    and p.department::text in ('telesales', 'telesales_leader')
    and greatest(p_today, 0) + greatest(p_overdue, 0) > 0
    and p_date between (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1 and (now() at time zone 'Asia/Ho_Chi_Minh')::date + 1
  on conflict (user_id, kind, ref) where kind = 'journey_digest' do nothing;
$$;

revoke execute on function public.notify_journey_digest(date, int, int) from public, anon;
grant execute on function public.notify_journey_digest(date, int, int) to authenticated;
