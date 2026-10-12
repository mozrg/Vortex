// Temporary diagnostic: renders the home page (plus a couple of customisation variants)
// and saves screenshots for visual review.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

app.commandLine.appendSwitch('disable-gpu');
const outputDir = path.join(__dirname, '..', 'dist-update-test', 'screens');

async function shoot(window, name) {
  await new Promise((resolve) => setTimeout(resolve, 900));
  const image = await window.webContents.capturePage();
  await fs.mkdir(outputDir, { recursive: true });
  const file = path.join(outputDir, `${name}.png`);
  await fs.writeFile(file, image.toPNG());
  console.log('saved', file);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    show: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  await window.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise((resolve) => setTimeout(resolve, 2500));
  // Seed a couple of favourites so the grid is not empty.
  await window.webContents.executeJavaScript(`localStorage.setItem('vortex.favorites', JSON.stringify(['2753915549','6516141723']));`);
  await window.webContents.reload();
  await new Promise((resolve) => setTimeout(resolve, 2600));
  await shoot(window, 'home-default');

  await window.webContents.executeJavaScript(`(() => {
    const stored = JSON.parse(localStorage.getItem('vortex.preferences') || '{}');
    Object.assign(stored, { homeLayout: 'spotlight', homeSkin: 'grid', density: 'compact' });
    localStorage.setItem('vortex.preferences', JSON.stringify(stored));
  })()`);
  await window.webContents.reload();
  await new Promise((resolve) => setTimeout(resolve, 2600));
  await shoot(window, 'home-spotlight-grid');

  await window.webContents.executeJavaScript(`(() => {
    const stored = JSON.parse(localStorage.getItem('vortex.preferences') || '{}');
    Object.assign(stored, { homeLayout: 'library', homeSkin: 'plain', homeMinimal: true });
    localStorage.setItem('vortex.preferences', JSON.stringify(stored));
  })()`);
  await window.webContents.reload();
  await new Promise((resolve) => setTimeout(resolve, 2600));
  await shoot(window, 'home-games-only');

  app.exit(0);
});
