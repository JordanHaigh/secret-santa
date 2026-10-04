import { ApiError, errorResponse, json, loadState } from "../../../../lib/server";
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError("This reveal link is invalid or has expired. Please contact the organiser.", 404);
    const { state } = await loadState();
    const allocation = state.allocations.find(a => a.token === token);
    if (!allocation || !state.closed) throw new ApiError("This reveal link is invalid or has expired. Please contact the organiser.", 404);
    const recipient = state.participants.find(p => p.id === allocation.recipient)!;
    const giver = state.participants.find(p => p.id === allocation.giver)!;
    return json({ giver: giver.name, recipient: { name: recipient.name, wishes: recipient.wishes, notes: recipient.notes } });
  } catch (error) { return errorResponse(error); }
}
