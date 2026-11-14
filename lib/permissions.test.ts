import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_PERMISSIONS, effectivePermissions, homePath, moduleOfPath, normalizePermissions } from "./permissions.ts";

test("admin có toàn quyền, bộ phận chỉ giữ key hợp lệ", () => {
  assert.deepEqual(effectivePermissions("admin", []), ALL_PERMISSIONS);
  assert.deepEqual(effectivePermissions("user", ["customers.view", "hack.all", "reports.delete"]), ["customers.view"]);
  assert.deepEqual(effectivePermissions("user", null), []);
});

test("module theo đường dẫn", () => {
  assert.equal(moduleOfPath("/customers"), "customers");
  assert.equal(moduleOfPath("/tour/abc"), "tour");
  assert.equal(moduleOfPath("/tourist"), null);
  assert.equal(moduleOfPath("/users"), null);
});

test("trang chủ = menu đầu tiên được xem", () => {
  assert.equal(homePath(["services.view", "appointments.view"]), "/appointments");
  assert.equal(homePath(["customers.edit"]), null);
});

test("chọn Sửa/Xoá tự thêm Xem, bỏ Xem thì bỏ cả module", () => {
  assert.deepEqual(normalizePermissions([], ["tour.delete"]), ["tour.view", "tour.delete"]);
  assert.deepEqual(
    normalizePermissions(["tour.view", "tour.edit", "reports.view"], ["tour.edit", "reports.view"]),
    ["reports.view"],
  );
  assert.deepEqual(normalizePermissions([], ["x.y", "customers.view"]), ["customers.view"]);
});
