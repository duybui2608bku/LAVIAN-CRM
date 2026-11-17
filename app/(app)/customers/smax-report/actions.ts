"use server";

import { requirePermission } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { dayCount } from "@/lib/reports";
import { buildFollowupReport, buildInboxReport, staffAvatars, type FollowupReport, type InboxReport } from "@/lib/smax-inbox";
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

/**
 * Tính theo lúc gắn tag: hội thoại gắn trong kỳ nhưng nhắn tiếp sau đó có last_message_at muộn hơn `to`
 * → lấy theo tin nhắn từ `from` tới hôm nay (WIB) rồi lọc theo thời điểm gắn.
 */
function untilToday(to: string) {
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  return today > to ? today : to;
}

/** Kiểm quyền + khoảng ngày WIB `YYYY-MM-DD`, rồi lấy hội thoại + tính báo cáo (`build`). */
async function withRange<T>(from: string, to: string, build: () => Promise<T>): Promise<Result<T>> {
  await requirePermission("customers.view");
  if (!YMD_RE.test(from) || !YMD_RE.test(to) || from > to) return { data: null, error: "Khoảng ngày không hợp lệ." };
  if (dayCount(from, to) > MAX_DAYS) return { data: null, error: `Chọn tối đa ${MAX_DAYS} ngày.` };
  const [data, avatars] = await Promise.allSettled([build(), loadAvatars()]);
  if (data.status === "rejected") return { data: null, error: normalizeError(data.reason).message };
  return { data: data.value, avatars: avatars.status === "fulfilled" ? avatars.value : undefined };
}

export type SmaxReport = { inbox: InboxReport; followup: FollowupReport };

/** Báo cáo Smax (khách mới + Follow up khách cũ) theo khoảng ngày — 2 lượt tải hội thoại dùng chung cho cả 2 báo cáo. */
export async function getSmaxReport(from: string, to: string): Promise<Result<SmaxReport>> {
  return withRange(from, to, async () => {
    const [created, active] = await Promise.all([
      fetchInboxThreads(from, to, { byCreated: true }),
      fetchInboxThreads(from, untilToday(to)),
    ]);
    return { inbox: buildInboxReport(created, active, from, to), followup: buildFollowupReport(active, from, to) };
  });
}
