import { contextBridge, ipcRenderer } from "electron";

export type RuntimeName = "codex" | "claude";

contextBridge.exposeInMainWorld("pixelOffice", {
  isDesktop: true,
  platform: process.platform,
  connectRuntime: (runtime: RuntimeName) => ipcRenderer.invoke("runtime:connect", runtime),
  installRuntime: (runtime: RuntimeName) => ipcRenderer.invoke("runtime:install", runtime),
});
