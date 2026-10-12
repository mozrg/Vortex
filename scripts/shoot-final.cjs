// Temporary diagnostic: screenshot of the home page and of Settings → Home.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

app.commandLine.appendSwitch('disable-gpu');
const outputDir = path.join(__dirname, '..', 'dist-update-test', 'screens');

async function shoot(window, name) {
  await new Promise((resolve) => setTimeout(resolve, 800));
  const image = await window.webContents.capturePage();
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, `${name}.png`), image.toPNG());
  console.log('saved', name);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 940, show: true, webPreferences: { contextIsolation: true, sandbox: true } });
  await window.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await window.webContents.executeJavaScript(`(() => {
    localStorage.setItem('vortex.preferences', JSON.stringify({ accent: '#9b7cff', accentMode: 'solid', theme: 'dark', density: 'comfortable', homeLayout: 'balanced', homeSkin: 'aurora', homeShowHero: true, homeShowRecommendations: true, homeGameCount: 4, settingsTab: 'home' }));
    localStorage.setItem('vortex.favorites', JSON.stringify(['2753915549','6516141723']));
  })()`);
  await window.webContents.reload();
  await new Promise((resolve) => setTimeout(resolve, 2400));
  await shoot(window, 'home-final');
  await window.webContents.executeJavaScript(`document.querySelector('[data-nav="settings"]')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 900));
  await shoot(window, 'settings-home');
  app.exit(0);
});
