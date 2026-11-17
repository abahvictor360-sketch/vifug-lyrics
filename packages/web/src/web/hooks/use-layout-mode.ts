import { useSyncExternalStore } from "react";
import { getLayoutMode, subscribeLayoutMode, type LayoutMode } from "../lib/layout-mode";

/**
 * The shape this machine runs the operator screen in.
 *
 * Server-rendered or not, the first paint has to agree with what the browser
 * will do on hydration, so the snapshot used on the server is the default
 * rather than a read of a localStorage that is not there.
 */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribeLayoutMode, getLayoutMode, () => "vifug" as LayoutMode);
}
