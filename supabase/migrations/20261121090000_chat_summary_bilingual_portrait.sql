-- ============================================================================
-- Migration: Tóm tắt AI song ngữ (Việt + Anh) + AI tự điền Chân dung nhanh — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent (chạy lại an toàn).
-- Phụ thuộc (đã chạy trước): 20261120120000_customer_360.sql, 20261120130000_customer_chat_summary.sql.
-- Chạy TRƯỚC khi deploy code (code mới đọc/ghi các cột này).
--
-- 1. customer_chat_summaries: `summary` = bản tiếng Việt, thêm `summary_en` = bản tiếng Anh.
-- 2. customer_portrait_entries: thêm `text_en` (bản tiếng Anh, AI điền; người nhập tay để null)
--    và nguồn 'ai' (bản do AI rút ra từ hội thoại — người dùng ghi đè bằng cách thêm bản mới).
-- ============================================================================

-- 1. Tóm tắt song ngữ
alter table public.customer_chat_summaries
  add column if not exists summary_en text check (summary_en is null or char_length(summary_en) <= 8000);
comment on column public.customer_chat_summaries.summary is 'Bản tóm tắt tiếng Việt';
comment on column public.customer_chat_summaries.summary_en is 'Bản tóm tắt tiếng Anh (null = bản cũ trước khi có song ngữ)';

-- 2. Chân dung: bản tiếng Anh + nguồn AI
alter table public.customer_portrait_entries
  add column if not exists text_en text check (text_en is null or char_length(text_en) between 1 and 1000);
comment on column public.customer_portrait_entries.text_en is 'Bản tiếng Anh (AI điền); null = chỉ có `text`';

alter table public.customer_portrait_entries drop constraint if exists customer_portrait_entries_source_check;
alter table public.customer_portrait_entries add constraint customer_portrait_entries_source_check
  check (source in ('customer', 'staff', 'ai')); -- Khách nói / NV nhận định / AI rút ra từ hội thoại
