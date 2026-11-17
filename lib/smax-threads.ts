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

export type ThreadsQuery = {
  /** true: lọc/sắp theo NGÀY TẠO hội thoại (khách mới); false: theo tin nhắn mới nhất. */
  byCreated?: boolean;
  /** Chỉ hội thoại có 1 trong các tag (OR). */
  tags?: string[];
};

/** Hội thoại WA + IG trong khoảng ngày (theo ngày tạo hoặc theo tin nhắn mới nhất), đã bỏ trùng. */
export async function fetchInboxThreads(from: string, to: string, { byCreated = false, tags = [] }: ThreadsQuery = {}): Promise<InboxThread[]> {
  const token = process.env.SMAX_TOKEN;
  if (!token) throw new Error("Thiếu SMAX_TOKEN.");
  const [start, rangeEnd] = inboxDateRange(from, to);
  const out = new Map<string, InboxThread>();
  let end = rangeEnd;
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
        tags,
        ...(tags.length ? { tags_condition: "OR" } : {}),
        tags_to_exclude: [],
        sort: "desc",
        sort_by_created_at: byCreated,
        types: [],
        dateRange: [start, end],
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
    let added = 0;
    for (const t of data)
      if (!out.has(t.id)) {
        out.set(t.id, t);
        added++;
      }
    const last = data.at(-1);
    if (data.length < PAGE_SIZE || !last) return [...out.values()];
    if (byCreated) {
      // SMAX áp `after` lên last_message_at kể cả khi sắp theo ngày tạo → rớt khách mới đã nhắn tiếp.
      // Phân trang bằng cách lùi mốc cuối dateRange về created_at của dòng cuối (trùng biên đã bỏ ở trên).
      if (!added || !last.created_at) throw new Error("Không phân trang được hội thoại SMAX.");
      end = last.created_at;
    } else {
      if (!last.last_message_at) return [...out.values()];
      after = last.last_message_at;
    }
  }
  throw new Error("Quá nhiều hội thoại — chọn khoảng ngày ngắn hơn.");
}
