import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildFollowupReport,
  buildInboxReport,
  countPotential,
  createdIn,
  findPhones,
  igPhoneIndex,
  inboxDateRange,
  statusTotal,
  sumChannels,
  UNASSIGNED,
} from "./smax-inbox.ts";

const t = (id: string, platform: string, tags: string[]) => ({ id, platform, tag_aliases: tags });

const zero = { booking: 0, potential: 0, followUp: 0, pending: 0, spam: 0, conversations: 0, deposit: 0, untagged: 0, bookingOld: 0, reEngaged: 0, showUp: 0, showUpSameDay: 0 };

test("buildInboxReport: khách mới theo kênh, trạng thái, nhân viên", () => {
  const r = buildInboxReport(
    [
      t("1", "whatsappweb", ["bulan", "booking"]), // khách mới đã booking → vào Hội thoại mới, Booking đếm từ tập booked
      t("3", "whatsappweb", ["zila", "follow-up"]),
      t("4", "instagram", ["no-reply", "tiara-kania"]),
      t("5", "instagram", ["spam"]),
      t("8", "instagram", []),
      t("9", "whatsappweb", ["potential", "follow-up"]), // Potential ưu tiên hơn Follow up
      t("6", "facebook", ["bulan", "potential"]), // kênh khác → bỏ
      t("3", "whatsappweb", ["zila", "follow-up"]), // trùng id → bỏ
      t("7", "whatsappweb", ["sabil", "ratih", "follow-up"]), // 2 nhân viên
    ],
    [],
    "2026-11-16",
    "2026-11-16",
  );

  assert.deepEqual(r.total.wa, { ...zero, potential: 1, followUp: 2, conversations: 4 });
  assert.deepEqual(r.total.ig, { ...zero, pending: 1, spam: 1, conversations: 3, untagged: 1 });
  assert.equal(sumChannels(r.total).conversations, 7);

  const row = (alias: string) => r.staff.find((s) => s.alias === alias)!.counts;
  assert.equal(row("bulan").wa.conversations, 1);
  assert.equal(row("bulan").wa.booking, 0);
  assert.equal(row("tiara-kania").ig.pending, 1);
  assert.equal(row("sabil").wa.followUp, 1);
  assert.equal(row("ratih").wa.followUp, 1);
  assert.equal(row(UNASSIGNED).ig.untagged, 1);
});

test("buildInboxReport: Booking theo lúc gắn tag trong khoảng (gồm khách cũ), tách deposit + khách cũ", () => {
  const OLD = "2026-11-10T03:00:00.000Z";
  const TODAY = "2026-11-16T03:00:00.000Z";
  const th = (id: string, created: string, tags: string[], taggedAt = TODAY, platform = "whatsappweb") => ({
    id,
    platform,
    tag_aliases: tags,
    created_at: created,
    customer: { tags: tags.map((alias) => ({ alias, time: taggedAt })) },
  });
  const r = buildInboxReport(
    [],
    [
      th("1", TODAY, ["bulan", "booking"]),
      th("2", OLD, ["bulan", "bookings-deposit"]), // khách cũ + deposit
      th("3", OLD, ["booking"], TODAY, "instagram"), // khách cũ, chưa gán
      th("4", TODAY, ["potential"]), // không có tag booking → bỏ
      th("1", TODAY, ["bulan", "booking"]), // trùng id → bỏ
      th("5", OLD, ["booking"], "2026-11-12T03:00:00.000Z"), // gắn từ trước, hôm nay chỉ nhắn lại → bỏ
      th("6", TODAY, ["booking"], "2026-11-16T18:00:00.000Z"), // gắn sau khoảng (01:00 WIB 17/11) → bỏ
      { id: "7", platform: "whatsappweb", tag_aliases: ["booking"], created_at: TODAY }, // không có thời điểm gắn → bỏ
    ],
    "2026-11-16",
    "2026-11-16",
  );
  // Khách cũ gắn Booking trong kỳ (2, 3) cũng là khách quay lại.
  assert.deepEqual(r.total.wa, { ...zero, booking: 2, deposit: 1, bookingOld: 1, reEngaged: 1 });
  assert.deepEqual(r.total.ig, { ...zero, booking: 1, bookingOld: 1, reEngaged: 1 });
  assert.equal(statusTotal(sumChannels(r.total)), 3);
  assert.deepEqual(r.staff.find((s) => s.alias === "bulan")!.counts.wa, { ...zero, booking: 2, deposit: 1, bookingOld: 1, reEngaged: 1 });
  assert.equal(r.staff.find((s) => s.alias === UNASSIGNED)!.counts.ig.bookingOld, 1);
});

test("inboxDateRange: 00:00 WIB = 17:00 UTC hôm trước", () => {
  assert.deepEqual(inboxDateRange("2026-11-16", "2026-11-16"), [
    "2026-11-15T17:00:00.000Z",
    "2026-11-16T16:59:59.999Z",
  ]);
});

test("countPotential: 1 hội thoại tính 1 lần, IG theo ad_id, WA theo số", () => {
  const ads = new Map([
    ["ad1", "c1"],
    ["ad2", "c1"],
    ["ad3", "c2"],
  ]);
  const r = countPotential(
    [
      { id: "1", platform: "instagram", tag_aliases: ["phone", "booking"], instagram: { ad_id: "ad1" } }, // 2 tag → 1
      { id: "1", platform: "instagram", tag_aliases: ["phone"], instagram: { ad_id: "ad1" } }, // trùng id → bỏ
      { id: "2", platform: "instagram", tag_aliases: ["purchase"], instagram: { ad_id: "ad2" } },
      { id: "3", platform: "instagram", tag_aliases: ["bookings-deposit"], instagram: { ad_id: "x" }, customer: { instagram: { ad_id: "ad3" } } }, // fallback ad của khách
      { id: "4", platform: "instagram", tag_aliases: ["follow-up"], instagram: { ad_id: "ad3" } }, // không phải tiềm năng
      { id: "5", platform: "instagram", tag_aliases: ["phone"] }, // không có quảng cáo
      { id: "6", platform: "whatsappweb", page_pid: "waw6281918453455", tag_aliases: ["phone", "purchase"] },
      { id: "7", platform: "whatsappweb", page_pid: "waw6281918453455", tag_aliases: ["booking"] },
      { id: "8", platform: "whatsappweb", page_pid: "waw6281111858630", tag_aliases: ["spam"] },
    ],
    ads,
  );
  const f = (potential: number, booking: number, showUp: number) => ({ potential, booking, showUp });
  // Booking = booking/cọc, Show up = purchase — tập con của tiềm năng; total gồm khách IG không có quảng cáo.
  assert.deepEqual(r, { byCampaign: { c1: f(2, 1, 1), c2: f(1, 1, 0) }, byWa: { "WA-3455": f(2, 1, 1) }, total: f(6, 3, 2) });
});

test("countPotential: Đặt lịch / Đến cơ sở theo lúc gắn tag (gồm khách cũ), người đặt lịch/đến cũng là tiềm năng", () => {
  const OLD = "2026-11-01T03:00:00.000Z";
  const D16 = "2026-11-16T03:00:00.000Z";
  const D18 = "2026-11-18T03:00:00.000Z";
  const th = (id: string, created: string, tags: { alias: string; time: string }[]) => ({
    id,
    platform: "whatsappweb",
    page_pid: "waw6281918453455",
    created_at: created,
    tag_aliases: tags.map((g) => g.alias),
    customer: { id, created_at: created, tags },
  });
  const r = countPotential(
    [
      th("a", D16, [{ alias: "booking", time: D16 }, { alias: "purchase", time: D16 }]), // 1 tiềm năng + 1 đặt lịch + 1 đến
      th("b", D16, [{ alias: "bookings-deposit", time: D16 }, { alias: "purchase", time: D18 }]), // đến sau kỳ → chưa tính đến
      th("c", OLD, [{ alias: "booking", time: D16 }]), // khách cũ đặt lịch trong kỳ → tiềm năng + đặt lịch
      th("d", OLD, [{ alias: "booking", time: OLD }, { alias: "purchase", time: D16 }]), // đặt lịch kỳ trước, đến trong kỳ
      th("e", D16, [{ alias: "purchase", time: D16 }]), // chỉ purchase → tiềm năng + đến cơ sở
      th("g", OLD, [{ alias: "phone", time: OLD }]), // khách cũ không chuyển đổi trong kỳ → không tính
      th("f", D18, [{ alias: "phone", time: D18 }]), // xuất hiện sau kỳ → không tính
    ],
    new Map(),
    { from: "2026-11-16", to: "2026-11-16" },
  );
  // Mỗi người 1 tiềm năng; tiềm năng ⊇ đặt lịch, đến cơ sở.
  assert.deepEqual(r.total, { potential: 5, booking: 3, showUp: 3 });
  assert.deepEqual(r.byWa, { "WA-3455": { potential: 5, booking: 3, showUp: 3 } });
});

test("buildInboxReport: cọc gắn sau kỳ chưa tính deposit", () => {
  const r = buildInboxReport(
    [],
    [
      {
        id: "1",
        platform: "whatsappweb",
        created_at: "2026-11-16T03:00:00.000Z",
        tag_aliases: ["booking", "bookings-deposit"],
        customer: {
          tags: [
            { alias: "booking", time: "2026-11-16T05:00:00.000Z" },
            { alias: "bookings-deposit", time: "2026-11-17T05:00:00.000Z" },
          ],
        },
      },
    ],
    "2026-11-16",
    "2026-11-16",
  );
  assert.equal(r.total.wa.booking, 1);
  assert.equal(r.total.wa.deposit, 0);
});

test("1 khách IG có tin nhắn + bình luận chỉ tính 1; khách cũ bình luận lại không phải khách mới", () => {
  const D16 = "2026-11-16T03:00:00.000Z";
  const cust = (id: string, created = D16) => ({ id, created_at: created, tags: [{ alias: "booking", time: D16 }] });
  const dm = { id: "dm", platform: "instagram", created_at: D16, last_message_at: D16, tag_aliases: ["zila", "booking"], customer: cust("A") };
  const cmt = { id: "cmt", platform: "instagram", created_at: D16, last_message_at: D16, tag_aliases: [], customer: cust("A") };
  const oldCmt = { id: "old", platform: "instagram", created_at: D16, last_message_at: D16, tag_aliases: [], customer: { id: "B", created_at: "2026-10-01T00:00:00.000Z" } };

  const r = buildInboxReport([cmt, dm, oldCmt], [dm], "2026-11-16", "2026-11-16");
  assert.deepEqual(r.total.ig, { ...zero, conversations: 1, booking: 1 }); // không có "untagged" từ bình luận / khách cũ
  assert.equal(r.staff.find((s) => s.alias === "zila")!.counts.ig.conversations, 1);

  assert.deepEqual(buildFollowupReport([cmt, dm, oldCmt], "2026-11-16", "2026-11-16").total, {
    worked: 1, // khách B (cũ) bình luận trong kỳ
    converted: 0,
    bookingOld: 0,
    showUp: 0,
    bookingNew: 1, // khách A tính 1 lần
  });
  assert.deepEqual(countPotential([{ ...cmt, tag_aliases: ["phone"], instagram: { ad_id: "x" } }, { ...dm, instagram: { ad_id: "x" } }], new Map([["x", "c"]])), {
    byCampaign: { c: { potential: 1, booking: 1, showUp: 0 } },
    byWa: {},
    total: { potential: 1, booking: 1, showUp: 0 },
  });
});

test("buildInboxReport: Khách đến theo lúc gắn purchase, Re-engaged = khách cũ nhắn/chuyển đổi trong kỳ", () => {
  const OLD = "2026-11-01T03:00:00.000Z";
  const D16 = "2026-11-16T03:00:00.000Z";
  const th = (id: string, created: string, last: string, tags: { alias: string; time: string }[]) => ({
    id,
    platform: "whatsappweb",
    created_at: created,
    last_message_at: last,
    tag_aliases: tags.map((g) => g.alias),
    customer: { id, tags },
  });
  const r = buildInboxReport(
    [],
    [
      th("1", OLD, D16, []), // khách cũ nhắn trong kỳ
      th("2", OLD, "2026-11-18T03:00:00.000Z", [{ alias: "purchase", time: D16 }]), // khách cũ đến trong kỳ, nhắn sau kỳ
      th("3", D16, D16, [{ alias: "purchase", time: D16 }]), // khách mới đến ngay trong ngày → Khách đến + Show-up trong ngày
      th("4", OLD, "2026-11-18T03:00:00.000Z", [{ alias: "purchase", time: "2026-11-18T03:00:00.000Z" }]), // đến sau kỳ → bỏ
    ],
    "2026-11-16",
    "2026-11-16",
  );
  assert.deepEqual(r.total.wa, { ...zero, reEngaged: 2, showUp: 2, showUpSameDay: 1 });
});

test("findPhones: số Indonesia nhiều cách viết, chuẩn hoá 62…", () => {
  assert.deepEqual(findPhones("wa aku 0812-3456-7890 ya"), ["6281234567890"]);
  assert.deepEqual(findPhones("+62 813 1111 2222 / 6281311112222"), ["6281311112222"]);
  assert.deepEqual(findPhones("jam 10.00 tgl 20, harga 350000"), []);
});

test("Khách IG chuyển sang WA cùng SĐT: 1 người, kênh = bên nhắn trước, booking WA tính cho IG", () => {
  const D15 = "2026-11-15T03:00:00.000Z";
  const D16 = "2026-11-16T03:00:00.000Z";
  const OLD = "2026-10-20T03:00:00.000Z";
  const ig = (id: string, created: string, extra = {}) => ({
    id,
    platform: "instagram",
    created_at: created,
    last_message_at: created,
    tag_aliases: ["phone", "bulan"],
    instagram: { ad_id: "ad1" },
    customer: { id: `c-${id}`, created_at: created, phone: "+62 812-3456-7890", tags: [{ alias: "phone", time: created }] },
    ...extra,
  });
  const wa = (id: string, created: string, phone = "6281234567890") => ({
    id,
    platform: "whatsappweb",
    page_pid: "waw6281918453455",
    created_at: created,
    last_message_at: D16,
    tag_aliases: ["booking", "bulan"],
    customer: { id: `c-${id}`, created_at: created, whatsappweb: { id: `${phone}@s.whatsapp.net` }, tags: [{ alias: "booking", time: D16 }] },
  });

  // Cả 2 cùng kỳ: 1 khách mới IG, booking 1 (IG), không có WA.
  const igNew = ig("i1", D15);
  const waNew = wa("w1", D16);
  const idx = igPhoneIndex([igNew]);
  const r = buildInboxReport([igNew, waNew], [igNew, waNew], "2026-11-15", "2026-11-16", idx);
  assert.deepEqual(r.total.ig, { ...zero, conversations: 1, booking: 1 });
  assert.deepEqual(r.total.wa, zero);
  assert.equal(r.staff.find((s) => s.alias === "bulan")!.counts.ig.booking, 1);
  // Không có chỉ mục → như cũ: 2 người.
  assert.equal(sumChannels(buildInboxReport([igNew, waNew], [], "2026-11-15", "2026-11-16").total).conversations, 2);

  // IG từ kỳ trước (chỉ có trong chỉ mục): WA mới không phải khách mới; booking là booking khách cũ, về IG.
  const igOld = ig("i2", OLD);
  const r2 = buildInboxReport([waNew], [waNew], "2026-11-16", "2026-11-16", igPhoneIndex([igOld]));
  assert.deepEqual(r2.total.ig, { ...zero, booking: 1, bookingOld: 1, reEngaged: 1 });
  assert.deepEqual(r2.total.wa, zero);
  assert.deepEqual(buildFollowupReport([waNew], "2026-11-16", "2026-11-16", igPhoneIndex([igOld])).total, {
    worked: 1,
    converted: 1,
    bookingOld: 1,
    showUp: 0,
    bookingNew: 0,
  });

  // WA nhắn trước IG → giữ kênh WA.
  const waFirst = wa("w2", D15);
  const igLater = ig("i3", D16);
  const r3 = buildInboxReport([waFirst, igLater], [], "2026-11-15", "2026-11-16", igPhoneIndex([igLater]));
  assert.equal(r3.total.wa.conversations, 1);
  assert.equal(r3.total.ig.conversations, 0);

  // SĐT tìm trong tin nhắn (SMAX không lưu) cũng ghép được; số khác thì không ghép.
  const igScanned = ig("i4", D15, { customer: { id: "c-i4", created_at: D15 }, scanned_phones: ["6281234567890"] });
  const other = wa("w3", D16, "6289999999999");
  const r4 = buildInboxReport([igScanned, waNew, other], [], "2026-11-15", "2026-11-16", igPhoneIndex([igScanned]));
  assert.equal(r4.total.ig.conversations, 1);
  assert.equal(r4.total.wa.conversations, 1);

  // KH tiềm năng: 1 người về chiến dịch IG; người có phần IG từ kỳ trước không phải khách mới
  // nhưng booking gắn trong kỳ → tiềm năng + đặt lịch (về chiến dịch IG của người đó).
  const ads = new Map([["ad1", "camp"]]);
  assert.deepEqual(countPotential([igNew, waNew], ads, { from: "2026-11-15", to: "2026-11-16", igByPhone: idx }), { byCampaign: { camp: { potential: 1, booking: 1, showUp: 0 } }, byWa: {}, total: { potential: 1, booking: 1, showUp: 0 } });
  assert.deepEqual(countPotential([waNew], ads, { from: "2026-11-16", to: "2026-11-16", igByPhone: igPhoneIndex([igOld]) }), { byCampaign: { camp: { potential: 1, booking: 1, showUp: 0 } }, byWa: {}, total: { potential: 1, booking: 1, showUp: 0 } });
});

test("createdIn: lọc hội thoại tạo trong khoảng ngày WIB", () => {
  const th = (id: string, created?: string) => ({ id, created_at: created });
  const r = createdIn(
    [th("a", "2026-11-15T16:59:59.999Z"), th("b", "2026-11-15T17:00:00.000Z"), th("c", "2026-11-16T16:59:59.999Z"), th("d", "2026-11-16T17:00:00.000Z"), th("e")],
    "2026-11-16",
    "2026-11-16",
  );
  assert.deepEqual(r.map((t) => t.id), ["b", "c"]);
});
