// Temporary diagnostic: screenshots of the new interface tab and the game search dropdown,
// plus a check that the floating hover preview appears.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('host-resolver-rules', 'MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1');
const outputDir = path.join(__dirname, '..', 'dist-update-test', 'screens');

const stub = `window.vortexDesktop = Object.assign(window.vortexDesktop || {}, {
  searchGames: ({ query }) => Promise.resolve({ items: [
    { id: '2753915549', title: 'Blox Fruits', creatorName: 'Gamer Robot', playerCount: 1234567, thumbnail: '', description: 'Пиратское приключение' },
    { id: '6516141723', title: 'Doors', creatorName: 'LSPLASH', playerCount: 54321, thumbnail: '', description: 'Хоррор' },
    { id: '920587237', title: 'Adopt Me!', creatorName: 'Uplift Games', playerCount: 98765, thumbnail: '', description: 'Питомцы' }
  ] }),
  getUpdateState: () => Promise.resolve({ status: 'development', currentVersion: '1.0.17' }),
  onUpdateState: () => () => {}
});`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shoot(window, name) {
  await wait(700);
  const image = await window.webContents.capturePage();
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, `${name}.png`), image.toPNG());
  console.log('saved', name);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 940, show: true, webPreferences: { contextIsolation: true, sandbox: true } });
  const load = window.loadFile(path.join(__dirname, '..', 'index.html'));
  await Promise.race([load.catch(() => {}), wait(6000)]);
  await wait(1500);
  await window.webContents.executeJavaScript(stub).catch(() => {});
  await window.webContents.executeJavaScript(`localStorage.clear(); localStorage.setItem('vortex.preferences', JSON.stringify({ settingsTab: 'interface', language: 'ru', accent: '#9b7cff' }))`).catch(() => {});
  window.webContents.reload();
  await wait(4000);
  await window.webContents.executeJavaScript(stub).catch(() => {});
  await wait(400);
  await window.webContents.executeJavaScript(`document.querySelector('[data-nav="settings"]')?.click()`).catch(() => {});
  await wait(900);
  await shoot(window, 'settings-interface');

  // Hover preview check on a density option in the Cards tab.
  await window.webContents.executeJavaScript(`document.querySelector('[data-settings-tab="cards"]')?.click()`).catch(() => {});
  await wait(800);
  const preview = await window.webContents.executeJavaScript(`(() => {
    const target = document.querySelector('[data-preview="density:compact"]');
    target?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const layer = document.getElementById('hover-preview-layer');
    return { target: Boolean(target), layerVisible: Boolean(layer && !layer.hidden), label: layer?.querySelector('.hover-preview-label')?.textContent || null };
  })()`).catch((error) => ({ error: error.message }));
  await shoot(window, 'cards-hover-preview');
  console.log('HOVER PREVIEW:', JSON.stringify(preview));

  // Game search dropdown on the Home tab.
  await window.webContents.executeJavaScript(`document.querySelector('[data-settings-tab="home"]')?.click()`).catch(() => {});
  await wait(800);
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('[data-game-search]');
    input.value = 'blox';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`).catch(() => {});
  await wait(1400);
  await shoot(window, 'home-game-search');

  app.exit(0);
});
