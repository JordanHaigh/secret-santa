import { getLinkMetadata } from "../../../lib/link-preview";
import { ApiError, body, errorResponse, json, limited, sameOrigin } from "../../../lib/server";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = await body(request);
    if (typeof input.url !== "string" || input.url.length > 1000) throw new ApiError("Please enter a valid web link.");
    await limited(request, "link-preview", 120, 600);
    try { return json(await getLinkMetadata(input.url)); }
    catch { return json({ error: "Preview unavailable. You can still use this link." }, 422); }
  } catch (error) { return errorResponse(error); }
}
