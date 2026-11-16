"use server";

import { requirePermission } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { dayCount } from "@/lib/reports";
import { buildInboxReport, type InboxReport } from "@/lib/smax-inbox";
import { fetchInboxThreads } from "@/lib/smax-threads";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 31;

/** Báo cáo Smax theo khoảng ngày WIB `YYYY-MM-DD`. */
export async function getInboxReport(from: string, to: string): Promise<{ data: InboxReport | null; error?: string }> {
  await requirePermission("customers.view");
  if (!YMD_RE.test(from) || !YMD_RE.test(to) || from > to) return { data: null, error: "Khoảng ngày không hợp lệ." };
  if (dayCount(from, to) > MAX_DAYS) return { data: null, error: `Chọn tối đa ${MAX_DAYS} ngày.` };
  try {
    return { data: buildInboxReport(await fetchInboxThreads(from, to)) };
  } catch (err) {
    return { data: null, error: normalizeError(err).message };
  }
}
