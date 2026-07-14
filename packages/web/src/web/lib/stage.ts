/**
 * Stage layer — the single publish path for BOTH song lyrics and Bible verses.
 *
 * A StageSlide is a source-agnostic unit of content. The operator PREVIEWS a
 * StageSlide, then SENDS it to live. Live output (projector, /stream) only ever
 * sees LiveState, so lyrics and scripture render through the exact same engine.
 */
import { liveBus, type LiveBackground, type LiveState, type LiveTheme } from "./live-bus";

export type StageKind = "lyric" | "bible" | "presentation";

export type StageSlide = {
  kind: StageKind;
  sourceLines: string[];
  translationLines: string[];
  /** Section label (lyrics) or scripture reference (bible), shown as caption. */
  caption: string;
  /** Song title (lyrics) or version label (bible). */
  title: string;
  slideId: string | null;
  slideIndex: number;
  slideCount: number;
  /**
   * Per-slide background (presentation slides only). undefined = inherit the
   * theme's own background; null = explicitly no background (theme color).
   */
  background?: LiveBackground;
};

export function stageToState(
  slide: StageSlide | null,
  status: LiveState["status"],
  theme: LiveTheme,
): Omit<LiveState, "rev"> {
  const live = status === "live" && slide;
  const effectiveTheme = live && slide.background !== undefined ? { ...theme, background: slide.background } : theme;
  return {
    status,
    sourceLines: live ? slide.sourceLines : [],
    translationLines: live ? slide.translationLines : [],
    sectionLabel: slide?.caption ?? "",
    songTitle: slide?.title ?? "",
    slideId: slide?.slideId ?? null,
    slideIndex: slide?.slideIndex ?? 0,
    slideCount: slide?.slideCount ?? 0,
    theme: effectiveTheme,
  };
}

/**
 * Publish to every live surface: BroadcastChannel + localStorage (projector,
 * operator preview) AND mirror to the server so out-of-process clients (OBS
 * browser-source /stream, NDI bridge) stay in sync.
 */
export function publishLive(state: Omit<LiveState, "rev">): LiveState {
  const full = liveBus().publish(state);
  try {
    fetch("/api/live/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(full),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
  return full;
}
