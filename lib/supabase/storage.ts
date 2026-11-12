import { objectPathFromPublicUrl, IMAGES_BUCKET } from "./storage-path";

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
