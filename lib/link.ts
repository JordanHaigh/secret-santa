export type LinkMetadata = {
  url: string;
  title: string;
  description: string;
  siteName: string;
  hostname: string;
  image: string | null;
};

export function normalizeWishlistUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 1000) return null;
  try {
    const url = new URL(/^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || !url.hostname) return null;
    return url.href;
  } catch { return null; }
}
