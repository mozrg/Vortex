// Temporary diagnostic: opens Settings → Home and drives the new home customisation
// controls, reporting state and console errors.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const errors = [];
  window.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) errors.push(message);
  });

  await window.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise((resolve) => setTimeout(resolve, 2200));
  // Open Settings → Home tab.
  await window.webContents.executeJavaScript(`(() => {
    const stored = JSON.parse(localStorage.getItem('vortex.preferences') || '{}');
    stored.settingsTab = 'home';
    localStorage.setItem('vortex.preferences', JSON.stringify(stored));
  })()`);
  await window.webContents.reload();
  await new Promise((resolve) => setTimeout(resolve, 2200));
  await window.webContents.executeJavaScript(`document.querySelector('[data-nav="settings"]')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 700));

  const panel = await window.webContents.executeJavaScript(`(() => {
    const card = document.querySelector('.settings-panel');
    const read = (pref) => Array.from(document.querySelectorAll('[data-pref="' + pref + '"]')).map((b) => b.dataset.value + (b.classList.contains('active') ? '*' : ''));
    return {
      homeQuickOnHomePage: Boolean(document.querySelector('.home-quick')),
      layoutOptions: read('homeLayout'),
      skinOptions: read('homeSkin'),
      densityOptions: read('density'),
      toggles: Array.from(document.querySelectorAll('.settings-panel [data-toggle]')).map((b) => b.dataset.toggle + '=' + b.getAttribute('aria-checked')),
      panelsText: (card?.innerText || '').includes('undefined')
    };
  })()`);

  const switched = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('[data-pref="homeLayout"][data-value="spotlight"]')?.click();
    return true;
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const after = await window.webContents.executeJavaScript(`(() => {
    const stored = JSON.parse(localStorage.getItem('vortex.preferences') || '{}');
    document.querySelector('[data-pref="homeSkin"][data-value="grid"]')?.click();
    return { layoutStored: stored.homeLayout };
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const finalState = await window.webContents.executeJavaScript(`(() => {
    const stored = JSON.parse(localStorage.getItem('vortex.preferences') || '{}');
    document.querySelector('[data-nav="home"]')?.click();
    return { skinStored: stored.homeSkin, bodySkin: document.body.dataset.homeSkin, bodyLayout: document.body.dataset.homeLayout };
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 600));
  const homePage = await window.webContents.executeJavaScript(`({
    homeQuickPresent: Boolean(document.querySelector('.home-quick')),
    homeViewLayout: document.querySelector('[data-home-view]')?.dataset.homeLayout,
    homeViewSkin: document.querySelector('[data-home-view]')?.dataset.homeSkin
  })`);

  console.log('SETTINGS PANEL:', JSON.stringify(panel, null, 2));
  console.log('SWITCHED:', switched, JSON.stringify(after));
  console.log('FINAL:', JSON.stringify(finalState), JSON.stringify(homePage));
  console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 8).join(' | ') : 'none');
  app.exit(0);
});
