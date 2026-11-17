import "server-only";

// Upload ảnh lên cfig.ibytecdn.org — không cần API key, không set header thủ công
// (fetch tự gắn multipart boundary). Dùng chung cho /api/upload và import Google Docs.

const UPLOAD_URL = "https://cfig.ibytecdn.org/upload";

type UploadPayload = {
  success?: boolean;
  results?: { success?: boolean; filename?: string; url?: string; server?: string }[];
};

/** Trả public URL; ném lỗi khi upstream từ chối. */
export async function uploadToCdn(file: Blob, filename: string, server = "server_1"): Promise<string> {
  const body = new FormData();
  body.append("images[]", file, filename);
  body.append("server", server);

  const res = await fetch(UPLOAD_URL, { method: "POST", body });
  const payload = (await res.json().catch(() => ({}))) as UploadPayload;
  const url = payload.results?.[0]?.url;
  if (!res.ok || payload.success !== true || !url) throw new Error("Upload ảnh thất bại.");
  return url;
}
