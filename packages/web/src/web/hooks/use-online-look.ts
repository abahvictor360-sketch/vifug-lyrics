import { useMemo } from "react";
import { useScreenTheme } from "./use-screen-theme";
import type { AppSettings } from "./use-settings";
import type { LiveState } from "../lib/live-bus";

/**
 * The live state as the online audience should see it.
 *
 * In the room the words fill the screen. Online, over a camera, the same
 * words belong in the bottom of the frame where they do not cover the
 * speaker. With "lower third" chosen this re-dresses what the operator sent:
 * in the chosen theme if there is one, otherwise in an automatic lower third
 * that keeps the room's font and colours and adds a dark bar so the words
 * read over any picture.
 */
export function useOnlineLook(sent: LiveState, settings: AppSettings | undefined): LiveState {
  const lowerThird = settings?.online?.mode === "lower_third";
  const themed = useScreenTheme(sent, lowerThird ? settings?.online?.themeId : null);
  return useMemo(() => {
    if (!lowerThird) return sent;
    if (settings?.online?.themeId && themed !== sent) {
      // A designed theme: its own box, bar and motion; never its background,
      // which would cover the camera.
      return { ...themed, theme: { ...themed.theme, background: null } };
    }
    return {
      ...sent,
      theme: {
        ...sent.theme,
        background: null,
        displayMode: "fullscreen",
        textFrame: { x: 5, y: 70, w: 90, h: 25 },
        verticalPos: "bottom",
        textBar: { color: "rgba(0,0,0,0.6)", radius: 20 },
        layers: [],
        overlayScrim: 0,
      },
    };
  }, [sent, themed, lowerThird, settings?.online?.themeId]);
}
