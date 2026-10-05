"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gift } from "lucide-react";
import { Header } from "../components/site";
import { WishlistForm } from "../components/wishlist-form";
import { api } from "../lib/client";
export default function Home() {
  const router = useRouter();
  const [closed, setClosed] = useState(false);
  useEffect(() => { api<{ closed: boolean }>("/api/signup").then(data => setClosed(data.closed)).catch(() => {}); }, []);
  return <><Header/><main className="family-main">{closed ? <section className="signup-panel panel signup-success"><span className="success-icon"><Gift size={32}/></span><h1>Signups are closed.</h1><p>Already joined? You can still update your wishlist.</p><Link href="/account" className="button primary">Sign in</Link></section> : <WishlistForm onSave={async data => { await api("/api/signup", data); router.push("/account"); }}/>}</main></>;
}
