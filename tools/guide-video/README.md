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
