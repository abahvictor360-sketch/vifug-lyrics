/**
 * How wide (or tall) the operator's panes are.
 *
 * The operator screen is made of panes - the library, the slides, the live
 * controls, and in the broadcast shape the row of screens across the top - and
 * no fixed size suits every room. A 1366x768 laptop on a lectern wants a
 * narrow library and a roomy control column; a 4K monitor at a streaming desk
 * wants the opposite. So each divider can be dragged, and the size it was left
 * at is remembered.
 *
 * Per device, like the layout shape and for the same reason: it is a fact
 * about this screen, not about the church. A size is stored in pixels and
 * clamped on read, so a value saved on a wide monitor can never leave a pane
 * wider than a smaller window can hold.
 */

const STORAGE_KEY = "vifug.pane-sizes";

export type PaneKey =
  | "broadcastLibrary"
  | "broadcastControls"
  | "broadcastScreens"
  | "vifugLibrary"
  | "vifugRail";

/** Smallest and largest each pane may be, in pixels. */
export const PANE_LIMITS: Record<PaneKey, { min: number; max: number }> = {
  broadcastLibrary: { min: 200, max: 560 },
  broadcastControls: { min: 260, max: 720 },
  // The height of the Preview / Live row. Below ~120px the screens stop being
  // readable; above ~900px nothing else would fit on the screen.
  broadcastScreens: { min: 120, max: 900 },
  vifugLibrary: { min: 200, max: 560 },
  vifugRail: { min: 320, max: 800 },
};

/** The slides pane is never squeezed below this, whatever the dividers say. */
export const MIN_CENTER_WIDTH = 320;

type Sizes = Partial<Record<PaneKey, number>>;

/** Keep a size inside its pane's limits and, when known, inside the room there is. */
export function clampPane(key: PaneKey, px: number, available?: number): number {
  const { min, max } = PANE_LIMITS[key];
  let hi = max;
  if (available !== undefined && Number.isFinite(available)) hi = Math.min(hi, Math.max(min, available));
  if (!Number.isFinite(px)) return min;
  return Math.round(Math.min(hi, Math.max(min, px)));
}

function readStored(): Sizes {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!raw || typeof raw !== "object") return {};
    const out: Sizes = {};
    for (const key of Object.keys(PANE_LIMITS) as PaneKey[]) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === "number" && Number.isFinite(v)) out[key] = clampPane(key, v);
    }
    return out;
  } catch {
    // Private windows throw on access; a damaged value is just ignored.
    return {};
  }
}

let current: Sizes = readStored();
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Not fatal: the panes still resize for this session.
  }
}

export function getPaneSizes(): Sizes {
  return current;
}

export function setPaneSize(key: PaneKey, px: number): void {
  const next = clampPane(key, px);
  if (current[key] === next) return;
  current = { ...current, [key]: next };
  persist();
  emit();
}

/** Put one pane, or all of them, back to the built-in size. */
export function resetPaneSizes(key?: PaneKey): void {
  if (key) {
    if (!(key in current)) return;
    const { [key]: _gone, ...rest } = current;
    current = rest;
  } else {
    if (!Object.keys(current).length) return;
    current = {};
  }
  persist();
  emit();
}

export function subscribePaneSizes(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
