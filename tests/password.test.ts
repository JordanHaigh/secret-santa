import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, validNewPassword, verifyPassword } from "../lib/password.ts";
test("password hashes are salted, verify correctly and reject malformed stored hashes", async () => {
  const first = await hashPassword("change-me"), second = await hashPassword("change-me");
  assert.notEqual(first, second);
  assert.equal(first.includes("change-me"), false);
  assert.equal(await verifyPassword("change-me", first), true);
  assert.equal(await verifyPassword("wrong-password", first), false);
  assert.equal(await verifyPassword("change-me", "scrypt$bad$bad"), false);
});
test("new passwords cannot retain the default or exceed the supported bounds", () => {
  for (const value of ["change-me", " change-me ", "short", " ".repeat(12), "a".repeat(129), null]) assert.equal(validNewPassword(value), false);
  assert.equal(validNewPassword("a".repeat(12)), true);
  assert.equal(validNewPassword("a".repeat(128)), true);
});
