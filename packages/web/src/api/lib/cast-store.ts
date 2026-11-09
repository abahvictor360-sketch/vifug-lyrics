/**
 * Where a phone and the operator's screens find each other.
 *
 * Camera and screen-cast video is peer to peer (WebRTC); the picture never
 * touches this server. What does need a go-between is the handshake: each side
 * has to hand the other a small description of itself (an "offer" / "answer"
 * and some network addresses). They are written here and polled by the other
 * end for a few seconds, then never read again.
 *
 * Every key has exactly ONE writer, so two devices can never overwrite each
 * other, and a read is always safe. On the Bun / desktop server it lives in
 * memory; on serverless it goes through the same database rows the live
 * channels use, for the reason given in channel-store.ts.
 */
import { like, lt, eq } from "drizzle-orm";
import { isServerlessRuntime } from "./runtime";

/** The database is only touched on serverless, so the in-memory path (and its tests) never load it. */
async function store() {
  const [{ db }, schema] = await Promise.all([import("../database"), import("../database/schema")]);
  return { db, schema };
}

/** A handshake is over in seconds; anything older is a past session. */
const TTL_MS = 30 * 60 * 1000;
const MAX_BYTES = 64 * 1024;

type Entry = { payload: unknown; at: number };
const mem = new Map<string, Entry>();

export const ROOM_RE = /^[a-z0-9]{6,16}$/;
/** hello:<id> a screen asking for the picture, p:<id> sender -> screen, v:<id> screen -> sender, sender: presence. */
export const KEY_RE = /^(?:(?:hello|p|v):[a-z0-9]{4,24}|sender)$/;

const idOf = (room: string, key: string) => `cast:${room}:${key}`;

function sweep() {
  const cutoff = Date.now() - TTL_MS;
  for (const [k, v] of mem) if (v.at < cutoff) mem.delete(k);
}

export async function castPut(room: string, key: string, payload: unknown): Promise<boolean> {
  const text = JSON.stringify(payload ?? null);
  if (text.length > MAX_BYTES) return false;
  const id = idOf(room, key);
  if (!isServerlessRuntime()) {
    sweep();
    mem.set(id, { payload, at: Date.now() });
    return true;
  }
  const { db, schema } = await store();
  const now = new Date().toISOString();
  const updated = await db
    .update(schema.channelState)
    .set({ payload: text, updatedAt: now })
    .where(eq(schema.channelState.id, id));
  if (!updated.rowsAffected) {
    await db.insert(schema.channelState).values({ id, payload: text, rev: 0, updatedAt: now });
    // Opportunistic cleanup, like the remote-command queue's.
    try {
      await db
        .delete(schema.channelState)
        .where(lt(schema.channelState.updatedAt, new Date(Date.now() - TTL_MS).toISOString()));
    } catch {
      /* best effort */
    }
  }
  return true;
}

export async function castGet(room: string, key: string): Promise<{ payload: unknown; at: number } | null> {
  const id = idOf(room, key);
  if (!isServerlessRuntime()) {
    const e = mem.get(id);
    return e && e.at > Date.now() - TTL_MS ? e : null;
  }
  const { db, schema } = await store();
  const [row] = await db.select().from(schema.channelState).where(eq(schema.channelState.id, id));
  if (!row) return null;
  const at = Date.parse(row.updatedAt);
  if (at < Date.now() - TTL_MS) return null;
  try {
    return { payload: JSON.parse(row.payload), at };
  } catch {
    return null;
  }
}

/** Entries whose key starts with `prefix`, e.g. every screen currently asking for the picture. */
export async function castList(room: string, prefix: string): Promise<{ key: string; at: number; payload: unknown }[]> {
  const base = idOf(room, "");
  if (!isServerlessRuntime()) {
    sweep();
    const out: { key: string; at: number; payload: unknown }[] = [];
    for (const [id, e] of mem) if (id.startsWith(base + prefix)) out.push({ key: id.slice(base.length), at: e.at, payload: e.payload });
    return out;
  }
  const { db, schema } = await store();
  const rows = await db
    .select()
    .from(schema.channelState)
    .where(like(schema.channelState.id, `${base}${prefix}%`));
  const out: { key: string; at: number; payload: unknown }[] = [];
  for (const r of rows) {
    const at = Date.parse(r.updatedAt);
    if (at < Date.now() - TTL_MS) continue;
    try {
      out.push({ key: r.id.slice(base.length), at, payload: JSON.parse(r.payload) });
    } catch {
      /* skip */
    }
  }
  return out;
}
