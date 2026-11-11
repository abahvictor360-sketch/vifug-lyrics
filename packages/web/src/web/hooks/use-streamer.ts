import { useCallback, useEffect, useRef, useState } from "react";
import { getDesktopAPI } from "../lib/desktop";
import {
  STREAM_QUALITIES,
  destinationUrl,
  loadStreamConfig,
  readyDestinations,
  type StreamConfig,
} from "../lib/stream-destinations";

/**
 * Streams the live output to the destinations in Settings.
 *
 * It captures the same surface the recorder does - the projector window, or
 * an offscreen 1080p copy of the output when no projector is open - so what
 * goes to YouTube is exactly what the room sees, with no operator screens in
 * frame. Chunks go to the desktop app's main process, where ffmpeg encodes
 * them and pushes to every destination (see desktop/electron/stream.ts).
 */

export type StreamerStatus = "idle" | "starting" | "live" | "error";

const PROJECTOR_WINDOW_TITLE = "Vifug Projector";

export function useStreamConfig(): StreamConfig {
  const [config, setConfig] = useState(loadStreamConfig);
  useEffect(() => {
    const sync = () => setConfig(loadStreamConfig());
    window.addEventListener("vifug:stream-config", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("vifug:stream-config", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return config;
}

export function useStreamer(micDeviceId?: string | null) {
  const [status, setStatus] = useState<StreamerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [count, setCount] = useState(0);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const timerRef = useRef<number | null>(null);
  const temporarySurfaceRef = useRef(false);
  /** Chunks must reach ffmpeg in the order they were recorded. */
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const supported = !!getDesktopAPI()?.streamStart;

  const cleanup = useCallback(() => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
    timerRef.current = null;
    const rec = recRef.current;
    recRef.current = null;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current = [];
    if (temporarySurfaceRef.current) {
      void getDesktopAPI()?.recorderRelease?.();
      temporarySurfaceRef.current = false;
    }
  }, []);

  // ffmpeg ending on its own (a wrong key, the network dropping) must show.
  useEffect(() => {
    const off = getDesktopAPI()?.onStreamState?.((state) => {
      if (state.running) return;
      cleanup();
      if (state.error) {
        setError(state.error);
        setStatus("error");
      } else {
        setStatus((s) => (s === "error" ? s : "idle"));
      }
    });
    return off;
  }, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    const desktop = getDesktopAPI();
    if (!desktop?.streamStart || !desktop.listCaptureSources) {
      setStatus("error");
      setError("Streaming needs the desktop app.");
      return;
    }
    const config = loadStreamConfig();
    const urls = readyDestinations(config)
      .map(destinationUrl)
      .filter((u): u is string => !!u);
    if (!urls.length) {
      setStatus("error");
      setError("Add a destination and its stream key in Settings → Streaming & output.");
      return;
    }
    const quality = STREAM_QUALITIES.find((q) => q.id === config.quality) ?? STREAM_QUALITIES[0]!;
    setStatus("starting");
    try {
      const surface = desktop.recorderSurface
        ? await desktop.recorderSurface()
        : { title: PROJECTOR_WINDOW_TITLE, temporary: false };
      temporarySurfaceRef.current = surface.temporary;
      const sources = await desktop.listCaptureSources();
      const target = sources.find((s) => s.kind === "window" && s.name === surface.title);
      if (!target) throw new Error("Could not find the live output to stream.");

      const video = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: target.id,
            maxWidth: 1920,
            maxHeight: 1080,
            maxFrameRate: quality.fps,
          },
        } as unknown as MediaTrackConstraints,
      });
      streamsRef.current = [video];
      const tracks = [...video.getVideoTracks()];

      // The microphone is optional: no device, or permission refused, still
      // streams - with silence, which ffmpeg adds so the platforms accept it.
      let hasAudio = false;
      if (config.microphone) {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({
            audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
            video: false,
          });
          streamsRef.current.push(mic);
          tracks.push(...mic.getAudioTracks());
          hasAudio = mic.getAudioTracks().length > 0;
        } catch {
          hasAudio = false;
        }
      }

      const res = await desktop.streamStart({
        urls,
        height: quality.height,
        fps: quality.fps,
        videoKbps: quality.videoKbps,
        hasAudio,
      });
      if (!res.ok) throw new Error(res.error || "Could not start the stream.");

      // VP8: cheap to encode in real time, and ffmpeg re-encodes it anyway.
      const mimeType = hasAudio ? "video/webm;codecs=vp8,opus" : "video/webm;codecs=vp8";
      const rec = new MediaRecorder(new MediaStream(tracks), {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : "video/webm",
        videoBitsPerSecond: Math.max(6_000_000, quality.videoKbps * 1500),
        audioBitsPerSecond: 160_000,
      });
      recRef.current = rec;
      queueRef.current = Promise.resolve();
      rec.ondataavailable = (e) => {
        if (!e.data.size) return;
        queueRef.current = queueRef.current
          .then(() => e.data.arrayBuffer())
          .then((buf) => getDesktopAPI()?.streamChunk?.(buf))
          .catch(() => {});
      };
      rec.start(250);
      setCount(urls.length);
      setSeconds(0);
      setStatus("live");
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      cleanup();
      void desktop.streamStop?.();
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not start the stream.");
    }
  }, [cleanup, micDeviceId]);

  const stop = useCallback(() => {
    cleanup();
    // After the last chunk has been handed over, so the ending is not cut off.
    void queueRef.current.then(() => getDesktopAPI()?.streamStop?.());
    setStatus("idle");
  }, [cleanup]);

  const toggle = useCallback(() => {
    if (status === "live" || status === "starting") stop();
    else void start();
  }, [status, start, stop]);

  useEffect(
    () => () => {
      cleanup();
      void getDesktopAPI()?.streamStop?.();
    },
    [cleanup],
  );

  return { supported, status, error, seconds, count, start, stop, toggle, clearError: () => setError(null) };
}
