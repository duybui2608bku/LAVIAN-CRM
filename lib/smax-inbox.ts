/**
 * Báo cáo Inbox SMAX: đếm hội thoại có tin nhắn trong khoảng ngày theo kênh (WA/IG),
 * trạng thái (tag Booking / Follow up / Pending 24h) và nhân viên (tag tên nhân viên).
 * Tag là trạng thái HIỆN TẠI của hội thoại (SMAX không lưu lịch sử tag theo ngày).
 */
export const INBOX_CHANNELS = ["wa", "ig"] as const;
export type InboxChannel = (typeof INBOX_CHANNELS)[number];
const CHANNEL_OF: Record<string, InboxChannel> = { whatsappweb: "wa", instagram: "ig" };

export const INBOX_STATUSES = ["booking", "followUp", "pending"] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];
// Thứ tự = ưu tiên khi 1 hội thoại lỡ gắn nhiều trạng thái.
const STATUS_ALIASES: [InboxStatus, string[]][] = [
  ["booking", ["booking", "bookings-deposit"]],
  ["followUp", ["follow-up"]],
  ["pending", ["no-reply"]],
];
const DEPOSIT_ALIAS = "bookings-deposit";

// ponytail: nhân viên = tag SMAX hardcode; đổi người thì sửa danh sách này.
export const INBOX_STAFF = [
  { alias: "bulan", name: "Bulan" },
  { alias: "ratih", name: "Ratih" },
  { alias: "sabil", name: "Sabil" },
  { alias: "angel", name: "Angel" },
  { alias: "zila", name: "Zila" },
  { alias: "tiara-kania", name: "Tiara Kania" },
] as const;
export const UNASSIGNED = "__none";

export type InboxThread = { id: string; platform?: string; tag_aliases?: string[]; last_message_at?: string };

export type InboxCounts = Record<InboxStatus, number> & {
  /** Có tag Bookings deposit (đã nằm trong booking). */
  deposit: number;
  /** Hội thoại chưa gắn trạng thái nào. */
  untagged: number;
};
export type ChannelCounts = Record<InboxChannel, InboxCounts>;
export type InboxStaffRow = { alias: string; name: string; counts: ChannelCounts };
export type InboxReport = { total: ChannelCounts; staff: InboxStaffRow[]; threads: number };

const emptyCounts = (): InboxCounts => ({ booking: 0, followUp: 0, pending: 0, deposit: 0, untagged: 0 });
const emptyChannels = (): ChannelCounts => ({ wa: emptyCounts(), ig: emptyCounts() });

/** Booking + Follow up + Pending 24h (= cột "all total" của mẫu, không tính hội thoại chưa gắn). */
export const statusTotal = (c: InboxCounts) => c.booking + c.followUp + c.pending;
/** Cộng WA + IG. */
export const sumChannels = (c: ChannelCounts): InboxCounts => {
  const out = emptyCounts();
  for (const ch of INBOX_CHANNELS) for (const k of Object.keys(out) as (keyof InboxCounts)[]) out[k] += c[ch][k];
  return out;
};

export function buildInboxReport(threads: InboxThread[]): InboxReport {
  const total = emptyChannels();
  const staff = new Map<string, ChannelCounts>(
    [...INBOX_STAFF.map((s) => s.alias), UNASSIGNED].map((a) => [a, emptyChannels()]),
  );
  const seen = new Set<string>();
  let count = 0;

  for (const t of threads) {
    const channel = CHANNEL_OF[t.platform ?? ""];
    if (!channel || seen.has(t.id)) continue;
    seen.add(t.id);
    count++;
    const tags = t.tag_aliases ?? [];
    const status = STATUS_ALIASES.find(([, aliases]) => aliases.some((a) => tags.includes(a)))?.[0];
    const owners = INBOX_STAFF.filter((s) => tags.includes(s.alias)).map((s) => s.alias);

    const add = (c: InboxCounts) => {
      if (status) c[status]++;
      else c.untagged++;
      if (tags.includes(DEPOSIT_ALIAS)) c.deposit++;
    };
    add(total[channel]);
    // Hội thoại gắn 2 nhân viên → tính cho cả 2 (tổng vẫn đếm 1 lần).
    for (const o of owners.length ? owners : [UNASSIGNED]) add(staff.get(o)![channel]);
  }

  return {
    total,
    threads: count,
    staff: [
      ...INBOX_STAFF.map((s) => ({ alias: s.alias, name: s.name, counts: staff.get(s.alias)! })),
      { alias: UNASSIGNED, name: "", counts: staff.get(UNASSIGNED)! },
    ],
  };
}

/** Khoảng ngày VN/WIB (UTC+7) `YYYY-MM-DD` → dateRange ISO của SMAX (00:00 WIB = 17:00 UTC hôm trước). */
export function inboxDateRange(from: string, to: string): [string, string] {
  const [y, m, d] = from.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) - 7 * 3_600_000);
  return [start.toISOString(), `${to}T16:59:59.999Z`];
}
