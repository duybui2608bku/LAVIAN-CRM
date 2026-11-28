/**
 * Số liệu marketing cho dashboard: FB Ads spend + SMAX statistics.
 * Range đầu vào là ngày VN (UTC+7) dạng `YYYY-MM-DD`; mỗi hệ nhận một định dạng:
 * FB `YYYY-MM-DD` (theo timezone TÀI KHOẢN ads — tài khoản đặt giờ VN),
 * SMAX `"YYYY-MM-DD HH:mm:ss +00:00"`, Supabase ISO UTC.
 * Token FB_TOKEN/SMAX_TOKEN chỉ đọc ở đây (server action gọi) — không NEXT_PUBLIC.
 */

import { addDays } from "./date-presets.ts";

// ponytail: 2 account id hardcode — thành config khi có nhu cầu thêm/bớt tài khoản.
const FB_AD_ACCOUNTS = ["act_1494701561142295", "act_405282048979489"];
const FB_API = "https://graph.facebook.com/v25.0";
const SMAX_DISTRIBUTION_API =
  "https://api.smax.ai/bizs/lavianbeautycenter/statistics-v2/supporter-distribution";

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
  data?: {
    spend?: string;
    account_currency?: string;
    actions?: { action_type?: string; value?: string }[];
  }[];
  error?: { message?: string };
};

// Số cuộc trò chuyện nhắn tin bắt đầu từ quảng cáo (cột "Tin nhắn" trong Ads Manager).
const FB_MESSAGE_ACTION = "onsite_conversion.messaging_conversation_started_7d";

/** Tổng spend + tin nhắn của các tài khoản ads trong range (theo currency tài khoản).
 *  1 tài khoản lỗi → ném lỗi cả hàm (tổng thiếu 1 account là số sai). */
export async function fetchFbAds(
  from: string,
  to: string,
): Promise<{ spend: number; messages: number; currency: string | null }> {
  const token = process.env.FB_TOKEN;
  if (!token) throw new Error("Thiếu FB_TOKEN.");
  const time_range = JSON.stringify({ since: from, until: to });
  const rows = await Promise.all(
    FB_AD_ACCOUNTS.map(async (act) => {
      const qs = new URLSearchParams({
        fields: "spend,actions,account_currency",
        time_range,
        access_token: token,
      });
      const res = await fetch(`${FB_API}/${act}/insights?${qs}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as FbInsightsRes | null;
      if (!res.ok || !json || json.error)
        throw new Error(json?.error?.message ?? `Facebook API ${res.status}`);
      // data rỗng = không chạy ads trong range → 0, không phải lỗi.
      const row = json.data?.[0];
      return {
        currency: row?.account_currency ?? null,
        spend: Number(row?.spend ?? 0),
        messages: Number(
          row?.actions?.find((a) => a.action_type === FB_MESSAGE_ACTION)
            ?.value ?? 0,
        ),
      };
    }),
  );
  // ponytail: giả định các tài khoản cùng currency — lấy currency đầu tiên có dữ liệu.
  return rows.reduce(
    (a, b) => ({
      spend: a.spend + b.spend,
      messages: a.messages + b.messages,
      currency: a.currency ?? b.currency,
    }),
    { spend: 0, messages: 0, currency: null as string | null },
  );
}

export type FbDaily = { spend: number; messages: number };

type FbDailyRes = {
  data?: {
    date_start?: string;
    spend?: string;
    account_currency?: string;
    actions?: { action_type?: string; value?: string }[];
  }[];
  paging?: { next?: string };
  error?: { message?: string };
};

/** Spend + tin nhắn THEO NGÀY (`time_increment=1`), cộng các tài khoản ads.
 *  Ngày không chạy ads không có trong map (= 0). */
export async function fetchFbAdsDaily(
  from: string,
  to: string,
): Promise<{ days: Map<string, FbDaily>; currency: string | null }> {
  const token = process.env.FB_TOKEN;
  if (!token) throw new Error("Thiếu FB_TOKEN.");
  const time_range = JSON.stringify({ since: from, until: to });
  const days = new Map<string, FbDaily>();
  let currency: string | null = null;

  const perAccount = await Promise.all(
    FB_AD_ACCOUNTS.map(async (act) => {
      const qs = new URLSearchParams({
        fields: "spend,actions,account_currency",
        time_range,
        time_increment: "1",
        limit: "500",
        access_token: token,
      });
      const out: NonNullable<FbDailyRes["data"]> = [];
      let url: string | undefined = `${FB_API}/${act}/insights?${qs}`;
      while (url) {
        const json: FbDailyRes = await fbGet(url);
        out.push(...(json.data ?? []));
        url = json.paging?.next;
      }
      return out;
    }),
  );

  for (const row of perAccount.flat()) {
    if (!row.date_start) continue;
    // ponytail: giả định các tài khoản cùng currency (giống fetchFbAds).
    currency ??= row.account_currency ?? null;
    const cur = days.get(row.date_start) ?? { spend: 0, messages: 0 };
    cur.spend += Number(row.spend ?? 0);
    cur.messages += Number(
      row.actions?.find((a) => a.action_type === FB_MESSAGE_ACTION)?.value ?? 0,
    );
    days.set(row.date_start, cur);
  }
  return { days, currency };
}

export type CampaignPlatform = "wa" | "ig";

/**
 * `destination_type` nhóm QC → nền tảng: WHATSAPP, INSTAGRAM_DIRECT, MESSAGING_INSTAGRAM_DIRECT_WHATSAPP,
 * LEAD_FROM_IG_DIRECT… (đích khác như ON_POST, WEBSITE, MESSENGER bỏ qua).
 */
export function destinationPlatforms(types: string[]): CampaignPlatform[] {
  const out: CampaignPlatform[] = [];
  if (types.some((t) => t.includes("WHATSAPP"))) out.push("wa");
  if (types.some((t) => /INSTAGRAM|IG_DIRECT/.test(t))) out.push("ig");
  return out;
}

export interface FbCampaign {
  id: string;
  name: string;
  /** Id số của tài khoản ads (không có tiền tố `act_`) — để mở Ads Manager. */
  accountId: string;
  accountName: string;
  status: string;
  /** Nền tảng nhận tin theo `destination_type` của các nhóm QC; null = không lấy được (UI đoán theo tên). */
  platforms: CampaignPlatform[] | null;
  spend: number;
  messages: number;
  impressions: number;
  reach: number;
}

type FbCampaignInsightsRes = {
  data?: {
    campaign_id?: string;
    campaign_name?: string;
    account_id?: string;
    account_name?: string;
    spend?: string;
    impressions?: string;
    reach?: string;
    actions?: { action_type?: string; value?: string }[];
  }[];
  paging?: { next?: string };
  error?: { message?: string };
};

type FbCampaignsRes = {
  data?: {
    id?: string;
    effective_status?: string;
    adsets?: { data?: { destination_type?: string }[] };
  }[];
  paging?: { next?: string };
  error?: { message?: string };
};

/** Bật/tắt chiến dịch trên Facebook (token cần quyền ads_management). */
export async function setFbCampaignStatus(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  const token = process.env.FB_TOKEN;
  if (!token) throw new Error("Thiếu FB_TOKEN.");
  const res = await fetch(`${FB_API}/${id}`, {
    method: "POST",
    body: new URLSearchParams({ status, access_token: token }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    error?: { message?: string; error_user_msg?: string };
  } | null;
  if (!res.ok || !json?.success)
    throw new Error(
      [json?.error?.message ?? `Facebook API ${res.status}`, json?.error?.error_user_msg]
        .filter(Boolean)
        .join(" — "),
    );
}

async function fbGet<T extends { error?: { message?: string } }>(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as T | null;
  if (!res.ok || !json || json.error) {
    // Kèm error_user_msg (nếu có) — "Invalid parameter" trơn không đủ để chẩn đoán.
    const err = json?.error as
      | { message?: string; error_user_msg?: string }
      | undefined;
    throw new Error(
      [err?.message ?? `Facebook API ${res.status}`, err?.error_user_msg]
        .filter(Boolean)
        .join(" — "),
    );
  }
  return json;
}

// Mọi trạng thái đọc được của chiến dịch: edge /campaigns không lọc thì BỎ ARCHIVED; DELETED bị từ chối.
const FB_CAMPAIGN_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED", "IN_PROCESS", "WITH_ISSUES"];

type CampaignMeta = { status: string; platforms: CampaignPlatform[] | null };

/**
 * Trạng thái hiện tại + nền tảng (destination_type nhóm QC lồng trong cùng lệnh gọi) của ĐÚNG các chiến dịch
 * có số liệu — lọc `id IN` thay vì liệt kê cả nghìn chiến dịch của tài khoản (nặng, hay dính rate limit).
 * (`?ids=` đã bị Meta khai tử.) Best-effort: lỗi / thiếu (đã xoá) → "UNKNOWN" + platforms null.
 */
async function fetchFbCampaignMeta(
  token: string,
  act: string,
  ids: string[],
): Promise<Map<string, CampaignMeta>> {
  const meta = new Map<string, CampaignMeta>();
  if (!ids.length) return meta;
  const qs = new URLSearchParams({
    fields: "id,effective_status,adsets.limit(100){destination_type}",
    filtering: JSON.stringify([{ field: "id", operator: "IN", value: ids }]),
    effective_status: JSON.stringify(FB_CAMPAIGN_STATUSES),
    limit: "200",
    access_token: token,
  });
  let url: string | undefined = `${FB_API}/${act}/campaigns?${qs}`;
  try {
    while (url) {
      const json: FbCampaignsRes = await fbGet(url);
      for (const c of json.data ?? []) {
        if (!c.id || !c.effective_status) continue;
        // Nhóm QC lồng cũng bỏ ARCHIVED → không còn nhóm nào thì không biết đích (UI đoán theo tên).
        const types = (c.adsets?.data ?? []).flatMap((a) => a.destination_type ?? []);
        meta.set(c.id, {
          status: c.effective_status,
          platforms: types.length ? destinationPlatforms(types) : null,
        });
      }
      url = json.paging?.next;
    }
  } catch (err) {
    console.error(`[fb] campaigns meta ${act}:`, err);
  }
  return meta;
}

/** Chiến dịch có lượt hiển thị > 0 trong range (gộp các tài khoản ads), kèm trạng thái hiện tại. */
export async function fetchFbCampaigns(
  from: string,
  to: string,
): Promise<FbCampaign[]> {
  const token = process.env.FB_TOKEN;
  if (!token) throw new Error("Thiếu FB_TOKEN.");
  const time_range = JSON.stringify({ since: from, until: to });

  // Mỗi tài khoản: insights trước, rồi hỏi trạng thái/nền tảng của đúng các chiến dịch đó; 2 tài khoản song song.
  const byAccount = await Promise.all(
    FB_AD_ACCOUNTS.map(async (act) => {
      const qs = new URLSearchParams({
        level: "campaign",
        fields:
          "campaign_id,campaign_name,account_id,account_name,spend,impressions,reach,actions",
        time_range,
        limit: "500",
        access_token: token,
      });
      const out: NonNullable<FbCampaignInsightsRes["data"]> = [];
      let url: string | undefined = `${FB_API}/${act}/insights?${qs}`;
      while (url) {
        const json: FbCampaignInsightsRes = await fbGet(url);
        out.push(...(json.data ?? []));
        url = json.paging?.next;
      }
      const rows = out.filter((r) => r.campaign_id && Number(r.impressions ?? 0) > 0);
      const meta = await fetchFbCampaignMeta(token, act, rows.map((r) => r.campaign_id!));
      return rows.map((r) => ({ r, meta: meta.get(r.campaign_id!) }));
    }),
  );

  return byAccount
    .flat()
    .map(({ r, meta }) => ({
      id: r.campaign_id!,
      name: r.campaign_name ?? "—",
      accountId: r.account_id ?? "",
      accountName: r.account_name ?? "—",
      status: meta?.status ?? "UNKNOWN",
      platforms: meta?.platforms ?? null,
      spend: Number(r.spend ?? 0),
      messages: Number(
        r.actions?.find((a) => a.action_type === FB_MESSAGE_ACTION)?.value ?? 0,
      ),
      impressions: Number(r.impressions ?? 0),
      reach: Number(r.reach ?? 0),
    }))
    .sort((a, b) => b.spend - a.spend);
}

/** ad_id → campaign_id của các quảng cáo có số liệu trong range (dùng ghép ad_id hội thoại IG của SMAX). */
export async function fetchFbAdCampaigns(
  from: string,
  to: string,
): Promise<Map<string, string>> {
  const token = process.env.FB_TOKEN;
  if (!token) throw new Error("Thiếu FB_TOKEN.");
  const out = new Map<string, string>();
  await Promise.all(
    FB_AD_ACCOUNTS.map(async (act) => {
      const qs = new URLSearchParams({
        level: "ad",
        fields: "ad_id,campaign_id",
        time_range: JSON.stringify({ since: from, until: to }),
        limit: "500",
        access_token: token,
      });
      let url: string | undefined = `${FB_API}/${act}/insights?${qs}`;
      while (url) {
        const json: {
          data?: { ad_id?: string; campaign_id?: string }[];
          paging?: { next?: string };
          error?: { message?: string };
        } = await fbGet(url);
        for (const r of json.data ?? [])
          if (r.ad_id && r.campaign_id) out.set(r.ad_id, r.campaign_id);
        url = json.paging?.next;
      }
    }),
  );
  return out;
}

// ad → campaign không bao giờ đổi → cache cả tiến trình; null = Meta báo không tồn tại / không có quyền (code 100).
const adCampaignCache = new Map<string, string | null>();

/**
 * campaign_id của các ad_id cụ thể (QC cũ không chạy trong kỳ nên không có trong insights) — `GET /{ad_id}`,
 * song song có giới hạn. Best-effort: lỗi tạm thời → log, bỏ qua (lần sau tra lại).
 */
export async function fetchFbAdCampaignsByIds(ids: string[]): Promise<Map<string, string>> {
  const token = process.env.FB_TOKEN;
  if (!token) throw new Error("Thiếu FB_TOKEN.");
  const queue = [...new Set(ids)].filter((id) => /^\d+$/.test(id) && !adCampaignCache.has(id));
  await Promise.all(
    Array.from({ length: Math.min(10, queue.length) }, async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        const qs = new URLSearchParams({ fields: "campaign_id", access_token: token });
        try {
          const res = await fetch(`${FB_API}/${id}?${qs}`, { cache: "no-store" });
          const json = (await res.json().catch(() => null)) as {
            campaign_id?: string;
            error?: { code?: number; message?: string };
          } | null;
          if (json?.campaign_id) adCampaignCache.set(id, json.campaign_id);
          else if (json?.error?.code === 100) adCampaignCache.set(id, null);
          else console.error(`[fb] ad ${id}:`, json?.error?.message ?? res.status);
        } catch (err) {
          console.error(`[fb] ad ${id}:`, err);
        }
      }
    }),
  );
  const out = new Map<string, string>();
  for (const id of ids) {
    const c = adCampaignCache.get(id);
    if (c) out.set(id, c);
  }
  return out;
}

type SmaxDistributionRes = {
  status?: number;
  message?: string;
  data?: { data?: { user_id?: string; handled_conversations?: number }[] };
};

/** Số hội thoại mỗi nhân viên SMAX đã xử lý trong range (mọi trang) → Map user_id → handled_conversations. */
export async function fetchSmaxHandledConversations(from: string, to: string): Promise<Map<string, number>> {
  const token = process.env.SMAX_TOKEN;
  if (!token) throw new Error("Thiếu SMAX_TOKEN.");
  const range = smaxRange(from, to);
  const res = await fetch(SMAX_DISTRIBUTION_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
    body: JSON.stringify({ from: range.from, to: range.to, page_pids: [] }),
  });
  const json = (await res.json().catch(() => null)) as SmaxDistributionRes | null;
  if (!res.ok || !json || json.status !== 200) throw new Error(json?.message ?? `SMAX API ${res.status}`);
  const out = new Map<string, number>();
  for (const row of json.data?.data ?? []) {
    if (row.user_id) out.set(row.user_id, (out.get(row.user_id) ?? 0) + Number(row.handled_conversations ?? 0));
  }
  return out;
}
