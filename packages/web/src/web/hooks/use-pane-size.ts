import { useCallback, useSyncExternalStore } from "react";
import {
  clampPane,
  getPaneSizes,
  resetPaneSizes,
  setPaneSize,
  subscribePaneSizes,
  type PaneKey,
} from "../lib/pane-sizes";

/**
 * A pane's size in pixels: what the operator dragged it to, or `fallback`.
 * `available` is the room the pane may take; the result is clamped to it so a
 * size saved on a big monitor never overflows a small window.
 */
export function usePaneSize(key: PaneKey, fallback: number, available?: number) {
  const stored = useSyncExternalStore(
    subscribePaneSizes,
    () => getPaneSizes()[key],
    () => undefined,
  );
  const size = clampPane(key, stored ?? fallback, available);
  const set = useCallback((px: number) => setPaneSize(key, px), [key]);
  const reset = useCallback(() => resetPaneSizes(key), [key]);
  return { size, set, reset, custom: stored !== undefined };
}

/** Whether any pane has been dragged away from its built-in size. */
export function usePaneSizesCustom(): boolean {
  return useSyncExternalStore(
    subscribePaneSizes,
    () => Object.keys(getPaneSizes()).length > 0,
    () => false,
  );
}
