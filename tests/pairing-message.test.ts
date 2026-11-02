import test from "node:test";
import assert from "node:assert/strict";
import { pairingMessage } from "../lib/pairing-message.ts";
import type { Participant } from "../lib/exchange.ts";

const giver: Participant = { id: "giver-id", name: "Alex Smith", email: "alex@example.test", wishes: [{ idea: "Giver's private wish", link: "" }], notes: "Giver's private notes", joinedAt: "2026-11-02" };
const recipient: Participant = { id: "recipient-id", name: "Sam Jones", email: "sam@example.test", wishes: [{ idea: "A board game", link: "https://example.com/game?a=1&b=2" }, { idea: "A good book", link: "" }], notes: "No food, please.\nFavourite colour: green.", joinedAt: "2026-11-02" };

test("messages include the correct recipient, every wish, optional links, notes and budget", () => {
  const message = pairingMessage(giver, recipient);
  for (const text of ["Hey Alex!", recipient.name, "$150", "separate $20 Dirty Santa joke present for Christmas Eve", ...recipient.wishes.map(w => w.idea), recipient.wishes[0].link, recipient.notes, "🎄"]) assert.ok(message.includes(text), text);
  // Only the matched recipient's wishlist is shared, without account details.
  for (const text of [giver.email, recipient.email, giver.id, recipient.id, giver.wishes[0].idea, giver.notes]) assert.ok(!message.includes(text), text);
  assert.ok(!message.includes("/reveal/"));
});
test("empty notes are omitted and names are preserved without HTML formatting", () => {
  const message = pairingMessage({ ...giver, name: "  Zoë Taylor  " }, { ...recipient, name: "李 & <Sam>", notes: "  " });
  assert.ok(message.startsWith("Hey Zoë!"));
  assert.ok(message.includes("李 & <Sam>"));
  assert.ok(!message.includes("Notes:"));
  assert.ok(!message.includes("undefined"));
});
test("long wishlists and later edits are included without truncation", () => {
  const wishes = Array.from({ length: 50 }, (_, i) => ({ idea: `Gift idea ${i + 1}`, link: `https://example.com/gift/${i + 1}` }));
  const message = pairingMessage(giver, { ...recipient, wishes });
  for (const wish of wishes) { assert.ok(message.includes(wish.idea)); assert.ok(message.includes(wish.link)); }
  const updated = pairingMessage(giver, { ...recipient, wishes: [{ idea: "A new idea", link: "" }] });
  assert.ok(updated.includes("A new idea"));
  assert.ok(!updated.includes("A board game"));
});
