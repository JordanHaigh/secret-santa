import type { Participant } from "./exchange.ts";

export function pairingMessage(giver: Participant, recipient: Participant): string {
  const firstName = giver.name.trim().split(/\s+/)[0];
  const wishes = recipient.wishes.map(wish => `• ${wish.idea}${wish.link ? `\n  ${wish.link}` : ""}`).join("\n");
  return [
    `Hey ${firstName}! 🎄 You're Secret Santa for ${recipient.name}.`,
    "🎁 Remember, the gift budget is $150.",
    "Also bring a separate $20 Dirty Santa joke present for Christmas Eve.",
    `Their wishlist:\n${wishes}`,
    ...(recipient.notes.trim() ? [`Notes: ${recipient.notes}`] : []),
    "Keep it a secret! 🤫",
  ].join("\n\n");
}
