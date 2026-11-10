/**
 * The client half of the pay-for-Vifug switch (see api/lib/entitlement.ts).
 *
 * Every copy asks the hosted service one question on start - "is a paid plan
 * required yet?" - and gets back a policy. The decision of what to do with it
 * is a pure function here so it can be tested without a screen.
 *
 * The rules that keep this from ever hurting a church on a Sunday:
 *  - It fails open. No connection and no recent answer means "ok", never "locked".
 *  - A lock that was fetched is remembered for 14 days, so airplane mode is not a
 *    way round it, but an old one stops mattering on its own.
 *  - A lock only takes effect when the app starts. If the policy changes while
 *    a service is running, the operator is told, not interrupted.
 *  - The output windows (projector, stream, stage) are never gated.
 */
import { castOrigin } from "./cast";

export type PublicPolicy = {
  mode: "off" | "nag" | "lock";
  startsAt: string | null;
  title: string;
  message: string;
  checkoutUrl: string;
  minVersion: string;
  updateUrl: string;
  nagEveryHours: number;
  updatedAt: string;
  keyCount?: number;
};

export type GateState = "ok" | "nag" | "lock" | "update";

const POLICY_KEY = "vifug:entitlement";
const LICENCE_KEY = "vifug:licence";
const NAG_KEY = "vifug:entitlement-nag";
/** A fetched policy is trusted offline for this long. */
export const CACHE_MAX_MS = 14 * 24 * 3600 * 1000;
/** A stored licence is re-checked with the server at most this often. */
export const RECHECK_MS = 7 * 24 * 3600 * 1000;

const read = <T,>(k: string): T | null => {
  try {
    const v = window.localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown) => {
  try {
    window.localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage blocked: the policy is simply fetched again next time */
  }
};
const drop = (k: string) => {
  try {
    window.localStorage.removeItem(k);
  } catch {
    /* nothing to remove */
  }
};

function parseVer(v: string): number[] | null {
  const m = v.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Is `current` older than `min`? Unparseable versions are never "older". */
export function isOlderThan(current: string, min: string): boolean {
  const c = parseVer(current);
  const m = parseVer(min);
  if (!c || !m) return false;
  for (let i = 0; i < 3; i++) if (c[i] !== m[i]) return c[i]! < m[i]!;
  return false;
}

export type EvalInput = {
  policy: PublicPolicy | null;
  licensed: boolean;
  /** The installed app's version; null in a browser, which is always current. */
  appVersion: string | null;
  now: number;
  /** When the nag was last dismissed, ms since epoch. */
  nagDismissedAt: number | null;
};

export function evaluate({ policy, licensed, appVersion, now, nagDismissedAt }: EvalInput): GateState {
  if (!policy) return "ok";
  if (policy.startsAt && Date.parse(policy.startsAt) > now) return "ok";
  if (appVersion && policy.minVersion && isOlderThan(appVersion, policy.minVersion)) return "update";
  if (licensed) return "ok";
  if (policy.mode === "lock") return "lock";
  if (policy.mode === "nag") {
    const every = Math.max(1, policy.nagEveryHours) * 3600 * 1000;
    return nagDismissedAt !== null && now - nagDismissedAt < every ? "ok" : "nag";
  }
  return "ok";
}

/** The last policy this device heard, if it is recent enough to trust. */
export function cachedPolicy(now = Date.now()): PublicPolicy | null {
  const c = read<{ policy: PublicPolicy; at: number }>(POLICY_KEY);
  return c && now - c.at < CACHE_MAX_MS ? c.policy : null;
}

/** Ask the hosted service. Returns null on any failure - callers treat that as "no change". */
export async function fetchPolicy(): Promise<PublicPolicy | null> {
  try {
    const r = await fetch(`${castOrigin()}/api/entitlement`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const body = (await r.json()) as { policy?: PublicPolicy };
    if (!body.policy || !["off", "nag", "lock"].includes(body.policy.mode)) return null;
    write(POLICY_KEY, { policy: body.policy, at: Date.now() });
    return body.policy;
  } catch {
    return null;
  }
}

export function storedLicence(): { key: string; verifiedAt: number } | null {
  return read(LICENCE_KEY);
}

/** Check a key with the service; remembers it if valid. */
export async function redeemLicence(key: string): Promise<"valid" | "invalid" | "offline"> {
  try {
    const r = await fetch(`${castOrigin()}/api/entitlement/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return "offline";
    const { valid } = (await r.json()) as { valid: boolean };
    if (!valid) return "invalid";
    write(LICENCE_KEY, { key: key.trim(), verifiedAt: Date.now() });
    return "valid";
  } catch {
    return "offline";
  }
}

/**
 * Is this device licensed? A stored key is believed until it has gone a week
 * without being re-checked; then the service is asked again, and only an
 * explicit "invalid" withdraws it - being offline never does.
 */
export async function isLicensed(now = Date.now()): Promise<boolean> {
  const l = storedLicence();
  if (!l) return false;
  if (now - l.verifiedAt < RECHECK_MS) return true;
  const r = await redeemLicence(l.key);
  if (r === "invalid") {
    drop(LICENCE_KEY);
    return false;
  }
  return true;
}

export const nagDismissedAt = (): number | null => read<number>(NAG_KEY);
export const dismissNag = () => write(NAG_KEY, Date.now());
