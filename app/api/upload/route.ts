import { NextResponse } from "next/server";

import { normalizeError } from "@/lib/errors";

// Proxy upload ảnh sang cfig.ibytecdn.org — không cần API key, không set header
// thủ công (fetch tự gắn multipart boundary).
// Người chưa đăng nhập đã bị proxy.ts chặn trước khi tới đây.

const UPLOAD_URL = "https://cfig.ibytecdn.org/upload";

/** Shape response mà upstream trả về. */
type UploadPayload = {
  success?: boolean;
  results?: { success?: boolean; filename?: string; url?: string; server?: string }[];
};

const meta = () => ({ timestamp: new Date().toISOString() });

export async function POST(request: Request) {
  const fail = (message: string, status: number) =>
    NextResponse.json(
      { success: false, error: { message }, meta: { ...meta(), path: "/api/upload" } },
      { status },
    );

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Vui lòng chọn tệp ảnh.", 400);
  const server = form.get("server");

  const body = new FormData();
  body.append("images[]", file, file.name);
  body.append("server", typeof server === "string" && server ? server : "server_1");

  try {
    const res = await fetch(UPLOAD_URL, { method: "POST", body });
    const payload = (await res.json().catch(() => ({}))) as UploadPayload;
    const url = payload.results?.[0]?.url;

    if (!res.ok || payload.success !== true || !url) {
      return fail("Upload ảnh thất bại.", 502);
    }
    return NextResponse.json({ success: true, data: { url }, meta: meta() });
  } catch (e) {
    return fail(normalizeError(e).message, 502);
  }
}
