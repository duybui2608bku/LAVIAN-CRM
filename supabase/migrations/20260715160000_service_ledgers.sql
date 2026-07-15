-- ============================================================================
-- Migration: Sổ tiền theo (khách hàng, dịch vụ) — service_ledgers — LAVIAN-CRM
-- Một liệu trình = 1 sổ: tổng giá (total_amount) + các dòng appointment_payments
-- dùng chung cho MỌI lịch hẹn cùng khách + cùng dịch vụ (sửa từ lịch nào cũng là
-- sửa cùng 1 sổ). Mỗi cặp chỉ có 1 sổ ĐANG MỞ; Tất toán (closed_at) thì lịch
-- mới cùng dịch vụ mở sổ mới tính từ đầu.
-- BREAKING: bỏ appointments.expected_amount + final_amount — tổng giá dời về sổ;
-- appointment_payments gắn thêm ledger_id, appointment_id chỉ còn là dấu vết
-- buổi thu (nullable — xóa cứng lịch không mất tiền của liệu trình).
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc migration trước (phải đã chạy):
--   - 20260715150000_appointment_payments.sql (appointment_payments)
-- ============================================================================

-- 1) Bảng sổ --------------------------------------------------------------------
create table if not exists public.service_ledgers (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  service_id   uuid not null references public.services(id) on delete restrict,
  total_amount numeric(12,2), -- tổng giá liệu trình (null = chưa báo giá)
  closed_at    timestamptz,   -- null = đang mở; set khi bấm Tất toán
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Mỗi cặp (khách, dịch vụ) chỉ 1 sổ ĐANG MỞ (sổ đã đóng giữ lịch sử mua lại).
create unique index if not exists service_ledgers_open_uq
  on public.service_ledgers (customer_id, service_id)
  where closed_at is null;

drop trigger if exists service_ledgers_updated_at on public.service_ledgers;
create trigger service_ledgers_updated_at
  before update on public.service_ledgers
  for each row execute function public.set_updated_at();

-- 2) RLS + grant (mọi user đăng nhập — đồng nhất appointments) -------------------
alter table public.service_ledgers enable row level security;

drop policy if exists service_ledgers_all on public.service_ledgers;
create policy service_ledgers_all on public.service_ledgers
  for all to authenticated using (true) with check (true);

-- Sổ CÓ update (total_amount, closed_at) — khác dòng tiền bất biến.
grant select, insert, update, delete on public.service_ledgers to authenticated;

-- 3) Cột liên kết ----------------------------------------------------------------
alter table public.appointments
  add column if not exists ledger_id uuid
    references public.service_ledgers(id) on delete set null;

alter table public.appointment_payments
  add column if not exists ledger_id uuid
    references public.service_ledgers(id) on delete cascade;

-- appointment_id chỉ còn là dấu vết buổi thu: nullable + set null khi xóa lịch.
alter table public.appointment_payments alter column appointment_id drop not null;
alter table public.appointment_payments
  drop constraint if exists appointment_payments_appointment_id_fkey;
alter table public.appointment_payments
  add constraint appointment_payments_appointment_id_fkey
  foreign key (appointment_id) references public.appointments(id) on delete set null;

create index if not exists appointment_payments_ledger_idx
  on public.appointment_payments (ledger_id, paid_at desc);

-- 4) Backfill + drop 2 cột tiền (chỉ chạy khi cột còn tồn tại → idempotent) -------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appointments'
      and column_name = 'expected_amount'
  ) then
    -- 4a. Mỗi (khách, dịch vụ) → 1 sổ mở. Lịch nhiều dịch vụ lấy dịch vụ nhỏ
    --     nhất theo id (tất định); tổng giá = coalesce(final, expected) của
    --     lịch MỚI NHẤT có giá trong nhóm (heuristic 1 lần, sửa tay nếu lệch).
    with appt_service as (
      select a.id, a.customer_id, a.created_at,
             coalesce(a.final_amount, a.expected_amount) as price,
             (select s.service_id from public.appointment_services s
               where s.appointment_id = a.id
               order by s.service_id limit 1) as service_id
      from public.appointments a
    )
    insert into public.service_ledgers (customer_id, service_id, total_amount)
    select customer_id, service_id,
           (array_agg(price order by created_at desc)
              filter (where price is not null))[1]
    from appt_service
    where service_id is not null
    group by customer_id, service_id
    on conflict (customer_id, service_id) where closed_at is null do nothing;

    -- 4b. Gắn lịch vào sổ mở của (khách, dịch vụ nhỏ nhất của lịch).
    update public.appointments a
    set ledger_id = l.id
    from public.service_ledgers l
    where a.ledger_id is null
      and l.closed_at is null
      and l.customer_id = a.customer_id
      and l.service_id = (
        select s.service_id from public.appointment_services s
        where s.appointment_id = a.id
        order by s.service_id limit 1
      );

    -- 4c. Dòng tiền theo sổ của lịch nó thuộc về (lịch không dịch vụ → để null,
    --     app hiển thị fallback theo appointment_id, adopt khi lịch có sổ).
    update public.appointment_payments p
    set ledger_id = a.ledger_id
    from public.appointments a
    where p.ledger_id is null
      and p.appointment_id = a.id
      and a.ledger_id is not null;

    -- 4d. BREAKING: tổng giá chỉ còn trên sổ.
    alter table public.appointments drop column expected_amount;
    alter table public.appointments drop column final_amount;
  end if;
end $$;

-- ============================================================================
-- ROLLBACK (chạy nếu cần gỡ — mất chia sẻ sổ, giá per lịch khôi phục từ tổng sổ):
--   alter table public.appointments add column expected_amount numeric(12,2);
--   alter table public.appointments add column final_amount numeric(12,2);
--   update public.appointments a set expected_amount = l.total_amount
--     from public.service_ledgers l where a.ledger_id = l.id;
--   alter table public.appointment_payments drop column if exists ledger_id;
--   delete from public.appointment_payments where appointment_id is null;
--   alter table public.appointment_payments alter column appointment_id set not null;
--   alter table public.appointments drop column if exists ledger_id;
--   drop table if exists public.service_ledgers;
-- ============================================================================
