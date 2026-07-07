-- ============================================================================
-- Migration: Enum options (danh mục) + Customers (khách hàng) — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần.
-- Idempotent ở mức hợp lý — chạy lại an toàn.
-- Phụ thuộc migration trước: public.is_admin(), public.profiles
--   (20260707120000_user_management.sql phải đã chạy).
-- Thứ tự: enum_options -> customers -> set_updated_at()+trigger
--         -> RLS/grant -> SEED enum_options.
-- ============================================================================

-- 1) Bảng danh mục enum (admin CRUD, lưu 3 ngôn ngữ) -------------------------
--    kind cố định (stage/source/lost_reason); value CRUD được trong từng kind.
create table if not exists public.enum_options (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('stage', 'source', 'lost_reason')),
  value      text not null,
  label_vi   text not null,
  label_en   text not null,
  label_id   text not null,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, value)  -- chống trùng value trong 1 kind (ràng buộc của danh mục)
);

create index if not exists enum_options_kind_idx
  on public.enum_options (kind, sort_order);

-- 2) Bảng khách hàng --------------------------------------------------------
--    stage/source/lost_reason lưu THẲNG value (text) của enum_options — không FK,
--    lọc trực tiếp không cần join. staff_id -> profiles. notes: jsonb [{text, at}].
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  phone         text not null,
  social_link   text,
  source        text,
  stage         text not null default 'new_lead',
  lost_reason   text,
  staff_id      uuid references public.profiles(id) on delete set null,
  first_contact timestamptz,
  notes         jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Index thường (KHÔNG unique — cho phép trùng, kể cả phone) phục vụ lọc/tìm.
-- ponytail: search tên/phone dùng ilike sẽ seq-scan; thêm pg_trgm nếu dữ liệu lớn.
create index if not exists customers_stage_idx   on public.customers (stage)             where deleted_at is null;
create index if not exists customers_source_idx  on public.customers (source)            where deleted_at is null;
create index if not exists customers_staff_idx   on public.customers (staff_id)          where deleted_at is null;
create index if not exists customers_created_idx on public.customers (created_at desc)    where deleted_at is null;
create index if not exists customers_phone_idx   on public.customers (phone);

-- 3) Trigger tự cập nhật updated_at (dùng chung 2 bảng) ---------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_enum_options_updated on public.enum_options;
create trigger trg_enum_options_updated
  before update on public.enum_options
  for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated
  before update on public.customers
  for each row execute function public.set_updated_at();

-- 4) RLS + grant ------------------------------------------------------------
-- enum_options: mọi user đăng nhập đọc; chỉ admin ghi.
alter table public.enum_options enable row level security;

drop policy if exists enum_options_read on public.enum_options;
create policy enum_options_read on public.enum_options
  for select to authenticated using (true);

drop policy if exists enum_options_admin_write on public.enum_options;
create policy enum_options_admin_write on public.enum_options
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.enum_options to authenticated;

-- customers: mọi user đăng nhập toàn quyền (CRM dùng chung cho cả nhóm sales).
alter table public.customers enable row level security;

drop policy if exists customers_all on public.customers;
create policy customers_all on public.customers
  for all to authenticated
  using (true) with check (true);

grant select, insert, update, delete on public.customers to authenticated;

-- profiles: cho mọi user đăng nhập ĐỌC (hiện tên nhân viên + dropdown gán staff).
-- Ghi vẫn chỉ admin (policy profiles_admin_write từ migration trước không đổi).
-- ponytail: CRM nội bộ — lộ email/role cho user thường; siết bằng view chỉ-tên
--           (id, user_name) nếu sau này cần riêng tư.
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

-- 5) SEED enum_options (đủ 3 ngôn ngữ) --------------------------------------
--    on conflict do nothing: KHÔNG đè label admin đã sửa khi chạy lại.
insert into public.enum_options (kind, value, label_vi, label_en, label_id, sort_order) values
  ('stage', 'new_lead',   'Khách mới',        'New lead',            'Prospek baru',        10),
  ('stage', 'consulting', 'Đang tư vấn',      'Consulting',          'Konsultasi',          20),
  ('stage', 'deposited',  'Đã đặt cọc',       'Deposited',           'Sudah deposit',       30),
  ('stage', 'booked',     'Đã đặt lịch',      'Booked',              'Sudah booking',       40),
  ('stage', 'visited',    'Đã đến',           'Visited',             'Sudah berkunjung',    50),
  ('stage', 'returning',  'Khách quay lại',   'Returning',           'Pelanggan kembali',   60),
  ('stage', 'lost',       'Đã mất',           'Lost',                'Hilang',              70),
  ('source', 'instagrams', 'Instagram',       'Instagram',           'Instagram',           10),
  ('source', 'whatsapp',   'WhatsApp',        'WhatsApp',            'WhatsApp',            20),
  ('source', 'referral',   'Giới thiệu',      'Referral',            'Referensi',           30),
  ('source', 'walk_in',    'Khách vãng lai',  'Walk-in',             'Datang langsung',     40),
  ('source', 'other',      'Khác',            'Other',               'Lainnya',             50),
  ('lost_reason', 'too_expensive',        'Giá quá cao',           'Too expensive',       'Terlalu mahal',            10),
  ('lost_reason', 'wrong_number',         'Sai số điện thoại',     'Wrong number',        'Nomor salah',              20),
  ('lost_reason', 'unreachable',          'Không liên lạc được',   'Unreachable',         'Tidak dapat dihubungi',    30),
  ('lost_reason', 'no_answer',            'Không trả lời',         'No answer',           'Tidak menjawab',           40),
  ('lost_reason', 'too_far',              'Quá xa',                'Too far',             'Terlalu jauh',             50),
  ('lost_reason', 'thinking_then_silent', 'Suy nghĩ rồi im lặng',  'Thinking then silent','Berpikir lalu diam',       60),
  ('lost_reason', 'other',                'Khác',                  'Other',               'Lainnya',                  70)
on conflict (kind, value) do nothing;

-- ============================================================================
-- ROLLBACK (chạy nếu cần gỡ bỏ):
--   drop table if exists public.customers;
--   drop table if exists public.enum_options;
--   drop function if exists public.set_updated_at();
--   drop policy if exists profiles_select_authenticated on public.profiles;
-- ============================================================================
