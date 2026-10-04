import { ApiError, body, equal, errorResponse, json, limited, sameOrigin, secret, sessionCookie, sessionToken } from "../../../../lib/server";
export async function POST(request: Request) {
  try {
    sameOrigin(request); await limited(request, "login", 8, 900);
    const data = await body(request);
    if (typeof data.password !== "string" || data.password.length > 1024 || !equal(data.password, secret())) throw new ApiError("That password doesn’t look right. Please try again.", 401);
    return json({ success: true }, 200, { "Set-Cookie": sessionCookie(request, sessionToken()) });
  } catch (error) { return errorResponse(error); }
}
