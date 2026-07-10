-- ============================================================================
-- Migration: Lịch hẹn (appointments) — LAVIAN-CRM
-- 3 bảng: appointments (lịch hẹn + tiền nội bộ, soft-delete),
--         appointment_services (bảng nối nhiều dịch vụ / lịch),
--         appointment_status_history (audit đổi trạng thái — trigger tự ghi).
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc migration trước (phải đã chạy):
--   - 20260707120000_user_management.sql   (profiles)
--   - 20260707140000_customers_and_enums.sql (customers, set_updated_at())
--   - 20260710100000_services.sql          (services)
-- ============================================================================

-- 1) Bảng lịch hẹn ------------------------------------------------------------
-- status do code điều khiển (KHÔNG đưa vào enum_options) — check constraint.
-- scheduled_at NULL = đã cọc nhưng chưa chốt ngày (thay sheet DP CUS).
-- Tiền chỉ là số quản trị nội bộ: expected (Price) / deposit (DP) / final (Paid);
-- Sisa = final - deposit tính ở app, không lưu.
create table if not exists public.appointments (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references public.customers(id) on delete cascade,
  staff_id         uuid references public.profiles(id) on delete set null,
  scheduled_at     timestamptz,
  duration_minutes int not null default 60,
  status           text not null default 'pending_confirmation'
                   check (status in ('pending_confirmation','booked','checked_in','completed','no_show','cancelled')),
  source           text,
  payment_method   text check (payment_method in ('bank','cash','card')),
  deposit_amount   numeric(12,2) not null default 0,
  expected_amount  numeric(12,2),
  final_amount     numeric(12,2),
  booking_note     text,
  internal_note    text,
  confirmed_at     timestamptz,
  checked_in_at    timestamptz,
  completed_at     timestamptz,
  cancelled_at     timestamptz,
  created_by       uuid references public.profiles(id) on delete set null,
  updated_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index if not exists appointments_scheduled_idx
  on public.appointments (scheduled_at) where deleted_at is null;
create index if not exists appointments_staff_scheduled_idx
  on public.appointments (staff_id, scheduled_at) where deleted_at is null;
create index if not exists appointments_customer_scheduled_idx
  on public.appointments (customer_id, scheduled_at desc) where deleted_at is null;
create index if not exists appointments_status_scheduled_idx
  on public.appointments (status, scheduled_at) where deleted_at is null;

drop trigger if exists trg_appointments_updated on public.appointments;
create trigger trg_appointments_updated
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- 2) Bảng nối lịch hẹn ↔ dịch vụ (copy pattern customer_services) --------------
-- service restrict: lịch hẹn là dữ liệu lịch sử — không cho xóa dịch vụ đã dùng
-- (deleteService phía app chặn trước bằng message thân thiện).
create table if not exists public.appointment_services (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id     uuid not null references public.services(id)     on delete restrict,
  created_at     timestamptz not null default now(),
  primary key (appointment_id, service_id)
);

create index if not exists appointment_services_service_idx
  on public.appointment_services (service_id);

-- 3) Lịch sử trạng thái — trigger tự ghi, app không thể quên -------------------
create table if not exists public.appointment_status_history (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  from_status    text,
  to_status      text not null,
  note           text,
  changed_by     uuid references public.profiles(id) on delete set null,
  changed_at     timestamptz not null default now()
);

create index if not exists appointment_status_history_appt_idx
  on public.appointment_status_history (appointment_id, changed_at desc);

create or replace function public.log_appointment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.appointment_status_history (appointment_id, from_status, to_status, changed_by)
  values (new.id, old.status, new.status, auth.uid());
  return new;
end;
$$;

drop trigger if exists trg_appointments_status_history on public.appointments;
create trigger trg_appointments_status_history
  after update of status on public.appointments
  for each row
  when (old.status is distinct from new.status)
  execute function public.log_appointment_status();

-- 4) RLS + grant (mọi user đăng nhập — đồng nhất customers) --------------------
alter table public.appointments enable row level security;

drop policy if exists appointments_all on public.appointments;
create policy appointments_all on public.appointments
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.appointments to authenticated;

alter table public.appointment_services enable row level security;

drop policy if exists appointment_services_all on public.appointment_services;
create policy appointment_services_all on public.appointment_services
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.appointment_services to authenticated;

-- History là audit bất biến: chỉ đọc + chèn (trigger security definer chèn được
-- kể cả không grant, nhưng grant insert để tương lai ghi tay note nếu cần).
alter table public.appointment_status_history enable row level security;

drop policy if exists appointment_status_history_read on public.appointment_status_history;
create policy appointment_status_history_read on public.appointment_status_history
  for select to authenticated using (true);

drop policy if exists appointment_status_history_insert on public.appointment_status_history;
create policy appointment_status_history_insert on public.appointment_status_history
  for insert to authenticated with check (true);

grant select, insert on public.appointment_status_history to authenticated;

-- ============================================================================
-- ROLLBACK (chạy nếu cần gỡ bỏ):
--   drop table if exists public.appointment_status_history;
--   drop table if exists public.appointment_services;
--   drop table if exists public.appointments;
--   drop function if exists public.log_appointment_status();
-- ============================================================================
