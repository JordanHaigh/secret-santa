"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, MessageSquare } from "lucide-react";

export function PairingMessage({ name, message }: { name: string; message: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);
  useEffect(() => {
    if (manualCopy && open) { textarea.current?.focus(); textarea.current?.select(); }
  }, [manualCopy, open]);
  async function copyMessage() {
    try { await navigator.clipboard.writeText(message); setCopied(true); setManualCopy(false); }
    catch { setOpen(true); setManualCopy(true); }
  }
  return <div className="pairing-message">
    <div className="pairing-message-actions">
      <button className="button secondary small-button" onClick={copyMessage} aria-label={`Copy message for ${name}`}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Message copied" : "Copy message"}</button>
      <button className="link-button" aria-expanded={open} onClick={() => { setOpen(!open); setManualCopy(false); }}><MessageSquare size={14}/>{open ? "Hide message" : "Preview message"}<span className="sr-only"> for {name}</span></button>
    </div>
    {open && <textarea ref={textarea} className="pairing-message-text" aria-label={`Message for ${name}`} value={message} readOnly rows={Math.min(18, Math.max(8, message.split("\n").length))}/>}
    {manualCopy && <p className="pairing-message-help" role="status">Copy didn’t work. Select the message above and copy it manually.</p>}
    {copied && <span className="sr-only" role="status">Message for {name} copied.</span>}
  </div>;
}
