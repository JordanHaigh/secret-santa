"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { LockKeyhole, LogOut } from "lucide-react";
import { Header } from "../../components/site";
import { WishlistForm } from "../../components/wishlist-form";
import { api, RequestError } from "../../lib/client";
import type { Participant } from "../../lib/exchange";

type AccountData = { email: string; mustChangePassword: boolean; participant?: Participant };
function PasswordForm({ required, onChanged }: { required: boolean; onChanged: () => Promise<void> }) {
  const [current, setCurrent] = useState(required ? "change-me" : "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSaved(false);
    if (password !== confirmation) { setError("The new passwords do not match."); return; }
    setBusy(true);
    try {
      await api("/api/account/password", { currentPassword: current, password });
      setCurrent(""); setPassword(""); setConfirmation(""); setSaved(true);
      await onChanged();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="panel account-password"><h2>{required ? "Choose your password" : "Change password"}</h2>{required && <p>Replace <strong>change-me</strong> to access your wishlist.</p>}<form onSubmit={submit}>
    {!required && <label className="field">Current password<input type="password" name="currentPassword" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} maxLength={128} required/></label>}
    <label className="field">New password<input type="password" name="newPassword" autoComplete="new-password" placeholder="At least 12 characters" minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} required/></label>
    <label className="field">Confirm new password<input type="password" name="confirmPassword" autoComplete="new-password" minLength={12} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} required/></label>
    {error && <p className="error-message" role="alert">{error}</p>}{saved && <p className="account-notice" role="status">Password changed.</p>}
    <button className="button primary" disabled={busy}>{busy ? "Saving…" : required ? "Save password and continue" : "Change password"}</button>
  </form></section>;
}
export default function Account() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    try { setAccount(await api<AccountData>("/api/account")); }
    catch (e) { setAccount(null); if (!(e instanceof RequestError && e.status === 401)) setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api("/api/account/login", { email, password }); setPassword(""); await reload(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError("");
    try { await api("/api/account/logout", {}); setAccount(null); setPassword(""); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <><Header/><main className="family-main account-main">{loading ? <p role="status">Loading…</p> : !account ? <section className="panel account-password"><span className="login-icon"><LockKeyhole size={24}/></span><h1>Sign in</h1><form onSubmit={login}>
    <label className="field">Email address<input type="email" name="email" autoComplete="username" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} required/></label>
    <label className="field">Password<input type="password" name="password" autoComplete="current-password" maxLength={128} value={password} onChange={e => setPassword(e.target.value)} required/></label>
    {error && <p className="error-message" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
  </form><p className="account-help">First time? Use <strong>change-me</strong>.</p><Link href="/" className="account-link">Create an account</Link></section> : <>
    <div className="account-toolbar"><span>{account.email}</span><button className="small-button" onClick={logout} disabled={busy}><LogOut size={14}/> Sign out</button></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {account.mustChangePassword ? <PasswordForm required onChanged={reload}/> : <>
      {account.participant && <WishlistForm key={account.participant.id} initial={account.participant} onSave={async data => {
        try { const saved = await api<{ participant: Participant }>("/api/account", data); setAccount(old => old ? { ...old, participant: saved.participant } : old); }
        catch (e) { if (e instanceof RequestError && e.status === 401) { setAccount(null); setError("Please sign in again."); } throw e; }
      }}/>}
      <PasswordForm required={false} onChanged={reload}/>
    </>}
  </>}</main></>;
}
