/**
 * Số WhatsApp của Lavian, rút gọn "WA-<4 số cuối>" — dùng chung cho trang
 * Khách hàng (lấy từ hội thoại SMAX) và Marketing (lấy từ tên chiến dịch).
 */

/**
 * Số WA đã nhận tin, lấy từ page id trong link hội thoại SMAX:
 * `.../chats/waw<số>?tid=...`. Không phải hội thoại WhatsApp → null.
 */
export function waNumber(link: string | null | undefined): string | null {
  const m = link?.match(/\/chats\/waw(\d+)/);
  return m ? `WA-${m[1].slice(-4)}` : null;
}

/**
 * Số WA của chiến dịch FB theo quy ước tên: chứa "WA<4 số cuối>" (vd
 * "WA3455 - TONG HOP") → "WA-3455". Không có → null.
 * (Meta API không trả số WhatsApp đã thiết lập cho chiến dịch.)
 */
export function campaignWa(name: string): string | null {
  const m = name.match(/\bWA(\d{4})(?!\d)/i);
  return m ? `WA-${m[1]}` : null;
}

// Màu preset của antd Tag (tự đổi theo light/dark).
const WA_COLORS = [
  "blue",
  "green",
  "purple",
  "magenta",
  "orange",
  "cyan",
  "geekblue",
  "volcano",
  "gold",
  "lime",
  "red",
];

/** Màu tag cố định theo số: cùng số → cùng màu ở mọi trang. */
export function waColor(wa: string): string {
  return WA_COLORS[Number(wa.replace(/\D/g, "")) % WA_COLORS.length];
}

export interface WaSummary {
  /** "WA-xxxx", hoặc null = chiến dịch chưa đặt tên theo quy ước. */
  wa: string | null;
  messages: number;
  spend: number;
  campaigns: number;
  active: number;
}

/** Gộp số liệu chiến dịch theo số WA; nhiều tin nhắn nhất lên đầu, nhóm chưa gắn WA cuối cùng. */
export function summarizeByWa(
  campaigns: { name: string; status: string; messages: number; spend: number }[],
): WaSummary[] {
  const groups = new Map<string | null, WaSummary>();
  for (const c of campaigns) {
    const wa = campaignWa(c.name);
    const g = groups.get(wa) ?? { wa, messages: 0, spend: 0, campaigns: 0, active: 0 };
    g.messages += c.messages;
    g.spend += c.spend;
    g.campaigns += 1;
    if (c.status === "ACTIVE") g.active += 1;
    groups.set(wa, g);
  }
  return [...groups.values()].sort(
    (a, b) => Number(a.wa === null) - Number(b.wa === null) || b.messages - a.messages,
  );
}
