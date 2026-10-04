"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, Copy, Download, Eye, EyeOff, Gift, LockKeyhole, LogOut, Plus, RefreshCw, Search, ShieldCheck, Shuffle, SlidersHorizontal, Sparkles, Trash2, Users, X } from "lucide-react";
import { Footer, Header } from "../../components/site";
import { LinkPreview } from "../../components/link-preview";
import { api, downloadCsv, initials, RequestError } from "../../lib/client";
import type { Exchange, Participant, Rule } from "../../lib/exchange";

type Tab = "people" | "rules" | "draw";
type ConfirmAction = { title: string; description: string; label: string; action: () => Promise<void> };
export default function Admin() {
  const [state, setState] = useState<Exchange | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<Tab>("people");
  const [search, setSearch] = useState("");
  const [giver, setGiver] = useState("");
  const [recipient, setRecipient] = useState("");
  const [ruleType, setRuleType] = useState<"must" | "cant">("cant");
  const [bothDirections, setBothDirections] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [showPairings, setShowPairings] = useState(false);
  const [copied, setCopied] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!confirm) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]'));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trapFocus);
    return () => { document.removeEventListener("keydown", trapFocus); previous?.focus(); };
  }, [confirm]);
  const reportError = useCallback((e: unknown) => {
    if (e instanceof RequestError && e.status === 401) setState(null);
    setError((e as Error).message);
  }, []);
  const refresh = useCallback(async () => {
    setError("");
    try { setState(await api<Exchange>("/api/admin")); }
    catch (e) { if (!(e instanceof RequestError && e.status === 401)) reportError(e); }
    finally { setLoading(false); }
  }, [reportError]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (!notice) return; const timeout = setTimeout(() => setNotice(""), 5000); return () => clearTimeout(timeout); }, [notice]);
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api("/api/admin/login", { password }); setPassword(""); setState(await api<Exchange>("/api/admin")); }
    catch (e) { reportError(e); }
    finally { setBusy(false); }
  }
  async function mutate(data: Record<string, unknown>, message: string) {
    setBusy(true); setError("");
    try { setState(await api<Exchange>("/api/admin", data)); setNotice(message); }
    catch (e) { reportError(e); throw e; }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError("");
    try { await api("/api/admin/logout", {}); setState(null); setShowPairings(false); }
    catch (e) { reportError(e); }
    finally { setBusy(false); }
  }
  async function addRule(event: FormEvent) {
    event.preventDefault(); if (!state) return;
    const rules = [...state.rules, { id: "", giver, recipient, type: ruleType }];
    if (bothDirections) rules.push({ id: "", giver: recipient, recipient: giver, type: ruleType });
    try { await mutate({ action: "rules", rules }, "Pairing rule saved."); setGiver(""); setRecipient(""); }
    catch { /* Visible error comes from mutate. */ }
  }
  function person(id: string): Participant | undefined { return state?.participants.find(p => p.id === id); }
  function draw() {
    if (!state) return;
    setConfirm({ title: "Create pairings?", description: `This will create ${state.participants.length} secret pairings using your saved rules and close signups. You can reopen the exchange later, which will invalidate all reveal links.`, label: "Draw the names", action: async () => { await mutate({ action: "draw", expectedRules: state.rules }, "Pairings created."); setTab("draw"); } });
  }
  function reopen() {
    setConfirm({ title: "Reopen this exchange?", description: "This deletes the current pairings and invalidates every existing reveal link. Participants and rules stay saved. Only do this if you’re ready to organise a new draw.", label: "Reopen exchange", action: async () => { await mutate({ action: "reopen" }, "Exchange reopened. The old reveal links are no longer valid."); setShowPairings(false); } });
  }
  async function copy(value: string, id: string) {
    try { await navigator.clipboard.writeText(value); setCopied(id); setTimeout(() => setCopied(""), 2500); }
    catch { setError("Your browser couldn’t copy the link. Open the reveal link and copy its address instead."); }
  }
  function exportPeople() {
    if (!state) return;
    downloadCsv("secret-santa-signups.csv", [["Name", "Email", "Wishlist", "Notes", "Signed up"], ...state.participants.map(p => [p.name, p.email, p.wishes.map(w => `${w.idea}${w.link ? ` (${w.link})` : ""}`).join("; "), p.notes, p.joinedAt])]);
  }
  function exportDraw() {
    if (!state) return;
    downloadCsv("secret-santa-private-reveal-links.csv", [["Giver", "Email", "Recipient", "Private reveal link"], ...state.allocations.map(a => [person(a.giver)!.name, person(a.giver)!.email, person(a.recipient)!.name, `${window.location.origin}/reveal/${a.token}`])]);
  }
  const visiblePeople = state?.participants.filter(p => `${p.name} ${p.email}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <><Header admin/>{loading ? <main className="loading-main"><Sparkles className="loading-spark"/><p>Loading…</p></main> : !state ? <main className="login-main family-login"><section className="panel login-panel"><span className="login-icon"><LockKeyhole size={26} strokeWidth={1.5}/></span><h1>Admin access</h1><form onSubmit={login}><label className="field">Admin password<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required maxLength={1024}/><button type="button" className="icon-button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>{error && <p className="error-message" role="alert">{error}</p>}<button type="submit" className="button primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={17}/></button></form></section></main> : <main className="admin-main">
    <div className="admin-title"><div><h1>Secret Santa admin</h1></div><div className="admin-title-actions"><button className="button secondary small-button" onClick={() => refresh()} disabled={busy} aria-label="Refresh responses"><RefreshCw size={15}/></button><button className="button secondary small-button" onClick={logout} disabled={busy}><LogOut size={14}/> Sign out</button></div></div>
    <div className="stats-grid"><div className="stat-card"><span className="stat-icon"><Users size={20}/></span><div><span>PARTICIPANTS</span><strong>{state.participants.length} <small>people</small></strong></div></div><div className="stat-card"><span className="stat-icon coral"><Gift size={20}/></span><div><span>BUDGET</span><strong>$150 <small>gift budget</small></strong></div></div><div className="stat-card"><span className="stat-icon gold"><SlidersHorizontal size={20}/></span><div><span>PAIRING RULES</span><strong>{state.rules.length} <small>pairing rules</small></strong></div></div><div className="stat-card"><span className="stat-icon"><Sparkles size={20}/></span><div><span>STATUS</span><strong className="status-stat"><i className={`status-dot ${state.closed ? "closed" : ""}`}/>{state.closed ? "Names drawn" : "Signups open"}</strong></div></div></div>
    <div className="admin-tabs" role="tablist" aria-label="Exchange management"><button role="tab" aria-selected={tab === "people"} aria-controls="people-panel" className={tab === "people" ? "selected" : ""} onClick={() => { setTab("people"); setError(""); }}><Users size={16}/> Participants <span>{state.participants.length}</span></button><button role="tab" aria-selected={tab === "rules"} aria-controls="rules-panel" className={tab === "rules" ? "selected" : ""} onClick={() => { setTab("rules"); setError(""); }}><SlidersHorizontal size={16}/> Pairing rules</button><button role="tab" aria-selected={tab === "draw"} aria-controls="draw-panel" className={tab === "draw" ? "selected" : ""} onClick={() => { setTab("draw"); setError(""); }}><Shuffle size={16}/> The draw{state.closed && <CheckCircle2 size={14}/>}</button></div>
    {error && <p className="error-message admin-error" role="alert">{error}</p>}
    {tab === "people" && <section className="panel admin-panel" id="people-panel" role="tabpanel"><div className="panel-heading"><div><h2>Participants</h2><p>Select a name to view their wishlist.</p></div><button className="button secondary small-button" disabled={!state.participants.length} onClick={exportPeople}><Download size={15}/> Export responses</button></div>{state.participants.length ? <><div className="participant-toolbar"><div className="search-field"><Search size={17}/><input aria-label="Search participants" placeholder="Find a person…" value={search} onChange={e => setSearch(e.target.value)}/></div><span>{visiblePeople.length} of {state.participants.length} people</span></div><div className="people-list">{visiblePeople.map((p, i) => <details className="person-row" key={p.id}><summary><span className={`avatar avatar-${i % 3}`}>{initials(p.name)}</span><div className="person-name"><strong>{p.name}</strong><span>{p.email}</span></div><span className="person-wishes">{p.wishes.length} wish{p.wishes.length !== 1 ? "es" : ""}</span><ChevronDown size={17}/></summary><div className="person-detail"><h3>Wishlist</h3>{p.wishes.map((w, index) => <div className="detail-wish" key={index}><span className="wish-number">{String(index + 1).padStart(2, "0")}</span><div><p>{w.idea}</p>{w.link && <LinkPreview url={w.link}/>}</div></div>)}{p.notes && <div className="recipient-note"><span>Notes</span><p>{p.notes}</p></div>}<div className="person-detail-footer"><small>Joined {new Date(p.joinedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</small><button className="text-danger" disabled={busy || state.closed} onClick={() => setConfirm({ title: `Remove ${p.name}?`, description: "Their signup, wishlist and any pairing rules involving them will be removed. This can’t be undone.", label: "Remove participant", action: () => mutate({ action: "delete", id: p.id }, "Participant removed.") })}><Trash2 size={13}/> Remove participant</button></div></div></details>)}{!visiblePeople.length && <div className="empty-state compact-empty"><Search size={25}/><h3>No matching participants</h3><p>Try another name or email address.</p></div>}</div></> : <div className="empty-state"><span className="empty-icon"><Users size={28} strokeWidth={1.5}/></span><h3>No signups yet</h3><p>Share the signup link with your family.</p><button className="button primary" onClick={() => copy(window.location.origin, "signup")}>{copied === "signup" ? <Check size={16}/> : <Copy size={16}/>} {copied === "signup" ? "Link copied" : "Copy signup link"}</button></div>}</section>}
    {tab === "rules" && <section id="rules-panel" role="tabpanel" className="rules-layout"><div className="panel admin-panel"><div className="panel-heading"><div><h2>Add a pairing rule</h2></div><SlidersHorizontal size={22} className="muted"/></div><div className="rule-explanation"><ShieldCheck size={19}/><p>Each rule goes from <strong>giver → recipient</strong>. Tick “both directions” to apply it the other way too. Nobody can draw themselves.</p></div>{state.closed && <div className="info-message">Names have already been drawn. Reopen the exchange to change rules.</div>}<form className="rule-form" onSubmit={addRule}><label className="field">This person<select required value={giver} onChange={e => { setGiver(e.target.value); if (e.target.value === recipient) setRecipient(""); }} disabled={busy || state.closed}><option value="">Choose a giver</option>{state.participants.map(p => <option value={p.id} key={p.id}>{p.name} · {p.email}</option>)}</select></label><div className="rule-type-options"><label className={ruleType === "cant" ? "active" : ""}><input type="radio" name="type" checked={ruleType === "cant"} onChange={() => setRuleType("cant")} disabled={state.closed}/><X size={15}/> Can’t give to</label><label className={ruleType === "must" ? "active" : ""}><input type="radio" name="type" checked={ruleType === "must"} onChange={() => setRuleType("must")} disabled={state.closed}/><Check size={15}/> Must give to</label></div><label className="field">This person<select required value={recipient} onChange={e => setRecipient(e.target.value)} disabled={busy || state.closed}><option value="">Choose a recipient</option>{state.participants.filter(p => p.id !== giver).map(p => <option value={p.id} key={p.id}>{p.name} · {p.email}</option>)}</select></label><label className="checkbox-label"><input type="checkbox" checked={bothDirections} onChange={e => setBothDirections(e.target.checked)} disabled={state.closed}/> Apply this rule in both directions</label><button className="button primary" disabled={busy || state.closed || state.participants.length < 2}><Plus size={16}/>{busy ? "Saving…" : "Save pairing rule"}</button></form></div><div className="panel admin-panel saved-rules"><div className="panel-heading"><div><h2>Saved rules <span className="count-badge">{state.rules.length}</span></h2></div></div>{state.rules.length ? <div className="rules-list">{state.rules.map(r => <div className={`saved-rule ${r.type}`} key={r.id}><span className="rule-symbol">{r.type === "must" ? <Check size={16}/> : <X size={16}/>}</span><div><strong>{person(r.giver)?.name}</strong><span>{r.type === "must" ? "must give to" : "can’t give to"}</span><strong>{person(r.recipient)?.name}</strong></div><button className="icon-button" disabled={busy || state.closed} aria-label={`Remove rule for ${person(r.giver)?.name} and ${person(r.recipient)?.name}`} onClick={() => mutate({ action: "rules", rules: state.rules.filter(rule => rule.id !== r.id) }, "Pairing rule removed.").catch(() => {})}><Trash2 size={15}/></button></div>)}</div> : <div className="empty-state compact-empty"><SlidersHorizontal size={26}/><h3>No rules added</h3><p>Pairing rules are optional.</p></div>}</div></section>}
    {tab === "draw" && <section className="panel admin-panel" id="draw-panel" role="tabpanel">{!state.closed ? <div className="draw-start"><span className="success-icon"><Shuffle size={28}/></span><h2>Create pairings</h2><p>Everyone gets one recipient. Your saved rules will apply.<br/>Signups will close after the draw.</p><button className="button primary" disabled={busy || state.participants.length < 2} onClick={draw}><Shuffle size={18}/> Draw {state.participants.length ? `${state.participants.length} ` : ""}names</button>{state.participants.length < 2 && <small>At least two people need to sign up first.</small>}</div> : <><div className="panel-heading"><div><h2>Pairings created</h2><p>Send each person their own reveal link.</p></div><span className="drawn-badge"><CheckCircle2 size={14}/> Draw complete</span></div><div className="draw-toolbar"><button className="button secondary small-button" onClick={() => setShowPairings(!showPairings)}>{showPairings ? <EyeOff size={15}/> : <Eye size={15}/>} {showPairings ? "Hide recipients" : "Show recipients"}</button><button className="button secondary small-button" onClick={exportDraw}><Download size={15}/> Export private links</button></div><div className="allocation-list">{state.allocations.map((a, i) => <div className="allocation-row" key={a.giver}><span className={`avatar avatar-${i % 3}`}>{initials(person(a.giver)!.name)}</span><div className="person-name"><strong>{person(a.giver)?.name}</strong><span>{person(a.giver)?.email}</span></div><div className="allocation-recipient">{showPairings ? <><ArrowRight size={15}/><span>{person(a.recipient)?.name}</span></> : <><LockKeyhole size={12}/><span>Hidden</span></>}</div><a className="icon-button" href={`/reveal/${a.token}`} target="_blank" rel="noopener noreferrer" aria-label={`Open reveal for ${person(a.giver)?.name}`}><ArrowUpRight size={17}/></a><button className="button secondary small-button copy-link" onClick={() => copy(`${window.location.origin}/reveal/${a.token}`, a.giver)}>{copied === a.giver ? <Check size={14}/> : <Copy size={14}/>} {copied === a.giver ? "Copied" : "Copy link"}</button></div>)}</div><div className="draw-footer"><span>Drawn {new Date(state.drawnAt!).toLocaleString("en-AU")}. Links show only the recipient’s name, wishes and notes.</span><button className="text-danger" onClick={reopen} disabled={busy}><RefreshCw size={13}/> Reopen exchange</button></div></>}</section>}
    <div className="admin-bottom-note"><LockKeyhole size={13}/><span>Share each reveal link only with its giver.</span></div>
  </main>}
  <Footer/>{notice && <div className="toast" role="status"><CheckCircle2 size={18}/>{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={15}/></button></div>}
  {confirm && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) setConfirm(null); }}><section ref={dialogRef} className="panel confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onKeyDown={e => { if (e.key === "Escape" && !busy) setConfirm(null); }}><span className="form-icon"><Gift size={25}/></span><h2 id="confirm-title">{confirm.title}</h2><p>{confirm.description}</p>{error && <p className="error-message" role="alert">{error}</p>}<div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button><button className="button primary" disabled={busy} onClick={async () => { try { await confirm.action(); setConfirm(null); } catch {} }}>{busy ? "Working…" : confirm.label}</button></div></section></div>}</>;
}
