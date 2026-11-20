# Guide videos: the Vifug logo intro

**Every guide video starts with the Vifug logo.** The intro is 2.5 seconds: the
brand mark and wordmark fade in on the dark site background, then fade to black
into the recording. Do this to every new video, and to any video you re-record.

## Make the intro (once, or whenever the brand changes)

```bash
NODE_PATH=$(npm root -g) node tools/guide-video/intro.cjs /tmp/vifug-intro
# writes /tmp/vifug-intro/intro.mp4 (1280x720, 2.5 s)
```

Needs Node with Playwright, and `ffmpeg` on the PATH.

## Add it to a video

```bash
tools/guide-video/add_intro.sh docs/video/NAME-raw.mp4 docs/video/NAME.mp4 /tmp/vifug-intro/intro.mp4
```

Works with or without a narration track: a silent lead-in is added to the audio
so the voice stays in step with the picture. Run it on the finished recording
(captions and narration already in), and run it once only, or the logo plays twice.

## After adding the intro

- Every video is 2.5 seconds longer. Update the "N seconds" label next to the
  video in `docs/guide.html` (and `docs/index.html` for the landing-page video).
- The poster image (`docs/video/NAME.jpg`) stays the first frame of the
  recording, not the logo.

## Making a new video

1. Write `tools/guide-video/scenarios/NAME.cjs` (see `_smoke.cjs`): steps, each with a caption and a spoken line.
2. `node rec.cjs say|record ...` records the real app (a web build served locally) and `tts.py synth|assemble` voices and assembles it.
3. The voice is Kokoro `am_adam` at 1.1x, the closest Kokoro match to the voice on the original sixteen videos
   (about 120 Hz vs 107 Hz, similar tone, slightly slower). It is not identical: the originals use a different engine.
4. `assemble` adds the logo intro. Only show what the guide says; use an explainer card for anything the web build cannot show.
