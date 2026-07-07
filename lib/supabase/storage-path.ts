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

/** Đuôi file an toàn (chỉ chữ/số) lấy từ tên file, fallback theo mime type. */
export function fileExt(name: string, mime: string): string {
  const fromName = name.includes(".") ? name.split(".").pop()! : "";
  const ext = (fromName || mime.split("/")[1] || "bin").toLowerCase();
  return ext.replace(/[^a-z0-9]/g, "") || "bin";
}
