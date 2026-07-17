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
const SMAX_STAFF_RANKING_API =
  "https://api.smax.ai/bizs/lavianbeautycenter/statistics-v2/supporter-staff-ranking";
const SMAX_STAFF_REPORT_API =
  "https://api.smax.ai/bizs/lavianbeautycenter/statistics-v2/supporter-staff-report";
const SMAX_PAGE_PIDS = [
  "ttw7356194253834421253",
  "fb604861366051343",
  "ig17841474444790127",
];
const SMAX_WHATSAPP_PAGE_PIDS = ["waw6281111858631", "waw6281111858630"];

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

export interface SmaxStaffStat {
  userId: string;
  name: string;
  customers: number;
  phoneLeads: number;
  phoneRate: number;
}

type SmaxRankItem = {
  user_id?: string;
  name?: string;
  rank?: number;
  value?: number;
};

type SmaxStaffRankingRes = {
  status?: number;
  message?: string;
  data?: {
    phone_rank?: SmaxRankItem[];
    rate_phone_rank?: SmaxRankItem[];
  };
};

type SmaxStaffReportRes = {
  status?: number;
  message?: string;
  data?: {
    charts?: {
      care_chart?: {
        user_id?: string;
        name?: string;
        customer_count?: number;
      }[];
    };
  };
};

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
    page_pids: SMAX_PAGE_PIDS,
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

/** Ghép báo cáo chăm sóc với xếp hạng SĐT theo `user_id`. */
export async function fetchSmaxStaffStats(
  from: string,
  to: string,
): Promise<SmaxStaffStat[]> {
  const token = process.env.SMAX_TOKEN;
  if (!token) throw new Error("Thiếu SMAX_TOKEN.");
  const range = smaxRange(from, to);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const [rankingRes, reportRes, whatsappReportRes] = await Promise.all([
    fetch(SMAX_STAFF_RANKING_API, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        from: `${addDays(from, -1)}T17:00:00.000Z`,
        to: `${to}T16:59:59.999Z`,
        page_pids: SMAX_PAGE_PIDS,
        top: 10,
      }),
    }),
    fetch(SMAX_STAFF_REPORT_API, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        from: range.from,
        to: range.to,
        page_pids: SMAX_PAGE_PIDS,
      }),
    }),
    fetch(SMAX_STAFF_REPORT_API, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        from: range.from,
        to: range.to,
        page_pids: SMAX_WHATSAPP_PAGE_PIDS,
      }),
    }),
  ]);

  const [ranking, report, whatsappReport] = (await Promise.all([
    rankingRes.json().catch(() => null),
    reportRes.json().catch(() => null),
    whatsappReportRes.json().catch(() => null),
  ])) as [
    SmaxStaffRankingRes | null,
    SmaxStaffReportRes | null,
    SmaxStaffReportRes | null,
  ];

  if (!rankingRes.ok || !ranking || ranking.status !== 200)
    throw new Error(ranking?.message ?? `SMAX ranking API ${rankingRes.status}`);
  if (!reportRes.ok || !report || report.status !== 200)
    throw new Error(report?.message ?? `SMAX report API ${reportRes.status}`);
  if (
    !whatsappReportRes.ok ||
    !whatsappReport ||
    whatsappReport.status !== 200
  )
    throw new Error(
      whatsappReport?.message ??
        `SMAX WhatsApp report API ${whatsappReportRes.status}`,
    );

  const rows = new Map<string, SmaxStaffStat>();
  for (const item of report.data?.charts?.care_chart ?? []) {
    if (!item.user_id) continue;
    rows.set(item.user_id, {
      userId: item.user_id,
      name: item.name?.trim() || "—",
      customers: Number(item.customer_count ?? 0),
      phoneLeads: 0,
      phoneRate: 0,
    });
  }
  for (const item of ranking.data?.phone_rank ?? []) {
    if (!item.user_id) continue;
    const current = rows.get(item.user_id) ?? {
      userId: item.user_id,
      name: item.name?.trim() || "—",
      customers: 0,
      phoneLeads: 0,
      phoneRate: 0,
    };
    current.name = item.name?.trim() || current.name;
    current.phoneLeads = Number(item.value ?? 0);
    rows.set(item.user_id, current);
  }
  // Mỗi khách từ 2 page WhatsApp được xem là đã cung cấp SĐT.
  for (const item of whatsappReport.data?.charts?.care_chart ?? []) {
    if (!item.user_id) continue;
    const current = rows.get(item.user_id) ?? {
      userId: item.user_id,
      name: item.name?.trim() || "—",
      customers: 0,
      phoneLeads: 0,
      phoneRate: 0,
    };
    current.name = item.name?.trim() || current.name;
    current.phoneLeads += Number(item.customer_count ?? 0);
    rows.set(item.user_id, current);
  }
  for (const item of ranking.data?.rate_phone_rank ?? []) {
    if (!item.user_id) continue;
    const current = rows.get(item.user_id) ?? {
      userId: item.user_id,
      name: item.name?.trim() || "—",
      customers: 0,
      phoneLeads: 0,
      phoneRate: 0,
    };
    current.name = item.name?.trim() || current.name;
    current.phoneRate = Number(item.value ?? 0);
    rows.set(item.user_id, current);
  }

  return [...rows.values()].sort(
    (a, b) => b.phoneLeads - a.phoneLeads || b.customers - a.customers,
  );
}
