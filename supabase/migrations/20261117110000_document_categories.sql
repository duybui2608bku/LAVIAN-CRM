-- Migration: Danh mục tài liệu (OpenSpec: document-categories)
--
-- Mục đích: thêm public.documents.category — danh mục cố định trong code (lib/document-categories.ts):
--   regulation = Quy định, charter = Quy chế, training = Học tập, process = Quy trình,
--   form = Biểu mẫu, announcement = Thông báo, other = Khác.
--   Tài liệu đã có tự nhận 'other'. Thêm danh mục mới: sửa code + check bên dưới.
-- Thứ tự: SAU 20261117090000_documents.sql. Chạy TRƯỚC khi deploy code. Chạy lại an toàn.

begin;

alter table public.documents add column if not exists category text not null default 'other';

alter table public.documents drop constraint if exists documents_category_check;
alter table public.documents add constraint documents_category_check
  check (category in ('regulation', 'charter', 'training', 'process', 'form', 'announcement', 'other'));

commit;

-- Rollback (tham khảo):
--   alter table public.documents drop column if exists category;
