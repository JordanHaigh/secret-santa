import type { Metadata } from "next";

export const siteName = "Family Secret Santa";
const imageAlt = "A wrapped gift above Family Secret Santa, with a $150 gift budget.";
type Page = "home" | "admin" | "reveal" | "account";

export function siteOrigin(value = process.env.APP_URL, production = process.env.NODE_ENV === "production"): URL {
  if (!value && production) throw new Error("APP_URL must be set to your public origin for sharing metadata.");
  const url = new URL(value || "http://127.0.0.1:3000");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("APP_URL must be an HTTP or HTTPS origin, without a path, credentials, query or fragment.");
  }
  return url;
}

export function sharingMetadata(origin: URL, page: Page = "home"): Metadata {
  const title = page === "admin" ? `Admin — ${siteName}` : page === "reveal" ? `Your Secret Santa — ${siteName}` : page === "account" ? `My wishlist — ${siteName}` : siteName;
  const description = page === "admin" ? "Organise the family Secret Santa, view wishlists and draw names."
    : page === "reveal" ? "Your Secret Santa draw is ready. Open your private link to see who you're buying for."
    : page === "account" ? "Sign in to update your family Secret Santa wishlist."
    : "Join our family Secret Santa. Share your gift ideas and get ready for the draw. $150 gift budget.";
  const url = new URL(page === "admin" ? "/admin" : page === "account" ? "/account" : "/", origin).href;
  const image = new URL("/share-card.png", origin).href;
  return {
    metadataBase: origin,
    applicationName: siteName,
    title,
    description,
    // Never publish the bearer token in canonical or social metadata.
    alternates: { canonical: page === "reveal" ? null : url },
    robots: { index: page === "home", follow: page === "home" },
    openGraph: {
      type: "website",
      locale: "en_AU",
      siteName,
      title,
      description,
      url,
      images: [{ url: image, ...(origin.protocol === "https:" ? { secureUrl: image } : {}), width: 1200, height: 630, type: "image/png", alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, alt: imageAlt }],
    },
  };
}
