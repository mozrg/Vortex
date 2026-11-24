import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');

function createMockElement() {
  return {
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: { setProperty() {}, removeProperty() {} },
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    appendChild() {},
    append() {},
    dataset: {},
    innerHTML: '',
    textContent: '',
    hidden: false,
    matches() { return false; },
    contains() { return false; },
    focus() {},
    blur() {},
    scrollIntoView() {},
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  };
}

function bootVortexInVm(initialStorage = {}) {
  const store = new Map(Object.entries(initialStorage));
  const storage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); }
  };
  const invoked = [];
  const doc = Object.assign(createMockElement(), {
    body: createMockElement(),
    documentElement: createMockElement(),
    head: createMockElement(),
    activeElement: null,
    hidden: false,
    createElement: () => createMockElement(),
    createTextNode: () => ({}),
    querySelector: () => createMockElement(),
    querySelectorAll: () => [],
    getElementById: () => createMockElement()
  });

  const ctx = vm.createContext({
    console: { log() {}, warn() {}, error(...args) { throw new Error(args.join(' ')); } },
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    requestAnimationFrame() {},
    cancelAnimationFrame() {},
    Date, Math, JSON, Object, Array, Set, Map, RegExp, Error, Promise, Number, String, Boolean, URL, URLSearchParams,
    TextEncoder, TextDecoder, Uint8Array, btoa, atob,
    encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isNaN, isFinite,
    localStorage: storage,
    sessionStorage: storage,
    navigator: { clipboard: { writeText: async () => {} }, userAgent: '' },
    document: doc,
    window: null,
    globalThis: null,
    HTMLElement: { prototype: {} },
    Element: function Element() {},
    Node: { ELEMENT_NODE: 1 },
    Event: function Event() {},
    CSS: { escape: (s) => s },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    performance: { now: () => 0 },
    location: { href: 'http://localhost/' },
    __TAURI__: {
      core: {
        invoke: async (cmd, args) => {
          invoked.push({ cmd, args });
          return { ok: false, items: [], servers: [] };
        }
      },
      event: { listen() {}, unlisten() {} }
    }
  });
  ctx.window = ctx;
  ctx.globalThis = ctx;

  const scripts = [
    'src/js/icons.js', 'src/js/overlays.js', 'src/js/cache-idb.js', 'src/js/library-storage.js', 'src/js/color.js',
    'src/js/i18n.js', 'src/js/desktop.js', 'src/js/markdown.js', 'src/js/release-log.js',
    'src/js/session-journal.js', 'src/js/activity.js', 'src/js/activity-overview.js', 'src/js/play-clock.js',
    'src/js/launcher-tools.js', 'src/js/launcher-options.js', 'src/js/launcher-files.js', 'src/js/launcher-tools-i18n.js',
    'src/js/game-page-i18n.js', 'src/js/game-page.js', 'src/js/game-page-servers.js', 'src/js/game-page-actions.js',
    'src/js/windows-autostart.js', 'src/js/game-overlay-settings.js', 'src/js/catalog-i18n.js', 'src/js/catalog.js',
    'src/js/recommendations.js', 'src/js/library-i18n.js', 'src/js/library.js', 'src/js/library-activity.js',
    'src/js/security-confirm.js',
    'src/js/app-state.js', 'src/js/app-home.js', 'src/js/app-friends.js', 'src/js/app-settings.js',
    'src/js/app-sidebar.js', 'src/js/app-runtime.js', 'src/js/app-events.js', 'src/app.js'
  ];

  for (const rel of scripts) {
    const abs = path.join(ROOT, rel);
    vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: rel });
  }

  return { ctx, invoked, storage };
}

test('all app-* modules load in bootstrap order and bootVortex succeeds without ReferenceError', () => {
  const { ctx } = bootVortexInVm({
    'vortex.activity': JSON.stringify({
      clockVersion: 1,
      confirmedThrough: Date.now(),
      days: { '2026-11-23': { games: { '2753915549': 1200 } } }
    }),
    'vortex.recent': JSON.stringify(['2753915549']),
    'vortex.favorites': JSON.stringify(['2753915549'])
  });
  assert.equal(ctx.__VORTEX_BOOTED__, true);
  assert.equal(typeof ctx.bootVortex, 'function');
  assert.equal(typeof ctx.createSearchSessionId, 'function');
  assert.equal(typeof ctx.renderPage, 'function');
  assert.equal(typeof ctx.setView, 'function');
  assert.equal(typeof ctx.openGame, 'function');
  assert.equal(typeof ctx.selectServerHopCandidate, 'function');
  assert.equal(typeof ctx.renderPrivateServerCta, 'function');
});

test('activity date helpers and playtime tracking work accurately', () => {
  const { ctx } = bootVortexInVm();
  const key = ctx.activityDateKey(new Date(2026, 10, 20, 14, 0, 0).getTime());
  assert.equal(key, '2026-11-20');
  assert.equal(ctx.shiftActivityDate('2026-11-20', 3), '2026-11-23');
  assert.equal(ctx.shiftActivityDate('2026-11-20', -1), '2026-11-19');
  assert.equal(ctx.activityDayDistance('2026-11-20', '2026-11-23'), 3);

  ctx.recordActivityTime('2753915549', new Date(2026, 10, 20, 12, 0, 0).getTime(), 900);
  const seconds = vm.runInContext(`activityData.days['2026-11-20'].games['2753915549']`, ctx);
  assert.equal(seconds, 900);
});

test('public and private server normalization, real region/ping resolution, and CTA states work accurately', () => {
  const { ctx } = bootVortexInVm();
  const serverId = '12345678-1234-4123-a123-123456789abc';
  const normalized = ctx.normalizeBrowserServers([
    { id: serverId.toUpperCase(), playing: 4, capacity: 12, ping: 190 },
    { id: 'bad-id', playing: 2, capacity: 12, ping: 50 },
    { id: '12345678-1234-4123-a123-123456789abd', playing: 0, capacity: 0, ping: 40 }
  ]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].id, serverId);

  // Before resolution: never fakes a region from Roblox average ping
  const unresolved = ctx.serverRegionAndPingInfo(normalized[0], false);
  assert.equal(unresolved.group, 'unknown');
  assert.equal(unresolved.label, '—');
  assert.equal(unresolved.isRealPing, false);
  assert.equal(unresolved.displayPing, 190);

  // After resolution: uses real region and real user ping
  ctx.storeResolvedServerMap({
    [serverId]: { ip: '128.116.86.33', regionGroup: 'sa', regionCode: 'GRU', regionLabel: 'SA · GRU', realPing: 235 }
  });
  const resolved = ctx.serverRegionAndPingInfo(normalized[0], false);
  assert.equal(resolved.group, 'sa');
  assert.equal(resolved.label, 'SA · GRU');
  assert.equal(resolved.isRealPing, true);
  assert.equal(resolved.displayPing, 235);

  // Private server CTA: unknown price must NOT display "Бесплатно"
  const game = { id: '2753915549', title: 'Blox Fruits' };
  const view = ctx.gamePageView('2753915549');
  const page = ctx.gamePrivateServerPage(view);
  page.meta = { allowed: true, price: null, universeId: 994732206 };
  const ctaUnknown = ctx.renderPrivateServerCta(game, view);
  assert.ok(!ctaUnknown.includes('Бесплатно'));

  // Explicit 0 price shows "Бесплатно"
  page.meta = { allowed: true, price: 0, universeId: 994732206 };
  assert.ok(ctx.renderPrivateServerCta(game, view).includes('Бесплатно'));

  // Paid price shows Robux amount
  page.meta = { allowed: true, price: 80, universeId: 994732206 };
  assert.ok(ctx.renderPrivateServerCta(game, view).includes('80 R$'));

  // Unavailable shows unavailable badge
  page.meta = { allowed: false, price: null, universeId: 994732206 };
  assert.ok(ctx.renderPrivateServerCta(game, view).includes('недоступны'));

  // Active own server shows already owned
  page.meta = { allowed: true, price: 80, universeId: 994732206 };
  page.rows = [{ isMine: true, active: true, accessCode: 'abc', vipServerId: 555 }];
  assert.ok(ctx.renderPrivateServerCta(game, view).includes('уже есть'));
});

test('overlay minimal FPS profile disables heavy metrics and passes hideFullscreen flag', () => {
  const { ctx, invoked } = bootVortexInVm();
  vm.runInContext(`
    preferences.gameOverlay = true;
    preferences.gameOverlayHideFullscreen = true;
    preferences.gameOverlayMinimal = true;
    preferences.gameOverlayPing = true;
    preferences.gameOverlaySystem = true;
    preferences.gameOverlayTimer = true;
    gameOverlayReport = '';
    reportGameOverlay();
  `, ctx);
  const call = invoked.findLast(entry => entry.cmd === 'game_overlay_configure');
  assert.ok(call, 'expected game_overlay_configure invoke');
  assert.equal(call.args.config.hideFullscreen, true);
  assert.equal(call.args.config.fps, true);
  assert.equal(call.args.config.ping, false);
  assert.equal(call.args.config.system, false);
  assert.equal(call.args.config.timer, false);
  assert.equal(call.args.config.friends, false);
});

test('security domain checker detects spoofed & homograph domains and VORTEXFD1 folder codes round-trip', () => {
  const { ctx } = bootVortexInVm();

  assert.equal(ctx.inspectRobloxLinkSafety('https://www.roblox.com/games/2753915549/Blox-Fruits').authentic, true);
  assert.equal(ctx.inspectRobloxLinkSafety('https://ro.blox.com/Ebh5?pid=share').authentic, true);
  assert.equal(ctx.inspectRobloxLinkSafety('https://roblox.com.evil.net/games/123').authentic, false);
  assert.equal(ctx.inspectRobloxLinkSafety('https://r0blox.com/games/123').authentic, false);
  assert.equal(ctx.inspectRobloxLinkSafety('https://r\u043eblox.com/games/123').reason, 'homograph');
  assert.equal(ctx.inspectRobloxLinkSafety('https://xn--rblox-0sa.com/games/123').reason, 'homograph');

  const folder = {
    type: 'folder',
    id: 'f1',
    title: 'Evening Pack',
    color: '#a68bff',
    server: 'default',
    showInTray: true,
    games: [
      { method: 'public', placeId: '2753915549', title: 'Blox Fruits', thumbnail: '' },
      { method: 'private', placeId: '4924922222', linkCode: '123456', title: 'Brookhaven VIP', thumbnail: '' }
    ]
  };
  const code = ctx.encodeQuickFolderCode(folder);
  assert.ok(code.startsWith('VORTEXFD1-'));
  const decoded = ctx.decodeQuickFolderCode(code);
  assert.equal(decoded.title, 'Evening Pack');
  assert.equal(decoded.games.length, 2);
  assert.equal(decoded.games[0].placeId, '2753915549');
});

test('VORTEXTH1 theme share codes, overlay styles/thresholds, game aliases and IDB cache work', () => {
  const { ctx, invoked } = bootVortexInVm();

  // Theme code round-trip
  const themeCode = ctx.encodeThemeCode({
    theme: 'oled',
    accent: '#ff6b9d',
    accentMode: 'gradient',
    gradientAngle: 135,
    corners: 'sharp',
    density: 'compact',
    glow: 40,
    robloxUsername: 'should_not_leak'
  });
  assert.ok(themeCode.startsWith('VORTEXTH1-'));
  const decodedTheme = ctx.decodeThemeCode(themeCode);
  assert.equal(decodedTheme.theme, 'oled');
  assert.equal(decodedTheme.accent, '#ff6b9d');
  assert.equal(decodedTheme.corners, 'sharp');
  assert.equal(decodedTheme.robloxUsername, undefined);
  assert.equal(ctx.decodeThemeCode('VORTEXFD1-invalid'), null);

  // Overlay style & custom thresholds
  vm.runInContext(`
    preferences.gameOverlay = true;
    preferences.gameOverlayMinimal = false;
    preferences.gameOverlayStyle = 'vertical';
    preferences.gameOverlayBadPing = 180;
    preferences.gameOverlayLowFps = 45;
    gameOverlayReport = '';
    reportGameOverlay();
  `, ctx);
  const call = invoked.findLast(entry => entry.cmd === 'game_overlay_configure');
  assert.equal(call.args.config.style, 'vertical');
  assert.equal(call.args.config.badPingMs, 180);
  assert.equal(call.args.config.lowFps, 45);

  // Custom game alias + IDB cache + debounced save
  vm.runInContext(`preferences.gameAliases = { '2753915549': 'My Blox' };`, ctx);
  assert.equal(ctx.gameDisplayTitle({ id: '2753915549', title: 'Blox Fruits' }), 'My Blox');
  assert.equal(ctx.gameDisplayTitle({ id: '999', title: 'Other' }), 'Other');
  assert.equal(typeof ctx.savePreferencesDebounced, 'function');
  assert.equal(typeof ctx.vortexIdbCache.persistCache, 'function');
});

test('full backup export excludes cookies, IDB hydration restores caches, and Command Palette exposes new actions', async () => {
  const { ctx } = bootVortexInVm();

  // Full backup export includes profiles/notes/aliases and strips any cookie field
  vm.runInContext(`
    preferences.gameNotes = { '2753915549': 'Farm build' };
    preferences.gameAliases = { '2753915549': 'Blox Main' };
    preferences.robloxCookie = 'SECRET_SHOULD_NOT_EXPORT';
    preferences.quickLaunchItems = [
      { id: 'ql1', type: 'game', method: 'access', placeId: '2753915549', accessCode: 'abcd-1234-efgh', title: 'VIP Grind' }
    ];
  `, ctx);
  const backup = await ctx.buildDataExport();
  assert.equal(backup.app, 'vortex');
  assert.equal(backup.data.preferences.gameNotes['2753915549'], 'Farm build');
  assert.equal(backup.data.preferences.robloxCookie, undefined);
  assert.ok(Object.hasOwn(backup.data, 'profiles'));
  assert.ok(Object.hasOwn(backup.data, 'friendPins'));

  // Command palette includes new v1.3.0 quick commands + quick-launch items
  const cmds = ctx.paletteCommands();
  assert.ok(cmds.some(c => /пинг|ping/i.test(c.title)));
  assert.ok(cmds.some(c => /VORTEXTH1/i.test(c.title)));
  assert.ok(cmds.some(c => c.title === 'VIP Grind'));

  // IDB startup hydration merges cached games when localStorage was empty
  vm.runInContext(`
    dynamicGames = [];
    window.vortexIdbCache = {
      get: async (key) => key === 'vortex.discovered' ? [{ id: '2753915549', title: 'Blox Fruits' }] : null,
      set: async () => true,
      delete: async () => true,
      persistCache() {}
    };
  `, ctx);
  const hydrated = await ctx.hydrateIdbCaches();
  assert.equal(hydrated, true);
  assert.equal(vm.runInContext('dynamicGames.length', ctx), 1);
});

test('accountStorage recovers from QuotaExceededError by evicting disposable caches, and in-memory maps stay bounded', () => {
  const { ctx } = bootVortexInVm();

  // Simulate localStorage hitting quota once, then succeeding after disposable cache eviction.
  const recovered = vm.runInContext(`(() => {
    const store = new Map([
      ['vortex.searchCache.old', '{"items":[]}'],
      ['vortex.featuredCache', '{"items":[]}'],
      ['vortex.preferences', '{"theme":"dark"}']
    ]);
    let failedOnce = false;
    const origStorage = globalThis.localStorage;
    globalThis.localStorage = {
      get length() { return store.size; },
      key(i) { return [...store.keys()][i] ?? null; },
      getItem(k) { return store.has(k) ? store.get(k) : null; },
      removeItem(k) { store.delete(k); },
      setItem(k, v) {
        if (!failedOnce) {
          failedOnce = true;
          const err = new Error('QuotaExceededError');
          err.name = 'QuotaExceededError';
          throw err;
        }
        store.set(k, String(v));
      }
    };
    const ok = accountStorage.setItem('vortex.favorites', '["2753915549"]');
    const favSaved = store.get('vortex.favorites');
    const cacheEvicted = !store.has('vortex.searchCache.old') && !store.has('vortex.featuredCache');
    const prefsKept = store.get('vortex.preferences') === '{"theme":"dark"}';
    globalThis.localStorage = origStorage;
    return { ok, favSaved, cacheEvicted, prefsKept };
  })()`, ctx);

  assert.equal(recovered.ok, true);
  assert.equal(recovered.favSaved, '["2753915549"]');
  assert.equal(recovered.cacheEvicted, true);
  assert.equal(recovered.prefsKept, true);

  // routeToReleaseLog keeps releaseLogRoutes capped at <= 60 entries
  const routeCount = vm.runInContext(`(() => {
    const origShow = showReleaseLog;
    showReleaseLog = () => {};
    releaseLogRoutes.clear();
    for (let i = 0; i < 85; i += 1) {
      routeToReleaseLog({ id: 'rel-' + i, releaseTag: 'v1.0.' + i, title: 'Vortex 1.0.' + i });
    }
    showReleaseLog = origShow;
    return releaseLogRoutes.size;
  })()`, ctx);
  assert.equal(routeCount, 60);

  // toggleFavorite on catalog updates state without invoking full renderPage()
  const favResult = vm.runInContext(`(() => {
    currentView = 'catalog';
    favorites.clear();
    let renderCalls = 0;
    const origRender = renderPage;
    renderPage = () => { renderCalls += 1; };
    toggleFavorite('2753915549');
    const added = favorites.has('2753915549');
    toggleFavorite('2753915549');
    const removed = !favorites.has('2753915549');
    renderPage = origRender;
    return { added, removed, renderCalls };
  })()`, ctx);
  assert.equal(favResult.added, true);
  assert.equal(favResult.removed, true);
  assert.equal(favResult.renderCalls, 0);
});

test('pinning private servers from Game Page Servers tab preserves private launch target', async () => {
  const { ctx, invoked } = bootVortexInVm();

  // 1) Own VIP server with active share link resolves to native share method (with placeId preserved).
  const ownResult = await vm.runInContext(`(async () => {
    preferences.quickLaunchItems = [];
    preferences.confirmLaunch = false;
    window.vortexDesktop.getPrivateServerConfig = async ({ vipServerId }) => ({
      ok: true,
      server: {
        id: Number(vipServerId),
        name: 'My Farm VIP',
        active: true,
        link: 'https://www.roblox.com/share?code=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4&type=Server'
      }
    });
    const game = { id: '8304191830', title: 'Anime Adventures', thumbnail: '' };
    const btn = {
      dataset: {
        placeId: '8304191830',
        accessCode: '3f12ab45-1234-5678-9abc-def012345678',
        vipServerId: '991122',
        isMine: '1',
        serverName: 'My Farm VIP'
      },
      disabled: false
    };
    await pinPrivateServerFromGamePage(game, btn);
    const saved = preferences.quickLaunchItems[0];
    await launchQuickGame(saved.id);
    return saved;
  })()`, ctx);

  assert.equal(ownResult.method, 'share');
  assert.equal(ownResult.shareCode, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
  assert.equal(ownResult.shareType, 'Server');
  assert.equal(ownResult.placeId, '8304191830');
  const ownLaunch = invoked.findLast(entry => entry.cmd === 'launch_quick_game');
  assert.equal(ownLaunch.args.method, 'share');
  assert.equal(ownLaunch.args.shareCode, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');

  // 2) Friend's private server (no VIP config access) pins and launches with method 'access' + accessCode
  //    and does not collide with a public pin for the same placeId.
  const friendResult = await vm.runInContext(`(async () => {
    preferences.quickLaunchItems = [];
    await pinPastedLink({ method: 'public', placeId: '8304191830', title: 'Anime Adventures' });
    const game = { id: '8304191830', title: 'Anime Adventures', thumbnail: '' };
    const btn = {
      dataset: {
        placeId: '8304191830',
        accessCode: 'friend_vip-1234-5678-9abc-def012345678',
        vipServerId: '774411',
        isMine: '0',
        serverName: 'Friend VIP'
      },
      disabled: false
    };
    await pinPrivateServerFromGamePage(game, btn);
    const saved = preferences.quickLaunchItems.find(item => item.method === 'access');
    await launchQuickGame(saved.id);
    // Duplicate pin is blocked, and openGame with malformed accessCode refuses to launch a public server.
    const dup = await pinPastedLink({ method: 'access', placeId: '8304191830', accessCode: 'friend_vip-1234-5678-9abc-def012345678' });
    const badLaunch = await openGame('8304191830', '', 'bad code!', { skipConfirm: true });
    return { count: preferences.quickLaunchItems.length, saved, dup, badLaunch };
  })()`, ctx);

  assert.equal(friendResult.count, 2);
  assert.equal(friendResult.saved.method, 'access');
  assert.equal(friendResult.saved.accessCode, 'friend_vip-1234-5678-9abc-def012345678');
  assert.equal(friendResult.dup, false);
  assert.equal(friendResult.badLaunch, false);
  const friendLaunch = invoked.findLast(entry => entry.cmd === 'launch_quick_game');
  assert.equal(friendLaunch.args.method, 'access');
  assert.equal(friendLaunch.args.placeId, '8304191830');
  assert.equal(friendLaunch.args.accessCode, 'friend_vip-1234-5678-9abc-def012345678');
  assert.equal(invoked.filter(entry => entry.cmd === 'open_game').length, 0);
});
