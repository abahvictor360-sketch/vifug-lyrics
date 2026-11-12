import { useMemo } from "react";
import { useThemes } from "./use-songs";
import { useMedia } from "./use-media";
import { themeToLive, type LiveBackground, type LiveState } from "../lib/live-bus";

/**
 * A screen with a theme of its own.
 *
 * The operator sends one live state to every screen, look included. A screen
 * that has been given its own theme - the stream overlay as a lower third,
 * the lobby TV in the brand colours, the stage monitor in plain large type -
 * swaps that look for its own here, at the screen, and leaves the words
 * alone. No theme chosen (or one since deleted) shows what the operator sent.
 */
export function useScreenTheme(state: LiveState, themeId: string | null | undefined): LiveState {
  // Polled, like the settings beside it, so an edit made in the designer
  // reaches a screen in another window or on another device within seconds.
  const themes = useThemes({ refetchInterval: themeId ? 4000 : undefined }).data;
  const media = useMedia().data;
  return useMemo(() => {
    const row = themeId ? themes?.find((t) => t.id === themeId) : undefined;
    if (!row) return state;
    const own = themeToLive(row as unknown as Record<string, unknown>);
    const bgId = (row as { backgroundId?: string | null }).backgroundId;
    const m = bgId ? media?.find((x) => x.id === bgId) : undefined;
    const background: LiveBackground =
      m && (m.type === "image" || m.type === "video" || m.type === "color")
        ? { type: m.type, url: m.url, fit: (m.fit as "cover" | "contain" | "fill") ?? "cover", loop: !!m.loop, muted: true, colorFilter: m.colorFilter }
        : state.theme.background;
    return {
      ...state,
      theme: {
        ...own,
        background,
        // Whether a reference caption shows is a property of what is on air
        // (Scripture has one, a lyric does not), not of the look.
        showCaption: state.theme.showCaption,
        captionColor: state.theme.captionColor,
      },
    };
  }, [state, themeId, themes, media]);
}
