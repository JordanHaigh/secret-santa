export type Wish = { idea: string; link: string };
export type Participant = { id: string; name: string; email: string; wishes: Wish[]; notes: string; joinedAt: string };
export type Rule = { id: string; giver: string; recipient: string; type: "must" | "cant" };
export type Allocation = { giver: string; recipient: string; token: string };
export type Exchange = { participants: Participant[]; rules: Rule[]; allocations: Allocation[]; closed: boolean; drawnAt: string | null };
export const emptyExchange = (): Exchange => ({ participants: [], rules: [], allocations: [], closed: false, drawnAt: null });

export function validateRules(ids: string[], rules: Rule[]) {
  const validIds = new Set(ids);
  const forcedGivers = new Map<string, string>();
  const forcedRecipients = new Map<string, string>();
  const banned = new Set(rules.filter(r => r.type === "cant").map(r => `${r.giver}:${r.recipient}`));
  const unique = new Set<string>();
  for (const r of rules) {
    if (!validIds.has(r.giver) || !validIds.has(r.recipient)) throw new Error("A person in this rule is no longer signed up.");
    if (r.giver === r.recipient) throw new Error("People can’t be paired with themselves.");
    if (r.type !== "must" && r.type !== "cant") throw new Error("Choose a valid pairing rule.");
    const key = `${r.type}:${r.giver}:${r.recipient}`;
    if (unique.has(key)) throw new Error("That pairing rule already exists.");
    unique.add(key);
    if (r.type === "must") {
      if (banned.has(`${r.giver}:${r.recipient}`)) throw new Error("A pairing can’t be both required and excluded. Remove one of these rules.");
      if (forcedGivers.has(r.giver) && forcedGivers.get(r.giver) !== r.recipient) throw new Error("One giver has two required recipients. Each person can only give to one person.");
      if (forcedRecipients.has(r.recipient) && forcedRecipients.get(r.recipient) !== r.giver) throw new Error("Two givers have the same required recipient. Each person can only receive one gift.");
      forcedGivers.set(r.giver, r.recipient);
      forcedRecipients.set(r.recipient, r.giver);
    }
  }
}
function randomInt(max: number) {
  const range = 0x100000000;
  const cutoff = range - (range % max);
  const bytes = new Uint32Array(1);
  do { crypto.getRandomValues(bytes); } while (bytes[0] >= cutoff);
  return bytes[0] % max;
}
function shuffle<T>(input: T[]): T[] {
  const result = [...input];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
// Randomised bipartite matching finds a valid draw without factorial search.
// Randomness breaks ties; draws are not guaranteed to be uniformly distributed.
export function createPairings(ids: string[], rules: Rule[]): { giver: string; recipient: string }[] {
  if (ids.length < 2) throw new Error("At least two people need to sign up before you can draw names.");
  validateRules(ids, rules);
  const required = new Map(rules.filter(r => r.type === "must").map(r => [r.giver, r.recipient]));
  const reserved = new Set(required.values());
  const excluded = new Set(rules.filter(r => r.type === "cant").map(r => `${r.giver}:${r.recipient}`));
  const candidates = new Map(ids.filter(id => !required.has(id)).map(id => [id, shuffle(ids.filter(to => to !== id && !reserved.has(to) && !excluded.has(`${id}:${to}`)))]));
  const recipientToGiver = new Map<string, string>();
  function assign(giver: string, visited: Set<string>): boolean {
    for (const recipient of candidates.get(giver) ?? []) {
      if (visited.has(recipient)) continue;
      visited.add(recipient);
      const previous = recipientToGiver.get(recipient);
      if (!previous || assign(previous, visited)) { recipientToGiver.set(recipient, giver); return true; }
    }
    return false;
  }
  for (const giver of shuffle([...candidates.keys()])) {
    if (!assign(giver, new Set())) throw new Error("These rules leave no possible draw. Relax an exclusion or change a required pairing, then try again.");
  }
  return [...required].map(([giver, recipient]) => ({ giver, recipient })).concat([...recipientToGiver].map(([recipient, giver]) => ({ giver, recipient })));
}
export function validateSignup(input: unknown): Omit<Participant, "id" | "joinedAt"> {
  if (!input || typeof input !== "object") throw new Error("Please complete the signup form.");
  const data = input as Record<string, unknown>;
  function field(value: unknown, max: number, label: string, required = false) {
    if (typeof value !== "string") throw new Error(`Please enter a valid ${label}.`);
    const result = value.trim();
    if ((required && !result) || result.length > max) throw new Error(`Please enter ${label}${required ? " (required)" : ""} of at most ${max} characters.`);
    return result;
  }
  const name = field(data.name, 100, "name", true);
  const email = field(data.email, 254, "email address", true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email address.");
  const notes = field(data.notes ?? "", 1000, "note");
  if (!Array.isArray(data.wishes) || data.wishes.length > 50) throw new Error("Please add between 1 and 50 wishlist ideas.");
  const wishes = data.wishes.map((wish: unknown) => {
    if (!wish || typeof wish !== "object") throw new Error("Please enter a valid wishlist idea.");
    const w = wish as Record<string, unknown>;
    const idea = field(w.idea, 200, "wishlist idea");
    const link = field(w.link ?? "", 1000, "wishlist link");
    if (link) {
      let parsed: URL;
      try { parsed = new URL(link); } catch { throw new Error("Wishlist links must be full URLs, such as https://example.com/item."); }
      if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Please use an http or https wishlist link without a username or password.");
      if (!idea) throw new Error("Add a description for each linked wishlist item.");
    }
    return { idea, link };
  }).filter(w => w.idea);
  if (!wishes.length) throw new Error("Add at least one wishlist idea so your Santa has a starting point.");
  return { name, email, notes, wishes };
}
