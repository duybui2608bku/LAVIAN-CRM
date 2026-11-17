import { notFound, redirect } from "next/navigation";

import { DocumentEditor } from "@/components/documents/document-editor";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_AUTHOR, type DocumentRecord } from "@/types/document";

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect(`/documents/${id}`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(`id, title, category, content, pdf_path, departments, created_at, updated_at, ${DOCUMENT_AUTHOR}`)
    .eq("id", id)
    .maybeSingle();
  // id sai định dạng uuid (22P02) = không tồn tại; lỗi khác thì hiện trang lỗi.
  if (error && error.code !== "22P02") throw error;
  if (!data) notFound();

  return <DocumentEditor doc={data as unknown as DocumentRecord} />;
}
