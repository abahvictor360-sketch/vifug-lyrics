/**
 * Secrets that belong to ONE browser.
 *
 * The hosted app keeps a single settings record for everybody, so anything
 * secret put in it is visible to - and shared by - every visitor. The
 * Deepgram key and the phone-remote pairing code are therefore kept in the
 * browser's own storage only, and are never sent to Vifug's server (the server
 * is given a one-way hash of the pairing code, nothing else).
 *
 * The desktop app is one person's own installation, so it keeps using its own
 * settings as before; these apply to anything running in a browser.
 */
import { getDesktopAPI } from "./desktop";

const KEY_DEEPGRAM = "vifug:deepgram-key";
const KEY_PAIR = "vifug:pair-code";

/** True in a browser, false in the desktop app. */
export const usesBrowserSecrets = (): boolean => !getDesktopAPI();

function read(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}
function write(k: string, v: string | null) {
  try {
    if (v) window.localStorage.setItem(k, v);
    else window.localStorage.removeItem(k);
  } catch {
    /* storage blocked: the value just lasts until the page is closed */
  }
}

export const getDeepgramKey = (): string | null => read(KEY_DEEPGRAM)?.trim() || null;
export const setDeepgramKey = (v: string | null) => write(KEY_DEEPGRAM, v?.trim() || null);

/** This browser's pairing code: six digits, made once and kept. */
export function getPairCode(): string {
  const have = read(KEY_PAIR);
  if (have && /^\d{6}$/.test(have)) return have;
  return newPairCode();
}
export function newPairCode(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  const code = String(100000 + (a[0]! % 900000));
  write(KEY_PAIR, code);
  window.dispatchEvent(new Event("vifug:pair-code-changed"));
  return code;
}

/** The same one-way hash the server computes (lib/pairing.ts), so this browser can name its own room. */
export async function roomOf(code: string): Promise<string> {
  const data = new TextEncoder().encode(`vifug-room:${code}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Tell the server this browser's code exists (hash only). */
export async function registerPairCode(code: string): Promise<boolean> {
  try {
    const r = await fetch("/api/remote/pair", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export type RemoteMode = "per-browser" | "shared";
export async function fetchRemoteMode(): Promise<RemoteMode> {
  try {
    const r = await fetch("/api/remote/auth");
    const j = (await r.json()) as { mode?: RemoteMode };
    return j.mode === "per-browser" ? "per-browser" : "shared";
  } catch {
    return "shared";
  }
}
