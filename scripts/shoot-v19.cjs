// Temporary diagnostic: screenshots of the six follow-up fixes.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('host-resolver-rules', 'MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const screens = path.join(__dirname, '..', 'dist-update-test', 'screens');

async function shoot(window, name) {
  await wait(600);
  const image = await window.webContents.capturePage();
  await fs.mkdir(screens, { recursive: true });
  await fs.writeFile(path.join(screens, `${name}.png`), image.toPNG());
  console.log('saved', name);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 940, show: true, webPreferences: { contextIsolation: true, sandbox: true } });
  const errors = [];
  window.webContents.on('console-message', (_event, level, message) => { if (level >= 2) errors.push(message); });
  const load = window.loadFile(path.join(__dirname, '..', 'index.html'));
  await Promise.race([load.catch(() => {}), wait(6000)]);
  await wait(1500);
  await window.webContents.executeJavaScript(`localStorage.clear(); localStorage.setItem('vortex.preferences', JSON.stringify({ settingsTab: 'home', language: 'ru', customGames: [
    { id: '2753915549', title: 'Blox Fruits', creator: 'Gamer Robot', description: 'Стань мастером фруктов и отправляйся в плавание.', art: 'live', thumbnail: '' },
    { id: '6516141723', title: 'DOORS', creator: 'LSPLASH', description: 'Открывай двери осторожно.', art: 'live', thumbnail: '' }
  ], homeFeaturedGame: '2753915549', homePicks: ['6516141723'] }))`).catch(() => {});
  window.webContents.reload();
  await wait(4000);

  await window.webContents.executeJavaScript(`document.querySelector('[data-nav="settings"]')?.click()`).catch(() => {});
  await wait(800);
  await shoot(window, 'v19-settings-home');
  await window.webContents.executeJavaScript(`document.querySelector('[data-settings-tab="interface"]')?.click()`).catch(() => {});
  await wait(700);
  await shoot(window, 'v19-settings-interface');

  // Light theme screenshots.
  await window.webContents.executeJavaScript(`(() => { preferences.theme = 'light'; savePreferences(); renderPage(); })()`).catch(() => {});
  await wait(800);
  await shoot(window, 'v19-light-settings');
  await window.webContents.executeJavaScript(`document.querySelector('[data-settings-tab="home"]')?.click()`).catch(() => {});
  await wait(700);
  await shoot(window, 'v19-light-home-tab');
  await window.webContents.executeJavaScript(`document.querySelector('[data-nav="home"]')?.click()`).catch(() => {});
  await wait(700);
  await shoot(window, 'v19-light-home');

  // Tray window screenshot (loads tray.html standalone).
  const trayWindow = new BrowserWindow({ width: 316, height: 436, show: true, frame: false, transparent: true, webPreferences: { preload: path.join(__dirname, '..', 'electron', 'tray-preload.cjs'), contextIsolation: true, sandbox: true } });
  const trayLoad = trayWindow.loadFile(path.join(__dirname, '..', 'tray.html'));
  await Promise.race([trayLoad.catch(() => {}), wait(4000)]);
  await wait(1000);
  const trayImage = await trayWindow.webContents.capturePage();
  await fs.writeFile(path.join(screens, 'v19-tray-panel.png'), trayImage.toPNG());
  console.log('saved v19-tray-panel');
  trayWindow.destroy();

  console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 8).join(' | ') : 'none');
  app.exit(0);
});
