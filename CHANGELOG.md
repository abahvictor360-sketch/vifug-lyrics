# Changelog

All notable changes to Vifug Lyrics are documented here.
Versioning follows [Semantic Versioning](https://semver.org). Releases are cut by
pushing a `v*` tag, which triggers the desktop installer build and publishes a
GitHub Release with Windows, macOS and Linux artifacts.

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
