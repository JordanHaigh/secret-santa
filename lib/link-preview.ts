import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import * as cheerio from "cheerio";
import ipaddr from "ipaddr.js";
import type { LinkMetadata } from "./link.ts";

export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    // Mapped IPv6 and transition ranges must not bypass IPv4 private ranges.
    return parsed.range() === "unicast" && !(parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress());
  } catch { return false; }
}

export function publicWebUrl(value: string): URL {
  if (typeof value !== "string" || value.length > 1000) throw new Error("Invalid link");
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) throw new Error("Invalid link");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || !host.includes(".") && !isIP(host) || /\.(?:localhost|local|internal|test|invalid|example|home|lan)$/.test(host)) throw new Error("Private host");
  if (isIP(host) && !isPublicAddress(host)) throw new Error("Private address");
  url.hash = "";
  return url;
}

type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;
export async function publicDestination(value: string, resolve: Resolver = host => lookup(host, { all: true, verbatim: true })) {
  const url = publicWebUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await Promise.race([
      resolve(hostname),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("DNS lookup timed out")), 3000); }),
    ]);
    if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) throw new Error("Private destination");
    // Prefer IPv4 for hosts whose IPv6 route is unavailable on a Docker network.
    return { url, address: addresses.find(entry => entry.family === 4) ?? addresses[0] };
  } finally { if (timer) clearTimeout(timer); }
}

type RemoteResponse = { status: number; headers: IncomingHttpHeaders; body: Buffer; url: string };
type ContentKind = "html" | "image";
const imageTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);

async function readRemote(value: string, kind: ContentKind): Promise<RemoteResponse> {
  const { url, address } = await publicDestination(value);
  // Retail product pages can contain several MB of inline product data.
  const maxBytes = kind === "html" ? 5 * 1024 * 1024 : 4 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = transport(url, {
      method: "GET", agent: false, family: address.family,
      // Pin the validated address to the socket. Do not resolve the host again.
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      headers: {
        "User-Agent": "FamilySecretSanta/1.0 (link preview)",
        Accept: kind === "html" ? "text/html,application/xhtml+xml" : "image/avif,image/webp,image/png,image/jpeg,image/gif",
        "Accept-Encoding": "identity",
      },
    }, response => {
      const status = response.statusCode ?? 500;
      const finish = (body: Buffer) => { clearTimeout(timer); resolve({ status, headers: response.headers, body, url: url.href }); };
      if ([301, 302, 303, 307, 308].includes(status)) { finish(Buffer.alloc(0)); response.destroy(); return; }
      const contentType = response.headers["content-type"]?.split(";")[0].trim().toLowerCase();
      if (status < 200 || status >= 300 || (kind === "html" ? !["text/html", "application/xhtml+xml"].includes(contentType ?? "") : !imageTypes.has(contentType ?? ""))) {
        clearTimeout(timer); response.destroy(); reject(new Error("Preview unavailable")); return;
      }
      if (Number(response.headers["content-length"] ?? 0) > maxBytes) { clearTimeout(timer); response.destroy(); reject(new Error("Preview too large")); return; }
      const chunks: Buffer[] = []; let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) { clearTimeout(timer); response.destroy(); reject(new Error("Preview too large")); return; }
        chunks.push(chunk);
      });
      response.once("end", () => finish(Buffer.concat(chunks)));
      response.once("error", error => { clearTimeout(timer); reject(error); });
    });
    timer = setTimeout(() => req.destroy(new Error("Preview timed out")), 6000);
    req.once("error", error => { clearTimeout(timer); reject(error); });
    req.end();
  });
}

export async function fetchPublicContent(value: string, kind: ContentKind): Promise<RemoteResponse> {
  let current = value;
  for (let redirect = 0; redirect <= 3; redirect++) {
    const response = await readRemote(current, kind);
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.location;
    if (!location || redirect === 3) throw new Error("Too many redirects");
    // Every redirect goes back through URL and DNS validation, including images.
    current = new URL(location, response.url).href;
  }
  throw new Error("Preview unavailable");
}

export function extractLinkMetadata(html: string | Buffer, value: string): LinkMetadata {
  const url = publicWebUrl(value);
  const $ = Buffer.isBuffer(html) ? cheerio.loadBuffer(html) : cheerio.load(html);
  const metadata = new Map<string, string>();
  $("head meta").each((_, element) => {
    const key = ($(element).attr("property") ?? $(element).attr("name") ?? "").toLowerCase();
    const content = $(element).attr("content")?.trim();
    if (content && !metadata.has(key)) metadata.set(key, content);
  });
  const text = (value: string | undefined, max: number) => (value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const hostname = url.hostname.replace(/^www\./, "");
  const title = text(metadata.get("og:title") || metadata.get("twitter:title") || $("title").first().text(), 200) || hostname;
  const description = text(metadata.get("og:description") || metadata.get("twitter:description") || metadata.get("description"), 280);
  const siteName = text(metadata.get("og:site_name"), 80) || hostname;
  const images: string[] = [];
  const addImage = (value: unknown) => { if (typeof value === "string" && value.trim()) images.push(value.trim()); };
  for (const key of ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"]) addImage(metadata.get(key));
  addImage($('link[rel="image_src"]').first().attr("href"));
  // Amazon exposes the actual product photo on its main image element.
  if (/(^|\.)amazon\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2})$/.test(url.hostname)) {
    const productImage = $("#landingImage, #imgBlkFront").first();
    addImage(productImage.attr("data-old-hires"));
    addImage(productImage.attr("src"));
  }
  $('[itemprop="image"]').each((_, element) => {
    addImage($(element).attr("content") || $(element).attr("src") || $(element).attr("href"));
  });
  let image: string | null = null;
  for (const rawImage of images) {
    try {
      const base = $("base").first().attr("href");
      image = publicWebUrl(new URL(rawImage, base ? new URL(base, url).href : url.href).href).href;
      break;
    } catch { /* Keep the text preview when an image URL is unsuitable. */ }
  }
  return { url: url.href, title, description, siteName, hostname, image };
}

type PreviewCache = { values: Map<string, { data: LinkMetadata; expires: number }>; pending: Map<string, Promise<LinkMetadata>>; active: number };
const shared = globalThis as unknown as { santaPreviewCache?: PreviewCache };
const cache = shared.santaPreviewCache ??= { values: new Map(), pending: new Map(), active: 0 };

export async function withPreviewSlot<T>(task: () => Promise<T>): Promise<T> {
  if (cache.active >= 8) throw new Error("Preview service busy");
  cache.active++;
  try { return await task(); } finally { cache.active--; }
}
export async function getLinkMetadata(value: string): Promise<LinkMetadata> {
  const url = publicWebUrl(value).href;
  const stored = cache.values.get(url);
  if (stored && stored.expires > Date.now()) return stored.data;
  if (cache.pending.has(url)) return cache.pending.get(url)!;
  const pending = withPreviewSlot(async () => {
    const response = await fetchPublicContent(url, "html");
    const data = extractLinkMetadata(response.body, response.url);
    if (data.image) {
      try { await publicDestination(data.image); } catch { data.image = null; }
    }
    if (cache.values.size >= 500) cache.values.delete(cache.values.keys().next().value!);
    cache.values.set(url, { data, expires: Date.now() + 60 * 60 * 1000 });
    return data;
  });
  cache.pending.set(url, pending);
  try { return await pending; } finally { cache.pending.delete(url); }
}
