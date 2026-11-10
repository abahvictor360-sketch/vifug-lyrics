/**
 * Run with: bun test src/web/lib/app-mode.test.ts
 */
import { expect, test } from "bun:test";
import { APP_MODES, appModeOf, isWorshipSong, songVisibleIn } from "./app-mode";

test("an install that never chose is a church one", () => {
  expect(appModeOf(undefined).id).toBe("church");
  expect(appModeOf({}).id).toBe("church");
  expect(appModeOf({ appMode: "media" }).id).toBe("media");
  // An unknown stored value must not break the app.
  expect(appModeOf({ appMode: "bogus" as never }).id).toBe("church");
});

test("only church has the Bible, and every mode keeps Media", () => {
  for (const m of APP_MODES) {
    expect(m.tabs.includes("bible")).toBe(m.id === "church");
    expect(m.bible).toBe(m.id === "church");
    expect(m.tabs).toContain("media");
  }
});

test("presentation mode has no lyrics tab", () => {
  const p = APP_MODES.find((m) => m.id === "presentation")!;
  expect(p.tabs).not.toContain("lyrics");
  expect(p.tabs[0]).toBe("presentation");
});

test("bundled and worship-tagged songs are hidden outside church only", () => {
  const hymn = { source: "library", tags: ["hymn"] };
  const gospel = { source: "manual", tags: ["Gospel"] };
  const own = { source: "manual", tags: [] };
  const starter = { source: "starter", tags: ["public-domain"] };
  expect(isWorshipSong(hymn)).toBe(true);
  expect(isWorshipSong(gospel)).toBe(true);
  expect(isWorshipSong(own)).toBe(false);
  expect(isWorshipSong(starter)).toBe(false);

  for (const s of [hymn, gospel, own, starter]) expect(songVisibleIn("church", s)).toBe(true);
  expect(songVisibleIn("media", hymn)).toBe(false);
  expect(songVisibleIn("media", gospel)).toBe(false);
  expect(songVisibleIn("media", own)).toBe(true);
  expect(songVisibleIn("media", starter)).toBe(true);
  expect(songVisibleIn("presentation", own)).toBe(false);
});
