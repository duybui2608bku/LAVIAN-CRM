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
const PAGE_SIZE = 500; // SMAX nhận tối đa ~500 (1000 → 400).
const MAX_PAGES = 50; // mỗi ngày — vượt thì báo lỗi thay vì ra số thiếu.
const SLICE_MS = 86_400_000; // chia khoảng ngày theo từng ngày để tải song song
// Đo 2026-11-17 (30 ngày ~5000 hội thoại): tuần tự ~20s → 8 luồng ~4s. Cao hơn dễ bị SMAX trả 502.
const CONCURRENCY = 8;
const RETRIES = 3;

type ThreadsRes = { status?: number; message?: string; data?: InboxThread[] };

/** POST có thử lại khi SMAX quá tải (429/5xx) hoặc rớt mạng. */
async function post(body: string, token: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(THREADS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
      body,
    }).catch((e: unknown) => (attempt < RETRIES ? null : Promise.reject(e)));
    if (res && (res.ok || attempt >= RETRIES || (res.status !== 429 && res.status < 500))) return res;
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }
}

export type ThreadsQuery = {
  /** true: lọc/sắp theo NGÀY TẠO hội thoại (khách mới); false: theo tin nhắn mới nhất. */
  byCreated?: boolean;
  /** Chỉ hội thoại có 1 trong các tag (OR). */
  tags?: string[];
};

/** Hội thoại WA + IG trong khoảng ngày (theo ngày tạo hoặc theo tin nhắn mới nhất), đã bỏ trùng. */
export async function fetchInboxThreads(from: string, to: string, { byCreated = false, tags = [] }: ThreadsQuery = {}): Promise<InboxThread[]> {
  const token = process.env.SMAX_TOKEN ?? "";
  if (!token) throw new Error("Thiếu SMAX_TOKEN.");
  const out = new Map<string, InboxThread>();

  /** Tải hết 1 lát [start, end] (phân trang tuần tự trong lát). */
  async function fetchSlice(start: string, sliceEnd: string) {
    let end = sliceEnd;
    let after = "";
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await post(
        JSON.stringify({
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
        token,
      );
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
      if (data.length < PAGE_SIZE || !last) return;
      if (byCreated) {
        // SMAX áp `after` lên last_message_at kể cả khi sắp theo ngày tạo → rớt khách mới đã nhắn tiếp.
        // Phân trang bằng cách lùi mốc cuối dateRange về created_at của dòng cuối (trùng biên đã bỏ ở trên).
        if (!added || !last.created_at) throw new Error("Không phân trang được hội thoại SMAX.");
        end = last.created_at;
      } else {
        if (!last.last_message_at) return;
        after = last.last_message_at;
      }
    }
    throw new Error("Quá nhiều hội thoại — chọn khoảng ngày ngắn hơn.");
  }

  // Mỗi hội thoại có đúng 1 created_at / last_message_at → rơi vào đúng 1 lát ngày; các lát tải song song.
  const [start, end] = inboxDateRange(from, to).map(Date.parse);
  const slices: [string, string][] = [];
  for (let s = start; s <= end; s += SLICE_MS)
    slices.push([new Date(s).toISOString(), new Date(Math.min(s + SLICE_MS - 1, end)).toISOString()]);
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, slices.length) }, async () => {
      for (let s = slices.shift(); s; s = slices.shift()) await fetchSlice(...s);
    }),
  );
  return [...out.values()];
}
