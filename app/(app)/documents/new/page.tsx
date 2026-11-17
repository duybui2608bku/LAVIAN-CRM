import { redirect } from "next/navigation";

import { DocumentEditor } from "@/components/documents/document-editor";
import { getCurrentProfile } from "@/lib/auth";

export default async function NewDocumentPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/documents");
  return <DocumentEditor doc={null} />;
}
