import { notFound } from "next/navigation";

import { DocumentView } from "@/components/documents/document-view";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENTS_BUCKET, type DocumentComment, type DocumentRecord } from "@/types/document";

const AUTHOR = "author:profiles(user_name, avatar_url)";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, supabase] = await Promise.all([getCurrentProfile(), createClient()]);
  if (!profile) notFound();

  // RLS: tài liệu khác bộ phận → không có dòng → 404 (id sai định dạng cũng vậy).
  const { data } = await supabase
    .from("documents")
    .select(`id, title, content, pdf_path, departments, created_at, updated_at, ${AUTHOR}`)
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const doc = data as unknown as DocumentRecord;

  const [comments, likes, mine, pdf] = await Promise.all([
    supabase
      .from("document_comments")
      .select(`id, user_id, body, created_at, ${AUTHOR}`)
      .eq("document_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("document_likes").select("user_id", { count: "exact", head: true }).eq("document_id", id),
    supabase.from("document_likes").select("user_id").eq("document_id", id).eq("user_id", profile.id).maybeSingle(),
    // Link ký 1 giờ — bucket private, policy storage chỉ cho người xem được tài liệu.
    doc.pdf_path ? supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.pdf_path, 3600) : null,
  ]);

  return (
    <DocumentView
      doc={doc}
      comments={(comments.data as unknown as DocumentComment[]) ?? []}
      likeCount={likes.count ?? 0}
      liked={!!mine.data}
      pdfUrl={pdf?.data?.signedUrl ?? null}
      currentUserId={profile.id}
      isAdmin={profile.role === "admin"}
    />
  );
}
