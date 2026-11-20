-- ============================================================================
-- Migration: Hồ sơ khách 360° (Giai đoạn 1) — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent (chạy lại an toàn).
-- Phụ thuộc: 20261120110000_appointment_tour_notes_timeline.sql (và các migration lịch hẹn trước đó) đã chạy.
-- Chạy TRƯỚC khi deploy code (popup 360°, Drawer Sales, lead-form đọc/ghi các bảng/cột mới).
--
-- Nội dung:
--   1. customer_portrait_entries — chân dung khách, CHỈ THÊM (không policy update/delete = lịch sử bất biến).
--   2. customer_needs — nhu cầu / Upsell pipeline (history jsonb do server append). Không xoá.
--   3. appointment_performers — người thực hiện thêm của lịch (ngoài Master technician_id) + RPC lưu cả danh sách.
--   4. appointment_photos + bucket RIÊNG TƯ 'ba-photos' — ảnh Trước/Sau; Telesales không xem/ghi.
--   5. customers.smax_messages / smax_messages_at — bản chụp 30 tin SMAX lúc gửi lead-form.
--   6. 2 check NOT VALID trên clinic_appointments: Đang thực hiện cần Master/Sales, Đã thực hiện cần Master.
-- ============================================================================

-- Helper: user đang hoạt động được xem/ghi ảnh B/A (admin hoặc bộ phận khác Telesales).
-- SECURITY DEFINER để đọc profiles mà không vướng RLS; dùng chung bảng + storage.
create or replace function public.can_access_ba_photos()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and status = 'active'
      and (role = 'admin' or department is null or department::text not in ('telesales', 'telesales_leader'))
  );
$$;
revoke all on function public.can_access_ba_photos() from public, anon;
grant execute on function public.can_access_ba_photos() to authenticated;

-- ─────────────────────────── 1. Chân dung khách ───────────────────────────
create table if not exists public.customer_portrait_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  field text not null check (field in ('wish', 'pain', 'preference', 'behavior', 'communication', 'personality')),
  text text not null check (char_length(text) between 1 and 1000),
  source text not null check (source in ('customer', 'staff')), -- Khách nói / NV nhận định
  message_ref jsonb check (message_ref is null or jsonb_typeof(message_ref) = 'object'), -- {id, at, text} tin SMAX gốc
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists customer_portrait_entries_customer_idx
  on public.customer_portrait_entries (customer_id, field, created_at desc);
create index if not exists customer_portrait_entries_created_by_idx
  on public.customer_portrait_entries (created_by);
comment on table public.customer_portrait_entries is 'Chân dung khách (chỉ thêm): bản hiện tại = dòng mới nhất của mỗi field';

alter table public.customer_portrait_entries enable row level security;
drop policy if exists customer_portrait_entries_select on public.customer_portrait_entries;
create policy customer_portrait_entries_select on public.customer_portrait_entries
  for select to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));
drop policy if exists customer_portrait_entries_insert on public.customer_portrait_entries;
create policy customer_portrait_entries_insert on public.customer_portrait_entries
  for insert to authenticated
  with check (created_by = (select auth.uid())
    and exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));
revoke all on public.customer_portrait_entries from anon, authenticated;
grant select, insert on public.customer_portrait_entries to authenticated;

-- ─────────────────────────── 2. Nhu cầu / Upsell ───────────────────────────
create table if not exists public.customer_needs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  service_id uuid references public.services(id) on delete set null,
  origin text not null check (origin in ('customer_asked', 'staff_found')),
  status text not null default 'need' check (status in ('need', 'consulting', 'upsell', 'won', 'lost')),
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'), -- [{status, by_id, at}]
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_needs_customer_idx on public.customer_needs (customer_id, created_at desc);
create index if not exists customer_needs_service_idx on public.customer_needs (service_id);
create index if not exists customer_needs_created_by_idx on public.customer_needs (created_by);

drop trigger if exists customer_needs_updated_at on public.customer_needs;
create trigger customer_needs_updated_at before update on public.customer_needs
  for each row execute function public.set_updated_at();

alter table public.customer_needs enable row level security;
drop policy if exists customer_needs_select on public.customer_needs;
create policy customer_needs_select on public.customer_needs
  for select to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));
drop policy if exists customer_needs_insert on public.customer_needs;
create policy customer_needs_insert on public.customer_needs
  for insert to authenticated
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));
drop policy if exists customer_needs_update on public.customer_needs;
create policy customer_needs_update on public.customer_needs
  for update to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));
revoke all on public.customer_needs from anon, authenticated;
grant select, insert, update on public.customer_needs to authenticated;

-- ─────────────────────────── 3. Người thực hiện thêm ───────────────────────────
create table if not exists public.appointment_performers (
  appointment_id uuid not null references public.clinic_appointments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('mapping', 'tattoo', 'assist', 'sales')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (appointment_id, profile_id)
);
create index if not exists appointment_performers_profile_idx on public.appointment_performers (profile_id);
create index if not exists appointment_performers_created_by_idx on public.appointment_performers (created_by);

alter table public.appointment_performers enable row level security;
drop policy if exists appointment_performers_all on public.appointment_performers;
create policy appointment_performers_all on public.appointment_performers
  for all to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));
revoke all on public.appointment_performers from anon, authenticated;
grant select, insert, delete on public.appointment_performers to authenticated;

-- Lưu cả danh sách 1 lần (xoá cũ + thêm mới trong 1 transaction). Server đã kiểm tra bộ phận/vai trò.
-- p_items: [{"profile_id": uuid, "role": text}]
create or replace function public.set_appointment_performers(p_appointment uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.appointment_performers where appointment_id = p_appointment;
  insert into public.appointment_performers (appointment_id, profile_id, role)
  select p_appointment, (x->>'profile_id')::uuid, x->>'role'
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as x;
end;
$$;
revoke all on function public.set_appointment_performers(uuid, jsonb) from public, anon;
grant execute on function public.set_appointment_performers(uuid, jsonb) to authenticated;

-- ─────────────────────────── 4. Ảnh B/A ───────────────────────────
create table if not exists public.appointment_photos (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.clinic_appointments(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind text not null check (kind in ('before', 'after')),
  path text not null unique,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists appointment_photos_customer_idx on public.appointment_photos (customer_id, created_at);
create index if not exists appointment_photos_appointment_idx on public.appointment_photos (appointment_id);
create index if not exists appointment_photos_created_by_idx on public.appointment_photos (created_by);

alter table public.appointment_photos enable row level security;
drop policy if exists appointment_photos_select on public.appointment_photos;
create policy appointment_photos_select on public.appointment_photos
  for select to authenticated using ((select public.can_access_ba_photos()));
drop policy if exists appointment_photos_insert on public.appointment_photos;
create policy appointment_photos_insert on public.appointment_photos
  for insert to authenticated
  with check ((select public.can_access_ba_photos()) and created_by = (select auth.uid()));
drop policy if exists appointment_photos_delete on public.appointment_photos;
create policy appointment_photos_delete on public.appointment_photos
  for delete to authenticated
  using ((select public.can_access_ba_photos()) and (created_by = (select auth.uid()) or (select public.is_admin())));
revoke all on public.appointment_photos from anon, authenticated;
grant select, insert, delete on public.appointment_photos to authenticated;

-- Bucket riêng tư: xem bằng signed URL. Path: <customer_id>/<appointment_id>/<uuid>.<ext>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ba-photos', 'ba-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ba_photos_select on storage.objects;
create policy ba_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'ba-photos' and (select public.can_access_ba_photos()));
drop policy if exists ba_photos_insert on storage.objects;
create policy ba_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ba-photos' and (select public.can_access_ba_photos()));
drop policy if exists ba_photos_delete on storage.objects;
create policy ba_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'ba-photos' and (select public.can_access_ba_photos())
    and (owner_id = (select auth.uid())::text or (select public.is_admin())));

-- ─────────────────────────── 5. Bản chụp tin SMAX ───────────────────────────
alter table public.customers add column if not exists smax_messages jsonb;
alter table public.customers add column if not exists smax_messages_at timestamptz;
comment on column public.customers.smax_messages is 'Bản chụp tối đa 30 tin SMAX gần nhất lúc gửi lead-form (ChatMessage[]) — dữ liệu AI GĐ2 + dự phòng';

-- ─────────────────────────── 6. Ràng buộc trạng thái lịch ───────────────────────────
-- NOT VALID: không kiểm tra lịch cũ; mọi lần ghi mới phải thoả.
alter table public.clinic_appointments drop constraint if exists clinic_appointments_done_needs_master;
alter table public.clinic_appointments add constraint clinic_appointments_done_needs_master
  check (visit_status <> 'done' or technician_id is not null) not valid;
alter table public.clinic_appointments drop constraint if exists clinic_appointments_in_progress_needs_staff;
alter table public.clinic_appointments add constraint clinic_appointments_in_progress_needs_staff
  check (visit_status <> 'in_progress' or technician_id is not null or sales_id is not null) not valid;

-- ============================================================================
-- ROLLBACK:
--   alter table public.clinic_appointments drop constraint if exists clinic_appointments_done_needs_master;
--   alter table public.clinic_appointments drop constraint if exists clinic_appointments_in_progress_needs_staff;
--   alter table public.customers drop column if exists smax_messages, drop column if exists smax_messages_at;
--   drop policy if exists ba_photos_select on storage.objects;
--   drop policy if exists ba_photos_insert on storage.objects;
--   drop policy if exists ba_photos_delete on storage.objects;
--   -- (xoá file trong bucket qua Dashboard Storage trước) delete from storage.buckets where id = 'ba-photos';
--   drop table if exists public.appointment_photos;
--   drop function if exists public.set_appointment_performers(uuid, jsonb);
--   drop table if exists public.appointment_performers;
--   drop table if exists public.customer_needs;
--   drop table if exists public.customer_portrait_entries;
--   drop function if exists public.can_access_ba_photos();
-- ============================================================================
