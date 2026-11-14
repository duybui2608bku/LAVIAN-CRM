-- Mục đích: đánh dấu lịch hẹn đã được CSKH gọi lại xác nhận (khách còn nhu cầu, đến đúng ngày).
-- false = Chưa xác nhận (mặc định, kể cả lịch cũ), true = Đã xác nhận. Dùng cho thống kê sau này.
-- Đồng thời cho trigger log theo dõi thêm trường booking_confirm (ai xác nhận, lúc nào).
-- Phụ thuộc: 20261113090000_clinic_appointment_logs.sql. Chạy TRƯỚC khi deploy code. Chạy lại an toàn.

alter table public.clinic_appointments
  add column if not exists booking_confirm boolean not null default false;

comment on column public.clinic_appointments.booking_confirm is
  'CSKH đã liên hệ lại xác nhận lịch hẹn (true = Đã xác nhận)';

create or replace function public.log_clinic_appointment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

  foreach f in array array['scheduled_at', 'booking_confirm', 'checked_in', 'service_ids', 'staff_id', 'note'] loop
    if (o -> f) is distinct from (n -> f) then
      diff := diff || jsonb_build_object(f, jsonb_build_object('old', o -> f, 'new', n -> f));
    end if;
  end loop;

  -- Update chỉ chạm updated_at / cột không theo dõi → không log.
  if act = 'update' and diff = '{}'::jsonb then
    return null;
  end if;

  insert into public.clinic_appointment_logs (appointment_id, customer_id, action, changes, actor_id)
  values (new.id, new.customer_id, act, diff, (select auth.uid()));
  return null;
end;
$$;

revoke execute on function public.log_clinic_appointment_change() from public, anon, authenticated;
