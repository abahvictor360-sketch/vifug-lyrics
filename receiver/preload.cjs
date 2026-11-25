"use strict";
const { contextBridge, ipcRenderer } = require("electron");

// The control window's only way to the main process. Remote pages never get this.
contextBridge.exposeInMainWorld("receiver", {
  platform: process.platform,
  init: () => ipcRenderer.invoke("init"),
  openViewer: (o) => ipcRenderer.invoke("viewer:open", o),
  closeViewer: () => ipcRenderer.invoke("viewer:close"),
  startCamera: (o) => ipcRenderer.invoke("camera:start", o),
  stopCamera: () => ipcRenderer.invoke("camera:stop"),
  saveSettings: (s) => ipcRenderer.invoke("settings:save", s),
  onState: (fn) => ipcRenderer.on("state", (_e, s) => fn(s)),
});
