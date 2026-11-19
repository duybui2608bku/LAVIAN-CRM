-- Mục đích (OpenSpec: follow-up-rules):
--   1. Bỏ tình trạng potential_status `considering` (trùng nghĩa stage Cân nhắc `consider`) — dữ liệu cũ → null.
--   2. Constraint: stage Tiềm năng / Cân nhắc BẮT BUỘC có follow_up_at (lịch nhắc) — chặn mọi đường ghi.
--   3. Trigger ghi nhận chuyển đổi ở MỌI đường đổi stage (lead form, sửa inline, drawer, trigger Show-up):
--      - Rời Tiềm năng / Cân nhắc → luôn xoá follow_up_at; nếu sang deposited / booked / show_up / purchase
--        thì ghi converted_at = now(), potential_status = 'converted'. Sang consulting không tính chuyển đổi.
--      - Quay lại Tiềm năng / Cân nhắc từ stage khác → bỏ potential_status 'converted' (cần lịch nhắc mới).
-- Chạy SAU 20261118150000_follow_up_include_consider.sql. Chạy lại an toàn.
-- Trước khi chạy, kiểm tra không còn khách Tiềm năng / Cân nhắc thiếu lịch nhắc (constraint sẽ báo lỗi):
--   select id, full_name from public.customers where stage in ('potential', 'consider') and follow_up_at is null;

begin;

-- 1. Bỏ tình trạng "considering".
update public.customers set potential_status = null where potential_status = 'considering';

alter table public.customers drop constraint if exists customers_potential_status_check;
alter table public.customers add constraint customers_potential_status_check
  check (potential_status is null or potential_status in ('interested', 'no_response', 'converted'));

-- 2. Tiềm năng / Cân nhắc phải có lịch nhắc.
alter table public.customers drop constraint if exists customers_follow_up_required;
alter table public.customers add constraint customers_follow_up_required
  check (stage not in ('potential', 'consider') or follow_up_at is not null);

-- 3. Ghi nhận chuyển đổi khi đổi stage (BEFORE: sửa luôn dòng đang ghi, chạy trước khi kiểm constraint).
create or replace function public.track_customer_conversion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.stage in ('potential', 'consider') and new.stage not in ('potential', 'consider') then
    new.follow_up_at := null;
    if new.stage in ('deposited', 'booked', 'show_up', 'purchase') then
      new.converted_at := now();
      new.potential_status := 'converted';
    end if;
  elsif new.stage in ('potential', 'consider') and new.potential_status = 'converted' then
    new.potential_status := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.track_customer_conversion() from public, anon, authenticated;

drop trigger if exists customers_track_conversion on public.customers;
create trigger customers_track_conversion
  before update of stage on public.customers
  for each row
  when (old.stage is distinct from new.stage)
  execute function public.track_customer_conversion();

commit;

-- Kiểm tra:
--   select potential_status, count(*) from public.customers group by 1;
--   select conname from pg_constraint where conname = 'customers_follow_up_required';
--   select tgname from pg_trigger where tgname = 'customers_track_conversion';
