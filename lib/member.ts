import { createHash, randomBytes } from "node:crypto";
import type pg from "pg";
import { ApiError, db } from "./server";

export type Member = { participant_id: string; email: string; password_hash: string; must_change_password: boolean; setup_only: boolean; token_hash: string };
export function tokenHash(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function memberToken(request: Request) {
  return request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith("santa_member="))?.slice(13) ?? "";
}
export async function requireMember(request: Request, allowSetup = false): Promise<Member> {
  const token = memberToken(request);
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError("Please sign in to your account.", 401);
  const result = await db().query<Member>(`SELECT a.*, s.setup_only, s.token_hash FROM member_accounts a JOIN member_sessions s USING (participant_id) WHERE s.token_hash = $1 AND s.expires_at > NOW()`, [tokenHash(token)]);
  const member = result.rows[0];
  if (!member) throw new ApiError("Your session has expired. Please sign in again.", 401);
  if (!allowSetup && (member.must_change_password || member.setup_only)) throw new ApiError("Choose a new password before accessing your wishlist.", 403);
  return member;
}
export function memberCookie(request: Request, token: string, setup = false, clear = false) {
  const secure = process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:";
  return `santa_member=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear ? 0 : setup ? 1200 : 604800}${secure ? "; Secure" : ""}`;
}
export async function createMemberSession(client: pg.Pool | pg.PoolClient, id: string, setup: boolean) {
  const token = randomBytes(32).toString("hex");
  await client.query("DELETE FROM member_sessions WHERE expires_at <= NOW()");
  await client.query("INSERT INTO member_sessions (token_hash, participant_id, setup_only, expires_at) VALUES ($1, $2, $3, NOW() + $4 * INTERVAL '1 second')", [tokenHash(token), id, setup, setup ? 1200 : 604800]);
  return token;
}
