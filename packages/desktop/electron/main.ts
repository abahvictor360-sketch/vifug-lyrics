import { app, BrowserWindow, ipcMain, dialog, Notification, screen } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { startEmbeddedServer } from "./server";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";
const WEB_DEV_URL = process.env.WEBSITE_URL ?? "http://localhost:3000";
const WEB_DIST = path.join(__dirname, "../web-dist");

let baseUrl = WEB_DEV_URL;
let win: BrowserWindow | null;
let projectorWin: BrowserWindow | null = null;

function loadRoute(target: BrowserWindow, route: string) {
  // Hash routing: the web app uses wouter's useHashLocation so routes live
  // after the '#'. Root is "/#/", projector is "/#/projector".
  target.loadURL(`${baseUrl}/#${route}`);
}

async function ensureProductionServer() {
  if (isDev) return;
  const dbFile = path.join(app.getPath("userData"), "vifug.db");
  if (!fsSync.existsSync(dbFile)) {
    // First run: install the bundled, pre-seeded library database.
    const seed = path.join(process.resourcesPath, "seed.db");
    if (fsSync.existsSync(seed)) await fs.copyFile(seed, dbFile);
  }
  const port = await startEmbeddedServer(WEB_DIST, dbFile);
  baseUrl = `http://127.0.0.1:${port}`;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#0a0a0c",
    title: "Vifug Lyrics",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  loadRoute(win, "/");
}

// --- Projector / second-monitor output ---
function serializeDisplays() {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.label || `Display ${i + 1}`,
    bounds: d.bounds,
    size: d.size,
    scaleFactor: d.scaleFactor,
    isPrimary: d.id === primary.id,
    internal: (d as unknown as { internal?: boolean }).internal ?? false,
  }));
}

ipcMain.handle("displays:list", () => serializeDisplays());

ipcMain.handle("projector:open", (_e, opts: { displayId?: number; fullscreen?: boolean }) => {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const target =
    displays.find((d) => d.id === opts?.displayId) ??
    displays.find((d) => d.id !== primary.id) ??
    primary;

  if (projectorWin && !projectorWin.isDestroyed()) {
    projectorWin.setBounds(target.bounds);
    projectorWin.setFullScreen(opts?.fullscreen ?? true);
    projectorWin.show();
    projectorWin.focus();
    return { ok: true, displayId: target.id };
  }

  projectorWin = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    fullscreen: opts?.fullscreen ?? true,
    frame: false,
    backgroundColor: "#000000",
    title: "Vifug Projector",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  loadRoute(projectorWin, "/projector");
  projectorWin.on("closed", () => {
    projectorWin = null;
    win?.webContents.send("projector:state", { open: false });
  });
  win?.webContents.send("projector:state", { open: true, displayId: target.id });
  return { ok: true, displayId: target.id };
});

ipcMain.handle("projector:close", () => {
  if (projectorWin && !projectorWin.isDestroyed()) projectorWin.close();
  projectorWin = null;
  return { ok: true };
});

ipcMain.handle("projector:status", () => ({
  open: !!(projectorWin && !projectorWin.isDestroyed()),
}));

// --- IPC Handlers ---

// Dialog
ipcMain.handle("dialog:open", async (_, opts) => {
  const result = await dialog.showOpenDialog(opts);
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("dialog:save", async (_, opts) => {
  const result = await dialog.showSaveDialog(opts);
  return result.canceled ? null : result.filePath;
});

// File system
ipcMain.handle("fs:read", async (_, filePath: string) => {
  return fs.readFile(filePath, "utf-8");
});

ipcMain.handle("fs:write", async (_, filePath: string, data: string) => {
  await fs.writeFile(filePath, data, "utf-8");
});

// Notifications
ipcMain.handle("notification:show", (_, title: string, body: string) => {
  new Notification({ title, body }).show();
});

// Window controls
ipcMain.handle("window:minimize", () => win?.minimize());
ipcMain.handle("window:maximize", () => {
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});
ipcMain.handle("window:close", () => win?.close());

// --- App lifecycle ---

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(async () => {
  await ensureProductionServer();
  createWindow();
});
