/**
 * Báo cáo Inbox SMAX (+ báo cáo Follow up ở cuối file; Booking cũ dùng chung định nghĩa với Follow up): đếm hội thoại có tin nhắn trong khoảng ngày theo kênh (WA/IG),
 * trạng thái (tag Booking / Potential / Follow up / Pending 24h / Spam) và nhân viên (tag tên nhân viên).
 * Tag là trạng thái HIỆN TẠI của hội thoại (SMAX không lưu lịch sử tag theo ngày).
 */
export const INBOX_CHANNELS = ["wa", "ig"] as const;
export type InboxChannel = (typeof INBOX_CHANNELS)[number];
const CHANNEL_OF: Record<string, InboxChannel> = { whatsappweb: "wa", instagram: "ig" };

export const INBOX_STATUSES = ["booking", "potential", "followUp", "pending", "spam"] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];
const BOOKING_ALIASES = ["booking", "bookings-deposit"];
// Thứ tự = ưu tiên khi 1 hội thoại lỡ gắn nhiều trạng thái.
const STATUS_ALIASES: [InboxStatus, string[]][] = [
  ["booking", BOOKING_ALIASES],
  ["potential", ["potential"]],
  ["followUp", ["follow-up"]],
  ["pending", ["no-reply"]],
  ["spam", ["spam"]],
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

/** Ghép tag tên SMAX với tài khoản CRM theo tên (không phân biệt hoa thường; "Tiara Kania" ↔ "Tiara"). */
export function staffAvatars(profiles: { user_name: string | null; avatar_url: string | null }[]): Record<string, string | null> {
  const byName = new Map(profiles.map((p) => [(p.user_name ?? "").trim().toLowerCase(), p.avatar_url]));
  return Object.fromEntries(
    INBOX_STAFF.map((s) => [s.alias, byName.get(s.name.toLowerCase()) ?? byName.get(s.name.split(" ")[0].toLowerCase()) ?? null]),
  );
}

export type InboxThread = {
  id: string;
  platform?: string;
  tag_aliases?: string[];
  last_message_at?: string;
  /** Lúc khách nhắn lần đầu (dùng cho trang Follow up). */
  created_at?: string;
  /** Tag kèm thời điểm gắn (dùng cho trang Follow up). */
  customer?: { tags?: { alias?: string; time?: string }[] };
};

export type InboxCounts = Record<InboxStatus, number> & {
  /** Có tag Bookings deposit (đã nằm trong booking). */
  deposit: number;
  /** Hội thoại chưa gắn trạng thái nào. */
  untagged: number;
  /** Booking cũ (bào được): data cũ được gắn Booking trong khoảng — cùng định nghĩa "Booking follow-up" trang Follow up. */
  bookingOld: number;
};
export type ChannelCounts = Record<InboxChannel, InboxCounts>;
export type InboxStaffRow = { alias: string; name: string; counts: ChannelCounts };
export type InboxReport = { total: ChannelCounts; staff: InboxStaffRow[]; threads: number };

const emptyCounts = (): InboxCounts => ({ booking: 0, potential: 0, followUp: 0, pending: 0, spam: 0, deposit: 0, untagged: 0, bookingOld: 0 });
const emptyChannels = (): ChannelCounts => ({ wa: emptyCounts(), ig: emptyCounts() });

/** Tổng các trạng thái (= cột "all total" của mẫu, không tính hội thoại chưa gắn). */
export const statusTotal = (c: InboxCounts) => INBOX_STATUSES.reduce((n, s) => n + c[s], 0);
/** Cộng WA + IG. */
export const sumChannels = (c: ChannelCounts): InboxCounts => {
  const out = emptyCounts();
  for (const ch of INBOX_CHANNELS) for (const k of Object.keys(out) as (keyof InboxCounts)[]) out[k] += c[ch][k];
  return out;
};

/** `from`/`to` là ngày WIB `YYYY-MM-DD` (cùng khoảng đã dùng để lấy hội thoại) — dùng cho Booking cũ. */
export function buildInboxReport(threads: InboxThread[], from: string, to: string): InboxReport {
  const [start, end] = inboxDateRange(from, to).map(Date.parse);
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
    const bookedAt = taggedAt(t, BOOKING_ALIASES);
    const bookingOld = Date.parse(t.created_at ?? "") < start && bookedAt >= start && bookedAt <= end;

    const add = (c: InboxCounts) => {
      if (status) c[status]++;
      else c.untagged++;
      if (tags.includes(DEPOSIT_ALIAS)) c.deposit++;
      if (bookingOld) c.bookingOld++;
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

// ---------------------------------------------------------------------------
/*
 * Báo cáo Follow up (bào data cũ) từ hội thoại SMAX:
 * - data cũ = hội thoại tạo trước ngày bắt đầu, data mới = tạo trong khoảng;
 * - "chuyển đổi" dựa trên thời điểm gắn tag (`customer.tags[].time`) — SMAX không lưu lịch sử đổi tag.
 */
const SHOW_UP_ALIAS = "purchase"; // "Pelanggan datang ke klinik dan melakukan pembayaran."

export type FollowupCounts = {
  /** Data cũ có tin nhắn trong khoảng (số bào). */
  worked: number;
  /** Data cũ chuyển sang Booking hoặc Show-up trong khoảng. */
  converted: number;
  /** Data cũ được gắn Booking trong khoảng (booking follow-up). */
  bookingOld: number;
  /** Data cũ được gắn Purchase trong khoảng. */
  showUp: number;
  /** Data mới được gắn Booking trong khoảng. */
  bookingNew: number;
};
export type FollowupStaffRow = { alias: string; name: string; counts: FollowupCounts };
export type FollowupReport = { total: FollowupCounts; staff: FollowupStaffRow[] };

const emptyFollowup = (): FollowupCounts => ({ worked: 0, converted: 0, bookingOld: 0, showUp: 0, bookingNew: 0 });

/** Lần gắn sớm nhất của 1 trong các tag (ms), không có → NaN. */
function taggedAt(t: InboxThread, aliases: string[]): number {
  const times = (t.customer?.tags ?? [])
    .filter((g) => g.alias && aliases.includes(g.alias) && g.time)
    .map((g) => Date.parse(g.time!));
  return times.length ? Math.min(...times) : NaN;
}

/** `from`/`to` là ngày WIB `YYYY-MM-DD` (cùng khoảng đã dùng để lấy hội thoại). */
export function buildFollowupReport(threads: InboxThread[], from: string, to: string): FollowupReport {
  const [start, end] = inboxDateRange(from, to).map(Date.parse);
  const inRange = (ms: number) => ms >= start && ms <= end;
  const total = emptyFollowup();
  const staff = new Map<string, FollowupCounts>(
    [...INBOX_STAFF.map((s) => s.alias), UNASSIGNED].map((a) => [a, emptyFollowup()]),
  );
  const seen = new Set<string>();

  for (const t of threads) {
    const created = Date.parse(t.created_at ?? "");
    if (!CHANNEL_OF[t.platform ?? ""] || seen.has(t.id) || Number.isNaN(created)) continue;
    seen.add(t.id);
    const old = created < start;
    const booked = inRange(taggedAt(t, BOOKING_ALIASES));
    const showed = inRange(taggedAt(t, [SHOW_UP_ALIAS]));

    const add = (c: FollowupCounts) => {
      if (old) {
        c.worked++;
        if (booked) c.bookingOld++;
        if (showed) c.showUp++;
        if (booked || showed) c.converted++;
      } else if (booked) c.bookingNew++;
    };
    add(total);
    const tags = t.tag_aliases ?? [];
    const owners = INBOX_STAFF.filter((s) => tags.includes(s.alias)).map((s) => s.alias);
    for (const o of owners.length ? owners : [UNASSIGNED]) add(staff.get(o)!);
  }

  return {
    total,
    staff: [
      ...INBOX_STAFF.map((s) => ({ alias: s.alias, name: s.name, counts: staff.get(s.alias)! })),
      { alias: UNASSIGNED, name: "", counts: staff.get(UNASSIGNED)! },
    ],
  };
}
