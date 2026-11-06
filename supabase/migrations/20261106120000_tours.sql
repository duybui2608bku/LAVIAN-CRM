-- Tour kỹ thuật viên: tách khỏi lịch hẹn.
-- Quy trình: CSKH tạo (ngày, khách, dịch vụ) → KTV nhận (technician_id) → KTV điền dịch vụ chi tiết,
-- lần, ảnh, bill, thanh toán → admin xác nhận (confirmed_at). Thực thu = bill × % tính trong code (lib/tours.ts).
-- Trạng thái suy ra: technician_id null = Chờ nhận; confirmed_at null = Chưa xác nhận; còn lại = Đã xác nhận.
-- Chạy sau 20261106100000_clinic_appointments_tour.sql. Chạy lại an toàn.
-- Sau khi deploy code mới, chạy tiếp 20261106120100_drop_appointment_tour_columns.sql.

create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  tour_date date not null default current_date,
  customer_id uuid not null references public.customers(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  service_detail text,
  service_session smallint,
  note text not null default '' check (length(note) <= 10000),
  technician_id uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  before_images text[] not null default '{}',
  after_images text[] not null default '{}',
  extra_images text[] not null default '{}',
  bill_amount bigint check (bill_amount is null or bill_amount >= 0),
  payment_method text check (payment_method in ('cash', 'bank', 'card')),
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Lần bắt buộc với laser/plasma/retouch, không có với new/debt.
  constraint tours_service_detail_check check (
    (service_detail is null and service_session is null)
    or (service_detail in ('new', 'debt') and service_session is null)
    or (service_detail in ('laser', 'plasma', 'retouch') and service_session between 1 and 20)
  )
);

create index if not exists tours_date_idx on public.tours (tour_date) where deleted_at is null;
create index if not exists tours_technician_idx on public.tours (technician_id, tour_date) where deleted_at is null;
create index if not exists tours_unclaimed_idx on public.tours (tour_date) where deleted_at is null and technician_id is null;

drop trigger if exists tours_updated on public.tours;
create trigger tours_updated before update on public.tours
  for each row execute function public.set_updated_at();

-- Chỉ admin được xác nhận / bỏ xác nhận và sửa tour đã xác nhận (chặn cả khi gọi API trực tiếp).
create or replace function public.tours_protect_confirmation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin() and (
    old.confirmed_at is not null
    or new.confirmed_at is distinct from old.confirmed_at
    or new.confirmed_by is distinct from old.confirmed_by
  ) then
    raise exception 'Tour đã xác nhận — chỉ admin được sửa' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists tours_protect_confirmation on public.tours;
create trigger tours_protect_confirmation before update on public.tours
  for each row execute function public.tours_protect_confirmation();

alter table public.tours enable row level security;

-- CRM nội bộ: mọi nhân viên active cùng xem/ghi (quyền chi tiết ở server action + trigger trên).
drop policy if exists tours_staff on public.tours;
create policy tours_staff on public.tours
  for all to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));

-- Chỉ xoá mềm.
revoke all on public.tours from anon, authenticated;
grant select, insert, update on public.tours to authenticated;

-- Chép tour cũ đang nằm trên lịch hẹn (lịch có KTV + dịch vụ). Bỏ qua nếu đã chép hoặc cột cũ đã xoá.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'clinic_appointments' and column_name = 'service_detail') then
    insert into public.tours (tour_date, customer_id, service_id, service_detail, service_session, note,
      technician_id, claimed_at, bill_amount, payment_method, created_by, created_at)
    select (a.scheduled_at at time zone 'Asia/Ho_Chi_Minh')::date, a.customer_id, a.service_ids[1],
      a.service_detail, a.service_session, a.note, a.technician_id, a.updated_at,
      a.bill_amount, a.payment_method, null, a.created_at
    from public.clinic_appointments a
    where a.deleted_at is null and a.technician_id is not null and cardinality(a.service_ids) > 0
      and not exists (select 1 from public.tours t
                      where t.customer_id = a.customer_id and t.created_at = a.created_at);
  end if;
end;
$$;
