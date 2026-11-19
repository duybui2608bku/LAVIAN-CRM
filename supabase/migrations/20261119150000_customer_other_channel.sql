-- ============================================================================
-- Migration: Khách có kênh thứ hai (IG + WA) — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Không phụ thuộc migration khác. Chạy TRƯỚC khi deploy code (các trang select other_channel).
--
-- Nội dung:
--   * other_channel jsonb (null = chỉ 1 kênh): { source, link, username } của kênh thứ hai.
--     Kênh chính vẫn là source / thread / smax_data (kênh khách nhắn trước).
--     Lead form ghi khi tìm khách theo SĐT từ hội thoại thuộc kênh khác.
-- ============================================================================

alter table public.customers add column if not exists other_channel jsonb;

comment on column public.customers.other_channel is
  'Kênh SMAX thứ hai của khách {source, link, username} — vd khách IG chuyển sang WA. Null = 1 kênh.';

-- ============================================================================
-- ROLLBACK:
--   alter table public.customers drop column if exists other_channel;
-- ============================================================================
