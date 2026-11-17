-- Migration: trả lời bình luận tài liệu (OpenSpec: document-comment-replies)
--
-- Mục đích: cột document_comments.parent_id — câu trả lời của 1 bình luận gốc (chỉ 1 cấp, kiểu Facebook).
--   Xoá bình luận gốc → xoá luôn các trả lời (on delete cascade).
--   Trigger BEFORE INSERT: bình luận cha phải cùng tài liệu; trả lời vào 1 câu trả lời → tự gắn vào bình luận gốc.
--   (Không kiểm tra trong policy được: policy truy vấn lại chính document_comments → lỗi đệ quy RLS 42P17.)
-- Thứ tự: SAU 20261117090000_documents.sql. Chạy TRƯỚC khi deploy code (trang xem đọc cột parent_id).
-- Chạy lại an toàn.

begin;

alter table public.document_comments
  add column if not exists parent_id uuid references public.document_comments (id) on delete cascade;
create index if not exists document_comments_parent_idx on public.document_comments (parent_id);

-- security invoker: chỉ thấy bình luận cha khi user xem được tài liệu (RLS select) — cha không thấy = không hợp lệ.
create or replace function public.document_comment_set_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent record;
begin
  if new.parent_id is null then
    return new;
  end if;
  select c.document_id, c.parent_id into parent from public.document_comments c where c.id = new.parent_id;
  if not found or parent.document_id <> new.document_id then
    raise exception 'Bình luận được trả lời không hợp lệ.' using errcode = '23503';
  end if;
  new.parent_id := coalesce(parent.parent_id, new.parent_id);
  return new;
end;
$$;

drop trigger if exists document_comments_set_parent on public.document_comments;
create trigger document_comments_set_parent
  before insert on public.document_comments
  for each row execute function public.document_comment_set_parent();

commit;

-- Rollback (tham khảo):
--   drop trigger if exists document_comments_set_parent on public.document_comments;
--   drop function if exists public.document_comment_set_parent();
--   alter table public.document_comments drop column if exists parent_id;
