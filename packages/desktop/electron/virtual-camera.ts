/**
 * Windows virtual camera output.
 *
 * Publishes the live screen as a system camera device, so OBS, vMix and
 * ProPresenter can pick "Vifug" out of their ordinary Video Capture Device
 * list with no plugin and no URL to paste. The camera itself is a small
 * DirectShow filter installed alongside the app (packages/virtual-camera);
 * this is the half that lives in Vifug and feeds it pictures.
 *
 * Vifug is the SERVER on the pipe and the hosts are clients. That direction
 * is deliberate: the driver is loaded inside OBS, which may be started before
 * Vifug or left running after it, and a client that simply retries is far
 * easier to reason about than a device that has to be told to go away.
 *
 * Everything here degrades quietly. Off Windows, or with the driver not
 * installed, `available` is false and the app is otherwise unaffected.
 */
import { createServer, type Server, type Socket } from "node:net";
import { execFile } from "node:child_process";
import type { BrowserWindow, NativeImage } from "electron";

const PIPE = "\\\\.\\pipe\\vifug-camera-v1";

/** Must match src/wire.h in packages/virtual-camera/windows. */
const FRAME_MAGIC = 0x4d524656;
const REQ_MAGIC = 0x51455256;
const WIRE_VERSION = 1;
const FMT_BGRA32 = 0;
const FRAME_HEADER_BYTES = 32;
const REQUEST_BYTES = 20;

/** The driver treats a frame older than 2s as stale, so a still slide is repeated. */
const IDLE_REPEAT_MS = 500;

/** The CLSID the driver registers itself under; see filter.cpp. */
const DRIVER_CLSID = "{7E3F1A52-9C4D-4B86-9F1C-2A5D8E0B7C31}";

export type VirtualCameraStatus = {
  /** Windows, with the driver registered. */
  available: boolean;
  running: boolean;
  /** How many hosts (OBS, vMix, …) are reading right now. */
  consumers: number;
  width?: number;
  height?: number;
  fps?: number;
  framesSent?: number;
  lastFrameAgoMs?: number | null;
  /** The picture comes from our own offscreen window, not a projector. */
  ownWindow?: boolean;
  reason?: string;
};

type Consumer = {
  socket: Socket;
  /** Partial request bytes still waiting for the rest of their message. */
  pending: Buffer;
};

let server: Server | null = null;
let running = false;
let consumers: Consumer[] = [];
let listenError: string | undefined;

let wantWidth = 1280;
let wantHeight = 720;
let wantFps = 30;

let boundWin: BrowserWindow | null = null;
let paintHandler: ((...args: unknown[]) => void) | null = null;
let ownWin: BrowserWindow | null = null;
let makeOwnWin: ((width: number, height: number) => BrowserWindow | null) | null = null;

let framesSent = 0;
let lastSentAt = 0;
let lastFrame: { header: Buffer; pixels: Buffer } | null = null;
let keepalive: ReturnType<typeof setInterval> | null = null;

/* ------------------------------------------------------------------ status */

let driverChecked = false;
let driverPresent = false;

/**
 * Is the driver actually registered?
 *
 * Worth asking rather than assuming: the commonest failure is the app running
 * perfectly and publishing to a pipe that nothing will ever read, because the
 * installer's regsvr32 step was skipped or undone by an antivirus. Reading
 * the CLSID key says so in a way "no consumers" never could.
 */
function checkDriver(): void {
  if (driverChecked || process.platform !== "win32") return;
  driverChecked = true;
  execFile(
    "reg",
    ["query", `HKCR\\CLSID\\${DRIVER_CLSID}\\InprocServer32`],
    { windowsHide: true },
    (err) => {
      driverPresent = !err;
    },
  );
}

export function vcamStatus(): VirtualCameraStatus {
  if (process.platform !== "win32") {
    return { available: false, running: false, consumers: 0, reason: "windows_only" };
  }
  checkDriver();
  return {
    available: driverPresent,
    running,
    consumers: consumers.length,
    width: wantWidth,
    height: wantHeight,
    fps: wantFps,
    framesSent,
    lastFrameAgoMs: lastSentAt ? Date.now() - lastSentAt : null,
    ownWindow: !!ownWin && boundWin === ownWin,
    reason: listenError ?? (driverPresent ? undefined : "driver_not_registered"),
  };
}

/* ------------------------------------------------------------- the pipe */

function readRequests(c: Consumer, chunk: Buffer): void {
  c.pending = c.pending.length ? Buffer.concat([c.pending, chunk]) : chunk;
  while (c.pending.length >= REQUEST_BYTES) {
    const msg = c.pending.subarray(0, REQUEST_BYTES);
    c.pending = c.pending.subarray(REQUEST_BYTES);
    if (msg.readUInt32LE(0) !== REQ_MAGIC) {
      // Not something we understand. Drop the connection rather than guess:
      // a desynchronised stream never recovers by itself.
      c.socket.destroy();
      return;
    }
    if (msg.readUInt16LE(4) !== WIRE_VERSION) continue;
    const width = msg.readUInt32LE(8);
    const height = msg.readUInt32LE(12);
    const fps = Math.round(msg.readUInt32LE(16) / 1000) || 30;
    if (width < 64 || height < 64 || width > 7680 || height > 4320) continue;
    setTarget(width, height, fps);
  }
}

/**
 * Render at the size the host asked for.
 *
 * The alternative - send whatever size we happen to have and let the driver
 * resample - costs nothing on a photograph and is very visible on lyrics,
 * where every letter edge goes soft. Since the host tells us its choice, the
 * honest thing is to draw at it.
 */
function setTarget(width: number, height: number, fps: number): void {
  if (width === wantWidth && height === wantHeight && fps === wantFps) return;
  wantWidth = width;
  wantHeight = height;
  wantFps = fps;
  // Our own window exists only to be captured, so it is rebuilt at the new
  // size. A real projector keeps whatever size its screen gave it, and the
  // resize below happens on the way out instead.
  if (ownWin) rebuildOwnWindow();
}

function send(header: Buffer, pixels: Buffer): void {
  for (const c of consumers) {
    const sock = c.socket;
    if (sock.destroyed) continue;
    // A host that has stopped reading must not grow our heap without limit.
    // Dropping this frame is right: the next one is 33ms away and more
    // current than anything we could queue.
    if (sock.writableLength > pixels.length * 2) continue;
    sock.cork();
    sock.write(header);
    sock.write(pixels);
    sock.uncork();
  }
}

/* ------------------------------------------------------------- capturing */

function onFrame(image: NativeImage): void {
  if (!running || consumers.length === 0) return;

  let img = image;
  const size = img.getSize();
  if (size.width < 2 || size.height < 2) return;

  // Resampling here rather than in the driver when the shapes agree: Skia's
  // filter is better than the driver's, and this keeps the common
  // projector-at-1080p / host-at-720p case sharp.
  if (size.width !== wantWidth || size.height !== wantHeight) {
    const srcAspect = size.width / size.height;
    const wantAspect = wantWidth / wantHeight;
    if (Math.abs(srcAspect - wantAspect) / wantAspect < 0.01) {
      img = img.resize({ width: wantWidth, height: wantHeight, quality: "better" });
    }
  }

  const out = img.getSize();
  const pixels = img.getBitmap();
  // A HiDPI capture hands back more pixels than the DIP size claims; trust
  // the buffer, not the reported size, or every row lands half a row out.
  const scale = Math.round(Math.sqrt(pixels.length / 4 / (out.width * out.height)) * 100) / 100;
  const width = Math.round(out.width * (scale || 1));
  const height = Math.round(out.height * (scale || 1));
  if (pixels.length !== width * height * 4) return;

  const header = Buffer.allocUnsafe(FRAME_HEADER_BYTES);
  header.writeUInt32LE(FRAME_MAGIC, 0);
  header.writeUInt16LE(WIRE_VERSION, 4);
  header.writeUInt16LE(FMT_BGRA32, 6);
  header.writeUInt32LE(width, 8);
  header.writeUInt32LE(height, 12);
  header.writeUInt32LE(width * 4, 16);
  header.writeUInt32LE(pixels.length, 20);
  header.writeBigUInt64LE(BigInt(Date.now()), 24);

  lastFrame = { header, pixels };
  framesSent++;
  lastSentAt = Date.now();
  send(header, pixels);
}

function attach(win: BrowserWindow | null): void {
  detach();
  if (!win || win.isDestroyed()) return;
  boundWin = win;
  if (win.webContents.isOffscreen()) {
    win.webContents.setFrameRate(wantFps);
    paintHandler = ((_e: unknown, _dirty: unknown, image: NativeImage) =>
      onFrame(image)) as unknown as (...args: unknown[]) => void;
    win.webContents.on("paint", paintHandler as never);
  } else {
    win.webContents.beginFrameSubscription(false, onFrame);
  }
}

function detach(): void {
  if (boundWin && !boundWin.isDestroyed()) {
    try {
      if (paintHandler && boundWin.webContents.isOffscreen()) {
        boundWin.webContents.off("paint", paintHandler as never);
      } else {
        boundWin.webContents.endFrameSubscription();
      }
    } catch {
      /* already torn down */
    }
  }
  paintHandler = null;
  boundWin = null;
}

function openOwnWindow(): BrowserWindow | null {
  if (ownWin && !ownWin.isDestroyed()) return ownWin;
  if (!makeOwnWin) return null;
  try {
    ownWin = makeOwnWin(wantWidth, wantHeight);
    ownWin?.on("closed", () => {
      ownWin = null;
    });
    return ownWin;
  } catch {
    ownWin = null;
    return null;
  }
}

function closeOwnWindow(): void {
  const w = ownWin;
  ownWin = null;
  if (w && !w.isDestroyed()) {
    try {
      w.destroy();
    } catch {
      /* ignore */
    }
  }
}

function rebuildOwnWindow(): void {
  const wasBound = boundWin === ownWin;
  closeOwnWindow();
  if (!running) return;
  const fresh = openOwnWindow();
  if (wasBound || !boundWin) attach(fresh);
}

function startKeepalive(): void {
  stopKeepalive();
  keepalive = setInterval(() => {
    if (!running || !lastFrame || consumers.length === 0) return;
    // Only when the picture has gone quiet. A changing slide already sends at
    // the target rate; this is what stops a still slide ageing into the
    // driver's holding frame.
    if (Date.now() - lastSentAt < IDLE_REPEAT_MS) return;
    lastSentAt = Date.now();
    send(lastFrame.header, lastFrame.pixels);
  }, IDLE_REPEAT_MS);
}

function stopKeepalive(): void {
  if (keepalive) clearInterval(keepalive);
  keepalive = null;
}

/* ------------------------------------------------------------- lifecycle */

export async function vcamStart(
  win: BrowserWindow | null,
  sourceWindow: (width: number, height: number) => BrowserWindow | null,
): Promise<VirtualCameraStatus> {
  if (process.platform !== "win32") return vcamStatus();
  makeOwnWin = sourceWindow;
  if (running) return vcamStatus();

  listenError = undefined;
  framesSent = 0;
  lastSentAt = 0;
  lastFrame = null;

  try {
    server = createServer((socket) => {
      socket.setNoDelay(true);
      const consumer: Consumer = { socket, pending: Buffer.alloc(0) };
      consumers.push(consumer);
      socket.on("data", (chunk) => readRequests(consumer, chunk));
      /*
       * Give the newcomer a picture at once.
       *
       * A projector showing a still slide may not repaint for minutes, so a
       * host that connected in between would sit on the holding frame and
       * look broken. The last frame goes out immediately and the window is
       * nudged to produce a fresh one.
       */
      if (lastFrame) {
        socket.cork();
        socket.write(lastFrame.header);
        socket.write(lastFrame.pixels);
        socket.uncork();
      }
      try {
        boundWin?.webContents.invalidate();
      } catch {
        /* the window went away between frames */
      }
      const drop = () => {
        consumers = consumers.filter((c) => c !== consumer);
        // The last host closing is not a reason to stop: OBS is often
        // restarted mid-service and should find the camera waiting.
      };
      socket.on("close", drop);
      socket.on("error", drop);
    });
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(PIPE, () => resolve());
    });
  } catch (err) {
    listenError = err instanceof Error ? err.message : "listen_failed";
    server = null;
    return vcamStatus();
  }

  running = true;
  attach(win ?? openOwnWindow());
  startKeepalive();
  return vcamStatus();
}

export async function vcamStop(): Promise<VirtualCameraStatus> {
  running = false;
  stopKeepalive();
  detach();
  closeOwnWindow();
  for (const c of consumers) c.socket.destroy();
  consumers = [];
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
  lastFrame = null;
  framesSent = 0;
  lastSentAt = 0;
  return vcamStatus();
}

/** Re-point at a new window (a projector opened or closed). No-op when off. */
export function vcamRebind(win: BrowserWindow | null): void {
  if (!running) return;
  attach(win ?? openOwnWindow());
  if (win) closeOwnWindow();
}
