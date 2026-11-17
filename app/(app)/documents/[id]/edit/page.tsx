import { notFound, redirect } from "next/navigation";

import { DocumentEditor } from "@/components/documents/document-editor";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRecord } from "@/types/document";

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect(`/documents/${id}`);

  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, title, content, pdf_path, departments, created_at, updated_at, author:profiles(user_name, avatar_url)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  return <DocumentEditor doc={data as unknown as DocumentRecord} />;
}
