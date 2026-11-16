"use server";

import { requirePermission } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { dayCount } from "@/lib/reports";
import { buildFollowupReport, buildInboxReport, staffAvatars, type FollowupReport, type InboxReport, type InboxThread } from "@/lib/smax-inbox";
import { fetchInboxThreads } from "@/lib/smax-threads";
import { createClient } from "@/lib/supabase/server";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 31;

type Result<T> = { data: T | null; avatars?: Record<string, string | null>; error?: string };

/** Avatar CRM của Telesales theo tag tên SMAX — lỗi thì bỏ qua (dùng ảnh mặc định). */
async function loadAvatars() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("user_name, avatar_url").not("avatar_url", "is", null);
  return staffAvatars(data ?? []);
}

/** Kiểm quyền + khoảng ngày WIB `YYYY-MM-DD`, lấy hội thoại rồi tính báo cáo. */
async function withThreads<T>(from: string, to: string, build: (threads: InboxThread[]) => T): Promise<Result<T>> {
  await requirePermission("customers.view");
  if (!YMD_RE.test(from) || !YMD_RE.test(to) || from > to) return { data: null, error: "Khoảng ngày không hợp lệ." };
  if (dayCount(from, to) > MAX_DAYS) return { data: null, error: `Chọn tối đa ${MAX_DAYS} ngày.` };
  const [threads, avatars] = await Promise.allSettled([fetchInboxThreads(from, to), loadAvatars()]);
  if (threads.status === "rejected") return { data: null, error: normalizeError(threads.reason).message };
  return { data: build(threads.value), avatars: avatars.status === "fulfilled" ? avatars.value : undefined };
}

/** Báo cáo Smax theo khoảng ngày. */
export async function getInboxReport(from: string, to: string): Promise<Result<InboxReport>> {
  return withThreads(from, to, (threads) => buildInboxReport(threads, from, to));
}

/** Báo cáo Follow up (bào data cũ) theo khoảng ngày. */
export async function getFollowupReport(from: string, to: string): Promise<Result<FollowupReport>> {
  return withThreads(from, to, (threads) => buildFollowupReport(threads, from, to));
}
