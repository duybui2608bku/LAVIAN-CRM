import { normalizeError } from "@/lib/errors";
import { fileExt, objectPathFromPublicUrl, IMAGES_BUCKET } from "./storage-path";

export { IMAGES_BUCKET, objectPathFromPublicUrl };

/**
 * Upload 1 ảnh vào thư mục `{user_id}/{folder?}` của bucket, trả public URL.
 * Chạy phía client (browser). RLS chặn ghi ngoài thư mục của chính user.
 * ponytail: import client động để module không kéo browser client vào -> helper
 * thuần ở storage-path.ts test được bằng node mà không cần env/DOM.
 */
export async function uploadImage({
  file,
  bucket = IMAGES_BUCKET,
  folder,
}: {
  file: File;
  bucket?: string;
  folder?: string;
}): Promise<string> {
  const { createClient } = await import("./client");
  const supabase = createClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw normalizeError(userErr ?? new Error("Bạn cần đăng nhập để tải ảnh."));
  }

  const path = [user.id, folder, `${crypto.randomUUID()}.${fileExt(file.name, file.type)}`]
    .filter(Boolean)
    .join("/");

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw normalizeError(error);

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Xóa ảnh theo public URL (best-effort; URL không thuộc bucket thì bỏ qua). */
export async function removeImage(
  url: string,
  bucket = IMAGES_BUCKET,
): Promise<void> {
  const path = objectPathFromPublicUrl(url, bucket);
  if (!path) return;
  const { createClient } = await import("./client");
  await createClient().storage.from(bucket).remove([path]);
}
