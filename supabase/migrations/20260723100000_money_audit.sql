-- ============================================================================
-- Migration: Audit thay đổi tiền (money_audit) — LAVIAN-CRM
-- Ghi vết bất biến 2 thao tác nhạy cảm trên dữ liệu tiền:
--   1) XÓA dòng appointment_payments      → action 'payment_deleted' (snapshot dòng cũ)
--   2) UPDATE service_ledgers khi total_amount / closed_at đổi
--                                          → action 'ledger_updated' (snapshot cũ + mới)
-- Trigger security definer tự ghi (app không thể quên; SQL chạy tay cũng bị ghi).
-- Audit chỉ ghi nhận TỪ LÚC chạy file này trở đi — thay đổi trước đó không có vết.
-- Insert dòng tiền KHÔNG audit (dòng đã tự mang created_by/created_at).
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc migration trước (phải đã chạy):
--   - 20260715150000_appointment_payments.sql (appointment_payments)
--   - 20260715160000_service_ledgers.sql      (service_ledgers)
-- ============================================================================

-- 1) Bảng audit ----------------------------------------------------------------
create table if not exists public.money_audit (
  id         uuid primary key default gen_random_uuid(),
  action     text not null check (action in ('payment_deleted','ledger_updated')),
  record_id  uuid not null, -- id dòng bị tác động (KHÔNG FK — dòng có thể đã xóa)
  old_data   jsonb not null, -- snapshot nguyên dòng trước thao tác (to_jsonb)
  new_data   jsonb,          -- snapshot sau update (null với delete)
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

-- Truy vết chủ yếu theo thời gian; bảng chỉ lớn theo số lần xóa/sửa (hiếm).
create index if not exists money_audit_changed_at_idx
  on public.money_audit (changed_at desc);

-- 2) Trigger: xóa dòng tiền → 'payment_deleted' ---------------------------------
-- Cascade delete (xóa cứng khách → sổ → dòng tiền) cũng kích từng dòng.
create or replace function public.log_payment_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.money_audit (action, record_id, old_data, changed_by)
  values ('payment_deleted', old.id, to_jsonb(old), auth.uid());
  return old;
end;
$$;

drop trigger if exists trg_payment_deleted_audit on public.appointment_payments;
create trigger trg_payment_deleted_audit
  after delete on public.appointment_payments
  for each row execute function public.log_payment_deleted();

-- 3) Trigger: sửa sổ → 'ledger_updated' (CHỈ khi total_amount / closed_at đổi) --
-- Update chỉ chạm updated_at (trigger set_updated_at) không tạo rác audit.
create or replace function public.log_ledger_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.money_audit (action, record_id, old_data, new_data, changed_by)
  values ('ledger_updated', old.id, to_jsonb(old), to_jsonb(new), auth.uid());
  return new;
end;
$$;

drop trigger if exists trg_ledger_updated_audit on public.service_ledgers;
create trigger trg_ledger_updated_audit
  after update on public.service_ledgers
  for each row
  when (old.total_amount is distinct from new.total_amount
     or old.closed_at    is distinct from new.closed_at)
  execute function public.log_ledger_updated();

-- 4) RLS: authenticated CHỈ ĐỌC — không grant insert/update/delete --------------
-- Ghi duy nhất qua 2 trigger security definer (quyền owner, không cần grant).
alter table public.money_audit enable row level security;

drop policy if exists money_audit_read on public.money_audit;
create policy money_audit_read on public.money_audit
  for select to authenticated using (true);

grant select on public.money_audit to authenticated;

-- Supabase default privileges tự GRANT ALL cho anon/authenticated trên bảng mới.
-- Thu hồi để mọi thao tác ghi/sửa/xóa fail RÕ RÀNG (permission denied) thay vì
-- chỉ bị RLS lọc im lặng (204, 0 dòng) — phòng cả trường hợp sau này ai đó thêm
-- policy rộng. Trigger security definer chạy quyền owner nên không ảnh hưởng.
revoke insert, update, delete on public.money_audit from anon, authenticated;

-- ============================================================================
-- SMOKE TEST (tùy chọn — chạy khối dưới SAU migration để kiểm chứng; tự tạo
-- dữ liệu giả rồi dọn sạch, chạy trong SQL Editor với quyền postgres nên
-- changed_by sẽ null — đúng thiết kế):
--
-- do $$
-- declare
--   c uuid; s uuid; l uuid; p uuid; n int;
-- begin
--   insert into public.customers (full_name, phone)
--     values ('__audit_test__', '0') returning id into c;
--   insert into public.services (name_vi)
--     values ('__audit_test__') returning id into s;
--   insert into public.service_ledgers (customer_id, service_id, total_amount)
--     values (c, s, 1000) returning id into l;
--   insert into public.appointment_payments (ledger_id, kind, amount)
--     values (l, 'payment', 500) returning id into p;
--
--   delete from public.appointment_payments where id = p;          -- → payment_deleted
--   update public.service_ledgers set total_amount = 2000 where id = l; -- → ledger_updated
--   update public.service_ledgers set total_amount = 2000 where id = l; -- no-op → KHÔNG ghi
--
--   select count(*) into n from public.money_audit
--     where action = 'payment_deleted' and record_id = p;
--   assert n = 1, 'thiếu vết payment_deleted';
--   select count(*) into n from public.money_audit
--     where action = 'ledger_updated' and record_id = l;
--   assert n = 1, 'ledger_updated phải đúng 1 dòng (update no-op không được ghi)';
--
--   -- Dọn: xóa khách cascade sổ (không sinh thêm vết — chỉ update sổ mới ghi),
--   -- rồi xóa dịch vụ + các dòng audit của dữ liệu giả.
--   delete from public.customers where id = c;
--   delete from public.services  where id = s;
--   delete from public.money_audit where record_id in (p, l);
--   raise notice 'money_audit OK';
-- end $$;
--
-- Kiểm chứng "user thường không sửa được audit": chạy với role anon/authenticated
-- (vd. qua supabase-js phía client) update/delete public.money_audit → permission
-- denied (đã revoke grant). SELECT với authenticated vẫn được.
-- ============================================================================
-- ROLLBACK (chạy nếu cần gỡ bỏ — mất toàn bộ vết đã ghi):
--   drop trigger if exists trg_payment_deleted_audit on public.appointment_payments;
--   drop trigger if exists trg_ledger_updated_audit on public.service_ledgers;
--   drop function if exists public.log_payment_deleted();
--   drop function if exists public.log_ledger_updated();
--   drop table if exists public.money_audit;
-- ============================================================================
