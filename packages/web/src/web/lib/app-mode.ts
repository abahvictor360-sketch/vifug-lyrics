/**
 * What this Vifug is for.
 *
 * It began as a church tool, and a church still wants all of it: hymns,
 * Scripture, services. A television studio, a conference or a karaoke night
 * wants the same projector engine with none of that in the way, and a team
 * that only shows slides wants less still. So the mode only decides what is
 * OFFERED - nothing is deleted. The hymns stay in the library, hidden, and the
 * Bible stays installed, so switching back to church puts everything back.
 *
 * An install that has never chosen is a church one: that is what it has been,
 * and changing it under somebody mid-service would be the worst kind of update.
 */

export type AppMode = "church" | "media" | "presentation";

export type ModeTab = "lyrics" | "bible" | "presentation" | "media" | "plans" | "history";

export type AppModeInfo = {
  id: AppMode;
  /** Shown on the card and in Settings. */
  label: string;
  /** One line under the label. */
  summary: string;
  /** Which operator tabs exist, in order. */
  tabs: ModeTab[];
  /** The Bible tab, Scripture following and the Bible settings. */
  bible: boolean;
  /** The song library. */
  songs: boolean;
  /** What the run-of-service tab is called here. */
  plansLabel: string;
};

export const APP_MODES: AppModeInfo[] = [
  {
    id: "church",
    label: "Church",
    summary: "Hymns, worship songs, Bible and service plans.",
    tabs: ["lyrics", "bible", "presentation", "media", "plans", "history"],
    bible: true,
    songs: true,
    plansLabel: "Plans",
  },
  {
    id: "media",
    label: "Media & entertainment",
    summary: "Shows, events, conferences, karaoke and live streams. No hymns or Bible.",
    tabs: ["lyrics", "presentation", "media", "plans", "history"],
    bible: false,
    songs: true,
    plansLabel: "Run of show",
  },
  {
    id: "presentation",
    label: "Presentations only",
    summary: "Slides, pictures and video to your screens. Nothing else.",
    tabs: ["presentation", "media", "history"],
    bible: false,
    songs: false,
    plansLabel: "Plans",
  },
];

export const DEFAULT_APP_MODE: AppMode = "church";

export function appModeOf(settings: { appMode?: AppMode | null } | null | undefined): AppModeInfo {
  return APP_MODES.find((m) => m.id === settings?.appMode) ?? APP_MODES[0]!;
}

/**
 * A song that ships for worship: the bundled hymn and gospel library, or
 * anything tagged as one. Hidden outside church, never deleted.
 */
export function isWorshipSong(song: { source?: string | null; tags?: string[] | null }): boolean {
  if (song.source === "library") return true;
  return (song.tags ?? []).some((t) => /^(hymns?|gospel|worship|praise)$/i.test(t.trim()));
}

/** Whether a song shows up in the library under this mode. */
export function songVisibleIn(mode: AppMode, song: { source?: string | null; tags?: string[] | null }): boolean {
  if (mode === "church") return true;
  if (mode === "presentation") return false;
  return !isWorshipSong(song);
}
