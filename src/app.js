// Shared code (icons, color math, translations) lives in ./js/*.js and is
// loaded as classic scripts before this file: icons, icon(), mountIcons(),
// hexToRgb() and friends, and t() are all globals from those scripts.

// Built-in starter list removed: the home page and catalog now show only the
// games the user adds in Settings (plus live Roblox results).
const games = [];
const LEGACY_STARTER_GAMES_DISABLED = [
  { id: '2753915549', title: 'Blox Fruits', genre: 'Приключения', genreKey: 'adventure', art: 'blox', iconKey: 'sword', tag: 'ПРИКЛЮЧЕНИЕ', tagKey: 'adventure', description: 'Путешествуй по морям и открывай способности.', descriptionKey: 'bloxDescription', search: 'блокс фруктс экшен приключение anime anime' },
  { id: '6516141723', title: 'DOORS', genre: 'Хоррор', genreKey: 'horror', art: 'doors', iconKey: 'door', tag: 'ХОРРОР', tagKey: 'horror', description: 'Проверь нервы: за каждой дверью кто-то есть.', descriptionKey: 'doorsDescription', search: 'дурс двери страшная игра хоррор ужасы' },
  { id: '4924922222', title: 'Brookhaven RP', genre: 'Ролевая', genreKey: 'roleplay', art: 'brookhaven', iconKey: 'home', tag: 'РОЛЕВАЯ ИГРА', tagKey: 'roleplay', description: 'Выбери дом, машину и свою историю.', descriptionKey: 'brookhavenDescription', search: 'брукхейвен ролевая город roleplay' },
  { id: '15101393044', title: 'Dress to Impress', genre: 'Мода', genreKey: 'fashion', art: 'dti', iconKey: 'sparkle', tag: 'СТИЛЬ', tagKey: 'style', description: 'Собери образ и выйди на модный подиум.', descriptionKey: 'dtiDescription', search: 'дресс ту импресс мода fashion одежда' },
  { id: '1962086868', title: 'Tower of Hell', genre: 'Паркур', genreKey: 'parkour', art: 'tower', iconKey: 'mountain', tag: 'ПАРКУР', tagKey: 'parkour', description: 'Поднимайся выше и не останавливайся.', descriptionKey: 'towerDescription', search: 'тауэр оф хелл башня паркур обби obby' },
  { id: '286090429', title: 'Arsenal', genre: 'Экшен', genreKey: 'action', art: 'arsenal', iconKey: 'crosshair', tag: 'ЭКШЕН', tagKey: 'action', description: 'Быстрые раунды и смена оружия на ходу.', descriptionKey: 'arsenalDescription', search: 'арсенал шутер экшен fps' },
  { id: '920587237', title: 'Adopt Me!', genre: 'Симулятор', genreKey: 'simulator', art: 'adopt', iconKey: 'paw', tag: 'СИМУЛЯТОР', tagKey: 'simulator', description: 'Заботься о питомцах и обустраивай дом.', descriptionKey: 'adoptDescription', search: 'адопт ми питомцы симулятор животные' },
  { id: '9872472334', title: 'Evade', genre: 'Выживание', genreKey: 'survival', art: 'evade', iconKey: 'run', tag: 'ВЫЖИВАНИЕ', tagKey: 'survival', description: 'Держись рядом с командой и беги к выходу.', descriptionKey: 'evadeDescription', search: 'эвейд выживание escape team' }
];

const palettes = [
  { key: 'amethyst', color: '#9b7cff' },
  { key: 'azure', color: '#59a9f2' },
  { key: 'mint', color: '#55c7a4' },
  { key: 'rose', color: '#ee79ad' },
  { key: 'amber', color: '#e8a94d' },
  { key: 'crimson', color: '#ef626f' },
  { key: 'aqua', color: '#37c3cf' },
  { key: 'lime', color: '#9bc95d' },
  { key: 'orchid', color: '#c274ec' },
  { key: 'slate', color: '#8190a7' }
];

// Sidebar navigation. The order and visibility are user configurable
// in Settings → Interface.
const NAV_ITEMS = [
  { key: 'home', icon: 'home', group: 'menu' },
  { key: 'catalog', icon: 'compass', group: 'menu' },
  { key: 'favorites', icon: 'heart', group: 'menu' },
  { key: 'recent', icon: 'clock', group: 'menu' },
  { key: 'friends', icon: 'users', group: 'menu' },
  { key: 'plans', icon: 'flag', group: 'space' },
  { key: 'settings', icon: 'sliders', group: 'space' }
];
const NAV_KEYS = NAV_ITEMS.map((item) => item.key);

function navOrder() {
  const stored = Array.isArray(preferences.sidebarOrder) ? preferences.sidebarOrder.filter((key) => NAV_KEYS.includes(key)) : [];
  return [...new Set([...stored, ...NAV_KEYS])];
}

function navItemMarkup(item) {
  return `<button class="nav-item" data-nav="${item.key}"><span class="nav-icon" data-icon="${item.icon}"></span><span>${t(`nav.${item.key}`)}</span></button>`;
}

function renderSidebarNav() {
  const order = navOrder();
  const items = order.map((key) => NAV_ITEMS.find((item) => item.key === key)).filter(Boolean);
  const group = (name) => items.filter((item) => item.group === name).map(navItemMarkup).join('');
  return { menu: group('menu'), space: group('space') };
}

const preferenceDefaults = {
  accent: '#9b7cff', accentMode: 'solid', accentSecondary: '#c274ec', gradientAngle: 135,
  theme: 'dark', themeBackground: '', themeSurface: '',
  density: 'comfortable', corners: 'soft', showDescriptions: true, showStats: true,
  homeGreeting: '', customGames: [], homeFeaturedGame: '', homePicks: [], homeGameCount: 4,
  homeShowHero: true, homeShowRecommendations: true,
  homeLayout: 'balanced', homeMinimal: false,
  sidebarOrder: [], uiSidebarTip: true, uiProfileCard: true, uiTopbarSearch: true,
  uiBreadcrumb: true, uiNotifications: true, uiSidebarFoot: true, uiUpdateBanner: true,
  pageTransition: 'fade', cardAnimation: 'rise', glow: 72, ambient: true, motion: true,
  contrast: false, language: 'ru', saveHistory: true, settingsTab: 'home', trayScale: 'normal', robloxUsername: '', friendsNoticeAccepted: false,
  themeText: '', themeMuted: '', themeLine: '',
  themeWallpaper: '', themeWallpaperBlur: 14, themeWallpaperDim: 45, themeGrain: false, themeVignette: false,
  cardSize: 1, cardRadius: 12, customCardRadius: false, cardShowDescription: true, cardShowLikes: true, cardShowPlaytime: true, cardShowGenre: true
};

const readStored = (key, fallback) => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
};
const preferences = { ...preferenceDefaults, ...readStored('vortex.preferences', {}) };
window.preferences = preferences;
let favorites = new Set(readStored('vortex.favorites', []));
let recentGames = readStored('vortex.recent', []);
// Playtime per game: { [id]: { seconds, launches, lastPlayed } }. 'seconds' is
// a conservative estimate: the time between a launch and the next launch or
// app close, capped at a session ceiling so an abandoned window does not
// inflate the number.
let playStats = readStored('vortex.playStats', {});
const PLAYTIME_SESSION_CAP_SECONDS = 3 * 60 * 60;
const PLAYTIME_SESSION_KEY = 'vortex.playSession';
let playSessionStart = null;
let playSessionGameId = null;
let dynamicGames = readStored('vortex.discovered', []);
const expandedDescriptions = new Set();
let currentView = 'home';
let searchQuery = '';
let activeCategory = 'all';
let sortMode = 'default';
let searchStatus = 'idle';
let searchResults = [];
let searchSessionId = '';
let searchPageToken = null;
let searchRequestId = 0;
let searchTimer = null;
let isLoadingMore = false;
const DISCOVERY_CACHE_TTL = 5 * 60 * 1000;
const CATALOG_PAGE_SIZE = 36;
const fallbackDiscoverySorts = [
  { id: 'top-trending', title: 'Top Trending' },
  { id: 'up-and-coming', title: 'Up-and-Coming' },
  { id: 'top-playing-now', title: 'Top Playing Now' },
  { id: 'fun-with-friends', title: 'Fun with Friends' },
  { id: 'top-revisited', title: 'Top Revisited' }
];
let discoverySorts = readStored('vortex.discoverySorts', []);
let discoveryCatalog = readStored('vortex.discoveryCatalog', {});
let activeDiscoverySort = readStored('vortex.activeDiscoverySort', 'top-trending');
let discoverySessionId = readStored('vortex.discoverySessionId', '') || createSearchSessionId();
let discoveryStatus = 'idle';
let discoveryRequestId = 0;
let catalogVisibleCount = CATALOG_PAGE_SIZE;

const pageContent = document.getElementById('page-content');
const searchInput = document.getElementById('global-search');
const breadcrumbCurrent = document.getElementById('breadcrumb-current');
let latestUpdateState = null;

function setWindowMaximized(isMaximized) {
  const button = document.querySelector('[data-window-control="maximize"]');
  if (!button) return;
  const key = isMaximized ? 'window.restore' : 'window.maximize';
  const iconName = isMaximized ? 'windowRestore' : 'windowMaximize';
  button.dataset.i18nAria = key;
  button.setAttribute('aria-label', t(key));
  const iconSlot = button.querySelector('[data-icon]');
  if (iconSlot) iconSlot.innerHTML = icon(iconName, 16);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function savePreferences() {
  localStorage.setItem('vortex.preferences', JSON.stringify(preferences));
  // Any preference change may affect the tray's look, so it re-reports its
  // style payload together with the recent games on every save.
  reportRecentGamesToTray();
}

function renderColorTuner(name, color, label) {
  const hsl = rgbToHsl(color);
  const axes = [
    ['hue', 'settings.colorHue', 0, 360],
    ['saturation', 'settings.colorSaturation', 0, 100],
    ['lightness', 'settings.colorLightness', 0, 100]
  ];
  return `<div class="color-tuner" data-color-tuner="${name}">
    <div class="color-tuner-head"><strong>${label}</strong><label class="hex-field"><span class="color-preview" style="--sample-color:${color}"></span><input type="text" value="${color.toUpperCase()}" maxlength="7" spellcheck="false" data-color-hex="${name}" aria-label="${t('settings.colorCode')}" /></label></div>
    <div class="color-tuner-controls">${axes.map(([axis, labelKey, min, max]) => `<label class="color-range"><span>${t(labelKey)}</span><input type="range" min="${min}" max="${max}" value="${hsl[axis]}" data-color-axis="${axis}" data-color-target="${name}" /><output data-color-value="${axis}" data-color-target="${name}">${hsl[axis]}${axis === 'hue' ? '°' : '%'}</output></label>`).join('')}</div>
  </div>`;
}

function hexToRgba(hex, alpha) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
  if (!match) return '';
  const [r, g, b] = [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

// Wallpaper layer: one fixed element behind the app with the user image,
// blur and dimming; grain and vignette ride along as pseudo-element effects.
let wallpaperLayerEl = null;
function syncWallpaperLayer() {
  const root = document.documentElement;
  root.classList.toggle('has-wallpaper', Boolean(preferences.themeWallpaper));
  root.classList.toggle('has-grain', preferences.themeGrain);
  root.classList.toggle('has-vignette', preferences.themeVignette);
  if (!preferences.themeWallpaper) { wallpaperLayerEl?.remove(); wallpaperLayerEl = null; return; }
  if (!wallpaperLayerEl) {
    wallpaperLayerEl = document.createElement('div');
    wallpaperLayerEl.className = 'wallpaper-layer';
    document.body.prepend(wallpaperLayerEl);
  }
  wallpaperLayerEl.style.setProperty('--wallpaper-image', 'url(' + preferences.themeWallpaper + ')');
  wallpaperLayerEl.style.setProperty('--wallpaper-blur', preferences.themeWallpaperBlur + 'px');
  wallpaperLayerEl.style.setProperty('--wallpaper-dim', preferences.themeWallpaperDim / 100);
}

function applyPreferences() {
  if (!['ru', 'en'].includes(preferences.language)) preferences.language = 'ru';
  if (!['home', 'accent', 'cards', 'effects', 'interface', 'general', 'version'].includes(preferences.settingsTab)) preferences.settingsTab = 'home';
  if (!Array.isArray(preferences.sidebarOrder)) preferences.sidebarOrder = [];
  preferences.sidebarOrder = [...new Set(preferences.sidebarOrder.filter((key) => NAV_KEYS.includes(key)))];
  for (const flag of ['uiSidebarTip', 'uiProfileCard', 'uiTopbarSearch', 'uiBreadcrumb', 'uiNotifications', 'uiSidebarFoot', 'uiUpdateBanner']) {
    preferences[flag] = preferences[flag] !== false;
  }
  if (!['dark', 'light', 'oled'].includes(preferences.theme)) preferences.theme = 'dark';
  if (!['compact', 'normal', 'large'].includes(preferences.trayScale)) preferences.trayScale = 'normal';
  if (!['solid', 'gradient'].includes(preferences.accentMode)) preferences.accentMode = 'solid';
  if (!['spacious', 'comfortable', 'compact'].includes(preferences.density)) preferences.density = 'comfortable';
  const hex = /^#[0-9a-f]{6}$/i.test(preferences.accent) ? preferences.accent : preferenceDefaults.accent;
  preferences.accent = hex;
  preferences.accentSecondary = /^#[0-9a-f]{6}$/i.test(preferences.accentSecondary) ? preferences.accentSecondary : preferenceDefaults.accentSecondary;
  preferences.gradientAngle = Math.max(0, Math.min(360, Number(preferences.gradientAngle) || 0));
  preferences.themeBackground = /^#[0-9a-f]{6}$/i.test(preferences.themeBackground) ? preferences.themeBackground : '';
  preferences.themeSurface = /^#[0-9a-f]{6}$/i.test(preferences.themeSurface) ? preferences.themeSurface : '';
  preferences.themeText = /^#[0-9a-f]{6}$/i.test(preferences.themeText) ? preferences.themeText : '';
  preferences.themeMuted = /^#[0-9a-f]{6}$/i.test(preferences.themeMuted) ? preferences.themeMuted : '';
  preferences.themeLine = /^#[0-9a-f]{6}$/i.test(preferences.themeLine) ? preferences.themeLine : '';
  preferences.themeWallpaper = String(preferences.themeWallpaper || '').startsWith('data:image/') ? preferences.themeWallpaper : '';
  preferences.themeWallpaperBlur = Math.max(0, Math.min(40, Number(preferences.themeWallpaperBlur) || 0));
  preferences.themeWallpaperDim = Math.max(0, Math.min(90, Number(preferences.themeWallpaperDim) || 0));
  preferences.themeGrain = preferences.themeGrain === true;
  preferences.themeVignette = preferences.themeVignette === true;
  preferences.cardSize = Math.max(0.7, Math.min(1.3, Number(preferences.cardSize) || 1));
  preferences.cardRadius = Math.max(0, Math.min(20, Number(preferences.cardRadius) || 0));
  preferences.customCardRadius = preferences.customCardRadius === true;
  for (const flag of ['cardShowDescription', 'cardShowLikes', 'cardShowPlaytime', 'cardShowGenre']) {
    preferences[flag] = preferences[flag] !== false;
  }
  // Legacy per-card toggles fold into the unified card flags so old saved states survive:
  preferences.cardShowDescription = preferences.cardShowDescription && preferences.showDescriptions !== false;
  preferences.cardShowLikes = preferences.cardShowLikes && preferences.showStats !== false;
  if (!['balanced', 'spotlight', 'library'].includes(preferences.homeLayout)) preferences.homeLayout = 'balanced';
  preferences.homeMinimal = Boolean(preferences.homeMinimal);
  if (![4, 6, 8].includes(Number(preferences.homeGameCount))) preferences.homeGameCount = 4;
  if (!['fade', 'slide', 'zoom', 'none'].includes(preferences.pageTransition)) preferences.pageTransition = 'fade';
  if (!['rise', 'fade', 'pop', 'none'].includes(preferences.cardAnimation)) preferences.cardAnimation = 'rise';
  preferences.homeGreeting = String(preferences.homeGreeting ?? '').slice(0, 48);
  const customGameIds = new Set((Array.isArray(preferences.customGames) ? preferences.customGames : []).map((game) => String(game?.id ?? '')));
  preferences.homeFeaturedGame = customGameIds.has(String(preferences.homeFeaturedGame ?? '')) ? String(preferences.homeFeaturedGame) : '';
  preferences.homePicks = Array.isArray(preferences.homePicks)
    ? [...new Set(preferences.homePicks.map(String))].filter((id) => customGameIds.has(id))
    : [];
  preferences.glow = Math.max(0, Math.min(100, Number(preferences.glow) || 0));

  const root = document.documentElement.style;
  const accentChannels = hexToRgb(hex);
  const secondaryChannels = hexToRgb(preferences.accentSecondary);
  const channels = accentChannels.join(', ');
  const secondaryRgb = secondaryChannels.join(', ');
  const gradient = `linear-gradient(${preferences.gradientAngle}deg, ${hex}, ${preferences.accentSecondary})`;
  const fillColors = preferences.accentMode === 'gradient' ? [hex, preferences.accentSecondary] : [hex];
  const foregroundContrast = (foreground) => Math.min(...fillColors.map((fill) => {
    const foregroundLuminance = relativeLuminance(foreground);
    const fillLuminance = relativeLuminance(fill);
    return (Math.max(foregroundLuminance, fillLuminance) + 0.05) / (Math.min(foregroundLuminance, fillLuminance) + 0.05);
  }));
  const accentContrast = foregroundContrast('#ffffff') >= foregroundContrast('#17151d') ? '#ffffff' : '#17151d';
  const accentWash = preferences.accentMode === 'gradient'
    ? `linear-gradient(${preferences.gradientAngle}deg, rgba(${channels}, .19), rgba(${secondaryRgb}, .12))`
    : `rgba(${channels}, .14)`;
  const themeBase = {
    dark: { background: '#0b0c10', surface: '#111319' },
    light: { background: '#f2f1f6', surface: '#ffffff' },
    oled: { background: '#030305', surface: '#08090c' }
  }[preferences.theme];
  const background = preferences.themeBackground || themeBase.background;
  const isLightCanvas = relativeLuminance(background) > 0.42;
  const derivedSurface = preferences.themeBackground ? mixHex(background, isLightCanvas ? '#ffffff' : '#000000', isLightCanvas ? 0.78 : 0.48) : themeBase.surface;
  const surface = preferences.themeSurface || derivedSurface;
  const accentHsl = rgbToHsl(hex);
  let accentText = hex;
  // On a light canvas an accent used as text must darken; on a dark one it must
  // lighten. Walk in that single direction until the contrast target is met. The
  // target is stricter on light themes because the text also sits on accent washes.
  const direction = isLightCanvas ? -4 : 3;
  const target = isLightCanvas ? 5.5 : 4.5;
  for (let step = 0; step < 40; step += 1) {
    const foregroundLuminance = relativeLuminance(accentText);
    const surfaceLuminance = relativeLuminance(surface);
    const contrast = (Math.max(foregroundLuminance, surfaceLuminance) + 0.05) / (Math.min(foregroundLuminance, surfaceLuminance) + 0.05);
    if (contrast >= target) break;
    const nextLightness = Math.max(0, Math.min(100, accentHsl.lightness + direction));
    if (nextLightness === accentHsl.lightness) break;
    accentHsl.lightness = nextLightness;
    accentText = hslToHex(accentHsl.hue, accentHsl.saturation, accentHsl.lightness);
  }
  root.setProperty('--accent', hex);
  root.setProperty('--accent-secondary', preferences.accentSecondary);
  root.setProperty('--accent-rgb', channels);
  root.setProperty('--accent-secondary-rgb', secondaryRgb);
  root.setProperty('--accent-gradient', gradient);
  root.setProperty('--accent-fill', preferences.accentMode === 'gradient' ? 'var(--accent-gradient)' : 'var(--accent)');
  root.setProperty('--accent-wash', accentWash);
  root.setProperty('--accent-soft', accentWash);
  root.setProperty('--accent-text', accentText);
  root.setProperty('--accent-contrast', accentContrast);
  root.setProperty('--accent-border', `rgba(${channels}, .38)`);
  root.setProperty('--accent-glow', `rgba(${channels}, .34)`);
  root.setProperty('--bg', background);
  root.setProperty('--surface', surface);
  root.setProperty('--surface-2', mixHex(surface, background, 0.42));
  root.setProperty('--surface-3', mixHex(surface, background, 0.72));
  root.setProperty('--text', preferences.themeText || (isLightCanvas ? '#211e2a' : '#f4f4f6'));
  root.setProperty('--muted', preferences.themeMuted || (isLightCanvas ? '#777382' : '#8d909e'));
  root.setProperty('--subtle', isLightCanvas ? '#9692a1' : '#636776');
  root.setProperty('--line', preferences.themeLine ? hexToRgba(preferences.themeLine, 0.16) : (isLightCanvas ? 'rgba(38,32,56,.1)' : 'rgba(255,255,255,.075)'));
  root.setProperty('--line-strong', preferences.themeLine ? hexToRgba(preferences.themeLine, 0.34) : (isLightCanvas ? 'rgba(38,32,56,.18)' : 'rgba(255,255,255,.13)'));
  syncWallpaperLayer();
  root.setProperty('--card-size', preferences.cardSize);
  root.setProperty('--card-radius', preferences.cardRadius + 'px');
  document.documentElement.style.setProperty('--glow-strength', String(Number(preferences.glow) / 100));
  document.body.classList.toggle('custom-card-radius', preferences.customCardRadius === true);
  document.body.classList.toggle('light-theme', isLightCanvas);
  document.body.classList.toggle('oled-theme', preferences.theme === 'oled' && !isLightCanvas);
  document.body.classList.toggle('spacious', preferences.density === 'spacious');
  document.body.classList.toggle('compact', preferences.density === 'compact');
  document.body.classList.toggle('hide-descriptions', !preferences.cardShowDescription);
  document.body.classList.toggle('hide-game-stats', !preferences.cardShowLikes);
  document.body.classList.toggle('sharp-corners', preferences.corners === 'sharp');
  document.body.classList.toggle('no-motion', !preferences.motion);
  document.body.classList.toggle('no-glow', !preferences.ambient);
  document.body.classList.toggle('high-contrast', preferences.contrast);
  document.body.dataset.cardAnimation = preferences.cardAnimation;
  // Home page look, managed in Settings → Home.
  document.body.dataset.homeLayout = preferences.homeLayout;
  document.body.classList.toggle('home-minimal', preferences.homeMinimal);
  // Interface parts the user can switch off in Settings → Interface.
  document.body.classList.toggle('ui-no-sidebar-tip', !preferences.uiSidebarTip);
  document.body.classList.toggle('ui-no-profile', !preferences.uiProfileCard);
  document.body.classList.toggle('ui-no-sidebar-foot', !preferences.uiSidebarFoot);
  document.body.classList.toggle('ui-no-topbar-search', !preferences.uiTopbarSearch);
  document.body.classList.toggle('ui-no-breadcrumb', !preferences.uiBreadcrumb);
  document.body.classList.toggle('ui-no-notifications', !preferences.uiNotifications);
  applyStaticTranslations();
}

function applyStaticTranslations() {
  document.documentElement.lang = preferences.language;
  document.title = t('app.title');
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
    element.setAttribute('aria-label', t(element.dataset.i18nAria));
  });
}

function allGames() {
  const knownIds = new Set(games.map((game) => game.id));
  const custom = (preferences.customGames || []).filter((game) => game && !knownIds.has(String(game.id)));
  const customIds = new Set(custom.map((game) => String(game.id)));
  return [...games, ...custom, ...dynamicGames.filter((game) => game && !knownIds.has(String(game.id)) && !customIds.has(String(game.id)))];
}

function getGame(id) { return allGames().find((game) => game.id === String(id)); }

function localizeGame(game) {
  return {
    ...game,
    genre: game.genreKey ? t(`genre.${game.genreKey}`) : game.genre && game.genre.toLocaleLowerCase() !== 'roblox' ? game.genre : '',
    tag: game.tagKey ? t(`tag.${game.tagKey}`) : game.tag || t('tag.roblox'),
    description: game.descriptionKey ? t(`game.${game.descriptionKey}`) : game.description
  };
}

function formatCount(value) {
  const count = Number(value) || 0;
  return new Intl.NumberFormat(preferences.language === 'ru' ? 'ru-RU' : 'en-US', {
    notation: count >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1
  }).format(count);
}

function formatResultCount(count) {
  if (preferences.language !== 'ru') return `${count} ${count === 1 ? 'result' : 'results'}`;
  const lastTwo = count % 100;
  const last = count % 10;
  const word = last === 1 && lastTwo !== 11 ? 'результат' : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'результата' : 'результатов';
  return `${count} ${word}`;
}

function safeThumbnail(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'tr.rbxcdn.com' ? url.href : '';
  } catch { return ''; }
}

// Steam-style playtime label: "45 мин", "12,5 ч.", "3 д. 4 ч.".
function formatPlaytime(totalSeconds) {
  const minutes = Math.floor(Number(totalSeconds) / 60);
  if (!minutes) return null;
  if (minutes < 60) return { value: minutes, unit: t('time.minutes') };
  const hours = minutes / 60;
  if (hours < 24) return { value: Math.round(hours * 10) / 10, unit: t('time.hours') };
  return { value: Math.round(hours / 24 * 10) / 10, unit: t('time.days') };
}
function renderPlaytimeBadge(gameId) {
  const entry = playStats && playStats[gameId];
  const formatted = entry && entry.seconds ? formatPlaytime(entry.seconds) : null;
  if (!formatted) return '';
  const label = formatted.value.toLocaleString(preferences.language === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 1 });
  return `<span class="card-playtime">${icon('clock', 11)} ${label}${formatted.unit}</span>`;
}

function renderGameCard(game) {
  game = localizeGame(game);
  const isFavorite = favorites.has(game.id);
  const id = escapeHtml(game.id);
  const art = ['blox', 'doors', 'brookhaven', 'dti', 'tower', 'arsenal', 'adopt', 'evade', 'live'].includes(game.art) ? game.art : 'live';
  const thumbnail = safeThumbnail(game.thumbnail);
  const likes = Number(game.upVotes) + Number(game.downVotes) > 0 ? Math.round((Number(game.upVotes) / (Number(game.upVotes) + Number(game.downVotes))) * 100) : null;
  const liveStats = game.live ? `<div class="game-live-stats"><span>${icon('users', 12)} ${t('search.players', { count: formatCount(game.playerCount) })}</span>${likes === null ? '' : `<span>${icon('thumb', 12)} ${t('search.likes', { percent: likes })}</span>`}</div>` : '';
  const creatorLabel = game.creator ? t('game.creator', { creator: escapeHtml(game.creator) }) : '';
  const description = String(game.description || t('game.fallbackDescription')).trim();
  const category = game.genre ? `<span class="game-category"><i></i>${escapeHtml(game.genre)}</span>` : '<span></span>';
  const expandedDescription = expandedDescriptions.has(String(game.id));
  const canExpandDescription = description.length > 100;
  const coverTag = game.tag && game.tag.toLocaleLowerCase() !== t('tag.roblox').toLocaleLowerCase()
    ? `<span class="cover-tag">${escapeHtml(game.tag)}</span>` : '';
  return `<article class="game-card" style="--game-color: var(--accent)" data-game="${id}">
    <div class="game-cover art-${art} ${thumbnail ? 'has-thumbnail' : ''}">
      ${thumbnail ? `<img class="game-thumbnail" src="${escapeHtml(thumbnail)}" alt="" loading="lazy" />` : ''}
      <span class="cover-shine"></span>${coverTag}
      <button class="favorite-button ${isFavorite ? 'is-favorite' : ''}" data-action="favorite" data-id="${id}" aria-label="${isFavorite ? t('card.favoriteRemove') : t('card.favoriteAdd')}" aria-pressed="${isFavorite}">${icon('heart', 15)}</button>
    </div>
    <div class="game-info">
      <div class="game-title-row"><h3 class="game-title">${escapeHtml(game.title)}</h3></div>
      ${preferences.cardShowDescription ? `<p class="game-description ${expandedDescription ? 'expanded' : ''}" title="${escapeHtml(description)}">${escapeHtml(description)}</p>
      ${canExpandDescription ? `<button class="description-more" data-action="toggle-description" data-id="${id}" aria-expanded="${expandedDescription}">${t(expandedDescription ? 'card.readLess' : 'card.readMore')}</button>` : ''}` : ''}
      ${preferences.cardShowLikes ? liveStats : ''}
      <div class="game-card-footer">${preferences.cardShowGenre ? category : ''}${preferences.cardShowPlaytime ? renderPlaytimeBadge(game.id) : ''}<button class="card-play" data-action="play" data-id="${id}">${icon('play', 11)} ${t('card.play')}</button></div>
    </div>
  </article>`;
}

function renderGrid(list, emptyTitle, emptyText, emptyAction = 'catalog') {
  if (!list.length) {
    return `<div class="empty-state"><div class="empty-icon">${icon(emptyAction === 'favorites' ? 'heart' : 'search', 20)}</div><h2>${emptyTitle}</h2><p>${emptyText}</p><button class="ghost-button" data-nav="${emptyAction}">${t('empty.openCatalog')} ${icon('arrow', 13)}</button></div>`;
  }
  return `<div class="game-grid">${list.map(renderGameCard).join('')}</div>`;
}

function pageHeading(eyebrow, title, description, action = '') {
  return `<div class="page-heading"><div><div class="eyebrow"><span class="eyebrow-mark"></span>${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ''}</div>`;
}

// "Most played" strip for the home page: top games by banked playtime.
function renderPlayStats(limit = 3) {
  const entries = Object.entries(playStats || {})
    .filter(([id, entry]) => getGame(id) && Number(entry && (entry.launches || entry.seconds)) > 0)
    .sort((a, b) => Number(b[1].seconds) - Number(a[1].seconds))
    .slice(0, limit);
  if (!entries.length) return '';
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    return hours >= 1 ? t('stats.hours', { time: String(hours) }) : t('stats.minutes', { time: String(Math.max(1, Math.round(seconds / 60))) });
  };
  return `<section class="play-stats">
    <div class="section-heading"><div><h2>${t('stats.title')}</h2><p>${t('stats.body')}</p></div></div>
    <div class="play-stats-grid">${entries.map(([id, entry]) => { const game = getGame(id); const thumbnail = safeThumbnail(game.thumbnail); return `
      <button class="play-stat-card" data-action="play" data-id="${escapeHtml(String(game.id))}">
        <span class="play-stat-art ${thumbnail ? 'has-thumbnail' : ''}">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" />` : ''}</span>
        <span class="play-stat-copy"><strong>${escapeHtml(game.title)}</strong><small>${formatTime(Number(entry.seconds))} · ${t('stats.launches', { count: String(entry.launches || 1) })}</small></span>
        <span class="play-stat-play">${icon('play', 12)}</span>
      </button>`; }).join('')}</div>
  </section>`;
}

function renderHome() {
  // The home page shows only the user's own games, chosen in Settings → Home.
  const customGames = [...new Map((preferences.customGames || []).map((game) => [String(game.id), game])).values()]
    .map((game) => localizeGame(game));
  const featured = customGames.find((game) => String(game.id) === String(preferences.homeFeaturedGame)) || null;
  const picksIds = Array.isArray(preferences.homePicks) ? preferences.homePicks.map(String) : [];
  const picks = (picksIds.length
    ? picksIds.map((id) => customGames.find((game) => String(game.id) === id)).filter(Boolean)
    : customGames.filter((game) => String(game.id) !== String(featured?.id)))
    .slice(0, Number(preferences.homeGameCount) || 4);
  const greeting = preferences.homeGreeting.trim() || t('page.home.title');
  const emptyHint = customGames.length ? '' : `<section class="section-block"><div class="empty-state"><div class="empty-icon">${icon('sparkle', 20)}</div><h2>${t('home.empty.title')}</h2><p>${t('home.empty.body')}</p><button class="ghost-button" data-nav="settings">${icon('sliders')} ${t('home.empty.action')}</button></div></section>`;
  const hero = preferences.homeShowHero && featured ? `<section class="hero-card" data-home-featured-banner>
      <span class="hero-avatar" aria-hidden="true">${safeThumbnail(featured.thumbnail) ? `<img src="${escapeHtml(safeThumbnail(featured.thumbnail))}" alt="" />` : `<span class="hero-avatar-fallback">${escapeHtml((featured.title || 'R')[0].toLocaleUpperCase())}</span>`}</span>
      <div class="hero-copy"><span class="hero-kicker"><span>${icon('sparkle', 13)}</span> ${t('hero.kicker')}</span><h2>${escapeHtml(featured.title)}</h2><p>${escapeHtml(featured.description || t('hero.body'))}</p>
        <div class="hero-actions"><button class="primary-button" data-action="play" data-id="${escapeHtml(featured.id)}">${icon('play')} ${t('hero.play', { title: escapeHtml(featured.title) })}</button><span class="hero-meta">${escapeHtml(featured.creator || t('hero.meta'))}</span></div>
      </div>
    </section>` : '';
  const recommendations = preferences.homeShowRecommendations ? `<section class="section-block"><div class="section-heading"><div><h2>${t('home.section.title')}</h2><p>${t('home.section.subtitle')}</p></div></div>
      ${renderGrid(picks, t('home.picks.emptyTitle'), t('home.picks.emptyBody'), 'settings')}</section>` : '';
  return `<div class="home-view" data-home-view data-home-layout="${preferences.homeLayout}">
    ${pageHeading(t('page.home.eyebrow'), `<span class="heading-inline-icon">${icon('handWave', 19)}</span>${escapeHtml(greeting)}`, t('page.home.description'))}
    ${emptyHint}${hero}${recommendations}${renderPlayStats()}
  </div>`;
}

function filterGames() {
  const query = searchQuery.trim().toLocaleLowerCase(preferences.language);
  const discovered = discoveryCatalog[activeDiscoverySort]?.items;
  let sourceGames = searchQuery ? searchResults : currentView === 'catalog' && Array.isArray(discovered) ? discovered : games;
  let list = sourceGames.filter((game) => {
    const localized = localizeGame(game);
    const matchesQuery = !query || String(game.id).includes(query) || `${game.title} ${localized.genre} ${localized.description} ${game.search || ''}`.toLocaleLowerCase(preferences.language).includes(query);
    const matchesCategory = searchQuery || activeCategory === 'all' || game.genreKey === activeCategory;
    return matchesQuery && matchesCategory;
  });
  if (sortMode === 'alpha') list = list.slice().sort((first, second) => first.title.localeCompare(second.title, preferences.language));
  if (sortMode === 'recent') list = list.slice().reverse();
  if (sortMode === 'players') list = list.slice().sort((first, second) => (second.playerCount || 0) - (first.playerCount || 0));
  if (sortMode === 'likes') list = list.slice().sort((first, second) => {
    const score = (game) => (Number(game.upVotes) + Number(game.downVotes)) ? Number(game.upVotes) / (Number(game.upVotes) + Number(game.downVotes)) : 0;
    return score(second) - score(first);
  });
  return list;
}

function discoverySortLabel(sort) {
  const key = `catalog.sort.${sort.id}`;
  const translated = t(key);
  return translated === key ? sort.title : translated;
}

function renderCustomSortSelect(isLiveSearch) {
  const options = [
    { value: 'default', label: t(isLiveSearch ? 'sort.relevance' : 'sort.curated') },
    { value: 'players', label: t('sort.players') },
    { value: 'likes', label: t('sort.likes') },
    { value: 'alpha', label: t('sort.alpha') }
  ];
  const selected = options.find((option) => option.value === sortMode) || options[0];
  return `<div class="custom-select" data-custom-select>
    <button class="custom-select-trigger" type="button" data-sort-toggle aria-haspopup="listbox" aria-expanded="false" aria-label="${t('search.sort')}"><span>${escapeHtml(selected.label)}</span>${icon('chevronDown', 13)}</button>
    <div class="custom-select-menu" role="listbox" aria-label="${t('search.sort')}" hidden>${options.map((option) => `<button class="custom-select-option" type="button" role="option" aria-selected="${sortMode === option.value}" data-sort-value="${option.value}">${escapeHtml(option.label)}</button>`).join('')}</div>
  </div>`;
}

function renderCatalog() {
  const list = filterGames();
  const availableSorts = discoverySorts.length ? discoverySorts : fallbackDiscoverySorts;
  const selectedSort = availableSorts.find((sort) => sort.id === activeDiscoverySort) || availableSorts[0];
  const queryLabel = searchQuery ? t('search.queryLabel', { query: escapeHtml(searchQuery) }) : t('page.catalog.description');
  const isLiveSearch = searchQuery.length >= 2;
  const isPlaceId = /^\d{5,20}$/.test(searchQuery.trim());
  const controls = isLiveSearch
    ? `<div class="live-search-caption"><span class="live-search-dot"></span>${isPlaceId ? t('search.placeId') : t('search.live')}</div>${renderCustomSortSelect(true)}`
    : `<div class="filter-row discovery-sort-row" role="tablist" aria-label="${t('page.catalog.title')}">${availableSorts.map((sort) => `<button class="filter-chip ${activeDiscoverySort === sort.id ? 'active' : ''}" role="tab" aria-selected="${activeDiscoverySort === sort.id}" data-discovery-sort="${escapeHtml(sort.id)}">${escapeHtml(discoverySortLabel(sort))}</button>`).join('')}</div>${renderCustomSortSelect(false)}`;
  let resultsBody = '';
  if (searchQuery.length === 1) {
    resultsBody = `<div class="empty-state"><div class="empty-icon">${icon('search', 20)}</div><h2>${t('search.shortTitle')}</h2><p>${t('search.shortBody')}</p></div>`;
  } else if (isLiveSearch && searchStatus === 'loading') {
    resultsBody = `<div class="search-loading"><span class="loading-spinner"></span><strong>${isPlaceId ? t('search.placeIdLoading') : t('search.loading')}</strong><small>${t('search.loadingNote')}</small></div>`;
  } else if (isLiveSearch && searchStatus === 'error') {
    resultsBody = `<p class="catalog-disclaimer"><strong>${t('search.errorTitle')}</strong> ${t('search.errorBody')}</p>${renderGrid(list, t('search.noMatches'), t('search.tryAnother'))}`;
  } else if (isLiveSearch && searchStatus === 'success') {
    resultsBody = `<p class="result-note">${formatResultCount(list.length)}</p>${renderGrid(list, t('search.noResults'), t('search.tryShorter'))}${isLoadingMore ? `<div class="load-more-status"><span class="loading-spinner small"></span>${t('search.loadingMore')}</div>` : searchPageToken ? `<button class="ghost-button load-more-button" data-action="load-more">${t('search.loadMore')} ${icon('arrow', 13)}</button>` : ''}`;
  } else if (!searchQuery && discoveryStatus === 'loading') {
    resultsBody = `<div class="search-loading"><span class="loading-spinner"></span><strong>${t('catalog.loading')}</strong><small>${t('catalog.loadingNote')}</small></div>`;
  } else {
    const cachedItems = discoveryCatalog[activeDiscoverySort]?.items || [];
    const offlineNote = discoveryStatus === 'error' ? `<p class="catalog-disclaimer"><strong>${t('catalog.errorTitle')}</strong> ${t('catalog.errorBody')}</p>` : '';
    const loadMore = catalogVisibleCount < list.length ? `<button class="ghost-button load-more-button" data-action="load-more">${t('catalog.loadMore')} ${icon('arrow', 13)}</button>` : '';
    const note = cachedItems.length ? `<p class="result-note">${formatResultCount(list.length)} · ${escapeHtml(discoverySortLabel(selectedSort))}</p>` : '';
    resultsBody = `${offlineNote}${note}${renderGrid(list.slice(0, catalogVisibleCount), t('empty.noResults'), t('empty.filterHint'))}${loadMore}`;
  }
  return `${pageHeading(searchQuery ? t('page.search.eyebrow') : t('page.catalog.eyebrow'), searchQuery ? t('page.search.title') : t('page.catalog.title'), queryLabel, `<button class="ghost-button" data-nav="settings">${icon('sliders')} ${t('catalog.customize')}</button>`)}
    <div class="catalog-controls">${controls}</div>${resultsBody}
    ${isLiveSearch ? '' : discoveryStatus === 'loading' ? '' : `<p class="catalog-disclaimer"><strong>${t('catalog.disclaimerTitle')}</strong> ${t('catalog.disclaimer')}</p>`}`;
}

function renderFavorites() {
  const list = allGames().filter((game) => favorites.has(game.id));
  return `${pageHeading(t('page.favorites.eyebrow'), t('page.favorites.title'), t('page.favorites.description'))}
    ${renderGrid(list, t('empty.favorites.title'), t('empty.favorites.body'), 'catalog')}`;
}

let friendsCache = { at: 0, data: null };
const FRIENDS_TTL = 30 * 1000;
let friendsAutoDetectStarted = false;
// First visit to the Friends page with no username: detect the local Roblox
// account automatically, so the user never has to type anything.
async function autoDetectRobloxAccountOnce() {
  if (friendsAutoDetectStarted || preferences.robloxUsername) return;
  friendsAutoDetectStarted = true;
  try {
    const result = await window.vortexDesktop?.detectRobloxAccount();
    if (result && result.ok && result.account && result.account.name) {
      preferences.robloxUsername = result.account.name;
      friendsCache = { at: 0, data: null };
      savePreferences();
      renderPage();
    }
  } catch { /* stay on the setup screen */ }
}

// Friends page as a card grid: one compact card per friend, richer info on
// hover (avatar, game, join) in a floating preview panel.
function renderFriends() {
  const username = String(preferences.robloxUsername || '').trim();
  if (!username) {
    autoDetectRobloxAccountOnce();
    return `${pageHeading(t('page.friends.eyebrow'), t('page.friends.title'), t('page.friends.description'))}
      <section class="section-block"><div class="empty-state"><div class="empty-icon">${icon('users', 20)}</div><h2>${t('friends.setup.title')}</h2><p>${t('friends.setup.body')}</p><button class="primary-button" data-detect-username-home>${icon('users')} ${t('friends.detect')}</button> <button class="ghost-button" data-nav="settings">${icon('sliders')} ${t('friends.setup.action')}</button></div></section>`;
  }
  if (!friendsCache.data || Date.now() - friendsCache.at > FRIENDS_TTL) {
    loadFriends(username);
    if (!friendsCache.data) {
      return `${pageHeading(t('page.friends.eyebrow'), t('page.friends.title'), t('page.friends.description'))}
        <section class="section-block"><div class="friends-loading">${icon('users', 18)}<p>${t('friends.loading')}</p></div></section>`;
    }
  }
  const data = friendsCache.data;
  if (!data.ok) {
    return `${pageHeading(t('page.friends.eyebrow'), t('page.friends.title'), t('page.friends.description'))}
      <section class="section-block"><div class="empty-state"><div class="empty-icon">${icon('users', 20)}</div><h2>${t('friends.notFound.title')}</h2><p>${t('friends.notFound.body')}</p></div></section>`;
  }
  const friends = data.friends || [];
  const playing = friends.filter((f) => f.presence === 'playing');
  const online = friends.filter((f) => f.presence === 'online');
  const offline = friends.filter((f) => f.presence === 'offline');
  const presenceNote = data.livePresence ? '' : `<div class="friends-presence-note">${icon('bell', 12)} ${t('friends.presenceOff')}</div>`;
  const card = (friend) => `<article class="friend-card ${friend.presence}" data-friend-id="${escapeHtml(friend.id)}" data-friend-name="${escapeHtml(friend.displayName || friend.name || '')}" data-friend-avatar="${escapeHtml(friend.avatar || '')}" data-game-name="${escapeHtml(friend.gameName || '')}" data-game-thumb="${escapeHtml(friend.gameThumbnail || '')}" tabindex="0">
      <span class="friend-avatar ${friend.avatar ? 'has-avatar' : ''}">${friend.avatar ? `<img src="${escapeHtml(friend.avatar)}" alt="" loading="lazy" />` : escapeHtml((friend.displayName || friend.name || '?')[0].toLocaleUpperCase())}</span>
      <span class="friend-copy"><strong>${escapeHtml(friend.displayName || friend.name)}</strong><small>${friend.presence === 'playing' ? escapeHtml(friend.gameName || t('friends.inGame')) : friend.presence === 'online' ? t('friends.online') : t('friends.offline')}</small></span>
      ${friend.presence === 'playing' && friend.placeId ? `<button class="friend-join" data-friend-join="${escapeHtml(friend.placeId)}" data-friend-game="${escapeHtml(friend.gameId || '')}" title="${t('friends.join')}">${icon('play', 14)}</button>` : ''}
    </article>`;
  const section = (titleKey, list) => !list.length ? '' : `<p class="friends-group-title">${t(titleKey)} · ${list.length}</p>
    <div class="friends-grid">${list.map(card).join('')}</div>`;
  return `${pageHeading(t('page.friends.eyebrow'), t('page.friends.title'), t('page.friends.description'))}
    <section class="section-block">
      ${presenceNote}
      ${section('friends.groupPlaying', playing)}
      ${section('friends.groupOnline', online)}
      ${section('friends.groupOffline', offline)}
      ${friends.length ? '' : `<div class="empty-state"><div class="empty-icon">${icon('users', 20)}</div><h2>${t('friends.empty.title')}</h2><p>${t('friends.empty.body')}</p></div>`}
      <p class="catalog-disclaimer">${t('friends.disclaimer')}</p>
    </section>`;
}

async function loadFriends(username) {
  try {
    const data = await window.vortexDesktop?.listFriends(username);
    // Cache successes only: a transient network failure must retry on the
    // next visit instead of showing a stale error for 30 seconds.
    if (data && data.ok) friendsCache = { at: Date.now(), data };
    else friendsCache = { at: Date.now() - FRIENDS_TTL, data };
    if (currentView === 'friends') renderPage();
  } catch {
    friendsCache = { at: 0, data: { ok: false, error: 'network' } };
    if (currentView === 'friends') renderPage();
  }
}

function renderRecent() {
  const list = recentGames.map(getGame).filter(Boolean);
  return `${pageHeading(t('page.recent.eyebrow'), t('page.recent.title'), t('page.recent.description'))}
    ${renderGrid(list, t('empty.recent.title'), t('empty.recent.body'), 'catalog')}`;
}

// Roadmap data: each direction carries a stage key and a 0..1 progress.
const PLANS_DATA = [
  { icon: 'trophy', title: 'plans.recommendations', body: 'plans.recommendationsBody', stage: 'design' },
  { icon: 'flag', title: 'plans.collections', body: 'plans.collectionsBody', stage: 'dev' }
];
const PLANS_FILTERS = [
  ['all', 'plans.filter.all'],
  ['research', 'plans.filter.research'],
  ['design', 'plans.filter.design'],
  ['dev', 'plans.filter.dev'],
  ['idea', 'plans.filter.idea']
];
let activePlansFilter = 'all';

const PLANS_STAGE_LABELS = { research: 'plans.filter.research', design: 'plans.filter.design', dev: 'plans.filter.dev', idea: 'plans.filter.idea' };

function renderPlans() {
  // Simple roadmap: a short list of what is coming. No stage filters, no
  // numeric progress, no reviews section  deliberately minimal.
  return `${pageHeading(t('page.plans.eyebrow'), t('page.plans.title'), t('page.plans.description'))}
    <div class="roadmap-grid">${PLANS_DATA.map((plan) => `<article class="roadmap-card" data-stage="${plan.stage}">
        <div class="roadmap-icon">${icon(plan.icon)}</div>
        <h3>${t(plan.title)}</h3><p>${t(plan.body)}</p>
        <span class="roadmap-state">${t(PLANS_STAGE_LABELS[plan.stage])}</span>
      </article>`).join('')}</div>`;
}

function settingsTabs() {
  const tabs = [ ['home', 'home'], ['accent', 'palette'], ['cards', 'layout'], ['effects', 'motion'], ['interface', 'sliders'], ['general', 'slidersHorizontal'], ['version', 'download'] ];
  return `<div class="settings-tabs">${tabs.map(([key, iconName]) => `<button class="settings-tab ${preferences.settingsTab === key ? 'active' : ''}" data-settings-tab="${key}"><span>${icon(iconName)}</span>${t(`settings.tab.${key}`)}</button>`).join('')}</div>`;
}

function renderHomeSettings() {
  const featuredId = String(preferences.homeFeaturedGame || '');
  const picksIds = new Set((Array.isArray(preferences.homePicks) ? preferences.homePicks : []).map(String));
  const customGames = Array.isArray(preferences.customGames) ? preferences.customGames : [];
  const optionRow = (game) => {
    const id = String(game.id);
    const thumbnail = safeThumbnail(game.thumbnail);
    const badge = (text, key, active) => `<button class="home-game-badge ${active ? 'active' : ''}" data-${key}="${escapeHtml(id)}" aria-pressed="${active}">${icon(active ? 'check' : 'plus', 12)}<span>${text}</span></button>`;
    return `<div class="custom-game-row" data-custom-row="${escapeHtml(id)}">
      <span class="home-game-art art-live ${thumbnail ? 'has-thumbnail' : ''}">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" />` : ''}</span>
      <span class="home-game-copy"><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(game.creator || game.genre || 'Roblox')}</small></span>
      <span class="home-game-badges">
        ${badge(t('settings.home.forBanner'), 'banner-pick', featuredId === id)}
        ${badge(t('settings.home.forPicks'), 'picks-pick', picksIds.has(id))}
      </span>
      <button class="ghost-button custom-game-remove" data-remove-custom="${escapeHtml(id)}" aria-label="${t('settings.home.remove')}">${icon('close', 12)}</button>
    </div>`;
  };
  const customList = customGames.length
    ? `<div class="home-game-options home-game-options-list">${customGames.map(optionRow).join('')}</div>`
    : `<p class="catalog-disclaimer">${t('settings.home.customEmpty')}</p>`;
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.home.title')}</h2><p>${t('settings.home.body')}</p></div>${icon('home', 18)}</div>
      <label class="home-greeting-field"><span>${t('settings.home.greeting')}</span><input type="text" maxlength="48" value="${escapeHtml(preferences.homeGreeting)}" placeholder="${t('settings.home.greetingHint')}" data-home-greeting /></label>
      <div class="setting-line home-featured-head"><div class="setting-label"><strong>${t('settings.home.customTitle')}</strong><small>${t('settings.home.customBody')}</small></div></div>
      <div class="custom-game-form">
        <span class="game-search-field">
          <span class="game-search-icon">${icon('search', 14)}</span>
          <input type="text" maxlength="100" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="game-search-results" placeholder="${t('settings.home.searchHint')}" data-game-search />
          <div class="game-search-results" id="game-search-results" role="listbox" hidden></div>
        </span>
        <button class="primary-button" data-add-custom>${icon('plus', 14)} ${t('settings.home.add')}</button>
      </div>
      <p class="custom-game-status" data-custom-status></p>
      ${customList}
      <div class="setting-line home-setting-line"><div class="setting-label"><strong>${t('settings.home.gameCount')}</strong></div><div class="segmented"><button class="segment ${Number(preferences.homeGameCount) === 4 ? 'active' : ''}" data-pref="homeGameCount" data-value="4">4</button><button class="segment ${Number(preferences.homeGameCount) === 6 ? 'active' : ''}" data-pref="homeGameCount" data-value="6">6</button><button class="segment ${Number(preferences.homeGameCount) === 8 ? 'active' : ''}" data-pref="homeGameCount" data-value="8">8</button></div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.home.layout')}</strong><small>${t('settings.home.layoutBody')}</small></div><div class="segmented">${[['balanced', t('settings.home.layoutBalanced')], ['spotlight', t('settings.home.layoutSpotlight')], ['library', t('settings.home.layoutLibrary')]].map(([value, label]) => `<button class="segment ${preferences.homeLayout === value ? 'active' : ''}" data-pref="homeLayout" data-value="${value}" ${previewAttr('homeLayout', value, label)}>${label}</button>`).join('')}</div></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.home.sections')}</h2><p>${t('settings.home.sectionsBody')}</p></div>${icon('layout', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.home.hero')}</strong><small>${t('settings.home.heroHint')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.homeShowHero}" data-toggle="homeShowHero" aria-label="${t('settings.home.hero')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.home.recommendations')}</strong><small>${t('settings.home.recommendationsHint')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.homeShowRecommendations}" data-toggle="homeShowRecommendations" aria-label="${t('settings.home.recommendations')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.home.minimal')}</strong><small>${t('settings.home.minimalBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.homeMinimal}" data-toggle="homeMinimal" aria-label="${t('settings.home.minimal')}"></button></div>

      <p class="catalog-disclaimer">${t('settings.home.hint')}</p>
    </section>`;
}

// Live game lookup for the "My games" field. Results are cached per query so typing
// back and forth does not hammer the Roblox search API.
const gameSearchCache = new Map();
const gameSearchCacheMeta = new Map();
const GAME_SEARCH_CACHE_TTL = 5 * 60 * 1000;
const GAME_SEARCH_CACHE_MAX = 50;
const gameSearchResults = new Map();
let gameSearchTimer = null;
let gameSearchRequestId = 0;
let gameSearchItems = [];
// Same-session memo for the game-add dropdown: much faster than the
// localStorage cache and shared across re-renders of the settings page.
const gameSearchMemo = new Map();
const SEARCH_MEMO_TTL = 5 * 60 * 1000;
const SEARCH_MEMO_MAX = 60;
function gameSearchMemoSet(query, items, index) {
  const key = String(query).trim().toLowerCase();
  if (!key) return;
  gameSearchMemo.set(key, { at: Date.now(), items, index: index || 0 });
  if (gameSearchMemo.size > SEARCH_MEMO_MAX) {
    const oldest = [...gameSearchMemo.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, gameSearchMemo.size - SEARCH_MEMO_MAX);
    oldest.forEach(([k]) => gameSearchMemo.delete(k));
  }
}
let gameSearchActiveIndex = -1;

function gameSearchInput() {
  return pageContent.querySelector('[data-game-search]');
}

function gameSearchList() {
  return pageContent.querySelector('.game-search-results');
}

function closeGameSearch() {
  const list = gameSearchList();
  if (list) {
    list.hidden = true;
    list.innerHTML = '';
  }
  gameSearchItems = [];
  gameSearchActiveIndex = -1;
  const input = gameSearchInput();
  if (input) input.setAttribute('aria-expanded', 'false');
}

function highlightGameSearch(index) {
  const list = gameSearchList();
  if (!list) return;
  const options = [...list.querySelectorAll('.game-search-option')];
  if (!options.length) return;
  gameSearchActiveIndex = (index + options.length) % options.length;
  options.forEach((option, position) => option.classList.toggle('active', position === gameSearchActiveIndex));
  options[gameSearchActiveIndex]?.scrollIntoView({ block: 'nearest' });
}

function renderGameSearchResults(items, note = '') {
  const list = gameSearchList();
  const input = gameSearchInput();
  if (!list || !input) return;
  gameSearchItems = items;
  gameSearchActiveIndex = -1;
  list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  if (!items.length) {
    list.innerHTML = `<p class="game-search-note">${escapeHtml(note || t('settings.home.searchEmpty'))}</p>`;
    return;
  }
  list.innerHTML = items.map((game, index) => {
    const thumbnail = safeThumbnail(game.thumbnail);
    const meta = [game.creator, game.playerCount ? t('search.players', { count: formatCount(game.playerCount) }) : ''].filter(Boolean).join(' · ');
    const hint = String(game.description || '').trim();
    return `<button class="game-search-option" role="option" data-game-pick="${escapeHtml(game.id)}" data-index="${index}" aria-selected="false">
      <span class="game-search-art ${thumbnail ? 'has-thumbnail' : ''}">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" />` : ''}</span>
      <span class="game-search-copy"><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(meta || t('tag.roblox'))}</small>${hint ? `<em>${escapeHtml(hint.slice(0, 84))}</em>` : ''}</span>
      ${icon('arrow', 13)}
    </button>`;
  }).join('');
}

async function searchGamesByName(query) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    closeGameSearch();
    return;
  }
  if (!window.vortexDesktop?.searchGames) {
    renderGameSearchResults([], t('settings.home.customDesktopOnly'));
    return;
  }
  const cacheKey = trimmed.toLocaleLowerCase(preferences.language);
  const cached = gameSearchCache.get(cacheKey);
  const cachedAt = gameSearchCacheMeta.get(cacheKey) || 0;
  if (cached && Date.now() - cachedAt < GAME_SEARCH_CACHE_TTL) {
    // Refresh recency on use so the cap behaves like a small LRU cache.
    gameSearchCache.delete(cacheKey);
    gameSearchCache.set(cacheKey, cached);
    gameSearchCacheMeta.set(cacheKey, Date.now());
    renderGameSearchResults(cached);
    return;
  }
  if (cached) { gameSearchCache.delete(cacheKey); gameSearchCacheMeta.delete(cacheKey); }
  const requestId = ++gameSearchRequestId;
  renderGameSearchResults([], t('settings.home.searchLoading'));
  try {
    const response = await window.vortexDesktop.searchGames({ query: trimmed });
    if (requestId !== gameSearchRequestId) return;
    const items = (response?.items || []).slice(0, 8).map((item) => normalizeDiscoveredGame(item, trimmed));
    items.forEach((item) => gameSearchResults.set(String(item.id), item));
    gameSearchCache.set(cacheKey, items);
    gameSearchCacheMeta.set(cacheKey, Date.now());
    while (gameSearchCache.size > GAME_SEARCH_CACHE_MAX) {
      const oldestKey = gameSearchCache.keys().next().value;
      gameSearchCache.delete(oldestKey);
      gameSearchCacheMeta.delete(oldestKey);
    }
    gameSearchMemoSet(trimmed, items, 0);
    if (gameSearchInput()?.value.trim() !== trimmed) return;
    renderGameSearchResults(items);
  } catch {
    if (requestId !== gameSearchRequestId) return;
    renderGameSearchResults([], t('settings.home.customError'));
  }
}

function pickGameFromSearch(placeId) {
  const game = gameSearchResults.get(String(placeId));
  if (!game) return;
  addCustomGame(game);
}

function scheduleGameSearch(query) {
  if (gameSearchTimer) window.clearTimeout(gameSearchTimer);
  if (query.trim().length < 2) {
    closeGameSearch();
    return;
  }
  // Memo hit: re-typing a recently searched query answers instantly,
  // skipping the async roundtrip entirely.
  const memo = gameSearchMemo.get(query.trim().toLowerCase());
  if (memo && Date.now() - memo.at < SEARCH_MEMO_TTL) {
    renderGameSearchResults(memo.items);
    highlightGameSearch(memo.index || 0);
    return;
  }
  gameSearchTimer = window.setTimeout(() => searchGamesByName(query), 320);
}

async function addCustomGame(preselected = null) {
  const input = pageContent.querySelector('[data-game-search], [data-custom-input]');
  const status = pageContent.querySelector('[data-custom-status]');
  const setStatus = (text) => { if (status) status.textContent = text; };
  const store = (game) => {
    const id = String(game.id);
    preferences.customGames = [game, ...(preferences.customGames || []).filter((existing) => String(existing.id) !== id)].slice(0, 12);
    // A fresh game joins the home picks right away; it becomes the banner game only
    // while the banner is still empty.
    if (!preferences.homeFeaturedGame) preferences.homeFeaturedGame = id;
    preferences.homePicks = [...new Set([...(preferences.homePicks || []).map(String), id])];
    savePreferences();
    closeGameSearch();
    renderPage();
    showToast(t('settings.home.customAdded', { game: game.title }));
    const fresh = pageContent.querySelector('[data-game-search]');
    if (fresh) fresh.value = '';
    const freshStatus = pageContent.querySelector('[data-custom-status]');
    if (freshStatus) freshStatus.textContent = '';
  };

  if (preselected) {
    store(preselected);
    return;
  }

  const raw = String(input?.value || '').trim();
  const placeId = (raw.match(/roblox\.com\/games\/(\d{5,20})/i) || raw.match(/^(\d{5,20})$/))?.[1];
  if (placeId) {
    if (!window.vortexDesktop?.searchGames) { setStatus(t('settings.home.customDesktopOnly')); return; }
    setStatus(t('settings.home.customLoading'));
    try {
      const response = await window.vortexDesktop.searchGames({ query: placeId });
      const item = response?.items?.[0];
      if (!item) { setStatus(t('settings.home.customNotFound')); return; }
      store({ ...normalizeDiscoveredGame(item), id: placeId });
    } catch {
      setStatus(t('settings.home.customError'));
    }
    return;
  }

  // A name was typed: use the first match from the live dropdown.
  if (raw.length >= 2) {
    const cached = gameSearchCache.get(raw.toLocaleLowerCase(preferences.language));
    const first = cached?.[0] ?? gameSearchItems[0];
    if (first) { store(first); return; }
    if (!window.vortexDesktop?.searchGames) { setStatus(t('settings.home.customDesktopOnly')); return; }
    setStatus(t('settings.home.searchLoading'));
    await searchGamesByName(raw);
    const found = gameSearchItems[0];
    if (found) store(found);
    else setStatus(raw ? t('settings.home.searchEmpty') : t('settings.home.customInvalid'));
    return;
  }

  setStatus(t('settings.home.customInvalid'));
}

document.addEventListener('keydown', (event) => {
  if (!event.target.matches?.('[data-game-search]')) {
    if (event.key === 'Enter' && event.target.matches?.('[data-custom-input]')) addCustomGame();
    return;
  }
  const list = gameSearchList();
  const open = list && !list.hidden && gameSearchItems.length;
  if (event.key === 'ArrowDown' && open) {
    event.preventDefault();
    highlightGameSearch(gameSearchActiveIndex + 1);
    return;
  }
  if (event.key === 'ArrowUp' && open) {
    event.preventDefault();
    highlightGameSearch(gameSearchActiveIndex - 1);
    return;
  }
  if (event.key === 'Escape') {
    closeGameSearch();
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const picked = gameSearchActiveIndex >= 0 ? gameSearchItems[gameSearchActiveIndex] : gameSearchItems[0];
    if (picked) pickGameFromSearch(picked.id);
    else addCustomGame();
  }
});

function renderAccentSettings() {
  const themeDefaults = { dark: { background: '#0b0c10', surface: '#111319' }, light: { background: '#f2f1f6', surface: '#ffffff' }, oled: { background: '#030305', surface: '#08090c' } }[preferences.theme];
  const displayBackground = preferences.themeBackground || themeDefaults.background;
  const displaySurface = preferences.themeSurface || themeDefaults.surface;
  const isLight = relativeLuminance(displayBackground) > 0.42;
  const displayText = preferences.themeText || (isLight ? '#211e2a' : '#f4f4f6');
  const displayMuted = preferences.themeMuted || (isLight ? '#777382' : '#8d909e');
  const displayLine = preferences.themeLine || (isLight ? '#37303f' : '#2b2d36');
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.accent.title')}</h2><p>${t('settings.accent.body')}</p></div>${icon('palette', 18)}</div>
      <div class="palette-row">${palettes.map((palette) => `<button class="palette-option ${preferences.accent.toLowerCase() === palette.color ? 'active' : ''}" data-accent="${palette.color}" ${previewAttr('accent', palette.color, t(`palette.${palette.key}`))}><span class="palette-swatch" style="background:${palette.color};color:${palette.color}"></span>${t(`palette.${palette.key}`)}</button>`).join('')}</div>
      ${renderColorTuner('accent', preferences.accent, t('settings.customColor'))}
      <div class="setting-line accent-mode-line"><div class="setting-label"><strong>${t('settings.accentMode')}</strong></div><div class="segmented"><button class="segment ${preferences.accentMode === 'solid' ? 'active' : ''}" data-pref="accentMode" data-value="solid">${t('settings.solid')}</button><button class="segment ${preferences.accentMode === 'gradient' ? 'active' : ''}" data-pref="accentMode" data-value="gradient">${t('settings.gradient')}</button></div></div>
      ${preferences.accentMode === 'gradient' ? `<div class="gradient-options">${renderColorTuner('accentSecondary', preferences.accentSecondary, t('settings.gradientEnd'))}<label class="gradient-angle"><span>${t('settings.gradientAngle')}</span><input type="range" min="0" max="360" value="${preferences.gradientAngle}" data-setting="gradientAngle" /><output id="gradient-angle-value">${preferences.gradientAngle}°</output></label><div class="gradient-preview" aria-hidden="true"></div></div>` : ''}
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.theme.title')}</h2><p>${t('settings.theme.body')}</p></div></div><div class="segmented" style="max-width:390px">${[['dark', `${icon('moon', 13)} ${t('settings.dark')}`], ['light', `${icon('sun', 13)} ${t('settings.light')}`], ['oled', `${icon('contrast', 13)} ${t('settings.oled')}`]].map(([value, label]) => `<button class="segment ${preferences.theme === value ? 'active' : ''}" data-pref="theme" data-value="${value}" ${previewAttr('theme', value, t(`settings.${value}`))}>${label}</button>`).join('')}</div>
      <p class="theme-color-hint">${t('settings.themeColorHint')}</p><div class="theme-color-tuners">${renderColorTuner('themeBackground', displayBackground, t('settings.themeBackground'))}${renderColorTuner('themeSurface', displaySurface, t('settings.themeSurface'))}</div>
      <div class="theme-color-tuners">${renderColorTuner('themeText', displayText, t('settings.themeText'))}${renderColorTuner('themeMuted', displayMuted, t('settings.themeMuted'))}${renderColorTuner('themeLine', displayLine, t('settings.themeLine'))}</div>
      <div class="theme-io"><button class="ghost-button" data-action="export-theme">${t('settings.themeExport')}</button><button class="ghost-button" data-action="import-theme">${t('settings.themeImport')}</button><input type="file" accept=".json,application/json" data-theme-file hidden /></div>
      <button class="text-button theme-reset" data-action="reset-theme-colors">${t('settings.themeReset')}</button>
      <div class="settings-preview" style="margin-top:17px"><div class="preview-thumb"></div><div class="preview-copy"><strong>${t('settings.preview.title')}</strong><small>${t('settings.preview.body')}</small></div></div>
    </section>` + renderWallpaperCard();
}

function renderWallpaperCard() {
  const hasWallpaper = Boolean(preferences.themeWallpaper);
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.wallpaper.title')}</h2><p>${t('settings.wallpaper.body')}</p></div></div>
    <div class="wallpaper-controls">
      <div class="wallpaper-pickers">
        <button class="ghost-button" data-action="pick-wallpaper">${t('settings.wallpaper.pick')}</button>
        ${hasWallpaper ? `<button class="ghost-button" data-action="remove-wallpaper">${t('settings.wallpaper.remove')}</button>` : ''}
        <input type="file" accept="image/*" data-wallpaper-file hidden />
      </div>
      <label class="range-line"><span>${t('settings.wallpaper.blur')}</span><input type="range" min="0" max="40" value="${preferences.themeWallpaperBlur}" data-wallpaper-blur ${hasWallpaper ? '' : 'disabled'} /><b>${preferences.themeWallpaperBlur}px</b></label>
      <label class="range-line"><span>${t('settings.wallpaper.dim')}</span><input type="range" min="0" max="90" value="${preferences.themeWallpaperDim}" data-wallpaper-dim ${hasWallpaper ? '' : 'disabled'} /><b>${preferences.themeWallpaperDim}%</b></label>
      <div class="toggle-row"><label class="toggle"><input type="checkbox" data-wallpaper-grain ${preferences.themeGrain ? 'checked' : ''} /><span class="toggle-track"></span>${t('settings.wallpaper.grain')}</label>
      <label class="toggle"><input type="checkbox" data-wallpaper-vignette ${preferences.themeVignette ? 'checked' : ''} /><span class="toggle-track"></span>${t('settings.wallpaper.vignette')}</label></div>
    </div>
  </section>`;
}

function renderCardSettings() {
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.cardTuning.title')}</h2><p>${t('settings.cardTuning.body')}</p></div>${icon('sliders', 18)}</div>
    <div class="wallpaper-controls">
      <label class="range-line"><span>${t('settings.cardTuning.size')}</span><input type="range" min="0.7" max="1.3" step="0.05" value="${preferences.cardSize}" data-card-size /><b>${Math.round(preferences.cardSize * 100)}%</b></label>
      <label class="range-line"><span>${t('settings.cardTuning.radius')}</span><input type="range" min="0" max="20" value="${preferences.cardRadius}" data-card-radius /><b>${preferences.cardRadius}px</b></label>
      <div class="toggle-row">
        <label class="toggle"><input type="checkbox" data-card-flag="cardShowDescription" ${preferences.cardShowDescription ? 'checked' : ''} /><span class="toggle-track"></span>${t('settings.cardTuning.description')}</label>
        <label class="toggle"><input type="checkbox" data-card-flag="cardShowLikes" ${preferences.cardShowLikes ? 'checked' : ''} /><span class="toggle-track"></span>${t('settings.cardTuning.likes')}</label>
        <label class="toggle"><input type="checkbox" data-card-flag="cardShowPlaytime" ${preferences.cardShowPlaytime ? 'checked' : ''} /><span class="toggle-track"></span>${t('settings.cardTuning.playtime')}</label>
        <label class="toggle"><input type="checkbox" data-card-flag="cardShowGenre" ${preferences.cardShowGenre ? 'checked' : ''} /><span class="toggle-track"></span>${t('settings.cardTuning.genre')}</label>
      </div>
    </div>
  </section>
  <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.density.title')}</h2><p>${t('settings.density.body')}</p></div>${icon('grid', 18)}</div>
      <div class="segmented density-segmented">${[['spacious', t('settings.spacious')], ['comfortable', t('settings.comfortable')], ['compact', t('settings.compact')]].map(([value, label]) => `<button class="segment ${preferences.density === value ? 'active' : ''}" data-pref="density" data-value="${value}" ${previewAttr('density', value, label)}>${label}</button>`).join('')}</div>
      <div class="setting-line" style="margin-top:13px"><div class="setting-label"><strong>${t('settings.corners.title')}</strong><small>${t('settings.corners.body')}</small></div><div class="segmented">${[['soft', t('settings.soft')], ['sharp', t('settings.sharp')]].map(([value, label]) => `<button class="segment ${preferences.corners === value ? 'active' : ''}" data-pref="corners" data-value="${value}" ${previewAttr('corners', value, label)}>${label}</button>`).join('')}</div></div>
      <div class="settings-preview"><div class="density-preview-art" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="preview-copy"><strong>${t('settings.anyScreen')}</strong><small>${t('settings.appliesToCatalog')}</small></div></div>
    </section>`;
}

function renderAnimationOption(preference, value, label, active) {
  return `<button class="segment ${active ? 'active' : ''}" data-pref="${preference}" data-value="${value}" data-preview="${preference}:${value}" data-preview-label="${escapeHtml(label)}"><span>${label}</span></button>`;
}

function previewAttr(type, value, label) {
  return `data-preview="${type}:${value}" data-preview-label="${escapeHtml(label)}"`;
}

// Segmented control where every option shows a hover preview of what it changes.
function segmentsWithPreview(preference, options) {
  return `<div class="segmented">${options.map(([value, label, type]) => `<button class="segment ${preferences[preference] === value || String(preferences[preference]) === String(value) ? 'active' : ''}" data-pref="${preference}" data-value="${value}" ${previewAttr(type || preference, value, label)}>${label}</button>`).join('')}</div>`;
}

// Floating preview: every option that carries data-preview="<type>:<value>" shows a small
// mock of the launcher while the pointer is over it. Each option renders its own mock.
function previewMarkup(type, value, label) {
  if (type === 'pageTransition') {
    const variant = { fade: 'fade', slide: 'slide', zoom: 'zoom', none: 'none' }[value] || 'fade';
    return `<div class="hover-preview-mock page-transition-mock ${variant}"><span class="mock-page"><b></b><b class="short"></b></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'cardAnimation') {
    const variant = { rise: 'rise', fade: 'fade', pop: 'pop', none: 'none' }[value] || 'rise';
    return `<div class="hover-preview-mock card-animation-mock ${variant}"><i></i><i></i><i></i></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'accent') {
    return `<div class="hover-preview-mock accent-mock" style="--mock-accent:${escapeHtml(value)}"><span class="mock-chip"></span><span class="mock-bar"></span><span class="mock-bar short"></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'accentMode') {
    return `<div class="hover-preview-mock fill-mock ${value === 'gradient' ? 'is-gradient' : ''}"><span class="mock-chip"></span><span class="mock-bar"></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'theme') {
    const tone = { dark: ['#0b0c10', '#14161d'], light: ['#f2f1f6', '#ffffff'], oled: ['#030305', '#08090c'] }[value] || ['#0b0c10', '#14161d'];
    return `<div class="hover-preview-mock theme-mock" style="--mock-bg:${tone[0]};--mock-surface:${tone[1]}"><span class="mock-side"></span><span class="mock-bar"></span><span class="mock-bar short"></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'density') {
    const columns = { spacious: 2, comfortable: 3, compact: 4 }[value] || 3;
    return `<div class="hover-preview-mock grid-mock" style="--mock-columns:${columns}">${'<i></i>'.repeat(columns * 2)}</div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'corners') {
    return `<div class="hover-preview-mock corners-mock ${value === 'sharp' ? 'is-sharp' : ''}"><i></i><i></i></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'homeLayout') {
    const heroHeight = { balanced: '34%', spotlight: '62%', library: '18%' }[value] || '34%';
    const columns = { balanced: 3, spotlight: 2, library: 4 }[value] || 3;
    return `<div class="hover-preview-mock layout-mock" style="--mock-hero:${heroHeight}"><span class="mock-hero"><b></b></span><span class="mock-grid" style="grid-template-columns:repeat(${columns},1fr)">${'<i></i>'.repeat(columns)}</span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }

  if (type === 'uiPart') {
    return previewUiPart(value, label);
  }
  return '';
}

// Interface part previews: each toggle shows its own corner of the launcher with the
// part highlighted, so every option is visually distinct.
function previewUiPart(part, label) {
  const shell = (rows, active) => `<div class="hover-preview-mock ui-part-mock ui-${escapeHtml(part)} ${active ? 'is-on' : 'is-off'}">${rows}</div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  const spark = '<span class="mock-ui-part"><i></i></span>';
  switch (part) {
    case 'uiSidebarTip':
      return shell('<span class="mock-ui-nav"></span><span class="mock-ui-nav"></span><span class="mock-ui-tip"></span>', preferences.uiSidebarTip);
    case 'uiProfileCard':
      return shell('<span class="mock-ui-nav"></span><span class="mock-ui-profile"><i></i><b></b></span>', preferences.uiProfileCard);
    case 'uiSidebarFoot':
      return shell('<span class="mock-ui-nav"></span><span class="mock-ui-foot"></span>', preferences.uiSidebarFoot);
    case 'uiTopbarSearch':
      return shell('<span class="mock-ui-topbar"><b class="mock-crumb"></b><b class="mock-search"></b><b class="mock-bell"></b></span>', preferences.uiTopbarSearch);
    case 'uiBreadcrumb':
      return shell('<span class="mock-ui-topbar"><b class="mock-crumb wide"></b><b class="mock-bell"></b></span>', preferences.uiBreadcrumb);
    case 'uiNotifications':
      return shell('<span class="mock-ui-topbar"><b class="mock-crumb wide"></b><b class="mock-bell"></b></span>', preferences.uiNotifications);
    case 'uiUpdateBanner':
      return shell('<span class="mock-ui-banner"><i></i><b></b></span>', preferences.uiUpdateBanner);
    default:
      return shell(spark, true);
  }
}

function previewTarget(event) {
  return event.target.closest?.('[data-preview]') || null;
}

function hideHoverPreview() {
  const layer = document.getElementById('hover-preview-layer');
  if (layer) layer.hidden = true;
}

function showHoverPreview(target) {
  const [type, value = ''] = String(target.dataset.preview || '').split(':');
  const label = target.dataset.previewLabel || target.textContent.trim();
  const markup = previewMarkup(type, value, label);
  if (!markup) return;
  let layer = document.getElementById('hover-preview-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'hover-preview-layer';
    layer.className = 'hover-preview-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  layer.innerHTML = markup;
  layer.hidden = false;
  const box = target.getBoundingClientRect();
  const width = layer.offsetWidth || 150;
  const height = layer.offsetHeight || 90;
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, box.left + box.width / 2 - width / 2));
  const above = box.top - height - 10;
  const top = above > 8 ? above : Math.min(window.innerHeight - height - 12, box.bottom + 10);
  layer.style.left = `${left}px`;
  layer.style.top = `${Math.max(8, top)}px`;
}

document.addEventListener('mouseover', (event) => {
  const target = previewTarget(event);
  if (!target) return;
  if (target.contains(event.relatedTarget)) return;
  showHoverPreview(target);
});
document.addEventListener('mouseout', (event) => {
  const target = previewTarget(event);
  if (!target || target.contains(event.relatedTarget)) return;
  hideHoverPreview();
});
document.addEventListener('scroll', hideHoverPreview, true);

function renderEffectSettings() {
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.effects.title')}</h2><p>${t('settings.effects.body')}</p></div>${icon('wand', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.glow.title')}</strong><small>${t('settings.glow.body')}</small></div><label class="range-control"><input type="range" min="0" max="100" value="${preferences.glow}" data-setting="glow" /><span class="range-value" id="glow-value">${preferences.glow}%</span></label></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.ambient.title')}</strong><small>${t('settings.ambient.body')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.ambient}" data-toggle="ambient" aria-label="${t('settings.ambient.title')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.motion.title')}</strong><small>${t('settings.motion.body')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.motion}" data-toggle="motion" aria-label="${t('settings.motion.title')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.transitionStyle')}</strong></div><div class="segmented animation-segmented">${renderAnimationOption('pageTransition', 'fade', t('settings.transition.fade'), preferences.pageTransition === 'fade')}${renderAnimationOption('pageTransition', 'slide', t('settings.transition.slide'), preferences.pageTransition === 'slide')}${renderAnimationOption('pageTransition', 'zoom', t('settings.transition.zoom'), preferences.pageTransition === 'zoom')}${renderAnimationOption('pageTransition', 'none', t('settings.transition.none'), preferences.pageTransition === 'none')}</div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.cardAnimation')}</strong></div><div class="segmented animation-segmented">${renderAnimationOption('cardAnimation', 'rise', t('settings.cards.rise'), preferences.cardAnimation === 'rise')}${renderAnimationOption('cardAnimation', 'fade', t('settings.cards.fade'), preferences.cardAnimation === 'fade')}${renderAnimationOption('cardAnimation', 'pop', t('settings.cards.pop'), preferences.cardAnimation === 'pop')}${renderAnimationOption('cardAnimation', 'none', t('settings.cards.none'), preferences.cardAnimation === 'none')}</div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.contrast.title')}</strong><small>${t('settings.contrast.body')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.contrast}" data-toggle="contrast" aria-label="${t('settings.contrast.title')}"></button></div>
    </section><p class="catalog-disclaimer">${t('settings.savedLocally')}</p>`;
}

function renderInterfaceSettings() {
  const order = navOrder();
  const rows = order.map((key, index) => {
    const item = NAV_ITEMS.find((entry) => entry.key === key);
    if (!item) return '';
    return `<div class="ui-row" data-ui-row="${key}" data-ui-drag="${key}" role="listitem" tabindex="0" aria-roledescription="${t('settings.ui.dragHint')}">
      <span class="ui-row-grip" aria-hidden="true">${icon('grip', 14)}</span>
      <span class="ui-row-icon" data-icon="${item.icon}"></span>
      <span class="ui-row-copy"><strong>${t(`nav.${item.key}`)}</strong><small>${t(`settings.ui.group.${item.group}`)}</small></span>
      <button class="ui-row-handle" data-ui-move="${key}" data-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="${t('settings.ui.moveUp')}">${icon('navUp', 12)}</button>
      <button class="ui-row-handle" data-ui-move="${key}" data-direction="1" ${index === order.length - 1 ? 'disabled' : ''} aria-label="${t('settings.ui.moveDown')}">${icon('navDown', 12)}</button>
    </div>`;
  }).join('');
  const partToggle = (pref, titleKey, bodyKey) => `<div class="setting-line"><div class="setting-label"><strong>${t(titleKey)}</strong><small>${t(bodyKey)}</small></div><button class="toggle" role="switch" aria-checked="${preferences[pref]}" data-toggle="${pref}" data-preview="uiPart:${pref}" data-preview-label="${escapeHtml(t(titleKey))}" aria-label="${t(titleKey)}"></button></div>`;
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.ui.navTitle')}</h2><p>${t('settings.ui.navBody')}</p></div>${icon('layout', 18)}</div>
      <div class="ui-list" data-ui-order>${rows}</div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.ui.partsTitle')}</h2><p>${t('settings.ui.partsBody')}</p></div>${icon('sliders', 18)}</div>
      <p class="ui-section-title">${t('settings.ui.sidebar')}</p>
      ${partToggle('uiSidebarTip', 'settings.ui.tip', 'settings.ui.tipBody')}
      ${partToggle('uiProfileCard', 'settings.ui.profile', 'settings.ui.profileBody')}
      ${partToggle('uiSidebarFoot', 'settings.ui.foot', 'settings.ui.footBody')}
      <p class="ui-section-title">${t('settings.ui.topbar')}</p>
      ${partToggle('uiTopbarSearch', 'settings.ui.search', 'settings.ui.searchBody')}
      ${partToggle('uiBreadcrumb', 'settings.ui.breadcrumb', 'settings.ui.breadcrumbBody')}
      ${partToggle('uiNotifications', 'settings.ui.notifications', 'settings.ui.notificationsBody')}
      <p class="ui-section-title">${t('settings.ui.other')}</p>
      ${partToggle('uiUpdateBanner', 'settings.ui.updateBanner', 'settings.ui.updateBannerBody')}
      <button class="text-button theme-reset" data-action="reset-interface">${t('settings.ui.reset')}</button>
    </section>`;
}

function moveNavItem(key, direction) {
  const order = navOrder();
  const index = order.indexOf(key);
  const target = index + Number(direction);
  if (index < 0 || target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  preferences.sidebarOrder = order;
  savePreferences();
  renderSidebar();
  renderPage();
}

// Reordering by dragging: press the grip and move the row; the order follows the
// pointer and is saved on release. The sidebar updates live.
function reorderNavTo(fromKey, toIndex) {
  const order = navOrder();
  const fromIndex = order.indexOf(fromKey);
  if (fromIndex < 0 || toIndex < 0 || toIndex >= order.length || fromIndex === toIndex) return;
  order.splice(toIndex, 0, ...order.splice(fromIndex, 1));
  preferences.sidebarOrder = order;
}

let uiDrag = null;
const UI_DRAG_THRESHOLD = 4;

// In-flow drag reorder (Notion/Linear-style): the dragged row never leaves
// the list. While the pointer moves, the row is re-inserted in the DOM at
// the slot under the cursor, so a real gap always opens exactly where the
// row will land. No fixed positioning, no transforms, no coordinate math 
// the browser does all layout. Release commits the DOM order as-is.
function updateUiRowHandles(list) {
  if (!list) return;
  const rows = [...list.querySelectorAll('.ui-row')];
  rows.forEach((row, index) => {
    const up = row.querySelector('[data-direction="-1"]');
    const down = row.querySelector('[data-direction="1"]');
    if (up) up.disabled = index === 0;
    if (down) down.disabled = index === rows.length - 1;
  });
}

function startUiDrag(event, row) {
  const list = row.closest('[data-ui-order]');
  if (!list) return;
  uiDrag = {
    row,
    list,
    started: false,
    pointerId: event.pointerId,
    pointerX: event.clientX,
    pointerY: event.clientY
  };
  event.preventDefault();
}

document.addEventListener('pointermove', (event) => {
  if (!uiDrag || event.pointerId !== uiDrag.pointerId) return;
  if (!uiDrag.started) {
    if (Math.hypot(event.clientX - uiDrag.pointerX, event.clientY - uiDrag.pointerY) < UI_DRAG_THRESHOLD) return;
    uiDrag.started = true;
    uiDrag.row.classList.add('ui-row-dragging');
    document.body.classList.add('ui-dragging');
    if (uiDrag.row.hasAttribute('draggable')) uiDrag.row.setAttribute('draggable', 'false');
  }
  // Which row is the cursor over? Insert the dragged row before it.
  const rows = [...uiDrag.list.querySelectorAll('.ui-row:not(.ui-row-dragging)')];
  let anchor = null;
  for (const item of rows) {
    const rect = item.getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) { anchor = item; break; }
  }
  if (anchor) {
    if (uiDrag.row.nextElementSibling !== anchor) uiDrag.list.insertBefore(uiDrag.row, anchor);
  } else {
    // Cursor below every row: move to the end.
    if (uiDrag.list.lastElementChild !== uiDrag.row) uiDrag.list.appendChild(uiDrag.row);
  }
  updateUiRowHandles(uiDrag.list);
});

function finishUiDrag() {
  if (!uiDrag) return;
  const { row, list, started } = uiDrag;
  uiDrag = null;
  if (!started) return;
  row.classList.remove('ui-row-dragging');
  document.body.classList.remove('ui-dragging');
  const order = [...list.querySelectorAll('.ui-row')].map((item) => item.dataset.uiRow).filter(Boolean);
  preferences.sidebarOrder = order;
  savePreferences();
  renderSidebar();
  updateUiRowHandles(list);
}

document.addEventListener('pointerup', finishUiDrag);
document.addEventListener('pointercancel', finishUiDrag);
document.addEventListener('pointercancel', finishUiDrag);

// Keyboard support: focus a row, then reorder with the arrows.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  const row = event.target.closest?.('[data-ui-row]');
  if (!row || !row.closest('[data-ui-order]')) return;
  event.preventDefault();
  moveNavItem(row.dataset.uiRow, event.key === 'ArrowUp' ? '-1' : '1');
  window.requestAnimationFrame(() => pageContent.querySelector(`[data-ui-row="${row.dataset.uiRow}"]`)?.focus());
});

document.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  // The whole row is the drag handle; the arrow buttons keep their own clicks.
  const row = event.target.closest?.('[data-ui-row]');
  if (!row || !row.closest('[data-ui-order]')) return;
  if (event.target.closest('button')) return;
  startUiDrag(event, row);
});

function renderUpdateSettings() {
  const state = latestUpdateState || { status: 'checking', progress: 0 };
  const status = state.status;
  const version = state.latestVersion || state.currentVersion || '';
  const statusMessage = status === 'downloading' ? t('updates.downloading', { percent: Math.max(0, Math.min(100, Number(state.progress) || 0)) })
    : status === 'downloaded' ? t('updates.ready')
      : status === 'applying' ? t('updates.applying')
        : status === 'error' ? t('updates.error', { error: escapeHtml(state.errorMessage || 'Unknown error') })
          : status === 'current' ? t('updates.current')
            : status === 'unavailable' ? t('updates.unavailable')
              : status === 'development' ? t('updates.development') : t('updates.checking');
  const progress = Math.max(0, Math.min(100, Number(state.progress) || 0));
  const visualProgress = status === 'applying' || status === 'downloaded' ? 100 : progress;
  return `<section class="settings-card update-settings-card" id="update-settings-card" data-update-status="${escapeHtml(status)}"><div class="settings-card-head"><div><h2>${t('updates.settingsTitle')}</h2><p>${t('updates.settingsBody')}</p></div>${icon('download', 18)}</div>
    <div class="update-settings-preview"><div class="update-preview-art" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="update-preview-copy"><strong>${status === 'error' ? t('updates.error', { error: escapeHtml(state.errorMessage || 'Unknown error') }) : escapeHtml(version ? `Vortex ${version}` : t('updates.settingsTitle'))}</strong><small>${statusMessage}</small><span class="update-settings-progress"><i style="--progress:${visualProgress}%"></i></span></div></div>
    ${status === 'error' ? `<button class="ghost-button update-retry-button" data-action="retry-update">${t('updates.retry')}</button>` : ''}
  </section>`;
}

function renderGeneralSettings() {
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.language.title')}</h2><p>${t('settings.language.body')}</p></div>${icon('message', 18)}</div>
      <div class="segmented language-segmented"><button class="segment ${preferences.language === 'ru' ? 'active' : ''}" data-pref="language" data-value="ru">${t('settings.language.ru')}</button><button class="segment ${preferences.language === 'en' ? 'active' : ''}" data-pref="language" data-value="en">${t('settings.language.en')}</button></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.friends.title')}</h2><p>${t('settings.friends.body')}</p></div>${icon('users', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.friends.username')}</strong><small>${t('settings.friends.usernameHint')}</small></div>
        <span class="roblox-username-field"><input type="text" maxlength="20" autocomplete="off" placeholder="Roblox" value="${escapeHtml(preferences.robloxUsername || '')}" data-roblox-username /><button class="ghost-button" data-detect-username>${t('friends.detect')}</button><button class="primary-button" data-save-username>${t('common.save')}</button></span></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.presence.title')}</h2><p>${t('settings.presence.body')}</p></div>${icon('bell', 18)}</div>
      <div class="presence-form">
        <label class="presence-label">${t('settings.presence.cookie')}</label>
        <textarea rows="2" autocomplete="off" spellcheck="false" placeholder=".ROBLOSECURITY" data-presence-cookie></textarea>
        <small class="presence-cookie-meter" data-presence-meter data-hint="${t('settings.presence.cookieHint')}"></small>
        <span class="presence-cookie-error" data-presence-error></span>
        <span class="presence-actions">
          <button class="primary-button" data-save-presence>${t('common.save')}</button>
          <button class="ghost-button" data-remove-presence>${t('settings.presence.disable')}</button>
        </span>
        <p class="presence-warning">${t('settings.presence.hint')}</p>
      </div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.tray.title')}</h2><p>${t('settings.tray.body')}</p></div>${icon('tray', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.tray.scale')}</strong><small>${t('settings.tray.scaleBody')}</small></div><div class="segmented tray-scale-segmented">${[['compact', t('settings.tray.compact')], ['normal', t('settings.tray.normal')], ['large', t('settings.tray.large')]].map(([value, label]) => `<button class="segment ${preferences.trayScale === value ? 'active' : ''}" data-pref="trayScale" data-value="${value}">${label}</button>`).join('')}</div></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.history.title')}</h2><p>${t('settings.history.body')}</p></div>${icon('clock', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.history.title')}</strong><small>${t('settings.history.body')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.saveHistory}" data-toggle="saveHistory" aria-label="${t('settings.history.title')}"></button></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.data.title')}</h2><p>${t('settings.data.body')}</p></div>${icon('download', 18)}</div>
      <div class="data-actions">
        <button class="ghost-button" data-action="export-data">${icon('download', 13)} ${t('settings.data.export')}</button>
        <button class="ghost-button" data-action="import-data">${icon('upload', 13)} ${t('settings.data.import')}</button>
      </div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.cache.title')}</h2><p>${t('settings.cache.body')}</p></div>${icon('search', 18)}</div>
      <button class="ghost-button" data-action="clear-cache">${icon('close', 13)} ${t('settings.cacheClear')}</button>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.reset.title')}</h2><p>${t('settings.reset.body')}</p></div>${icon('slidersHorizontal', 18)}</div>
      <button class="ghost-button" data-action="reset-appearance">${icon('motion', 13)} ${t('settings.resetButton')}</button>
    </section>`;
}

function renderSettings() {
  const panel = preferences.settingsTab === 'home' ? renderHomeSettings() : preferences.settingsTab === 'cards' ? renderCardSettings() : preferences.settingsTab === 'effects' ? renderEffectSettings() : preferences.settingsTab === 'interface' ? renderInterfaceSettings() : preferences.settingsTab === 'general' ? renderGeneralSettings() : preferences.settingsTab === 'version' ? renderUpdateSettings() : renderAccentSettings();
  return `${pageHeading(t('page.settings.eyebrow'), t('page.settings.title'), t('page.settings.description'))}
    <div class="settings-layout">${settingsTabs()}<div class="settings-panel">${panel}</div></div>`;
}

const viewNames = { home: 'nav.home', catalog: 'nav.catalog', favorites: 'nav.favorites', recent: 'nav.recent', friends: 'nav.friends', plans: 'nav.plans', settings: 'nav.settings' };

function renderSidebar() {
  const groups = renderSidebarNav();
  const menu = document.querySelector('[data-nav-group="menu"]');
  const space = document.querySelector('[data-nav-group="space"]');
  if (menu) menu.innerHTML = groups.menu;
  if (space) space.innerHTML = groups.space;
  mountIcons(document.querySelector('.sidebar') || document.body);
}

function updateSidebar() {
  document.querySelectorAll('[data-nav]').forEach((button) => button.classList.toggle('active', button.dataset.nav === currentView));
  breadcrumbCurrent.textContent = searchQuery && currentView === 'catalog' ? t('page.search.title') : t(viewNames[currentView] || 'nav.home');
}

function renderPage() {
  applyPreferences();
  updateSidebar();
  renderUpdateBanner();
  const pages = { home: renderHome, catalog: renderCatalog, favorites: renderFavorites, recent: renderRecent, friends: renderFriends, plans: renderPlans, settings: renderSettings };
  pageContent.innerHTML = (pages[currentView] || renderHome)();
  mountIcons(pageContent);
  if (pageContent.dataset.renderedView !== currentView) {
    pageContent.dataset.renderedView = currentView;
    pageContent.dataset.transition = preferences.motion ? preferences.pageTransition : 'none';
    pageContent.classList.remove('page-entering');
    void pageContent.offsetWidth;
    pageContent.classList.add('page-entering');
  }
}

function renderUpdateBanner(state) {
  if (state) latestUpdateState = state;
  const banner = document.getElementById('update-banner');
  if (!banner) return;
  const status = latestUpdateState?.status;
  const visibleStatuses = ['downloading', 'downloaded', 'applying', 'error'];
  if (!visibleStatuses.includes(status) || !preferences.uiUpdateBanner) {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }
  const progress = Math.max(0, Math.min(100, Number(latestUpdateState.progress) || 0));
  const title = t('updates.title', { version: escapeHtml(latestUpdateState.latestVersion || '') });
  const message = status === 'downloaded' ? t('updates.ready')
    : status === 'applying' ? t('updates.applying')
      : status === 'error' ? t('updates.error', { error: escapeHtml(latestUpdateState.errorMessage || 'Unknown error') })
        : t('updates.downloading', { percent: progress });
  banner.dataset.status = status;
  banner.hidden = false;
  banner.innerHTML = `<span class="update-banner-icon">${icon(status === 'error' ? 'close' : status === 'downloaded' ? 'check' : 'sparkle', 18)}</span><span class="update-banner-copy"><strong>${title}</strong><small>${message}</small></span>${status === 'error' ? `<button class="ghost-button" data-action="retry-update">${t('updates.retry')}</button>` : `<span class="update-banner-progress" aria-label="${progress}%"><i style="--progress:${status === 'applying' || status === 'downloaded' ? 100 : progress}%"></i></span>`}`;
  const updateSettingsCard = document.getElementById('update-settings-card');
  if (updateSettingsCard && currentView === 'settings' && preferences.settingsTab === 'version') updateSettingsCard.outerHTML = renderUpdateSettings();
}

let toastTimer;
// showToast(message) or showToast({ message, actionLabel, onAction })  the
// action button (used by Undo) keeps the toast alive until it is clicked or
// the timeout expires, whichever comes first.
// Settings migration: one JSON file with preferences, custom games,
// favorites, recent and playtime stats. Version field guards imports.
const DATA_EXPORT_VERSION = 1;
function buildDataExport() {
  return {
    app: 'vortex',
    version: DATA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      preferences,
      customGames: preferences.customGames || [],
      favorites: [...favorites],
      recentGames,
      playStats
    }
  };
}

function applyDataImport(payload) {
  if (!payload || payload.app !== 'vortex' || !payload.data || typeof payload.data !== 'object') {
    showToast(t('settings.data.importError'));
    return false;
  }
  const { data } = payload;
  if (!data.preferences || typeof data.preferences !== 'object') {
    showToast(t('settings.data.invalid'));
    return false;
  }
  Object.assign(preferences, preferenceDefaults, data.preferences);
  if (Array.isArray(data.customGames)) preferences.customGames = data.customGames;
  if (Array.isArray(data.favorites)) favorites = new Set(data.favorites);
  if (Array.isArray(data.recentGames)) recentGames = data.recentGames;
  if (data.playStats && typeof data.playStats === 'object') playStats = data.playStats;
  savePreferences();
  localStorage.setItem('vortex.favorites', JSON.stringify([...favorites]));
  localStorage.setItem('vortex.recent', JSON.stringify(recentGames));
  localStorage.setItem('vortex.playStats', JSON.stringify(playStats));
  renderSidebar();
  renderPage();
  reportRecentGamesToTray();
  return true;
}

// Privacy notice before the first friends fetch: spells out that only public
// data is requested (no password, no cookies) and asks for explicit consent.
function showFriendsWarning(pendingUsername) {
  document.querySelector('.friends-warn-layer')?.remove();
  const layer = document.createElement('div');
  layer.className = 'friends-warn-layer';
  layer.innerHTML = `<div class="friends-warn" role="dialog" aria-modal="true" aria-labelledby="friends-warn-title">
    <div class="friends-warn-icon">${icon('users', 22)}</div>
    <h2 id="friends-warn-title">${t('friends.warn.title')}</h2>
    <p>${t('friends.warn.body')}</p>
    <div class="friends-warn-actions">
      <button class="ghost-button" data-warn-decline>${t('friends.warn.decline')}</button>
      <button class="primary-button" data-warn-accept>${t('friends.warn.accept')}</button>
    </div>
  </div>`;
  document.body.appendChild(layer);
  layer.addEventListener('click', (event) => {
    if (event.target === layer || event.target.closest('[data-warn-decline]')) { layer.remove(); return; }
    if (event.target.closest('[data-warn-accept]')) {
      preferences.friendsNoticeAccepted = true;
      preferences.robloxUsername = pendingUsername;
      friendsCache = { at: 0, data: null };
      savePreferences();
      layer.remove();
      renderPage();
      showToast(t('settings.friends.saved'));
    }
  });
}

function showToast(message, action) {
  const region = document.getElementById('toast-region');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = null;
  region.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = 'toast';
  const label = typeof message === 'object' ? message.message : message;
  const act = typeof message === 'object' ? message : null;
  toast.innerHTML = `<span class="toast-mark">${icon('sparkle', 13)}</span><span>${escapeHtml(label)}</span>`;
  if (act && act.actionLabel) {
    const button = document.createElement('button');
    button.className = 'toast-action';
    button.type = 'button';
    button.textContent = act.actionLabel;
    button.addEventListener('click', () => {
      toast.remove();
      toastTimer = null;
      act.onAction?.();
    });
    toast.appendChild(button);
  }
  region.appendChild(toast);
  const ttl = act ? 6500 : 3000;
  window.setTimeout(() => { if (toast.isConnected) toast.remove(); }, ttl);
  toastTimer = window.setTimeout(() => { region.innerHTML = ''; }, ttl + 400);
}

// The tray panel shows the five most recently launched games; the renderer owns the
// history, so it pushes it to the main process on start and after every launch.
// Tray styling: a subset of preferences that tray.html can apply on its own.
const TRAY_STYLE_KEYS = ['accent', 'accentMode', 'accentSecondary', 'gradientAngle', 'theme', 'themeBackground', 'themeSurface', 'corners', 'trayScale', 'language'];
function trayStylePayload() {
  const style = {};
  for (const key of TRAY_STYLE_KEYS) style[key] = preferences[key];
  style.accentText = getComputedStyle(document.documentElement).getPropertyValue('--accent-text').trim();
  return style;
}

function reportRecentGamesToTray() {
  if (!window.vortexDesktop?.reportRecentGames) return;
  const games = recentGames
    .map((id) => getGame(id))
    .filter(Boolean)
    .map((game) => ({
      id: String(game.id),
      title: String(game.title || ''),
      // Tray rows show art and a "5 min ago" stamp when available.
      thumbnail: safeThumbnail(game.thumbnail) || '',
      lastPlayed: Number(playStats && playStats[game.id] && playStats[game.id].lastPlayed) || 0
    }));
  window.vortexDesktop.reportRecentGames({ games, style: trayStylePayload() });
}

function restorePlaySession() {
  // A previous process may have crashed before its unload checkpoint. Do not
  // count the time spent offline as playtime; discard only the stale marker.
  localStorage.removeItem(PLAYTIME_SESSION_KEY);
}

function savePlayStats() {
  localStorage.setItem('vortex.playStats', JSON.stringify(playStats));
}

// Close the current play session: bank the elapsed time (capped) and a launch.
function bankPlaySession(resetSession = true) {
  if (!playSessionStart || !playSessionGameId) return;
  const elapsed = Math.max(0, Math.round((Date.now() - playSessionStart) / 1000));
  const banked = Math.min(elapsed, PLAYTIME_SESSION_CAP_SECONDS);
  const entry = playStats[playSessionGameId] || { seconds: 0, launches: 0, lastPlayed: 0 };
  entry.seconds += banked;
  entry.lastPlayed = Date.now();
  playStats[playSessionGameId] = entry;
  if (resetSession) {
    playSessionStart = null;
    playSessionGameId = null;
    localStorage.removeItem(PLAYTIME_SESSION_KEY);
  } else {
    playSessionStart = Date.now();
    localStorage.setItem(PLAYTIME_SESSION_KEY, JSON.stringify({ gameId: playSessionGameId, startedAt: playSessionStart }));
  }
  savePlayStats();
}

function closePlaySession() { bankPlaySession(true); }
function checkpointPlaySession() { bankPlaySession(false); }

function openGame(id, gameId = '') {
  const game = getGame(id) || (String(id).match(/^\d{5,20}$/) ? { id: String(id), title: t('friends.joinGameTitle') } : null);
  if (!game) return;
  // A specific server instance (joining a friend) rides along to the main process.
  const joinGameId = /^\d{5,40}$/.test(String(gameId)) ? String(gameId) : '';
  // A new launch closes the previous session: it is the natural end marker.
  closePlaySession();
  if (preferences.saveHistory) {
    recentGames = [game.id, ...recentGames.filter((recentId) => recentId !== game.id)].slice(0, 12);
    localStorage.setItem('vortex.recent', JSON.stringify(recentGames));
    reportRecentGamesToTray();
  }
  playSessionStart = Date.now();
  playSessionGameId = String(game.id);
  localStorage.setItem(PLAYTIME_SESSION_KEY, JSON.stringify({ gameId: playSessionGameId, startedAt: playSessionStart }));
  // The launch count is persisted immediately; duration is banked on hide,
  // next launch or app close. This also survives a crash/restart.
  const currentEntry = playStats[playSessionGameId] || { seconds: 0, launches: 0, lastPlayed: 0 };
  currentEntry.launches += 1;
  currentEntry.lastPlayed = playSessionStart;
  playStats[playSessionGameId] = currentEntry;
  savePlayStats();
  if (window.vortexDesktop?.openGame) {
    window.vortexDesktop.openGame(game.id, joinGameId).then(() => showToast(t('toast.opening', { game: game.title }))).catch(() => showToast(t('toast.launchError')));
  } else {
    window.open(`https://www.roblox.com/games/start?placeId=${encodeURIComponent(game.id)}`, '_blank', 'noopener,noreferrer');
    showToast(t('toast.opening', { game: game.title }));
  }
}

const SEARCH_CACHE_PREFIX = 'vortex.searchCache.';
const SEARCH_CACHE_TTL = 5 * 60 * 1000;

function getCachedSearch(query) {
  const key = SEARCH_CACHE_PREFIX + encodeURIComponent(query.toLocaleLowerCase());
  const cached = readStored(key, null);
  if (!cached || Date.now() - cached.savedAt > SEARCH_CACHE_TTL) {
    localStorage.removeItem(key);
    return null;
  }
  return cached;
}

function saveCachedSearch(query) {
  const key = SEARCH_CACHE_PREFIX + encodeURIComponent(query.toLocaleLowerCase());
  try {
    const keys = Object.keys(localStorage).filter((storedKey) => storedKey.startsWith(SEARCH_CACHE_PREFIX) && storedKey !== key);
    if (keys.length >= 20) {
      const oldest = keys.map((storedKey) => [storedKey, readStored(storedKey, null)?.savedAt || 0]).sort((a, b) => a[1] - b[1]);
      oldest.slice(0, keys.length - 19).forEach(([storedKey]) => localStorage.removeItem(storedKey));
    }
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), items: searchResults, nextPageToken: searchPageToken, sessionId: searchSessionId }));
  } catch {
    // Search remains available if local storage is full or disabled.
  }
}

async function hydrateFeaturedGames() {
  if (!window.vortexDesktop?.getFeaturedGames) return;
  const customGames = Array.isArray(preferences.customGames) ? preferences.customGames : [];
  if (!customGames.length) return;
  const refreshCustom = (items) => {
    const byId = new Map((items || []).map((game) => [String(game.id), game]));
    preferences.customGames = customGames.map((game) => (byId.get(String(game.id)) ? { ...game, ...byId.get(String(game.id)), id: String(game.id), live: true } : game));
    savePreferences();
  };
  const cached = readStored('vortex.featuredCache', null);
  if (cached && Date.now() - cached.savedAt < SEARCH_CACHE_TTL) {
    refreshCustom(cached.items);
    if (currentView === 'home') renderPage();
    return;
  }
  try {
    const items = await window.vortexDesktop.getFeaturedGames(customGames.map((game) => String(game.id)));
    refreshCustom(items);
    try { localStorage.setItem('vortex.featuredCache', JSON.stringify({ savedAt: Date.now(), items })); } catch { /* Keep the cards in memory. */ }
    if (currentView === 'home') renderPage();
  } catch {
    // Saved cards remain usable if Roblox's public API is unavailable.
  }
}

function normalizeDiscoveredGame(game, query = '') {
  const creator = String(game.creator || '');
  return {
    ...game,
    id: String(game.id),
    title: String(game.title || t('game.fallbackDescription')),
    creator,
    genre: String(game.genre || '').toLocaleLowerCase() === 'roblox' ? '' : String(game.genre || ''),
    tagKey: 'roblox',
    art: 'live',
    iconKey: 'gamepad',
    description: String(game.description || t('game.fallbackDescription')),
    live: true,
    search: query
  };
}

async function loadDiscoveryCatalog(sortId = activeDiscoverySort, { force = false } = {}) {
  activeDiscoverySort = sortId;
  localStorage.setItem('vortex.activeDiscoverySort', JSON.stringify(activeDiscoverySort));
  const cached = discoveryCatalog[sortId];
  if (!force && cached?.savedAt && Date.now() - cached.savedAt < DISCOVERY_CACHE_TTL && Array.isArray(cached.items)) {
    discoveryStatus = 'success';
    renderPage();
    return;
  }

  const requestId = ++discoveryRequestId;
  discoveryStatus = 'loading';
  catalogVisibleCount = CATALOG_PAGE_SIZE;
  renderPage();
  try {
    if (!window.vortexDesktop?.discoverGames) throw new Error('Roblox Discover is available in the desktop app.');
    const response = await window.vortexDesktop.discoverGames({ sortId, sessionId: discoverySessionId });
    if (requestId !== discoveryRequestId) return;

    discoverySessionId = response.sessionId || discoverySessionId;
    discoverySorts = Array.isArray(response.sorts) && response.sorts.length ? response.sorts : fallbackDiscoverySorts;
    activeDiscoverySort = response.selectedSortId || sortId;
    const items = (response.items || []).map((game) => normalizeDiscoveredGame(game));
    discoveryCatalog = {
      ...discoveryCatalog,
      [activeDiscoverySort]: { savedAt: Date.now(), items }
    };

    const knownIds = new Set(dynamicGames.map((game) => String(game.id)));
    const newGames = items.filter((game) => !knownIds.has(game.id));
    dynamicGames = [...dynamicGames, ...newGames].slice(-1200);
    try {
      localStorage.setItem('vortex.discoverySessionId', JSON.stringify(discoverySessionId));
      localStorage.setItem('vortex.discoverySorts', JSON.stringify(discoverySorts));
      localStorage.setItem('vortex.discoveryCatalog', JSON.stringify(discoveryCatalog));
      localStorage.setItem('vortex.discovered', JSON.stringify(dynamicGames));
    } catch { /* Live results stay available for this session if storage is full. */ }
    discoveryStatus = 'success';
    renderPage();
  } catch {
    if (requestId !== discoveryRequestId) return;
    discoveryStatus = 'error';
    renderPage();
  }
}

function createSearchSessionId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0;
    return (character === 'x' ? random : (random & 3 | 8)).toString(16);
  });
}

async function fetchLiveSearch(append = false) {
  const query = searchQuery.trim();
  if (query.length < 2) return;
  const requestId = ++searchRequestId;
  if (!append) {
    const cached = getCachedSearch(query);
    if (cached) {
      searchResults = cached.items || [];
      searchPageToken = cached.nextPageToken || null;
      searchSessionId = cached.sessionId || createSearchSessionId();
      searchStatus = 'success';
      isLoadingMore = false;
      renderPage();
      return;
    }
  }
  if (append) isLoadingMore = true;
  else {
    searchStatus = 'loading';
    searchResults = [];
    searchPageToken = null;
    searchSessionId = createSearchSessionId();
  }
  renderPage();

  try {
    if (!window.vortexDesktop?.searchGames) throw new Error('Live Roblox search is available in the desktop app.');
    const response = await window.vortexDesktop.searchGames({
      query,
      sessionId: searchSessionId,
      pageToken: append ? searchPageToken : null
    });
    if (requestId !== searchRequestId || query !== searchQuery.trim()) return;

    const received = (response.items || []).map((game) => ({
      ...game,
      id: String(game.id),
      title: String(game.title || t('game.fallbackDescription')),
      creator: String(game.creator || ''),
      genre: String(game.genre || '').toLocaleLowerCase() === 'roblox' ? '' : String(game.genre || ''),
      tagKey: 'roblox',
      art: 'live',
      iconKey: 'gamepad',
      description: String(game.description || t('game.fallbackDescription')),
      live: true,
      search: query
    }));
    const knownIds = new Set(searchResults.map((game) => game.id));
    const newItems = received.filter((game) => !knownIds.has(game.id));
    searchResults = append ? [...searchResults, ...newItems] : received;
    const storedGames = new Map(dynamicGames.map((game) => [String(game.id), game]));
    received.forEach((game) => storedGames.set(game.id, game));
    dynamicGames = [...storedGames.values()].slice(-800);
    try { localStorage.setItem('vortex.discovered', JSON.stringify(dynamicGames)); } catch { /* Current search results remain in memory. */ }
    searchSessionId = response.sessionId || searchSessionId;
    searchPageToken = response.nextPageToken || null;
    searchStatus = 'success';
    isLoadingMore = false;
    saveCachedSearch(query);
    renderPage();
  } catch {
    if (requestId !== searchRequestId) return;
    isLoadingMore = false;
    if (append) {
      showToast(t('search.loadMoreError'));
      renderPage();
      return;
    }
    searchStatus = 'error';
    searchResults = allGames().filter((game) => game.id === query || `${game.title} ${game.genre} ${game.description} ${game.search}`.toLocaleLowerCase(preferences.language).includes(query.toLocaleLowerCase(preferences.language)));
    searchPageToken = null;
    renderPage();
  }
}

function scheduleLiveSearch(value) {
  searchQuery = value;
  currentView = 'catalog';
  activeCategory = 'all';
  sortMode = 'default';
  searchStatus = value.trim().length >= 2 ? 'loading' : value.trim().length ? 'short' : 'idle';
  searchResults = [];
  searchPageToken = null;
  isLoadingMore = false;
  searchRequestId += 1;
  if (searchTimer) window.clearTimeout(searchTimer);
  renderPage();
  searchInput.focus();
  searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
  if (value.trim().length >= 2) searchTimer = window.setTimeout(() => fetchLiveSearch(false), 420);
  else if (!value.trim() && !discoveryCatalog[activeDiscoverySort]?.items) loadDiscoveryCatalog(activeDiscoverySort);
}

function toggleFavorite(id) {
  if (favorites.has(id)) {
    favorites.delete(id);
    showToast(t('toast.favoriteRemoved'));
  } else {
    favorites.add(id);
    showToast(t('toast.favoriteAdded'));
  }
  localStorage.setItem('vortex.favorites', JSON.stringify([...favorites]));
  renderPage();
}

function setView(view) {
  currentView = view;
  if (view !== 'catalog') {
    searchQuery = '';
    searchInput.value = '';
    activeCategory = 'all';
    if (searchTimer) window.clearTimeout(searchTimer);
    searchRequestId += 1;
  }
  renderPage();
  if (view === 'catalog' && !searchQuery) loadDiscoveryCatalog(activeDiscoverySort);
  window.scrollTo({ top: 0, behavior: preferences.motion ? 'smooth' : 'auto' });
}

document.addEventListener('click', async (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!target) return;
  const move = target.closest('[data-ui-move]');
  if (move) {
    moveNavItem(move.dataset.uiMove, move.dataset.direction);
    updateUiRowHandles(move.closest('[data-ui-order]'));
    return;
  }
  const gamePick = target.closest('[data-game-pick]');
  if (gamePick) {
    pickGameFromSearch(gamePick.dataset.gamePick);
    return;
  }
  if (!target.closest('.game-search-field')) closeGameSearch();
  const sortToggle = target.closest('[data-sort-toggle]');
  if (sortToggle) {
    const select = sortToggle.closest('[data-custom-select]');
    const menu = select.querySelector('.custom-select-menu');
    const shouldOpen = menu.hidden;
    document.querySelectorAll('[data-custom-select]').forEach((item) => {
      item.querySelector('.custom-select-menu').hidden = true;
      item.querySelector('[data-sort-toggle]').setAttribute('aria-expanded', 'false');
    });
    if (shouldOpen) {
      menu.hidden = false;
      sortToggle.setAttribute('aria-expanded', 'true');
      menu.querySelector('.custom-select-option[aria-selected="true"]')?.focus();
    }
    return;
  }

  const sortOption = target.closest('[data-sort-value]');
  if (sortOption) {
    sortMode = sortOption.dataset.sortValue;
    renderPage();
    return;
  }
  document.querySelectorAll('[data-custom-select]').forEach((item) => {
    item.querySelector('.custom-select-menu').hidden = true;
    item.querySelector('[data-sort-toggle]').setAttribute('aria-expanded', 'false');
  });

  const windowControl = target.closest('[data-window-control]');
  if (windowControl) {
    const control = windowControl.dataset.windowControl;
    if (control === 'minimize') window.vortexDesktop?.minimizeWindow?.();
    if (control === 'maximize') window.vortexDesktop?.toggleMaximizeWindow?.();
    if (control === 'close') window.vortexDesktop?.closeWindow?.();
    return;
  }

  const nav = target.closest('[data-nav]');
  if (nav) { setView(nav.dataset.nav); return; }

  const action = target.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'export-data') {
      const blob = new Blob([JSON.stringify(buildDataExport(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vortex-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast(t('settings.data.exported'));
      return;
    }
    if (action.dataset.action === 'import-data') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        input.remove();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const payload = JSON.parse(String(reader.result));
            if (applyDataImport(payload)) showToast(t('settings.data.imported'));
          } catch { showToast(t('settings.data.importError')); }
        };
        reader.readAsText(file);
      });
      document.body.appendChild(input);
      input.click();
      return;
    }
    if (action.dataset.action === 'favorite') toggleFavorite(action.dataset.id);
    if (action.dataset.action === 'play') openGame(action.dataset.id);
    if (action.dataset.action === 'toggle-description') {
      const id = String(action.dataset.id);
      if (expandedDescriptions.has(id)) expandedDescriptions.delete(id);
      else expandedDescriptions.add(id);
      renderPage();
    }
    if (action.dataset.action === 'load-more') {
      if (searchQuery.length >= 2) fetchLiveSearch(true);
      else { catalogVisibleCount += CATALOG_PAGE_SIZE; renderPage(); }
    }
    if (action.dataset.action === 'notifications') showToast(t('toast.notifications'));
    if (action.dataset.action === 'retry-update') {
      renderUpdateBanner({ status: 'checking', progress: 0 });
      window.vortexDesktop?.retryUpdateCheck?.().catch(() => {});
    }
    if (action.dataset.action === 'clear-cache') {
      Object.keys(localStorage).filter((key) => key.startsWith(SEARCH_CACHE_PREFIX)).forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem('vortex.featuredCache');
      localStorage.removeItem('vortex.discoveryCatalog');
      discoveryCatalog = {};
      discoveryStatus = 'idle';
      window.vortexDesktop?.clearSearchCache?.();
      showToast(t('settings.cacheCleared'));
    }
    if (action.dataset.action === 'reset-interface') {
      preferences.sidebarOrder = [];
      preferences.uiSidebarTip = true;
      preferences.uiProfileCard = true;
      preferences.uiTopbarSearch = true;
      preferences.uiBreadcrumb = true;
      preferences.uiNotifications = true;
      preferences.uiSidebarFoot = true;
      preferences.uiUpdateBanner = true;
      savePreferences();
      renderSidebar();
      renderPage();
      showToast(t('settings.ui.resetDone'));
    }
    if (action.dataset.action === 'reset-appearance') {
      const language = preferences.language;
      const saveHistory = preferences.saveHistory;
      Object.assign(preferences, preferenceDefaults, { language, saveHistory, settingsTab: 'general' });
      savePreferences();
      renderPage();
      showToast(t('settings.resetDone'));
    }
    if (action.dataset.action === 'reset-theme-colors') {
      preferences.themeBackground = '';
      preferences.themeSurface = '';
      preferences.themeText = '';
      preferences.themeMuted = '';
      preferences.themeLine = '';
      savePreferences();
      renderPage();
    }
    return;
  }

  const category = target.closest('[data-category]');
  if (category) { activeCategory = category.dataset.category; renderPage(); return; }

  const discoverySort = target.closest('[data-discovery-sort]');
  if (discoverySort) { loadDiscoveryCatalog(discoverySort.dataset.discoverySort); return; }

  const tab = target.closest('[data-settings-tab]');
  if (tab) { preferences.settingsTab = tab.dataset.settingsTab; savePreferences(); renderPage(); return; }

  const accent = target.closest('[data-accent]');
  if (accent) {
    // A preset is a complete look: applying it also drops any custom theme
    // colors, otherwise they override the theme and the preset looks inert.
    preferences.accent = accent.dataset.accent;
    preferences.themeBackground = '';
    preferences.themeSurface = '';
    savePreferences();
    renderPage();
    return;
  }

  if (target.closest('[data-add-custom]')) { addCustomGame(); return; }

  const removeCustom = target.closest('[data-remove-custom]');
  if (removeCustom) {
    const id = removeCustom.dataset.removeCustom;
    // Snapshot everything the removal touches, so Undo restores it exactly.
    const snapshot = {
      game: (preferences.customGames || []).find((game) => String(game.id) === id) || null,
      games: preferences.customGames || [],
      featured: preferences.homeFeaturedGame || '',
      picks: preferences.homePicks ? [...preferences.homePicks] : []
    };
    preferences.customGames = (preferences.customGames || []).filter((game) => String(game.id) !== id);
    if (String(preferences.homeFeaturedGame) === id) preferences.homeFeaturedGame = '';
    preferences.homePicks = (preferences.homePicks || []).filter((pick) => String(pick) !== id);
    savePreferences();
    renderPage();
    if (snapshot.game) showToast(
      { message: t('toast.removed', { game: snapshot.game.title }), actionLabel: t('toast.undo'), onAction: () => {
        preferences.customGames = snapshot.games;
        preferences.homeFeaturedGame = snapshot.featured;
        preferences.homePicks = snapshot.picks;
        savePreferences();
        renderPage();
        showToast(t('toast.undone', { game: snapshot.game.title }));
      } }
    );
    return;
  }

  const bannerPick = target.closest('[data-banner-pick]');
  if (bannerPick) {
    const id = String(bannerPick.dataset.bannerPick);
    // Exactly one banner game: choosing it replaces the previous choice; choosing
    // the current banner game again clears the banner.
    preferences.homeFeaturedGame = preferences.homeFeaturedGame === id ? '' : id;
    preferences.homePicks = (preferences.homePicks || []).filter((pick) => String(pick) !== id);
    savePreferences();
    renderPage();
    return;
  }

  const picksPick = target.closest('[data-picks-pick]');
  if (picksPick) {
    const id = String(picksPick.dataset.picksPick);
    const picks = (preferences.homePicks || []).map(String);
    preferences.homePicks = picks.includes(id) ? picks.filter((pick) => pick !== id) : [...picks, id];
    if (preferences.homePicks.includes(id) && preferences.homeFeaturedGame === id) preferences.homeFeaturedGame = '';
    savePreferences();
    renderPage();
    return;
  }

  // Auto-detect the local Roblox account: no typing needed at all.
  if (target.closest('[data-detect-username]')) {
    const input = pageContent.querySelector('[data-roblox-username]');
    if (input) { input.placeholder = t('friends.detecting'); input.value = ''; }
    try {
      const result = await window.vortexDesktop?.detectRobloxAccount();
      if (result && result.ok && result.account && result.account.name) {
        if (input) { input.value = result.account.name; input.placeholder = 'Roblox'; }
        showToast(t('friends.detected', { user: result.account.name }));
        if (!preferences.robloxUsername) {
          preferences.robloxUsername = result.account.name;
          friendsCache = { at: 0, data: null };
          savePreferences();
          renderPage();
        }
      } else {
        if (input) input.placeholder = 'Roblox';
        showToast(t('friends.detectFailed'));
      }
    } catch {
      if (input) input.placeholder = 'Roblox';
      showToast(t('friends.detectFailed'));
    }
    return;
  }

  // Saving the Roblox username: show the privacy notice the first time.
  if (target.closest('[data-save-username]')) {
    const input = pageContent.querySelector('[data-roblox-username]');
    const username = String(input?.value || '').trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) { showToast(t('friends.notFound.body')); return; }
    if (!preferences.robloxUsername && !preferences.friendsNoticeAccepted) {
      showFriendsWarning(username);
      return;
    }
    preferences.robloxUsername = username;
    friendsCache = { at: 0, data: null };
    savePreferences();
    renderPage();
    showToast(t('settings.friends.saved'));
    return;
  }

  if (target.closest('[data-save-presence]')) {
    const input = pageContent.querySelector('[data-presence-cookie]');
    const error = pageContent.querySelector('[data-presence-error]');
    const cookie = String(input?.value || '').trim();
    if (error) error.textContent = '';
    if (!cookie) { showToast(t('settings.presence.missing')); return; }
    try {
      const result = await window.vortexDesktop?.setPresenceCookie(cookie);
      if (result && result.ok) {
        friendsCache = { at: 0, data: null };
        renderPage();
        showToast(t('settings.presence.saved'));
      } else {
        // Inline, specific reason under the field (in addition to the toast).
        const reason = result && result.error === 'invalid' ? t('settings.presence.tooShort') : t('settings.presence.rejected');
        if (error) error.textContent = reason;
        showToast(reason);
      }
    } catch {
      if (error) error.textContent = t('settings.presence.rejected');
      showToast(t('settings.presence.rejected'));
    }
    return;
  }
  if (target.closest('[data-remove-presence]')) {
    try { await window.vortexDesktop?.removePresenceCookie(); friendsCache = { at: 0, data: null }; renderPage(); showToast(t('settings.presence.disabled')); } catch {}
    return;
  }

  if (target.closest('[data-detect-username-home]')) {
    try {
      const result = await window.vortexDesktop?.detectRobloxAccount();
      if (result && result.ok && result.account && result.account.name) {
        preferences.robloxUsername = result.account.name;
        friendsCache = { at: 0, data: null };
        savePreferences();
        renderPage();
        showToast(t('friends.detected', { user: result.account.name }));
      } else showToast(t('friends.detectFailed'));
    } catch { showToast(t('friends.detectFailed')); }
    return;
  }

  // Theme as a portable JSON: all color tokens + accent, import with validation.
  if (target.closest('[data-action="export-theme"]')) {
    const theme = {
      name: 'Vortex theme',
      version: 1,
      theme: preferences.theme,
      background: preferences.themeBackground || '',
      surface: preferences.themeSurface || '',
      text: preferences.themeText || '',
      muted: preferences.themeMuted || '',
      line: preferences.themeLine || '',
      accent: preferences.accent,
      accentSecondary: preferences.accentSecondary,
      gradientAngle: preferences.gradientAngle
    };
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'vortex-theme.json';
    link.click();
    URL.revokeObjectURL(link.href);
    return;
  }
  if (target.closest('[data-action="import-theme"]')) {
    pageContent.querySelector('[data-theme-file]')?.click();
    return;
  }

  // Wallpaper: pick an image, drop it, or clear it.
  if (target.closest('[data-action="pick-wallpaper"]')) {
    pageContent.querySelector('[data-wallpaper-file]')?.click();
    return;
  }
  if (target.closest('[data-action="remove-wallpaper"]')) {
    preferences.themeWallpaper = '';
    savePreferences();
    applyPreferences();
    renderPage();
    return;
  }

  const friendJoin = target.closest('[data-friend-join]');
  if (friendJoin) {
    const placeId = friendJoin.dataset.friendJoin;
    const gameId = friendJoin.dataset.friendGame || '';
    openGame(placeId, gameId);
    return;
  }

    const segment = target.closest('[data-pref]');
  if (segment) {
    preferences[segment.dataset.pref] = segment.dataset.value;
    savePreferences();
    renderPage();
    if (segment.dataset.pref === 'language') showToast(t('settings.languageUpdated'));
    if (segment.dataset.pref === 'trayScale') { reportRecentGamesToTray(); showToast(t('settings.tray.updated')); }
  }

  const toggle = target.closest('[data-toggle]');
  if (toggle) { preferences[toggle.dataset.toggle] = !preferences[toggle.dataset.toggle]; savePreferences(); renderPage(); }
});

// Imported theme files: validate and apply every known field.
document.addEventListener('change', (event) => {
  // Wallpaper image: read as data URL, cap at ~2.5 MB to keep localStorage sane.
  if (event.target.matches('[data-wallpaper-file]')) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast(t('settings.wallpaper.notImage')); return; }
    if (file.size > 2.5 * 1024 * 1024) { showToast(t('settings.wallpaper.tooBig')); return; }
    const reader = new FileReader();
    reader.onload = () => {
      preferences.themeWallpaper = String(reader.result);
      savePreferences();
      applyPreferences();
      renderPage();
      showToast(t('settings.wallpaper.applied'));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
    return;
  }
  if (event.target.matches('[data-card-flag]')) {
    const flag = event.target.dataset.cardFlag;
    if (['cardShowDescription', 'cardShowLikes', 'cardShowPlaytime', 'cardShowGenre'].includes(flag)) {
      preferences[flag] = event.target.checked;
      savePreferences(); renderPage();
    }
    return;
  }
  if (event.target.matches('[data-wallpaper-grain]')) {
    preferences.themeGrain = event.target.checked;
    savePreferences(); applyPreferences();
    return;
  }
  if (event.target.matches('[data-wallpaper-vignette]')) {
    preferences.themeVignette = event.target.checked;
    savePreferences(); applyPreferences();
    return;
  }

  if (!event.target.matches('[data-theme-file]')) return;
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const theme = JSON.parse(String(reader.result));
      const hex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : '';
      if (['dark', 'light', 'oled'].includes(theme.theme)) preferences.theme = theme.theme;
      preferences.themeBackground = hex(theme.background);
      preferences.themeSurface = hex(theme.surface);
      preferences.themeText = hex(theme.text);
      preferences.themeMuted = hex(theme.muted);
      preferences.themeLine = hex(theme.line);
      if (hex(theme.accent)) preferences.accent = hex(theme.accent);
      if (hex(theme.accentSecondary)) preferences.accentSecondary = hex(theme.accentSecondary);
      if (Number.isFinite(theme.gradientAngle)) preferences.gradientAngle = Math.max(0, Math.min(360, Number(theme.gradientAngle) || 0));
      savePreferences();
      renderPage();
      showToast(t('settings.themeImported'));
    } catch {
      showToast(t('settings.themeImportInvalid'));
    }
  };
  reader.readAsText(file);
  event.target.value = '';
});

document.addEventListener('input', (event) => {
  if (event.target.matches('[data-card-size]')) {
    preferences.cardSize = Math.max(0.7, Math.min(1.3, Number(event.target.value) || 1));
    event.target.nextElementSibling.textContent = Math.round(preferences.cardSize * 100) + '%';
    savePreferences(); applyPreferences();
    return;
  }
  if (event.target.matches('[data-card-radius]')) {
    preferences.cardRadius = Math.max(0, Math.min(20, Number(event.target.value) || 0));
    preferences.customCardRadius = true;
    event.target.nextElementSibling.textContent = preferences.cardRadius + 'px';
    savePreferences(); applyPreferences();
    return;
  }
  if (event.target.matches('[data-wallpaper-blur]')) {
    preferences.themeWallpaperBlur = Number(event.target.value) || 0;
    event.target.nextElementSibling.textContent = preferences.themeWallpaperBlur + 'px';
    savePreferences(); applyPreferences();
    return;
  }
  if (event.target.matches('[data-wallpaper-dim]')) {
    preferences.themeWallpaperDim = Number(event.target.value) || 0;
    event.target.nextElementSibling.textContent = preferences.themeWallpaperDim + '%';
    savePreferences(); applyPreferences();
    return;
  }

  if (event.target.matches('[data-presence-cookie]')) {
    // Live length feedback for the pasted cookie.
    const meter = pageContent.querySelector('[data-presence-meter]');
    if (meter) {
      const len = event.target.value.trim().length;
      meter.textContent = len ? len + ' chars' : (meter.dataset.hint || '');
    }
    return;
  }

  if (event.target === searchInput) {
    scheduleLiveSearch(searchInput.value);
    return;
  }
  if (event.target.matches('[data-game-search]')) {
    scheduleGameSearch(event.target.value);
    return;
  }
  if (event.target.hasAttribute('data-color-hex')) {
    const name = event.target.dataset.colorHex;
    const value = event.target.value.trim();
    const valid = /^#[0-9a-f]{6}$/i.test(value);
    event.target.setAttribute('aria-invalid', String(!valid));
    if (!valid) return;
    preferences[name] = value.toLowerCase();
    savePreferences();
    applyPreferences();
    syncColorTuner(name, preferences[name]);
    if (name === 'accent') document.querySelectorAll('.palette-option').forEach((button) => button.classList.toggle('active', button.dataset.accent === preferences.accent));
    return;
  }
  if (event.target.hasAttribute('data-color-axis')) {
    const name = event.target.dataset.colorTarget;
    const tuner = pageContent.querySelector(`[data-color-tuner="${name}"]`);
    const value = (axis) => Number(tuner.querySelector(`[data-color-axis="${axis}"]`).value);
    preferences[name] = hslToHex(value('hue'), value('saturation'), value('lightness'));
    savePreferences();
    applyPreferences();
    syncColorTuner(name, preferences[name]);
    if (name === 'accent') document.querySelectorAll('.palette-option').forEach((button) => button.classList.toggle('active', button.dataset.accent === preferences.accent));
    return;
  }
  if (event.target.matches('[data-home-greeting]')) {
    preferences.homeGreeting = event.target.value.slice(0, 48);
    savePreferences();
    return;
  }
  if (event.target.matches('[data-setting="glow"]')) {
    preferences.glow = Number(event.target.value);
    savePreferences();
    applyPreferences();
    const value = document.getElementById('glow-value');
    if (value) value.textContent = `${preferences.glow}%`;
    return;
  }
  if (event.target.matches('[data-setting="gradientAngle"]')) {
    preferences.gradientAngle = Number(event.target.value);
    savePreferences();
    applyPreferences();
    const value = document.getElementById('gradient-angle-value');
    if (value) value.textContent = `${preferences.gradientAngle}°`;
  }
});

function syncColorTuner(name, color) {
  const tuner = pageContent.querySelector(`[data-color-tuner="${name}"]`);
  if (!tuner) return;
  const hsl = rgbToHsl(color);
  const hex = tuner.querySelector(`[data-color-hex="${name}"]`);
  if (hex) { hex.value = color.toUpperCase(); hex.setAttribute('aria-invalid', 'false'); }
  tuner.querySelector('.color-preview')?.style.setProperty('--sample-color', color);
  for (const [axis, suffix] of [['hue', '°'], ['saturation', '%'], ['lightness', '%']]) {
    const input = tuner.querySelector(`[data-color-axis="${axis}"]`);
    const output = tuner.querySelector(`[data-color-value="${axis}"]`);
    if (input) input.value = hsl[axis];
    if (output) output.value = `${hsl[axis]}${suffix}`;
  }
}

document.addEventListener('dblclick', (event) => {
  if (event.target.closest('[data-window-drag]')) window.vortexDesktop?.toggleMaximizeWindow?.();
});

document.addEventListener('keydown', (event) => {
  const isTyping = event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName));
  const openMenu = document.querySelector('[data-custom-select] .custom-select-menu:not([hidden])');
  if (event.key === 'Escape' && openMenu) {
    event.preventDefault();
    openMenu.hidden = true;
    const trigger = openMenu.closest('[data-custom-select]').querySelector('[data-sort-toggle]');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' || (event.key === '/' && !isTyping)) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === 'Escape' && document.activeElement === searchInput) {
    searchInput.value = '';
    scheduleLiveSearch('');
    searchInput.blur();
  }
});

// Classic scripts run before ES modules: wait for the module bundle to be
// published on window, then boot. If it never arrives (module error), boot
// with the fallback shims after a short grace period.
// Friend card hover preview: floating panel with avatar, name, game and a
// join action. Sits above the grid and follows the hovered card.
let friendPreviewEl = null;
function showFriendPreview(card) {
  hideFriendPreview();
  const name = card.dataset.friendName || '?';
  const avatar = card.dataset.friendAvatar || '';
  const game = card.dataset.gameName || '';
  const gameThumb = card.dataset.gameThumb || '';
  const status = card.classList.contains('playing') ? t('friends.inGame') : card.classList.contains('online') ? t('friends.online') : t('friends.offline');
  friendPreviewEl = document.createElement('div');
  friendPreviewEl.className = 'friend-preview';
  // Preview is informational only: friend avatar, game art, game name.
  // Joining happens through the explicit button on the friend card itself.
  friendPreviewEl.innerHTML = `
    <span class="friend-preview-avatar">${avatar ? `<img src="${escapeHtml(avatar)}" alt="" />` : escapeHtml(name[0].toLocaleUpperCase())}</span>
    <div class="friend-preview-copy">
      <strong>${escapeHtml(name)}</strong>
      <small>${status}</small>
    </div>
    ${game ? `<div class="friend-preview-game">
      <span class="friend-preview-game-art">${gameThumb ? `<img src="${escapeHtml(gameThumb)}" alt="" />` : icon('play', 14)}</span>
      <span class="friend-preview-game-copy"><em>${t('friends.inGame')}</em><small>${escapeHtml(game)}</small></span>
    </div>` : ''}`;
  document.body.appendChild(friendPreviewEl);
  const rect = card.getBoundingClientRect();
  const panel = friendPreviewEl.getBoundingClientRect();
  let left = Math.min(rect.left, window.innerWidth - panel.width - 14);
  let top = rect.top - panel.height - 10;
  if (top < 8) top = rect.bottom + 10;
  friendPreviewEl.style.left = Math.max(8, left) + 'px';
  friendPreviewEl.style.top = top + 'px';
}
function hideFriendPreview() {
  friendPreviewEl?.remove();
  friendPreviewEl = null;
}
document.addEventListener('mouseover', (event) => {
  const card = event.target.closest?.('.friend-card');
  if (card) showFriendPreview(card);
  else if (!event.target.closest?.('.friend-preview')) hideFriendPreview();
});
document.addEventListener('mouseout', (event) => {
  if (event.target.closest?.('.friend-card') && !event.relatedTarget?.closest?.('.friend-card')) hideFriendPreview();
});
document.addEventListener('scroll', hideFriendPreview, true);

function bootVortex() {
restorePlaySession();
mountIcons();
renderSidebar();
applyPreferences();
renderPage();
reportRecentGamesToTray();
window.addEventListener('beforeunload', closePlaySession);
// The Electron close button hides the window into the tray, so unload is not
// guaranteed. Periodic checkpoints keep playtime accurate without ending the
// current session when the launcher is merely hidden.
window.setInterval(checkpointPlaySession, 60 * 1000);
window.vortexDesktop?.onWindowState?.(({ isMaximized }) => setWindowMaximized(Boolean(isMaximized)));
window.vortexDesktop?.onUpdateState?.(renderUpdateBanner);
window.vortexDesktop?.getUpdateState?.().then(renderUpdateBanner).catch(() => {});
hydrateFeaturedGames();
loadDiscoveryCatalog(activeDiscoverySort);
}

bootVortex();
