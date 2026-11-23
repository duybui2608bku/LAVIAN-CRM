// Hàm thuần cho hồ sơ khách 360° (có node --test). Không import giá trị qua "@/" (node --test không hiểu alias).
import type { PortraitEntry, PortraitField, ViewerRole } from "@/types/customer-360";

type Viewer = { role: string; department: string | null } | null | undefined;

/** Vai trò hiển thị theo bộ phận của tài khoản đang đăng nhập. */
export function customerRole(profile: Viewer): ViewerRole {
  if (profile?.role === "admin") return "admin";
  if (profile?.department === "technician") return "master";
  if (profile?.department === "sales") return "sales";
  return "telesales";
}

/** Tài chính: admin, Sales, Leader Telesales. Ẩn với Telesales và Master. Đổi ma trận quyền → sửa ở đây. */
export function canSeeFinance(profile: Viewer): boolean {
  return profile?.role === "admin" || profile?.department === "sales" || profile?.department === "telesales_leader";
}

/** Ảnh B/A: mọi bộ phận trừ Telesales (khớp hàm DB `can_access_ba_photos`). */
export function canSeePhotos(profile: Viewer): boolean {
  if (!profile) return false;
  return profile.role === "admin" || !["telesales", "telesales_leader"].includes(profile.department ?? "");
}

/** Đơn hiện tại (nút "Chuyển sang nhập liệu"): lịch sắp tới sớm nhất, không có thì lịch đã qua gần nhất. */
export function currentAppointment<T extends { scheduled_at: string }>(appointments: T[], now: number): T | null {
  const at = (a: T) => Date.parse(a.scheduled_at);
  const upcoming = appointments.filter((a) => at(a) >= now).sort((a, b) => at(a) - at(b));
  return upcoming[0] ?? appointments.filter((a) => at(a) < now).sort((a, b) => at(b) - at(a))[0] ?? null;
}

/** Bản mới nhất của từng mục chân dung. */
export function latestPortrait(entries: PortraitEntry[]): Partial<Record<PortraitField, PortraitEntry>> {
  const out: Partial<Record<PortraitField, PortraitEntry>> = {};
  for (const e of entries) {
    const cur = out[e.field];
    if (!cur || Date.parse(e.created_at) > Date.parse(cur.created_at)) out[e.field] = e;
  }
  return out;
}

/** Nội dung chân dung theo ngôn ngữ giao diện: tiếng Việt → `text`, còn lại → bản tiếng Anh nếu AI có điền. */
export function portraitText(entry: Pick<PortraitEntry, "text" | "text_en">, locale: string): string {
  return locale !== "vi" && entry.text_en ? entry.text_en : entry.text;
}

/** Gộp nhiều nguồn vào 1 dòng thời gian, mới nhất trước; mỗi mục gắn `kind` để lọc. */
export function mergeTimeline<K extends string, T extends { at: string }>(groups: { kind: K; items: T[] }[]) {
  return groups.flatMap(({ kind, items }) => items.map((item) => ({ kind, ...item })))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
