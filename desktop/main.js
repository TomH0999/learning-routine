// Version PC : charge l'app web embarquée (dossier app/), reste dans la zone de notification
// et envoie un rappel Windows chaque heure (8h-22h) tant que l'heure du jour n'est pas faite.
const { app, BrowserWindow, Tray, Menu, Notification, nativeImage } = require("electron");
const path = require("path");
let win, tray, quitting = false;
if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId("io.github.tomh0999.learningroutine");

function createWindow() {
  win = new BrowserWindow({ width: 1000, height: 800, icon: path.join(__dirname, "app/icon.png"), autoHideMenuBar: true });
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
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "app/icon.png")).resize({ width: 16 }));
  tray.setToolTip("Routine d'apprentissage");
  tray.setContextMenu(Menu.buildFromTemplate([{ label: "Ouvrir", click: showWin }, { label: "Quitter", click: () => { quitting = true; app.quit(); } }]));
  tray.on("click", showWin);
  app.setLoginItemSettings({ openAtLogin: true, args: ["--hidden"] });
  if (process.argv.includes("--hidden")) win.hide();
  setTimeout(remind, 60000); setInterval(remind, 60 * 60 * 1000);
});
