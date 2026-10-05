import test from "node:test";
import assert from "node:assert/strict";
import { siteOrigin } from "../lib/metadata.ts";

test("sharing URLs require a public origin in production and allow local development", () => {
  assert.throws(() => siteOrigin("", true), /APP_URL/);
  assert.equal(siteOrigin("", false).origin, "http://127.0.0.1:3000");
  assert.equal(siteOrigin("https://santa.example.com/", true).origin, "https://santa.example.com");
  for (const value of ["javascript:alert(1)", "file:///tmp/santa", "https://user:secret@santa.example.com", "https://santa.example.com/subpath", "https://santa.example.com?token=secret", "https://santa.example.com#secret"]) {
    assert.throws(() => siteOrigin(value, true), /APP_URL/, value);
  }
});
