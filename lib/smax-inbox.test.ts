import assert from "node:assert/strict";
import { test } from "node:test";

import { buildInboxReport, inboxDateRange, statusTotal, sumChannels, UNASSIGNED } from "./smax-inbox.ts";

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
