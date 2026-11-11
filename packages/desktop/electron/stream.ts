/**
 * Live streaming to YouTube, Facebook, Twitch and any other RTMP server.
 *
 * The renderer records the live output (the same surface the recorder uses)
 * as WebM and hands the chunks over as they arrive. ffmpeg, running here,
 * re-encodes them to H.264 + AAC - the only thing the platforms accept - and
 * pushes to every destination at once. One encode, many outputs: the "tee"
 * muxer copies the encoded stream to each server, so a second platform costs
 * upload bandwidth and nothing else, and one server refusing the stream does
 * not take the others down (onfail=ignore).
 *
 * ffmpeg ships beside the app (resources/ffmpeg, put there at build time by
 * fetch-ffmpeg.ts). A copy on the PATH is the fallback, which is what a
 * development checkout and a Linux box with ffmpeg installed both have.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type StreamStartOptions = {
  /** Full RTMP(S) URLs, stream key included. */
  urls: string[];
  /** Output height: 720 or 1080. */
  height: number;
  fps: number;
  videoKbps: number;
  /** False when the capture has no sound: a silent track is added, because
   *  the platforms refuse a stream with no audio at all. */
  hasAudio: boolean;
};

export type StreamState = {
  running: boolean;
  /** Set when the stream ended on its own. */
  error: string | null;
};

let proc: ChildProcessWithoutNullStreams | null = null;
let lastLog = "";
let notify: (s: StreamState) => void = () => {};

export function onStreamState(cb: (s: StreamState) => void) {
  notify = cb;
}

export function ffmpegPath(): string | null {
  const exe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const bundled = path.join(process.resourcesPath ?? "", "ffmpeg", exe);
  if (fs.existsSync(bundled)) return bundled;
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (dir && fs.existsSync(path.join(dir, exe))) return path.join(dir, exe);
  }
  return null;
}

/** rtmp:// or rtmps:// only, and nothing that could break out of the tee list. */
function validUrl(u: string): boolean {
  return /^rtmps?:\/\/[^\s|\[\]]+$/i.test(u);
}

/** A stream key must never reach a log file or the screen. */
function redact(text: string, urls: string[]): string {
  let out = text;
  for (const u of urls) {
    const key = u.slice(u.lastIndexOf("/") + 1);
    if (key.length >= 4) out = out.split(key).join("****");
  }
  return out;
}

export function buildArgs(o: StreamStartOptions): string[] {
  const fps = Math.min(60, Math.max(15, Math.round(o.fps)));
  const kbps = Math.min(12000, Math.max(800, Math.round(o.videoKbps)));
  const height = o.height >= 1080 ? 1080 : 720;
  const args = ["-hide_banner", "-loglevel", "warning", "-fflags", "+genpts", "-thread_queue_size", "512", "-i", "pipe:0"];
  if (!o.hasAudio) args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  args.push("-map", "0:v:0", "-map", o.hasAudio ? "0:a:0" : "1:a:0");
  if (!o.hasAudio) args.push("-shortest");
  args.push(
    "-vf", `scale=-2:${height}`,
    "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-pix_fmt", "yuv420p",
    "-r", String(fps), "-g", String(fps * 2),
    "-b:v", `${kbps}k`, "-maxrate", `${kbps}k`, "-bufsize", `${kbps * 2}k`,
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
  );
  if (o.urls.length === 1) {
    args.push("-f", "flv", o.urls[0]!);
  } else {
    args.push("-flags", "+global_header", "-f", "tee", o.urls.map((u) => `[f=flv:onfail=ignore]${u}`).join("|"));
  }
  return args;
}

export function streamStart(o: StreamStartOptions): { ok: boolean; error?: string } {
  if (proc) return { ok: false, error: "A stream is already running." };
  const urls = (o.urls ?? []).filter(Boolean);
  if (!urls.length) return { ok: false, error: "Add at least one destination with a stream key." };
  if (!urls.every(validUrl)) return { ok: false, error: "A destination address is not a valid rtmp:// or rtmps:// URL." };
  const bin = ffmpegPath();
  if (!bin) return { ok: false, error: "ffmpeg was not found. Reinstall Vifug, or install ffmpeg on this computer." };

  lastLog = "";
  const child = spawn(bin, buildArgs({ ...o, urls }), { windowsHide: true });
  proc = child;
  child.stderr.on("data", (d: Buffer) => {
    lastLog = (lastLog + redact(d.toString(), urls)).slice(-1200);
  });
  // The pipe closing under us (ffmpeg died) must not crash the app.
  child.stdin.on("error", () => {});
  child.on("error", (e) => {
    if (proc === child) proc = null;
    notify({ running: false, error: redact(e.message, urls) });
  });
  child.on("exit", (code) => {
    const wasOurs = proc === child;
    if (wasOurs) proc = null;
    const lines = lastLog.trim().split("\n").filter(Boolean);
    notify({
      running: false,
      // A clean stop is asked for by closing stdin, and exits 0.
      error: wasOurs && code !== 0 ? lines[lines.length - 1] ?? `The stream stopped (ffmpeg exit ${code}).` : null,
    });
  });
  notify({ running: true, error: null });
  return { ok: true };
}

export function streamChunk(data: ArrayBuffer | Uint8Array) {
  if (!proc || proc.stdin.destroyed) return;
  proc.stdin.write(Buffer.from(data as ArrayBuffer));
}

export function streamStop(): { ok: boolean } {
  const child = proc;
  if (!child) return { ok: true };
  proc = null;
  try {
    child.stdin.end();
  } catch {
    /* already closed */
  }
  // Let it flush the last frames to the servers, then insist.
  setTimeout(() => {
    if (child.exitCode === null) child.kill();
  }, 4000);
  return { ok: true };
}

export function streamStatus(): StreamState & { available: boolean } {
  return { running: proc !== null, error: null, available: ffmpegPath() !== null };
}
