"use client";
import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { Footer, Header } from "../../../components/site";
import { LinkPreview } from "../../../components/link-preview";
import { api } from "../../../lib/client";
import type { Wish } from "../../../lib/exchange";

type RevealData = { giver: string; recipient: { name: string; wishes: Wish[]; notes: string } };
export function Reveal({ token }: { token: string }) {
  const [data, setData] = useState<RevealData | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { let active = true; api<RevealData>(`/api/reveal/${token}`).then(result => { if (active) setData(result); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [token]);
  return <><Header/><main className="reveal-main">{error ? <div className="panel reveal-card"><h1>Link unavailable</h1><p role="alert">{error}</p><a href="/" className="button primary">Back to the exchange</a></div> : !data ? <p className="muted" role="status">Loading…</p> : !open ? <div className="panel reveal-card"><span className="success-icon"><Gift size={28}/></span><h1>Hi, {data.giver.split(" ")[0]}.</h1><button className="button primary" onClick={() => setOpen(true)}><Gift size={18}/> Reveal my recipient</button><small>Keep this link private.</small></div> : <div className="panel reveal-card opened"><span className="success-icon"><Gift size={28}/></span><p className="overline">YOU’RE SECRET SANTA FOR</p><h1>{data.recipient.name}</h1><span className="budget-pill">$150 gift budget</span><div className="reveal-wishlist"><h2>Wishlist</h2>{data.recipient.wishes.map((wish, i) => <div className="reveal-wish" key={i}><span className="wish-number">{String(i + 1).padStart(2, "0")}</span><div><p>{wish.idea}</p>{wish.link && <LinkPreview url={wish.link}/>}</div></div>)}{data.recipient.notes && <div className="recipient-note"><span>Notes</span><p>{data.recipient.notes}</p></div>}</div></div>}</main><Footer/></>;
}
