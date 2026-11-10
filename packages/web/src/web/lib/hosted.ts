import { getDesktopAPI } from "./desktop";

/**
 * Is this the shared, hosted copy of Vifug (app.vifug.com) rather than an
 * install on someone's own computer?
 *
 * The hosted copy has one settings row and one library for everyone who opens
 * it, so a "first run" question asked once is never asked again. It is told
 * apart by its address, and never in the desktop app. Setting
 * `vifug:always-welcome` to "1" in the browser's storage does the same on any
 * address, which is how it is tried out away from the real site.
 */
export function isHostedApp(): boolean {
  if (typeof window === "undefined" || getDesktopAPI()) return false;
  try {
    if (window.localStorage.getItem("vifug:always-welcome") === "1") return true;
  } catch {
    /* storage blocked: fall through to the address */
  }
  return /(^|\.)vifug\.com$/i.test(window.location.hostname);
}
