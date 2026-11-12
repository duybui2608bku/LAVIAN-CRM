-- Migration: Dọn dẹp + tối ưu DB — LAVIAN-CRM (OpenSpec: db-cleanup)
--
-- Mục đích:
--   1. Drop bảng/function của hệ lịch hẹn + sổ tiền CŨ (đã thay bằng clinic_appointments + tours)
--      và bảng customer_services. Lúc viết (2026-11-12) cả 8 bảng đều 0 dòng, code không còn tham chiếu.
--   2. Drop cột customers.deposit_currency (luôn 'IDR', không ai đọc).
--   3. Xoá dòng enum_options kind stage/source (code dùng hằng số CUSTOMER_OPTIONS).
--   4. Drop index không dùng, thêm index cho FK đang thiếu.
--   5. Gộp policy RLS trùng (profiles, services, enum_options).
--
-- Thứ tự: DEPLOY CODE MỚI TRƯỚC (không còn ghi deposit_currency), rồi chạy file này.
-- Bao trùm 20261112120000_drop_customer_services.sql — chưa chạy file đó cũng được.
-- Chạy lại an toàn (if exists / if not exists / drop policy trước khi tạo).
-- Không dùng CASCADE: nếu còn view/đối tượng lạ phụ thuộc thì báo lỗi và rollback, không xoá ngầm.

begin;

-- 1. Bảng cũ (1 lệnh để Postgres tự xử lý thứ tự FK giữa các bảng này;
--    trigger, policy, index của chúng mất theo bảng).
drop table if exists
  public.appointment_upsales,
  public.appointment_payments,
  public.appointment_status_history,
  public.appointment_services,
  public.money_audit,
  public.appointments,
  public.service_ledgers,
  public.customer_services;

-- Function trigger chỉ phục vụ các bảng trên.
drop function if exists public.enforce_appointment_technician();
drop function if exists public.log_appointment_status();
drop function if exists public.log_ledger_updated();
drop function if exists public.log_payment_deleted();
drop function if exists public.prevent_upsale_delete_below_paid();

-- 2. Cột thừa.
alter table public.customers drop column if exists deposit_currency;

-- 3. Danh mục stage/source đã chuyển vào code; chỉ lost_reason còn quản trị ở /enums.
delete from public.enum_options where kind in ('stage', 'source');

-- 4. Index.
-- Không dùng (lọc/tìm làm client-side; enum_options đã có unique (kind, value)).
drop index if exists public.customers_source_idx;
drop index if exists public.customers_stage_idx;
drop index if exists public.enum_options_kind_idx;
drop index if exists public.profiles_email_idx;
drop index if exists public.profiles_user_name_idx;

-- FK chưa có index (join/lọc theo nhân viên, khách, dịch vụ + xoá dòng cha).
create index if not exists clinic_appointments_staff_idx on public.clinic_appointments (staff_id);
create index if not exists tours_customer_idx on public.tours (customer_id);
create index if not exists tours_service_idx on public.tours (service_id);

-- 5. RLS: mỗi (role, action) chỉ 1 policy permissive; hàm bọc (select ...) để chỉ chạy 1 lần/query.

-- profiles: SELECT = mọi authenticated (đã có profiles_select_authenticated) → bỏ 2 policy SELECT con;
-- ghi chỉ admin, tách khỏi SELECT.
drop policy if exists profiles_select_self on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_admin_write on public.profiles;
drop policy if exists profiles_admin_insert on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert to authenticated with check ((select public.is_admin()));
create policy profiles_admin_update on public.profiles
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy profiles_admin_delete on public.profiles
  for delete to authenticated using ((select public.is_admin()));

-- services: mọi authenticated toàn quyền (từ 20261112110000) → 1 policy ALL là đủ.
drop policy if exists services_read on public.services;
drop policy if exists services_write on public.services;
drop policy if exists services_all on public.services;
create policy services_all on public.services
  for all to authenticated using (true) with check (true);

-- enum_options: đọc = mọi authenticated (giữ enum_options_read); ghi chỉ admin, tách khỏi SELECT.
drop policy if exists enum_options_admin_write on public.enum_options;
drop policy if exists enum_options_admin_insert on public.enum_options;
drop policy if exists enum_options_admin_update on public.enum_options;
drop policy if exists enum_options_admin_delete on public.enum_options;
create policy enum_options_admin_insert on public.enum_options
  for insert to authenticated with check ((select public.is_admin()));
create policy enum_options_admin_update on public.enum_options
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy enum_options_admin_delete on public.enum_options
  for delete to authenticated using ((select public.is_admin()));

commit;
