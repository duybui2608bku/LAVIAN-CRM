-- Migration: Tài liệu nội bộ (OpenSpec: documents-library)
--
-- Mục đích:
--   - public.documents: admin soạn (content = JSON Tiptap) / đính kèm PDF (pdf_path trong bucket `documents`),
--     giới hạn bộ phận xem bằng `departments` (mảng rỗng = mọi bộ phận).
--   - public.document_likes, public.document_comments: user like + bình luận tài liệu mình xem được.
--   - Bucket private `documents` (chỉ PDF ≤ 30MB): admin ghi; user đọc khi tài liệu chứa file đó xem được.
-- Thứ tự: SAU 20261113150100_department_permissions.sql (dùng enum user_department, is_admin(), set_updated_at()).
-- Chạy TRƯỚC khi deploy code. Chạy lại an toàn.

begin;

-- 1) Quyền xem: user active VÀ (admin, hoặc tài liệu không giới hạn, hoặc bộ phận của user nằm trong danh sách).
-- security invoker: đọc profiles qua policy profiles_select_authenticated sẵn có.
create or replace function public.can_view_document(depts public.user_department[])
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'active'
      and (p.role = 'admin' or cardinality(depts) = 0 or p.department = any (depts))
  );
$$;

-- 2) Bảng --------------------------------------------------------------------
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(btrim(title)) between 1 and 200),
  content     jsonb,                                         -- JSON Tiptap (null = chỉ có PDF)
  pdf_path    text,                                          -- object name trong bucket `documents`
  departments public.user_department[] not null default '{}', -- rỗng = mọi bộ phận
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists documents_created_by_idx on public.documents (created_by);

create table if not exists public.document_likes (
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (document_id, user_id)
);
create index if not exists document_likes_user_idx on public.document_likes (user_id);

create table if not exists public.document_comments (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body        text not null check (length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists document_comments_document_idx on public.document_comments (document_id, created_at);
create index if not exists document_comments_user_idx on public.document_comments (user_id);

drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- 3) RLS ---------------------------------------------------------------------
alter table public.documents enable row level security;
alter table public.document_likes enable row level security;
alter table public.document_comments enable row level security;

drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents
  for select to authenticated using (public.can_view_document(departments));
drop policy if exists documents_admin_insert on public.documents;
create policy documents_admin_insert on public.documents
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists documents_admin_update on public.documents;
create policy documents_admin_update on public.documents
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists documents_admin_delete on public.documents;
create policy documents_admin_delete on public.documents
  for delete to authenticated using ((select public.is_admin()));

-- Like/bình luận: chỉ trên tài liệu xem được (subquery chịu RLS documents_read).
drop policy if exists document_likes_read on public.document_likes;
create policy document_likes_read on public.document_likes
  for select to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id));
drop policy if exists document_likes_insert_own on public.document_likes;
create policy document_likes_insert_own on public.document_likes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.documents d where d.id = document_id));
drop policy if exists document_likes_delete_own on public.document_likes;
create policy document_likes_delete_own on public.document_likes
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists document_comments_read on public.document_comments;
create policy document_comments_read on public.document_comments
  for select to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id));
drop policy if exists document_comments_insert_own on public.document_comments;
create policy document_comments_insert_own on public.document_comments
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.documents d where d.id = document_id));
-- Xoá: chủ bình luận hoặc admin. Không cho sửa (không có policy update).
drop policy if exists document_comments_delete on public.document_comments;
create policy document_comments_delete on public.document_comments
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke all on public.documents, public.document_likes, public.document_comments from anon, authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, delete on public.document_likes, public.document_comments to authenticated;

-- 4) Storage: bucket private `documents` (PDF) ---------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 31457280, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Đọc (tạo signed URL): chỉ khi có tài liệu XEM ĐƯỢC trỏ tới file này.
-- `name` = storage.objects.name (documents không có cột name).
drop policy if exists documents_files_read on storage.objects;
create policy documents_files_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and exists (select 1 from public.documents d where d.pdf_path = name));
-- Admin đọc mọi file (vừa upload, chưa gắn vào tài liệu) + ghi/xoá.
drop policy if exists documents_files_admin_read on storage.objects;
create policy documents_files_admin_read on storage.objects
  for select to authenticated using (bucket_id = 'documents' and (select public.is_admin()));
drop policy if exists documents_files_admin_insert on storage.objects;
create policy documents_files_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'documents' and (select public.is_admin()));
drop policy if exists documents_files_admin_update on storage.objects;
create policy documents_files_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (select public.is_admin()))
  with check (bucket_id = 'documents' and (select public.is_admin()));
drop policy if exists documents_files_admin_delete on storage.objects;
create policy documents_files_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and (select public.is_admin()));

commit;

-- Rollback (tham khảo):
--   drop table if exists public.document_comments, public.document_likes, public.documents;
--   drop function if exists public.can_view_document(public.user_department[]);
--   drop policy if exists documents_files_read on storage.objects; (… và 4 policy documents_files_admin_*)
--   (xoá bucket `documents` trong Dashboard → Storage)
