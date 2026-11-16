"use server";

import { requirePermission } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { dayCount } from "@/lib/reports";
import { buildFollowupReport, buildInboxReport, type FollowupReport, type InboxReport, type InboxThread } from "@/lib/smax-inbox";
import { fetchInboxThreads } from "@/lib/smax-threads";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 31;

/** Kiểm quyền + khoảng ngày WIB `YYYY-MM-DD`, lấy hội thoại rồi tính báo cáo. */
async function withThreads<T>(from: string, to: string, build: (threads: InboxThread[]) => T): Promise<{ data: T | null; error?: string }> {
  await requirePermission("customers.view");
  if (!YMD_RE.test(from) || !YMD_RE.test(to) || from > to) return { data: null, error: "Khoảng ngày không hợp lệ." };
  if (dayCount(from, to) > MAX_DAYS) return { data: null, error: `Chọn tối đa ${MAX_DAYS} ngày.` };
  try {
    return { data: build(await fetchInboxThreads(from, to)) };
  } catch (err) {
    return { data: null, error: normalizeError(err).message };
  }
}

/** Báo cáo Smax theo khoảng ngày. */
export async function getInboxReport(from: string, to: string): Promise<{ data: InboxReport | null; error?: string }> {
  return withThreads(from, to, buildInboxReport);
}

/** Báo cáo Follow up (bào data cũ) theo khoảng ngày. */
export async function getFollowupReport(from: string, to: string): Promise<{ data: FollowupReport | null; error?: string }> {
  return withThreads(from, to, (threads) => buildFollowupReport(threads, from, to));
}
