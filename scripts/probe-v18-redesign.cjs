// Temporary diagnostic: verifies the redesigned home page and settings against the
// user's nine points. Runs index.html with a stubbed vortexDesktop bridge.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('host-resolver-rules', 'MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1');
const outputDir = path.join(__dirname, '..', 'dist-update-test', 'screens');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const stub = `
window.vortexDesktop = Object.assign(window.vortexDesktop || {}, {
  searchGames: ({ query }) => Promise.resolve({ items: [
    { id: '2753915549', universeId: '2619649538', title: 'Blox Fruits', creator: 'Gamer Robot', playerCount: 2245123, description: 'Стань сильнейшим мастером фруктов и отправляйся в плавание.', thumbnail: '', upVotes: 9000000, downVotes: 100000 },
    { id: '6516141723', universeId: '3107283736', title: 'DOORS', creator: 'LSPLASH', playerCount: 87311, description: 'Открывай двери и молись, чтобы за ними никого не было.', thumbnail: '', upVotes: 4000000, downVotes: 90000 }
  ] }),
  getFeaturedGames: () => Promise.resolve([]),
  openGame: () => Promise.resolve('player'),
  getUpdateState: () => Promise.resolve({ status: 'development', currentVersion: '1.0.18' }),
  onUpdateState: () => () => {}
});`;

async function shoot(window, name) {
  const image = await window.webContents.capturePage();
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, `${name}.png`), image.toPNG());
  console.log('saved', name);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 940, show: true, webPreferences: { contextIsolation: true, sandbox: true } });
  const errors = [];
  window.webContents.on('console-message', (_event, level, message) => { if (level >= 2) errors.push(message); });
  const load = window.loadFile(path.join(__dirname, '..', 'index.html'));
  await Promise.race([load.catch(() => {}), wait(6000)]);
  await wait(1500);
  await window.webContents.executeJavaScript(stub).catch(() => {});
  await window.webContents.executeJavaScript(`localStorage.clear(); localStorage.setItem('vortex.preferences', JSON.stringify({ settingsTab: 'home', language: 'ru' }))`).catch(() => {});
  window.webContents.reload();
  await wait(4000);
  await window.webContents.executeJavaScript(stub).catch(() => {});
  await wait(500);

  // --- Home is empty without user games ---
  const emptyHome = await window.webContents.executeJavaScript(`(() => ({
    hero: Boolean(document.querySelector('.hero-card')),
    cards: document.querySelectorAll('.game-card').length,
    emptyState: Boolean(document.querySelector('.home-view .empty-state')),
    disclaimer: document.querySelector('.home-view .catalog-disclaimer')?.textContent || null
  }))()`).catch((e) => ({ error: e.message }));
  console.log('EMPTY HOME:', JSON.stringify(emptyHome));
  await shoot(window, 'v18-home-empty');

  // --- Add two games through the search dropdown ---
  await window.webContents.executeJavaScript(`document.querySelector('[data-nav="settings"]')?.click()`);
  await wait(700);
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('[data-game-search]');
    input.value = 'blox';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await wait(1400);
  const dropdown = await window.webContents.executeJavaScript(`(() => ({
    visible: !document.querySelector('.game-search-results')?.hidden,
    options: [...document.querySelectorAll('.game-search-option')].map((b) => b.querySelector('strong').textContent),
    firstHasDescription: Boolean(document.querySelector('.game-search-option em')),
    descriptionText: document.querySelector('.game-search-option em')?.textContent || null
  }))()`).catch((e) => ({ error: e.message }));
  console.log('DROPDOWN:', JSON.stringify(dropdown));
  await shoot(window, 'v18-search-dropdown');
  await window.webContents.executeJavaScript(`document.querySelector('[data-game-pick="2753915549"]')?.click()`);
  await wait(700);
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('[data-game-search]');
    input.value = 'doors';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await wait(1400);
  await window.webContents.executeJavaScript(`document.querySelector('[data-game-pick="6516141723"]')?.click()`);
  await wait(900);

  // --- Settings rows: banner + picks badges ---
  const rows = await window.webContents.executeJavaScript(`(() => ({
    rowCount: document.querySelectorAll('.custom-game-row').length,
    badges: [...document.querySelectorAll('.custom-game-row')].map((row) => ({
      title: row.querySelector('.home-game-copy strong')?.textContent,
      bannerActive: row.querySelector('[data-banner-pick]')?.classList.contains('active'),
      picksActive: row.querySelector('[data-picks-pick]')?.classList.contains('active')
    })),
    heroStyleSetting: Boolean(document.querySelector('[data-pref="homeHeroStyle"]')),
    inputCleared: !document.querySelector('[data-game-search]')?.value
  }))()`).catch((e) => ({ error: e.message }));
  console.log('ROWS:', JSON.stringify(rows));
  await shoot(window, 'v18-my-games');

  // --- Home now shows exactly the user's games ---
  await window.webContents.executeJavaScript(`document.querySelector('[data-nav="home"]')?.click()`);
  await wait(900);
  const homeAfterAdd = await window.webContents.executeJavaScript(`(() => ({
    heroTitle: document.querySelector('.hero-card h2')?.textContent || null,
    heroDescription: document.querySelector('.hero-card .hero-copy p')?.textContent || null,
    heroAvatar: Boolean(document.querySelector('.hero-avatar')),
    oldOrbit: Boolean(document.querySelector('.hero-art, .hero-rings, .hero-orbit-label, [data-hero-style]')),
    cards: [...document.querySelectorAll('.game-card h3')].map((h) => h.textContent),
    cardDescriptions: [...document.querySelectorAll('.game-card .game-description')].map((p) => p.textContent.slice(0, 40)),
    logoFilter: getComputedStyle(document.querySelector('.brand-logo')).filter
  }))()`).catch((e) => ({ error: e.message }));
  console.log('HOME AFTER ADD:', JSON.stringify(homeAfterAdd));
  await shoot(window, 'v18-home-custom');

  // --- Layout variants actually change the hero ---
  const heroHeights = {};
  for (const layout of ['balanced', 'spotlight', 'library']) {
    await window.webContents.executeJavaScript(`(() => { preferences.homeLayout = '${layout}'; savePreferences(); renderPage(); })()`);
    await wait(400);
    heroHeights[layout] = await window.webContents.executeJavaScript(`document.querySelector('.hero-card')?.getBoundingClientRect().height || null`);
  }
  console.log('LAYOUT HEIGHTS:', JSON.stringify(heroHeights));

  // --- Skin variants are visually distinct ---
  const skins = {};
  for (const skin of ['aurora', 'plain']) {
    await window.webContents.executeJavaScript(`(() => { preferences.homeSkin = '${skin}'; preferences.homeLayout = 'balanced'; savePreferences(); renderPage(); })()`);
    await wait(400);
    skins[skin] = await window.webContents.executeJavaScript(`(() => ({
      heroBackground: getComputedStyle(document.querySelector('.hero-card')).backgroundImage.slice(0, 60),
      pageGlow: getComputedStyle(document.querySelector('.home-view'), '::before').backgroundImage.slice(0, 60)
    }))()`);
  }
  console.log('SKINS:', JSON.stringify(skins));
  await shoot(window, 'v18-home-plain-skin');

  // --- Previews are unique per option ---
  await window.webContents.executeJavaScript(`document.querySelector('[data-nav="settings"]')?.click()`);
  await wait(700);
  await window.webContents.executeJavaScript(`document.querySelector('[data-settings-tab="effects"]')?.click()`);
  await wait(600);
  const effectsPreviews = await window.webContents.executeJavaScript(`(() => {
    const read = (sel) => {
      const target = document.querySelector(sel);
      if (!target) return null;
      target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      const layer = document.getElementById('hover-preview-layer');
      const markup = layer && !layer.hidden ? layer.innerHTML : null;
      target.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      return markup;
    };
    return {
      fade: read('[data-preview="pageTransition:fade"]'),
      slide: read('[data-preview="pageTransition:slide"]'),
      none: read('[data-preview="pageTransition:none"]'),
      rise: read('[data-preview="cardAnimation:rise"]'),
      pop: read('[data-preview="cardAnimation:pop"]')
    };
  })()`).catch((e) => ({ error: e.message }));
  const unique = {
    fadeVsSlide: effectsPreviews.fade !== effectsPreviews.slide,
    slideVsNone: effectsPreviews.slide !== effectsPreviews.none,
    fadeVsNone: effectsPreviews.fade !== effectsPreviews.none,
    riseVsPop: effectsPreviews.rise !== effectsPreviews.pop,
    nonEmpty: Object.values(effectsPreviews).every((m) => m && m.length > 30)
  };
  console.log('EFFECTS PREVIEWS UNIQUE:', JSON.stringify(unique));
  await window.webContents.executeJavaScript(`document.querySelector('[data-preview="cardAnimation:pop"]')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))`);
  await shoot(window, 'v18-preview-card-pop');

  // --- Interface part previews are unique per toggle ---
  await window.webContents.executeJavaScript(`document.querySelector('[data-settings-tab="interface"]')?.click()`);
  await wait(600);
  const partPreviews = await window.webContents.executeJavaScript(`(() => {
    const read = (sel) => {
      const target = document.querySelector(sel);
      if (!target) return null;
      target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      const layer = document.getElementById('hover-preview-layer');
      const markup = layer && !layer.hidden ? layer.innerHTML : null;
      target.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      return markup;
    };
    return {
      tip: read('[data-preview="uiPart:uiSidebarTip"]'),
      profile: read('[data-preview="uiPart:uiProfileCard"]'),
      search: read('[data-preview="uiPart:uiTopbarSearch"]'),
      banner: read('[data-preview="uiPart:uiUpdateBanner"]')
    };
  })()`).catch((e) => ({ error: e.message }));
  const partsUnique = {
    tipVsProfile: partPreviews.tip !== partPreviews.profile,
    profileVsSearch: partPreviews.profile !== partPreviews.search,
    searchVsBanner: partPreviews.search !== partPreviews.banner,
    nonEmpty: Object.values(partPreviews).every((m) => m && m.length > 30)
  };
  console.log('PART PREVIEWS UNIQUE:', JSON.stringify(partsUnique));
  console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 10).join(' | ') : 'none');
  app.exit(0);
});
