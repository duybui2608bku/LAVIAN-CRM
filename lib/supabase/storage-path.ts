// Helpers thuần (không phụ thuộc Supabase/DOM) -> test được bằng `node --test`.

export const IMAGES_BUCKET = "images";

/**
 * Trích object path từ public URL của Supabase Storage.
 * Trả null nếu URL không thuộc bucket (vd URL avatar ngoài trước đây).
 * Dạng URL: `.../storage/v1/object/public/{bucket}/{path}`.
 */
export function objectPathFromPublicUrl(
  url: string,
  bucket = IMAGES_BUCKET,
): string | null {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  return path || null;
}

