import { createHmac, createHash, timingSafeEqual, randomBytes } from "node:crypto";
import pg from "pg";
import { emptyExchange, type Exchange } from "./exchange";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", ...extra } });
}
const globalForDb = globalThis as unknown as { santaPool?: pg.Pool };
export function db() {
  if (!process.env.DATABASE_URL) throw new ApiError("The exchange is not configured yet. Please contact the organiser.", 503);
  if (!globalForDb.santaPool) {
    globalForDb.santaPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
    globalForDb.santaPool.on("error", error => console.error("Database connection failed", error.message));
  }
  return globalForDb.santaPool;
}
export async function loadState() {
  const result = await db().query<{ value: Exchange; revision: number }>("SELECT value, revision FROM exchange_state WHERE id = $1", ["exchange"]);
  const row = result.rows[0];
  return row ? { state: row.value, revision: row.revision } : { state: emptyExchange(), revision: -1 };
}
// Optimistic compare-and-swap keeps signups, rules and draws consistent across replicas.
export async function changeState(transform: (state: Exchange) => Exchange) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { state, revision } = await loadState();
    const next = transform(state);
    const result = revision === -1
      ? await db().query("INSERT INTO exchange_state (id, value, revision) VALUES ($1, $2::jsonb, 0) ON CONFLICT (id) DO NOTHING", ["exchange", JSON.stringify(next)])
      : await db().query("UPDATE exchange_state SET value = $1::jsonb, revision = revision + 1 WHERE id = $2 AND revision = $3", [JSON.stringify(next), "exchange", revision]);
    if (result.rowCount === 1) return next;
  }
  throw new ApiError("The exchange changed while you were saving. Please try again.", 409);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const expected = process.env.APP_URL?.replace(/\/$/, "") || (forwardedHost && forwardedProto ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin);
  if (!origin || origin !== expected) throw new ApiError("Please submit this request from the website.", 403);
}
export async function body(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError("Please send a JSON request.", 415);
  if (Number(request.headers.get("content-length") ?? 0) > 64000) throw new ApiError("This submission is too large.", 413);
  const content = await request.text();
  if (content.length > 64000) throw new ApiError("This submission is too large.", 413);
  try { const parsed = JSON.parse(content); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); return parsed; }
  catch { throw new ApiError("Please send a valid submission."); }
}
export async function limited(request: Request, scope: string, max: number, windowSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  // Coolify's reverse proxy must overwrite forwarded headers rather than trust client values.
  const ip = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "local";
  const key = `${scope}:${ip}:${Math.floor(now / windowSeconds)}`;
  const result = await db().query<{ count: number }>("INSERT INTO rate_limits (key, count, expires) VALUES ($1, 1, $2) ON CONFLICT(key) DO UPDATE SET count = rate_limits.count + 1 RETURNING count", [key, now + windowSeconds]);
  // Expired rows do not affect limits; bounded cleanup avoids unbounded growth.
  await db().query("DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE expires < $1 LIMIT 100)", [now]);
  if (result.rows[0].count > max) throw new ApiError("Too many attempts. Please wait a few minutes and try again.", 429);
}
export function secret() {
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) throw new ApiError("Admin access needs an ADMIN_PASSWORD environment variable of at least 12 characters.", 503);
  return process.env.ADMIN_PASSWORD;
}
function hmac(value: string) { return createHmac("sha256", secret()).update(value).digest("hex"); }
export function equal(a: string, b: string) { return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest()); }
export function sessionToken() {
  const value = `${Date.now() + 8 * 60 * 60 * 1000}.${randomBytes(24).toString("hex")}`;
  return `${value}.${hmac(value)}`;
}
export function requireAdmin(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith("santa_admin="))?.slice(12);
  if (!token) throw new ApiError("Please sign in to the admin page.", 401);
  const parts = token.split(".");
  if (parts.length !== 3 || !Number.isFinite(Number(parts[0])) || Number(parts[0]) < Date.now() || !equal(parts[2], hmac(`${parts[0]}.${parts[1]}`))) throw new ApiError("Your admin session has expired. Please sign in again.", 401);
}
export function sessionCookie(request: Request, token: string, clear = false) {
  const secure = process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:";
  return `santa_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear ? 0 : 28800}${secure ? "; Secure" : ""}`;
}
export function errorResponse(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  // Do not log connection strings, participant data or supplied passwords.
  console.error("Secret Santa request failed", error instanceof Error ? error.name : "Unknown error");
  return json({ error: "Something went wrong while saving. Please try again in a moment." }, 503);
}
