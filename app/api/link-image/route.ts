import { fetchPublicContent, withPreviewSlot } from "../../../lib/link-preview";
import { errorResponse, limited } from "../../../lib/server";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url).searchParams.get("url");
    if (!url || url.length > 1000) return new Response(null, { status: 400 });
    await limited(request, "link-image", 150, 600);
    try {
      const image = await withPreviewSlot(() => fetchPublicContent(url, "image"));
      return new Response(new Uint8Array(image.body), { headers: {
        "Content-Type": image.headers["content-type"]!.split(";")[0],
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      } });
    } catch { return new Response(null, { status: 422 }); }
  } catch (error) { return errorResponse(error); }
}
