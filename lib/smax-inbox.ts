/**
 * Báo cáo Inbox SMAX (+ báo cáo Follow up ở cuối file) — hiệu suất KHÁCH MỚI theo kênh (WA/IG) và nhân viên (tag tên):
 * - hội thoại mới = tạo trong khoảng ngày; trạng thái Potential / Follow up / Pending 24h / Spam đếm trên tập này;
 * - Booking lấy riêng = hội thoại được GẮN tag booking trong khoảng (theo `customer.tags[].time`, gồm cả khách cũ);
 *   đã gắn từ trước mà trong khoảng chỉ nhắn lại thì không tính. Khách đến (tag purchase) cũng theo lúc gắn tag;
 * - Re-engaged = khách cũ có tin nhắn hoặc được gắn Booking/Purchase trong khoảng (cùng định nghĩa "số bào" Follow up).
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
  /**
   * Khách của hội thoại. 1 khách IG có thể có 2 hội thoại (tin nhắn + bình luận) dùng CHUNG `tags` của khách.
   * `tags` kèm thời điểm gắn; `created_at` = lúc SMAX biết khách lần đầu.
   */
  customer?: {
    id?: string;
    created_at?: string;
    tags?: { alias?: string; time?: string }[];
    instagram?: { ad_id?: string };
    /** SĐT SMAX tự nhận khi khách gõ số (khách IG). */
    phone?: string;
    phones?: { value?: string }[];
    /** Khách WA: `id` = `<số>@s.whatsapp.net` (nhóm: `@g.us`). */
    whatsappweb?: { id?: string };
  };
  /** Trang nhận tin: `waw<số WA>` / `ig<id>`. */
  page_pid?: string;
  /** Mã hội thoại trong trang (để lấy tin nhắn). */
  tid?: string;
  /** Quảng cáo IG khách bấm gần nhất. */
  instagram?: { ad_id?: string };
  /** SĐT tìm thấy trong tin nhắn khách khi SMAX không tự lưu — server gắn thêm (`fetchIgByPhone`). */
  scanned_phones?: string[];
};

/** SĐT IG → hội thoại IG của khách đó (dùng gộp khách IG chuyển sang nhắn WA). */
export type IgByPhone = Map<string, InboxThread>;

/** SĐT chuẩn `62…`: chỉ giữ chữ số, `0…` → `62…`. */
function normPhone(p: string | null | undefined): string {
  const d = String(p ?? "").replace(/\D/g, "");
  return d.startsWith("0") ? `62${d.slice(1)}` : d;
}

/** Số di động Indonesia trong đoạn chữ (`0812…`, `+62 812-…`, `62812…`), đã chuẩn hoá. */
export function findPhones(text: string): string[] {
  const nums = (text.match(/(?:\+?62|\b0)[\s.-]?8(?:[\s.-]?\d){7,11}/g) ?? []).map(normPhone);
  return [...new Set(nums.filter((n) => n.length >= 10 && n.length <= 14))];
}

/** Các SĐT của khách IG (SMAX lưu + tìm trong tin nhắn). */
export function igPhones(t: InboxThread): string[] {
  const raw = [t.customer?.phone, ...(t.customer?.phones ?? []).map((p) => p.value), ...(t.scanned_phones ?? [])];
  return [...new Set(raw.map(normPhone).filter((n) => n.length >= 10))];
}

/** Số WA của khách (nhóm → ""). */
function waPhone(t: InboxThread): string {
  const id = t.customer?.whatsappweb?.id ?? "";
  return id.endsWith("@s.whatsapp.net") ? normPhone(id.split("@")[0]) : "";
}

const seenOrInf = (t: InboxThread) => {
  const ms = firstSeen(t);
  return Number.isNaN(ms) ? Infinity : ms;
};

/** Chỉ mục SĐT → hội thoại IG; 1 số nhiều khách IG thì giữ khách xuất hiện sớm nhất. */
export function igPhoneIndex(threads: InboxThread[]): IgByPhone {
  const out: IgByPhone = new Map();
  for (const t of threads) {
    if (t.platform !== "instagram") continue;
    for (const p of igPhones(t)) {
      const prev = out.get(p);
      if (!prev || seenOrInf(t) < seenOrInf(prev)) out.set(p, t);
    }
  }
  return out;
}

/** Mốc ISO sớm nhất (`earliest`) / muộn nhất trong danh sách, bỏ giá trị không hợp lệ. */
function pickTime(xs: (string | undefined)[], earliest: boolean): string | undefined {
  let best: string | undefined;
  for (const x of xs) {
    const ms = Date.parse(x ?? "");
    if (Number.isNaN(ms)) continue;
    if (best === undefined || (earliest ? ms < Date.parse(best) : ms > Date.parse(best))) best = x;
  }
  return best;
}

/** Gộp hội thoại của 1 người (khác khách SMAX): gốc = phần xuất hiện trước (quyết định kênh), tag/thời gian gộp. */
function mergePerson(parts: InboxThread[]): InboxThread {
  if (parts.length === 1) return parts[0];
  const first = parts.reduce((a, b) => (seenOrInf(b) < seenOrInf(a) ? b : a));
  return {
    ...first,
    tag_aliases: [...new Set(parts.flatMap((p) => p.tag_aliases ?? []))],
    created_at: pickTime(parts.map((p) => p.created_at), true),
    last_message_at: pickTime(parts.map((p) => p.last_message_at), false),
    customer: {
      ...first.customer,
      created_at: pickTime(parts.map((p) => p.customer?.created_at), true),
      tags: parts.flatMap((p) => p.customer?.tags ?? []),
    },
  };
}

/**
 * Mỗi người 1 hội thoại:
 * - cùng khách SMAX → giữ hội thoại nhiều tag hơn (tin nhắn IG thay vì bình luận);
 * - khách WA trùng SĐT khách IG (`igByPhone`) → gộp thành 1 người, kênh = bên khách nhắn trước.
 *   Hội thoại IG nằm ngoài `threads` (vd tạo trước kỳ) vẫn được gộp vào để biết khách đã có từ trước.
 */
export function byCustomer(threads: InboxThread[], igByPhone: IgByPhone = new Map()): InboxThread[] {
  const keyOf = (t: InboxThread) => t.customer?.id ?? t.id;
  const reps = new Map<string, InboxThread>();
  for (const t of threads) {
    const prev = reps.get(keyOf(t));
    if (!prev || (t.tag_aliases?.length ?? 0) > (prev.tag_aliases?.length ?? 0)) reps.set(keyOf(t), t);
  }
  const people = new Map<string, InboxThread[]>();
  for (const [key, t] of reps) {
    const ig = t.platform === "whatsappweb" ? igByPhone.get(waPhone(t)) : undefined;
    const pk = ig ? keyOf(ig) : key;
    const parts = people.get(pk) ?? [];
    parts.push(t);
    if (ig && !reps.has(pk) && !parts.includes(ig)) parts.push(ig);
    people.set(pk, parts);
  }
  return [...people.values()].map(mergePerson);
}

/** Lần đầu khách xuất hiện (ms): sớm hơn giữa ngày tạo hội thoại và ngày tạo khách. */
export function firstSeen(t: InboxThread): number {
  const times = [t.created_at, t.customer?.created_at].map((s) => Date.parse(s ?? "")).filter((n) => !Number.isNaN(n));
  return times.length ? Math.min(...times) : NaN;
}

export type InboxCounts = Record<InboxStatus, number> & {
  /** Khách mới (lần đầu xuất hiện trong khoảng; 1 khách = 1 dù có nhiều hội thoại), kể cả chưa gắn trạng thái. */
  conversations: number;
  /** Có tag Bookings deposit (đã nằm trong booking). */
  deposit: number;
  /** Hội thoại mới chưa gắn trạng thái nào. */
  untagged: number;
  /** Booking của khách cũ (khách xuất hiện trước khoảng ngày) — đã nằm trong booking. */
  bookingOld: number;
  /** Khách cũ quay lại (nhắn tin / gắn Booking / gắn Purchase trong khoảng). */
  reEngaged: number;
  /** Khách đến = gắn tag purchase trong khoảng (mọi khách). */
  showUp: number;
  /** Khách đến ngay trong ngày đầu xuất hiện (cùng ngày WIB) — đã nằm trong showUp. */
  showUpSameDay: number;
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
  reEngaged: 0,
  showUp: 0,
  showUpSameDay: 0,
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
 * `created` = hội thoại tạo trong khoảng (khách mới), `active` = hội thoại có tin nhắn từ đầu khoảng đến nay.
 * `from`/`to` là ngày WIB `YYYY-MM-DD` — Booking / Khách đến chỉ tính khi lần gắn tag sớm nhất nằm trong khoảng.
 */
export function buildInboxReport(
  created: InboxThread[],
  active: InboxThread[],
  from: string,
  to: string,
  igByPhone?: IgByPhone,
): InboxReport {
  const [start, end] = inboxDateRange(from, to).map(Date.parse);
  const inRange = (ms: number) => ms >= start && ms <= end;
  const total = emptyChannels();
  const staff = new Map<string, ChannelCounts>(
    [...INBOX_STAFF.map((s) => s.alias), UNASSIGNED].map((a) => [a, emptyChannels()]),
  );

  // Cộng 1 khách vào tổng + từng nhân viên gắn tag (2 nhân viên → tính cho cả 2; tổng vẫn đếm 1 lần).
  // `onlyNew`: bỏ người xuất hiện trước kỳ (xét SAU khi gộp IG ↔ WA, vd khách IG cũ mở hội thoại WA mới).
  const tally = (threads: InboxThread[], add: (c: InboxCounts, tags: string[], t: InboxThread) => void, onlyNew = false) => {
    for (const t of byCustomer(threads, igByPhone)) {
      if (onlyNew && firstSeen(t) < start) continue;
      const channel = CHANNEL_OF[t.platform ?? ""];
      if (!channel) continue;
      const tags = t.tag_aliases ?? [];
      const owners = INBOX_STAFF.filter((s) => tags.includes(s.alias)).map((s) => s.alias);
      add(total[channel], tags, t);
      for (const o of owners.length ? owners : [UNASSIGNED]) add(staff.get(o)![channel], tags, t);
    }
  };

  // Khách cũ mở hội thoại mới (vd bình luận IG) không phải khách mới.
  tally(
    created,
    (c, tags) => {
      c.conversations++;
      const status = STATUS_ALIASES.find(([, aliases]) => aliases.some((a) => tags.includes(a)))?.[0];
      if (!status) c.untagged++;
      else if (status !== "booking") c[status]++; // Booking đếm từ `booked` (tránh đếm 2 lần)
    },
    true,
  );
  tally(active, (c, tags, t) => {
    const bookedAt = taggedAt(t, BOOKING_ALIASES);
    const showedAt = taggedAt(t, [SHOW_UP_ALIAS]);
    const showed = inRange(showedAt);
    // Cùng điều kiện "số bào" của buildFollowupReport.
    if (firstSeen(t) < start && (inRange(Date.parse(t.last_message_at ?? "")) || inRange(bookedAt) || showed)) c.reEngaged++;
    if (showed) {
      c.showUp++;
      if (wibDate(firstSeen(t)) === wibDate(showedAt)) c.showUpSameDay++;
    }
    if (!BOOKING_ALIASES.some((a) => tags.includes(a)) || !inRange(bookedAt)) return;
    c.booking++;
    if (tags.includes(DEPOSIT_ALIAS) && taggedAt(t, [DEPOSIT_ALIAS]) <= end) c.deposit++; // cọc sau kỳ → chưa tính
    if (firstSeen(t) < start) c.bookingOld++;
  });

  return {
    total,
    staff: [
      ...INBOX_STAFF.map((s) => ({ alias: s.alias, name: s.name, counts: staff.get(s.alias)! })),
      { alias: UNASSIGNED, name: "", counts: staff.get(UNASSIGNED)! },
    ],
  };
}

/**
 * Hội thoại TẠO trong khoảng ngày WIB, lọc từ tập "có tin nhắn từ `from` tới nay" (tin nhắn cuối ≥ lúc tạo nên tập
 * tạo-trong-kỳ nằm trọn trong đó — đã đối chiếu SMAX thật) → không cần tải riêng lượt theo ngày tạo.
 */
export function createdIn(threads: InboxThread[], from: string, to: string): InboxThread[] {
  const [start, end] = inboxDateRange(from, to).map(Date.parse);
  return threads.filter((t) => {
    const ms = Date.parse(t.created_at ?? "");
    return ms >= start && ms <= end;
  });
}

/** Ngày WIB `YYYY-MM-DD` của mốc ms (NaN → ""). */
const wibDate = (ms: number) => (Number.isNaN(ms) ? "" : new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10));

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
 * - "chuyển đổi" dựa trên thời điểm gắn tag (`customer.tags[].time`) — SMAX không lưu lịch sử đổi tag;
 * - hội thoại lấy theo tin nhắn cuối từ đầu kỳ TỚI HÔM NAY (khách gắn tag trong kỳ có thể nhắn tiếp sau kỳ).
 *   Số bào = data cũ có tin nhắn cuối trong kỳ HOẶC được gắn Booking/Purchase trong kỳ. SMAX chỉ có tin nhắn
 *   cuối → xem kỳ cũ thì khách nhắn trong kỳ rồi nhắn tiếp sau kỳ (không chuyển đổi) không đếm được vào số bào.
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

/** `from`/`to` là ngày WIB `YYYY-MM-DD`; `threads` = hội thoại có tin nhắn cuối từ `from` tới hôm nay. */
export function buildFollowupReport(threads: InboxThread[], from: string, to: string, igByPhone?: IgByPhone): FollowupReport {
  const [start, end] = inboxDateRange(from, to).map(Date.parse);
  const inRange = (ms: number) => ms >= start && ms <= end;
  const total = emptyFollowup();
  const staff = new Map<string, FollowupCounts>(
    [...INBOX_STAFF.map((s) => s.alias), UNASSIGNED].map((a) => [a, emptyFollowup()]),
  );
  for (const t of byCustomer(threads, igByPhone)) {
    const created = firstSeen(t);
    if (!CHANNEL_OF[t.platform ?? ""] || Number.isNaN(created) || created > end) continue;
    const old = created < start;
    const booked = inRange(taggedAt(t, BOOKING_ALIASES));
    const showed = inRange(taggedAt(t, [SHOW_UP_ALIAS]));
    // Không nhắn trong kỳ và không chuyển đổi trong kỳ → không thuộc kỳ này.
    if (!inRange(Date.parse(t.last_message_at ?? "")) && !booked && !showed) continue;

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
  /** Tổng khách tiềm năng WA + IG (kể cả không gán được chiến dịch). */
  total: number;
};

/**
 * `adCampaign`: ad_id → campaign_id (từ FB). Mỗi người tính tối đa 1 lần (gộp IG ↔ WA theo `igByPhone`).
 * Có `from` (ngày WIB) → bỏ người xuất hiện trước kỳ (đã là khách kỳ trước, vd nhắn IG rồi kỳ này mới sang WA).
 */
export function countPotential(
  threads: InboxThread[],
  adCampaign: Map<string, string>,
  { from, igByPhone }: { from?: string; igByPhone?: IgByPhone } = {},
): PotentialCounts {
  const out: PotentialCounts = { byCampaign: {}, byWa: {}, total: 0 };
  const start = from ? Date.parse(inboxDateRange(from, from)[0]) : -Infinity;
  for (const t of byCustomer(threads, igByPhone)) {
    if (firstSeen(t) < start) continue;
    if (!CHANNEL_OF[t.platform ?? ""] || !POTENTIAL_ALIASES.some((a) => t.tag_aliases?.includes(a))) continue;
    out.total++;
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
