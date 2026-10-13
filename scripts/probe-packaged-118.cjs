// Temporary diagnostic: boots the PACKAGED 1.0.18 app (win-unpacked) with a stubbed
// renderer flow: home page renders only user games, badges work, no console errors.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

app.commandLine.appendSwitch('disable-gpu');
const appRoot = path.join(__dirname, '..', 'dist-update-test', '1.0.18', 'win-unpacked');
const outputDir = path.join(__dirname, '..', 'dist-update-test', 'screens');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.setPath('userData', path.join(__dirname, '..', 'dist-update-test', 'probe-userdata-118'));
app.setPath('sessionData', path.join(__dirname, '..', 'dist-update-test', 'probe-userdata-118'));

// Note: packaged main.cjs runs its own single-instance lock and update check; those
// are inert here because another instance is absent and updates return 'development'.

app.whenReady().then(async () => {
  // Create the window manually with the packaged preload over the asar file URL.
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    show: true,
    webPreferences: {
      preload: path.join(appRoot, 'resources', 'app.asar', 'electron', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true
    }
  });
  const errors = [];
  window.webContents.on('console-message', (_event, level, message) => { if (level >= 2) errors.push(message); });

  const asarPath = path.join(appRoot, 'resources', 'app.asar');
  await window.loadURL('file:///' + (path.join(asarPath, 'index.html')).replace(/\\/g, '/'));
  await wait(2500);

  // Seed games directly through preferences (IPC handlers are not registered in this probe).
  await window.webContents.executeJavaScript(`(async () => {
    // Preload bridge exists; games:search is unhandled, so the renderer will show
    // the desktop-only note. Instead seed games directly through preferences.
    localStorage.clear();
    localStorage.setItem('vortex.preferences', JSON.stringify({
      settingsTab: 'home', language: 'ru',
      customGames: [
        { id: '2753915549', title: 'Blox Fruits', creator: 'Gamer Robot Inc', description: 'Стань сильнейшим мастером фруктов и отправляйся в плавание.', art: 'live', thumbnail: '' },
        { id: '6516141723', title: 'DOORS', creator: 'LSPLASH', description: 'Открывай двери и молись.', art: 'live', thumbnail: '' }
      ],
      homeFeaturedGame: '2753915549',
      homePicks: ['6516141723']
    }));
    location.reload();
  })()`, true).catch(() => {});
  await wait(3500);

  const state = await window.webContents.executeJavaScript(`(() => ({
    version: document.title,
    heroTitle: document.querySelector('.hero-card h2')?.textContent || null,
    heroDescription: document.querySelector('.hero-card .hero-copy p')?.textContent || null,
    heroAvatar: Boolean(document.querySelector('.hero-avatar')),
    heroHasFallbackLetter: Boolean(document.querySelector('.hero-avatar-fallback')),
    cards: [...document.querySelectorAll('.game-card h3')].map((h) => h.textContent),
    cardDescriptions: [...document.querySelectorAll('.game-card .game-description')].map((p) => p.textContent.slice(0, 30)),
    layoutAttr: document.querySelector('.home-view')?.dataset.homeLayout,
    skinAttr: document.querySelector('.home-view')?.dataset.homeSkin,
    logoFilter: getComputedStyle(document.querySelector('.brand-logo')).filter
  }))()`).catch((e) => ({ error: e.message }));
  console.log('PACKAGED APP STATE:', JSON.stringify(state));

  // Settings badges in the packaged bundle.
  await window.webContents.executeJavaScript(`document.querySelector('[data-nav="settings"]')?.click()`).catch(() => {});
  await wait(900);
  const badges = await window.webContents.executeJavaScript(`(() => ({
    rows: [...document.querySelectorAll('.custom-game-row')].map((row) => ({
      title: row.querySelector('.home-game-copy strong')?.textContent,
      bannerActive: row.querySelector('[data-banner-pick]')?.classList.contains('active'),
      picksActive: row.querySelector('[data-picks-pick]')?.classList.contains('active')
    })),
    heroStyleSetting: Boolean(document.querySelector('[data-pref="homeHeroStyle"]'))
  }))()`).catch((e) => ({ error: e.message }));
  console.log('PACKAGED BADGES:', JSON.stringify(badges));

  // Toggle the banner badge and check the home page follows.
  await window.webContents.executeJavaScript(`document.querySelector('[data-banner-pick="6516141723"]')?.click()`).catch(() => {});
  await wait(700);
  await window.webContents.executeJavaScript(`document.querySelector('[data-nav="home"]')?.click()`).catch(() => {});
  await wait(900);
  const newBanner = await window.webContents.executeJavaScript(`document.querySelector('.hero-card h2')?.textContent || null`).catch(() => null);
  console.log('NEW BANNER:', JSON.stringify(newBanner));

  const image = await window.webContents.capturePage();
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'v18-packaged-home.png'), image.toPNG());
  console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 8).join(' | ') : 'none');
  app.exit(0);
});
