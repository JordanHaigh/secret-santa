import { db, errorResponse, json, sameOrigin } from "../../../../lib/server";
import { memberCookie, memberToken, tokenHash } from "../../../../lib/member";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await db().query("DELETE FROM member_sessions WHERE token_hash = $1", [tokenHash(memberToken(request))]);
    return json({ success: true }, 200, { "Set-Cookie": memberCookie(request, "", false, true) });
  } catch (error) { return errorResponse(error); }
}
