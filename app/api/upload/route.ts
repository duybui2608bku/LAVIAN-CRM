import { NextResponse } from "next/server";

import { normalizeError } from "@/lib/errors";
import { uploadToCdn } from "@/lib/upload";

// Proxy upload ảnh sang CDN (lib/upload.ts).
// CÔNG KHAI: proxy.ts không chạy cho /api, và lead form (khách chưa đăng nhập) cũng tải ảnh qua đây
// → chặn ở server: chỉ ảnh, ≤ 10MB (khớp client), tên server CDN dạng server_N.
// ponytail: chưa giới hạn tần suất — thêm rate limit nếu bị spam upload.
const MAX_BYTES = 10 * 1024 * 1024;

const meta = () => ({ timestamp: new Date().toISOString() });

export async function POST(request: Request) {
  const fail = (message: string, status: number) =>
    NextResponse.json(
      { success: false, error: { message }, meta: { ...meta(), path: "/api/upload" } },
      { status },
    );

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return fail("Vui lòng chọn tệp ảnh.", 400);
  if (file.size > MAX_BYTES) return fail("Ảnh tối đa 10MB.", 413);
  const server = form.get("server");

  try {
    const url = await uploadToCdn(file, file.name, typeof server === "string" && /^server_\d+$/.test(server) ? server : undefined);
    return NextResponse.json({ success: true, data: { url }, meta: meta() });
  } catch (e) {
    return fail(normalizeError(e).message, 502);
  }
}
