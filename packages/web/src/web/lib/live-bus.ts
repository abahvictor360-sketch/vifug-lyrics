/**
 * Live output bus — one channel, render once output many.
 * Operator writes the live output state; the projector window subscribes.
 * Uses BroadcastChannel (works across Electron windows & browser tabs) plus a
 * localStorage snapshot so a late-opening projector immediately syncs.
 */

export type LiveBackground = {
  type: "image" | "video" | "color";
  url: string; // presigned/external url, or hex color when type === "color"
  fit: "cover" | "contain" | "fill";
  loop: boolean;
} | null;

export type LiveTheme = {
  bgColor: string;
  textColor: string;
  textAlign: "left" | "center" | "right";
  fontWeight: number;
  fontSize: number | null; // null = auto-fit
  fontFamily: string | null; // CSS font stack; null = default lyric font
  safeMargin: number; // %
  overlayScrim: number; // 0-100
  displayMode: "fullscreen" | "lower_third" | "lower_third_bg";
  verticalPos: "top" | "center" | "bottom";
  transition: string;
  transitionMs: number;
  textOutline: { color: string; width: number } | null;
  background: LiveBackground;
  /** Show the caption (scripture reference / section label) on the output. */
  showCaption?: boolean;
  /** Caption color; null = accent default. */
  captionColor?: string | null;
};

export type LiveState = {
  status: "idle" | "live" | "blank" | "clear";
  sourceLines: string[];
  translationLines: string[];
  sectionLabel: string;
  songTitle: string;
  slideId: string | null;
  slideIndex: number;
  slideCount: number;
  theme: LiveTheme;
  rev: number; // monotonic revision
};

export const DEFAULT_THEME: LiveTheme = {
  bgColor: "#0a0a0c",
  textColor: "#ffffff",
  textAlign: "center",
  fontWeight: 600,
  fontSize: null,
  fontFamily: null,
  safeMargin: 8,
  overlayScrim: 0,
  displayMode: "fullscreen",
  verticalPos: "center",
  transition: "fade",
  transitionMs: 300,
  textOutline: { color: "rgba(0,0,0,0.6)", width: 2 },
  background: null,
  showCaption: false,
  captionColor: null,
};

export const IDLE_STATE: LiveState = {
  status: "idle",
  sourceLines: [],
  translationLines: [],
  sectionLabel: "",
  songTitle: "",
  slideId: null,
  slideIndex: 0,
  slideCount: 0,
  theme: DEFAULT_THEME,
  rev: 0,
};

const CHANNEL = "vifug-live";
const SNAPSHOT_KEY = "vifug:live-state";

type Listener = (s: LiveState) => void;

class LiveBus {
  private chan: BroadcastChannel | null = null;
  private listeners = new Set<Listener>();
  private rev = 0;

  constructor() {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      this.chan = new BroadcastChannel(CHANNEL);
      this.chan.onmessage = (e) => {
        const s = e.data as LiveState;
        this.rev = Math.max(this.rev, s.rev);
        this.listeners.forEach((l) => l(s));
      };
    }
    // Cross-window fallback via storage events (also helps browser tabs).
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === SNAPSHOT_KEY && e.newValue) {
          try {
            const s = JSON.parse(e.newValue) as LiveState;
            this.rev = Math.max(this.rev, s.rev);
            this.listeners.forEach((l) => l(s));
          } catch { /* ignore */ }
        }
      });
    }
  }

  publish(state: Omit<LiveState, "rev">) {
    this.rev += 1;
    const full: LiveState = { ...state, rev: this.rev };
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(full));
    } catch { /* ignore */ }
    this.chan?.postMessage(full);
    // Notify listeners in THIS window too — BroadcastChannel and storage events
    // never fire in the originating window, so the operator's own live preview
    // would otherwise never update.
    this.listeners.forEach((l) => l(full));
    return full;
  }

  snapshot(): LiveState {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (raw) return JSON.parse(raw) as LiveState;
    } catch { /* ignore */ }
    return IDLE_STATE;
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

let _bus: LiveBus | null = null;
export function liveBus(): LiveBus {
  if (!_bus) _bus = new LiveBus();
  return _bus;
}
