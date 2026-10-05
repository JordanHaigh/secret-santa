import { validateSignup } from "../../../lib/exchange";
import { ApiError, body, changeState, errorResponse, json, limited, loadState, sameOrigin } from "../../../lib/server";
import { defaultPassword, hashPassword } from "../../../lib/password";
import { createMemberSession, memberCookie } from "../../../lib/member";
export const runtime = "nodejs";
export async function GET() {
  try { const { state } = await loadState(); return json({ closed: state.closed, count: state.participants.length }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request); await limited(request, "signup", 20, 600);
    const input = await body(request);
    let data;
    try { data = validateSignup(input); } catch (error) { throw new ApiError((error as Error).message); }
    const participant = { ...data, id: crypto.randomUUID(), joinedAt: new Date().toISOString() };
    const passwordHash = await hashPassword(defaultPassword);
    let token = "";
    await changeState(state => {
      if (state.closed) throw new ApiError("The draw has already happened and signups are closed.", 409);
      if (state.participants.some(p => p.email === data.email)) throw new ApiError("This email address is already signed up. Sign in to update your wishlist.", 409);
      if (state.participants.length >= 500) throw new ApiError("This exchange has reached its limit of 500 people.", 409);
      return { ...state, participants: [...state.participants, participant] };
    }, async client => {
      await client.query("INSERT INTO member_accounts (participant_id, email, password_hash) VALUES ($1, $2, $3)", [participant.id, participant.email, passwordHash]);
      token = await createMemberSession(client, participant.id, true);
    });
    return json({ success: true, mustChangePassword: true }, 201, { "Set-Cookie": memberCookie(request, token, true) });
  } catch (error) { return errorResponse(error); }
}
