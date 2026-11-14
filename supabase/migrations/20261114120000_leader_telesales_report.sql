-- Migration: Báo cáo Leader Telesales (OpenSpec: leader-telesales-report)
--
-- Mục đích:
--   1. clinic_appointments.booking_confirm: boolean → text 4 trạng thái
--      pending (Chờ xác nhận) · confirmed (Đã xác nhận) · cancelled (Khách hủy) · rescheduled (Đổi lịch).
--      Dữ liệu cũ: true → confirmed, false → pending. Log lịch sử (clinic_appointment_logs.changes) đổi tương tự.
--   2. Đổi tên bộ phận: customer_care → telesales, customer_care_leader → telesales_leader
--      (đổi nhãn enum — profiles + department_permissions tự theo, không mất dữ liệu).
--   3. profiles.smax_user_id: ID nhân viên trên SMAX (ghép số hội thoại xử lý) + seed 3 nhân viên.
--   4. Quyền mới telesales.view (trang /reports/telesales) cấp cho telesales_leader.
--
-- Thứ tự: SAU 20261114090000_appointment_booking_confirm.sql và 20261113150100_department_permissions.sql.
-- ⚠ Code cũ KHÔNG chạy với DB mới (và ngược lại): chạy file này NGAY khi deploy code mới.
-- Chạy lại an toàn.

begin;

-- 1. Trạng thái xác nhận lịch -------------------------------------------------------------------
do $$ begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'clinic_appointments' and column_name = 'booking_confirm') = 'boolean' then
    alter table public.clinic_appointments alter column booking_confirm drop default;
    alter table public.clinic_appointments
      alter column booking_confirm type text
      using case when booking_confirm then 'confirmed' else 'pending' end;
  end if;
end $$;

alter table public.clinic_appointments alter column booking_confirm set default 'pending';
alter table public.clinic_appointments alter column booking_confirm set not null;

do $$ begin
  alter table public.clinic_appointments
    add constraint clinic_appointments_booking_confirm_check
    check (booking_confirm in ('pending', 'confirmed', 'cancelled', 'rescheduled'));
exception when duplicate_object then null;
end $$;

comment on column public.clinic_appointments.booking_confirm is
  'Trạng thái CSKH/Telesales xác nhận lịch: pending | confirmed | cancelled | rescheduled';

-- Log cũ lưu boolean → đổi sang trạng thái mới (chỉ chạm dòng còn boolean).
update public.clinic_appointment_logs
set changes = jsonb_set(changes, '{booking_confirm}', jsonb_build_object(
  'old', case jsonb_typeof(changes -> 'booking_confirm' -> 'old')
           when 'boolean' then to_jsonb(case when (changes -> 'booking_confirm' ->> 'old')::boolean then 'confirmed' else 'pending' end)
           else changes -> 'booking_confirm' -> 'old' end,
  'new', case jsonb_typeof(changes -> 'booking_confirm' -> 'new')
           when 'boolean' then to_jsonb(case when (changes -> 'booking_confirm' ->> 'new')::boolean then 'confirmed' else 'pending' end)
           else changes -> 'booking_confirm' -> 'new' end))
where 'boolean' in (jsonb_typeof(changes -> 'booking_confirm' -> 'old'), jsonb_typeof(changes -> 'booking_confirm' -> 'new'));

-- 2. Đổi tên bộ phận ----------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_enum where enumtypid = 'public.user_department'::regtype and enumlabel = 'customer_care') then
    alter type public.user_department rename value 'customer_care' to 'telesales';
  end if;
  if exists (select 1 from pg_enum where enumtypid = 'public.user_department'::regtype and enumlabel = 'customer_care_leader') then
    alter type public.user_department rename value 'customer_care_leader' to 'telesales_leader';
  end if;
end $$;

-- 3. ID nhân viên SMAX --------------------------------------------------------------------------
alter table public.profiles add column if not exists smax_user_id text;
comment on column public.profiles.smax_user_id is 'user_id nhân viên trên SMAX (ghép số hội thoại xử lý)';
create unique index if not exists profiles_smax_user_id_key on public.profiles (smax_user_id) where smax_user_id is not null;

update public.profiles p
set smax_user_id = s.smax_id
from (values
  ('50e79eea-6276-4f66-b26c-fdbf08527713'::uuid, '6a632201de8a302ce1dcec0f'),
  ('1f76fe3f-0151-4b5b-b2fb-9a9442095c28'::uuid, '6a811194f1bc59f54aee4d14'),
  ('d3d13222-8fe8-4219-939e-be02af2284dc'::uuid, '6a811330709a5ca9ce9099ed')
) as s (id, smax_id)
where p.id = s.id
  and p.smax_user_id is null
  and not exists (select 1 from public.profiles x where x.smax_user_id = s.smax_id);

-- 4. Quyền xem báo cáo Leader Telesales ---------------------------------------------------------
update public.department_permissions
set permissions = array_append(permissions, 'telesales.view')
where department = 'telesales_leader' and not ('telesales.view' = any (permissions));

commit;

-- Kiểm tra sau khi chạy:
--   select booking_confirm, count(*) from public.clinic_appointments group by 1;
--   select enum_range(null::public.user_department);
--   select user_name, department, smax_user_id from public.profiles where smax_user_id is not null;
--   select department, permissions from public.department_permissions;
