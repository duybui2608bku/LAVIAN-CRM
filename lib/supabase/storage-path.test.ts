// Self-check: `node --test lib/supabase/storage-path.test.ts` (Node ≥ 23).
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileExt, objectPathFromPublicUrl } from "./storage-path.ts";

const base = "https://x.supabase.co/storage/v1/object/public/images/";

test("trích path từ public URL", () => {
  assert.equal(objectPathFromPublicUrl(base + "uid/abc.png"), "uid/abc.png");
});

test("bỏ query string", () => {
  assert.equal(objectPathFromPublicUrl(base + "uid/a.png?t=1"), "uid/a.png");
});

test("giải mã ký tự encode", () => {
  assert.equal(objectPathFromPublicUrl(base + "uid/a%20b.png"), "uid/a b.png");
});

test("URL ngoài bucket -> null", () => {
  assert.equal(objectPathFromPublicUrl("https://cdn.other.com/x.png"), null);
});

test("khác tên bucket -> null", () => {
  assert.equal(objectPathFromPublicUrl(base + "uid/a.png", "avatars"), null);
});

test("đuôi file: theo tên rồi fallback mime", () => {
  assert.equal(fileExt("anh.PNG", "image/png"), "png");
  assert.equal(fileExt("khong-duoi", "image/webp"), "webp");
  assert.equal(fileExt("", ""), "bin");
});
