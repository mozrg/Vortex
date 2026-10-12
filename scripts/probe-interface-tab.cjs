// Temporary diagnostic: drives the new Settings → Interface tab.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 940, show: false, webPreferences: { contextIsolation: true, sandbox: true } });
  const errors = [];
  window.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) errors.push(message);
  });

  await window.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise((resolve) => setTimeout(resolve, 2200));
  await window.webContents.executeJavaScript(`localStorage.setItem('vortex.preferences', JSON.stringify({ settingsTab: 'interface', language: 'ru' }))`);
  await window.webContents.reload();
  await new Promise((resolve) => setTimeout(resolve, 2200));
  await window.webContents.executeJavaScript(`document.querySelector('[data-nav="settings"]')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 800));

  const state = await window.webContents.executeJavaScript(`(() => ({
    tabExists: Boolean(document.querySelector('[data-settings-tab="interface"]')),
    orderRows: [...document.querySelectorAll('[data-ui-row]')].map((row) => row.dataset.uiRow),
    sidebarOrder: [...document.querySelectorAll('[data-nav-group] .nav-item')].map((b) => b.dataset.nav),
    toggleCount: document.querySelectorAll('.settings-panel [data-toggle]').length,
    toggles: [...document.querySelectorAll('.settings-panel [data-toggle]')].map((b) => b.dataset.toggle),
    resetButton: Boolean(document.querySelector('[data-action="reset-interface"]'))
  }))()`);

  // Move "settings" up one position and check both the list and the real sidebar.
  await window.webContents.executeJavaScript(`document.querySelector('[data-ui-move="recent"][data-direction="-1"]')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 600));
  const afterMove = await window.webContents.executeJavaScript(`(() => ({
    orderRows: [...document.querySelectorAll('[data-ui-row]')].map((row) => row.dataset.uiRow),
    sidebarOrder: [...document.querySelectorAll('[data-nav-group] .nav-item')].map((b) => b.dataset.nav),
    stored: JSON.parse(localStorage.getItem('vortex.preferences') || '{}').sidebarOrder
  }))()`);

  // Switch off the sidebar tip and the top search.
  await window.webContents.executeJavaScript(`document.querySelector('[data-toggle="uiSidebarTip"]')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await window.webContents.executeJavaScript(`document.querySelector('[data-toggle="uiTopbarSearch"]')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const hidden = await window.webContents.executeJavaScript(`(() => {
    const tip = document.querySelector('.sidebar-tip');
    const search = document.querySelector('.search-field');
    const stored = JSON.parse(localStorage.getItem('vortex.preferences') || '{}');
    return {
      tipHidden: getComputedStyle(tip).display === 'none',
      searchHidden: getComputedStyle(search).display === 'none',
      storedTip: stored.uiSidebarTip,
      storedSearch: stored.uiTopbarSearch
    };
  })()`);

  console.log('TAB STATE:', JSON.stringify(state, null, 2));
  console.log('AFTER MOVE:', JSON.stringify(afterMove));
  console.log('HIDDEN:', JSON.stringify(hidden));
  console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 8).join(' | ') : 'none');
  app.exit(0);
});
