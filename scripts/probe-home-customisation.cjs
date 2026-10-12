// Temporary diagnostic: loads index.html in Electron, drives the home page customisation
// panel and reports console errors plus the resulting state.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, '..', 'electron', 'preload.cjs') }
  });
  const errors = [];
  window.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) errors.push(message);
  });
  window.webContents.on('render-process-gone', (_event, details) => errors.push(`renderer gone: ${details.reason}`));

  await window.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const probe = `(() => {
    const panel = document.querySelector('.home-quick');
    const result = {
      panelPresent: Boolean(panel),
      layoutButtons: document.querySelectorAll('.home-quick [data-pref="homeLayout"]').length,
      skinButtons: document.querySelectorAll('.home-quick [data-pref="homeSkin"]').length,
      swatches: document.querySelectorAll('.quick-swatch').length,
      toggles: document.querySelectorAll('.quick-toggle').length,
      colorPicker: Boolean(document.querySelector('.quick-color input[type="color"]')),
      layoutAttr: document.querySelector('[data-home-view]')?.dataset.homeLayout,
      skinAttr: document.querySelector('[data-home-view]')?.dataset.homeSkin,
      bodyLayout: document.body.dataset.homeLayout,
      bodySkin: document.body.dataset.homeSkin
    };
    // Toggle "games only" and read the stored preference back.
    const minimal = document.querySelector('.quick-toggle[data-toggle="homeMinimal"]');
    minimal?.click();
    return result;
  })()`;
  const before = await window.webContents.executeJavaScript(probe);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const after = await window.webContents.executeJavaScript(`(() => {
    const stored = JSON.parse(localStorage.getItem('vortex.preferences') || '{}');
    const segment = document.querySelector('.home-quick [data-pref="homeSkin"][data-value="grid"]');
    segment?.click();
    return { minimalStored: stored.homeMinimal, bodyHasMinimalClass: document.body.classList.contains('home-minimal') };
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const final = await window.webContents.executeJavaScript(`(() => {
    const stored = JSON.parse(localStorage.getItem('vortex.preferences') || '{}');
    return { skinStored: stored.homeSkin, skinAttr: document.querySelector('[data-home-view]')?.dataset.homeSkin, bodySkin: document.body.dataset.homeSkin };
  })()`);

  console.log('BEFORE:', JSON.stringify(before, null, 2));
  console.log('AFTER TOGGLE:', JSON.stringify(after, null, 2));
  console.log('FINAL:', JSON.stringify(final, null, 2));
  console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 10).join(' | ') : 'none');
  app.exit(0);
});
