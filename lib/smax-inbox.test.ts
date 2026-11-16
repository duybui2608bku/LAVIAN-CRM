import assert from "node:assert/strict";
import { test } from "node:test";

import { buildInboxReport, inboxDateRange, statusTotal, sumChannels, UNASSIGNED } from "./smax-inbox.ts";

const t = (id: string, platform: string, tags: string[]) => ({ id, platform, tag_aliases: tags });

test("buildInboxReport: đếm theo kênh, trạng thái, nhân viên", () => {
  const r = buildInboxReport([
    t("1", "whatsappweb", ["bulan", "booking"]),
    t("2", "whatsappweb", ["bulan", "bookings-deposit"]),
    t("3", "whatsappweb", ["zila", "follow-up"]),
    t("4", "instagram", ["no-reply", "tiara-kania"]),
    t("5", "instagram", ["spam"]),
    t("8", "instagram", []),
    t("9", "whatsappweb", ["potential", "follow-up"]), // Potential ưu tiên hơn Follow up
    t("6", "facebook", ["bulan", "booking"]), // kênh khác → bỏ
    t("1", "whatsappweb", ["bulan", "booking"]), // trùng id → bỏ
    t("7", "whatsappweb", ["sabil", "ratih", "follow-up"]), // 2 nhân viên
  ]);

  assert.equal(r.threads, 8);
  assert.deepEqual(r.total.wa, { booking: 2, potential: 1, followUp: 2, pending: 0, spam: 0, deposit: 1, untagged: 0 });
  assert.deepEqual(r.total.ig, { booking: 0, potential: 0, followUp: 0, pending: 1, spam: 1, deposit: 0, untagged: 1 });
  assert.equal(statusTotal(sumChannels(r.total)), 7);

  const row = (alias: string) => r.staff.find((s) => s.alias === alias)!.counts;
  assert.equal(row("bulan").wa.booking, 2);
  assert.equal(row("bulan").wa.deposit, 1);
  assert.equal(row("tiara-kania").ig.pending, 1);
  assert.equal(row("sabil").wa.followUp, 1);
  assert.equal(row("ratih").wa.followUp, 1);
  assert.equal(row(UNASSIGNED).ig.untagged, 1);
});

test("buildInboxReport: nhiều trạng thái → ưu tiên Booking", () => {
  const r = buildInboxReport([t("1", "whatsappweb", ["spam", "no-reply", "follow-up", "potential", "booking"])]);
  assert.deepEqual(r.total.wa, { booking: 1, potential: 0, followUp: 0, pending: 0, spam: 0, deposit: 0, untagged: 0 });
});

test("inboxDateRange: 00:00 WIB = 17:00 UTC hôm trước", () => {
  assert.deepEqual(inboxDateRange("2026-11-16", "2026-11-16"), [
    "2026-11-15T17:00:00.000Z",
    "2026-11-16T16:59:59.999Z",
  ]);
});
