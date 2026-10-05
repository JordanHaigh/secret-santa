"use client";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, ChevronRight, Gift, Link2, LockKeyhole, Plus, X } from "lucide-react";
import { LinkPreview } from "./link-preview";
import { normalizeWishlistUrl, type LinkMetadata } from "../lib/link";
import type { Participant, Wish } from "../lib/exchange";

type DraftWish = Wish & { showLink: boolean; id: number; autoTitle: boolean };
type Details = Pick<Participant, "name" | "email" | "wishes" | "notes">;
const blankWish = (id: number): DraftWish => ({ id, idea: "", link: "", showLink: false, autoTitle: false });
const placeholders = ["e.g. A book", "e.g. Something for a hobby", "e.g. Clothes, games or a surprise"];
export function WishlistForm({ initial, onSave }: { initial?: Participant; onSave: (data: Details) => Promise<void> }) {
  const [wishes, setWishes] = useState<DraftWish[]>(initial ? initial.wishes.map((w, i) => ({ ...w, id: i + 1, showLink: !!w.link, autoTitle: false })) : [blankWish(1), blankWish(2), blankWish(3)]);
  const nextId = useRef((initial?.wishes.length ?? 3) + 1);
  const [notes, setNotes] = useState(!!initial?.notes);
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [note, setNote] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function updateWish(id: number, change: Partial<DraftWish>) { setWishes(old => old.map(w => w.id === id ? { ...w, ...change } : w)); }
  function previewLoaded(id: number, link: string, data: LinkMetadata) {
    setWishes(old => old.map(w => w.id === id && w.link === link && (w.autoTitle || !w.idea.trim()) ? { ...w, idea: data.title, autoTitle: false } : w));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { await onSave({ name, email, notes: note, wishes: wishes.map(({ idea, link }) => ({ idea, link })) }); if (initial) setNotice("Wishlist saved."); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function addWish() { const wish = blankWish(nextId.current++); setWishes(old => [...old, wish]); }
  return <section className="signup-panel panel" aria-labelledby="wishlist-title">
    <div className="form-heading"><h1 id="wishlist-title">{initial ? "My wishlist" : "Sign up"}</h1><span className="budget-pill"><Gift size={15}/> $150 gift budget</span></div>
    <p className="form-intro">{initial ? "Update your gift ideas whenever you like." : "Add your details and at least one gift idea."}</p>
    <form onSubmit={submit}>
        <div className="field-grid"><label className="field">Your name <span>*</span><input name="name" autoComplete="name" placeholder="First and last name" maxLength={100} value={name} onChange={e => setName(e.target.value)} required/></label><label className="field">Email address <span>*</span><input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} value={email} readOnly={!!initial} onChange={e => setEmail(e.target.value)} required/></label></div>
        <div className="wishlist-heading"><h2>Gift ideas</h2><span>Links are optional</span></div>
        <div className="wish-list">{wishes.map((wish, i) => <div className="wish-field" key={wish.id}>
          <div className="wish-top"><label htmlFor={`wish-${wish.id}`}><span className="wish-number">{String(i + 1).padStart(2, "0")}</span><span>Gift idea {i + 1}{i === 0 && <span className="required"> *</span>}</span></label><div className="wish-actions"><button type="button" className={`link-button ${wish.showLink ? "active" : ""}`} onClick={() => updateWish(wish.id, { showLink: !wish.showLink, ...wish.showLink ? { link: "" } : {} })}><Link2 size={13}/>{wish.showLink ? "Remove link" : "Add a link"}</button>{wishes.length > 1 && <button className="icon-button" type="button" aria-label={`Remove gift idea ${i + 1}`} onClick={() => setWishes(old => old.filter(w => w.id !== wish.id))}><X size={14}/></button>}</div></div>
          <input id={`wish-${wish.id}`} name={`idea-${wish.id}`} placeholder={placeholders[i] ?? "Another gift idea"} value={wish.idea} onChange={e => updateWish(wish.id, { idea: e.target.value, autoTitle: false })} onPaste={e => {
            const link = normalizeWishlistUrl(e.clipboardData.getData("text"));
            if (link) { e.preventDefault(); updateWish(wish.id, { link, showLink: true, idea: `Gift from ${new URL(link).hostname.replace(/^www\./, "")}`.slice(0, 200), autoTitle: true }); }
          }} maxLength={200} required={i === 0}/>
          {wish.showLink && <div className="url-field"><Link2 size={15}/><input aria-label={`Link for gift idea ${i + 1}`} type="url" placeholder="https://…" value={wish.link} onChange={e => updateWish(wish.id, { link: e.target.value })} onPaste={e => {
            const link = normalizeWishlistUrl(e.clipboardData.getData("text"));
            if (link) { e.preventDefault(); updateWish(wish.id, { link }); }
          }} maxLength={1000}/></div>}
          {wish.link && <LinkPreview url={wish.link} onLoaded={data => previewLoaded(wish.id, wish.link, data)}/>}
        </div>)}</div>
        <button className="add-idea" type="button" disabled={wishes.length >= 50} onClick={addWish}><Plus size={15}/> Add another idea</button>
        <div className="notes-wrap"><button className="notes-toggle" type="button" aria-expanded={notes} onClick={() => setNotes(!notes)}><ChevronRight size={15} className={notes ? "rotated" : ""}/>Notes for your Santa <span>Optional</span></button>{notes && <textarea aria-label="Additional notes for your Santa" name="notes" placeholder="Sizes, preferences, allergies, or things to avoid" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} rows={3}/>}</div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="account-notice" role="status"><Check size={16}/>{notice}</p>}
      <button className="button primary signup-submit" type="submit" disabled={busy}>{busy ? "Saving…" : initial ? "Save wishlist" : "Create account"}{!busy && <ArrowRight size={17}/>}</button>
      <p className="privacy-note"><LockKeyhole size={12}/> Only your Santa and the admin can see your wishlist.</p>
    </form>
  </section>;
}
