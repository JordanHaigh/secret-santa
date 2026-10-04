import { db, json } from "../../../lib/server";
export async function GET() {
  try { await db().query("SELECT id FROM exchange_state LIMIT 1"); return json({ status: "ok" }); }
  catch { return json({ status: "unavailable" }, 503); }
}
