import { DocumentsList } from "@/components/documents/documents-list";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_AUTHOR, type DocumentListItem } from "@/types/document";

// Mọi user đăng nhập vào được; RLS (can_view_document) chỉ trả tài liệu thuộc bộ phận của user.
export default async function DocumentsPage() {
  const [profile, supabase] = await Promise.all([getCurrentProfile(), createClient()]);
  const { data, error } = await supabase
    .from("documents")
    .select(
      `id, title, category, pdf_path, departments, created_at, ${DOCUMENT_AUTHOR}, likes:document_likes(count), comments:document_comments(count)`,
    )
    .order("created_at", { ascending: false });
  if (error) throw error; // hiện trang lỗi thay vì danh sách trống giả

  return (
    <DocumentsList
      documents={(data as unknown as DocumentListItem[]) ?? []}
      isAdmin={profile?.role === "admin"}
    />
  );
}
