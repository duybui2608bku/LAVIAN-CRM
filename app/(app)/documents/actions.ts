"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile, requireAdmin } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { googleDocId, googleImageSources, parseGoogleDocHtml } from "@/lib/google-docs";
import { createClient } from "@/lib/supabase/server";
import { uploadToCdn } from "@/lib/upload";
import { DOCUMENTS_BUCKET, type DocumentInput } from "@/types/document";
import { DEPARTMENTS } from "@/types/user";

type Result<T = object> = ({ error?: undefined } & T) | { error: string };

const LIST = "/documents";
const VIEW = "/documents/[id]";

const fail = (e: unknown) => ({ error: normalizeError(e).message });

async function requireActive() {
  const profile = await getCurrentProfile();
  if (profile?.status !== "active") throw new Error("Bạn cần đăng nhập.");
  return profile;
}

/** Xoá file PDF cũ — best-effort (file mồ côi không ảnh hưởng tài liệu). */
async function removePdf(path: string | null | undefined) {
  if (!path) return;
  const supabase = await createClient();
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
}

export async function saveDocument(id: string | null, input: DocumentInput): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin();
    const title = input.title.trim();
    if (!title) return { error: "Vui lòng nhập tiêu đề." };
    const content = input.content?.type === "doc" ? input.content : null;
    if (!content && !input.pdf_path) return { error: "Tài liệu cần có nội dung hoặc file PDF." };
    const row = {
      title,
      content,
      pdf_path: input.pdf_path || null,
      departments: input.departments.filter((d) => DEPARTMENTS.includes(d)),
    };

    const supabase = await createClient();
    if (!id) {
      const { data, error } = await supabase.from("documents").insert(row).select("id").single();
      if (error) throw error;
      revalidatePath(LIST);
      return { id: data.id };
    }

    const { data: old, error: readError } = await supabase.from("documents").select("pdf_path").eq("id", id).single();
    if (readError) throw readError;
    const { error } = await supabase.from("documents").update(row).eq("id", id);
    if (error) throw error;
    if (old.pdf_path !== row.pdf_path) await removePdf(old.pdf_path);
    revalidatePath(LIST);
    revalidatePath(VIEW, "page");
    return { id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDocument(id: string): Promise<Result> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.from("documents").delete().eq("id", id).select("pdf_path").single();
    if (error) throw error;
    await removePdf(data.pdf_path);
    revalidatePath(LIST);
    return {};
  } catch (e) {
    return fail(e);
  }
}

/**
 * Tải HTML export của 1 Google Doc đã chia sẻ "Bất kỳ ai có đường liên kết", chuẩn hoá cho editor,
 * tải lại ảnh (link ảnh Google hết hạn sau một thời gian) lên CDN. Chỉ trả HTML để admin sửa tiếp — chưa lưu.
 */
export async function importGoogleDoc(url: string): Promise<Result<{ title: string; html: string }>> {
  try {
    await requireAdmin();
    const docId = googleDocId(url);
    if (!docId) return { error: "Link không phải tài liệu Google Docs." };

    const res = await fetch(`https://docs.google.com/document/d/${docId}/export?format=html`, { cache: "no-store" });
    // Doc không tồn tại → 404; doc riêng tư → Google chuyển hướng sang trang đăng nhập accounts.google.com.
    if (!res.ok || new URL(res.url).hostname === "accounts.google.com") {
      return { error: "Không tải được tài liệu. Hãy chia sẻ \"Bất kỳ ai có đường liên kết\" rồi thử lại." };
    }
    const parsed = parseGoogleDocHtml(await res.text());
    let body = parsed.body;

    // ponytail: tải ảnh tuần tự theo nhóm 4 — tài liệu nội bộ ít ảnh; ảnh lỗi giữ link Google gốc.
    const srcs = googleImageSources(body);
    for (let i = 0; i < srcs.length; i += 4) {
      await Promise.all(
        srcs.slice(i, i + 4).map(async (src, j) => {
          try {
            const img = await fetch(src.replace(/&amp;/g, "&"));
            if (!img.ok) return;
            const blob = await img.blob();
            const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
            const cdn = await uploadToCdn(blob, `gdoc-${i + j}.${ext}`);
            body = body.replaceAll(`src="${src}"`, `src="${cdn}"`);
          } catch {
            // giữ ảnh gốc
          }
        }),
      );
    }
    return { title: parsed.title, html: body };
  } catch (e) {
    return fail(e);
  }
}

export async function setLike(documentId: string, liked: boolean): Promise<Result> {
  try {
    const profile = await requireActive();
    const supabase = await createClient();
    const { error } = liked
      ? await supabase.from("document_likes").upsert({ document_id: documentId, user_id: profile.id }, { ignoreDuplicates: true })
      : await supabase.from("document_likes").delete().eq("document_id", documentId).eq("user_id", profile.id);
    if (error) throw error;
    revalidatePath(VIEW, "page");
    revalidatePath(LIST);
    return {};
  } catch (e) {
    return fail(e);
  }
}

export async function addComment(documentId: string, body: string): Promise<Result> {
  try {
    const profile = await requireActive();
    const text = body.trim();
    if (!text) return { error: "Vui lòng nhập bình luận." };
    if (text.length > 2000) return { error: "Bình luận tối đa 2000 ký tự." };
    const supabase = await createClient();
    const { error } = await supabase
      .from("document_comments")
      .insert({ document_id: documentId, user_id: profile.id, body: text });
    if (error) throw error;
    revalidatePath(VIEW, "page");
    revalidatePath(LIST);
    return {};
  } catch (e) {
    return fail(e);
  }
}

/** RLS: chỉ chủ bình luận hoặc admin xoá được — người khác xoá 0 dòng → báo lỗi. */
export async function deleteComment(id: string): Promise<Result> {
  try {
    await requireActive();
    const supabase = await createClient();
    const { data, error } = await supabase.from("document_comments").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data.length) return { error: "Bạn không có quyền xoá bình luận này." };
    revalidatePath(VIEW, "page");
    revalidatePath(LIST);
    return {};
  } catch (e) {
    return fail(e);
  }
}
