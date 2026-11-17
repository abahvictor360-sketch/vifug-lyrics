/**
 * Which shape the operator screen takes.
 *
 * Two people run the same service from the same app and want opposite things
 * out of it. Someone who has only ever used Vifug wants the words in front of
 * them: the song fills the middle, and the small preview and live screens sit
 * off to the side where they can be glanced at. Someone who spends their week
 * at a streaming desk wants the opposite - the two screens are the
 * instrument, enormous and side by side across the top, and everything that
 * feeds them is a dock underneath.
 *
 * Neither is more correct. So the app offers both and remembers which one this
 * machine was told to use:
 *
 *   "vifug"     - library | slides | live rail, three columns across.
 *   "broadcast" - Preview | Live across the top, then list | slides | controls.
 *
 * Per device rather than in settings, deliberately. It is a preference about a
 * screen, not about a church: the operator's laptop can run the broadcast
 * shape while the phone someone holds at the back stays on the simple one, and
 * a volunteer changing it on the desk does not rearrange the screen of whoever
 * is on the stage monitor halfway through a song.
 */

const STORAGE_KEY = "vifug.layout-mode";

export type LayoutMode = "vifug" | "broadcast";

function readStored(): LayoutMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    // "obs" is what this mode was called before it was named after what it
    // does rather than after somebody else's product. Anyone who picked it
    // under the old name keeps the layout they chose.
    return stored === "broadcast" || stored === "obs" ? "broadcast" : "vifug";
  } catch {
    // Private windows and locked-down browsers throw on access rather than
    // returning null. The default shape is the one that needs no explanation.
    return "vifug";
  }
}

let current: LayoutMode = readStored();
const listeners = new Set<(m: LayoutMode) => void>();

export function getLayoutMode(): LayoutMode {
  return current;
}

export function setLayoutMode(mode: LayoutMode): void {
  if (mode === current) return;
  current = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Not fatal: the layout still changes for this session, it just will not
    // be remembered next time. Better than refusing to switch at all.
  }
  for (const fn of listeners) fn(mode);
}

export function subscribeLayoutMode(fn: (m: LayoutMode) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
