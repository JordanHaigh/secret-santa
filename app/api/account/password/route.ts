import { ApiError, body, db, errorResponse, json, limited, sameOrigin } from "../../../../lib/server";
import { createMemberSession, memberCookie, requireMember } from "../../../../lib/member";
import { hashPassword, validNewPassword, verifyPassword } from "../../../../lib/password";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request); await limited(request, "member-password", 8, 900);
    const member = await requireMember(request, true);
    const data = await body(request);
    if (typeof data.currentPassword !== "string" || data.currentPassword.length > 128) throw new ApiError("Enter your current password.");
    if (!validNewPassword(data.password)) throw new ApiError("Choose a new password between 12 and 128 characters. You cannot keep change-me.");
    const client = await db().connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT * FROM member_accounts WHERE participant_id = $1 FOR UPDATE", [member.participant_id]);
      const account = result.rows[0];
      const session = await client.query("SELECT token_hash FROM member_sessions WHERE token_hash = $1 AND expires_at > NOW()", [member.token_hash]);
      if (!account || !session.rowCount) throw new ApiError("Your session has expired. Please sign in again.", 401);
      if (!await verifyPassword(data.currentPassword, account.password_hash)) throw new ApiError("Your current password is incorrect.", 401);
      if (data.password === data.currentPassword) throw new ApiError("Choose a different password.");
      await client.query("UPDATE member_accounts SET password_hash = $1, must_change_password = FALSE WHERE participant_id = $2", [await hashPassword(data.password), member.participant_id]);
      await client.query("DELETE FROM member_sessions WHERE participant_id = $1", [member.participant_id]);
      const token = await createMemberSession(client, member.participant_id, false);
      await client.query("COMMIT");
      return json({ success: true }, 200, { "Set-Cookie": memberCookie(request, token) });
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  } catch (error) { return errorResponse(error); }
}
