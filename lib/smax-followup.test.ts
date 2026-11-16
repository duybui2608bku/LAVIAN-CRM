import assert from "node:assert/strict";
import { test } from "node:test";

import { buildFollowupReport, staffAvatars, UNASSIGNED } from "./smax-inbox.ts";

// Ngày 16/11 WIB = 2026-11-15T17:00Z → 2026-11-16T16:59:59.999Z.
const OLD = "2026-11-10T03:00:00.000Z";
const TODAY = "2026-11-16T03:00:00.000Z";
const YESTERDAY = "2026-11-15T03:00:00.000Z";
const t = (id: string, created: string, staff: string[], tags: [string, string][], platform = "whatsappweb") => ({
  id,
  platform,
  created_at: created,
  tag_aliases: [...staff, ...tags.map(([a]) => a)],
  customer: { tags: tags.map(([alias, time]) => ({ alias, time })) },
});

test("buildFollowupReport: tách data cũ / mới theo ngày tạo và thời điểm gắn tag", () => {
  const r = buildFollowupReport(
    [
      t("1", OLD, ["bulan"], [["follow-up", OLD]]), // bào, chưa chuyển
      t("2", OLD, ["bulan"], [["booking", TODAY]]), // bào → booking hôm nay
      t("3", OLD, ["zila"], [["purchase", TODAY]]), // bào → show-up
      t("4", OLD, ["zila"], [["booking", YESTERDAY], ["bookings-deposit", TODAY]]), // booking từ hôm qua → không tính
      t("5", TODAY, ["bulan"], [["booking", TODAY]]), // booking mới
      t("6", TODAY, [], [["follow-up", TODAY]]), // data mới, chưa booking
      t("7", OLD, ["sabil", "ratih"], [["booking", TODAY], ["purchase", TODAY]], "instagram"), // 2 nhân viên, booking + show-up
      t("8", OLD, ["bulan"], [["booking", TODAY]], "facebook"), // kênh khác → bỏ
      t("2", OLD, ["bulan"], [["booking", TODAY]]), // trùng id → bỏ
    ],
    "2026-11-16",
    "2026-11-16",
  );

  assert.deepEqual(r.total, { worked: 5, converted: 3, bookingOld: 2, showUp: 2, bookingNew: 1 });
  const row = (alias: string) => r.staff.find((s) => s.alias === alias)!.counts;
  assert.deepEqual(row("bulan"), { worked: 2, converted: 1, bookingOld: 1, showUp: 0, bookingNew: 1 });
  assert.deepEqual(row("zila"), { worked: 2, converted: 1, bookingOld: 0, showUp: 1, bookingNew: 0 });
  assert.deepEqual(row("sabil"), row("ratih"));
  assert.equal(row("sabil").converted, 1);
  assert.deepEqual(row(UNASSIGNED), { worked: 0, converted: 0, bookingOld: 0, showUp: 0, bookingNew: 0 });
});

test("staffAvatars ghép tag tên SMAX với tài khoản CRM theo tên", () => {
  const avatars = staffAvatars([
    { user_name: "Bulan", avatar_url: "b.png" },
    { user_name: "tiara", avatar_url: "t.png" },
    { user_name: "Resi", avatar_url: "r.png" },
  ]);
  assert.equal(avatars.bulan, "b.png");
  assert.equal(avatars["tiara-kania"], "t.png");
  assert.equal(avatars.angel, null);
});
