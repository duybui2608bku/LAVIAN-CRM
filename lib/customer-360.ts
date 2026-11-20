// Hàm thuần cho hồ sơ khách 360° (có node --test). Không import giá trị qua "@/" (node --test không hiểu alias).
import type { CustomerNeed, PortraitEntry, PortraitField, ViewerRole } from "@/types/customer-360";

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

type MoneyAppointment = { id: string; scheduled_at: string; bill_amount?: number | null; paid_amount?: number | null };

/**
 * Tài chính 3 vùng. Tiền cọc thuộc khách (tính 1 lần ở Tổng tích luỹ, gắn vào Đơn hiện tại).
 * Phải thu = null ("Chưa xác định") khi đã có cọc mà Giá trị DV = 0.
 * Đơn hiện tại = lịch sắp tới sớm nhất, không có thì lịch đã qua gần nhất.
 */
export function customerFinance<T extends MoneyAppointment>(appointments: T[], deposit: number | null | undefined, now: number) {
  const dep = deposit ?? 0;
  const due = (bill: number, collected: number) => (bill === 0 && dep > 0 ? null : Math.max(bill - collected, 0));
  const bill = appointments.reduce((s, a) => s + (a.bill_amount ?? 0), 0);
  const collected = dep + appointments.reduce((s, a) => s + (a.paid_amount ?? 0), 0);
  const upcoming = appointments.filter((a) => Date.parse(a.scheduled_at) >= now)
    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  const past = appointments.filter((a) => Date.parse(a.scheduled_at) < now)
    .sort((a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at));
  const cur = upcoming[0] ?? past[0];
  const curBill = cur?.bill_amount ?? 0;
  const curCollected = dep + (cur?.paid_amount ?? 0);
  return {
    total: { bill, collected, due: due(bill, collected) },
    current: cur ? { appointment: cur, bill: curBill, deposit: dep, collected: curCollected, due: due(curBill, curCollected) } : null,
    history: [...appointments].sort((a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at))
      .map((a) => ({ appointment: a, bill: a.bill_amount ?? 0, paid: a.paid_amount ?? 0 })),
  };
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

/** "Nhu cầu tiếp theo": nhu cầu mới nhất chưa Thành công / Thất bại. */
export function nextNeed<T extends Pick<CustomerNeed, "status" | "created_at">>(needs: T[]): T | null {
  return needs.filter((n) => n.status !== "won" && n.status !== "lost")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;
}

/** Gộp nhiều nguồn vào 1 dòng thời gian, mới nhất trước; mỗi mục gắn `kind` để lọc. */
export function mergeTimeline<K extends string, T extends { at: string }>(groups: { kind: K; items: T[] }[]) {
  return groups.flatMap(({ kind, items }) => items.map((item) => ({ kind, ...item })))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
