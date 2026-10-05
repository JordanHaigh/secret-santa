import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Set it to your Coolify PostgreSQL internal connection URL.");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  await client.query("SELECT pg_advisory_lock(726843190)");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  const directory = fileURLToPath(new URL("../migrations/", import.meta.url));
  for (const name of (await readdir(directory)).filter(name => name.endsWith(".sql")).sort()) {
    if ((await client.query("SELECT name FROM schema_migrations WHERE name = $1", [name])).rowCount) continue;
    await client.query("BEGIN");
    try {
      await client.query(await readFile(`${directory}/${name}`, "utf8"));
      if (name === "002_member_accounts.sql") {
        // Give each existing submission its own salted default-password hash.
        const rows = await client.query("SELECT value FROM exchange_state WHERE id = 'exchange' FOR UPDATE");
        for (const participant of rows.rows[0]?.value.participants ?? []) {
          const salt = randomBytes(16).toString("hex");
          const key = await derive("change-me", salt, 64);
          await client.query("INSERT INTO member_accounts (participant_id, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [participant.id, participant.email.toLowerCase(), `scrypt$${salt}$${key.toString("hex")}`]);
        }
      }
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log(`Applied migration ${name}`);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
  await client.query("SELECT pg_advisory_unlock(726843190)");
  console.log("Database migrations complete.");
} catch (error) {
  console.error("Database migration failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
} finally { await client.end(); }
