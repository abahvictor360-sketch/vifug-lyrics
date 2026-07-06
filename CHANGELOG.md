# Changelog

All notable changes to Vifug Lyrics are documented here.
Versioning follows [Semantic Versioning](https://semver.org). Releases are cut by
pushing a `v*` tag, which triggers the desktop installer build and publishes a
GitHub Release with Windows, macOS and Linux artifacts.

## [1.0.7] — 2026-07-06

- Fullscreen auto-fit now measures the real rendered text width (per font family/weight) instead of estimating, so lyrics fill the usable width edge-to-edge within the safe margin — roughly 18% larger than v1.0.6 on typical verses.

## [1.0.6] — 2026-07-06

- Fullscreen slides now auto-size the text to FILL the display (bounded by the safe margin at the edges) instead of capping at 96px. Lower-third modes keep their broadcast-style sizing. Switch between Fullscreen and Lower third in Settings → Lyrics → Look & feel → Display mode (and Settings → Bible for scripture).

## [1.0.5] — 2026-07-06

- FIX: the projector window fullscreened onto the primary monitor even when targeting the secondary display. Cause: fullscreening a still-hidden window on Windows snaps it to the primary display. The window is now positioned on the target display, shown, and only then fullscreened — same for moving an already-open projector between displays.

## [1.0.4] — 2026-07-05

- FIX: on small screens (1366×768 laptops) the Projector panel was pushed below the window edge and unreachable — this is why "Open projector" seemed missing. The panel now sits right under the transport controls and the whole right rail scrolls.
- Removed the leftover analytics debug overlay that could appear over the operator UI in the packaged app.

## [1.0.3] — 2026-07-05

- Next / Prev (arrow keys, transport buttons, phone remote) now sends the slide live immediately — no separate GO LIVE click. Toggle in Settings → General → Live behavior to return to cue-then-Enter.
- Bible slides now show the scripture reference on the projector/stream, with a new Reference color and Verse text color in Settings → Bible.
- Settings → General gains an AI auto-follow section with in-app Deepgram API key (no server env needed) and an NDI output section with setup steps and the stream URL.
- Projector: extra safety net so the output window always appears on the chosen display.

## [1.0.2] — 2026-07-05

- All installers (Windows, macOS, Linux) now carry the Vifug Lyrics app icon — the lime music-note tile — instead of the default Electron icon.

## [1.0.1] — 2026-07-05

- Projector window now reliably opens fullscreen on the selected (secondary) display on Windows; moving an open projector between displays also works.
- Library grows from 125 to 325 seeded songs (all 300 public-domain hymns + 25 Nigerian gospel).
- Removed the "Made with Runable" badge from the app.

## [1.0.0] — 2026-07-05

First public release.

### Lyrics & presentation
- Song library with search, section-based song editor (verse/chorus/bridge), arrangements with repeats.
- Import from `.txt` / `.docx` with structure auto-detect, plus ProPresenter (`.pro6` / `.pro`) import.
- Paginator: fixed 2/3/N lines per slide, manual breaks, autofit — slides computed at render time.
- Preview → Live stage (ProPresenter-style): cue with ←/→, send with Enter, blank with Space, clear with Esc.
- Fullscreen / lower-third display mode with position control.
- Themes: font, size, color, alignment, backgrounds (image / video / color), safe margins.
- 125 seeded songs (100 public-domain hymns + 25 Nigerian gospel).

### Bible
- 7 offline versions bundled: KJV, WEB, ASV, BBE, Yoruba, Hausa, Igbo.
- Book/chapter/verse navigation, reference jump ("John 3:16") and keyword search — fully offline.
- Per-display Bible theme overrides merged over the lyric theme.

### Outputs
- Projector output on a second monitor (Electron window, BroadcastChannel sync).
- `/stream` browser-source page with transparent background, synced over Server-Sent Events — OBS / vMix ready, NDI via OBS + DistroAV bridge (see `docs/STREAMING_AND_NDI.md`).
- Stage display (`/stage`): current + next slide, clock and notes for the worship team.
- Remote control (`/remote`) from phone or tablet.

### Platform
- Offline-first: local SQLite (libsql) source of truth, fully offline Windows installer.
- Multi-language UI content: English, Idoma, Yoruba, Igbo, Hausa, Twi.
- Service plans (playlists) mixing songs, scripture and blank items.
- Settings page with side navigation.
- CI: GitHub Actions builds NSIS `.exe`, `.dmg` and `.AppImage` on every `v*` tag and attaches them to the GitHub Release.
