import test from "node:test";
import assert from "node:assert/strict";
import { extractLinkMetadata, isPublicAddress, publicDestination, publicWebUrl } from "../lib/link-preview.ts";
import { normalizeWishlistUrl } from "../lib/link.ts";

test("web links accept http, https and pasted www addresses", () => {
  assert.equal(normalizeWishlistUrl(" www.example.com/gift "), "https://www.example.com/gift");
  assert.equal(normalizeWishlistUrl("https://example.com/gift"), "https://example.com/gift");
  assert.equal(normalizeWishlistUrl("http://example.com/gift"), "http://example.com/gift");
  for (const value of ["javascript:alert(1)", "data:text/html,hello", "ftp://example.com", "https://user:pass@example.com", "Not a link", ""]) assert.equal(normalizeWishlistUrl(value), null);
});
test("private, loopback, mapped and infrastructure address ranges are blocked", () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "198.18.0.1", "192.0.2.1", "224.0.0.1", "::1", "::", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "2002:0a00:0001::", "garbage"]) assert.equal(isPublicAddress(address), false, address);
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(isPublicAddress(address), true, address);
});
test("URL validation blocks local hosts, credentials, non-web schemes and unusual ports", () => {
  for (const url of ["http://localhost", "http://localhost.", "http://secret-santa-db", "http://metadata.google.internal", "http://router.local", "http://127.0.0.1", "http://2130706433", "http://0x7f000001", "http://[::1]", "http://[::ffff:127.0.0.1]", "https://user:pass@example.com", "file:///etc/passwd", "https://example.com:5432"]) assert.throws(() => publicWebUrl(url), url);
  assert.equal(publicWebUrl("https://example.com/gift#fragment").href, "https://example.com/gift");
});
test("DNS validation rejects hosts with any private address and returns a pinned public address", async () => {
  await assert.rejects(() => publicDestination("https://example.com", async () => [{ address: "127.0.0.1", family: 4 }]));
  await assert.rejects(() => publicDestination("https://example.com", async () => [{ address: "1.1.1.1", family: 4 }, { address: "10.0.0.1", family: 4 }]));
  await assert.rejects(() => publicDestination("https://example.com", async () => []));
  const destination = await publicDestination("https://example.com/gift", async () => [{ address: "2606:4700:4700::1111", family: 6 }, { address: "1.1.1.1", family: 4 }]);
  assert.deepEqual(destination.address, { address: "1.1.1.1", family: 4 });
  assert.equal(destination.url.hostname, "example.com");
});
test("Open Graph metadata wins, entities decode, and relative images resolve", () => {
  const preview = extractLinkMetadata(`<html><head>
    <title>Fallback title</title><meta name="twitter:title" content="Twitter title">
    <meta property="og:title" content="Books &amp; gifts"><meta property="og:title" content="Second title">
    <meta property="og:description" content="A &quot;great&quot; gift"><meta property="og:site_name" content="Book Shop">
    <meta property="og:image" content="/images/book.jpg">
  </head></html>`, "https://www.example.com/products/book");
  assert.equal(preview.title, "Books & gifts"); assert.equal(preview.description, 'A "great" gift');
  assert.equal(preview.siteName, "Book Shop"); assert.equal(preview.hostname, "example.com");
  assert.equal(preview.image, "https://www.example.com/images/book.jpg");
});
test("Twitter metadata and document title provide fallbacks", () => {
  const twitter = extractLinkMetadata('<meta name="twitter:title" content="A good book"><meta name="twitter:description" content="For readers"><meta name="twitter:image" content="https://images.example.com/book.png">', "https://example.com/book");
  assert.equal(twitter.title, "A good book"); assert.equal(twitter.image, "https://images.example.com/book.png");
  const plain = extractLinkMetadata('<title>  A simple\n page </title><meta name="description" content="Plain description">', "https://example.com");
  assert.equal(plain.title, "A simple page"); assert.equal(plain.description, "Plain description"); assert.equal(plain.image, null);
  assert.equal(extractLinkMetadata("<html></html>", "https://example.com").title, "example.com");
});
test("metadata is bounded and unsafe image URLs are discarded", () => {
  const large = extractLinkMetadata(`<meta property="og:title" content="${"a".repeat(1000)}"><meta property="og:description" content="${"b".repeat(1000)}">`, "https://example.com");
  assert.equal(large.title.length, 200); assert.equal(large.description.length, 280);
  for (const image of ["javascript:alert(1)", "data:image/png;base64,AA", "http://127.0.0.1/image.png", "http://[::1]/image.png", "http://10.0.0.1/image.png", "https://user:pass@example.com/img.png"]) {
    assert.equal(extractLinkMetadata(`<meta property="og:image" content="${image}">`, "https://example.com").image, null, image);
  }
});
test("document base URL and protocol-relative images are supported", () => {
  assert.equal(extractLinkMetadata('<base href="https://images.example.com/assets/"><meta property="og:image" content="book.jpg">', "https://example.com/book").image, "https://images.example.com/assets/book.jpg");
  assert.equal(extractLinkMetadata('<meta property="og:image" content="//images.example.com/book.jpg">', "https://example.com/book").image, "https://images.example.com/book.jpg");
});

test("Amazon product images work without Open Graph metadata", () => {
  const html = '<title>Mini PC</title><img id="landingImage" src="https://m.media-amazon.com/thumbnail.jpg" data-old-hires="https://m.media-amazon.com/product.jpg">';
  assert.equal(extractLinkMetadata(html, "https://www.amazon.com.au/dp/B0F32V6312/").image, "https://m.media-amazon.com/product.jpg");
  assert.equal(extractLinkMetadata(html, "https://amazon.com.au.evil.com/product").image, null);
  assert.equal(extractLinkMetadata('<img id="imgBlkFront" src="https://m.media-amazon.com/book.jpg">', "https://www.amazon.co.uk/dp/BOOK/").image, "https://m.media-amazon.com/book.jpg");
});

test("schema images and safe alternatives work when an earlier image is unsuitable", () => {
  const html = '<meta property="og:image" content="data:image/png;base64,AA"><meta itemprop="image" content="/product.jpg">';
  assert.equal(extractLinkMetadata(html, "https://example.com/gift").image, "https://example.com/product.jpg");
  assert.equal(extractLinkMetadata('<img itemprop="image" src="/photo.png">', "https://example.com/gift").image, "https://example.com/photo.png");
});
