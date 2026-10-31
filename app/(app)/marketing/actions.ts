"use server";

import { requireAdmin } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { fetchFbAds, fetchSmaxStats } from "@/lib/marketing";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface AdsStats {
  spend: number | null;
  messages: number | null;
  leads: number | null;
  errors: { fb?: string; smax?: string; db?: string };
  error?: string;
}

/** Số liệu trang Marketing theo khoảng ngày Việt Nam `YYYY-MM-DD`. */
export async function getAdsStats(from: string, to: string): Promise<AdsStats> {
  await requireAdmin();

  const stats: AdsStats = {
    spend: null,
    messages: null,
    leads: null,
    errors: {},
  };
  if (!YMD_RE.test(from) || !YMD_RE.test(to) || from > to)
    return { ...stats, error: "Khoảng ngày không hợp lệ." };

  const [fb, smax] = await Promise.allSettled([
    fetchFbAds(from, to),
    fetchSmaxStats(from, to),
  ]);

  if (fb.status === "fulfilled") {
    stats.spend = fb.value.spend;
    stats.messages = fb.value.messages;
  } else stats.errors.fb = normalizeError(fb.reason).message;

  if (smax.status === "fulfilled") stats.leads = smax.value.leads;
  else stats.errors.smax = normalizeError(smax.reason).message;

  return stats;
}
