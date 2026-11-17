// Self-check: `node --test lib/smax-messages.test.ts` (Node ≥ 23).
import assert from "node:assert/strict";
import { test } from "node:test";
import { threadRef, toChatMessages } from "./smax-messages.ts";

test("threadRef: WA + IG link, link lạ → null", () => {
  assert.deepEqual(
    threadRef("https://smax.ai/bizs/lavianbeautycenter/chats/waw6281918453455?tid=waw628126644172@s.whatsapp.net"),
    { page: "waw6281918453455", tid: "waw628126644172@s.whatsapp.net" },
  );
  assert.deepEqual(threadRef("https://smax.ai/bizs/x/chats/ig17841474444790127?tid=ig917735151270419"), {
    page: "ig17841474444790127",
    tid: "ig917735151270419",
  });
  assert.equal(threadRef("https://smax.ai/bizs/x/chats/../evil?tid=1"), null);
  assert.equal(threadRef("not a url"), null);
  assert.equal(threadRef(null), null);
});

test("toChatMessages: chiều gửi, ảnh WA/IG, bỏ tin rỗng, cũ nhất trước", () => {
  const page = "waw1";
  const msgs = toChatMessages([
    { id: "3", page_pid: page, sender_pid: page, platform: "whatsappweb", message: " Hi ", created_at: "c", whatsappweb: { attachments: [] } },
    {
      id: "2", page_pid: page, sender_pid: "cus", platform: "whatsappweb", created_at: "b",
      whatsappweb: { attachments: [{ url: "u", thumbnail: "t", type: "image" }] },
    },
    { id: "1", page_pid: "ig1", sender_pid: "cus", platform: "instagram", created_at: "a", instagram: { attachments: [{ mime_type: "template" }] } },
    { id: "0", page_pid: page, sender_pid: "cus", platform: "whatsappweb", message: "  ", created_at: "z" },
  ]);
  assert.deepEqual(msgs.map((m) => m.id), ["1", "2", "3"]);
  assert.equal(msgs[2].out, true);
  assert.equal(msgs[2].text, "Hi");
  assert.deepEqual(msgs[1].images, [{ src: "u", thumb: "t" }]);
  assert.equal(msgs[0].files, 1);
});
