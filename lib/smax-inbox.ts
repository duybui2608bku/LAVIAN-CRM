/**
 * Báo cáo Inbox SMAX (+ báo cáo Follow up ở cuối file) — hiệu suất KHÁCH MỚI theo kênh (WA/IG) và nhân viên (tag tên):
 * - hội thoại mới = tạo trong khoảng ngày; trạng thái Potential / Follow up / Pending 24h / Spam đếm trên tập này;
 * - Booking lấy riêng = hội thoại được GẮN tag booking trong khoảng (theo `customer.tags[].time`, gồm cả khách cũ);
 *   đã gắn từ trước mà trong khoảng chỉ nhắn lại thì không tính.
 * Tag là trạng thái HIỆN TẠI của hội thoại (SMAX không lưu lịch sử tag theo ngày).
 */
export const INBOX_CHANNELS = ["wa", "ig"] as const;
export type InboxChannel = (typeof INBOX_CHANNELS)[number];
const CHANNEL_OF: Record<string, InboxChannel> = { whatsappweb: "wa", instagram: "ig" };

export const INBOX_STATUSES = ["booking", "potential", "followUp", "pending", "spam"] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];
export const BOOKING_ALIASES = ["booking", "bookings-deposit"];
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
  customer?: { tags?: { alias?: string; time?: string }[]; instagram?: { ad_id?: string } };
  /** Trang nhận tin: `waw<số WA>` / `ig<id>`. */
  page_pid?: string;
  /** Quảng cáo IG khách bấm gần nhất. */
  instagram?: { ad_id?: string };
};

export type InboxCounts = Record<InboxStatus, number> & {
  /** Hội thoại mới (tạo trong khoảng), kể cả chưa gắn trạng thái. */
  conversations: number;
  /** Có tag Bookings deposit (đã nằm trong booking). */
  deposit: number;
  /** Hội thoại mới chưa gắn trạng thái nào. */
  untagged: number;
  /** Booking của khách cũ (hội thoại tạo trước khoảng ngày) — đã nằm trong booking. */
  bookingOld: number;
};
export type ChannelCounts = Record<InboxChannel, InboxCounts>;
export type InboxStaffRow = { alias: string; name: string; counts: ChannelCounts };
export type InboxReport = { total: ChannelCounts; staff: InboxStaffRow[] };

const emptyCounts = (): InboxCounts => ({
  booking: 0,
  potential: 0,
  followUp: 0,
  pending: 0,
  spam: 0,
  conversations: 0,
  deposit: 0,
  untagged: 0,
  bookingOld: 0,
});
const emptyChannels = (): ChannelCounts => ({ wa: emptyCounts(), ig: emptyCounts() });

/** Tổng các trạng thái (dùng cho thanh phân bổ). */
export const statusTotal = (c: InboxCounts) => INBOX_STATUSES.reduce((n, s) => n + c[s], 0);
/** Cộng WA + IG. */
export const sumChannels = (c: ChannelCounts): InboxCounts => {
  const out = emptyCounts();
  for (const ch of INBOX_CHANNELS) for (const k of Object.keys(out) as (keyof InboxCounts)[]) out[k] += c[ch][k];
  return out;
};

/**
 * `created` = hội thoại tạo trong khoảng (khách mới), `booked` = hội thoại có tag booking (tin nhắn từ đầu khoảng đến nay).
 * `from`/`to` là ngày WIB `YYYY-MM-DD` — Booking chỉ tính khi lần gắn tag booking sớm nhất nằm trong khoảng.
 */
export function buildInboxReport(created: InboxThread[], booked: InboxThread[], from: string, to: string): InboxReport {
  const [start, end] = inboxDateRange(from, to).map(Date.parse);
  const total = emptyChannels();
  const staff = new Map<string, ChannelCounts>(
    [...INBOX_STAFF.map((s) => s.alias), UNASSIGNED].map((a) => [a, emptyChannels()]),
  );

  // Cộng 1 hội thoại vào tổng + từng nhân viên gắn tag (2 nhân viên → tính cho cả 2; tổng vẫn đếm 1 lần).
  const tally = (threads: InboxThread[], add: (c: InboxCounts, tags: string[], t: InboxThread) => void) => {
    const seen = new Set<string>();
    for (const t of threads) {
      const channel = CHANNEL_OF[t.platform ?? ""];
      if (!channel || seen.has(t.id)) continue;
      seen.add(t.id);
      const tags = t.tag_aliases ?? [];
      const owners = INBOX_STAFF.filter((s) => tags.includes(s.alias)).map((s) => s.alias);
      add(total[channel], tags, t);
      for (const o of owners.length ? owners : [UNASSIGNED]) add(staff.get(o)![channel], tags, t);
    }
  };

  tally(created, (c, tags) => {
    c.conversations++;
    const status = STATUS_ALIASES.find(([, aliases]) => aliases.some((a) => tags.includes(a)))?.[0];
    if (!status) c.untagged++;
    else if (status !== "booking") c[status]++; // Booking đếm từ `booked` (tránh đếm 2 lần)
  });
  tally(booked, (c, tags, t) => {
    const at = taggedAt(t, BOOKING_ALIASES);
    if (!BOOKING_ALIASES.some((a) => tags.includes(a)) || !(at >= start && at <= end)) return;
    c.booking++;
    if (tags.includes(DEPOSIT_ALIAS)) c.deposit++;
    if (Date.parse(t.created_at ?? "") < start) c.bookingOld++;
  });

  return {
    total,
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

// ---------------------------------------------------------------------------
/** Khách tiềm năng (cột trang Marketing): hội thoại có 1 trong các tag này — gắn nhiều tag vẫn chỉ tính 1. */
export const POTENTIAL_ALIASES = ["phone", "booking", "bookings-deposit", "purchase"];

export type PotentialCounts = {
  /** campaign_id FB → số khách tiềm năng IG (ghép qua ad_id). */
  byCampaign: Record<string, number>;
  /** "WA-<4 số cuối>" → số khách tiềm năng nhắn vào số WA đó. */
  byWa: Record<string, number>;
};

/** `adCampaign`: ad_id → campaign_id (từ FB). Mỗi hội thoại tính tối đa 1 lần. */
export function countPotential(threads: InboxThread[], adCampaign: Map<string, string>): PotentialCounts {
  const out: PotentialCounts = { byCampaign: {}, byWa: {} };
  const seen = new Set<string>();
  for (const t of threads) {
    if (seen.has(t.id) || !POTENTIAL_ALIASES.some((a) => t.tag_aliases?.includes(a))) continue;
    seen.add(t.id);
    if (t.platform === "instagram") {
      // ad_id của hội thoại là lần bấm gần nhất; không khớp FB thì thử ad_id lưu ở khách.
      const campaign = [t.instagram?.ad_id, t.customer?.instagram?.ad_id]
        .map((id) => id && adCampaign.get(id))
        .find(Boolean);
      if (campaign) out.byCampaign[campaign] = (out.byCampaign[campaign] ?? 0) + 1;
    } else if (t.platform === "whatsappweb" && t.page_pid?.startsWith("waw")) {
      const wa = `WA-${t.page_pid.slice(-4)}`; // cùng quy ước lib/wa.ts
      out.byWa[wa] = (out.byWa[wa] ?? 0) + 1;
    }
  }
  return out;
}
