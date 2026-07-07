// Self-check: chạy bằng `node --test lib/errors/errors.test.ts` (Node ≥ 23).
import assert from "node:assert/strict";
import { test } from "node:test";
import { AxiosError } from "axios";
import { z } from "zod";
import { AppError, isAppError, normalizeError } from "./index.ts";

test("giữ nguyên AppError", () => {
  const e = new AppError("x", { code: "C", status: 1 });
  assert.equal(normalizeError(e), e);
});

test("chuẩn hoá giá trị không phải Error", () => {
  const e = normalizeError("boom");
  assert.ok(isAppError(e));
  assert.equal(e.code, "UNKNOWN");
  assert.ok(e.message.length > 0);
});

test("chuẩn hoá lỗi Axios kèm status", () => {
  const axiosErr = new AxiosError(
    "Request failed",
    "ERR_BAD_RESPONSE",
    undefined,
    undefined,
    { status: 404, data: { message: "Not found" } } as never,
  );
  const e = normalizeError(axiosErr);
  assert.equal(e.status, 404);
  assert.equal(e.message, "Not found");
});

test("chuẩn hoá lỗi Zod", () => {
  const r = z.object({ name: z.string() }).safeParse({});
  assert.ok(!r.success);
  const e = normalizeError(r.error);
  assert.equal(e.code, "VALIDATION_ERROR");
  assert.equal(e.status, 400);
});

test("chuẩn hoá lỗi kiểu Supabase", () => {
  const e = normalizeError({ message: "row not found", code: "PGRST116" });
  assert.equal(e.code, "PGRST116");
  assert.equal(e.message, "row not found");
});
