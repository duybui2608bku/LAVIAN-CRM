"use server";

import { getCurrentProfile } from "@/lib/auth";
import { journeyDigestCounts, todayUtc7 } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

const TELESALES = ["telesales", "telesales_leader"];

/**
 * Thông báo tổng hợp Đến hạn liệu trình — 1 / Telesales / ngày, tạo lần đầu mở app trong ngày (chuông gọi,
 * localStorage chặn gọi lại). Danh sách tự tính bằng journeyDue nên không viết lại logic bằng SQL;
 * RPC notify_journey_digest chỉ ghi cho chính người gọi + unique index chặn trùng khi mở nhiều tab.
 */
export async function ensureJourneyDigest() {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !TELESALES.includes(profile.department ?? "")) return;
    const db = await createClient();
    const today = todayUtc7();
    const { data: sent } = await db.from("notifications").select("id")
      .eq("kind", "journey_digest").eq("ref", today).limit(1);
    if (sent?.length) return;
    const { data, error } = await db.rpc("journey_due_source", { p_since: `${today}T00:00:00+07:00` });
    if (error || !data) return;
    const counts = journeyDigestCounts(data, profile.id, today);
    if (counts.today + counts.overdue === 0) return;
    await db.rpc("notify_journey_digest", { p_date: today, p_today: counts.today, p_overdue: counts.overdue });
  } catch {
    // Thông báo phụ — lỗi không được làm hỏng app.
  }
}
