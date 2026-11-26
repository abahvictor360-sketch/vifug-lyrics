"use strict";
/**
 * Vifug Receiver.
 *
 * Shows another computer's Vifug live screen here, full screen with sound (and
 * transparent if asked), and can present the same picture to other programs as
 * a camera. It never runs Vifug itself: it opens the live pages that the main
 * app already serves on its network address.
 */
const { app, BrowserWindow, ipcMain, screen } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { Discovery, normaliseAddress } = require("./lib/discovery.cjs");
const { CameraSink } = require("./lib/camera.cjs");

if (!app.requestSingleInstanceLock()) app.quit();

const DEFAULTS = { address: "", view: "projector", background: "black", size: "1920x1080", fps: 30, sound: true, displayId: null, transparent: false };
let settings = { ...DEFAULTS };
const settingsFile = () => path.join(app.getPath("userData"), "receiver.json");

function loadSettings() {
  try {
    settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) };
  } catch {
    settings = { ...DEFAULTS };
  }
}
function saveSettings(patch) {
  settings = { ...settings, ...patch };
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  } catch {
    /* settings are a convenience; never block on them */
  }
  return settings;
}

let control = null;
let viewer = null;
let cam = null; // { win, sink, timer, latest, size, error, origin, opts }
const discovery = new Discovery(() => push());

const pageUrl = (origin, view) => `${origin}/#/${view === "stream" ? "stream" : "projector"}`;

function state() {
  const c = cam && cam.sink ? cam.sink.status() : null;
  return {
    vifugs: discovery.list().map(({ id, name, origin, version }) => ({ id, name, origin, version })),
    discoveryError: discovery.error,
    viewerOpen: !!viewer && !viewer.isDestroyed(),
    camera: cam
      ? {
          running: !!c && c.running,
          starting: !c,
          frames: c ? c.frames : 0,
          dropped: c ? c.dropped : 0,
          size: cam.size || null,
          error: cam.error || (c && c.error) || null,
        }
      : null,
  };
}
function push() {
  if (control && !control.isDestroyed()) control.webContents.send("state", state());
}

/* ---------- the full-screen view ---------- */

function pickDisplay(id) {
  const all = screen.getAllDisplays();
  return all.find((d) => d.id === id) || screen.getDisplayNearestPoint(control ? control.getBounds() : { x: 0, y: 0 }) || screen.getPrimaryDisplay();
}

function openViewer(o) {
  const origin = normaliseAddress(o.address);
  if (!origin) return { ok: false, error: "Enter or pick a Vifug address first." };
  closeViewer();
  // Transparency only exists on the browser-source page; the projector page is
  // an opaque picture by design.
  const transparent = !!o.transparent;
  const view = transparent ? "stream" : o.view;
  const d = pickDisplay(o.displayId);
  const web = { sandbox: true, contextIsolation: true, nodeIntegration: false, autoplayPolicy: "no-user-gesture-required" };
  viewer = transparent
    ? new BrowserWindow({
        ...d.bounds, frame: false, transparent: true, hasShadow: false, alwaysOnTop: true, skipTaskbar: false,
        backgroundColor: "#00000000", webPreferences: web,
      })
    : new BrowserWindow({ ...d.bounds, fullscreen: true, backgroundColor: "#000000", autoHideMenuBar: true, webPreferences: web });
  viewer.setMenuBarVisibility(false);
  viewer.webContents.on("before-input-event", (e, input) => {
    if (input.type === "keyDown" && input.key === "Escape") {
      e.preventDefault();
      closeViewer();
    }
  });
  viewer.webContents.on("did-finish-load", () => viewer && viewer.webContents.insertCSS("*{cursor:none !important}"));
  viewer.on("closed", () => {
    viewer = null;
    applyCameraSound();
    push();
  });
  viewer.loadURL(pageUrl(origin, view));
  viewer.webContents.setAudioMuted(!o.sound);
  applyCameraSound();
  push();
  return { ok: true };
}
function closeViewer() {
  if (viewer && !viewer.isDestroyed()) viewer.destroy();
  viewer = null;
  applyCameraSound();
  push();
  return { ok: true };
}

/* ---------- the camera ---------- */

/** The hidden page is silent while the full-screen view is playing the sound, so nothing doubles. */
function applyCameraSound() {
  if (!cam || !cam.win || cam.win.isDestroyed()) return;
  const viewerOpen = !!viewer && !viewer.isDestroyed();
  cam.win.webContents.setAudioMuted(!(cam.opts.sound && !viewerOpen));
}

function helperPath() {
  const packaged = path.join(process.resourcesPath || "", "vcam-bridge.exe");
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, "helper", "dist", "vcam-bridge.exe");
}

function startCamera(o) {
  const origin = normaliseAddress(o.address);
  if (!origin) return { ok: false, error: "Enter or pick a Vifug address first." };
  if (process.platform === "darwin") {
    return { ok: false, error: "The camera output is not available on Mac yet. The full-screen view works." };
  }
  stopCamera();
  const [w, h] = String(o.size).split("x").map(Number);
  const fps = Math.max(5, Math.min(60, Number(o.fps) || 30));
  const win = new BrowserWindow({
    show: false, width: w, height: h, useContentSize: true, transparent: true, frame: false,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false, autoplayPolicy: "no-user-gesture-required", backgroundThrottling: false },
  });
  const c = { win, sink: null, timer: null, latest: null, size: null, error: null, origin, opts: { ...o, width: w, height: h, fps } };
  cam = c;
  win.webContents.setFrameRate(fps);
  applyCameraSound();

  const openSink = (size) => {
    if (c.sink) c.sink.stop();
    c.size = size;
    c.sink = new CameraSink({
      inWidth: size.width, inHeight: size.height, width: w, height: h, fps, background: o.background,
      helperPath: process.platform === "win32" ? helperPath() : undefined,
    });
    try {
      c.sink.start();
    } catch (e) {
      c.error = e.message;
      c.sink = null;
      push();
      return;
    }
    c.sink.onExit = () => push();
  };

  // Painting only happens when the page changes, but a camera has to deliver a
  // steady stream. Keep the newest picture and send it on a clock.
  win.webContents.on("paint", (_e, _dirty, image) => {
    const size = image.getSize();
    if (!size.width || !size.height) return;
    if (!c.sink && !c.error) openSink(size);
    else if (c.size && (size.width !== c.size.width || size.height !== c.size.height) && !c.error) openSink(size);
    c.latest = image.toBitmap();
  });
  c.timer = setInterval(() => {
    if (c.sink && c.latest) c.sink.write(c.latest);
    push();
  }, Math.round(1000 / fps));

  win.webContents.on("did-fail-load", (_e, code, desc, url, isMain) => {
    if (!isMain || code === -3) return;
    c.error = `Could not reach ${origin} (${desc}). Check that Vifug is running there.`;
    push();
    setTimeout(() => {
      if (cam === c && !win.isDestroyed()) {
        c.error = null;
        win.loadURL(pageUrl(origin, o.view));
      }
    }, 3000);
  });
  win.loadURL(pageUrl(origin, o.view));
  push();
  return { ok: true };
}

function stopCamera() {
  const c = cam;
  cam = null;
  if (!c) return { ok: true };
  if (c.timer) clearInterval(c.timer);
  if (c.sink) c.sink.stop();
  if (c.win && !c.win.isDestroyed()) c.win.destroy();
  push();
  return { ok: true };
}

/* ---------- the control window ---------- */

function createControl() {
  control = new BrowserWindow({
    width: 560, height: 760, minWidth: 480, minHeight: 560, title: "Vifug Receiver", backgroundColor: "#101018", autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  control.loadFile(path.join(__dirname, "ui", "index.html"));
  control.on("closed", () => {
    control = null;
    closeViewer();
    stopCamera();
    app.quit();
  });
}

ipcMain.handle("init", () => ({
  settings,
  state: state(),
  platform: process.platform,
  displays: screen.getAllDisplays().map((d, i) => ({ id: d.id, label: `Screen ${i + 1} (${d.bounds.width}x${d.bounds.height})` })),
}));
ipcMain.handle("settings:save", (_e, s) => saveSettings(s));
ipcMain.handle("viewer:open", (_e, o) => { saveSettings(o); return openViewer({ ...settings, ...o }); });
ipcMain.handle("viewer:close", () => closeViewer());
ipcMain.handle("camera:start", (_e, o) => { saveSettings(o); return startCamera({ ...settings, ...o }); });
ipcMain.handle("camera:stop", () => stopCamera());

app.on("second-instance", () => { if (control) { if (control.isMinimized()) control.restore(); control.focus(); } });
app.whenReady().then(() => {
  loadSettings();
  discovery.start();
  createControl();
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => { discovery.stop(); stopCamera(); });
