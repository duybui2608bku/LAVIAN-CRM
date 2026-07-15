-- ============================================================================
-- Migration: Lưu metadata SMAX vào customers — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc: 20260707140000_customers_and_enums.sql (bảng customers) đã chạy.
--
-- Nội dung:
--   * social_link -> social_name (đổi ý nghĩa: lưu TÊN hiển thị MXH từ
--     customer.name_original của SMAX, không lưu link nữa; dữ liệu cũ giữ nguyên).
--   * picture: URL avatar khách (customer.picture) — null nếu không có.
--   * tags: jsonb mảng tag SMAX [{id,name,alias,time}] — mặc định [].
--   * thread: jsonb object hội thoại SMAX {id,tid,message,link} — null nếu không có.
-- ============================================================================

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'customers'
               and column_name = 'social_link')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'customers'
               and column_name = 'social_name') then
    alter table public.customers rename column social_link to social_name;
  end if;
end $$;

alter table public.customers add column if not exists social_name text;
alter table public.customers add column if not exists picture     text;
alter table public.customers add column if not exists tags        jsonb not null default '[]'::jsonb;
alter table public.customers add column if not exists thread      jsonb;

-- ============================================================================
-- ROLLBACK (chạy nếu cần gỡ bỏ):
--   alter table public.customers rename column social_name to social_link;
--   alter table public.customers drop column if exists picture;
--   alter table public.customers drop column if exists tags;
--   alter table public.customers drop column if exists thread;
-- ============================================================================
