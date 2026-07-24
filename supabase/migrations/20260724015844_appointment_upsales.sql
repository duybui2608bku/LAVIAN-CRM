-- Record upsale con của một lịch hẹn.
-- Mỗi record ghi dịch vụ upsale độc lập với dịch vụ gốc của lịch và số tiền.
create table if not exists public.appointment_upsales (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id     uuid not null references public.services(id) on delete restrict,
  amount         numeric(12,2) not null check (amount > 0),
  created_by     uuid not null references public.profiles(id) on delete restrict
                 default auth.uid(),
  created_at     timestamptz not null default now()
);

-- Hỗ trợ trường hợp bản đầu của migration (chưa có service_id) đã được chạy.
alter table public.appointment_upsales
  add column if not exists service_id uuid
  references public.services(id) on delete restrict;
alter table public.appointment_upsales
  alter column service_id set not null;

-- Phiên bản trung gian từng thêm ledger_id; dữ liệu này suy ra được từ appointment.
alter table public.appointment_upsales
  drop column if exists ledger_id;

create index if not exists appointment_upsales_appointment_created_idx
  on public.appointment_upsales (appointment_id, created_at desc);
create index if not exists appointment_upsales_service_idx
  on public.appointment_upsales (service_id);

alter table public.appointment_upsales enable row level security;

-- CRM nội bộ: mọi user đăng nhập được xem upsale cùng dữ liệu lịch hẹn.
drop policy if exists appointment_upsales_select on public.appointment_upsales;
create policy appointment_upsales_select
  on public.appointment_upsales
  for select
  to authenticated
  using (true);

-- Mọi user đăng nhập được ghi khi khách đã đến/hoàn tất.
drop policy if exists appointment_upsales_insert on public.appointment_upsales;
create policy appointment_upsales_insert
  on public.appointment_upsales
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.appointments a
      join public.service_ledgers l on l.id = a.ledger_id
      where a.id = appointment_upsales.appointment_id
        and a.status in ('checked_in', 'completed')
        and a.deleted_at is null
        and l.closed_at is null
    )
    and exists (
      select 1
      from public.services s
      where s.id = appointment_upsales.service_id
        and s.is_active
    )
  );

-- Record bất biến: nhập sai thì người tạo hoặc admin xóa rồi thêm lại.
drop policy if exists appointment_upsales_delete on public.appointment_upsales;
create policy appointment_upsales_delete
  on public.appointment_upsales
  for delete
  to authenticated
  using (
    created_by = (select auth.uid())
    or (select public.is_admin())
  );

grant select, insert, delete on table public.appointment_upsales
  to authenticated;

-- Không grant update: record upsale là bất biến.
revoke update on table public.appointment_upsales from authenticated;

-- Không cho xóa upsale nếu số đã thu sau đó sẽ vượt Tổng giá còn lại.
create or replace function public.prevent_upsale_delete_below_paid()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base_amount numeric;
  remaining_upsales numeric;
  paid_amount numeric;
  target_ledger_id uuid;
begin
  select a.ledger_id
  into target_ledger_id
  from public.appointments a
  where a.id = old.appointment_id;

  select l.total_amount
  into base_amount
  from public.service_ledgers l
  where l.id = target_ledger_id;

  select coalesce(sum(u.amount), 0)
  into remaining_upsales
  from public.appointment_upsales u
  join public.appointments a on a.id = u.appointment_id
  where a.ledger_id = target_ledger_id
    and u.id <> old.id;

  select coalesce(sum(
    case when p.kind = 'refund' then -p.amount else p.amount end
  ), 0)
  into paid_amount
  from public.appointment_payments p
  where p.ledger_id = target_ledger_id;

  if paid_amount > coalesce(base_amount, 0) + remaining_upsales then
    raise exception
      'Không thể xóa upsale vì số đã thu sẽ vượt Tổng giá. Hãy điều chỉnh thanh toán trước.';
  end if;
  return old;
end;
$$;
revoke execute on function public.prevent_upsale_delete_below_paid()
  from public, anon, authenticated;

drop trigger if exists appointment_upsales_prevent_overpaid_delete
  on public.appointment_upsales;
create trigger appointment_upsales_prevent_overpaid_delete
  before delete on public.appointment_upsales
  for each row execute function public.prevent_upsale_delete_below_paid();

-- ROLLBACK:
--   drop function if exists public.prevent_upsale_delete_below_paid() cascade;
--   drop table if exists public.appointment_upsales;
