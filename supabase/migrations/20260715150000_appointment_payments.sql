-- ============================================================================
-- Migration: Sổ thanh toán lịch hẹn (appointment_payments) — LAVIAN-CRM
-- Mỗi lần tiền vào/ra của một lịch hẹn = 1 dòng sổ (cọc / thu / hoàn) kèm
-- phương thức, ảnh chứng từ, ngày thu, người tạo. Dòng sổ bất biến (không update).
-- BREAKING: bỏ cột appointments.deposit_amount — "Đã thu" tính từ sổ;
-- backfill cọc cũ + phần thu của lịch completed vào sổ trước khi drop.
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc migration trước (phải đã chạy):
--   - 20260710130000_appointments.sql (appointments, profiles)
-- ============================================================================

-- 1) Bảng sổ thanh toán --------------------------------------------------------
create table if not exists public.appointment_payments (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  kind           text not null check (kind in ('deposit','payment','refund')),
  amount         numeric(12,2) not null check (amount > 0),
  payment_method text check (payment_method in ('bank','cash','card')),
  image_url      text, -- public URL bucket images (ảnh chứng từ)
  note           text,
  paid_at        timestamptz not null default now(),
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists appointment_payments_appt_idx
  on public.appointment_payments (appointment_id, paid_at desc);

-- 2) RLS + grant (mọi user đăng nhập — đồng nhất appointments) -----------------
alter table public.appointment_payments enable row level security;

drop policy if exists appointment_payments_all on public.appointment_payments;
create policy appointment_payments_all on public.appointment_payments
  for all to authenticated using (true) with check (true);

-- Không grant update: dòng sổ bất biến — sửa sai = xóa + thêm lại.
grant select, insert, delete on public.appointment_payments to authenticated;

-- 3) Backfill + drop deposit_amount (chỉ chạy khi cột còn tồn tại → idempotent) -
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appointments'
      and column_name = 'deposit_amount'
  ) then
    -- Cọc cũ → dòng deposit (paid_at = lúc tạo lịch, method best-effort).
    insert into public.appointment_payments
      (appointment_id, kind, amount, payment_method, paid_at, note)
    select id, 'deposit', deposit_amount, payment_method, created_at, 'backfill'
    from public.appointments
    where deposit_amount > 0;

    -- Lịch completed đã chốt final > cọc → phần còn lại coi là 1 lần thu
    -- lúc hoàn tất (để Đã thu sau migration = final, khớp tổng cũ).
    insert into public.appointment_payments
      (appointment_id, kind, amount, payment_method, paid_at, note)
    select id, 'payment', final_amount - deposit_amount, payment_method,
           coalesce(completed_at, updated_at), 'backfill'
    from public.appointments
    where status = 'completed'
      and final_amount is not null
      and final_amount > deposit_amount;

    alter table public.appointments drop column deposit_amount;
  end if;
end $$;

-- ============================================================================
-- ROLLBACK (chạy nếu cần gỡ bỏ — mất phân rã sổ, tổng khôi phục từ dòng backfill):
--   alter table public.appointments
--     add column deposit_amount numeric(12,2) not null default 0;
--   update public.appointments a set deposit_amount = coalesce((
--     select sum(amount) from public.appointment_payments p
--     where p.appointment_id = a.id and p.kind = 'deposit'), 0);
--   drop table if exists public.appointment_payments;
-- ============================================================================
