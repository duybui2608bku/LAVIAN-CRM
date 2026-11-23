-- ============================================================================
-- Migration: Giữ ngày sửa tay của tour dự kiến (OpenSpec: brow-tour-roadmap) — LAVIAN-CRM
-- Copy toàn bộ file vào Supabase SQL Editor, chạy 1 lần. Chạy lại an toàn.
-- Phụ thuộc (đã chạy): 20261123140000_tour_roadmap_planned.sql.
--
-- tours.date_pinned: người dùng đã sửa tay ngày tour dự kiến (drawer Thêm dịch vụ) → app giữ ngày đó khi tính lại
-- lộ trình, các tour dự kiến sau tính tiếp từ ngày này. Chỉ có nghĩa khi planned = true.
-- ============================================================================

alter table public.tours add column if not exists date_pinned boolean not null default false;

-- Kiểm tra:
--   select column_name, column_default from information_schema.columns
--   where table_schema = 'public' and table_name = 'tours' and column_name = 'date_pinned';
