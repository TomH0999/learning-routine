const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  onUpdate: (cb) => ipcRenderer.on("update", (_e, s) => cb(s)),
  install: () => ipcRenderer.send("install-update")
});
