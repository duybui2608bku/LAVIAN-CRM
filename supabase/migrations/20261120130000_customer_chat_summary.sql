-- ============================================================================
-- Migration: Tóm tắt AI hội thoại SMAX (popup 360° → tab Hội thoại) — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent (chạy lại an toàn).
-- Phụ thuộc: 20261120120000_customer_360.sql đã chạy (bảng customers, profiles, hàm set_updated_at có sẵn).
-- Chạy TRƯỚC khi deploy code (getCustomer360 đọc bảng này).
--
-- 1 dòng / khách: bấm "Tóm tắt lại" thì ghi đè (upsert). Server gọi Claude rồi ghi bằng session của user.
-- ============================================================================

create table if not exists public.customer_chat_summaries (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  summary text not null check (char_length(summary) between 1 and 8000),
  last_message_at timestamptz, -- giờ tin mới nhất đã tóm tắt (có tin sau mốc này = bản cũ)
  message_count integer not null default 0 check (message_count >= 0),
  model text not null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists customer_chat_summaries_created_by_idx on public.customer_chat_summaries (created_by);
comment on table public.customer_chat_summaries is 'Tóm tắt AI (Claude) hội thoại SMAX gần nhất của khách — 1 dòng / khách, ghi đè khi tóm tắt lại';

alter table public.customer_chat_summaries enable row level security;
drop policy if exists customer_chat_summaries_select on public.customer_chat_summaries;
create policy customer_chat_summaries_select on public.customer_chat_summaries
  for select to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));
drop policy if exists customer_chat_summaries_insert on public.customer_chat_summaries;
create policy customer_chat_summaries_insert on public.customer_chat_summaries
  for insert to authenticated
  with check (created_by = (select auth.uid())
    and exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));
drop policy if exists customer_chat_summaries_update on public.customer_chat_summaries;
create policy customer_chat_summaries_update on public.customer_chat_summaries
  for update to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'))
  with check (created_by = (select auth.uid())
    and exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));
revoke all on public.customer_chat_summaries from anon, authenticated;
grant select, insert, update on public.customer_chat_summaries to authenticated;
