/** Lấy hội thoại SMAX cho Báo cáo Smax — CHỈ server (env `SMAX_TOKEN`). Logic tính ở lib/smax-inbox.ts. */
import { addDays } from "./reports";
import { fetchMessagesByRef } from "./smax-messages";
import { igPhoneIndex, igPhones, findPhones, inboxDateRange, POTENTIAL_ALIASES, type IgByPhone, type InboxThread } from "./smax-inbox";

const THREADS_API = "https://api.smax.ai/bizs/lavianbeautycenter/threads";
const IG_PAGE = "ig17841474444790127";
// 6 số WhatsApp + Instagram (danh sách page SMAX của biz, đã kiểm 2026-11-16).
const PAGE_PIDS = [
  "waw6285923553637",
  "waw6285923553660",
  "waw6285281304943",
  "waw6281918453455",
  "waw6281188031791",
  "waw6281111858630",
  IG_PAGE,
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
  /** Chỉ các trang này (mặc định: 6 số WA + IG). */
  pages?: string[];
};

/** Hội thoại WA + IG trong khoảng ngày (theo ngày tạo hoặc theo tin nhắn mới nhất), đã bỏ trùng. */
export async function fetchInboxThreads(from: string, to: string, { byCreated = false, tags = [], pages = PAGE_PIDS }: ThreadsQuery = {}): Promise<InboxThread[]> {
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
          page_pids: pages,
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

// Khách nhắn IG rồi sang WA: 11/63 cặp đo được cách nhau > 7 ngày → nhìn lùi 30 ngày.
const IG_LOOKBACK_DAYS = 30;

/**
 * SĐT → hội thoại IG, để gộp khách IG chuyển sang nhắn WA (`byCustomer`).
 * Nguồn: hội thoại IG trong `loaded` + IG tạo trong 30 ngày trước `from`. Khách IG đã có tag chuyển đổi mà SMAX
 * không lưu số → đọc 20 tin gần nhất tìm số (best-effort: lỗi thì bỏ qua hội thoại đó).
 */
export async function fetchIgByPhone(from: string, loaded: Promise<InboxThread[]>[]): Promise<IgByPhone> {
  const lists = await Promise.all([igLookback(from), ...loaded]);
  const ig = [...new Map(lists.flat().filter((t) => t.platform === "instagram").map((t) => [t.id, t])).values()];
  const missing = ig.filter(
    (t) =>
      t.page_pid &&
      t.tid &&
      !t.scanned_phones &&
      !igPhones(t).length &&
      POTENTIAL_ALIASES.some((a) => t.tag_aliases?.includes(a)),
  );
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, missing.length) }, async () => {
      for (let t = missing.shift(); t; t = missing.shift()) t.scanned_phones = await scanPhones(t.page_pid!, t.tid!);
    }),
  );
  return igPhoneIndex(ig);
}

// ponytail: cache trong bộ nhớ tiến trình server (mất khi khởi động lại / khác instance — chỉ để đỡ gọi lặp).
// Chỉ cache dữ liệu quá khứ ít đổi (IG tạo trước kỳ, SĐT tìm trong tin); số liệu báo cáo luôn lấy mới.
const CACHE_TTL = 30 * 60_000; // dữ liệu quá khứ (IG cũ, SĐT trong tin) ít đổi
const CACHE_MAX = 500;
type Cache<T> = Map<string, { at: number; value: Promise<T> }>;

/** Cache có hạn; quá `CACHE_MAX` thì bỏ mục cũ nhất. Lưu Promise để 2 request trùng lúc chỉ gọi SMAX 1 lần. */
function memo<T>(store: Cache<T>, key: string, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value;
  const value = load();
  store.delete(key);
  store.set(key, { at: Date.now(), value });
  value.catch(() => store.get(key)?.value === value && store.delete(key)); // lỗi → lần sau gọi lại
  if (store.size > CACHE_MAX) store.delete(store.keys().next().value!);
  return value;
}

const lookbackCache: Cache<InboxThread[]> = new Map();
/** IG tạo trong 30 ngày trước `from` (Smax report + Marketing dùng chung). */
const igLookback = (from: string) =>
  memo(lookbackCache, from, () =>
    fetchInboxThreads(addDays(from, -IG_LOOKBACK_DAYS), addDays(from, -1), { byCreated: true, pages: [IG_PAGE] }),
  );

const scanCache: Cache<string[]> = new Map();
/** SĐT khách gõ trong 20 tin gần nhất (best-effort: lỗi → không có số). */
const scanPhones = (page: string, tid: string) =>
  memo(scanCache, `${page}/${tid}`, async () => {
    const msgs = await fetchMessagesByRef({ page, tid }, 20).catch(() => []);
    return findPhones(msgs.filter((m) => !m.out).map((m) => m.text).join("\n"));
  });
