"use server";

import { requirePermission } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import {
  fetchFbAdCampaigns,
  fetchFbAds,
  fetchFbCampaigns,
  setFbCampaignStatus,
  type FbCampaign,
} from "@/lib/marketing";
import { countPotential, type PotentialCounts } from "@/lib/smax-inbox";
import { fetchInboxThreads } from "@/lib/smax-threads";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface AdsStats {
  /** Currency tài khoản ads (vd. "IDR", "VND"); null khi FB lỗi. */
  currency: string | null;
  spend: number | null;
  messages: number | null;
  campaigns: FbCampaign[] | null;
  /** Khách tiềm năng (khách SMAX mới trong range có tag Phone/WA, Booking, Deposit, Purchase): tổng + theo chiến dịch IG / số WA; null khi lỗi. */
  potential: PotentialCounts | null;
  errors: { fb?: string; campaigns?: string; db?: string; potential?: string };
  error?: string;
}

/** Số liệu trang Marketing theo khoảng ngày Việt Nam `YYYY-MM-DD`. */
export async function getAdsStats(from: string, to: string): Promise<AdsStats> {
  await requirePermission("marketing.view");

  const stats: AdsStats = {
    currency: null,
    spend: null,
    messages: null,
    campaigns: null,
    potential: null,
    errors: {},
  };
  if (!YMD_RE.test(from) || !YMD_RE.test(to) || from > to)
    return { ...stats, error: "Khoảng ngày không hợp lệ." };

  const [fb, campaigns, potential] = await Promise.allSettled([
    fetchFbAds(from, to),
    fetchFbCampaigns(from, to),
    Promise.all([fetchInboxThreads(from, to, { byCreated: true }), fetchFbAdCampaigns(from, to)]).then(
      ([threads, ads]) => countPotential(threads, ads),
    ),
  ]);

  if (potential.status === "fulfilled") stats.potential = potential.value;
  else stats.errors.potential = normalizeError(potential.reason).message;

  if (fb.status === "fulfilled") {
    stats.currency = fb.value.currency;
    stats.spend = fb.value.spend;
    stats.messages = fb.value.messages;
  } else stats.errors.fb = normalizeError(fb.reason).message;

  if (campaigns.status === "fulfilled") stats.campaigns = campaigns.value;
  else stats.errors.campaigns = normalizeError(campaigns.reason).message;

  return stats;
}

/** Bật (ACTIVE) / tạm dừng (PAUSED) một chiến dịch FB. */
export async function updateCampaignStatus(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<{ error?: string }> {
  await requirePermission("marketing.edit");
  if (!/^\d+$/.test(id) || (status !== "ACTIVE" && status !== "PAUSED"))
    return { error: "Tham số không hợp lệ." };
  try {
    await setFbCampaignStatus(id, status);
    return {};
  } catch (err) {
    return { error: normalizeError(err).message };
  }
}
