/**
 * Số liệu marketing cho dashboard: FB Ads spend + SMAX statistics.
 * Range đầu vào là ngày VN (UTC+7) dạng `YYYY-MM-DD`; mỗi hệ nhận một định dạng:
 * FB `YYYY-MM-DD` (theo timezone TÀI KHOẢN ads — tài khoản đặt giờ VN),
 * SMAX `"YYYY-MM-DD HH:mm:ss +00:00"`, Supabase ISO UTC.
 * Token FB_TOKEN/SMAX_TOKEN chỉ đọc ở đây (server action gọi) — không NEXT_PUBLIC.
 */

// ponytail: 2 account id hardcode — thành config khi có nhu cầu thêm/bớt tài khoản.
const FB_AD_ACCOUNTS = ["act_1494701561142295", "act_3723515967967924"];
const FB_API = "https://graph.facebook.com/v25.0";
const SMAX_API =
  "https://api.smax.ai/bizs/lavianbeautycenter/statistics-v2/customers";
const SMAX_TAGS_API =
  "https://api.smax.ai/bizs/lavianbeautycenter/statistics-v2/tags";

/** Cộng/trừ n ngày trên chuỗi `YYYY-MM-DD` — số học Date.UTC, không dính timezone máy. */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  const p = (x: number) => String(x).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

/** Range cho SMAX: 00:00 ngày VN = 17:00 UTC hôm trước. */
export function smaxRange(from: string, to: string) {
  return {
    from: `${addDays(from, -1)} 17:00:00 +00:00`,
    to: `${to} 16:59:59 +00:00`,
  };
}

/** Range ISO UTC nửa mở [start, end) phủ trọn các ngày VN — dùng cho filter Supabase. */
export function supaRange(from: string, to: string) {
  return {
    start: `${addDays(from, -1)}T17:00:00Z`,
    end: `${to}T17:00:00Z`,
  };
}

type FbInsightsRes = {
  data?: { spend?: string }[];
  error?: { message?: string };
};

/** Tổng spend 2 tài khoản ads trong range (VND theo currency tài khoản).
 *  1 tài khoản lỗi → ném lỗi cả hàm (tổng thiếu 1 account là số sai). */
export async function fetchFbSpend(from: string, to: string): Promise<number> {
  const token = process.env.FB_TOKEN;
  if (!token) throw new Error("Thiếu FB_TOKEN.");
  const time_range = JSON.stringify({ since: from, until: to });
  const spends = await Promise.all(
    FB_AD_ACCOUNTS.map(async (act) => {
      const qs = new URLSearchParams({
        fields: "spend",
        time_range,
        access_token: token,
      });
      const res = await fetch(`${FB_API}/${act}/insights?${qs}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as FbInsightsRes | null;
      if (!res.ok || !json || json.error)
        throw new Error(json?.error?.message ?? `Facebook API ${res.status}`);
      // data rỗng = không chạy ads trong range → spend 0, không phải lỗi.
      return Number(json.data?.[0]?.spend ?? 0);
    }),
  );
  return spends.reduce((a, b) => a + b, 0);
}

type SmaxRes = {
  status?: number;
  message?: string;
  data?: {
    customer_message_total?: number;
    customer_lead_total?: number;
  };
};

export interface SmaxTagStat {
  name: string;
  cur: number;
}

type SmaxTagsRes = {
  status?: number;
  message?: string;
  data?: {
    tags_calendar?: {
      name?: string;
      calendars?: { add?: number; remove?: number }[];
    }[];
  };
};

function smaxPayload(from: string, to: string) {
  const range = smaxRange(from, to);
  return {
    from: range.from,
    to: range.to,
    apply_all: true,
    key_time: "30_days",
    page_pids: [],
    target: "customer_and_page",
    type: "message_and_comment",
    tag_aliases: [],
    top: 10,
  };
}

/** Khách nhắn tin + để lại số từ SMAX statistics-v2 trong range. */
export async function fetchSmaxStats(
  from: string,
  to: string,
): Promise<{ messages: number; leads: number }> {
  const token = process.env.SMAX_TOKEN;
  if (!token) throw new Error("Thiếu SMAX_TOKEN.");
  const res = await fetch(SMAX_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    // Payload theo mẫu SMAX cung cấp — chỉ from/to thay đổi theo range chọn.
    body: JSON.stringify(smaxPayload(from, to)),
  });
  const json = (await res.json().catch(() => null)) as SmaxRes | null;
  if (!res.ok || !json || json.status !== 200)
    throw new Error(json?.message ?? `SMAX API ${res.status}`);
  return {
    messages: Number(json.data?.customer_message_total ?? 0),
    leads: Number(json.data?.customer_lead_total ?? 0),
  };
}

/** Danh sách tag SMAX theo lịch; `cur` là biến động ròng Σ(add - remove) trong range. */
export async function fetchSmaxTags(
  from: string,
  to: string,
): Promise<SmaxTagStat[]> {
  const token = process.env.SMAX_TOKEN;
  if (!token) throw new Error("Thiếu SMAX_TOKEN.");

  const res = await fetch(SMAX_TAGS_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    body: JSON.stringify(smaxPayload(from, to)),
  });
  const json = (await res.json().catch(() => null)) as SmaxTagsRes | null;
  if (!res.ok || !json || json.status !== 200)
    throw new Error(json?.message ?? `SMAX API ${res.status}`);

  return (json.data?.tags_calendar ?? [])
    .filter((tag): tag is {
      name: string;
      calendars?: { add?: number; remove?: number }[];
    } =>
      Boolean(tag.name?.trim()),
    )
    .map((tag) => ({
      name: tag.name.trim(),
      cur: (tag.calendars ?? []).reduce(
        (total, day) => total + Number(day.add ?? 0) - Number(day.remove ?? 0),
        0,
      ),
    }));
}
