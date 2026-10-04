"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Link2, LoaderCircle } from "lucide-react";
import { normalizeWishlistUrl, type LinkMetadata } from "../lib/link";

const previews = new Map<string, { data: LinkMetadata | null; expires: number }>();
const pending = new Map<string, Promise<LinkMetadata | null>>();
async function loadPreview(url: string) {
  const stored = previews.get(url);
  if (stored && stored.expires > Date.now()) return stored.data;
  if (pending.has(url)) return pending.get(url)!;
  const task = fetch("/api/link-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })
    .then(async response => response.ok ? await response.json() as LinkMetadata : null)
    .catch(() => null)
    .then(data => {
      if (previews.size >= 250) previews.delete(previews.keys().next().value!);
      previews.set(url, { data, expires: Date.now() + (data ? 60 * 60 * 1000 : 60 * 1000) });
      return data;
    });
  pending.set(url, task);
  try { return await task; } finally { pending.delete(url); }
}

export function LinkPreview({ url, onLoaded }: { url: string; onLoaded?: (data: LinkMetadata) => void }) {
  const normalized = normalizeWishlistUrl(url);
  const [result, setResult] = useState<{ url: string; data: LinkMetadata | null } | null>(null);
  const [brokenImage, setBrokenImage] = useState<string | null>(null);
  const callback = useRef(onLoaded);
  callback.current = onLoaded;
  useEffect(() => {
    if (!normalized) return;
    let active = true;
    const timer = setTimeout(() => {
      loadPreview(normalized).then(data => {
        if (!active) return;
        setResult({ url: normalized, data });
        if (data) callback.current?.(data);
      });
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [normalized]);
  if (!normalized) return null;
  const hostname = new URL(normalized).hostname.replace(/^www\./, "");
  if (!result || result.url !== normalized) return <div className="link-preview-loading" role="status"><LoaderCircle size={14}/><span>Loading preview…</span></div>;
  if (!result.data) return <a className="link-preview-fallback" href={normalized} target="_blank" rel="noopener noreferrer"><Link2 size={14}/><span>{hostname}</span><ArrowUpRight size={14}/></a>;
  const data = result.data;
  return <a className="link-preview-card" href={normalized} target="_blank" rel="noopener noreferrer" aria-label={`Open ${data.title}`}>
    {data.image && brokenImage !== data.image ? <img className="link-preview-image" src={`/api/link-image?url=${encodeURIComponent(data.image)}`} alt="" loading="lazy" onError={() => setBrokenImage(data.image)}/> : <span className="link-preview-icon"><Link2 size={24}/></span>}
    <span className="link-preview-copy"><span className="link-preview-site">{data.siteName}</span><strong>{data.title}</strong>{data.description && <span className="link-preview-description">{data.description}</span>}<span className="link-preview-domain">{data.hostname} <ArrowUpRight size={12}/></span></span>
  </a>;
}
