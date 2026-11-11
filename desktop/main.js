// Version PC : charge l'app web embarquée (dossier app/), reste dans la zone de notification
// et envoie un rappel Windows chaque heure (8h-22h) tant que l'heure du jour n'est pas faite.
const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
let win, tray, quitting = false;
if (!app.requestSingleInstanceLock()) app.quit();
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.setAppUserModelId("io.github.tomh0999.learningroutine");

function createWindow() {
  win = new BrowserWindow({ width: 1000, height: 800, icon: path.join(__dirname, "icon.png"), autoHideMenuBar: true, backgroundColor: "#050507", show: false, webPreferences: { preload: path.join(__dirname, "preload.js"), spellcheck: false, backgroundThrottling: true } });
  win.once("ready-to-show", () => { if (!process.argv.includes("--hidden")) win.show(); });
  win.loadFile(path.join(__dirname, "app/index.html"));
  win.on("close", (e) => { if (!quitting) { e.preventDefault(); win.hide(); } });
}
const showWin = () => { win.show(); win.focus(); };

async function remind() {
  const h = new Date().getHours(); if (h < 8 || h > 22) return;
  try {
    const s = await win.webContents.executeJavaScript("window.lrStatus && window.lrStatus()");
    if (!s || s.done || s.skipped) return;
    const n = new Notification({ title: "📚 1h d'apprentissage", body: `Il te reste ${s.left} min. Ouvre « Note du cours du jour » !`, timeoutType: "never", urgency: "critical" });
    n.on("click", showWin); n.show();
  } catch {}
}

app.on("second-instance", showWin);
app.whenReady().then(() => {
  createWindow();
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "icon.png")).resize({ width: 32 }));
  tray.setToolTip("Routine d'apprentissage");
  tray.setContextMenu(Menu.buildFromTemplate([{ label: "Ouvrir", click: showWin }, { label: "Quitter", click: () => { quitting = true; app.quit(); } }]));
  tray.on("click", showWin);
  app.setLoginItemSettings({ openAtLogin: true, args: ["--hidden"] });
  if (process.argv.includes("--hidden")) win.hide();
  // Mise à jour automatique depuis les Releases GitHub
  const send = (s) => win && win.webContents.send("update", s);
  autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-available", (i) => send({ state: "available", version: i.version }));
  autoUpdater.on("update-downloaded", (i) => {
    send({ state: "ready", version: i.version });
    new Notification({ title: "Routine : mise à jour prête", body: `Version ${i.version} installée au prochain redémarrage.` }).show();
  });
  autoUpdater.on("error", () => {});
  ipcMain.on("install-update", () => { quitting = true; autoUpdater.quitAndInstall(); });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  ipcMain.handle("check-update", async () => {
    try {
      const r = await autoUpdater.checkForUpdates();
      const v = r && r.updateInfo && r.updateInfo.version;
      return v && v !== app.getVersion() && r.isUpdateAvailable !== false ? { state: "available", version: v } : { state: "none", version: app.getVersion() };
    } catch (e) { return { state: "error", error: String(e.message || e) }; }
  });
  setTimeout(check, 10000); setInterval(check, 4 * 60 * 60 * 1000);
  setTimeout(remind, 60000); setInterval(remind, 60 * 60 * 1000);
});
