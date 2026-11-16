/** Lấy hội thoại SMAX cho Báo cáo Smax — CHỈ server (env `SMAX_TOKEN`). Logic tính ở lib/smax-inbox.ts. */
import { inboxDateRange, type InboxThread } from "./smax-inbox";

const THREADS_API = "https://api.smax.ai/bizs/lavianbeautycenter/threads";
// 6 số WhatsApp + Instagram (danh sách page SMAX của biz, đã kiểm 2026-11-16).
const PAGE_PIDS = [
  "waw6285923553637",
  "waw6285923553660",
  "waw6285281304943",
  "waw6281918453455",
  "waw6281188031791",
  "waw6281111858630",
  "ig17841474444790127",
];
const PAGE_SIZE = 200;
const MAX_PAGES = 50; // 10.000 hội thoại — vượt thì báo lỗi thay vì ra số thiếu.

type ThreadsRes = { status?: number; message?: string; data?: InboxThread[] };

/** Toàn bộ hội thoại WA + IG có tin nhắn trong khoảng ngày (phân trang `after` = last_message_at). */
export async function fetchInboxThreads(from: string, to: string): Promise<InboxThread[]> {
  const token = process.env.SMAX_TOKEN;
  if (!token) throw new Error("Thiếu SMAX_TOKEN.");
  const out: InboxThread[] = [];
  let after = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(THREADS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
      body: JSON.stringify({
        page_pids: PAGE_PIDS,
        group_id: null,
        keyword: null,
        tags: [],
        tags_to_exclude: [],
        sort: "desc",
        types: [],
        dateRange: inboxDateRange(from, to),
        post_ids: null,
        ad_ids: [],
        users: [],
        limit: PAGE_SIZE,
        after,
        before: "",
      }),
    });
    const json = (await res.json().catch(() => null)) as ThreadsRes | null;
    if (!res.ok || !Array.isArray(json?.data))
      throw new Error(
        res.status === 401 ? "SMAX_TOKEN hết hạn hoặc sai — cập nhật biến môi trường." : (json?.message ?? `SMAX API ${res.status}`),
      );
    const data = json.data;
    out.push(...data);
    const last = data.at(-1)?.last_message_at;
    if (data.length < PAGE_SIZE || !last) return out;
    after = last;
  }
  throw new Error("Quá nhiều hội thoại — chọn khoảng ngày ngắn hơn.");
}
