import { validateSignup } from "../../../lib/exchange";
import { ApiError, body, changeState, errorResponse, json, limited, loadState, sameOrigin } from "../../../lib/server";
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
    await changeState(state => {
      if (state.closed) throw new ApiError("The draw has already happened and signups are closed.", 409);
      if (state.participants.some(p => p.email === data.email)) throw new ApiError("This email address is already signed up. Contact the organiser if you need to change your wishlist.", 409);
      if (state.participants.length >= 500) throw new ApiError("This exchange has reached its limit of 500 people.", 409);
      return { ...state, participants: [...state.participants, participant] };
    });
    return json({ success: true }, 201);
  } catch (error) { return errorResponse(error); }
}
