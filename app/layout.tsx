import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { sharingMetadata, siteOrigin } from "../lib/metadata";
import "./globals.css";
export async function generateMetadata(): Promise<Metadata> {
  // Coolify supplies APP_URL when the container starts, after the image is built.
  await connection();
  return {
    ...sharingMetadata(siteOrigin()),
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: { title: "Secret Santa" },
  };
}
export const viewport: Viewport = { themeColor: "#365642", colorScheme: "light" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
