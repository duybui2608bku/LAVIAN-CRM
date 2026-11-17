// Chuẩn hoá HTML export của Google Docs (`/export?format=html`) để editor Tiptap đọc được.
// Google để đậm/nghiêng/gạch chân trong CSS class (.c3{font-weight:700}) → chuyển thành style inline
// (Tiptap nhận diện style inline). Link được Google bọc qua google.com/url?q=… → trả link gốc.
// Không lọc an toàn ở đây: editor chỉ giữ node/mark trong schema nên thẻ/thuộc tính lạ tự rơi.

/** Lấy id tài liệu từ link Google Docs (null nếu không phải link Docs). */
export function googleDocId(url: string): string | null {
  return url.trim().match(/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([\w-]{20,})/)?.[1] ?? null;
}

// Chỉ giữ thuộc tính định dạng chữ mà editor hỗ trợ.
const KEEP = new Set(["font-weight", "font-style", "text-decoration"]);

const keepDecls = (css: string) =>
  css
    .split(";")
    .map((d) => d.trim())
    .filter((d) => KEEP.has(d.split(":")[0].trim().toLowerCase()));

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** google.com/url?q=<link gốc>&sa=… → link gốc; link khác giữ nguyên. */
export function unwrapGoogleLink(href: string): string {
  try {
    const u = new URL(decode(href));
    if (/(^|\.)google\.com$/.test(u.hostname) && u.pathname === "/url") return u.searchParams.get("q") || href;
  } catch {
    // href tương đối / hỏng → giữ nguyên
  }
  return decode(href);
}

export function parseGoogleDocHtml(html: string): { title: string; body: string } {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();

  // Bảng class → style giữ lại (chỉ selector dạng `.cN`).
  const classStyles = new Map<string, string[]>();
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  for (const [, selectors, decls] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const kept = keepDecls(decls);
    if (!kept.length) continue;
    for (const sel of selectors.split(",")) {
      const cls = sel.trim().match(/^\.([\w-]+)$/)?.[1];
      if (cls) classStyles.set(cls, [...(classStyles.get(cls) ?? []), ...kept]);
    }
  }

  let body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  body = body.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Viết lại từng thẻ mở: class → style inline, bỏ id/class, gỡ link chuyển hướng.
  body = body.replace(/<([a-z][a-z0-9]*)(\s[^>]*?)?(\/?)>/gi, (_, name: string, attrs = "", selfClose: string) => {
    const out: string[] = [];
    const styles: string[] = [];
    for (const [, key, value] of (attrs as string).matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
      const k = key.toLowerCase();
      if (k === "class") value.split(/\s+/).forEach((c) => styles.push(...(classStyles.get(c) ?? [])));
      else if (k === "style") styles.push(...keepDecls(value));
      else if (k === "href") out.push(`href="${escapeAttr(unwrapGoogleLink(value))}"`);
      else if (k !== "id") out.push(`${k}="${value}"`);
    }
    if (styles.length) out.push(`style="${escapeAttr(styles.join(";"))}"`);
    return `<${name}${out.length ? " " + out.join(" ") : ""}${selfClose}>`;
  });

  return { title, body: body.trim() };
}

/** Ảnh trong tài liệu nằm trên máy chủ Google (link có thể hết hạn) — cần tải lại lên CDN. */
export function googleImageSources(body: string): string[] {
  const srcs = [...body.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)].map((m) => m[1]);
  return [...new Set(srcs)].filter((src) => {
    try {
      return new URL(decode(src)).hostname.endsWith(".googleusercontent.com");
    } catch {
      return false;
    }
  });
}
