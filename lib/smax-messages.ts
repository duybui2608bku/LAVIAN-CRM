/** Tin nhắn gần nhất của 1 hội thoại SMAX (WhatsApp/Instagram). `fetchThreadMessages` CHỈ chạy server (env `SMAX_TOKEN`). */

const BIZ_API = "https://api.smax.ai/bizs/lavianbeautycenter";
export const MESSAGE_LIMIT = 20;

export type ChatMessage = {
  id: string;
  /** true = page Lavian gửi; false = khách gửi. */
  out: boolean;
  text: string;
  at: string;
  images: { src: string; thumb: string }[];
  /** Số tệp đính kèm không phải ảnh (template, video, file…) — chỉ hiện nhãn. */
  files: number;
};

type RawAttachment = { url?: string; thumbnail?: string; url_preview?: string; type?: string; mime_type?: string };
type RawMessage = {
  id: string;
  page_pid: string;
  sender_pid: string;
  platform: string;
  message?: string;
  created_at: string;
  [platform: string]: unknown;
};

/** page_pid + tid từ link hội thoại `https://smax.ai/bizs/<biz>/chats/<page_pid>?tid=<tid>`; link lạ → null. */
export function threadRef(link: string | null | undefined): { page: string; tid: string } | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    const page = url.pathname.match(/\/chats\/((?:waw|ig)\d+)$/)?.[1];
    const tid = url.searchParams.get("tid");
    return page && tid ? { page, tid } : null;
  } catch {
    return null;
  }
}

/** Payload SMAX (mới nhất trước) → tin gọn, cũ nhất trước; bỏ tin rỗng. Ảnh nằm ở `<platform>.attachments`. */
export function toChatMessages(raw: RawMessage[]): ChatMessage[] {
  return raw
    .map((m) => {
      const atts = (m[m.platform] as { attachments?: RawAttachment[] } | undefined)?.attachments ?? [];
      const images = atts
        .filter((a) => (a.type ?? a.mime_type) === "image" && a.url)
        .map((a) => ({ src: a.url!, thumb: a.thumbnail ?? a.url_preview ?? a.url! }));
      return {
        id: m.id,
        out: m.sender_pid === m.page_pid,
        text: m.message?.trim() ?? "",
        at: m.created_at,
        images,
        files: atts.length - images.length,
      };
    })
    .filter((m) => m.text || m.images.length || m.files)
    .reverse();
}

/** 20 tin gần nhất của hội thoại theo link lưu ở `customers.thread.link`. */
export async function fetchThreadMessages(link: string | null | undefined): Promise<ChatMessage[]> {
  const ref = threadRef(link);
  if (!ref) throw new Error("Khách chưa có hội thoại SMAX.");
  return fetchMessagesByRef(ref);
}

/** 20 tin gần nhất của hội thoại `tid` trong trang `page` (page_pid). */
export async function fetchMessagesByRef(ref: { page: string; tid: string }): Promise<ChatMessage[]> {
  const token = process.env.SMAX_TOKEN ?? "";
  if (!token) throw new Error("Thiếu SMAX_TOKEN.");
  const res = await fetch(
    `${BIZ_API}/pages/${ref.page}/threads/${encodeURIComponent(ref.tid)}/messages?sort=-created_at&limit=${MESSAGE_LIMIT}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  const json = (await res.json().catch(() => null)) as { message?: string; data?: RawMessage[] } | null;
  if (!res.ok || !Array.isArray(json?.data))
    throw new Error(res.status === 401 ? "SMAX_TOKEN hết hạn hoặc sai — cập nhật biến môi trường." : (json?.message ?? `SMAX API ${res.status}`));
  return toChatMessages(json.data);
}
