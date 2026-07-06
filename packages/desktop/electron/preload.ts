import { ipcRenderer, contextBridge } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,

  // Dialog
  showOpenDialog: (opts: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke("dialog:open", opts),
  showSaveDialog: (opts: Electron.SaveDialogOptions) =>
    ipcRenderer.invoke("dialog:save", opts),

  // File system
  readFile: (path: string) => ipcRenderer.invoke("fs:read", path),
  writeFile: (path: string, data: string) =>
    ipcRenderer.invoke("fs:write", path, data),

  // Notifications
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke("notification:show", title, body),

  // Window controls
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),

  // Displays + projector (second-monitor output)
  listDisplays: () => ipcRenderer.invoke("displays:list"),
  openProjector: (opts: { displayId?: number; fullscreen?: boolean }) =>
    ipcRenderer.invoke("projector:open", opts),
  closeProjector: () => ipcRenderer.invoke("projector:close"),
  projectorStatus: () => ipcRenderer.invoke("projector:status"),
  onProjectorState: (cb: (state: { open: boolean; displayId?: number }) => void) => {
    const listener = (_: unknown, state: { open: boolean; displayId?: number }) => cb(state);
    ipcRenderer.on("projector:state", listener);
    return () => ipcRenderer.removeListener("projector:state", listener);
  },

  // NDI output (native, optional)
  ndiStatus: () => ipcRenderer.invoke("ndi:status"),
  ndiStart: (opts: { sourceName: string; frameRate: number }) =>
    ipcRenderer.invoke("ndi:start", opts),
  ndiStop: () => ipcRenderer.invoke("ndi:stop"),

  // Events from main → renderer
  onDeepLink: (cb: (url: string) => void) => {
    ipcRenderer.on("deep-link", (_, url) => cb(url));
    return () => ipcRenderer.removeAllListeners("deep-link");
  },
});
