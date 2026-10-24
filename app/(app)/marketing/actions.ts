"use server";

import { requireAdmin } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import {
  fetchFbAds,
  fetchFbCampaigns,
  fetchSmaxStats,
  supaRange,
  type FbCampaign,
} from "@/lib/marketing";
import { createClient } from "@/lib/supabase/server";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface AdsStats {
  spend: number | null;
  messages: number | null;
  leads: number | null;
  appointments: number | null;
  visited: number | null;
  campaigns: FbCampaign[] | null;
  errors: { fb?: string; campaigns?: string; smax?: string; db?: string };
  error?: string;
}

/** Số liệu trang Marketing theo khoảng ngày Việt Nam `YYYY-MM-DD`. */
export async function getAdsStats(from: string, to: string): Promise<AdsStats> {
  await requireAdmin();

  const stats: AdsStats = {
    spend: null,
    messages: null,
    leads: null,
    appointments: null,
    visited: null,
    campaigns: null,
    errors: {},
  };
  if (!YMD_RE.test(from) || !YMD_RE.test(to) || from > to)
    return { ...stats, error: "Khoảng ngày không hợp lệ." };

  const supabase = await createClient();
  const { start, end } = supaRange(from, to);
  const countAppointments = (column: "scheduled_at" | "checked_in_at") =>
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte(column, start)
      .lt(column, end);

  const [fb, campaigns, smax, appointments, visited] = await Promise.allSettled([
    fetchFbAds(from, to),
    fetchFbCampaigns(from, to),
    fetchSmaxStats(from, to),
    countAppointments("scheduled_at"),
    countAppointments("checked_in_at"),
  ]);

  if (fb.status === "fulfilled") {
    stats.spend = fb.value.spend;
    stats.messages = fb.value.messages;
  } else stats.errors.fb = normalizeError(fb.reason).message;

  if (campaigns.status === "fulfilled") stats.campaigns = campaigns.value;
  else stats.errors.campaigns = normalizeError(campaigns.reason).message;

  if (smax.status === "fulfilled") stats.leads = smax.value.leads;
  else stats.errors.smax = normalizeError(smax.reason).message;

  for (const [key, result] of [
    ["appointments", appointments],
    ["visited", visited],
  ] as const) {
    if (result.status === "rejected" || result.value.error)
      stats.errors.db = normalizeError(
        result.status === "rejected" ? result.reason : result.value.error,
      ).message;
    else stats[key] = result.value.count ?? 0;
  }

  return stats;
}
