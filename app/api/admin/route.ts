import { randomBytes } from "node:crypto";
import { createPairings, validateRules, type Rule } from "../../../lib/exchange";
import { ApiError, body, changeState, errorResponse, json, loadState, requireAdmin, sameOrigin } from "../../../lib/server";
export async function GET(request: Request) {
  try { requireAdmin(request); const { state } = await loadState(); return json(state); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request); requireAdmin(request);
    const data = await body(request);
    const state = await changeState(state => {
      if (data.action === "rules") {
        if (state.closed) throw new ApiError("Reopen the exchange before changing pairing rules.", 409);
        if (!Array.isArray(data.rules) || data.rules.length > 2500 || data.rules.some((r: unknown) => !r || typeof r !== "object")) throw new ApiError("Please send a valid set of rules.");
        const rules: Rule[] = data.rules.map((r: Rule) => ({ id: crypto.randomUUID(), giver: r.giver, recipient: r.recipient, type: r.type }));
        try { validateRules(state.participants.map(p => p.id), rules); } catch (e) { throw new ApiError((e as Error).message); }
        return { ...state, rules };
      }
      if (data.action === "draw") {
        if (state.closed) throw new ApiError("Names have already been drawn. Reopen the exchange to start a new draw.", 409);
        const expected = data.expectedRules;
        if (!Array.isArray(expected) || expected.length !== state.rules.length || state.rules.some((rule, index) => !expected[index] || (["id", "giver", "recipient", "type"] as const).some(key => rule[key] !== expected[index][key]))) throw new ApiError("Pairing rules changed in another session. Refresh and review them before drawing.", 409);
        let pairings;
        try { pairings = createPairings(state.participants.map(p => p.id), state.rules); } catch (e) { throw new ApiError((e as Error).message); }
        const allocations = pairings.map(p => ({ ...p, token: randomBytes(32).toString("hex") }));
        return { ...state, allocations, closed: true, drawnAt: new Date().toISOString() };
      }
      if (data.action === "reopen") return { ...state, allocations: [], closed: false, drawnAt: null };
      if (data.action === "delete") {
        if (state.closed) throw new ApiError("Reopen the exchange before removing a participant.", 409);
        if (!state.participants.some(p => p.id === data.id)) throw new ApiError("That person is no longer signed up.", 404);
        return { ...state, participants: state.participants.filter(p => p.id !== data.id), rules: state.rules.filter(r => r.giver !== data.id && r.recipient !== data.id) };
      }
      throw new ApiError("Unknown admin action.");
    }, async (client, next) => {
      if (data.action === "delete") await client.query("DELETE FROM member_accounts WHERE NOT (participant_id = ANY($1::text[]))", [next.participants.map(p => p.id)]);
    });
    return json(state);
  } catch (error) { return errorResponse(error); }
}
