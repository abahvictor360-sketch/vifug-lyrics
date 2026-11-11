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
  /** Output height: 720, 1080, 1440 (2K), 2160 (4K) or 4320 (8K). */
  height: number;
  /** Which H.264 encoder to use; "x264" is the software one every machine has. */
  encoder?: StreamEncoder;
  fps: number;
  videoKbps: number;
  /** False when the capture has no sound: a silent track is added, because
   *  the platforms refuse a stream with no audio at all. */
  hasAudio: boolean;
};

export type StreamEncoder = "x264" | "nvenc" | "qsv" | "amf" | "videotoolbox";

/** ffmpeg's name for each encoder, and the options that make it suit a live stream. */
const ENCODERS: Record<StreamEncoder, { name: string; args: string[] }> = {
  x264: { name: "libx264", args: ["-preset", "veryfast", "-tune", "zerolatency"] },
  nvenc: { name: "h264_nvenc", args: ["-preset", "p4", "-tune", "ll", "-rc", "cbr"] },
  qsv: { name: "h264_qsv", args: ["-preset", "veryfast"] },
  amf: { name: "h264_amf", args: ["-usage", "lowlatency"] },
  videotoolbox: { name: "h264_videotoolbox", args: ["-realtime", "1"] },
};

const HEIGHTS = [720, 1080, 1440, 2160, 4320];

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
  const kbps = Math.min(160000, Math.max(800, Math.round(o.videoKbps)));
  const height = HEIGHTS.includes(o.height) ? o.height : 720;
  const enc = ENCODERS[o.encoder ?? "x264"] ?? ENCODERS.x264;
  const args = ["-hide_banner", "-loglevel", "warning", "-fflags", "+genpts", "-thread_queue_size", "512", "-i", "pipe:0"];
  if (!o.hasAudio) args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  args.push("-map", "0:v:0", "-map", o.hasAudio ? "0:a:0" : "1:a:0");
  if (!o.hasAudio) args.push("-shortest");
  args.push(
    // The capture is scaled to the chosen size: down when the screen is
    // bigger, up when it is smaller, so the platform always gets what was
    // asked for.
    "-vf", `scale=-2:${height}:flags=lanczos`,
    "-c:v", enc.name, ...enc.args, "-pix_fmt", "yuv420p",
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

let encoderCache: StreamEncoder[] | null = null;

/**
 * Which encoders this copy of ffmpeg was built with. A hardware encoder being
 * listed means ffmpeg knows how to use it, not that this machine has the chip;
 * choosing one the machine lacks ends the stream with ffmpeg's own message.
 */
async function availableEncoders(): Promise<StreamEncoder[]> {
  if (encoderCache) return encoderCache;
  const bin = ffmpegPath();
  if (!bin) return [];
  const text = await new Promise<string>((resolve) => {
    let out = "";
    try {
      const child = spawn(bin, ["-hide_banner", "-encoders"], { windowsHide: true });
      child.stdout.on("data", (d: Buffer) => (out += d.toString()));
      child.on("error", () => resolve(""));
      child.on("exit", () => resolve(out));
      setTimeout(() => resolve(out), 5000);
    } catch {
      resolve("");
    }
  });
  const found = (Object.keys(ENCODERS) as StreamEncoder[]).filter((k) => text.includes(` ${ENCODERS[k].name} `));
  // macOS only has VideoToolbox; the others are for Windows and Linux.
  const forPlatform = found.filter((k) =>
    k === "x264" ? true : process.platform === "darwin" ? k === "videotoolbox" : k !== "videotoolbox",
  );
  encoderCache = forPlatform.length ? forPlatform : ["x264"];
  return encoderCache;
}

export async function streamStatus(): Promise<StreamState & { available: boolean; encoders: StreamEncoder[] }> {
  return { running: proc !== null, error: null, available: ffmpegPath() !== null, encoders: await availableEncoders() };
}
