import { errorResponse, json, sameOrigin, sessionCookie } from "../../../../lib/server";
export async function POST(request: Request) {
  try { sameOrigin(request); return json({ success: true }, 200, { "Set-Cookie": sessionCookie(request, "", true) }); }
  catch (error) { return errorResponse(error); }
}
