/**
 * The pay-for-Vifug switch.
 *
 * Nothing here asks anyone for money. It is the mechanism that lets that
 * happen later, from the server, without shipping a new app: a policy the
 * owner sets once and every copy of Vifug reads. Until it is switched on the
 * policy says "off" and nobody notices it exists.
 *
 *   off     the app behaves exactly as it always has
 *   nag     a dismissible pop-up asks for a subscription, now and then
 *   lock    the app is locked at its next start until a licence is entered
 *
 * Independently of those, `minVersion` can require an update: an install older
 * than it is locked until it is updated, which is how a paywall that only
 * exists in a newer build is made to reach everyone.
 *
 * Payment itself is a plug-in: `checkoutUrl` is wherever the buyer is sent, and
 * `verifyLicence` is the one function to replace when a provider (Stripe,
 * Paystack, Lemon Squeezy...) is chosen. Today it checks a list of licence-key
 * hashes the owner keeps in the policy.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export type EntitlementMode = "off" | "nag" | "lock";

export type EntitlementPolicy = {
  mode: EntitlementMode;
  /** Does not apply before this moment (ISO date). Lets a paywall be scheduled. */
  startsAt: string | null;
  title: string;
  message: string;
  /** Where the Subscribe button goes. Empty = no button yet. */
  checkoutUrl: string;
  /** Installs older than this are locked until updated ("1.30.0"). Empty = no minimum. */
  minVersion: string;
  /** Where to send someone who has to update. */
  updateUrl: string;
  /** nag: hours before the pop-up may appear again after it is dismissed. */
  nagEveryHours: number;
  /**
   * SHA-256 hashes of valid licence keys. Keys are never stored, so reading the
   * policy back cannot leak one. Managed by the owner, not served to clients.
   */
  keyHashes: string[];
  updatedAt: string;
};

export const DEFAULT_POLICY: EntitlementPolicy = {
  mode: "off",
  startsAt: null,
  title: "Subscribe to keep using Vifug",
  message: "Vifug is moving to a paid plan. Subscribe to carry on.",
  checkoutUrl: "",
  minVersion: "",
  updateUrl: "https://vifug.com/download.html",
  nagEveryHours: 24,
  keyHashes: [],
  updatedAt: "",
};

export const hashKey = (key: string) =>
  createHash("sha256").update(key.trim().toUpperCase()).digest("hex");

const VER = /^\d+\.\d+\.\d+$/;

/** Accept only what a policy may contain; anything else is dropped or refused. */
export function sanitisePolicy(input: unknown, base: EntitlementPolicy = DEFAULT_POLICY): { policy: EntitlementPolicy } | { error: string } {
  if (!input || typeof input !== "object") return { error: "policy must be an object" };
  const i = input as Record<string, unknown>;
  const p: EntitlementPolicy = { ...base };
  if (i.mode !== undefined) {
    if (i.mode !== "off" && i.mode !== "nag" && i.mode !== "lock") return { error: "mode must be off, nag or lock" };
    p.mode = i.mode;
  }
  if (i.startsAt !== undefined) {
    if (i.startsAt === null || i.startsAt === "") p.startsAt = null;
    else if (typeof i.startsAt === "string" && !Number.isNaN(Date.parse(i.startsAt))) p.startsAt = new Date(i.startsAt).toISOString();
    else return { error: "startsAt must be a date" };
  }
  for (const k of ["title", "message"] as const) {
    if (i[k] !== undefined) {
      if (typeof i[k] !== "string" || (i[k] as string).length > 600) return { error: `${k} must be text under 600 characters` };
      p[k] = i[k] as string;
    }
  }
  for (const k of ["checkoutUrl", "updateUrl"] as const) {
    if (i[k] !== undefined) {
      const v = i[k];
      if (typeof v !== "string") return { error: `${k} must be a link` };
      if (v && !/^https:\/\//.test(v)) return { error: `${k} must start with https://` };
      p[k] = v;
    }
  }
  if (i.minVersion !== undefined) {
    if (typeof i.minVersion !== "string" || (i.minVersion && !VER.test(i.minVersion))) return { error: "minVersion must look like 1.30.0" };
    p.minVersion = i.minVersion;
  }
  if (i.nagEveryHours !== undefined) {
    const n = Number(i.nagEveryHours);
    if (!Number.isFinite(n) || n < 1 || n > 24 * 30) return { error: "nagEveryHours must be between 1 and 720" };
    p.nagEveryHours = Math.round(n);
  }
  // Plain keys in, hashes stored. addKeys appends, removeKeys deletes, keys replaces.
  const toHashes = (v: unknown) => (Array.isArray(v) ? v.filter((k): k is string => typeof k === "string" && k.trim().length >= 6).map(hashKey) : []);
  if (i.keys !== undefined) p.keyHashes = [...new Set(toHashes(i.keys))];
  if (i.addKeys !== undefined) p.keyHashes = [...new Set([...p.keyHashes, ...toHashes(i.addKeys)])];
  if (i.removeKeys !== undefined) {
    const gone = new Set(toHashes(i.removeKeys));
    p.keyHashes = p.keyHashes.filter((h) => !gone.has(h));
  }
  p.updatedAt = new Date().toISOString();
  return { policy: p };
}

/** What a client is allowed to see: everything except the key hashes. */
export function publicPolicy(p: EntitlementPolicy): Omit<EntitlementPolicy, "keyHashes"> & { keyCount: number } {
  const { keyHashes, ...rest } = p;
  return { ...rest, keyCount: keyHashes.length };
}

/**
 * Is this a valid licence? THE function to replace when a payment provider is
 * chosen: look the key up with them instead (or verify a signed token).
 */
export function verifyLicence(key: string, policy: EntitlementPolicy): { valid: boolean } {
  if (!key || key.trim().length < 6) return { valid: false };
  const given = Buffer.from(hashKey(key), "hex");
  let ok = false;
  for (const h of policy.keyHashes) {
    const want = Buffer.from(h, "hex");
    // Compared in constant time, and every hash is checked, so timing says nothing.
    if (want.length === given.length && timingSafeEqual(want, given)) ok = true;
  }
  return { valid: ok };
}

/** Constant-time check of the admin token. An unset token disables admin access entirely. */
export function isAdmin(provided: string | undefined, expected: string | undefined): boolean {
  if (!expected || expected.length < 16 || !provided) return false;
  const a = Buffer.from(createHash("sha256").update(provided).digest("hex"));
  const b = Buffer.from(createHash("sha256").update(expected).digest("hex"));
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---- storage: the same table the live channels use, one row ---- */
const ROW = "entitlement";

export async function loadPolicy(): Promise<EntitlementPolicy> {
  const [{ db }, schema, { eq }] = await Promise.all([import("../database"), import("../database/schema"), import("drizzle-orm")]);
  const [row] = await db.select().from(schema.channelState).where(eq(schema.channelState.id, ROW));
  if (!row) return DEFAULT_POLICY;
  try {
    return { ...DEFAULT_POLICY, ...(JSON.parse(row.payload) as Partial<EntitlementPolicy>) };
  } catch {
    return DEFAULT_POLICY;
  }
}

export async function savePolicy(p: EntitlementPolicy): Promise<void> {
  const [{ db }, schema, { eq }] = await Promise.all([import("../database"), import("../database/schema"), import("drizzle-orm")]);
  const payload = JSON.stringify(p);
  const updatedAt = new Date().toISOString();
  const updated = await db.update(schema.channelState).set({ payload, updatedAt }).where(eq(schema.channelState.id, ROW));
  if (!updated.rowsAffected) await db.insert(schema.channelState).values({ id: ROW, payload, rev: 0, updatedAt });
}
