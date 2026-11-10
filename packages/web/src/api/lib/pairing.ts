/**
 * Per-browser pairing for the phone remote on the shared, hosted app.
 *
 * The hosted app has one database for everybody, so a single remote PIN kept
 * in it would let anyone who knew (or read) it drive anyone's service. Instead
 * every browser invents its own pairing code, keeps it to itself, and tells the
 * server only a one-way hash of it. A phone that types the code can then be
 * recognised as "paired to that browser" - and its commands are delivered to
 * that browser alone (see the room filter in index.ts), never to others.
 *
 * Nothing secret is stored: a hash cannot be turned back into the code.
 */
import { createHash } from "node:crypto";
import { isServerlessRuntime } from "./runtime";

/** On when hosted; PER_BROWSER_SECRETS=1 / 0 forces it on or off (for trying it out). */
export function perBrowserSecrets(): boolean {
  const forced = process.env.PER_BROWSER_SECRETS;
  if (forced === "1") return true;
  if (forced === "0") return false;
  return isServerlessRuntime();
}

export const CODE_RE = /^\d{6}$/;
export const roomOf = (code: string) => createHash("sha256").update(`vifug-room:${code}`).digest("hex");

const TTL_MS = 30 * 24 * 3600 * 1000;
const mem = new Map<string, number>();

async function store() {
  const [{ db }, schema, { eq }] = await Promise.all([import("../database"), import("../database/schema"), import("drizzle-orm")]);
  return { db, schema, eq };
}

/** Remember that a code (by its hash) exists. Called by the browser that owns it, each time it opens. */
export async function registerRoom(room: string): Promise<void> {
  const now = Date.now();
  if (!isServerlessRuntime()) {
    mem.set(room, now);
    return;
  }
  const { db, schema, eq } = await store();
  const id = `pair:${room}`;
  const updatedAt = new Date(now).toISOString();
  const updated = await db.update(schema.channelState).set({ payload: "{}", updatedAt }).where(eq(schema.channelState.id, id));
  if (!updated.rowsAffected) await db.insert(schema.channelState).values({ id, payload: "{}", rev: 0, updatedAt });
}

export async function roomRegistered(room: string): Promise<boolean> {
  if (!isServerlessRuntime()) {
    const at = mem.get(room);
    return at !== undefined && Date.now() - at < TTL_MS;
  }
  const { db, schema, eq } = await store();
  const [row] = await db.select().from(schema.channelState).where(eq(schema.channelState.id, `pair:${room}`));
  return !!row && Date.now() - Date.parse(row.updatedAt) < TTL_MS;
}

/** Remove secrets from a settings blob before it is shown to, or accepted from, a browser. */
export function stripSecrets(config: Record<string, unknown>): { config: Record<string, unknown>; changed: boolean } {
  let changed = false;
  const out = { ...config };
  if ("deepgramApiKey" in out) {
    delete out.deepgramApiKey;
    changed = true;
  }
  const remote = out.remote as { requirePin?: boolean; pin?: string | null } | undefined;
  if (remote && typeof remote === "object" && "pin" in remote) {
    out.remote = { requirePin: true };
    changed = true;
  }
  return { config: out, changed };
}
