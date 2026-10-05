import { ApiError, body, db, errorResponse, json, limited, sameOrigin } from "../../../../lib/server";
import { createMemberSession, memberCookie, tokenHash } from "../../../../lib/member";
import { verifyPassword } from "../../../../lib/password";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await limited(request, "member-login", 8, 900);
    const data = await body(request);
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || typeof data.password !== "string" || data.password.length > 128) throw new ApiError("Email or password is incorrect.", 401);
    await limited(request, `member-email-${tokenHash(email)}`, 8, 900);
    const client = await db().connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT * FROM member_accounts WHERE email = $1 FOR SHARE", [email]);
      const account = result.rows[0];
      // Unknown emails still perform the same password derivation.
      const dummy = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;
      const valid = await verifyPassword(data.password, account?.password_hash ?? dummy);
      if (!account || !valid) throw new ApiError("Email or password is incorrect.", 401);
      const setup = account.must_change_password;
      const token = await createMemberSession(client, account.participant_id, setup);
      await client.query("COMMIT");
      return json({ mustChangePassword: setup }, 200, { "Set-Cookie": memberCookie(request, token, setup) });
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  } catch (error) { return errorResponse(error); }
}
