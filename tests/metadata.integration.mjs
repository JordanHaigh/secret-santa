// Read-only checks: no database access or changes to the exchange.
import assert from "node:assert/strict";
import { load } from "cheerio";

const base = new URL(process.env.TEST_URL || "http://127.0.0.1:3000");
const origin = new URL(process.env.EXPECTED_APP_URL || process.env.APP_URL || base.origin);
const agents = [
  "Mozilla/5.0",
  "facebookexternalhit/1.1",
  "WhatsApp/2.0",
  "Twitterbot/1.0",
  "Slackbot-LinkExpanding 1.0",
  "Discordbot/2.0",
  "TelegramBot (like TwitterBot)",
  "LinkedInBot/1.0",
  "Applebot/0.1",
  "UnknownFamilyChatPreview/1.0",
];
let checks = 0;
for (const path of ["/", "/admin", "/account", "/reveal/test-private-token"]) {
  for (const agent of agents) {
    const response = await fetch(new URL(path, base), { headers: { "User-Agent": agent } });
    assert.equal(response.status, 200, `${path} for ${agent}`);
    const html = await response.text();
    const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1];
    assert.ok(head, "Metadata must be in the initial head, without client-side JavaScript");
    const $ = load(head);
    const meta = key => $(`meta[property="${key}"], meta[name="${key}"]`).attr("content");
    for (const key of ["og:title", "og:description", "og:type", "og:site_name", "og:locale", "og:url", "og:image", "og:image:type", "og:image:width", "og:image:height", "og:image:alt", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt", "twitter:card"]) {
      assert.ok(meta(key), `${key} missing: ${path} for ${agent}`);
      assert.equal($(`meta[property="${key}"], meta[name="${key}"]`).length, 1, `${key} duplicated`);
    }
    assert.equal(meta("og:type"), "website");
    assert.equal(meta("og:locale"), "en_AU");
    assert.equal(meta("og:image"), new URL("/share-card.png", origin).href);
    assert.equal(meta("twitter:image"), meta("og:image"));
    assert.equal(meta("twitter:card"), "summary_large_image");
    assert.equal(meta("og:image:width"), "1200");
    assert.equal(meta("og:image:height"), "630");
    assert.equal(meta("og:title"), $("title").text());
    assert.equal(meta("twitter:title"), meta("og:title"));
    assert.equal(new URL(meta("og:url")).href, new URL(["/admin", "/account"].includes(path) ? path : "/", origin).href);
    if (origin.protocol === "https:") assert.equal(meta("og:image:secure_url"), meta("og:image"));
    if (path.startsWith("/reveal/")) {
      assert.equal($('link[rel="canonical"]').length, 0);
      assert.ok(!head.includes("test-private-token"), "Private token must not appear in metadata");
    } else assert.equal(new URL($('link[rel="canonical"]').attr("href")).href, new URL(path, origin).href);
    if (path !== "/") assert.match(meta("robots"), /noindex/);
    assert.equal($('link[rel="apple-touch-icon"]').attr("sizes"), "180x180");
    checks++;
  }
}
for (const [path, width, height] of [["/share-card.png",1200,630], ["/favicon-32.png",32,32], ["/icon-192.png",192,192], ["/apple-touch-icon.png",180,180]]) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^image\/png/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0,8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16), width);
  assert.equal(bytes.readUInt32BE(20), height);
  assert.ok(bytes.length < 1024 * 1024, "Sharing assets should be small enough for messaging crawlers");
  checks++;
}
console.log(`Sharing metadata: ${checks} route/crawler and image checks passed.`);
