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

/**
 * Chiến dịch có chạy Instagram theo quy ước tên: token "IG" / "IGonly" / "ONLYIG"
 * (vd "WA3455 + IG - HOTGIRL2", "IGonly - TONG HOP"). Không bắt "IG" nằm trong từ khác.
 */
export function campaignIg(name: string): boolean {
  return /(?<![a-z])(?:only)?ig(?:only)?(?![a-z])/i.test(name);
}

export interface WaSummary {
  /** "WA-xxxx", hoặc null = chiến dịch chưa đặt tên theo quy ước. */
  wa: string | null;
  messages: number;
  spend: number;
}

/** Gộp tin nhắn + chi tiêu của chiến dịch theo số WA; nhiều tin nhắn nhất lên đầu, nhóm chưa gắn WA cuối cùng. */
export function summarizeByWa(
  campaigns: { name: string; messages: number; spend: number }[],
): WaSummary[] {
  const groups = new Map<string | null, WaSummary>();
  for (const c of campaigns) {
    const wa = campaignWa(c.name);
    const g = groups.get(wa) ?? { wa, messages: 0, spend: 0 };
    g.messages += c.messages;
    g.spend += c.spend;
    groups.set(wa, g);
  }
  return [...groups.values()].sort(
    (a, b) => Number(a.wa === null) - Number(b.wa === null) || b.messages - a.messages,
  );
}
