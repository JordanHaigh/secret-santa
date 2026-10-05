import { validateSignup } from "../../../lib/exchange";
import { ApiError, body, changeState, errorResponse, json, limited, loadState, sameOrigin } from "../../../lib/server";
import { requireMember } from "../../../lib/member";
export async function GET(request: Request) {
  try {
    const member = await requireMember(request, true);
    if (member.must_change_password || member.setup_only) return json({ email: member.email, mustChangePassword: true });
    const { state } = await loadState();
    const participant = state.participants.find(p => p.id === member.participant_id);
    if (!participant) throw new ApiError("This account is no longer in the exchange.", 401);
    return json({ email: member.email, mustChangePassword: false, participant });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request); await limited(request, "member-wishlist", 60, 600);
    const member = await requireMember(request);
    const input = await body(request);
    let data;
    // Email and participant identity come from the session, never from the form.
    try { data = validateSignup({ ...input, email: member.email }); }
    catch (error) { throw new ApiError((error as Error).message); }
    const next = await changeState(state => {
      if (!state.participants.some(p => p.id === member.participant_id)) throw new ApiError("This account is no longer in the exchange.", 401);
      return { ...state, participants: state.participants.map(p => p.id === member.participant_id ? { ...p, ...data } : p) };
    }, async client => {
      // Password changes or account deletion invalidate edits in flight, too.
      const active = await client.query(`SELECT s.token_hash FROM member_sessions s JOIN member_accounts a USING (participant_id) WHERE s.token_hash = $1 AND s.expires_at > NOW() AND NOT s.setup_only AND NOT a.must_change_password FOR SHARE OF a`, [member.token_hash]);
      if (!active.rowCount) throw new ApiError("Your session has expired. Please sign in again.", 401);
    });
    return json({ participant: next.participants.find(p => p.id === member.participant_id) });
  } catch (error) { return errorResponse(error); }
}
