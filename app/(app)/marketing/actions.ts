"use server";

import { requireAdmin } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import {
  fetchFbAds,
  fetchFbCampaigns,
  fetchSmaxStats,
  setFbCampaignStatus,
  type FbCampaign,
} from "@/lib/marketing";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface AdsStats {
  /** Currency tài khoản ads (vd. "IDR", "VND"); null khi FB lỗi. */
  currency: string | null;
  spend: number | null;
  messages: number | null;
  leads: number | null;
  campaigns: FbCampaign[] | null;
  errors: { fb?: string; campaigns?: string; smax?: string; db?: string };
  error?: string;
}

/** Số liệu trang Marketing theo khoảng ngày Việt Nam `YYYY-MM-DD`. */
export async function getAdsStats(from: string, to: string): Promise<AdsStats> {
  await requireAdmin();

  const stats: AdsStats = {
    currency: null,
    spend: null,
    messages: null,
    leads: null,
    campaigns: null,
    errors: {},
  };
  if (!YMD_RE.test(from) || !YMD_RE.test(to) || from > to)
    return { ...stats, error: "Khoảng ngày không hợp lệ." };

  const [fb, campaigns, smax] = await Promise.allSettled([
    fetchFbAds(from, to),
    fetchFbCampaigns(from, to),
    fetchSmaxStats(from, to),
  ]);

  if (fb.status === "fulfilled") {
    stats.currency = fb.value.currency;
    stats.spend = fb.value.spend;
    stats.messages = fb.value.messages;
  } else stats.errors.fb = normalizeError(fb.reason).message;

  if (campaigns.status === "fulfilled") stats.campaigns = campaigns.value;
  else stats.errors.campaigns = normalizeError(campaigns.reason).message;

  if (smax.status === "fulfilled") stats.leads = smax.value.leads;
  else stats.errors.smax = normalizeError(smax.reason).message;

  return stats;
}

/** Bật (ACTIVE) / tạm dừng (PAUSED) một chiến dịch FB. */
export async function updateCampaignStatus(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<{ error?: string }> {
  await requireAdmin();
  if (!/^\d+$/.test(id) || (status !== "ACTIVE" && status !== "PAUSED"))
    return { error: "Tham số không hợp lệ." };
  try {
    await setFbCampaignStatus(id, status);
    return {};
  } catch (err) {
    return { error: normalizeError(err).message };
  }
}
