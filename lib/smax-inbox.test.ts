import assert from "node:assert/strict";
import { test } from "node:test";

import { buildInboxReport, countPotential, inboxDateRange, statusTotal, sumChannels, UNASSIGNED } from "./smax-inbox.ts";

const t = (id: string, platform: string, tags: string[]) => ({ id, platform, tag_aliases: tags });

const zero = { booking: 0, potential: 0, followUp: 0, pending: 0, spam: 0, conversations: 0, deposit: 0, untagged: 0, bookingOld: 0 };

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

test("buildInboxReport: Booking từ tập booked (gồm khách cũ), tách deposit + khách cũ", () => {
  const OLD = "2026-11-10T03:00:00.000Z";
  const TODAY = "2026-11-16T03:00:00.000Z";
  const th = (id: string, created: string, tags: string[], platform = "whatsappweb") => ({ id, platform, tag_aliases: tags, created_at: created });
  const r = buildInboxReport(
    [],
    [
      th("1", TODAY, ["bulan", "booking"]),
      th("2", OLD, ["bulan", "bookings-deposit"]), // khách cũ + deposit
      th("3", OLD, ["booking"], "instagram"), // khách cũ, chưa gán
      th("4", TODAY, ["potential"]), // không có tag booking → bỏ
      th("1", TODAY, ["bulan", "booking"]), // trùng id → bỏ
    ],
    "2026-11-16",
    "2026-11-16",
  );
  assert.deepEqual(r.total.wa, { ...zero, booking: 2, deposit: 1, bookingOld: 1 });
  assert.deepEqual(r.total.ig, { ...zero, booking: 1, bookingOld: 1 });
  assert.equal(statusTotal(sumChannels(r.total)), 3);
  assert.deepEqual(r.staff.find((s) => s.alias === "bulan")!.counts.wa, { ...zero, booking: 2, deposit: 1, bookingOld: 1 });
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
  assert.deepEqual(r, { byCampaign: { c1: 2, c2: 1 }, byWa: { "WA-3455": 2 } });
});
