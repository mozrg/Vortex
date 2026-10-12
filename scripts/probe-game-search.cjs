// Temporary diagnostic: drives the new "add game by name" dropdown on a stubbed bridge.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('host-resolver-rules', 'MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1');

const stub = `
window.vortexDesktop = Object.assign(window.vortexDesktop || {}, {
  searchGames: ({ query }) => new Promise((resolve) => {
    window.__searchCalls = (window.__searchCalls || []).concat(query);
    setTimeout(() => resolve({ items: [
      { id: '2753915549', title: 'Blox Fruits', creatorName: 'Gamer Robot', playerCount: 1234567, thumbnail: '', description: 'Пиратское приключение' },
      { id: '6516141723', title: 'Doors', creatorName: 'LSPLASH', playerCount: 54321, thumbnail: '', description: 'Хоррор' }
    ] }), 60);
  }),
  openGame: () => Promise.resolve('player'),
  getUpdateState: () => Promise.resolve({ status: 'development', currentVersion: '1.0.17' }),
  onUpdateState: () => () => {}
});
`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 940, show: false, webPreferences: { contextIsolation: true, sandbox: true } });
  const errors = [];
  window.webContents.on('console-message', (_event, level, message) => { if (level >= 2) errors.push(message); });

  const load = window.loadFile(path.join(__dirname, '..', 'index.html'));
  await Promise.race([load.catch(() => {}), wait(6000)]);
  await wait(1500);
  await window.webContents.executeJavaScript(stub).catch(() => {});
  await window.webContents.executeJavaScript(`localStorage.setItem('vortex.preferences', JSON.stringify({ settingsTab: 'home', language: 'ru' }))`).catch(() => {});
  window.webContents.reload();
  await wait(4000);
  await wait(1500);
  await window.webContents.executeJavaScript(stub).catch(() => {});
  await wait(500);
  await window.webContents.executeJavaScript(`document.querySelector('[data-nav="settings"]')?.click()`).catch(() => {});
  await wait(700);

  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('[data-game-search]');
    if (!input) return false;
    input.value = 'blox';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`).catch(() => {});
  await wait(1500);

  const dropdown = await window.webContents.executeJavaScript(`(() => {
    const list = document.querySelector('.game-search-results');
    return {
      fieldPresent: Boolean(document.querySelector('[data-game-search]')),
      visible: Boolean(list && !list.hidden),
      options: [...document.querySelectorAll('.game-search-option')].map((b) => b.querySelector('strong').textContent),
      searchCalls: window.__searchCalls || []
    };
  })()`).catch((error) => ({ error: error.message }));

  await window.webContents.executeJavaScript(`document.querySelector('[data-game-search]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))`).catch(() => {});
  await wait(300);
  const highlighted = await window.webContents.executeJavaScript(`document.querySelector('.game-search-option.active')?.querySelector('strong')?.textContent || null`).catch(() => null);
  await window.webContents.executeJavaScript(`document.querySelector('[data-game-search]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`).catch(() => {});
  await wait(900);

  const added = await window.webContents.executeJavaScript(`(() => {
    const stored = JSON.parse(localStorage.getItem('vortex.preferences') || '{}');
    return {
      customGames: (stored.customGames || []).map((g) => g.title),
      featured: stored.homeFeaturedGame,
      rows: document.querySelectorAll('[data-home-featured]').length,
      dropdownClosed: document.querySelector('.game-search-results')?.hidden ?? true
    };
  })()`).catch((error) => ({ error: error.message }));

  console.log('DROPDOWN:', JSON.stringify(dropdown));
  console.log('HIGHLIGHTED:', highlighted);
  console.log('ADDED:', JSON.stringify(added));
  console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 8).join(' | ') : 'none');
  app.exit(0);
});
