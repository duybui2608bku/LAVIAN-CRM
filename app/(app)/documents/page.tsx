import { DocumentsList } from "@/components/documents/documents-list";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DocumentListItem } from "@/types/document";

// Mọi user đăng nhập vào được; RLS (can_view_document) chỉ trả tài liệu thuộc bộ phận của user.
export default async function DocumentsPage() {
  const [profile, supabase] = await Promise.all([getCurrentProfile(), createClient()]);
  const { data } = await supabase
    .from("documents")
    .select(
      "id, title, pdf_path, departments, updated_at, author:profiles(user_name, avatar_url), likes:document_likes(count), comments:document_comments(count)",
    )
    .order("updated_at", { ascending: false });

  return (
    <DocumentsList
      documents={(data as unknown as DocumentListItem[]) ?? []}
      isAdmin={profile?.role === "admin"}
    />
  );
}
