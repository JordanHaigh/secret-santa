import Link from "next/link";
import { Gift, LockKeyhole } from "lucide-react";

export function Header({ admin = false }: { admin?: boolean }) {
  return <header className="site-header family-header"><Link href="/" className="brand" aria-label="Family Secret Santa home"><span className="brand-mark"><Gift size={23} strokeWidth={1.5} /></span><span>Family Secret Santa</span></Link><nav><Link href="/account" className="account-link">My wishlist</Link><Link href={admin ? "/" : "/admin"} className="admin-link">{admin ? <Gift size={14}/> : <LockKeyhole size={14}/>} {admin ? "Sign up" : "Admin"}</Link></nav></header>;
}
export function Footer() { return null; }
