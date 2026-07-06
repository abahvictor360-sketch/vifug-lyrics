/**
 * Native NDI output (optional).
 *
 * Publishes a BrowserWindow's rendered frames as an NDI source on the local
 * network using the `grandiose` native addon + the NewTek/NDI runtime. Both are
 * OPTIONAL: if either is missing we degrade gracefully (`available: false`) and
 * the app keeps working — the operator can still use the OBS → NDI bridge.
 *
 * Nothing here is imported unless the desktop app runs, and `grandiose` is
 * loaded via a guarded require so a missing addon never crashes the process or
 * the build.
 */
import { createRequire } from "node:module";
import type { BrowserWindow, NativeImage } from "electron";

const require = createRequire(import.meta.url);

export type NdiStatus = {
  available: boolean;
  running: boolean;
  sourceName?: string;
  reason?: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
let grandiose: any = null;
let loadTried = false;
let loadError: string | undefined;

function loadGrandiose(): any {
  if (loadTried) return grandiose;
  loadTried = true;
  try {
    grandiose = require("grandiose");
  } catch (err) {
    grandiose = null;
    loadError = err instanceof Error ? err.message : "addon_missing";
  }
  return grandiose;
}

let sender: any = null;
let running = false;
let currentName = "Vifug Lyrics";
let currentFrameRate = 30;
let frameIntervalMs = 1000 / 30;
let lastFrame = 0;
let boundWin: BrowserWindow | null = null;

export function ndiStatus(): NdiStatus {
  const g = loadGrandiose();
  if (!g) return { available: false, running: false, reason: loadError ?? "addon_missing" };
  return { available: true, running, sourceName: running ? currentName : undefined };
}

export async function ndiStart(
  win: BrowserWindow | null,
  opts: { sourceName: string; frameRate: number },
): Promise<NdiStatus> {
  const g = loadGrandiose();
  if (!g) return ndiStatus();

  currentName = opts.sourceName?.trim() || "Vifug Lyrics";
  currentFrameRate = Math.max(1, Math.min(60, opts.frameRate || 30));
  frameIntervalMs = 1000 / currentFrameRate;

  try {
    if (!sender) {
      // grandiose 4.x takes an options object; older builds accept a bare name.
      sender = await (g.send.length >= 1
        ? g.send({ name: currentName, clockVideo: true, clockAudio: false })
        : g.send(currentName));
    }
    running = true;
    attach(win);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "send_failed";
    running = false;
    sender = null;
    return { available: true, running: false, reason: loadError };
  }
  return ndiStatus();
}

export async function ndiStop(): Promise<NdiStatus> {
  running = false;
  detach();
  try {
    await sender?.destroy?.();
  } catch {
    /* ignore */
  }
  sender = null;
  return ndiStatus();
}

/** Re-point the capture at a new window (e.g. projector reopened). No-op if off. */
export function ndiRebind(win: BrowserWindow | null): void {
  if (running) attach(win);
}

function attach(win: BrowserWindow | null): void {
  detach();
  if (!win || win.isDestroyed()) return;
  boundWin = win;
  win.webContents.beginFrameSubscription(false, onFrame);
}

function detach(): void {
  if (boundWin && !boundWin.isDestroyed()) {
    try {
      boundWin.webContents.endFrameSubscription();
    } catch {
      /* ignore */
    }
  }
  boundWin = null;
}

function onFrame(image: NativeImage): void {
  if (!running || !sender) return;
  const now = Date.now();
  if (now - lastFrame < frameIntervalMs) return; // throttle to target fps
  lastFrame = now;

  const { width, height } = image.getSize();
  if (!width || !height) return;
  const data = image.getBitmap(); // BGRA, top-down

  try {
    const g = grandiose;
    sender.video({
      type: "video",
      xres: width,
      yres: height,
      frameRateN: currentFrameRate * 1000,
      frameRateD: 1000,
      pictureAspectRatio: width / height,
      frameFormatType: g.FRAME_FORMAT_TYPE_PROGRESSIVE ?? 1,
      timecode: 0n,
      fourCC: g.FOURCC_BGRA ?? g.BGRA ?? 0,
      lineStrideBytes: width * 4,
      data,
    });
  } catch {
    /* drop this frame; keep the sender alive */
  }
}
