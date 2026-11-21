-- ============================================================================
-- Migration: Bảng dịch vụ mới (bảng giá Sulam) + nhóm dịch vụ lấy từ DB — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Chạy lại an toàn.
-- Phụ thuộc (đã chạy): 20261118140000_service_categories.sql,
--   20261120120000_customer_360.sql, 20261121100000_customer_service_categories.sql.
-- Chạy TRƯỚC khi deploy code nhánh claude/service-cards.
--
-- Nội dung:
--   1. service_groups: nhóm dịch vụ (Alis, Laser, Bibir, Lips Treatment, Eyeliner,
--      Eyeliner Treatment, Sulam Ink, Handle By). id = mã chữ (alis, bibir, laser… giữ
--      nguyên mã cũ) nên customers/clinic_appointments.service_categories không phải đổi.
--   2. DROP bảng services cũ (name_vi/name_en/name_id/category), tạo services mới:
--      group_id + name + price (IDR). Seed theo bảng giá.
--   3. Tour: map service_id cũ → dịch vụ mới cùng tên (12 tour). Lịch hẹn: xoá
--      service_ids (DV chi tiết cũ). customer_needs.service_id cũ → null.
--   4. Bỏ check constraint alis/bibir/laser trên service_categories (nhóm giờ ở DB).
-- ============================================================================

-- 1. Nhóm dịch vụ ------------------------------------------------------------
create table if not exists public.service_groups (
  id         text primary key check (id ~ '^[a-z0-9_]+$'),
  name       text not null,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_service_groups_updated on public.service_groups;
create trigger trg_service_groups_updated
  before update on public.service_groups
  for each row execute function public.set_updated_at();

alter table public.service_groups enable row level security;
drop policy if exists service_groups_read on public.service_groups;
create policy service_groups_read on public.service_groups
  for select to authenticated using (true);
drop policy if exists service_groups_write on public.service_groups;
create policy service_groups_write on public.service_groups
  for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.service_groups to authenticated;

insert into public.service_groups (id, name, sort_order) values
  ('alis', 'Alis', 10),
  ('laser', 'Laser', 20),
  ('bibir', 'Bibir', 30),
  ('lips_treatment', 'Lips Treatment', 40),
  ('eyeliner', 'Eyeliner', 50),
  ('eyeliner_treatment', 'Eyeliner Treatment', 60),
  ('ink', 'Sulam Ink', 70),
  ('handle_by', 'Handle By', 80)
on conflict (id) do nothing;

-- 2. Drop bảng services cũ (chỉ khi còn cấu trúc cũ) ---------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'services' and column_name = 'category') then
    -- Nhớ tên DV cũ của từng tour để map sang DV mới.
    create temp table tour_service_map as
      select t.id as tour_id, s.name_vi as old_name
      from public.tours t join public.services s on s.id = t.service_id;

    -- DV chi tiết cũ trên lịch hẹn: xoá (tắt trigger log để không sinh log giả).
    alter table public.clinic_appointments disable trigger user;
    update public.clinic_appointments set service_ids = '{}' where cardinality(service_ids) > 0;
    alter table public.clinic_appointments enable trigger user;

    alter table public.tours drop constraint if exists tours_service_id_fkey;
    alter table public.customer_needs drop constraint if exists customer_needs_service_id_fkey;
    drop table public.services;
  end if;
end $$;

-- 3. Bảng services mới -----------------------------------------------------------
create table if not exists public.services (
  id         uuid primary key default gen_random_uuid(),
  group_id   text not null references public.service_groups(id) on update cascade on delete restrict,
  name       text not null,
  price      bigint not null default 0 check (price >= 0), -- Rupiah
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, name)
);
create index if not exists services_group_sort_idx on public.services (group_id, sort_order);

drop trigger if exists trg_services_updated on public.services;
create trigger trg_services_updated
  before update on public.services
  for each row execute function public.set_updated_at();

alter table public.services enable row level security;
drop policy if exists services_read on public.services;
create policy services_read on public.services
  for select to authenticated using (true);
drop policy if exists services_write on public.services;
create policy services_write on public.services
  for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.services to authenticated;

insert into public.services (group_id, name, price, sort_order) values
  ('alis', 'Shading', 4000000, 10),
  ('alis', 'Ombre', 6000000, 20),
  ('alis', 'Hairstroke 6D', 5000000, 30),
  ('alis', 'Hairstroke 9D', 9000000, 40),
  ('alis', 'Micro Hairstroke', 11000000, 50),
  ('alis', 'Hairstroke 9D + Shading', 13000000, 60),
  ('alis', 'Natural Soft Brow (best seller)', 17000000, 70),
  ('alis', 'VIP Sulam Alis (best seller)', 22000000, 80),
  ('laser', 'Laser Removal (once)', 1000000, 10),
  ('laser', 'Laser Removal (full treatment)', 4000000, 20),
  ('laser', 'Stem Cell Serum (eyebrow recovery serum)', 500000, 30),
  ('bibir', 'Collagen Lip', 5000000, 10),
  ('bibir', 'Nano Lip', 9000000, 20),
  ('bibir', 'Ombre Effect', 11000000, 30),
  ('bibir', 'Lipstick Effect (salmon DNA + spf)', 13000000, 40),
  ('bibir', 'Sexy Lip (hyaluronic + stemcell)', 20000000, 50),
  ('lips_treatment', 'Dark Lip Treatment', 1000000, 10),
  ('lips_treatment', 'Lip Spray Removal (plasma)', 2000000, 20),
  ('lips_treatment', 'Collagen Stem Cell (night / day)', 500000, 30),
  ('eyeliner', 'Open Eyelids', 1500000, 10),
  ('eyeliner', 'Wing Eyeliner', 3000000, 20),
  ('eyeliner_treatment', 'Laser Removal (once)', 1000000, 10),
  ('eyeliner_treatment', 'Laser Removal (full treatment)', 4000000, 20),
  ('ink', 'Vietnam Ink (2 months guarantee, 1x free retouch)', 0, 10),
  ('ink', 'USA Ink (6 months guarantee, 1x free retouch)', 1500000, 20),
  ('ink', 'Korea Ink (12 months guarantee, 1-2x free retouch)', 2500000, 30),
  ('handle_by', 'Special: Sulam by Grandmaster', 2000000, 10),
  ('handle_by', 'Master', 0, 20)
on conflict (group_id, name) do nothing;

-- 4. Map tour sang DV mới ------------------------------------------------------
do $$
begin
  if to_regclass('pg_temp.tour_service_map') is not null then
    update public.tours t
    set service_id = s.id
    from tour_service_map m
    join public.services s on s.group_id = 'alis' and s.name = case lower(m.old_name)
      when 'shading' then 'Shading'
      when 'ombre' then 'Ombre'
      when 'hairstroke 6d' then 'Hairstroke 6D'
      when 'hairstroke 9d' then 'Hairstroke 9D'
      when 'hairstroke + shading' then 'Hairstroke 9D + Shading'
      when 'micro hairstroke' then 'Micro Hairstroke'
      when 'natural soft brow' then 'Natural Soft Brow (best seller)'
    end -- tên lạ → không map → bước thêm FK dưới báo lỗi, cả migration rollback (không mất tour)
    where t.id = m.tour_id;
    drop table tour_service_map;
  end if;
end $$;

update public.customer_needs n set service_id = null
where service_id is not null and not exists (select 1 from public.services s where s.id = n.service_id);

alter table public.tours drop constraint if exists tours_service_id_fkey;
alter table public.tours
  add constraint tours_service_id_fkey foreign key (service_id) references public.services(id) on delete restrict;
alter table public.customer_needs drop constraint if exists customer_needs_service_id_fkey;
alter table public.customer_needs
  add constraint customer_needs_service_id_fkey foreign key (service_id) references public.services(id) on delete set null;

-- 5. Nhóm dịch vụ trên khách / lịch hẹn: bỏ check cứng alis/bibir/laser -------------
alter table public.customers drop constraint if exists customers_service_categories_check;
alter table public.clinic_appointments drop constraint if exists clinic_appointments_service_categories_check;
comment on column public.customers.service_categories is 'Mã nhóm dịch vụ khách quan tâm (service_groups.id)';
comment on column public.clinic_appointments.service_categories is 'Mã nhóm dịch vụ Telesales chọn khi tạo lịch (service_groups.id)';
