import { NextResponse } from "next/server";

import { normalizeError } from "@/lib/errors";
import { uploadToCdn } from "@/lib/upload";

// Proxy upload ảnh sang CDN (lib/upload.ts).
// Người chưa đăng nhập đã bị proxy.ts chặn trước khi tới đây.

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

  try {
    const url = await uploadToCdn(file, file.name, typeof server === "string" && server ? server : undefined);
    return NextResponse.json({ success: true, data: { url }, meta: meta() });
  } catch (e) {
    return fail(normalizeError(e).message, 502);
  }
}
