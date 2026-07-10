-- ============================================================================
-- Migration: Nới đa ngôn ngữ thành KHÔNG bắt buộc — LAVIAN-CRM
-- enum_options.label_en/label_id và services.name_en/name_id cho phép NULL
-- (chỉ tiếng Việt bắt buộc; UI fallback về tiếng Việt khi thiếu).
-- Copy vào Supabase SQL Editor chạy 1 lần. Idempotent (drop not null lặp lại vô hại).
-- Phụ thuộc migration trước (phải đã chạy):
--   - 20260707140000_customers_and_enums.sql (bảng enum_options)
--   - 20260710100000_services.sql            (bảng services)
-- ============================================================================

alter table public.enum_options alter column label_en drop not null;
alter table public.enum_options alter column label_id drop not null;

alter table public.services alter column name_en drop not null;
alter table public.services alter column name_id drop not null;

-- ============================================================================
-- ROLLBACK (chỉ chạy được khi không còn dòng NULL):
--   alter table public.enum_options alter column label_en set not null;
--   alter table public.enum_options alter column label_id set not null;
--   alter table public.services alter column name_en set not null;
--   alter table public.services alter column name_id set not null;
