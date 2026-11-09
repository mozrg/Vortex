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

// Accent presets follow the public site palette: a violet family with a few
// restrained supporting tones instead of the old rainbow set.
const palettes = [
  { key: 'violet', color: '#9b7cff' },
  { key: 'lavender', color: '#b9a4ff' },
  { key: 'orchid', color: '#c274ec' },
  { key: 'iris', color: '#7b6cff' },
  { key: 'periwinkle', color: '#8f9cff' },
  { key: 'rose', color: '#e58bb6' },
  { key: 'mint', color: '#75c9a8' },
  { key: 'amber', color: '#e0b06a' },
  { key: 'crimson', color: '#e37680' },
  { key: 'slate', color: '#8d909e' }
];

// Navigation order is user-configurable in Settings → Interface. Primary
// destinations live in the top bar; collection links stay in the sidebar.
const NAV_ITEMS = [
  { key: 'home', icon: 'home', group: 'topbar' },
  { key: 'catalog', icon: 'compass', group: 'topbar' },
  { key: 'friends', icon: 'users', group: 'topbar' },
  { key: 'favorites', icon: 'heart', group: 'menu' },
  { key: 'recent', icon: 'clock', group: 'menu' },
  { key: 'activity', icon: 'activity', group: 'menu' },
  { key: 'plans', icon: 'flag', group: 'menu' },
  // Settings live next to the profile at the very bottom of the sidebar.
  { key: 'settings', icon: 'sliders', group: 'bottom' }
];
const NAV_KEYS = NAV_ITEMS.map((item) => item.key);

function navOrder(group = 'menu') {
  const items = NAV_ITEMS.filter((item) => item.group === group);
  const validKeys = items.map((item) => item.key);
  const stored = group === 'topbar' ? preferences.topbarOrder : preferences.sidebarOrder;
  const keys = Array.isArray(stored) ? stored.filter((key) => validKeys.includes(key)) : [];
  return [...new Set([...keys, ...validKeys])];
}

function navItemMarkup(item, location = 'menu') {
  if (location === 'topbar') {
    const label = t(`nav.${item.key}`);
    return `<button class="topbar-nav-item" type="button" data-nav="${item.key}" aria-label="${label}" title="${label}"><span class="topbar-nav-icon" data-icon="${item.icon}"></span><span class="topbar-nav-label">${label}</span></button>`;
  }
  const label = t(`nav.${item.key}`);
  return `<button class="nav-item" type="button" data-nav="${item.key}" aria-label="${label}" title="${label}"><span class="nav-icon" data-icon="${item.icon}"></span><span>${label}</span></button>`;
}

function renderSidebarNav() {
  const topbarItems = navOrder('topbar').map((key) => NAV_ITEMS.find((item) => item.key === key)).filter(Boolean);
  const menuItems = navOrder('menu').map((key) => NAV_ITEMS.find((item) => item.key === key)).filter(Boolean);
  const bottomItems = navOrder('bottom').map((key) => NAV_ITEMS.find((item) => item.key === key)).filter(Boolean);
  const group = (name) => menuItems.filter((item) => item.group === name).map(navItemMarkup).join('');
  return {
    topbar: topbarItems.map((item) => navItemMarkup(item, 'topbar')).join(''),
    menu: group('menu'),
    space: group('space'),
    bottom: bottomItems.map(navItemMarkup).join('')
  };
}

const preferenceDefaults = {
  accent: '#9b7cff', accentMode: 'solid', accentSecondary: '#c274ec', gradientAngle: 135,
  theme: 'dark', themeBackground: '', themeSurface: '',
  density: 'comfortable', corners: 'soft', showDescriptions: true, showStats: true,
  homeGreeting: '', customGames: [], homeFeaturedGame: '', homePicks: [], homeGameCount: 4, quickLaunchItems: [],
  homeShowHero: true, homeShowRecommendations: true,
  homeLayout: 'balanced', homeMinimal: false,
  sidebarOrder: [], topbarOrder: [], uiSidebarTip: true, uiProfileCard: true, uiTopbarSearch: true,
  uiBreadcrumb: true, uiNotifications: true, uiSidebarFoot: true, uiUpdateBanner: true,
  pageTransition: 'fade', cardAnimation: 'rise', animationEasing: 'smooth', animationDuration: 1, glow: 72, ambient: true, motion: true,
  contrast: false, language: 'ru', saveHistory: true, settingsTab: 'home', trayScale: 'normal', robloxUsername: '', friendsNoticeAccepted: false,
  robloxAccountId: '', robloxDisplayName: '', robloxAvatar: '',
  themeText: '', themeMuted: '', themeLine: '',
  themeWallpaper: '', themeWallpaperBlur: 14, themeWallpaperDim: 45, themeGrain: false, themeGrainStrength: 0.05, themeVignette: false, themeVignetteStrength: 1,
  cardSize: 1, cardRadius: 12, customCardRadius: false, cardShowDescription: true, cardShowLikes: true, cardShowPlaytime: true, cardShowGenre: true,
  homeWidgetOrder: [], homeWidgetHidden: [], homeWidgetCollapsed: [], animationSpeed: 'normal',
  homeSectionTitles: {}, homeSectionScale: 1, catalogView: 'grid', catalogGenre: 'all', catalogAccess: 'all', cardAspect: 'square', glassStrength: 84, themeSchedule: 'manual', scheduleDay: 'dark', scheduleNight: 'oled', sidebarAutoHide: false, uiFont: 'modern',
  discordPresence: false, friendFavoriteAlerts: false, discordClientId: '',
  diskCache: true, lazyImages: true, onlineHistoryLimit: 'week', trayMiniPlayer: true,
  trayFavoritesLimit: 5, trayQuickLimit: 3, trayFavoritesUnlimited: false, trayQuickUnlimited: false,
  catalogGroupByGenre: false,
  // Ids of announcements already seen; drives the unread dot on the bell.
  readAnnouncements: [], announcementsSeeded: false,
  hotkeys: {}
};

// Rebindable shortcuts. `fallback` is used until the user records a custom combo.
// Matching is done on KeyboardEvent.code (physical key), not .key: with a
// non-Latin layout Ctrl+K reports "л" as .key but still reports "KeyK" as .code.
const HOTKEY_ACTIONS = [
  { id: 'search', label: 'settings.hotkeys.search', fallback: { code: 'KeyK', key: 'k', ctrl: true, shift: false } },
  { id: 'palette', label: 'settings.hotkeys.palette', fallback: { code: 'KeyP', key: 'p', ctrl: true, shift: true } },
  { id: 'settings', label: 'settings.hotkeys.settings', fallback: { code: 'Comma', key: ',', ctrl: true, shift: false } },
  { id: 'friends', label: 'settings.hotkeys.friends', fallback: { code: 'KeyF', key: 'f', ctrl: true, shift: true } },
  { id: 'sidebar', label: 'settings.hotkeys.sidebar', fallback: { code: 'Tab', key: 'Tab', ctrl: false, shift: false } },
  { id: 'back', label: 'settings.hotkeys.back', fallback: { code: 'Escape', key: 'Escape', ctrl: false, shift: false } }
];

function hotkeyCombo(id) {
  const custom = preferences.hotkeys?.[id];
  if (custom && (custom.code || custom.key)) return custom;
  return HOTKEY_ACTIONS.find((action) => action.id === id)?.fallback || null;
}

// Show/hide the left rail from the keyboard without touching the saved
// auto-hide preference. The two body classes are runtime-only.
function toggleSidebarVisibility() {
  const body = document.body;
  const sidebar = document.querySelector('.sidebar');
  const matrix = sidebar ? new DOMMatrixReadOnly(getComputedStyle(sidebar).transform) : null;
  const visuallyOpen = !body.classList.contains('sidebar-hidden')
    && (body.classList.contains('sidebar-revealed') || !preferences.sidebarAutoHide || Math.abs(matrix?.m41 || 0) < 1);
  body.classList.toggle('sidebar-hidden', visuallyOpen);
  body.classList.toggle('sidebar-revealed', !visuallyOpen);
  if (visuallyOpen) body.classList.remove('sidebar-peek');
  if (visuallyOpen && document.activeElement?.closest?.('.sidebar')) document.activeElement.blur();
}

// Turn a physical key code into the label shown in settings.
function hotkeyKeyLabel(combo) {
  if (!combo) return '—';
  if (combo.code === 'Escape') return 'Esc';
  if (combo.code === 'Comma') return ',';
  if (combo.code === 'Period') return '.';
  if (combo.code === 'Slash') return '/';
  if (combo.code === 'Semicolon') return ';';
  if (combo.code === 'Quote') return "'";
  if (combo.code === 'BracketLeft') return '[';
  if (combo.code === 'BracketRight') return ']';
  if (combo.code === 'Backslash') return '\\';
  if (combo.code === 'Minus') return '-';
  if (combo.code === 'Equal') return '=';
  if (combo.code === 'Backquote') return '`';
  if (combo.code === 'Space') return 'Space';
  if (/^Key[A-Z]$/.test(combo.code || '')) return combo.code.slice(3);
  if (/^Digit\d$/.test(combo.code || '')) return combo.code.slice(5);
  if (/^F\d{1,2}$/.test(combo.code || '')) return combo.code;
  // Fall back to the recorded character (used for non-Latin custom combos).
  const key = String(combo.key || '');
  return key.length === 1 ? key.toUpperCase() : key;
}

function formatHotkey(combo) {
  if (!combo) return '—';
  const parts = [];
  if (combo.ctrl) parts.push('Ctrl');
  if (combo.shift) parts.push('Shift');
  if (combo.alt) parts.push('Alt');
  parts.push(hotkeyKeyLabel(combo));
  return parts.join('+');
}

function matchesHotkey(event, combo) {
  if (!combo) return false;
  // Physical code wins so the shortcut survives a Russian/Cyrillic layout.
  const codeMatches = combo.code && event.code === combo.code;
  const keyMatches = combo.key && String(event.key).toLowerCase() === String(combo.key).toLowerCase();
  if (!codeMatches && !keyMatches) return false;
  return Boolean(event.ctrlKey || event.metaKey) === Boolean(combo.ctrl)
    && Boolean(event.shiftKey) === Boolean(combo.shift)
    && Boolean(event.altKey) === Boolean(combo.alt);
}

// Recording mode: the next non-modifier key press becomes the shortcut.
let hotkeyRecording = null;

function startHotkeyRecording(id, button) {
  hotkeyRecording = id;
  button.classList.add('recording');
  button.textContent = t('settings.hotkeys.press');
  const finish = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
        // Store both the physical code and the character so the shortcut works
        // in any keyboard layout.
        const combo = {
          code: event.code || '',
          key: event.key,
          ctrl: Boolean(event.ctrlKey || event.metaKey),
          shift: Boolean(event.shiftKey),
          alt: Boolean(event.altKey)
        };
        preferences.hotkeys = { ...(preferences.hotkeys || {}), [id]: combo };
        savePreferences();
      }
    }
    document.removeEventListener('keydown', finish, true);
    hotkeyRecording = null;
    renderPage();
  };
  document.addEventListener('keydown', finish, true);
  // Clicking anywhere else cancels the recording.
  setTimeout(() => {
    const cancel = () => { if (hotkeyRecording === id) finish(null); document.removeEventListener('click', cancel); };
    document.addEventListener('click', cancel);
  }, 50);
}

// ---------- Customization profiles (Stage 6) ----------
// A profile snapshots every LOOK-related preference (colors, wallpaper, cards,
// widgets, animations, density) so the user can save looks, switch between
// them and share them as JSON. Game data (favorites, playtime, usernames)
// never enters a profile.
const PROFILE_KEYS = [
  'theme', 'themeBackground', 'themeSurface', 'themeText', 'themeMuted', 'themeLine',
  'accent', 'accentSecondary', 'accentMode', 'gradientAngle',
  'themeWallpaper', 'themeWallpaperBlur', 'themeWallpaperDim', 'themeGrain', 'themeGrainStrength', 'themeVignette', 'themeVignetteStrength',
  'cardSize', 'cardRadius', 'customCardRadius', 'cardAspect', 'cardShowDescription', 'cardShowLikes', 'cardShowPlaytime', 'cardShowGenre',
  'glassStrength', 'themeSchedule', 'scheduleDay', 'scheduleNight',
  'homeWidgetOrder', 'homeWidgetHidden', 'homeWidgetCollapsed',
  'catalogView', 'catalogGenre',
  'homeLayout', 'homeMinimal', 'homeShowHero', 'homeShowRecommendations',
  'density', 'corners', 'showDescriptions', 'showStats',
  'pageTransition', 'cardAnimation', 'animationSpeed', 'animationEasing', 'animationDuration', 'glow', 'ambient', 'motion', 'contrast',
  'sidebarOrder', 'topbarOrder', 'uiSidebarTip', 'uiProfileCard', 'uiTopbarSearch', 'uiBreadcrumb', 'uiNotifications', 'uiSidebarFoot', 'uiUpdateBanner', 'sidebarAutoHide', 'uiFont'
];

function readProfiles() {
  const raw = readStored('vortex.profiles', {});
  return raw && typeof raw === 'object' ? raw : {};
}

function writeProfiles(profiles) {
  try { localStorage.setItem('vortex.profiles', JSON.stringify(profiles)); } catch { /* quota */ }
}

function saveProfileFromCurrent(name) {
  const clean = String(name || '').trim().slice(0, 32);
  if (!clean) return false;
  const snapshot = {};
  for (const key of PROFILE_KEYS) snapshot[key] = preferences[key];
  const profiles = readProfiles();
  profiles[clean] = { version: 1, savedAt: Date.now(), settings: snapshot };
  writeProfiles(profiles);
  return true;
}

function applyProfile(name) {
  const profiles = readProfiles();
  const profile = profiles[String(name)];
  if (!profile || !profile.settings) return false;
  for (const key of PROFILE_KEYS) {
    if (key in profile.settings) preferences[key] = profile.settings[key];
  }
  savePreferences();
  applyPreferences();
  renderPage();
  return true;
}

function deleteProfile(name) {
  const profiles = readProfiles();
  delete profiles[String(name)];
  writeProfiles(profiles);
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return copied;
  }
}

const readStored = (key, fallback) => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
};
const preferences = { ...preferenceDefaults, ...readStored('vortex.preferences', {}) };
// Square covers are the new default. Migrate the old implicit "auto" once,
// while keeping "auto" available if the user picks it again later.
if (localStorage.getItem('vortex.cardAspectDefault') !== 'square') {
  if (preferences.cardAspect === 'auto') preferences.cardAspect = 'square';
  localStorage.setItem('vortex.cardAspectDefault', 'square');
  localStorage.setItem('vortex.preferences', JSON.stringify(preferences));
}
window.preferences = preferences;
let favorites = new Set(readStored('vortex.favorites', []));
let recentGames = readStored('vortex.recent', []);
// Playtime per game: { [id]: { seconds, launches, lastPlayed } }. 'seconds' is
// a conservative estimate: the time between a launch and the next launch or
// app close, capped at a session ceiling so an abandoned window does not
// inflate the number.
let playStats = readStored('vortex.playStats', {});
let activityData = readStored('vortex.activity', { days: {}, streak: { current: 0, best: 0, lastCompletedDate: '', recoveryUsed: false }, achievements: {} });
if (!activityData || typeof activityData !== 'object') activityData = { days: {}, streak: { current: 0, best: 0, lastCompletedDate: '', recoveryUsed: false }, achievements: {} };
activityData.days ||= {};
activityData.streak = { current: 0, best: 0, lastCompletedDate: '', recoveryUsed: false, ...(activityData.streak || {}) };
activityData.achievements ||= {};
const ACTIVITY_GAME_MINUTES = 10;
const ACTIVITY_DAILY_GAMES = 2;
const PLAYTIME_SESSION_CAP_SECONDS = 3 * 60 * 60;
const PLAYTIME_SESSION_KEY = 'vortex.playSession';
let playSessionStart = null;
let playSessionGameId = null;
let playSessionSource = '';
let runtimePollTimer = null;
let runtimeResolvingPlace = '';
// Snapshot of the game launched from Vortex: drives the tray mini-player, so it
// works even when the title came from a friend's server rather than the catalog.
let nowPlayingSnapshot = null;
let dynamicGames = readStored('vortex.discovered', []);
const expandedDescriptions = new Set();
let currentView = 'home';
let navigationHistory = ['home'];
let navigationHistoryIndex = 0;
let quickGameMethod = 'private';
let editingQuickGameId = '';
let quickGameDialogReturnFocus = null;
let quickFolderDialogReturnFocus = null;
let editingQuickFolderId = '';
let quickDragState = null;
let suppressQuickLaunchClick = false;
const quickFoldersOpen = new Set();
let detailGame = null;
let detailStatus = 'idle';
let detailRequestId = 0;
let detailBadgeCount = 3;
let detailBadgesExpanded = true;
let detailGalleryIndex = 0;
let detailDescriptionExpanded = false;
let detailGalleryCount = 0;
let detailOnlineRefreshing = false;
let detailOnlineUpdatedAt = 0;

let searchQuery = '';
let activeCategory = preferences.catalogGenre || 'all';
// Access is a separate axis from genre: "paid" is not a genre.
let activeAccess = preferences.catalogAccess === 'paid' ? 'paid' : 'all';
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

// Catalog recommendations are a pseudo Discover sort built locally from the
// games the user actually plays and keeps in favorites.
const RECOMMENDED_SORT = { id: 'recommended', title: 'Рекомендации' };
let recommendationState = { status: 'idle', items: [], signature: '', fetchedAt: 0, seeds: 0 };

function catalogSorts() {
  const base = discoverySorts.length ? discoverySorts : fallbackDiscoverySorts;
  if (base.some((sort) => sort.id === RECOMMENDED_SORT.id)) return base;
  const list = [...base];
  const after = list.findIndex((sort) => sort.id === 'top-revisited');
  list.splice(after >= 0 ? after + 1 : list.length, 0, RECOMMENDED_SORT);
  return list;
}

function recommendationSeeds() {
  const weights = new Map();
  const add = (id, weight) => {
    const key = String(id || '');
    if (!key || !getGame(key)) return;
    weights.set(key, Math.max(Number(weights.get(key)) || 0, weight));
  };
  for (const id of favorites) add(id, 1000);
  const played = Object.entries(playStats || {})
    .sort((first, second) => Number(second[1]?.seconds || 0) - Number(first[1]?.seconds || 0))
    .slice(0, 8);
  played.forEach(([id, entry], index) => add(id, 500 - index * 20 + Math.min(400, Number(entry?.seconds || 0) / 60)));
  recentGames.slice(0, 8).forEach((id, index) => add(id, 200 - index * 10));
  return [...weights.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([id, weight]) => ({ game: getGame(id), weight }))
    .filter((entry) => entry.game)
    .slice(0, 6);
}

async function loadRecommendations(force = false) {
  if (recommendationState.status === 'loading' && !force) return;
  const seeds = recommendationSeeds();
  const signature = seeds.slice(0, 4).map((entry) => entry.game.id).join(',');
  if (!force && recommendationState.status === 'success' && recommendationState.signature === signature && Date.now() - recommendationState.fetchedAt < 10 * 60 * 1000) return;
  if (!seeds.length) {
    recommendationState = { status: 'empty', items: [], signature: '', fetchedAt: Date.now(), seeds: 0 };
    if (currentView === 'catalog') renderPage();
    return;
  }
  recommendationState = { ...recommendationState, status: 'loading', seeds: seeds.length };
  if (currentView === 'catalog') renderPage();
  try {
    if (!window.vortexDesktop?.getSimilarGames) throw new Error('desktop only');
    const lists = await Promise.all(seeds.slice(0, 4).map(({ game }) => window.vortexDesktop.getSimilarGames({
      universeId: String(game.universeId || ''),
      genre: String(game.genre || ''),
      title: String(game.title || '')
    }).catch(() => [])));
    const genreWeight = new Map();
    seeds.forEach(({ game, weight }) => {
      const genre = String(game.genreKey || inferGenreKey(game));
      if (!genre) return;
      genreWeight.set(genre, (genreWeight.get(genre) || 0) + weight);
    });
    const seen = new Set([...favorites].map(String));
    seeds.forEach(({ game }) => seen.add(String(game.id)));
    const found = new Map();
    for (const list of lists) {
      for (const game of Array.isArray(list) ? list : []) {
        const id = String(game?.id || '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const genre = String(game.genreKey || inferGenreKey(game));
        game.recommendationScore = (genreWeight.get(genre) || 0) + Math.log10(Number(game.playerCount) + 10) * 24 + (Number(game.upVotes) || 0) / Math.max(1, Number(game.upVotes) + Number(game.downVotes)) * 30;
        found.set(id, game);
      }
    }
    let items = [...found.values()].sort((first, second) => second.recommendationScore - first.recommendationScore || Number(second.playerCount || 0) - Number(first.playerCount || 0)).slice(0, 36);
    if (!items.length) {
      // Last resort: use the already cached Discover catalog, still excluding
      // games the user owns or has already seen in their lists.
      const cached = Object.values(discoveryCatalog || {}).flatMap((entry) => Array.isArray(entry?.items) ? entry.items : []);
      items = cached.filter((game) => !seen.has(String(game.id))).slice(0, 36);
    }
    // Recommendation cards must behave exactly like every other card: online
    // count, open details, playtime. That needs live-shaped entries that the
    // rest of the app can look up by id, so merge them into the discovery cache.
    items = items.map((game) => ({ ...game, live: true, playerCount: Number(game.playerCount) || 0 }));
    if (items.length) {
      const index = new Map(dynamicGames.map((game) => [String(game.id), game]));
      for (const game of items) {
        index.set(String(game.id), { ...index.get(String(game.id)), ...game, id: String(game.id) });
      }
      dynamicGames = [...index.values()].slice(-1200);
      try { localStorage.setItem('vortex.discovered', JSON.stringify(dynamicGames)); } catch { /* keep the in-memory list */ }
    }
    recommendationState = {
      status: items.length ? 'success' : 'empty',
      items,
      signature,
      fetchedAt: Date.now(),
      seeds: seeds.length
    };
  } catch {
    recommendationState = { status: 'error', items: [], signature, fetchedAt: Date.now(), seeds: seeds.length };
  }
  if (currentView === 'catalog') renderPage();
}

const pageContent = document.getElementById('page-content');
const searchInput = document.getElementById('global-search');
const breadcrumbCurrent = document.getElementById('breadcrumb-current');
let latestUpdateState = null;
let lastUpdateCheckAt = 0;
let retryUpdateBusy = false;
let pendingScrollRestore = null;
const DETAIL_CACHE_TTL = 5 * 60 * 1000;
const detailCache = new Map();
const responseCacheLocal = new Map();

function readDetailCache(key) {
  const entry = detailCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) { detailCache.delete(key); return null; }
  return entry.game;
}

function writeDetailCache(key, game) {
  detailCache.set(key, { game, expiresAt: Date.now() + DETAIL_CACHE_TTL });
  if (detailCache.size > 60) detailCache.delete(detailCache.keys().next().value);
}

function captureCatalogScroll() {
  const area = document.querySelector('.main-area');
  if (area) pendingScrollRestore = { view: currentView, top: area.scrollTop };
}

function restoreCatalogScroll() {
  if (!pendingScrollRestore || pendingScrollRestore.view !== 'catalog') return;
  const { top } = pendingScrollRestore;
  pendingScrollRestore = null;
  // Two frames: the first paints the catalog markup, the second applies the
  // offset once the grid has its final height (otherwise the browser clamps it).
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const area = document.querySelector('.main-area');
      if (area) area.scrollTop = top;
    });
  });
}

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

// Compact color field: the full picker lives in a popover that opens on click,
// so the settings page stays dense and the picker itself matches the app.
function renderColorTuner(name, color, label) {
  return `<div class="color-field" data-color-field="${name}">
    <span class="color-field-label">${label}</span>
    <button class="color-trigger" type="button" data-color-open="${name}" data-color-current="${color}" aria-haspopup="dialog" aria-expanded="false" aria-label="${escapeHtml(label)}">
      <span class="color-swatch" style="--sample-color:${color}"></span>
      <span class="color-trigger-code" data-color-code="${name}">${color.toUpperCase()}</span>
      <span class="color-trigger-chevron">${icon('chevronDown', 12)}</span>
    </button>
  </div>`;
}

// ---------------------------------------------------------------------------
// Color popover
// The settings page used to show three sliders per color, which took a lot of
// room. Every color is now a trigger; the picker opens on click and uses the
// same design language as the rest of the launcher.
// ---------------------------------------------------------------------------
let colorPopoverEl = null;
let colorPopoverState = { name: '', trigger: null, hue: 0, saturation: 0, value: 0, dragging: false, saveTimer: 0 };

function colorValueForTarget(name) {
  const trigger = document.querySelector(`[data-color-open="${name}"]`);
  const current = trigger?.dataset.colorCurrent;
  if (/^#[0-9a-f]{6}$/i.test(String(current || ''))) return String(current).toLowerCase();
  const value = name === 'folderColor'
    ? document.querySelector('[data-folder-color-value]')?.value
    : preferences[name];
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : '#9b7cff';
}

function syncFolderColorTrigger() {
  const inputValue = document.querySelector('[data-folder-color-value]')?.value;
  const value = /^#[0-9a-f]{6}$/i.test(String(inputValue || '')) ? String(inputValue).toLowerCase() : '#9b7cff';
  const trigger = document.querySelector('[data-color-open="folderColor"]');
  if (!trigger) return;
  trigger.dataset.colorCurrent = value;
  trigger.querySelector('.color-swatch')?.style.setProperty('--sample-color', value);
  trigger.querySelector('[data-color-code]')?.replaceChildren(value.toUpperCase());
}

function persistColorTarget(name, color) {
  if (name === 'folderColor') {
    const input = document.querySelector('[data-folder-color-value]');
    if (input) input.value = color;
    syncFolderColorTrigger();
    return;
  }
  preferences[name] = color;
  applyPreferences();
  syncColorTuner(name, color);
  if (name === 'accent') {
    document.querySelectorAll('.palette-option').forEach((button) => button.classList.toggle('active', button.dataset.accent === color));
    const code = document.querySelector('[data-color-code="accent"]');
    if (code) code.textContent = color.toUpperCase();
  }
}

function updateColorPopoverUI(apply = true) {
  if (!colorPopoverEl) return;
  const color = hsvToHex(colorPopoverState.hue, colorPopoverState.saturation, colorPopoverState.value);
  const sv = colorPopoverEl.querySelector('[data-color-sv]');
  if (sv) {
    sv.style.setProperty('--pop-hue', `hsl(${colorPopoverState.hue} 100% 50%)`);
    const thumb = sv.querySelector('[data-color-thumb]');
    if (thumb) {
      thumb.style.left = `${colorPopoverState.saturation}%`;
      thumb.style.top = `${100 - colorPopoverState.value}%`;
    }
  }
  const hue = colorPopoverEl.querySelector('[data-color-hue]');
  if (hue) hue.value = colorPopoverState.hue;
  const hex = colorPopoverEl.querySelector('[data-color-pop-hex]');
  if (hex && document.activeElement !== hex) hex.value = color.slice(1).toUpperCase();
  // Opening the picker must never commit the displayed fallback color: that
  // silently turned a theme preset into a custom color before the user picked
  // anything. Only pointer/hex/preset input applies a value.
  if (!apply) return;
  persistColorTarget(colorPopoverState.name, color);
  // Keep the live value even while dragging, but write localStorage only after
  // the pointer pauses so a drag does not spam the tray and disk.
  window.clearTimeout(colorPopoverState.saveTimer);
  colorPopoverState.saveTimer = window.setTimeout(() => {
    if (colorPopoverState.name && colorPopoverState.name !== 'folderColor') savePreferences();
  }, 140);
}

function createColorPopover() {
  const el = document.createElement('div');
  el.id = 'color-popover';
  el.className = 'color-popover';
  el.setAttribute('role', 'dialog');
  el.hidden = true;
  el.innerHTML = `<div class="color-popover-head"><strong data-color-title>${t('settings.customColor')}</strong><button class="icon-button" type="button" data-color-close aria-label="${t('common.close')}">${icon('close', 13)}</button></div>
    <div class="color-sv" data-color-sv><span class="color-sv-thumb" data-color-thumb></span></div>
    <label class="color-hue-row"><span>${t('settings.colorHue')}</span><input type="range" min="0" max="360" step="1" data-color-hue /></label>
    <div class="color-popover-foot">
      <label class="color-hex-field"><span>#</span><input type="text" maxlength="6" spellcheck="false" autocomplete="off" data-color-pop-hex /></label>
      <div class="color-presets" role="group" aria-label="${t('settings.accent.title')}">${palettes.map((palette) => `<button type="button" class="color-preset" data-color-preset="${palette.color}" style="--preset:${palette.color}" title="${escapeHtml(t(`palette.${palette.key}`))}" aria-label="${escapeHtml(t(`palette.${palette.key}`))}"></button>`).join('')}</div>
    </div>`;
  document.body.appendChild(el);

  const sv = el.querySelector('[data-color-sv]');
  const pointColor = (event) => {
    const box = sv.getBoundingClientRect();
    colorPopoverState.saturation = Math.max(0, Math.min(100, Math.round((event.clientX - box.left) / Math.max(1, box.width) * 100)));
    colorPopoverState.value = Math.max(0, Math.min(100, Math.round((1 - (event.clientY - box.top) / Math.max(1, box.height)) * 100)));
    updateColorPopoverUI();
  };
  sv.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    colorPopoverState.dragging = true;
    sv.setPointerCapture?.(event.pointerId);
    pointColor(event);
  });
  sv.addEventListener('pointermove', (event) => { if (colorPopoverState.dragging) pointColor(event); });
  const endDrag = () => { colorPopoverState.dragging = false; savePreferences(); };
  sv.addEventListener('pointerup', endDrag);
  sv.addEventListener('pointercancel', endDrag);

  el.querySelector('[data-color-hue]').addEventListener('input', (event) => {
    colorPopoverState.hue = Number(event.target.value) || 0;
    updateColorPopoverUI();
  });
  const hexInput = el.querySelector('[data-color-pop-hex]');
  hexInput.addEventListener('change', () => {
    const raw = String(hexInput.value || '').replace(/[^0-9a-f]/gi, '');
    if (raw.length !== 6) return;
    const next = rgbToHsv(`#${raw.toLowerCase()}`);
    colorPopoverState.hue = next.hue;
    colorPopoverState.saturation = next.saturation;
    colorPopoverState.value = next.value;
    updateColorPopoverUI();
    savePreferences();
  });
  el.querySelector('[data-color-close]').addEventListener('click', closeColorPopover);
  el.addEventListener('click', (event) => {
    const preset = event.target.closest('[data-color-preset]');
    if (!preset) return;
    const next = rgbToHsv(preset.dataset.colorPreset);
    colorPopoverState.hue = next.hue;
    colorPopoverState.saturation = next.saturation;
    colorPopoverState.value = next.value;
    updateColorPopoverUI();
    savePreferences();
  });
  return el;
}

function closeColorPopover() {
  if (!colorPopoverEl || colorPopoverEl.hidden) return;
  colorPopoverEl.hidden = true;
  colorPopoverState.trigger?.setAttribute('aria-expanded', 'false');
  colorPopoverState.trigger = null;
  colorPopoverState.dragging = false;
}

function openColorPopover(name, trigger) {
  colorPopoverEl ||= createColorPopover();
  colorPopoverState.name = name;
  colorPopoverState.trigger = trigger;
  const color = colorValueForTarget(name);
  const hsv = rgbToHsv(color);
  colorPopoverState.hue = hsv.hue;
  colorPopoverState.saturation = hsv.saturation;
  colorPopoverState.value = hsv.value;
  const label = name === 'folderColor'
    ? t('quick.folderColor')
    : document.querySelector(`[data-color-field="${name}"] .color-field-label`)?.textContent || t('settings.customColor');
  colorPopoverEl.querySelector('[data-color-title]').textContent = label;
  trigger.setAttribute('aria-expanded', 'true');
  colorPopoverEl.hidden = false;
  updateColorPopoverUI(false);
  const box = trigger.getBoundingClientRect();
  const width = colorPopoverEl.offsetWidth || 264;
  const height = colorPopoverEl.offsetHeight || 330;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, box.left));
  const below = box.bottom + 8;
  const top = below + height <= window.innerHeight - 8 ? below : Math.max(8, box.top - height - 8);
  colorPopoverEl.style.left = `${left}px`;
  colorPopoverEl.style.top = `${top}px`;
}

document.addEventListener('pointerdown', (event) => {
  if (!colorPopoverEl || colorPopoverEl.hidden) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target || colorPopoverEl.contains(target) || target.closest('[data-color-open]')) return;
  closeColorPopover();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && colorPopoverEl && !colorPopoverEl.hidden) {
    event.preventDefault();
    closeColorPopover();
  }
});
window.addEventListener('resize', closeColorPopover);
document.addEventListener('scroll', closeColorPopover, true);

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
  document.documentElement.style.setProperty('--grain-strength', String(Math.max(0.005, Math.min(0.25, Number(preferences.themeGrainStrength) || 0.05))));
  document.documentElement.style.setProperty('--vignette-strength', String(Math.max(0.1, Math.min(2.5, Number(preferences.themeVignetteStrength) || 1))));
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

function cleanQuickLaunchItems(items, depth = 0) {
  if (!Array.isArray(items) || depth > 1) return [];
  return items.slice(0, 80).map((item) => {
    if (!item || typeof item !== 'object') return null;
    const id = String(item.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!id) return null;
    if (item.type === 'folder' && depth === 0) {
      const games = cleanQuickLaunchItems(item.games, depth + 1).filter((entry) => entry?.type === 'game');
      const color = /^#[0-9a-f]{6}$/i.test(String(item.color || '')) ? String(item.color).toLowerCase() : '#9b7cff';
      return games.length > 1 ? { type: 'folder', id, title: String(item.title || '').trim().slice(0, 48), color, games } : (games[0] || null);
    }
    if (item.type !== 'game') return null;
    const method = ['private', 'share', 'public'].includes(item.method) ? item.method : 'public';
    const placeId = String(item.placeId || '').trim();
    const linkCode = String(item.linkCode || '').trim();
    const shareCode = String(item.shareCode || '').trim();
    if (method !== 'share' && !/^\d{1,20}$/.test(placeId)) return null;
    if (method === 'share' && placeId && !/^\d{1,20}$/.test(placeId)) return null;
    if (method === 'private' && !/^[a-z\d_-]{1,100}$/i.test(linkCode)) return null;
    if (method === 'share' && !/^[a-z\d_-]{1,128}$/i.test(shareCode)) return null;
    const rawHotkey = item.hotkey && typeof item.hotkey === 'object' ? item.hotkey : null;
    return {
      type: 'game', id, method, placeId,
      linkCode: method === 'private' ? linkCode : '', shareCode: method === 'share' ? shareCode : '',
      shareType: method === 'share' && ['Server', 'ExperienceInvite', 'ExperienceDetails'].includes(item.shareType) ? item.shareType : 'Server',
      title: String(item.title || '').trim().slice(0, 64),
      autoTitle: typeof item.autoTitle === 'boolean' ? item.autoTitle : !String(item.title || '').trim(),
      thumbnail: safeThumbnail(item.thumbnail),
      lastPlayed: Math.max(0, Number(item.lastPlayed) || 0),
      hotkey: rawHotkey && (rawHotkey.code || rawHotkey.key) ? {
        code: String(rawHotkey.code || '').slice(0, 32), key: String(rawHotkey.key || '').slice(0, 32),
        ctrl: Boolean(rawHotkey.ctrl), shift: Boolean(rawHotkey.shift), alt: Boolean(rawHotkey.alt)
      } : null
    };
  }).filter(Boolean);
}

function quickLaunchId() {
  return globalThis.crypto?.randomUUID?.() || `quick-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Topbar avatar: the local Roblox headshot once the account is known (cookie or
// the local Roblox folder), otherwise the first letter / V fallback.
function renderAccountAvatar() {
  const host = document.querySelector('[data-account-avatar]');
  if (!host) return;
  const avatar = safeThumbnail(preferences.robloxAvatar);
  const name = String(preferences.robloxDisplayName || preferences.robloxUsername || 'V').trim();
  const initial = (name[0] || 'V').toLocaleUpperCase();
  host.classList.toggle('has-image', Boolean(avatar));
  host.innerHTML = avatar
    ? `<span class="avatar-photo" style="--avatar-image:url('${escapeHtml(avatar)}')" aria-hidden="true"></span>`
    : escapeHtml(initial);
}

function rememberRobloxAccount(account) {
  if (!account) return false;
  preferences.robloxAccountId = /^\d{1,20}$/.test(String(account.id || '')) ? String(account.id) : preferences.robloxAccountId;
  preferences.robloxDisplayName = String(account.displayName || account.name || '').slice(0, 32);
  const avatar = safeThumbnail(account.avatar);
  if (avatar) preferences.robloxAvatar = avatar;
  if (!preferences.robloxUsername && account.name) {
    preferences.robloxUsername = String(account.name).slice(0, 20);
    friendsCache = { at: 0, data: null };
  }
  savePreferences();
  renderAccountAvatar();
  return true;
}

async function refreshRobloxAccount() {
  try {
    const result = await window.vortexDesktop?.getRobloxAccount?.();
    const account = result?.ok ? result.account : null;
    if (account) rememberRobloxAccount(account);
  } catch { /* avatar is decorative; keep the letter fallback */ }
}

function applyPreferences() {
  if (!['ru', 'en'].includes(preferences.language)) preferences.language = 'ru';
  if (!['home', 'accent', 'cards', 'effects', 'interface', 'general', 'integrations', 'data', 'version'].includes(preferences.settingsTab)) preferences.settingsTab = 'home';
  if (!['off', 'week', 'month'].includes(preferences.onlineHistoryLimit)) preferences.onlineHistoryLimit = 'week';
  if (!['all', 'paid'].includes(preferences.catalogAccess)) preferences.catalogAccess = 'all';
  if (!preferences.hotkeys || typeof preferences.hotkeys !== 'object') preferences.hotkeys = {};
  // Older saves stored only the character; add the physical code so the
  // shortcut keeps working on a Cyrillic layout.
  for (const [id, combo] of Object.entries(preferences.hotkeys)) {
    if (!combo || typeof combo !== 'object' || combo.code) continue;
    const fallback = HOTKEY_ACTIONS.find((action) => action.id === id)?.fallback;
    const key = String(combo.key || '');
    if (key === 'Escape') preferences.hotkeys[id] = { ...combo, code: 'Escape' };
    else if (key === ',') preferences.hotkeys[id] = { ...combo, code: 'Comma' };
    else if (key === '.') preferences.hotkeys[id] = { ...combo, code: 'Period' };
    else if (/^[a-z]$/i.test(key)) preferences.hotkeys[id] = { ...combo, code: `Key${key.toUpperCase()}` };
    else if (/^\d$/.test(key)) preferences.hotkeys[id] = { ...combo, code: `Digit${key}` };
    else if (fallback?.code && fallback.key === key) preferences.hotkeys[id] = { ...combo, code: fallback.code };
  }
  for (const flag of ['diskCache', 'lazyImages', 'trayMiniPlayer', 'catalogGroupByGenre']) {
    preferences[flag] = preferences[flag] !== false;
  }
  window.vortexDesktop?.setDiskCacheEnabled?.(preferences.diskCache);
  if (!Array.isArray(preferences.sidebarOrder)) preferences.sidebarOrder = [];
  const legacyOrder = preferences.sidebarOrder.filter((key) => NAV_KEYS.includes(key));
  preferences.sidebarOrder = [...new Set(legacyOrder.filter((key) => NAV_ITEMS.find((item) => item.key === key)?.group === 'menu'))];
  if (!Array.isArray(preferences.topbarOrder)) preferences.topbarOrder = [];
  const savedTopbar = preferences.topbarOrder.filter((key) => NAV_ITEMS.find((item) => item.key === key)?.group === 'topbar');
  preferences.topbarOrder = [...new Set([...(savedTopbar.length ? savedTopbar : legacyOrder.filter((key) => NAV_ITEMS.find((item) => item.key === key)?.group === 'topbar')), ...NAV_ITEMS.filter((item) => item.group === 'topbar').map((item) => item.key)])];
  preferences.quickLaunchItems = cleanQuickLaunchItems(preferences.quickLaunchItems);
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
  if (!Array.isArray(preferences.homeWidgetOrder)) preferences.homeWidgetOrder = [];
  if (!Array.isArray(preferences.homeWidgetHidden)) preferences.homeWidgetHidden = [];
  if (!Array.isArray(preferences.homeWidgetCollapsed)) preferences.homeWidgetCollapsed = [];
  if (!['grid', 'list'].includes(preferences.catalogView)) preferences.catalogView = 'grid';
  if (!['all', 'adventure', 'horror', 'roleplay', 'fashion', 'parkour', 'action', 'simulator', 'survival'].includes(preferences.catalogGenre)) preferences.catalogGenre = 'all';
  preferences.animationDuration = Math.max(0.5, Math.min(2, Number(preferences.animationDuration) || 1));
  if (!['smooth', 'spring', 'linear'].includes(preferences.animationEasing)) preferences.animationEasing = 'smooth';
  if (!['auto', 'square', 'wide', 'portrait'].includes(preferences.cardAspect)) preferences.cardAspect = 'square';
  preferences.glassStrength = Math.max(0, Math.min(100, Number(preferences.glassStrength) || 0));
  preferences.trayFavoritesLimit = Math.max(1, Math.min(20, Number(preferences.trayFavoritesLimit) || 5));
  preferences.trayQuickLimit = Math.max(1, Math.min(20, Number(preferences.trayQuickLimit) || 3));
  if (!['manual', 'system', 'clock'].includes(preferences.themeSchedule)) preferences.themeSchedule = 'manual';
  if (!['dark', 'light', 'oled'].includes(preferences.scheduleDay)) preferences.scheduleDay = 'dark';
  if (!['dark', 'light', 'oled'].includes(preferences.scheduleNight)) preferences.scheduleNight = 'oled';
  preferences.discordClientId = /^\d{15,22}$/.test(String(preferences.discordClientId || '')) ? String(preferences.discordClientId) : '';
  preferences.robloxAccountId = /^\d{1,20}$/.test(String(preferences.robloxAccountId || '')) ? String(preferences.robloxAccountId) : '';
  preferences.robloxDisplayName = String(preferences.robloxDisplayName || '').slice(0, 32);
  preferences.robloxAvatar = safeThumbnail(preferences.robloxAvatar);
  const clockHour = new Date().getHours();
  if (preferences.themeSchedule === 'system' && window.matchMedia) {
    preferences.theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } else if (preferences.themeSchedule === 'clock') {
    preferences.theme = clockHour >= 7 && clockHour < 19 ? preferences.scheduleDay : preferences.scheduleNight;
  }
  if (!['modern', 'classic'].includes(preferences.uiFont)) preferences.uiFont = 'modern';
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
    dark: { background: '#0d1012', surface: '#14181a' },
    light: { background: '#f5f6f7', surface: '#ffffff' },
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
  const raisedTone = isLightCanvas ? '#000000' : '#ffffff';
  root.setProperty('--surface-2', mixHex(surface, raisedTone, isLightCanvas ? 0.045 : 0.08));
  root.setProperty('--surface-3', mixHex(surface, raisedTone, isLightCanvas ? 0.09 : 0.14));
  root.setProperty('--text', preferences.themeText || (isLightCanvas ? '#211e2a' : '#f4f4f6'));
  root.setProperty('--muted', preferences.themeMuted || (isLightCanvas ? '#777382' : '#8d909e'));
  root.setProperty('--subtle', isLightCanvas ? '#9692a1' : '#636776');
  root.setProperty('--line', preferences.themeLine ? hexToRgba(preferences.themeLine, 0.16) : (isLightCanvas ? 'rgba(38,32,56,.1)' : 'rgba(255,255,255,.075)'));
  root.setProperty('--line-strong', preferences.themeLine ? hexToRgba(preferences.themeLine, 0.34) : (isLightCanvas ? 'rgba(38,32,56,.18)' : 'rgba(255,255,255,.13)'));
  syncWallpaperLayer();
  root.setProperty('--card-size', preferences.cardSize);
  root.setProperty('--card-radius', preferences.cardRadius + 'px');
  root.setProperty('--card-aspect', ({ auto: '16 / 9', square: '1 / 1', wide: '16 / 9', portrait: '4 / 5' }[preferences.cardAspect] || '16 / 9'));
  root.setProperty('--glass-strength', String(preferences.glassStrength / 100));
  document.body.dataset.coverFit = ['square', 'portrait'].includes(preferences.cardAspect) ? 'contain' : 'cover';
  root.setProperty('--animation-duration', String(preferences.animationDuration));
  root.setProperty('--animation-easing', ({ smooth: 'cubic-bezier(.22,1,.36,1)', spring: 'cubic-bezier(.16,1.2,.3,1)', linear: 'linear' }[preferences.animationEasing] || 'cubic-bezier(.22,1,.36,1)'));
  document.documentElement.style.setProperty('--glow-strength', String(Number(preferences.glow) / 100));
  document.body.classList.toggle('custom-card-radius', preferences.customCardRadius === true);
  document.body.classList.toggle('light-theme', isLightCanvas);
  document.body.classList.toggle('oled-theme', preferences.theme === 'oled' && !isLightCanvas);
  document.body.classList.toggle('spacious', preferences.density === 'spacious');
  document.body.classList.toggle('compact', preferences.density === 'compact');
  document.body.classList.toggle('hide-descriptions', !preferences.cardShowDescription);
  document.body.classList.toggle('hide-game-stats', !preferences.cardShowLikes);
  document.body.classList.toggle('sharp-corners', preferences.corners === 'sharp');
  document.body.classList.toggle('font-classic', preferences.uiFont === 'classic');
  document.body.classList.toggle('sidebar-auto-hide', preferences.sidebarAutoHide === true);
  document.body.classList.toggle('no-motion', !preferences.motion);
  document.body.classList.toggle('animations-off', !preferences.motion);
  document.body.classList.toggle('no-glow', !preferences.ambient);
  document.body.classList.toggle('high-contrast', preferences.contrast);
  document.body.dataset.cardAnimation = preferences.cardAnimation;
  // Home page look, managed in Settings → Home.
  document.body.dataset.homeLayout = preferences.homeLayout;
  document.body.classList.toggle('home-minimal', preferences.homeMinimal);
  // Animation speed: a single multiplier var drives every duration in the UI.
  root.setProperty('--speed', { slow: 1.6, normal: 1, fast: 0.55 }[preferences.animationSpeed] || 1);
  // Interface parts the user can switch off in Settings → Interface.
  document.body.classList.toggle('ui-no-sidebar-tip', !preferences.uiSidebarTip);
  document.body.classList.toggle('ui-no-profile', !preferences.uiProfileCard);
  document.body.classList.toggle('ui-no-sidebar-foot', !preferences.uiSidebarFoot);
  document.body.classList.toggle('ui-no-topbar-search', !preferences.uiTopbarSearch);
  document.body.classList.toggle('ui-no-breadcrumb', !preferences.uiBreadcrumb);
  document.body.classList.toggle('ui-no-notifications', !preferences.uiNotifications);
  applyStaticTranslations();
  renderAccountAvatar();
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

// Paid results live in their own list (Roblox has no paid catalog). Declared
// here so allGames()/getGame() can resolve them by id.
let paidGames = [];

function allGames() {
  const knownIds = new Set(games.map((game) => game.id));
  const custom = (preferences.customGames || []).filter((game) => game && !knownIds.has(String(game.id)));
  const customIds = new Set(custom.map((game) => String(game.id)));
  const known = new Set([...knownIds, ...customIds]);
  const dynamic = dynamicGames.filter((game) => game && !known.has(String(game.id)));
  for (const game of dynamic) known.add(String(game.id));
  // Paid results are a separate list; they must be resolvable by id as well.
  const paid = paidGames.filter((game) => game && !known.has(String(game.id)));
  return [...games, ...custom, ...dynamic, ...paid];
}

function getGame(id) { return allGames().find((game) => game.id === String(id)); }
function localizeGame(game) {
  const rawGenre = game.genre && String(game.genre).toLocaleLowerCase() !== 'roblox' ? String(game.genre).trim() : '';
  const localizedGenre = game.genreKey ? t(`genre.${game.genreKey}`) : rawGenre;
  return {
    ...game,
    genre: (localizedGenre && localizedGenre !== `genre.${game.genreKey}`) ? localizedGenre : (rawGenre || t('genre.other')),
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
function safeExternalUrl(value) {
  try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
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

function openGameDetails(id) {
  // Paid results live in their own list, so they must be searched too.
  const game = getGame(id)
    || genreResults.find((item) => String(item.id) === String(id))
    || searchResults.find((item) => String(item.id) === String(id))
    || recommendationState.items.find((item) => String(item.id) === String(id))
    || paidGames.find((item) => String(item.id) === String(id));
  if (!game) return;
  const requestId = ++detailRequestId;
  detailBadgeCount = 3;
  detailBadgesExpanded = true;
  detailGalleryIndex = 0;
  detailDescriptionExpanded = false;
  detailGalleryCount = 0;
  detailOnlineUpdatedAt = 0;
  detailGame = { ...game, upVotes: Number(game.upVotes) || 0, downVotes: Number(game.downVotes) || 0, playing: Number(game.playerCount) || 0, visits: Number(game.visits) || 0, favorites: Number(game.favorites) || 0 };
  detailStatus = 'loading';
  pushNavigationHistory('game-detail');
  currentView = 'game-detail';
  renderPage();
  const cacheKey = String(game.universeId || game.id);
  const cached = readDetailCache(cacheKey);
  if (cached) {
    detailGame = { ...detailGame, ...cached };
    detailStatus = 'success';
    renderPage();
    return;
  }
  if (!window.vortexDesktop?.getGameDetails) { detailStatus = 'error'; renderPage(); return; }
  const timeout = new Promise((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 14000));
  Promise.race([window.vortexDesktop.getGameDetails({ universeId: game.universeId, placeId: game.id }), timeout]).then((response) => {
    if (requestId !== detailRequestId || currentView !== 'game-detail') return;
    if (!response?.ok) { detailStatus = 'error'; renderPage(); return; }
    detailGame = { ...detailGame, ...response.game };
    detailStatus = 'success';
    writeDetailCache(cacheKey, response.game);
    renderPage();
    loadSimilarGames(requestId);
  }).catch(() => { if (requestId === detailRequestId && currentView === 'game-detail') { detailStatus = 'error'; renderPage(); } });
}

async function loadSimilarGames(requestId = detailRequestId) {
  if (!detailGame || !window.vortexDesktop?.getSimilarGames) return;
  try {
    const [list, history] = await Promise.all([
      window.vortexDesktop.getSimilarGames({ universeId: detailGame.universeId, genre: detailGame.genre, title: detailGame.title }).catch(() => []),
      window.vortexDesktop.getReleaseHistory?.(detailGame.universeId).catch(() => [])
    ]);
    if (requestId !== detailRequestId || currentView !== 'game-detail') return;
    const patch = {};
    if (Array.isArray(history) && history.length) patch.releaseHistory = history;
    if (!Object.keys(patch).length) return;
    detailGame = { ...detailGame, ...patch };
    renderPage();
  } catch { /* similar games and release log are optional */ }
}

// Refresh just the live numbers of the open game: the rest of the page keeps
// its scroll and its loaded media.
async function refreshGameOnline() {
  if (!detailGame || detailOnlineRefreshing) return;
  detailOnlineRefreshing = true;
  renderPage();
  try {
    const response = await window.vortexDesktop?.getGameOnline?.({
      universeId: String(detailGame.universeId || ''),
      placeId: String(detailGame.id || '')
    });
    if (response?.ok && currentView === 'game-detail') {
      detailGame = {
        ...detailGame,
        playing: Number(response.playing) || 0,
        visits: Number(response.visits) || detailGame.visits,
        favorites: Number(response.favorites) || detailGame.favorites,
        updated: response.updated || detailGame.updated,
        upVotes: Number(response.upVotes) || detailGame.upVotes,
        downVotes: Number(response.downVotes) || detailGame.downVotes
      };
      detailOnlineUpdatedAt = Date.now();
      writeDetailCache(String(detailGame.universeId || detailGame.id), detailGame);
    } else if (response && !response.ok) {
      showToast(t('game.onlineRefreshError'));
    }
  } catch {
    showToast(t('game.onlineRefreshError'));
  } finally {
    detailOnlineRefreshing = false;
    if (currentView === 'game-detail') renderPage();
  }
}

function renderGameDetail() {
  const game = detailGame;
  if (!game) return `<div class="empty-state"><h2>${t('game.detailNotFound')}</h2><button class="ghost-button" data-nav="catalog">${t('empty.openCatalog')}</button></div>`;
  const thumbnail = safeThumbnail(game.icon || game.thumbnail);
  const media = Array.isArray(game.media) ? game.media : [];
  const videos = media.filter((item) => item.type === 'video' && item.url);
  const screenshots = [...new Map([...(Array.isArray(game.screenshots) ? game.screenshots : []), ...media.filter((item) => item.type !== 'video' && item.url)].map((item) => [item.url, item])).values()];
  const likesTotal = Number(game.upVotes || 0) + Number(game.downVotes || 0);
  const likePercent = likesTotal ? Math.round(Number(game.upVotes || 0) / likesTotal * 100) : null;
  const dislikePercent = likePercent === null ? 0 : 100 - likePercent;
  const voteBar = likesTotal ? `<div class="detail-like-bar" role="img" aria-label="${t('game.likeRatio')} ${likePercent}%"><span class="detail-like-positive" style="width:${likePercent}%"></span><span class="detail-like-negative" style="width:${dislikePercent}%"></span></div><div class="detail-like-legend"><span><i class="like-dot"></i>${t('game.likeRatio')} · ${formatCount(game.upVotes)}</span><span><i class="dislike-dot"></i>${t('game.dislikeRatio')} · ${formatCount(game.downVotes)}</span></div>` : '';
  const playtime = renderPlaytimeBadge(game.id) || t('stats.noData');
  const description = String(game.description || t('game.fallbackDescription')).trim();
  const isUnavailable = game.availability === 'unavailable';
  const canPlay = !isUnavailable && Boolean(game.id);
  const priceLabel = Number(game.price) > 0 ? `${formatCount(game.price)} R$` : '';
  const badgeRow = (isUnavailable || Number(game.price) > 0)
    ? `<div class="detail-tags">${isUnavailable ? `<span class="detail-tag detail-tag-bad">${icon('close', 11)} ${t('game.notAvailable')}</span>` : ''}${Number(game.price) > 0 ? `<span class="detail-tag detail-tag-price">${t('game.paid', { price: priceLabel })}</span>` : ''}</div>`
    : '';
  const allBadges = Array.isArray(game.badges) ? game.badges : [];
  const visibleBadges = detailBadgesExpanded ? allBadges.slice(0, detailBadgeCount) : [];
  const badges = allBadges.length ? `<section class="detail-section"><div class="detail-section-heading"><h2>${icon('award', 15)} ${t('game.badges')}</h2><button class="ghost-button" data-action="toggle-badges">${t(detailBadgesExpanded ? 'game.hideBadges' : 'game.showBadges')}</button></div>${detailBadgesExpanded ? `<div class="detail-badges">${visibleBadges.map((badge) => `<span class="detail-badge">${badge.icon ? `<img src="${escapeHtml(badge.icon)}" alt="" loading="lazy" decoding="async" />` : `<span class="detail-badge-fallback">${icon('award', 18)}</span>`}<strong>${escapeHtml(badge.name)}</strong>${badge.description ? `<small>${escapeHtml(badge.description)}</small>` : ''}</span>`).join('')}</div>${visibleBadges.length < allBadges.length ? `<button class="ghost-button" data-action="show-more-badges">${t('game.showMoreBadges')}</button>` : ''}` : ''}</section>` : '';
  const social = Array.isArray(game.socialLinks) && game.socialLinks.length ? `<section class="detail-section"><h2>${icon('link', 15)} ${t('game.socialLinks')}</h2><div class="detail-social-links">${game.socialLinks.map((link) => {
    const href = safeExternalUrl(link.url);
    if (!href) return '';
    const label = link.title || link.type || new URL(href).hostname.replace(/^www\./, '');
    const platform = String(link.type || label).toLowerCase();
    const platformLabel = /discord/.test(platform) ? 'Discord' : /youtube|video/.test(platform) ? 'YouTube' : /twitter|x\.com/.test(platform) ? 'X' : /tiktok/.test(platform) ? 'TikTok' : /roblox/.test(platform) ? 'Roblox' : label;
    const platformIcon = /discord/.test(platform) ? 'discord' : /youtube|video/.test(platform) ? 'youtube' : /twitter|x\.com/.test(platform) ? 'twitter' : /tiktok/.test(platform) ? 'tiktok' : /roblox/.test(platform) ? 'roblox' : 'link';
    return `<button class="detail-social-card" type="button" data-action="open-social-link" data-url="${escapeHtml(href)}"><span class="social-platform-icon">${icon(platformIcon, 20)}</span><span><strong>${escapeHtml(platformLabel)}</strong><small>${escapeHtml(href.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</small></span></button>`;
  }).join('')}</div></section>` : '';
  const galleryItems = [...videos.map((item) => ({ ...item, kind: 'video' })), ...screenshots.map((item) => ({ ...item, kind: 'image' }))];
  detailGalleryCount = galleryItems.length;
  detailGalleryIndex = Math.min(detailGalleryIndex, Math.max(0, galleryItems.length - 1));
  const currentMedia = galleryItems[detailGalleryIndex];
  const galleryTitle = videos.length ? t('game.media') : t('game.screenshots');
  const gallery = currentMedia ? `<section class="detail-section"><div class="detail-section-heading"><div><h2>${icon(videos.length ? 'film' : 'image', 15)} ${galleryTitle}</h2><p>${detailGalleryIndex + 1} / ${galleryItems.length}</p></div>${galleryItems.length > 1 ? `<div class="detail-gallery-controls"><button class="icon-button" data-action="gallery-prev" aria-label="${t('game.previousMedia')}">${icon('arrowLeft', 16)}</button><button class="icon-button" data-action="gallery-next" aria-label="${t('game.nextMedia')}">${icon('arrow', 16)}</button></div>` : ''}</div><div class="detail-gallery"><div class="detail-gallery-slide">${currentMedia.kind === 'video' ? `<video controls preload="metadata" poster="${escapeHtml(currentMedia.thumbnail || '')}"><source src="${escapeHtml(currentMedia.url)}" type="video/mp4" /></video>` : `<img src="${escapeHtml(currentMedia.url)}" alt="${escapeHtml(currentMedia.altText || currentMedia.title || game.title)}" loading="lazy" decoding="async" />`}</div>${galleryItems.length > 1 ? `<div class="detail-gallery-dots">${galleryItems.map((_, index) => `<button class="gallery-dot ${index === detailGalleryIndex ? 'active' : ''}" data-action="gallery-goto" data-index="${index}" aria-label="${index + 1}"></button>`).join('')}</div>` : ''}</div></section>` : '';
  const releaseHistory = Array.isArray(game.releaseHistory) && game.releaseHistory.length > 1
    ? `<section class="detail-section"><h2>${t('game.releaseHistory')}</h2><div class="release-history">${game.releaseHistory.slice(0, 8).map((entry) => `<div class="release-row"><span class="release-dot"></span><span><strong>${escapeHtml(new Date(entry.updated).toLocaleDateString(preferences.language === 'en' ? 'en-US' : 'ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }))}</strong><small>${t('game.releaseSeen')}</small></span></div>`).join('')}</div><p class="catalog-disclaimer">${t('game.releaseHistoryHint')}</p></section>`
    : '';
  const similar = '';
  const heroArt = thumbnail || safeThumbnail(screenshots[0]?.url);
  const onlineUpdated = detailOnlineUpdatedAt
    ? new Date(detailOnlineUpdatedAt).toLocaleTimeString(preferences.language === 'en' ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' })
    : '';
  const refreshOnline = `<button class="icon-button detail-refresh ${detailOnlineRefreshing ? 'is-loading' : ''}" type="button" data-action="refresh-online" ${detailOnlineRefreshing ? 'disabled' : ''} aria-label="${t('game.refreshOnline')}" title="${t('game.refreshOnline')}">${icon('refreshCw', 14)}</button>`;
  const stats = `<section class="detail-stats">
    <div class="detail-stat detail-stat-online"><div class="detail-stat-head"><span>${icon('users', 13)} ${t('game.online')}</span>${refreshOnline}</div><strong>${formatCount(game.playing ?? game.playerCount)}</strong><small>${onlineUpdated ? t('game.onlineUpdated', { time: onlineUpdated }) : t('game.onlineHint')}</small></div>
    <div class="detail-stat detail-like-stat"><div class="detail-stat-head"><span>${t('game.likeRatio')}</span><span class="detail-like-total">${t('game.votesTotal')} · ${formatCount(likesTotal)}</span></div><strong>${likePercent === null ? '—' : `${likePercent}%`}</strong>${voteBar}</div>
    <div class="detail-stat"><div class="detail-stat-head"><span>${icon('eye', 13)} ${t('game.visits')}</span></div><strong>${formatCount(game.visits)}</strong><small>${t('game.visitsHint')}</small></div>
    <div class="detail-stat"><div class="detail-stat-head"><span>${icon('heart', 13)} ${t('game.favorites')}</span></div><strong>${formatCount(game.favorites)}</strong><small>${t('game.favoritesHint')}</small></div>
  </section>`;
  return `<button class="detail-back icon-button" data-action="detail-back" aria-label="${t('game.backToCatalog')}" title="${t('game.backToCatalog')}">${icon('arrowLeft', 17)}</button>
    <article class="game-detail">
      <header class="detail-hero"${heroArt ? ` style="--detail-art:url('${escapeHtml(heroArt)}')"` : ''}>
        <span class="detail-hero-backdrop" aria-hidden="true"></span>
        <div class="detail-avatar">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(game.title)}" />` : `<span class="detail-avatar-fallback">${escapeHtml((game.title || 'R')[0].toLocaleUpperCase())}</span>`}</div><div class="detail-hero-copy"><div class="eyebrow">${t('game.placeEyebrow')}</div><h1>${escapeHtml(game.title)}</h1><p class="detail-creator-line">${escapeHtml(game.creator || t('game.unknownCreator'))}${game.creatorVerified ? `<span class="verified-badge" title="${t('game.verifiedCreator')}" aria-label="${t('game.verifiedCreator')}">${icon('check', 11)}</span>` : ''}</p>${badgeRow}<div class="detail-actions">${canPlay ? `<button class="primary-button" data-action="play" data-id="${escapeHtml(game.id)}">${icon('play', 14)} ${t('card.play')}</button>` : `<button class="primary-button" disabled>${icon('close', 14)} ${t('game.notAvailable')}</button>`}<button class="ghost-button" data-action="favorite" data-id="${escapeHtml(game.id)}">${icon('heart', 14)} ${favorites.has(String(game.id)) ? t('card.favoriteRemove') : t('card.favoriteAdd')}</button><span class="detail-playtime">${icon('clock', 13)} ${playtime}</span></div></div>
      </header>
      ${detailStatus === 'loading' ? `<div class="search-loading"><span class="loading-spinner"></span><strong>${t('game.loadingDetails')}</strong></div>` : ''}
      ${detailStatus === 'error' ? `<p class="catalog-disclaimer">${t('game.detailsUnavailable')}</p>` : ''}
      ${stats}
      <div class="detail-columns">
        <section class="detail-section detail-about"><h2>${t('game.description')}</h2><p class="detail-description ${detailDescriptionExpanded ? 'expanded' : 'collapsed'}">${escapeHtml(description)}</p>${description.length > 420 ? `<button class="ghost-button detail-description-toggle" data-action="toggle-detail-description">${t(detailDescriptionExpanded ? 'card.readLess' : 'card.readMore')}</button>` : ''}</section>
        <section class="detail-section detail-meta"><div><span>${t('game.author')}</span><strong class="meta-creator">${escapeHtml(game.creator || t('game.unknownCreator'))}${game.creatorVerified ? `<span class="verified-badge small" title="${t('game.verifiedCreator')}">${icon('check', 10)}</span>` : ''}</strong></div><div><span>${t('game.genre')}</span><strong>${escapeHtml(game.genre || t('genre.other'))}</strong></div><div><span>${t('game.access')}</span><strong>${isUnavailable ? t('game.notAvailable') : Number(game.price) > 0 ? t('game.paid', { price: priceLabel }) : t('game.free')}</strong></div><div><span>${t('game.updated')}</span><strong>${game.updated ? escapeHtml(new Date(game.updated).toLocaleDateString(preferences.language === 'en' ? 'en-US' : 'ru-RU')) : '—'}</strong></div></section>
      </div>
      ${gallery}${badges}${social}${releaseHistory}${similar}
    </article>`;
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
  const cardVerified = game.creatorVerified ? `<span class="verified-badge small" title="${t('game.verifiedCreator')}">${icon('check', 10)}</span>` : '';
  const cardPrice = Number(game.price) > 0 ? `<span class="card-price-tag">${formatCount(game.price)} R$</span>` : '';
  const cardUnavailable = game.availability === 'unavailable' ? `<span class="card-unavailable-tag">${t('game.notAvailable')}</span>` : '';
  const description = String(game.description || t('game.fallbackDescription')).trim();
  const category = game.genre ? `<span class="game-category"><i></i>${escapeHtml(game.genre)}</span>` : '<span></span>';
  const expandedDescription = expandedDescriptions.has(String(game.id));
  const canExpandDescription = description.length > 100;
  return `<article class="game-card" style="--game-color: var(--accent)" data-game="${id}" data-universe-id="${escapeHtml(game.universeId || '')}">
    <div class="game-cover art-${art} ${thumbnail ? 'has-thumbnail' : ''}">
      <button class="game-cover-action" type="button" data-action="open-details" data-id="${id}" aria-label="${t('card.openDetails', { title: escapeHtml(game.title) })}"></button>
      ${thumbnail ? `<img class="game-thumbnail" src="${escapeHtml(thumbnail)}" alt="" loading="${preferences.lazyImages ? 'lazy' : 'eager'}" decoding="async" />` : ''}
      <span class="cover-shine"></span>
      ${cardUnavailable}
      <button class="favorite-button ${isFavorite ? 'is-favorite' : ''}" data-action="favorite" data-id="${id}" aria-label="${isFavorite ? t('card.favoriteRemove') : t('card.favoriteAdd')}" aria-pressed="${isFavorite}">${icon('heart', 15)}</button>
    </div>
    <div class="game-info">
      <h3 class="game-title-row"><button class="game-title" type="button" data-action="open-details" data-id="${id}">${escapeHtml(game.title)}</button>${cardVerified}</h3>
      ${preferences.cardShowDescription ? `<p class="game-description ${expandedDescription ? 'expanded' : ''}" title="${escapeHtml(description)}">${escapeHtml(description)}</p>
      ${canExpandDescription ? `<button class="description-more" data-action="toggle-description" data-id="${id}" aria-expanded="${expandedDescription}">${t(expandedDescription ? 'card.readLess' : 'card.readMore')}</button>` : ''}` : ''}
      ${preferences.cardShowLikes ? liveStats : ''}
      <div class="game-card-footer">${preferences.cardShowGenre ? category : ''}${cardPrice}${preferences.cardShowPlaytime ? renderPlaytimeBadge(game.id) : ''}<button class="card-play" data-action="play" data-id="${id}">${icon('play', 11)} ${t('card.play')}</button></div>
    </div>
  </article>`;
}

function renderGrid(list, emptyTitle, emptyText, emptyAction = 'catalog') {
  if (!list.length) {
    const actionLabel = emptyAction === 'settings' ? t('home.empty.action') : t('empty.openCatalog');
    return `<div class="empty-state"><div class="empty-icon">${icon(emptyAction === 'favorites' ? 'heart' : 'search', 20)}</div><h2>${emptyTitle}</h2><p>${emptyText}</p><button class="ghost-button" data-nav="${emptyAction}">${actionLabel} ${icon('arrow', 13)}</button></div>`;
  }
  // Optional genre grouping: split the grid into labelled sections.
  if (preferences.catalogGroupByGenre && emptyAction === 'catalog') {
    const groups = new Map();
    for (const game of list) {
      const genre = String(game.genre || t('genre.other'));
      if (!groups.has(genre)) groups.set(genre, []);
      groups.get(genre).push(game);
    }
    const sections = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
      .map(([genre, games]) => `<section class="catalog-genre-section"><div class="catalog-genre-head"><h2>${escapeHtml(genre)}</h2><span>${games.length}</span></div><div class="game-grid ${preferences.catalogView === 'list' ? 'catalog-list-view' : ''}">${games.map(renderGameCard).join('')}</div></section>`).join('');
    return `<div class="catalog-genre-groups">${sections}</div>`;
  }
  return `<div class="game-grid ${preferences.catalogView === 'list' ? 'catalog-list-view' : ''}">${list.map(renderGameCard).join('')}</div>`;
}

function pageHeading(eyebrow, title, description, action = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ''}</div>`;
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
  const formatLaunches = (count) => {
    const n = Number(count) || 1;
    if (preferences.language === 'en') return `${n} ${n === 1 ? 'launch' : 'launches'}`;
    const mod10 = n % 10; const mod100 = n % 100;
    const word = mod10 === 1 && mod100 !== 11 ? 'запуск' : (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'запуска' : 'запусков');
    return `${n} ${word}`;
  };
  return `<section class="play-stats home-widget" data-home-widget="playstats">
    ${renderWidgetHeading('playstats', t('stats.title'), t('stats.body'))}
    <div class="play-stats-grid">${entries.map(([id, entry]) => { const game = getGame(id); const thumbnail = safeThumbnail(game.thumbnail); return `
      <button class="play-stat-card" data-action="play" data-id="${escapeHtml(String(game.id))}">
        <span class="play-stat-art ${thumbnail ? 'has-thumbnail' : ''}">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" />` : ''}</span>
        <span class="play-stat-copy"><strong>${escapeHtml(game.title)}</strong><small>${formatTime(Number(entry.seconds))} · ${formatLaunches(entry.launches || 1)}</small></span>
        <span class="play-stat-play">${icon('play', 12)}</span>
      </button>`; }).join('')}</div>
  </section>`;
}

// ---------- Home widgets (Stage 4) ----------
// The home page is assembled from blocks the user can reorder, hide and collapse.
// Order/visibility/collapsed state live in preferences; the drag machinery from
// the sidebar (data-ui-order + ui-row) is reused for the widget list.
const HOME_WIDGETS = [
  { key: 'hero', titleKey: 'settings.home.hero', bodyKey: 'settings.home.heroHint', icon: 'sparkle' },
  { key: 'picks', titleKey: 'settings.home.recommendations', bodyKey: 'settings.home.recommendationsHint', icon: 'grid' },
  { key: 'playstats', titleKey: 'home.widgets.playstats', bodyKey: 'home.widgets.playstatsBody', icon: 'clock' },
  { key: 'favorites', titleKey: 'home.widgets.favorites', bodyKey: 'home.widgets.favoritesBody', icon: 'heart' },
  { key: 'recent', titleKey: 'home.widgets.recent', bodyKey: 'home.widgets.recentBody', icon: 'clock' }
];

function homeWidgetOrder() {
  const saved = Array.isArray(preferences.homeWidgetOrder) ? preferences.homeWidgetOrder.map(String) : [];
  const known = HOME_WIDGETS.map((w) => w.key);
  const ordered = saved.filter((k) => known.includes(k));
  for (const k of known) if (!ordered.includes(k)) ordered.push(k);
  return ordered;
}

function homeWidgetVisible(key) {
  const hidden = Array.isArray(preferences.homeWidgetHidden) ? preferences.homeWidgetHidden.map(String) : [];
  return !hidden.includes(key);
}

function homeWidgetCollapsed(key) {
  const collapsed = Array.isArray(preferences.homeWidgetCollapsed) ? preferences.homeWidgetCollapsed.map(String) : [];
  return collapsed.includes(key);
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
  const emptyHint = customGames.length ? '' : `<section class="section-block home-empty-block"><div class="empty-state home-empty-state"><div class="empty-state-copy"><h2>${t('home.empty.title')}</h2><p>${t('home.empty.body')}</p><button class="primary-button" data-nav="settings">${icon('sliders')} ${t('home.empty.action')}</button></div><svg class="library-map" viewBox="0 0 440 240" fill="none" aria-hidden="true"><path class="map-contour" d="M24 170C76 140 88 57 151 62c49 4 42 73 96 78 54 5 58-42 111-44 25-1 43 10 58 24M29 207c54-34 83-89 119-89 41 0 48 67 103 67 58 0 64-46 112-48 24-1 43 8 63 19M55 32c33 22 48 41 48 63m231 116c8-28 21-45 43-56"/><path class="map-route" pathLength="1" d="M62 190C99 164 111 106 148 105s50 47 91 47 57-49 101-47"/><circle class="map-node" cx="62" cy="190" r="6"/><circle class="map-node" cx="148" cy="105" r="8"/><circle class="map-node map-node-active" cx="239" cy="152" r="10"/><circle class="map-node" cx="340" cy="105" r="6"/><path class="map-crosshair" d="M239 127v-9m0 77v-9m-25-34h-9m77 0h-9"/><path class="map-coordinate" d="M20 24h22M20 24v22m378 170h22m0 0v-22"/></svg></div></section>`;

  // Each widget renders to a <section class="home-widget" data-home-widget="key">
  // with a heading that carries collapse + move controls.
  const widgetBodies = {
    hero: preferences.homeShowHero && featured ? (() => {
      // The game's own artwork becomes the hero backdrop; the scrim keeps the
      // left column readable no matter how bright the thumbnail is.
      const art = safeThumbnail(featured.thumbnail);
      const artVar = art ? ` style="--hero-art:url('${escapeHtml(art)}')"` : '';
      return `<section class="hero-card home-widget" data-home-widget="hero"${artVar}>
      ${art ? `<span class="hero-media" aria-hidden="true"><img src="${escapeHtml(art)}" alt="" /></span>` : `<span class="hero-media is-fallback" aria-hidden="true">${icon('sparkle', 46)}</span>`}
      <span class="hero-scrim" aria-hidden="true"></span>
      <span class="hero-avatar" aria-hidden="true">${art ? `<img src="${escapeHtml(art)}" alt="" />` : `<span class="hero-avatar-fallback">${escapeHtml((featured.title || 'R')[0].toLocaleUpperCase())}</span>`}</span>
      <div class="hero-copy"><span class="hero-kicker">${t('hero.kicker')}</span><h2>${escapeHtml(featured.title)}</h2><p>${escapeHtml(featured.description || t('hero.body'))}</p>
        <div class="hero-actions"><button class="primary-button" data-action="play" data-id="${escapeHtml(featured.id)}">${icon('play')} ${t('hero.play', { title: escapeHtml(featured.title) })}</button>${featured.creator ? `<span class="hero-meta">${escapeHtml(featured.creator)}</span>` : ''}</div>
      </div>
    </section>`;
    })() : '',
    picks: customGames.length ? `<section class="section-block home-widget" data-home-widget="picks">${renderWidgetHeading('picks', t('home.section.title'), t('home.section.subtitle'))}
      ${renderGrid(picks, t('home.picks.emptyTitle'), t('home.picks.emptyBody'), 'settings')}</section>` : '',
    playstats: renderPlayStats(),
    favorites: homeWidgetVisible('favorites') ? renderHomeFavoritesPreview() : '',
    recent: homeWidgetVisible('recent') ? renderHomeRecentPreview() : ''
  };

  // Legacy flags fold into the widget system: hero/recommendations toggles keep working.
  if (preferences.homeShowHero === false) widgetBodies.hero = '';
  if (preferences.homeShowRecommendations === false) widgetBodies.picks = '';

  const widgets = homeWidgetOrder()
    .filter((key) => homeWidgetVisible(key) && widgetBodies[key])
    .map((key) => {
      // The hero has no widget heading/collapse control, so never mark it as collapsed.
      if (key === 'hero') return widgetBodies[key];
      return widgetBodies[key].replace('data-home-widget="', `data-collapsed="${homeWidgetCollapsed(key)}" data-home-widget="`);
    });
  return `<div class="home-view" data-home-view data-home-layout="${preferences.homeLayout}">
    ${pageHeading(t('page.home.eyebrow'), `<span class="heading-inline-icon">${icon('handWave', 19)}</span>${escapeHtml(greeting)}`, t('page.home.description'))}
    ${emptyHint}${widgets.join('')}
  </div>`;
}

// Collapse/expand + reorder header injected into every home widget section.
function renderWidgetHeading(key, title, subtitle = '') {
  const collapsed = homeWidgetCollapsed(key);
  // Custom section titles (settings) override the defaults; --section-scale
  // scales every home section heading.
  const custom = preferences.homeSectionTitles && preferences.homeSectionTitles[key];
  const shownTitle = custom || title;
  return `<div class="home-widget-head" data-home-widget-head="${key}" style="--section-scale: ${preferences.homeSectionScale || 1}">
    <button class="home-widget-collapse" data-widget-collapse="${key}" aria-expanded="${!collapsed}" aria-label="${t('home.widgets.collapse')}">${icon(collapsed ? 'arrow' : 'navDown', 12)}</button>
    <div class="home-widget-copy"><h2>${escapeHtml(shownTitle)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>
    <span class="home-widget-grip" data-widget-drag="${key}" aria-hidden="true">${icon('grip', 13)}</span>
  </div>`;
}

// Compact favorites/recent strips for the home page: one row of mini-cards.
function renderHomeFavoritesPreview() {
  const list = allGames().filter((game) => favorites.has(game.id)).slice(0, 6);
  if (!list.length) return '';
  return `<section class="section-block home-widget" data-home-widget="favorites">${renderWidgetHeading('favorites', t('home.widgets.favorites'), t('home.widgets.favoritesBody'))}
    <div class="home-strip">${list.map((game) => renderHomeStripCard(game)).join('')}</div>
  </section>`;
}

function renderHomeRecentPreview() {
  const list = recentGames.map(getGame).filter(Boolean).slice(0, 6);
  if (!list.length) return '';
  return `<section class="section-block home-widget" data-home-widget="recent">${renderWidgetHeading('recent', t('home.widgets.recent'), t('home.widgets.recentBody'))}
    <div class="home-strip">${list.map((game) => renderHomeStripCard(game)).join('')}</div>
  </section>`;
}

function renderHomeStripCard(game) {
  const thumbnail = safeThumbnail(game.thumbnail);
  const local = localizeGame(game);
  // Playtime first; genre or creator as fallback — never an action-style hint.
  const sub = renderPlaytimeBadge(game.id) || `<span class="strip-no-playtime">${t('stats.noData')}</span>`;
  return `<button class="home-strip-card" data-action="play" data-id="${escapeHtml(String(game.id))}" title="${escapeHtml(game.title)}">
    <span class="home-strip-art ${thumbnail ? 'has-thumbnail' : ''}">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" />` : ''}</span>
    <span class="home-strip-copy"><strong>${escapeHtml(game.title)}</strong><small>${sub}</small></span>
  </button>`;
}

const GENRE_SEARCH_BASE = {
  adventure: 'adventure', horror: 'horror', roleplay: 'roleplay', fashion: 'fashion',
  parkour: 'obby', action: 'action', simulator: 'simulator', survival: 'survival'
};
// Endless query generator: base phrasings first, then modifier suffixes
// combined with the genre word, so "Показать ещё" always has somewhere to go.
const TERM_MODIFIERS = ['game', 'story', 'best', 'new', 'popular', 'rp', '2', 'pro', 'mega', 'ultimate', 'extreme', 'tycoon', 'world', 'city', 'island', 'boss', 'legend', 'hero', 'secret', 'escape', 'craft', 'build', 'run', 'jump', 'fight', 'team', 'pvp', 'anime', 'pets', 'trade', 'clicker', 'hard', 'easy', 'fun', 'cool', 'epic', 'free', 'vip', 'obby', 'tower', 'maze', 'race', 'war', 'magic', 'ninja', 'zombie', 'space', 'ocean', 'desert', 'jungle', 'snow', 'fire'];
function genreSearchTermAt(genre, index) {
  const base = GENRE_SEARCH_BASE[genre];
  if (!base) return null;
  if (index === 0) return base;
  const modIndex = index - 1;
  const mod = TERM_MODIFIERS[modIndex % TERM_MODIFIERS.length];
  const round = Math.floor(modIndex / TERM_MODIFIERS.length);
  const suffix = round === 0 ? mod : `${mod} ${round + 1}`;
  // Interleave: "adventure game", "game adventure", so both word orders get used.
  return modIndex % 2 === 0 ? `${base} ${suffix}` : `${suffix} ${base}`;
}
let genreResults = [];
let genrePendingResults = [];
let genreOverflowResults = [];
let genrePageToken = null;
let genreSessionId = '';
let genreStatus = 'idle';
let genreLoadingMore = false;
let activeGenreRequestId = 0;
let genreTermIndex = 0;

function isGenreSearchActive() { return !searchQuery && activeCategory !== 'all'; }

async function fetchGenreGames(append = false) {
  const genre = activeCategory;
  if (!GENRE_SEARCH_BASE[genre] || genreLoadingMore) return;
  const requestId = ++activeGenreRequestId;
  const targetNewCount = append ? 10 : 0;
  const maxRequests = append ? 120 : 1;
  if (append) {
    genreLoadingMore = true;
    genrePendingResults = [];
    renderPage();
  } else {
    genreStatus = 'loading';
    genreResults = [];
    genrePendingResults = [];
    genreOverflowResults = [];
    genrePageToken = null;
    genreSessionId = createSearchSessionId();
    genreTermIndex = 0;
    renderPage();
  }

  const seen = new Set([...genreResults, ...genreOverflowResults].map((game) => String(game.id)));
  let successfulRequests = 0;
  try {
    if (!window.vortexDesktop?.searchGames) throw new Error('desktop only');
    if (append) {
      while (genreOverflowResults.length && genrePendingResults.length < targetNewCount) {
        genrePendingResults.push(genreOverflowResults.shift());
      }
    }
    while (successfulRequests < maxRequests && (!append || genrePendingResults.length < targetNewCount)) {
      if (requestId !== activeGenreRequestId || activeCategory !== genre) return;
      const term = genreSearchTermAt(genre, genreTermIndex);
      if (!term) break;
      const response = await window.vortexDesktop.searchGames({ query: term, sessionId: genreSessionId, pageToken: genrePageToken });
      genreSessionId = response.sessionId || genreSessionId;
      successfulRequests++;
      if (requestId !== activeGenreRequestId || activeCategory !== genre) return;
      const received = (response.items || []).map((game) => ({
        ...game, id: String(game.id), title: String(game.title || t('game.fallbackDescription')),
        creator: String(game.creator || ''), genre: String(game.genre || ''),
        genreKey: game.genreKey || inferGenreKey(game), tagKey: 'roblox', art: 'live', iconKey: 'gamepad',
        description: String(game.description || t('game.fallbackDescription')), live: true, search: term
      }));
      const novel = [];
      for (const game of received) {
        if (seen.has(game.id)) continue;
        seen.add(game.id);
        novel.push(game);
      }
      if (append) {
        const need = Math.max(0, targetNewCount - genrePendingResults.length);
        genrePendingResults.push(...novel.slice(0, need));
        genreOverflowResults.push(...novel.slice(need));
      } else genreResults.push(...novel);
      const nextToken = response.nextPageToken || null;
      if (nextToken) genrePageToken = nextToken;
      else { genrePageToken = null; genreTermIndex++; }
    }
    if (append) genreResults = [...genreResults, ...genrePendingResults];
    genrePendingResults = [];
    genreStatus = 'success';
    genreLoadingMore = false;
    renderPage();
  } catch {
    if (requestId !== activeGenreRequestId) return;
    // Keep partial successful games if a later page hits a transient error.
    if (append && genrePendingResults.length) genreResults = [...genreResults, ...genrePendingResults];
    genrePendingResults = [];
    genreStatus = genreResults.length ? 'success' : 'error';
    genreLoadingMore = false;
    renderPage();
  }
}

function filterGames() {
  const query = searchQuery.trim().toLocaleLowerCase(preferences.language);
  if (!query && activeDiscoverySort === RECOMMENDED_SORT.id && activeAccess !== 'paid') {
    return recommendationState.items.filter((game) => activeCategory === 'all' || game.genreKey === activeCategory);
  }
  if (isGenreSearchActive()) {
    // Results were fetched from Roblox using the selected genre query.
    // Do not re-filter by our local genre classifier; that used to hide most
    // valid API hits, making a 10-game batch appear as only 1–3 cards.
    let list = [...genreResults];
    if (sortMode === 'alpha') list = list.slice().sort((first, second) => first.title.localeCompare(second.title, preferences.language));
    if (sortMode === 'recent') list = list.slice().sort((first, second) => new Date(second.updated || 0) - new Date(first.updated || 0));
    if (sortMode === 'visits') list = list.slice().sort((first, second) => (Number(second.visits) || 0) - (Number(first.visits) || 0));
    if (sortMode === 'players') list = list.slice().sort((first, second) => (second.playerCount || 0) - (first.playerCount || 0));
    if (sortMode === 'likes') list = list.slice().sort((first, second) => {
      const score = (game) => (Number(game.upVotes) + Number(game.downVotes)) ? Number(game.upVotes) / (Number(game.upVotes) + Number(game.downVotes)) : 0;
      return score(second) - score(first);
    });
    return list;
  }
  const accumulated = discoveryCatalog.__accumulated?.items;
  const discovered = Array.isArray(accumulated) && accumulated.length ? accumulated : discoveryCatalog[activeDiscoverySort]?.items;
  let sourceGames = searchQuery ? searchResults : currentView === 'catalog' && Array.isArray(discovered) ? [...discovered, ...games.filter((game) => !discovered.some((item) => String(item.id) === String(game.id)))] : games;
  let list = sourceGames.filter((game) => {
    const localized = localizeGame(game);
    const matchesQuery = !query || String(game.id).includes(query) || `${game.title} ${localized.genre} ${localized.description} ${game.search || ''}`.toLocaleLowerCase(preferences.language).includes(query);
    const matchesCategory = activeCategory === 'all' || game.genreKey === activeCategory;
    return matchesQuery && matchesCategory;
  });
  if (sortMode === 'alpha') list = list.slice().sort((first, second) => first.title.localeCompare(second.title, preferences.language));
  if (sortMode === 'updated') list = list.slice().sort((first, second) => new Date(second.updated || 0) - new Date(first.updated || 0));
  if (sortMode === 'visits') list = list.slice().sort((first, second) => (Number(second.visits) || 0) - (Number(first.visits) || 0));
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
    { value: 'updated', label: t('sort.updated') },
    { value: 'visits', label: t('sort.visits') },
    { value: 'alpha', label: t('sort.alpha') }
  ];
  const selected = options.find((option) => option.value === sortMode) || options[0];
  return `<div class="custom-select" data-custom-select>
    <button class="custom-select-trigger" type="button" data-sort-toggle aria-haspopup="listbox" aria-expanded="false" aria-label="${t('search.sort')}"><span>${escapeHtml(selected.label)}</span>${icon('chevronDown', 13)}</button>
    <div class="custom-select-menu" role="listbox" aria-label="${t('search.sort')}" hidden>${options.map((option) => `<button class="custom-select-option" type="button" role="option" aria-selected="${sortMode === option.value}" data-sort-value="${option.value}">${escapeHtml(option.label)}</button>`).join('')}</div>
  </div>`;
}

function renderGenreFilters() {
  const genres = ['all', 'adventure', 'horror', 'roleplay', 'fashion', 'parkour', 'action', 'simulator', 'survival'];
  return `<div class="catalog-filter-group"><span class="catalog-filter-label">${t('search.genre')}</span><div class="filter-row genre-filter-row"><button class="filter-chip ${activeCategory === 'all' ? 'active' : ''}" data-category="all">${t('catalog.anyGenre')}</button>${genres.slice(1).map((genre) => `<button class="filter-chip ${activeCategory === genre ? 'active' : ''}" data-category="${genre}">${t(`genre.${genre}`)}</button>`).join('')}</div></div>`;
}

// Access filter sits beside genres, not inside them.
function renderAccessFilters() {
  const options = [['all', t('catalog.accessAll')], ['paid', t('catalog.accessPaid')]];
  return `<div class="catalog-filter-group"><span class="catalog-filter-label">${t('catalog.access')}</span><div class="filter-row access-filter-row">${options.map(([value, label]) => `<button class="filter-chip ${activeAccess === value ? 'active' : ''}" data-access="${value}">${value === 'paid' ? icon('coin', 12) : ''}${label}</button>`).join('')}</div></div>`;
}
function renderCatalogViewToggle() {
  return `<div class="catalog-view-toggle" role="group" aria-label="${t('catalog.view')}"><button class="icon-button ${preferences.catalogView === 'grid' ? 'active' : ''}" data-catalog-view="grid" title="${t('catalog.gridView')}">${icon('grid', 14)}</button><button class="icon-button ${preferences.catalogView === 'list' ? 'active' : ''}" data-catalog-view="list" title="${t('catalog.listView')}">${icon('list', 14)}</button></div>`;
}

// ---- Dedicated search tab ----
// The search page owns its own input and its own results state. Search fires
// only on Enter or the search button — nothing re-renders on its own, and
// "Показать ещё" is the only way to grow the list.
function renderSearchPage() {
  const results = searchResults;
  let bodyHtml = '';
  if (!searchQuery) {
    bodyHtml = `<div class="empty-state"><div class="empty-icon">${icon('search', 20)}</div><h2>${t('search.emptyTitle')}</h2><p>${t('search.emptyBody')}</p></div>`;
  } else if (searchQuery.trim().length < 2) {
    bodyHtml = `<div class="empty-state"><div class="empty-icon">${icon('search', 20)}</div><h2>${t('search.shortTitle')}</h2><p>${t('search.shortBody')}</p></div>`;
  } else if (searchStatus === 'loading') {
    bodyHtml = `<div class="search-loading"><span class="loading-spinner"></span><strong>${t('search.loading')}</strong><small>${t('search.loadingNote')}</small></div>`;
  } else if (searchStatus === 'error') {
    bodyHtml = `<p class="catalog-disclaimer"><strong>${t('search.errorTitle')}</strong> ${t('search.errorBody')}</p>${renderGrid(results, t('search.noMatches'), t('search.tryAnother'))}`;
  } else if (results.length) {
    const loadMore = isLoadingMore
      ? `<div class="load-more-status"><span class="loading-spinner small"></span>${t('search.loadingMore')}</div>`
      : `<button class="ghost-button load-more-button" data-action="load-more">${t('search.loadMore')} ${icon('arrow', 13)}</button>`;
    bodyHtml = `<p class="result-note">${formatResultCount(results.length)}</p>${renderGrid(results, t('search.noResults'), t('search.tryShorter'))}${loadMore}`;
  } else {
    bodyHtml = renderGrid(results, t('search.noResults'), t('search.tryShorter'));
  }
  return `${pageHeading(t('page.search.eyebrow'), t('page.search.title'), t('page.search.description'))}
    <section class="section-block">
      <div class="search-page-field">
        <span class="search-page-icon">${icon('search', 18)}</span>
        <input data-search-page-input type="search" autocomplete="off" placeholder="${t('search.placeholder')}" value="${escapeHtml(searchQuery)}" />
        ${searchQuery ? `<button class="icon-button" data-search-page-clear aria-label="${t('search.clear')}">${icon('close', 14)}</button>` : ''}
        <button class="primary-button" data-search-page-submit>${icon('search', 14)} ${t('search.submit')}</button>
      </div>
      ${bodyHtml}
    </section>`;
}

function searchPageNavigate() {
  if (currentView !== 'search') {
    currentView = 'search';
    renderPage();
  }
}

function submitSearchPage(value) {
  searchQuery = String(value || '');
  searchResults = [];
  searchPageToken = null;
  isLoadingMore = false;
  searchSessionId = createSearchSessionId();
  searchRequestId += 1;
  if (searchTimer) window.clearTimeout(searchTimer);
  if (searchQuery.trim().length >= 2) {
    searchStatus = 'loading';
    renderPage();
    fetchLiveSearch(false);
  } else {
    searchStatus = 'idle';
    renderPage();
  }
}

function renderCatalog() {
  // Entering the paid view kicks off the first scan (guarded by status).
  if (activeAccess === 'paid' && paidStatus === 'idle') window.setTimeout(() => loadPaidGames(), 0);
  if (activeAccess !== 'paid' && activeDiscoverySort === RECOMMENDED_SORT.id && recommendationState.status === 'idle') window.setTimeout(() => loadRecommendations(), 0);
  const list = filterGames();
  const availableSorts = catalogSorts();
  const selectedSort = availableSorts.find((sort) => sort.id === activeDiscoverySort) || availableSorts[0];
  const queryLabel = searchQuery ? t('search.queryLabel', { query: escapeHtml(searchQuery) }) : t('page.catalog.description');
  const isLiveSearch = searchQuery.length >= 2;
  const isPlaceId = /^\d{5,20}$/.test(searchQuery.trim());
  const controls = isLiveSearch
    ? `<div class="live-search-caption"><span class="live-search-dot"></span>${isPlaceId ? t('search.placeId') : t('search.live')}</div>${renderCustomSortSelect(true)}${renderGenreFilters()}${renderAccessFilters()}${renderCatalogViewToggle()}`
    : `<div class="filter-row discovery-sort-row" role="tablist" aria-label="${t('page.catalog.title')}">${availableSorts.map((sort) => `<button class="filter-chip ${activeDiscoverySort === sort.id ? 'active' : ''}" role="tab" aria-selected="${activeDiscoverySort === sort.id}" data-discovery-sort="${escapeHtml(sort.id)}">${escapeHtml(discoverySortLabel(sort))}</button>`).join('')}</div>${renderCustomSortSelect(false)}${renderGenreFilters()}${renderAccessFilters()}${renderCatalogViewToggle()}`;
  let resultsBody = '';
  if (searchQuery.length === 1) {
    resultsBody = `<div class="empty-state"><div class="empty-icon">${icon('search', 20)}</div><h2>${t('search.shortTitle')}</h2><p>${t('search.shortBody')}</p></div>`;
  } else if (isLiveSearch && searchStatus === 'loading') {
    resultsBody = `<div class="search-loading"><span class="loading-spinner"></span><strong>${isPlaceId ? t('search.placeIdLoading') : t('search.loading')}</strong><small>${t('search.loadingNote')}</small></div>`;
  } else if (isLiveSearch && searchStatus === 'error') {
    resultsBody = `<p class="catalog-disclaimer"><strong>${t('search.errorTitle')}</strong> ${t('search.errorBody')}</p>${renderGrid(list, t('search.noMatches'), t('search.tryAnother'))}`;
  } else if (isLiveSearch && searchStatus === 'success') {
    resultsBody = `<p class="result-note">${formatResultCount(list.length)}</p>${renderGrid(list, t('search.noResults'), t('search.tryShorter'))}${isLoadingMore ? `<div class="load-more-status"><span class="loading-spinner small"></span>${t('search.loadingMore')}</div>` : searchPageToken ? `<button class="ghost-button load-more-button" data-action="load-more">${t('search.loadMore')} ${icon('arrow', 13)}</button>` : ''}`;
  } else if (activeAccess === 'paid' && !searchQuery) {
    // Paid experiences: a section inside the catalog, not a new page and not a genre.
    // Every "show more" runs another scan, so the list keeps growing.
    if (paidStatus === 'loading') {
      resultsBody = `<div class="search-loading"><span class="loading-spinner"></span><strong>${t('catalog.paidLoading')}</strong><small>${t('catalog.paidLoadingNote')}</small></div>`;
    } else if (paidStatus === 'error') {
      resultsBody = `<p class="catalog-disclaimer"><strong>${t('catalog.errorTitle')}</strong> ${t('catalog.paidError')}</p>`;
    } else if (!paidGames.length) {
      resultsBody = `<div class="empty-state"><div class="empty-icon">${icon('coin', 20)}</div><h2>${t('catalog.paidEmptyTitle')}</h2><p>${t('catalog.paidEmptyBody')}</p></div>`;
    } else {
      const visible = paidGames.slice(0, paidVisibleCount);
      const hidden = paidGames.length - visible.length;
      const loadMore = paidStatus === 'loading-more'
        ? `<div class="load-more-status"><span class="loading-spinner small"></span>${t('catalog.paidScanning')}</div>`
        : paidExhausted && !hidden
          ? `<p class="load-more-end">${t('catalog.paidEnd')}</p>`
          : `<button class="ghost-button load-more-button" data-action="paid-more">${t('catalog.loadMore')} ${icon('arrow', 13)}</button>`;
      resultsBody = `<p class="result-note">${t('catalog.shown', { shown: String(visible.length), total: String(paidGames.length) })}</p>${renderGrid(visible, t('empty.noResults'), t('empty.filterHint'))}${loadMore}`;
    }
  } else if (!searchQuery && activeDiscoverySort === RECOMMENDED_SORT.id) {
    if (recommendationState.status === 'loading' || recommendationState.status === 'idle') {
      resultsBody = `<div class="search-loading"><span class="loading-spinner"></span><strong>${t('catalog.recommendedLoading')}</strong><small>${t('catalog.recommendedLoadingNote')}</small></div>`;
    } else if (recommendationState.status === 'empty') {
      resultsBody = `<div class="empty-state"><div class="empty-icon">${icon('sparkle', 20)}</div><h2>${t('catalog.recommendedEmptyTitle')}</h2><p>${t('catalog.recommendedEmptyBody')}</p><button class="ghost-button" data-nav="catalog">${t('catalog.recommendedOpenCatalog')}</button></div>`;
    } else if (recommendationState.status === 'error') {
      resultsBody = `<div class="empty-state"><div class="empty-icon">${icon('refreshCw', 20)}</div><h2>${t('catalog.recommendedEmptyTitle')}</h2><p>${t('catalog.recommendedEmptyBody')}</p><button class="ghost-button" data-action="refresh-recommendations">${icon('refreshCw', 13)} ${t('catalog.recommendedRefresh')}</button></div>`;
    } else {
      const note = `<p class="result-note">${t('catalog.recommendedNote', { count: String(list.length), seeds: String(recommendationState.seeds) })}</p>`;
      const refresh = `<button class="ghost-button recommendation-refresh" data-action="refresh-recommendations">${icon('refreshCw', 13)} ${t('catalog.recommendedRefresh')}</button>`;
      resultsBody = `<div class="recommendation-head">${note}${refresh}</div>${renderGrid(list, t('catalog.recommendedEmptyTitle'), t('catalog.recommendedEmptyBody'))}`;
    }
  } else if (isGenreSearchActive()) {
    if (genreStatus === 'loading') {
      resultsBody = `<div class="search-loading"><span class="loading-spinner"></span><strong>${t('catalog.loading')}</strong><small>${t('catalog.loadingNote')}</small></div>`;
    } else if (genreStatus === 'error') {
      resultsBody = `<p class="catalog-disclaimer"><strong>${t('catalog.errorTitle')}</strong> ${t('catalog.errorBody')}</p>${renderGrid(list, t('empty.noResults'), t('empty.filterHint'))}`;
    } else {
      // The term generator is endless: there is always another phrasing.
      const loadMoreGenre = genreLoadingMore ? `<div class="load-more-status"><span class="loading-spinner small"></span>${t('search.loadingMore')}</div>` : `<button class="ghost-button load-more-button" data-action="load-more-genre">${t('search.loadMore')} ${icon('arrow', 13)}</button>`;
      resultsBody = `<p class="result-note">${formatResultCount(list.length)}</p>${renderGrid(list, t('empty.noResults'), t('empty.filterHint'))}${loadMoreGenre}`;
    }
  } else if (!searchQuery && (discoveryStatus === 'loading' || discoveryStatus === 'loading-more')) {
    if (discoveryStatus === 'loading-more' && list.length) {
      const sortsForMore = catalogSorts();
      const hasNextSort = sortsForMore.length > 1;
      const loadMore = hasNextSort ? `<div class="load-more-status"><span class="loading-spinner small"></span>${t('search.loadingMore')}</div>` : '';
      resultsBody = `<p class="result-note">${formatResultCount(list.length)}</p>${renderGrid(list.slice(0, catalogVisibleCount), t('empty.noResults'), t('empty.filterHint'))}${loadMore}`;
    } else {
      resultsBody = `<div class="search-loading"><span class="loading-spinner"></span><strong>${t('catalog.loading')}</strong><small>${t('catalog.loadingNote')}</small></div>`;
    }
  } else {
    const cachedItems = discoveryCatalog[activeDiscoverySort]?.items || [];
    const offlineNote = discoveryStatus === 'error' ? `<p class="catalog-disclaimer"><strong>${t('catalog.errorTitle')}</strong> ${t('catalog.errorBody')}</p>` : '';
    const sortsForMore = catalogSorts();
    const hasNextSort = sortsForMore.length > 1;
    const loadMore = `<button class="ghost-button load-more-button" data-action="load-more">${t('catalog.loadMore')} ${icon('arrow', 13)}</button>`;
    const note = cachedItems.length ? `<p class="result-note">${formatResultCount(list.length)} · ${escapeHtml(discoverySortLabel(selectedSort))}</p>` : '';
    resultsBody = `${offlineNote}${note}${renderGrid(list.slice(0, catalogVisibleCount), t('empty.noResults'), t('empty.filterHint'))}${loadMore}`;
  }
  return `${pageHeading(searchQuery ? t('page.search.eyebrow') : t('page.catalog.eyebrow'), searchQuery ? t('page.search.title') : t('page.catalog.title'), queryLabel, `<button class="ghost-button" data-catalog-customize>${icon('sliders')} ${t('catalog.customize')}</button>`)}
    <div class="catalog-controls">${controls}</div>${resultsBody}
    ${isLiveSearch ? '' : discoveryStatus === 'loading' ? '' : `<p class="catalog-disclaimer"><strong>${t('catalog.disclaimerTitle')}</strong> ${t('catalog.disclaimer')}</p>`}`;
}

let favoritesVisibleCount = 24;
// Paid results are a separate list because Roblox has no paid catalog; it is
// declared early so allGames()/getGame() can resolve them by id.
const PAID_PAGE_SIZE = 12;
const PAID_REFRESH_MS = 90 * 1000;
let paidStatus = 'idle';
let paidRequestId = 0;
let paidVisibleCount = PAID_PAGE_SIZE;
let paidExhausted = false;
let paidScanning = false;
let paidLastScanAt = 0;

// Runs one scan pass. Pagination state is owned by showMorePaidGames, so the
// scan only replaces the underlying list.
async function scanPaidGames(append = false) {
  if (paidScanning) return;
  paidScanning = true;
  paidLastScanAt = Date.now();
  if (append) paidStatus = 'loading-more';
  else if (!paidGames.length) paidStatus = 'loading';
  if (currentView === 'catalog' && activeAccess === 'paid') renderPage();
  const requestId = ++paidRequestId;
  try {
    const response = await window.vortexDesktop?.getPaidGames?.({ force: true });
    if (requestId !== paidRequestId) return;
    // The handler returns { games, complete }; older builds returned a bare array.
    const list = Array.isArray(response) ? response : (Array.isArray(response?.games) ? response.games : []);
    paidExhausted = Array.isArray(response) ? false : response?.complete === true;
    if (list.length >= paidGames.length) paidGames = list;
    paidStatus = 'success';
  } catch {
    if (requestId !== paidRequestId) return;
    paidStatus = 'error';
  } finally {
    paidScanning = false;
  }
  if (currentView === 'catalog' && activeAccess === 'paid') renderPage();
}

// "Show more": reveal buffered games instantly, then keep scanning for new ones
// in the background so the list grows on every click.
function showMorePaidGames() {
  const hidden = paidGames.length - paidVisibleCount;
  if (hidden > 0) {
    paidVisibleCount = Math.min(paidGames.length, paidVisibleCount + PAID_PAGE_SIZE);
    renderPage();
  }
  // Nothing buffered (or the buffer just ran out): run the next scan.
  if (paidGames.length - paidVisibleCount <= 0) void scanPaidGames(true);
}

// Entry point used when the paid filter is selected.
async function loadPaidGames(force = false) {
  if (force) { await scanPaidGames(false); return; }

  // Paint the stored index immediately, then scan for more in the background.
  try {
    const fast = await window.vortexDesktop?.getPaidGames?.({ fast: true });
    const list = Array.isArray(fast) ? fast : (Array.isArray(fast?.games) ? fast.games : []);
    if (list.length) {
      paidGames = list;
      paidStatus = 'success';
      if (currentView === 'catalog' && activeAccess === 'paid') renderPage();
    }
  } catch { /* fall through to the scan */ }

  if (paidGames.length && Date.now() - paidLastScanAt < PAID_REFRESH_MS) return;
  await scanPaidGames(false);
}

function renderFavorites() {
  const list = allGames().filter((game) => favorites.has(game.id));
  const visible = list.slice(0, favoritesVisibleCount);
  const more = list.length > visible.length
    ? `<div class="load-more-row"><button class="ghost-button" data-action="favorites-more">${t('catalog.showMore', { count: String(Math.min(24, list.length - visible.length)) })}</button></div>`
    : '';
  return `${pageHeading(t('page.favorites.eyebrow'), t('page.favorites.title'), t('page.favorites.description'), list.length > 24 ? `<span class="heading-count">${t('catalog.shown', { shown: String(visible.length), total: String(list.length) })}</span>` : '')}
    ${renderGrid(visible, t('empty.favorites.title'), t('empty.favorites.body'), 'catalog')}${more}`;
}

let friendsCache = { at: 0, data: null };const FRIENDS_TTL = 30 * 1000;
let friendsLoading = false;
let friendsAutoDetectStarted = false;
// First visit to the Friends page with no username: detect the local Roblox
// account automatically, so the user never has to type anything.
async function autoDetectRobloxAccountOnce() {
  if (friendsAutoDetectStarted || preferences.robloxUsername) return;
  friendsAutoDetectStarted = true;
  try {
    const result = await window.vortexDesktop?.detectRobloxAccount();
    if (result && result.ok && result.account && result.account.name) {
      rememberRobloxAccount(result.account);
      preferences.robloxUsername = result.account.name;
      friendsCache = { at: 0, data: null };
      savePreferences();
      renderPage();
      renderFriendsDrawer();
      if (!document.getElementById('friends-drawer')?.hidden) void loadFriends(preferences.robloxUsername);
    }
  } catch { /* stay on the setup screen */ }
}

// Friends page as a card grid: one compact card per friend, richer info on
// hover (avatar, game, join) in a floating preview panel.
function renderFriends() {
  const username = String(preferences.robloxUsername || '').trim();
  const refreshAction = `<button class="ghost-button icon-only-button friends-refresh" data-action="refresh-friends" ${friendsLoading ? 'disabled' : ''} aria-label="${t('friends.refresh')}" title="${t('friends.refresh')}">${icon('refreshCw', 15)}</button>`;
  const heading = pageHeading(t('page.friends.eyebrow'), t('page.friends.title'), t('page.friends.description'), refreshAction);
  if (!username) {
    autoDetectRobloxAccountOnce();
    return `${heading}
      <section class="section-block"><div class="empty-state"><div class="empty-icon">${icon('users', 20)}</div><h2>${t('friends.setup.title')}</h2><p>${t('friends.setup.body')}</p><button class="primary-button" data-detect-username-home>${icon('users')} ${t('friends.detect')}</button> <button class="ghost-button" data-nav="settings">${icon('sliders')} ${t('friends.setup.action')}</button></div></section>`;
  }
  if (!friendsCache.data || Date.now() - friendsCache.at > FRIENDS_TTL) {
    loadFriends(username);
    if (!friendsCache.data) {
      return `${heading}
        <section class="section-block"><div class="friends-loading">${icon('users', 18)}<p>${t('friends.loading')}</p></div></section>`;
    }
  }
  const data = friendsCache.data;
  if (!data.ok) {
    const isNetworkError = ['network', 'auth-required'].includes(data.error);
    const errorTitle = isNetworkError ? t('friends.networkTitle') : t('friends.notFound.title');
    const errorBody = isNetworkError ? t('friends.networkBody') : t('friends.notFound.body');
    return `${heading}
      <section class="section-block"><div class="empty-state"><div class="empty-icon">${icon('users', 20)}</div><h2>${errorTitle}</h2><p>${errorBody}</p><button class="ghost-button" data-action="refresh-friends-drawer">${icon('refreshCw', 13)} ${t('friends.refresh')}</button></div></section>`;
  }
  const friends = data.friends || [];
  const playing = friends.filter((f) => f.presence === 'playing');
  const online = friends.filter((f) => f.presence === 'online');
  const offline = friends.filter((f) => f.presence === 'offline');
  const presenceNote = data.livePresence ? '' : `<div class="friends-presence-note">${icon('bell', 12)} ${t('friends.presenceOff')}</div>`;
  const card = (friend) => {
    const name = friend.displayName || friend.name || t('friends.unknown');
    const gameName = friend.presence === 'playing' ? (friend.gameName || t('friends.inGame')) : '';
    return `<article class="friend-card ${friend.presence}" data-friend-id="${escapeHtml(friend.id)}" data-friend-name="${escapeHtml(name)}" data-friend-avatar="${escapeHtml(friend.avatar || '')}" data-game-name="${escapeHtml(gameName)}" data-game-thumb="${escapeHtml(friend.presence === 'playing' ? friend.gameThumbnail || '' : '')}" tabindex="0">
      <span class="friend-avatar ${friend.avatar ? 'has-avatar' : ''}">${friend.avatar ? `<img src="${escapeHtml(friend.avatar)}" alt="" loading="eager" decoding="async" />` : escapeHtml(name[0].toLocaleUpperCase())}</span>
      <span class="friend-copy"><strong>${escapeHtml(name)}</strong><small>${friend.presence === 'playing' ? escapeHtml(gameName) : friend.presence === 'online' ? t('friends.online') : t('friends.offline')}</small></span>
      ${friend.presence === 'playing' && friend.placeId ? `<button class="friend-join" data-friend-join="${escapeHtml(friend.placeId)}" data-friend-game="${escapeHtml(friend.gameId || '')}" title="${t('friends.join')}">${icon('play', 12)}</button>` : ''}
    </article>`;
  };
  const section = (titleKey, list) => !list.length ? '' : `<p class="friends-group-title">${t(titleKey)} · ${list.length}</p>
    <div class="friends-grid">${list.map(card).join('')}</div>`;
  return `${heading}
    <section class="section-block">
      ${presenceNote}
      ${section('friends.groupPlaying', playing)}
      ${section('friends.groupOnline', online)}
      ${section('friends.groupOffline', offline)}
      ${friends.length ? '' : `<div class="empty-state"><div class="empty-icon">${icon('users', 20)}</div><h2>${t('friends.empty.title')}</h2><p>${t('friends.empty.body')}</p></div>`}
      <p class="catalog-disclaimer">${t('friends.disclaimer')}</p>
    </section>`;
}

async function loadFriends(username, force = false) {
  if (friendsLoading) return;
  if (!force && friendsCache.data && Date.now() - friendsCache.at <= FRIENDS_TTL) return;
  friendsLoading = true;
  renderFriendsDrawer();
  try {
    const data = await window.vortexDesktop?.listFriends(username);
    // Cache successes only: a transient network failure must retry on the
    // next visit instead of showing a stale error for 30 seconds.
    if (data && data.ok) friendsCache = { at: Date.now(), data };
    else friendsCache = { at: Date.now(), data: data || { ok: false, error: 'unavailable' } };
    if (data && data.ok) notifyFriendsInFavorites(data.friends);
    if (currentView === 'friends') renderPage();
  } catch {
    friendsCache = { at: Date.now(), data: { ok: false, error: 'network' } };
    if (currentView === 'friends') renderPage();
  } finally {
    friendsLoading = false;
    renderFriendsDrawer();
  }
}

function renderFriendsDrawer() {
  const content = document.getElementById('friends-drawer-content');
  if (!content) return;
  const username = String(preferences.robloxUsername || '').trim();
  if (!username) {
    content.innerHTML = `<div class="friends-drawer-empty"><span class="friends-drawer-empty-icon">${icon('users', 19)}</span><strong>${t('friends.setup.title')}</strong><p>${t('friends.setup.body')}</p><button class="primary-button" data-detect-username-home>${icon('users', 14)} ${t('friends.detect')}</button><button class="text-button" data-action="friends-drawer-view-all">${t('friends.setup.action')}</button></div>`;
    mountIcons(content);
    return;
  }
  if (friendsLoading || !friendsCache.data || Date.now() - friendsCache.at > FRIENDS_TTL) {
    content.innerHTML = `<div class="friends-drawer-loading"><span class="loading-spinner small"></span><span>${t('friends.loading')}</span></div><button class="text-button friends-drawer-all" data-action="friends-drawer-view-all">${t('activity.viewAllFriends')}</button>`;
    mountIcons(content);
    if (!friendsLoading) void loadFriends(username);
    return;
  }
  const data = friendsCache.data;
  if (!data?.ok) {
    const isNetworkError = ['network', 'auth-required'].includes(data?.error);
    content.innerHTML = `<div class="friends-drawer-empty"><span class="friends-drawer-empty-icon">${icon('users', 19)}</span><strong>${t(isNetworkError ? 'friends.networkTitle' : 'friends.notFound.title')}</strong><p>${t(isNetworkError ? 'friends.networkBody' : 'friends.notFound.body')}</p><button class="ghost-button" data-action="refresh-friends-drawer">${icon('refreshCw', 13)} ${t('friends.refresh')}</button></div>`;
    mountIcons(content);
    return;
  }
  const friends = Array.isArray(data.friends) ? data.friends : [];
  const groups = [
    ['friends.groupPlaying', friends.filter((friend) => friend.presence === 'playing')],
    ['friends.groupOnline', friends.filter((friend) => friend.presence === 'online')],
    ['friends.groupOffline', friends.filter((friend) => friend.presence !== 'playing' && friend.presence !== 'online')]
  ];
  const row = (friend) => {
    const name = friend.displayName || friend.name || t('friends.unknown');
    const status = friend.presence === 'playing' ? friend.gameName || t('friends.inGame') : friend.presence === 'online' ? t('friends.online') : t('friends.offline');
    return `<div class="friends-drawer-row ${friend.presence}"><span class="friend-avatar ${friend.avatar ? 'has-avatar' : ''}">${friend.avatar ? `<img src="${escapeHtml(friend.avatar)}" alt="" loading="lazy" decoding="async" />` : escapeHtml(name[0].toLocaleUpperCase())}<i></i></span><span class="friend-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(status)}</small></span>${friend.presence === 'playing' && friend.placeId ? `<button class="friend-join" data-friend-join="${escapeHtml(friend.placeId)}" data-friend-game="${escapeHtml(friend.gameId || '')}" title="${t('friends.join')}" aria-label="${t('friends.join')}">${icon('play', 12)}</button>` : ''}</div>`;
  };
  const groupMarkup = groups.filter(([, list]) => list.length).map(([title, list]) => `<section class="friends-drawer-group"><h3>${t(title)}<span>${list.length}</span></h3>${list.map(row).join('')}</section>`).join('');
  content.innerHTML = `${data.livePresence ? '' : `<p class="friends-presence-note">${icon('bell', 12)} ${t('friends.presenceOff')}</p>`}${friends.length ? groupMarkup : `<div class="friends-drawer-empty compact"><span class="friends-drawer-empty-icon">${icon('users', 18)}</span><strong>${t('friends.empty.title')}</strong><p>${t('friends.empty.body')}</p></div>`}<button class="text-button friends-drawer-all" data-action="friends-drawer-view-all">${t('activity.viewAllFriends')} ${icon('arrow', 12)}</button>`;
  mountIcons(content);
}

function openFriendsDrawer() {
  const drawer = document.getElementById('friends-drawer');
  const backdrop = document.getElementById('friends-drawer-backdrop');
  if (!drawer || !backdrop) return;
  drawer.hidden = false;
  backdrop.hidden = false;
  drawer.inert = false;
  requestAnimationFrame(() => {
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.querySelector('[data-action="toggle-friends-drawer"]')?.setAttribute('aria-expanded', 'true');
    drawer.querySelector('[data-action="close-friends-drawer"]')?.focus();
  });
  renderFriendsDrawer();
  const username = String(preferences.robloxUsername || '').trim();
  if (username && (!friendsCache.data || Date.now() - friendsCache.at > FRIENDS_TTL)) void loadFriends(username);
  else if (!username) autoDetectRobloxAccountOnce();
}

function closeFriendsDrawer() {
  const drawer = document.getElementById('friends-drawer');
  const backdrop = document.getElementById('friends-drawer-backdrop');
  if (!drawer || drawer.hidden) return;
  drawer.classList.remove('is-open');
  backdrop?.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.inert = true;
  document.querySelector('[data-action="toggle-friends-drawer"]')?.setAttribute('aria-expanded', 'false');
  window.setTimeout(() => {
    if (!drawer.classList.contains('is-open')) {
      drawer.hidden = true;
      if (backdrop) backdrop.hidden = true;
      document.querySelector('[data-action="toggle-friends-drawer"]')?.focus();
    }
  }, 230);
}

// Notifies once per friend/game pair when a friend starts a favourite of yours.
const notifiedFriendGames = new Set();

function notifyFriendsInFavorites(friends) {
  if (!preferences.friendFavoriteAlerts || !Array.isArray(friends) || !favorites.size) return;
  for (const friend of friends) {
    if (!friend || !friend.isOnline || !friend.playingPlaceId) continue;
    const placeId = String(friend.playingPlaceId);
    if (!favorites.has(placeId)) continue;
    const key = `${friend.id}:${placeId}`;
    if (notifiedFriendGames.has(key)) continue;
    notifiedFriendGames.add(key);
    const game = getGame(placeId);
    window.vortexDesktop?.notifyFriendPlaying?.({
      friend: friend.displayName || friend.name || t('friends.unknown'),
      game: game?.title || t('friends.someGame')
    });
  }
}

// ---- Endless loading for the default (genreless) catalog view ----
// Phase 1: Discover categories (5 of them, append mode).
// Phase 2: general omni-search with rotating popular queries.
const GENERAL_SEARCH_QUERIES = ['popular', 'roblox', 'games', 'new', 'fun', 'top', 'best', 'free', 'pvp', 'tycoon', 'obby', 'simulator', 'adventure', 'roleplay', 'action', 'survival', 'horror', 'parkour', 'boss', 'anime'];
let generalSearchIndex = 0;
let generalSearchToken = null;
let generalLoadingMore = false;
let generalRequestId = 0;

function markDiscoverySortUsed(sortId) {
  const acc = discoveryCatalog.__accumulated || { savedAt: Date.now(), items: [] };
  acc.usedSorts = [...new Set([...(acc.usedSorts || []), String(sortId)])];
  discoveryCatalog = { ...discoveryCatalog, __accumulated: acc };
}

function allDiscoverySortsUsed() {
  const sorts = discoverySorts.length ? discoverySorts : fallbackDiscoverySorts;
  const used = discoveryCatalog.__accumulated?.usedSorts || [];
  return sorts.every((sort) => used.includes(sort.id));
}

async function startGeneralSearchFallback() {
  const acc = discoveryCatalog.__accumulated || { savedAt: Date.now(), items: [] };
  acc.searchFallbackStarted = true;
  discoveryCatalog = { ...discoveryCatalog, __accumulated: acc };
  await appendGeneralSearch();
}

async function appendGeneralSearch() {
  const requestId = ++generalRequestId;
  generalLoadingMore = true;
  discoveryStatus = 'loading-more';
  renderPage();
  try {
    if (!window.vortexDesktop?.searchGames) throw new Error('desktop only');
    const query = GENERAL_SEARCH_QUERIES[generalSearchIndex % GENERAL_SEARCH_QUERIES.length];
    const response = await window.vortexDesktop.searchGames({
      query,
      pageToken: generalSearchToken
    });
    if (requestId !== generalRequestId) return;
    const received = (response.items || []).map((game) => normalizeDiscoveredGame(game, query));
    const acc = discoveryCatalog.__accumulated || { savedAt: Date.now(), items: [] };
    const knownIds = new Set(acc.items.map((game) => String(game.id)));
    const newItems = received.filter((game) => !knownIds.has(String(game.id)));
    if (!newItems.length && !response.nextPageToken) {
      // This query is exhausted: rotate to the next one and retry once.
      generalSearchIndex += 1;
      generalSearchToken = null;
      generalLoadingMore = false;
      if (generalSearchIndex < GENERAL_SEARCH_QUERIES.length * 3) { appendGeneralSearch(); return; }
    }
    acc.items = [...acc.items, ...newItems];
    discoveryCatalog = { ...discoveryCatalog, __accumulated: acc };
    generalSearchToken = response.nextPageToken || null;
    if (!generalSearchToken) { generalSearchIndex += 1; generalSearchToken = null; }
    generalLoadingMore = false;
    discoveryStatus = 'success';
    renderPage();
  } catch {
    if (requestId !== generalRequestId) return;
    generalLoadingMore = false;
    discoveryStatus = 'error';
    renderPage();
  }
}

// Loading is strictly manual: the "Показать ещё" button is the only trigger.
// No scroll listeners — the page never refreshes on its own.
function renderRecent() {
  const list = recentGames.map(getGame).filter(Boolean);
  return `${pageHeading(t('page.recent.eyebrow'), t('page.recent.title'), t('page.recent.description'))}
    ${renderGrid(list, t('empty.recent.title'), t('empty.recent.body'), 'catalog')}`;
}

function activityDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftActivityDate(dateKey, days) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date = new Date(year, month - 1, day + days, 12);
  return activityDateKey(date.getTime());
}

function activityDayDistance(fromKey, toKey) {
  if (!fromKey || !toKey) return Infinity;
  const toUtc = (key) => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(toKey) - toUtc(fromKey)) / 86400000);
}

function persistActivityData() {
  localStorage.setItem('vortex.activity', JSON.stringify(activityData));
}

function recordActivityTime(gameId, startedAt, seconds) {
  let cursor = Number(startedAt) || Date.now();
  let remaining = Math.max(0, Number(seconds) || 0);
  while (remaining > 0) {
    const dateKey = activityDateKey(cursor);
    const date = new Date(cursor);
    const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    const slice = Math.min(remaining, Math.max(1, Math.ceil((nextDay - cursor) / 1000)));
    const day = activityData.days[dateKey] || (activityData.days[dateKey] = { games: {} });
    day.games ||= {};
    day.games[String(gameId)] = (Number(day.games[String(gameId)]) || 0) + slice;
    cursor += slice * 1000;
    remaining -= slice;
  }
  completeDailyActivity();
  updateActivityAchievements();
  persistActivityData();
}

function activityQualifiedGames(dateKey = activityDateKey()) {
  const games = activityData.days[dateKey]?.games || {};
  const threshold = ACTIVITY_GAME_MINUTES * 60;
  return Object.entries(games).filter(([, seconds]) => Number(seconds) >= threshold).map(([id]) => id);
}

function activityRecoveryAvailable() {
  const { lastCompletedDate, recoveryUsed } = activityData.streak;
  const today = activityDateKey();
  return !recoveryUsed && activityData.streak.current > 0 && activityDayDistance(lastCompletedDate, today) === 2;
}

function completeDailyActivity() {
  if (activityQualifiedGames().length < ACTIVITY_DAILY_GAMES) return false;
  const today = activityDateKey();
  const streak = activityData.streak;
  if (streak.lastCompletedDate === today) return false;
  const distance = activityDayDistance(streak.lastCompletedDate, today);
  if (distance === 2 && activityRecoveryAvailable()) return false;
  streak.current = distance === 1 ? Number(streak.current || 0) + 1 : 1;
  streak.best = Math.max(Number(streak.best || 0), streak.current);
  streak.lastCompletedDate = today;
  if (distance !== 1) streak.recoveryUsed = false;
  return true;
}

const ACTIVITY_ACHIEVEMENTS = [
  { id: 'first-day', icon: 'sparkle', title: 'activity.achievement.first', body: 'activity.achievement.firstBody', progress: () => Math.min(1, Number(activityData.streak.best > 0)) },
  { id: 'three-day-streak', icon: 'activity', title: 'activity.achievement.three', body: 'activity.achievement.threeBody', progress: () => Math.min(3, Number(activityData.streak.best || 0)), target: 3 },
  { id: 'seven-day-streak', icon: 'trophy', title: 'activity.achievement.seven', body: 'activity.achievement.sevenBody', progress: () => Math.min(7, Number(activityData.streak.best || 0)), target: 7 },
  { id: 'five-games', icon: 'compass', title: 'activity.achievement.explorer', body: 'activity.achievement.explorerBody', progress: () => Math.min(5, Object.values(playStats).filter((entry) => Number(entry?.seconds) > 0).length), target: 5 },
  { id: 'ten-hours', icon: 'clock', title: 'activity.achievement.hours', body: 'activity.achievement.hoursBody', progress: () => Math.min(600, Math.floor(Object.values(playStats).reduce((sum, entry) => sum + (Number(entry?.seconds) || 0), 0) / 60)), target: 600 }
];

function updateActivityAchievements() {
  let changed = false;
  for (const achievement of ACTIVITY_ACHIEVEMENTS) {
    const target = achievement.target || 1;
    if (achievement.progress() >= target && !activityData.achievements[achievement.id]) {
      activityData.achievements[achievement.id] = new Date().toISOString();
      changed = true;
    }
  }
  return changed;
}

function formatActivityMinutes(seconds) {
  const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  if (minutes < 60) return `${minutes}${t('time.minutes')}`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}${t('time.hours')}${remainder ? ` ${remainder}${t('time.minutes')}` : ''}`;
}

function renderActivity() {
  const today = activityDateKey();
  completeDailyActivity();
  updateActivityAchievements();
  persistActivityData();
  const day = activityData.days[today] || { games: {} };
  const threshold = ACTIVITY_GAME_MINUTES * 60;
  const allGames = Object.entries(day.games || {}).sort((a, b) => Number(b[1]) - Number(a[1]));
  const qualified = activityQualifiedGames(today);
  const completed = qualified.length >= ACTIVITY_DAILY_GAMES;
  const streakDistance = activityDayDistance(activityData.streak.lastCompletedDate, today);
  const currentStreak = streakDistance <= 1 || activityRecoveryAvailable() ? activityData.streak.current : 0;
  const gameRows = allGames.length ? allGames.map(([id, seconds]) => {
    const game = getGame(id);
    const title = game?.title || t('activity.unknownGame');
    const progress = Math.min(100, Math.round(Number(seconds) / threshold * 100));
    return `<div class="activity-game-row"><span class="activity-game-icon">${game?.thumbnail ? `<img src="${escapeHtml(safeThumbnail(game.thumbnail))}" alt="" />` : icon('gamepad', 16)}</span><span class="activity-game-copy"><strong>${escapeHtml(title)}</strong><small>${formatActivityMinutes(seconds)} / ${ACTIVITY_GAME_MINUTES}${t('time.minutes')}</small></span><span class="activity-game-progress"><i style="--progress:${progress}%"></i></span><span class="activity-game-check ${Number(seconds) >= threshold ? 'is-complete' : ''}">${Number(seconds) >= threshold ? icon('check', 13) : `${progress}%`}</span></div>`;
  }).join('') : `<div class="activity-empty-note">${icon('gamepad', 16)}<span>${t('activity.emptyGames')}</span></div>`;
  const achievements = ACTIVITY_ACHIEVEMENTS.map((achievement) => {
    const target = achievement.target || 1;
    const value = Math.min(target, achievement.progress());
    const earned = Boolean(activityData.achievements[achievement.id]);
    return `<article class="achievement-card ${earned ? 'is-earned' : ''}"><span class="achievement-icon">${icon(achievement.icon, 17)}</span><span class="achievement-copy"><strong>${t(achievement.title)}</strong><small>${t(achievement.body)}</small><em>${earned ? t('activity.earned') : `${value} / ${target}`}</em></span></article>`;
  }).join('');
  return `${pageHeading(t('page.activity.eyebrow'), t('page.activity.title'), t('page.activity.description'))}
    <section class="activity-hero"><div class="activity-hero-copy"><span class="activity-eyebrow">${icon('sparkle', 13)} ${t('activity.today')}</span><h2>${completed ? t('activity.goalComplete') : t('activity.goalTitle')}</h2><p>${t('activity.goalBody', { games: ACTIVITY_DAILY_GAMES, minutes: ACTIVITY_GAME_MINUTES })}</p><div class="activity-goal-track"><i style="--progress:${Math.min(100, Math.round(qualified.length / ACTIVITY_DAILY_GAMES * 100))}%"></i></div><small>${t('activity.gamesProgress', { done: Math.min(ACTIVITY_DAILY_GAMES, qualified.length), total: ACTIVITY_DAILY_GAMES })}</small></div><div class="activity-streak"><span class="activity-streak-icon">${icon('activity', 23)}</span><strong>${currentStreak}</strong><span>${t('activity.streakDays')}</span><small>${t('activity.bestStreak', { count: activityData.streak.best })}</small></div></section>
    ${activityRecoveryAvailable() ? `<section class="activity-recovery"><span>${icon('refreshCw', 16)} ${t('activity.recoveryHint')}</span><button class="ghost-button" data-action="restore-activity-streak">${t('activity.recoveryAction')}</button></section>` : ''}
    <div class="activity-dashboard-grid"><section class="settings-card activity-daily-card"><div class="settings-card-head"><div><h2>${t('activity.dailyTitle')}</h2><p>${t('activity.dailyBody')}</p></div>${icon('crosshair', 18)}</div><div class="activity-game-list">${gameRows}</div></section><section class="settings-card activity-achievements"><div class="settings-card-head"><div><h2>${t('activity.achievementsTitle')}</h2><p>${t('activity.achievementsBody')}</p></div>${icon('trophy', 18)}</div><div class="achievement-grid">${achievements}</div></section></div>`;
}

const PLANS_STAGE_LABELS = { research: 'plans.filter.research', design: 'plans.filter.design', dev: 'plans.filter.dev', idea: 'plans.filter.idea' };
let roadmapItems = null;
let roadmapLoadGeneration = 0;

function renderPlans() {
  const items = Array.isArray(roadmapItems) ? roadmapItems : [];
  return `${pageHeading(t('page.plans.eyebrow'), t('page.plans.title'), t('page.plans.description'))}
    <div class="roadmap-grid">${items.map((plan) => {
      const localized = (value) => typeof value === 'string' ? value : value?.[preferences.language] || value?.ru || value?.en || '';
      const stage = Object.hasOwn(PLANS_STAGE_LABELS, plan.stage) ? plan.stage : 'idea';
      const iconName = /^[a-zA-Z0-9_-]{1,32}$/.test(String(plan.icon || '')) ? plan.icon : 'flag';
      return `<article class="roadmap-card" data-stage="${stage}"><div class="roadmap-icon">${icon(iconName)}</div><h3>${escapeHtml(localized(plan.title))}</h3><p>${escapeHtml(localized(plan.body))}</p><span class="roadmap-state">${t(PLANS_STAGE_LABELS[stage])}</span></article>`;
    }).join('') || `<p class="catalog-disclaimer">${t(roadmapItems === null ? 'plans.loading' : 'plans.empty')}</p>`}</div>`;
}

async function loadRoadmap() {
  if (!window.vortexDesktop?.listPlans) return;
  const generation = ++roadmapLoadGeneration;
  try {
    const result = await window.vortexDesktop.listPlans();
    if (generation !== roadmapLoadGeneration || currentView !== 'plans') return;
    roadmapItems = Array.isArray(result?.items) ? result.items : [];
    pageContent.innerHTML = renderPlans();
    mountIcons(pageContent);
  } catch { /* The bundled site/plans.json remains available when offline. */ }
}

function settingsTabs() {
  const tabs = [
    ['home', 'home'], ['accent', 'palette'], ['cards', 'layout'], ['effects', 'motion'],
    ['interface', 'monitor'], ['general', 'settings'], ['integrations', 'sparkles'],
    ['data', 'database'], ['version', 'refreshCw']
  ];
  return `<nav class="settings-tabs" aria-label="${t('settings.tabNavigation')}">${tabs.map(([key, iconName]) => `<button class="settings-tab ${preferences.settingsTab === key ? 'active' : ''}" data-settings-tab="${key}" ${preferences.settingsTab === key ? 'aria-current="page"' : ''}><span>${icon(iconName)}</span>${t(`settings.tab.${key}`)}</button>`).join('')}</nav>`;
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
      <div class="setting-line home-setting-line"><div class="setting-label"><strong>${t('settings.home.gameCount')}</strong></div><div class="segmented">${[4, 6, 8].map((count) => `<button class="segment ${Number(preferences.homeGameCount) === count ? 'active' : ''}" data-pref="homeGameCount" data-value="${count}" data-preview="homeCount:${count}" data-preview-label="${escapeHtml(t('settings.home.gameCount'))}">${count}</button>`).join('')}</div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.home.layout')}</strong><small>${t('settings.home.layoutBody')}</small></div><div class="segmented">${[['balanced', t('settings.home.layoutBalanced')], ['spotlight', t('settings.home.layoutSpotlight')], ['library', t('settings.home.layoutLibrary')]].map(([value, label]) => `<button class="segment ${preferences.homeLayout === value ? 'active' : ''}" data-pref="homeLayout" data-value="${value}" ${previewAttr('homeLayout', value, label)}>${label}</button>`).join('')}</div></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.home.sections')}</h2><p>${t('settings.home.sectionsBody')}</p></div>${icon('layout', 18)}</div>
      <p class="ui-section-title">${t('home.widgets.orderTitle')}</p>
      <div class="ui-list home-widget-list" data-ui-order data-home-widget-config>
        ${homeWidgetOrder().map((key, index) => {
          const widget = HOME_WIDGETS.find((w) => w.key === key);
          if (!widget) return '';
          return `<div class="ui-row" data-ui-row="widget:${key}" data-widget-row="${key}" data-widget-visible="${homeWidgetVisible(key)}" data-preview="homeWidget:${key}:${homeWidgetVisible(key) ? 'on' : 'off'}" data-preview-label="${escapeHtml(t(widget.titleKey))}" role="listitem" tabindex="0" aria-roledescription="${t('settings.ui.dragHint')}">
            <span class="ui-row-grip" aria-hidden="true">${icon('grip', 14)}</span>
            <span class="ui-row-icon">${icon(widget.icon, 14)}</span>
            <span class="ui-row-copy"><strong>${t(widget.titleKey)}</strong><small>${t(widget.bodyKey)}</small></span>
            <button class="ui-row-handle" data-widget-move="${key}" data-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="${t('settings.ui.moveUp')}">${icon('navUp', 12)}</button>
            <button class="ui-row-handle" data-widget-move="${key}" data-direction="1" ${index === homeWidgetOrder().length - 1 ? 'disabled' : ''} aria-label="${t('settings.ui.moveDown')}">${icon('navDown', 12)}</button>
            <button class="toggle" role="switch" aria-checked="${homeWidgetVisible(key)}" data-widget-visible-toggle="${key}" aria-label="${t('home.widgets.visibility')}" title="${t('home.widgets.visibility')}"></button>
          </div>`;
        }).join('')}
      </div>
      <button class="text-button theme-reset" data-action="reset-home-widgets">${t('home.widgets.reset')}</button>
      <p class="catalog-disclaimer">${t('settings.home.hint')}</p>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.home.textTitle')}</h2><p>${t('settings.home.textBody')}</p></div>${icon('tag', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.home.textScale')}</strong><small>${t('settings.home.textScaleHint')}</small></div><label class="range-control"><input type="range" min="0.8" max="1.6" step="0.05" value="${preferences.homeSectionScale || 1}" data-home-section-scale /><span class="range-value" data-home-section-scale-value>${Math.round((preferences.homeSectionScale || 1) * 100)}%</span></label></div>
      <div class="section-title-fields">
        ${HOME_WIDGETS.filter((widget) => widget.key !== 'hero').map((widget) => `<label class="home-greeting-field section-title-field"><span>${t(widget.titleKey)}</span><input type="text" maxlength="36" value="${escapeHtml((preferences.homeSectionTitles && preferences.homeSectionTitles[widget.key]) || '')}" placeholder="${t(widget.titleKey)}" data-widget-title="${widget.key}" /></label>`).join('')}
      </div>
      <button class="text-button theme-reset" data-action="reset-section-titles">${t('settings.home.resetTitles')}</button>
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
  const themeDefaults = { dark: { background: '#0d1012', surface: '#14181a' }, light: { background: '#f5f6f7', surface: '#ffffff' }, oled: { background: '#030305', surface: '#08090c' } }[preferences.theme];
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
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.theme.glass')}</strong><small>${t('settings.theme.glassHint')}</small></div><label class="range-control"><input type="range" min="0" max="100" value="${preferences.glassStrength}" data-glass-strength /><span class="range-value" data-glass-strength-value>${preferences.glassStrength}%</span></label></div>
       <div class="setting-line"><div class="setting-label"><strong>${t('settings.theme.schedule')}</strong><small>${t('settings.theme.scheduleHint')}</small></div><div class="segmented">${[['manual',t('settings.theme.scheduleManual')],['system',t('settings.theme.scheduleSystem')],['clock',t('settings.theme.scheduleClock')]].map(([v,l])=>`<button class="segment ${preferences.themeSchedule===v?'active':''}" data-pref="themeSchedule" data-value="${v}">${l}</button>`).join('')}</div></div>
       <div class="theme-io"><button class="ghost-button" data-action="export-theme">${t('settings.themeExport')}</button><button class="ghost-button" data-action="import-theme">${t('settings.themeImport')}</button><input type="file" accept=".json,application/json" data-theme-file hidden /></div>
      <button class="text-button theme-reset" data-action="reset-theme-colors">${t('settings.themeReset')}</button>
    </section>` + renderWallpaperCard();
}

function renderWallpaperCard() {
  // Native components throughout: setting-line rows, range-control sliders,
  // button.toggle switches — identical to every other settings section.
  const hasWallpaper = Boolean(preferences.themeWallpaper);
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.wallpaper.title')}</h2><p>${t('settings.wallpaper.body')}</p></div>${icon('palette', 18)}</div>
      <input type="file" accept="image/*" data-wallpaper-file hidden />
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.wallpaper.pick')}</strong><small>${hasWallpaper ? t('settings.wallpaper.removeHint') : t('settings.wallpaper.pickHint')}</small></div>
        <span class="data-actions"><button class="ghost-button" data-action="pick-wallpaper">${icon('upload', 13)} ${t('settings.wallpaper.pick')}</button>${hasWallpaper ? ` <button class="ghost-button" data-action="remove-wallpaper">${icon('close', 13)} ${t('settings.wallpaper.remove')}</button>` : ''}</span></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.wallpaper.blur')}</strong><small>${t('settings.wallpaper.blurHint')}</small></div><label class="range-control"><input type="range" min="0" max="40" value="${preferences.themeWallpaperBlur}" data-wallpaper-blur ${hasWallpaper ? '' : 'disabled'} /><span class="range-value" data-wallpaper-blur-value>${preferences.themeWallpaperBlur}px</span></label></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.wallpaper.dim')}</strong><small>${t('settings.wallpaper.dimHint')}</small></div><label class="range-control"><input type="range" min="0" max="90" value="${preferences.themeWallpaperDim}" data-wallpaper-dim ${hasWallpaper ? '' : 'disabled'} /><span class="range-value" data-wallpaper-dim-value>${preferences.themeWallpaperDim}%</span></label></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.wallpaper.grain')}</strong><small>${t('settings.wallpaper.grainHint')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.themeGrain}" data-wallpaper-grain-toggle aria-label="${t('settings.wallpaper.grain')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.wallpaper.grainStrength')}</strong><small>${t('settings.wallpaper.grainStrengthHint')}</small></div><label class="range-control"><input type="range" min="1" max="25" value="${Math.round((Number(preferences.themeGrainStrength) || 0.05) * 100)}" data-wallpaper-grain-strength ${preferences.themeGrain ? '' : 'disabled'} /><span class="range-value" data-wallpaper-grain-strength-value>${Math.round((Number(preferences.themeGrainStrength) || 0.05) * 100)}%</span></label></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.wallpaper.vignette')}</strong><small>${t('settings.wallpaper.vignetteHint')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.themeVignette}" data-wallpaper-vignette-toggle aria-label="${t('settings.wallpaper.vignette')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.wallpaper.vignetteStrength')}</strong><small>${t('settings.wallpaper.vignetteStrengthHint')}</small></div><label class="range-control"><input type="range" min="10" max="250" value="${Math.round((Number(preferences.themeVignetteStrength) || 1) * 100)}" data-wallpaper-vignette-strength ${preferences.themeVignette ? '' : 'disabled'} /><span class="range-value" data-wallpaper-vignette-strength-value>${Math.round((Number(preferences.themeVignetteStrength) || 1) * 100)}%</span></label></div>
  </section>`;
}

function renderCardSettings() {
  // Native components: setting-line rows, range-control sliders, button.toggle
  // switches — matches every other settings card exactly.
  const cardFlag = (flagKey, titleKey, bodyKey) => `<div class="setting-line"><div class="setting-label"><strong>${t(titleKey)}</strong><small>${t(bodyKey)}</small></div><button class="toggle" role="switch" aria-checked="${preferences[flagKey]}" data-card-flag-toggle="${flagKey}" data-preview="cardFlag:${flagKey}:${preferences[flagKey] ? 'off' : 'on'}" data-preview-label="${escapeHtml(t(titleKey))}" aria-label="${t(titleKey)}"></button></div>`;
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.cardTuning.title')}</h2><p>${t('settings.cardTuning.body')}</p></div>${icon('grid', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.cardTuning.size')}</strong><small>${t('settings.cardTuning.sizeHint')}</small></div><label class="range-control"><input type="range" min="0.7" max="1.3" step="0.05" value="${preferences.cardSize}" data-card-size data-preview="cardSize:${preferences.cardSize}" data-preview-label="${escapeHtml(t('settings.cardTuning.size'))}" /><span class="range-value" data-card-size-value>${Math.round(preferences.cardSize * 100)}%</span></label></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.cardTuning.radius')}</strong><small>${t('settings.cardTuning.radiusHint')}</small></div><label class="range-control"><input type="range" min="0" max="20" value="${preferences.cardRadius}" data-card-radius data-preview="cardRadius:${preferences.cardRadius}" data-preview-label="${escapeHtml(t('settings.cardTuning.radius'))}" /><span class="range-value" data-card-radius-value>${preferences.cardRadius}px</span></label></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.cardTuning.aspect')}</strong><small>${t('settings.cardTuning.aspectHint')}</small></div><div class="segmented">${[['auto',t('settings.cardTuning.aspectAuto')],['square',t('settings.cardTuning.aspectSquare')],['wide',t('settings.cardTuning.aspectWide')],['portrait',t('settings.cardTuning.aspectPortrait')]].map(([value,label])=>`<button class="segment ${preferences.cardAspect === value ? 'active' : ''}" data-pref="cardAspect" data-value="${value}" ${previewAttr('cardAspect',value,label)}>${label}</button>`).join('')}</div></div>
      ${cardFlag('cardShowDescription', 'settings.cardTuning.description', 'settings.cardTuning.descriptionHint')}
      ${cardFlag('cardShowLikes', 'settings.cardTuning.likes', 'settings.cardTuning.likesHint')}
      ${cardFlag('cardShowPlaytime', 'settings.cardTuning.playtime', 'settings.cardTuning.playtimeHint')}
      ${cardFlag('cardShowGenre', 'settings.cardTuning.genre', 'settings.cardTuning.genreHint')}
  </section>
  <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.catalog.title')}</h2><p>${t('settings.catalog.body')}</p></div>${icon('layout', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.catalog.groupByGenre')}</strong><small>${t('settings.catalog.groupByGenreBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.catalogGroupByGenre}" data-toggle="catalogGroupByGenre" aria-label="${t('settings.catalog.groupByGenre')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.catalog.defaultView')}</strong><small>${t('settings.catalog.defaultViewBody')}</small></div><div class="segmented"><button class="segment ${preferences.catalogView === 'grid' ? 'active' : ''}" data-pref="catalogView" data-value="grid" ${previewAttr('catalogView','grid',t('catalog.gridView'))}>${t('catalog.gridView')}</button><button class="segment ${preferences.catalogView === 'list' ? 'active' : ''}" data-pref="catalogView" data-value="list" ${previewAttr('catalogView','list',t('catalog.listView'))}>${t('catalog.listView')}</button></div></div>
  </section>
  <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.cardPreview.title')}</h2><p>${t('settings.cardPreview.body')}</p></div>${icon('gamepad', 18)}</div>
      <div class="card-tuning-preview">
        <article class="game-card preview-card" style="--game-color: var(--accent)">
          <div class="game-cover art-live"><span class="cover-shine"></span></div>
          <div class="game-info">
            <div class="game-title-row"><h3 class="game-title">${t('settings.cardPreview.name')}</h3></div>
            <p class="game-description" ${preferences.cardShowDescription ? '' : 'hidden'}>${t('settings.cardPreview.description')}</p>
            <div class="game-live-stats" ${preferences.cardShowLikes ? '' : 'hidden'}><span>${icon('users', 12)} ${t('search.players', { count: '2.4K' })}</span><span>${icon('thumb', 12)} ${t('search.likes', { percent: 96 })}</span></div>
            <div class="game-card-footer"><span class="game-category" ${preferences.cardShowGenre ? '' : 'hidden'}><i></i>${t('settings.cardPreview.genre')}</span><span class="card-playtime" ${preferences.cardShowPlaytime ? '' : 'hidden'}>${icon('clock', 11)} ${t('settings.cardPreview.playtime')}</span></div>
          </div>
        </article>
        <p class="preview-note"><strong>${t('settings.cardPreview.liveTitle')}</strong><small>${t('settings.cardPreview.liveBody')}</small></p>
      </div>
  </section>`;
}

function refreshCardPreview() {
  // Live-update the preview card in place: size, radius and flag-dependent rows.
  const card = pageContent.querySelector('.card-tuning-preview .preview-card');
  if (!card) return;
  const cover = card.querySelector('.game-cover');
  if (cover) {
    const radius = preferences.customCardRadius ? preferences.cardRadius : 12;
    cover.style.borderRadius = `calc(${radius}px - 3px) calc(${radius}px - 3px) 0 0`;
  }
  card.querySelector('.game-live-stats')?.toggleAttribute('hidden', !preferences.cardShowLikes);
  card.querySelector('.game-description')?.toggleAttribute('hidden', !preferences.cardShowDescription);
  card.querySelector('.game-category')?.toggleAttribute('hidden', !preferences.cardShowGenre);
  card.querySelector('.card-playtime')?.toggleAttribute('hidden', !preferences.cardShowPlaytime);
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
function previewMarkup(type, value, label, detail = '') {
  if (type === 'pageTransition') {
    const variant = { fade: 'fade', slide: 'slide', zoom: 'zoom', none: 'none' }[value] || 'fade';
    return `<div class="hover-preview-mock page-transition-mock ${variant}"><span class="mock-page"><b></b><b class="short"></b></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'cardAnimation') {
    const variant = { rise: 'rise', fade: 'fade', pop: 'pop', none: 'none' }[value] || 'rise';
    return `<div class="hover-preview-mock card-animation-mock ${variant}"><i></i><i></i><i></i></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'animationSpeed') return previewAnimationSpeed(value, label);
  if (type === 'animationEasing') return previewAnimationEasing(value, label);
  if (type === 'glow') {
    const strength = Math.max(0, Math.min(100, Number(value) || 0));
    return `<div class="hover-preview-mock glow-preview-mock" style="--preview-glow:${strength / 100}"><i></i><b></b><span></span></div><span class="hover-preview-label">${escapeHtml(label)} · ${strength}%</span>`;
  }
  if (type === 'animationDuration') {
    const duration = Math.max(50, Math.min(200, Number(value) || 100));
    return `<div class="hover-preview-mock duration-preview-mock"><i style="--preview-duration:${duration / 100}s"></i><b style="--preview-duration:${duration / 100}s"></b></div><span class="hover-preview-label">${escapeHtml(label)} · ${duration}%</span>`;
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
    return previewUiPart(value, label, detail);
  }
  if (type === 'cardAspect') {
    return `<div class="hover-preview-mock aspect-mock aspect-${escapeHtml(value)}"><i></i><i></i><i></i></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'cardSize' || type === 'cardRadius') {
    const width = type === 'cardSize' ? Math.max(68, Math.min(100, Math.round(Number(value || 1) * 78))) : 82;
    const radius = type === 'cardRadius' ? Math.max(2, Math.min(18, Number(value || 0))) : Number(preferences.cardRadius || 12);
    return `<div class="hover-preview-mock card-tuning-mock" style="--mock-width:${width}%;--mock-radius:${radius}px"><i></i><b></b><span></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'cardFlag') {
    return `<div class="hover-preview-mock card-flag-mock ${detail === 'off' ? 'is-off' : ''}"><i></i><b></b><span></span><em></em></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'homeCount') {
    const count = Math.max(3, Math.min(8, Number(value) || 4));
    return `<div class="hover-preview-mock grid-mock" style="--mock-columns:${count > 6 ? 4 : count > 4 ? 3 : 2}">${'<i></i>'.repeat(count)}</div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'catalogView') {
    return `<div class="hover-preview-mock catalog-view-mock ${value === 'list' ? 'is-list' : ''}"><i></i><i></i><i></i><i></i></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'homeWidget') {
    return `<div class="hover-preview-mock widget-preview-mock ${detail === 'off' ? 'is-off' : 'is-on'}"><i></i><b></b><span></span><span></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'motion') {
    return `<div class="hover-preview-mock motion-preview-mock ${value === 'off' ? 'is-off' : ''}"><i></i><b></b><span></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'contrast') {
    return `<div class="hover-preview-mock contrast-preview-mock ${value === 'on' ? 'is-strong' : ''}"><i></i><b></b><span></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'uiFont') {
    return `<div class="hover-preview-mock font-preview-mock ${value === 'classic' ? 'is-classic' : ''}"><strong>Vortex</strong><span>Roblox · ${escapeHtml(label)}</span><i></i></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  return '';
}

// Interface part previews: each toggle shows its own corner of the launcher with the
// part highlighted, so every option is visually distinct.
function previewUiPart(part, label, state = '') {
  const active = state ? state === 'on' : Boolean(preferences[part]);
  const shell = (rows, current = active) => `<div class="hover-preview-mock ui-part-mock ui-${escapeHtml(part)} ${current ? 'is-on' : 'is-off'}">${rows}</div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  const spark = '<span class="mock-ui-part"><i></i></span>';
  switch (part) {
    case 'uiSidebarTip':
      return shell('<span class="mock-ui-nav"></span><span class="mock-ui-nav"></span><span class="mock-ui-tip"></span>');
    case 'uiTopbarSearch':
      return shell('<span class="mock-ui-topbar"><b class="mock-crumb"></b><b class="mock-search"></b><b class="mock-bell"></b></span>');
    case 'uiBreadcrumb':
      return shell('<span class="mock-ui-topbar"><b class="mock-crumb wide"></b><b class="mock-bell"></b></span>');
    case 'uiNotifications':
      return shell('<span class="mock-ui-topbar"><b class="mock-crumb wide"></b><b class="mock-bell"></b></span>');
    case 'uiUpdateBanner':
      return shell('<span class="mock-ui-banner"><i></i><b></b></span>');
    case 'sidebarAutoHide':
      return shell('<span class="mock-ui-nav"></span><span class="mock-ui-nav"></span><span class="mock-ui-arrow"></span>');
    default:
      return shell(spark);
  }
}

// Speed preview: three dots that travel the same track at the chosen tempo.
function previewAnimationSpeed(value, label) {
  const duration = { slow: 2.1, normal: 1.3, fast: 0.7 }[value] || 1.3;
  return `<div class="hover-preview-mock speed-mock speed-${escapeHtml(value)}"><span class="mock-track"><i style="animation-duration:${duration}s"></i></span><span class="mock-track"><i style="animation-duration:${duration}s;animation-delay:.12s"></i></span><span class="mock-track"><i style="animation-duration:${duration}s;animation-delay:.24s"></i></span><span class="mock-track"><i style="animation-duration:${duration}s;animation-delay:.36s"></i></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
}

// Easing preview: one square jumping along a path with the real timing curve.
function previewAnimationEasing(value, label) {
  const curve = { smooth: 'cubic-bezier(.2,.72,.25,1)', spring: 'cubic-bezier(.16,1.2,.3,1)', linear: 'linear' }[value] || 'cubic-bezier(.2,.72,.25,1)';
  return `<div class="hover-preview-mock easing-mock"><span class="mock-ease-track"><i style="animation-timing-function:${curve}"></i><b style="animation-timing-function:${curve};animation-delay:.25s"></b></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
}

function previewTarget(event) {
  const path = event.composedPath?.() || [];
  const fromPath = path.find((node) => node instanceof Element && node.matches('[data-preview]'));
  if (fromPath) return fromPath;
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest?.('[data-preview]') || null;
}

let activePreviewTarget = null;
let previewHideTimer = 0;
function hideHoverPreview() {
  window.clearTimeout(previewHideTimer);
  const layer = document.getElementById('hover-preview-layer');
  if (layer) layer.hidden = true;
  activePreviewTarget = null;
}

function showHoverPreview(target) {
  if (!target?.isConnected) return;
  window.clearTimeout(previewHideTimer);
  const [type, value = '', detail = ''] = String(target.dataset.preview || '').split(':');
  const label = target.dataset.previewLabel || target.textContent.trim();
  const markup = previewMarkup(type, value, label, detail);
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

document.addEventListener('pointerover', (event) => {
  const target = previewTarget(event);
  if (!target) return;
  if (target.contains(event.relatedTarget)) return;
  if (activePreviewTarget === target) return;
  activePreviewTarget = target;
  showHoverPreview(target);
});
document.addEventListener('pointerout', (event) => {
  const target = previewTarget(event);
  if (!target || target.contains(event.relatedTarget)) return;
  if (activePreviewTarget !== target) return;
  if (target.contains(document.activeElement)) return;
  if (previewTarget({ target: event.relatedTarget, composedPath: () => [event.relatedTarget] })) return;
  window.clearTimeout(previewHideTimer);
  previewHideTimer = window.setTimeout(() => {
    if (!activePreviewTarget?.matches(':hover') && !activePreviewTarget?.contains(document.activeElement)) hideHoverPreview();
  }, 70);
});
document.addEventListener('focusin', (event) => {
  const target = previewTarget(event);
  if (!target) return;
  activePreviewTarget = target;
  showHoverPreview(target);
});
document.addEventListener('focusout', (event) => {
  const target = previewTarget(event);
  if (!target || target.contains(event.relatedTarget) || target.matches(':hover')) return;
  if (activePreviewTarget !== target) return;
  hideHoverPreview();
});
document.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  const target = previewTarget(event);
  if (target && target !== activePreviewTarget) {
    activePreviewTarget = target;
    showHoverPreview(target);
  } else if (!target && activePreviewTarget && !activePreviewTarget.contains(document.activeElement)) {
    hideHoverPreview();
  } else if (activePreviewTarget && !activePreviewTarget.isConnected) {
    hideHoverPreview();
  }
});
document.addEventListener('scroll', hideHoverPreview, true);
window.addEventListener('resize', () => activePreviewTarget?.isConnected ? showHoverPreview(activePreviewTarget) : hideHoverPreview());

function renderEffectSettings() {
  const motionOff = !preferences.motion;
  const motionAttrs = motionOff ? ' is-disabled" inert aria-disabled="true"' : '"';
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.effects.title')}</h2><p>${t('settings.effects.body')}</p></div>${icon('wand', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.glow.title')}</strong><small>${t('settings.glow.body')}</small></div><label class="range-control"><input type="range" min="0" max="100" value="${preferences.glow}" data-setting="glow" data-preview="glow:${preferences.glow}" data-preview-label="${escapeHtml(t('settings.glow.title'))}" /><span class="range-value" id="glow-value">${preferences.glow}%</span></label></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.ambient.title')}</strong><small>${t('settings.ambient.body')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.ambient}" data-toggle="ambient" data-preview="uiPart:ambient:${preferences.ambient ? 'off' : 'on'}" data-preview-label="${escapeHtml(t('settings.ambient.title'))}" aria-label="${t('settings.ambient.title')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.motion.title')}</strong><small>${t('settings.motion.body')}${motionOff ? ` · ${t('settings.motion.disabledHint')}` : ''}</small></div><button class="toggle" role="switch" aria-checked="${preferences.motion}" data-toggle="motion" data-preview="motion:${preferences.motion ? 'off' : 'on'}" data-preview-label="${escapeHtml(t('settings.motion.title'))}" aria-label="${t('settings.motion.title')}"></button></div>
      <div class="setting-line${motionAttrs}><div class="setting-label"><strong>${t('settings.transitionStyle')}</strong></div><div class="segmented animation-segmented">${renderAnimationOption('pageTransition', 'fade', t('settings.transition.fade'), preferences.pageTransition === 'fade')}${renderAnimationOption('pageTransition', 'slide', t('settings.transition.slide'), preferences.pageTransition === 'slide')}${renderAnimationOption('pageTransition', 'zoom', t('settings.transition.zoom'), preferences.pageTransition === 'zoom')}${renderAnimationOption('pageTransition', 'none', t('settings.transition.none'), preferences.pageTransition === 'none')}</div></div>
      <div class="setting-line${motionAttrs}><div class="setting-label"><strong>${t('settings.cardAnimation')}</strong></div><div class="segmented animation-segmented">${renderAnimationOption('cardAnimation', 'rise', t('settings.cards.rise'), preferences.cardAnimation === 'rise')}${renderAnimationOption('cardAnimation', 'fade', t('settings.cards.fade'), preferences.cardAnimation === 'fade')}${renderAnimationOption('cardAnimation', 'pop', t('settings.cards.pop'), preferences.cardAnimation === 'pop')}${renderAnimationOption('cardAnimation', 'none', t('settings.cards.none'), preferences.cardAnimation === 'none')}</div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.contrast.title')}</strong><small>${t('settings.contrast.body')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.contrast}" data-toggle="contrast" data-preview="contrast:${preferences.contrast ? 'off' : 'on'}" data-preview-label="${escapeHtml(t('settings.contrast.title'))}" aria-label="${t('settings.contrast.title')}"></button></div>
      <div class="setting-line${motionAttrs}><div class="setting-label"><strong>${t('settings.animationSpeed.title')}</strong><small>${t('settings.animationSpeed.body')}</small></div><div class="segmented">${[['slow', t('settings.animationSpeed.slow')], ['normal', t('settings.animationSpeed.normal')], ['fast', t('settings.animationSpeed.fast')]].map(([value, label]) => `<button class="segment ${preferences.animationSpeed === value ? 'active' : ''}" data-pref="animationSpeed" data-value="${value}" data-preview="animationSpeed:${value}" data-preview-label="${escapeHtml(label)}">${label}</button>`).join('')}</div></div>
       <div class="setting-line${motionAttrs}><div class="setting-label"><strong>${t('settings.effects.easing')}</strong><small>${t('settings.effects.easingHint')}</small></div><div class="segmented">${[['smooth', t('settings.effects.easingSmooth')], ['spring', t('settings.effects.easingSpring')], ['linear', t('settings.effects.easingLinear')]].map(([value, label]) => `<button class="segment ${preferences.animationEasing === value ? 'active' : ''}" data-pref="animationEasing" data-value="${value}" data-preview="animationEasing:${value}" data-preview-label="${escapeHtml(label)}">${label}</button>`).join('')}</div></div>
      <div class="setting-line${motionAttrs}><div class="setting-label"><strong>${t('settings.effects.pageSpeed')}</strong><small>${t('settings.effects.pageSpeedHint')}</small></div><label class="range-control"><input type="range" min="50" max="200" step="10" value="${Math.round((preferences.animationDuration || 1) * 100)}" data-animation-duration data-preview="animationDuration:${Math.round((preferences.animationDuration || 1) * 100)}" data-preview-label="${escapeHtml(t('settings.effects.pageSpeed'))}" /><span class="range-value" data-animation-duration-value>${Math.round((preferences.animationDuration || 1) * 100)}%</span></label></div>
    </section><p class="catalog-disclaimer">${t('settings.savedLocally')}</p>`;
}

function renderInterfaceSettings() {
  const navGroup = (group, titleKey) => {
    const order = navOrder(group);
    const horizontal = group === 'topbar';
    const rows = order.map((key, index) => {
      const item = NAV_ITEMS.find((entry) => entry.key === key);
      if (!item) return '';
      return `<div class="ui-row" data-ui-row="${key}" data-ui-drag="${key}" role="listitem" tabindex="0" aria-roledescription="${t('settings.ui.dragHint')}">
        <span class="ui-row-grip" aria-hidden="true">${icon('grip', 14)}</span>
        <span class="ui-row-icon" data-icon="${item.icon}"></span>
        <span class="ui-row-copy"><strong>${t(`nav.${item.key}`)}</strong><small>${t(titleKey)}</small></span>
        <button class="ui-row-handle" data-ui-move="${key}" data-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="${t(horizontal ? 'settings.ui.moveLeft' : 'settings.ui.moveUp')}">${icon(horizontal ? 'arrowLeft' : 'navUp', 12)}</button>
        <button class="ui-row-handle" data-ui-move="${key}" data-direction="1" ${index === order.length - 1 ? 'disabled' : ''} aria-label="${t(horizontal ? 'settings.ui.moveRight' : 'settings.ui.moveDown')}">${icon(horizontal ? 'arrow' : 'navDown', 12)}</button>
      </div>`;
    }).join('');
    return `<p class="ui-section-title">${t(titleKey)}</p><div class="ui-list ${horizontal ? 'ui-list-horizontal' : ''}" data-ui-order data-nav-order-group="${group}">${rows}</div>`;
  };
  const partToggle = (pref, titleKey, bodyKey) => `<div class="setting-line"><div class="setting-label"><strong>${t(titleKey)}</strong><small>${t(bodyKey)}</small></div><button class="toggle" role="switch" aria-checked="${preferences[pref]}" data-toggle="${pref}" data-preview="uiPart:${pref}:${preferences[pref] ? 'off' : 'on'}" data-preview-label="${escapeHtml(t(titleKey))}" aria-label="${t(titleKey)}"></button></div>`;
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.language.title')}</h2><p>${t('settings.language.body')}</p></div>${icon('message', 18)}</div>
      <div class="segmented language-segmented"><button class="segment ${preferences.language === 'ru' ? 'active' : ''}" data-pref="language" data-value="ru">${t('settings.language.ru')}</button><button class="segment ${preferences.language === 'en' ? 'active' : ''}" data-pref="language" data-value="en">${t('settings.language.en')}</button></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.ui.navTitle')}</h2><p>${t('settings.ui.navBody')}</p></div>${icon('layout', 18)}</div>
      ${navGroup('topbar', 'settings.ui.group.topbar')}
      ${navGroup('menu', 'settings.ui.group.menu')}
      <p class="catalog-disclaimer">${t('settings.ui.bottomFixed')}</p>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.ui.partsTitle')}</h2><p>${t('settings.ui.partsBody')}</p></div>${icon('sliders', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.ui.font')}</strong><small>${t('settings.ui.fontHint')}</small></div><div class="segmented">${[['modern',t('settings.ui.fontModern')],['classic',t('settings.ui.fontClassic')]].map(([v,l])=>`<button class="segment ${preferences.uiFont===v?'active':''}" data-pref="uiFont" data-value="${v}" ${previewAttr('uiFont',v,l)}>${l}</button>`).join('')}</div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.ui.autoHide')}</strong><small>${t('settings.ui.autoHideHint')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.sidebarAutoHide}" data-pref-toggle="sidebarAutoHide" data-preview="uiPart:sidebarAutoHide:${preferences.sidebarAutoHide ? 'off' : 'on'}" data-preview-label="${escapeHtml(t('settings.ui.autoHide'))}" aria-label="${t('settings.ui.autoHide')}"></button></div>

      ${partToggle('uiSidebarTip', 'settings.ui.tip', 'settings.ui.tipBody')}
      <p class="ui-section-title">${t('settings.ui.topbar')}</p>
      ${partToggle('uiTopbarSearch', 'settings.ui.search', 'settings.ui.searchBody')}
      ${partToggle('uiBreadcrumb', 'settings.ui.breadcrumb', 'settings.ui.breadcrumbBody')}
      ${partToggle('uiNotifications', 'settings.ui.notifications', 'settings.ui.notificationsBody')}
      <p class="ui-section-title">${t('settings.ui.other')}</p>
      ${partToggle('uiUpdateBanner', 'settings.ui.updateBanner', 'settings.ui.updateBannerBody')}
      <button class="text-button theme-reset" data-action="reset-interface">${t('settings.ui.reset')}</button>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.tray.limitsTitle')}</h2><p>${t('settings.tray.limitsBody')}</p></div>${icon('tray', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.tray.favoriteLimit')}</strong><small>${t('settings.tray.limitHint')}</small></div>
        <div class="tray-limit-control">
          <label class="range-control"><input type="range" min="1" max="20" step="1" value="${preferences.trayFavoritesLimit}" data-tray-limit="trayFavoritesLimit" ${preferences.trayFavoritesUnlimited ? 'disabled' : ''} /><span class="range-value" data-tray-limit-value="trayFavoritesLimit">${preferences.trayFavoritesUnlimited ? '∞' : preferences.trayFavoritesLimit}</span></label>
          <span class="tray-limit-toggle"><small>${t('settings.tray.noLimit')}</small><button class="toggle" role="switch" aria-checked="${preferences.trayFavoritesUnlimited}" data-pref-toggle="trayFavoritesUnlimited" aria-label="${t('settings.tray.noLimit')}"></button></span>
        </div>
      </div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.tray.quickLimit')}</strong><small>${t('settings.tray.limitHint')}</small></div>
        <div class="tray-limit-control">
          <label class="range-control"><input type="range" min="1" max="20" step="1" value="${preferences.trayQuickLimit}" data-tray-limit="trayQuickLimit" ${preferences.trayQuickUnlimited ? 'disabled' : ''} /><span class="range-value" data-tray-limit-value="trayQuickLimit">${preferences.trayQuickUnlimited ? '∞' : preferences.trayQuickLimit}</span></label>
          <span class="tray-limit-toggle"><small>${t('settings.tray.noLimit')}</small><button class="toggle" role="switch" aria-checked="${preferences.trayQuickUnlimited}" data-pref-toggle="trayQuickUnlimited" aria-label="${t('settings.tray.noLimit')}"></button></span>
        </div>
      </div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.hotkeys.title')}</h2><p>${t('settings.hotkeys.body')}</p></div>${icon('keyboard', 18)}</div>
      <div class="hotkey-list">${HOTKEY_ACTIONS.map((action) => `<div class="hotkey-row"><span>${t(action.label)}</span><button class="hotkey-recorder" data-record-hotkey="${action.id}" aria-label="${t('settings.hotkeys.record')}">${formatHotkey(hotkeyCombo(action.id))}</button></div>`).join('')}</div>
      <div class="data-actions"><button class="ghost-button" data-action="reset-hotkeys">${icon('refreshCw', 13)} ${t('settings.hotkeys.reset')}</button></div>
      <p class="catalog-disclaimer">${t('settings.hotkeys.hint')}</p>
    </section>`;
}

function moveNavItem(key, direction) {
  const group = NAV_ITEMS.find((item) => item.key === key)?.group === 'topbar' ? 'topbar' : 'menu';
  const order = navOrder(group);
  const index = order.indexOf(key);
  const target = index + Number(direction);
  if (index < 0 || target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  preferences[group === 'topbar' ? 'topbarOrder' : 'sidebarOrder'] = order;
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
  const rows = [...list.querySelectorAll('[data-ui-row]')];
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
    horizontal: list.classList.contains('ui-list-horizontal'),
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
  // Rows are matched by the data attribute so widget sections (home-widget,
  // not ui-row) ride the same machinery when dragged on the home page.
  const rows = [...uiDrag.list.querySelectorAll('[data-ui-row]:not(.ui-row-dragging)')];
  let anchor = null;
  for (const item of rows) {
    const rect = item.getBoundingClientRect();
    const before = uiDrag.horizontal
      ? event.clientX < rect.left + rect.width / 2
      : event.clientY < rect.top + rect.height / 2;
    if (before) { anchor = item; break; }
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
  const order = [...list.querySelectorAll('[data-ui-row]')].map((item) => item.dataset.uiRow).filter(Boolean);
  // Widget config rows (data-ui-row="widget:<key>") reorder home widgets,
  // sidebar rows reorder nav items. The prefix tells them apart.
  if (order[0] && String(order[0]).startsWith('widget:')) {
    preferences.homeWidgetOrder = order.map((k) => String(k).slice(7)).filter(Boolean);
  } else {
    const group = list.dataset.navOrderGroup === 'topbar' ? 'topbarOrder' : 'sidebarOrder';
    preferences[group] = order;
  }
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
  const key = String(row.dataset.uiRow);
  if (key.startsWith('widget:')) {
    moveHomeWidget(key.slice(7), event.key === 'ArrowUp' ? '-1' : '1');
  } else {
    moveNavItem(key, event.key === 'ArrowUp' ? '-1' : '1');
  }
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

// Widget drag on the home page itself: grip in the widget heading drags a
// placeholder row so the same in-flow reorder machinery runs.
document.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  const grip = event.target.closest?.('[data-widget-drag]');
  if (!grip) return;
  const section = grip.closest('[data-home-widget]');
  if (!section) return;
  const homeView = section.closest('[data-home-view]');
  if (!homeView) return;
  const widgetRows = [...homeView.querySelectorAll('.home-widget')];
  const index = widgetRows.indexOf(section);
  if (index < 0) return;
  // Promote every widget section to a draggable row for the shared machinery.
  widgetRows.forEach((w) => { if (!w.dataset.uiRow) w.dataset.uiRow = `widget:${w.dataset.homeWidget}`; });
  // Tag the drag list: homeView has no [data-ui-order]; add it transiently.
  homeView.setAttribute('data-ui-order', '');
  uiDrag = {
    row: section,
    list: homeView,
    started: false,
    pointerId: event.pointerId,
    pointerX: event.clientX,
    pointerY: event.clientY
  };
  event.preventDefault();
});

function moveHomeWidget(key, direction) {
  const order = homeWidgetOrder();
  const index = order.indexOf(key);
  const target = index + Number(direction);
  if (index < 0 || target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  preferences.homeWidgetOrder = order;
  savePreferences();
  renderPage();
}

function renderUpdateSettings() {
  const state = latestUpdateState || { status: 'idle', progress: 0 };
  const status = state.status;
  const version = status === 'available' ? state.latestVersion : state.currentVersion;
  const statusMessage = status === 'downloading' ? t('updates.downloading', { percent: Math.max(0, Math.min(100, Number(state.progress) || 0)) })
    : status === 'downloaded' ? t('updates.ready')
      : status === 'applying' ? t('updates.applying')
        : status === 'error' ? t('updates.error', { error: escapeHtml(state.errorMessage || 'Unknown error') })
          : status === 'available' ? t('updates.available')
            : status === 'idle' ? t('updates.notChecked')
              : status === 'current' ? t('updates.current')
            : status === 'unavailable' ? t('updates.unavailable')
              : status === 'development' ? t('updates.development') : t('updates.checking');
  const progress = Math.max(0, Math.min(100, Number(state.progress) || 0));
  const visualProgress = status === 'applying' || status === 'downloaded' ? 100 : progress;
  const checking = status === 'checking';
  const downloading = status === 'downloading';
  const installReady = status === 'downloaded';
  const downloadingButton = downloading ? `<button class="ghost-button update-download-button" disabled>${icon('download', 13)} ${t('updates.downloading', { percent: progress })}</button>` : '';
  const primaryUpdateAction = status === 'available' ? `<button class="primary-button" data-action="download-update">${icon('download', 13)} ${t('updates.downloadNow')}</button>`
    : installReady ? `<button class="primary-button" data-action="install-update">${icon('check', 13)} ${t('updates.installNow')}</button>`
      : downloadingButton;
  return `<section class="settings-card update-settings-card" id="update-settings-card" data-update-status="${escapeHtml(status)}"><div class="settings-card-head"><div><h2>${t('updates.settingsTitle')}</h2><p>${t('updates.settingsBody')}</p></div>${icon('download', 18)}</div>
    <div class="update-settings-preview"><div class="update-preview-art" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="update-preview-copy"><strong>${escapeHtml(version ? `Vortex ${version}` : t('updates.settingsTitle'))}</strong><small>${statusMessage}</small><span class="update-settings-progress"><i style="--progress:${visualProgress}%"></i></span></div></div>
    <div class="update-settings-meta">
      <span><small>${t('updates.currentVersionLabel')}</small><strong>${escapeHtml(state.currentVersion || '—')}</strong></span>
      <span><small>${t('updates.lastCheckLabel')}</small><strong>${lastUpdateCheckAt ? escapeHtml(new Date(lastUpdateCheckAt).toLocaleString(preferences.language === 'en' ? 'en-US' : 'ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) : '—'}</strong></span>
    </div>
    <div class="update-settings-actions">${primaryUpdateAction}<button class="ghost-button update-retry-button" data-action="retry-update" ${checking || downloading || status === 'applying' ? 'disabled' : ''}>${icon('rotate', 13)} ${checking ? t('updates.checkingShort') : t('updates.checkNow')}</button>${status === 'available' && state.releaseUrl ? `<button class="subtle-button" data-action="open-update-release">${t('updates.openRelease')}</button>` : ''}</div>
  </section>`;
}

function renderAnnouncementSettings() {
  const unread = unreadAnnouncements().length;
  const sourceLabel = announcementSource === 'network' ? t('notifications.sourceNetwork')
    : announcementSource === 'cache' ? t('notifications.offline')
      : announcementSource === 'builtin' ? t('notifications.local')
        : '—';
  return `<section class="settings-card" id="announcement-settings-card"><div class="settings-card-head"><div><h2>${t('notifications.settingsTitle')}</h2><p>${t('notifications.settingsBody')}</p></div>${icon('bell', 18)}</div>
    <div class="update-settings-meta">
      <span><small>${t('notifications.totalLabel')}</small><strong>${announcementItems.length}</strong></span>
      <span><small>${t('notifications.unreadLabel')}</small><strong>${unread}</strong></span>
      <span><small>${t('notifications.sourceLabel')}</small><strong>${escapeHtml(sourceLabel)}</strong></span>
    </div>
    <button class="ghost-button" data-action="refresh-announcements">${icon('rotate', 13)} ${t('notifications.refresh')}</button>
  </section>`;
}

let discordStatusCache = null;
let discordHelpOpen = false;
function discordStatusText() {
  const status = discordStatusCache;
  if (!status) return preferences.discordPresence ? t('discord.status.connecting') : t('discord.status.off');
  if (status.connected) return t('discord.status.connected', { account: status.account?.name || 'Discord' });
  if (!status.hasClientId) return t('discord.status.noClientId');
  if (status.error === 'discord-not-running') return t('discord.status.notRunning');
  if (status.error) return t('discord.status.error', { error: status.error });
  return t('discord.status.connecting');
}

async function refreshDiscordStatus() {
  try { discordStatusCache = await window.vortexDesktop?.getDiscordStatus?.(); } catch { discordStatusCache = null; }
  const host = document.querySelector('[data-discord-status]');
  if (host) host.textContent = discordStatusText();
}

function applyDiscordPresence() {
  window.vortexDesktop?.setDiscordEnabled?.(Boolean(preferences.discordPresence));
  if (!preferences.discordPresence) return;
  const viewing = currentView === 'game-detail' && detailGame ? detailGame.title : null;
  window.vortexDesktop?.setDiscordActivity?.({
    details: viewing ? t('discord.viewing', { game: viewing }) : t('discord.browsing'),
    state: viewing ? t('discord.inVortex') : t('discord.launcher')
  });
  setTimeout(refreshDiscordStatus, 1200);
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / 1024 / 1024).toFixed(2)} МБ`;
}

// Sums every vortex.* key the renderer keeps in localStorage.
function cacheFootprintBytes() {
  let total = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith('vortex.')) continue;
      if (key.startsWith('vortex.onlineHistory.')) continue;
      total += key.length + String(localStorage.getItem(key) || '').length;
    }
  } catch { return 0; }
  return total;
}

function onlineHistoryBytes() {
  let total = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith('vortex.onlineHistory.')) continue;
      total += key.length + String(localStorage.getItem(key) || '').length;
    }
  } catch { return 0; }
  return total;
}

let apiStatusCache = null;

function renderApiStatusPlaceholder() {
  return apiStatusCache ? renderApiStatus(apiStatusCache) : `<p class="catalog-disclaimer">${t('settings.api.notChecked')}</p>`;
}

function renderApiStatus(result) {
  const labels = { games: t('settings.api.games'), thumbnails: t('settings.api.thumbnails'), badges: t('settings.api.badges'), search: t('settings.api.search'), discover: t('settings.api.discover'), users: t('settings.api.users') };
  return (result?.services || []).map((service) => `<div class="api-status-row ${service.ok ? 'ok' : 'bad'}"><span class="api-status-dot"></span><span><strong>${labels[service.id] || service.id}</strong><small>${service.ok ? t('settings.api.online', { ms: String(service.ms) }) : t('settings.api.offline')}</small></span></div>`).join('');
}

async function checkApiStatus() {
  const host = document.querySelector('[data-api-status]');
  if (host) host.innerHTML = `<p class="catalog-disclaimer">${t('settings.api.checking')}</p>`;
  try {
    apiStatusCache = await window.vortexDesktop?.getRobloxApiStatus?.();
  } catch { apiStatusCache = null; }
  if (host) host.innerHTML = apiStatusCache ? renderApiStatus(apiStatusCache) : `<p class="catalog-disclaimer">${t('settings.api.failed')}</p>`;
}

function renderGeneralSettings() {
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.friends.title')}</h2><p>${t('settings.friends.body')}</p></div>${icon('users', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.friends.username')}</strong><small>${t('settings.friends.usernameHint')}</small></div>
        <span class="roblox-username-field"><input type="text" maxlength="20" autocomplete="off" placeholder="Roblox" value="${escapeHtml(preferences.robloxUsername || '')}" data-roblox-username /><button class="ghost-button" data-detect-username>${t('friends.detect')}</button><button class="primary-button" data-save-username>${t('common.save')}</button></span></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.history.title')}</h2><p>${t('settings.history.body')}</p></div>${icon('history', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.history.title')}</strong><small>${t('settings.history.body')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.saveHistory}" data-toggle="saveHistory" aria-label="${t('settings.history.title')}"></button></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.profiles.title')}</h2><p>${t('settings.profiles.body')}</p></div>${icon('palette', 18)}</div>
      <div class="profile-actions">
        <input type="text" maxlength="32" placeholder="${t('settings.profiles.namePlaceholder')}" data-profile-name />
        <button class="primary-button" data-action="save-profile">${icon('check', 13)} ${t('settings.profiles.save')}</button>
        <button class="ghost-button" data-action="export-profiles">${icon('fileDown', 13)} ${t('settings.profiles.export')}</button>
        <button class="ghost-button" data-action="import-profiles">${icon('fileUp', 13)} ${t('settings.profiles.import')}</button>
        <input type="file" accept=".json,application/json" data-profiles-file hidden />
      </div>
      <div class="profile-list">${Object.keys(readProfiles()).length ? Object.entries(readProfiles()).map(([name, profile]) => `
        <div class="profile-row">
          <span class="profile-copy"><strong>${escapeHtml(name)}</strong><small>${new Date(profile.savedAt || Date.now()).toLocaleDateString(preferences.language)}</small></span>
          <button class="primary-button" data-apply-profile="${escapeHtml(name)}">${t('settings.profiles.apply')}</button>
          <button class="ghost-button" data-overwrite-profile="${escapeHtml(name)}">${t('settings.profiles.overwrite')}</button>
          <button class="ghost-button" data-remove-profile="${escapeHtml(name)}" aria-label="${t('settings.profiles.remove')}">${icon('close', 12)}</button>
        </div>`).join('') : `<p class="catalog-disclaimer">${t('settings.profiles.empty')}</p>`}
      </div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.reset.title')}</h2><p>${t('settings.reset.body')}</p></div>${icon('slidersHorizontal', 18)}</div>
      <button class="ghost-button" data-action="reset-appearance">${icon('motion', 13)} ${t('settings.resetButton')}</button>
    </section>`;
}

function renderSettings() {
  const panel = preferences.settingsTab === 'home' ? renderHomeSettings()
    : preferences.settingsTab === 'cards' ? renderCardSettings()
      : preferences.settingsTab === 'effects' ? renderEffectSettings()
        : preferences.settingsTab === 'interface' ? renderInterfaceSettings()
          : preferences.settingsTab === 'general' ? renderGeneralSettings()
            : preferences.settingsTab === 'integrations' ? renderIntegrationSettings()
              : preferences.settingsTab === 'data' ? renderDataSettings()
                : preferences.settingsTab === 'version' ? `${renderUpdateSettings()}${renderAnnouncementSettings()}`
                  : renderAccentSettings();
  const activeTab = t(`settings.tab.${preferences.settingsTab}`);
  return `<div class="page-heading settings-page-heading"><nav class="settings-breadcrumb" aria-label="${t('settings.breadcrumb')}"><span class="settings-breadcrumb-parent">${t('nav.settings')}</span><span class="settings-breadcrumb-separator" aria-hidden="true">›</span><h1>${activeTab}</h1></nav></div>
    <div class="settings-layout">${settingsTabs()}<div class="settings-panel">${panel}</div></div>`;
}

// Integrations tab: Discord presence, friend alerts and the tray.
function renderIntegrationSettings() {
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.integrations.title')}</h2><p>${t('settings.integrations.body')}</p></div>${icon('sparkles', 18)}</div>
      <div class="setting-line discord-id-line"><div class="setting-label"><strong>${t('settings.integrations.discordClientId')}</strong><small>${t('settings.integrations.discordClientIdHint')}</small></div>
        <span class="discord-id-field"><input type="text" inputmode="numeric" autocomplete="off" maxlength="22" placeholder="1536230039870505020" value="${escapeHtml(preferences.discordClientId || '')}" data-discord-client-id /><button class="ghost-button" data-action="save-discord-client">${icon('check', 13)} ${t('settings.integrations.discordSaveId')}</button></span></div>
      <button class="discord-help-toggle" type="button" data-action="toggle-discord-help" aria-expanded="${discordHelpOpen}" aria-controls="discord-help-panel">${icon('chevronDown', 13)}<span>${t('settings.integrations.discordWhere')}</span></button>
      <div class="discord-help-panel ${discordHelpOpen ? 'is-open' : ''}" id="discord-help-panel">
        <div class="discord-help-inner">
          <ol class="discord-steps">
            <li>${t('settings.integrations.discordStep1')}</li>
            <li>${t('settings.integrations.discordStep2')}</li>
            <li>${t('settings.integrations.discordStep3')}</li>
          </ol>
        </div>
      </div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.integrations.discord')}</strong><small>${t('settings.integrations.discordBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.discordPresence}" data-toggle="discordPresence" aria-label="${t('settings.integrations.discord')}"></button></div>
      <p class="catalog-disclaimer discord-status" data-discord-status>${discordStatusText()}</p>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.integrations.friendAlerts')}</strong><small>${t('settings.integrations.friendAlertsBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.friendFavoriteAlerts}" data-toggle="friendFavoriteAlerts" aria-label="${t('settings.integrations.friendAlerts')}"></button></div>
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
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.tray.miniPlayer')}</strong><small>${t('settings.tray.miniPlayerBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.trayMiniPlayer}" data-toggle="trayMiniPlayer" aria-label="${t('settings.tray.miniPlayer')}"></button></div>
    </section>`;
}

// Data tab: caches, size limits and the Roblox API health probe.
function renderDataSettings() {
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.cache.title')}</h2><p>${t('settings.cache.body')}</p></div>${icon('database', 18)}</div>
      <div class="update-settings-meta">
        <span><small>${t('settings.cache.details')}</small><strong data-cache-size>${formatBytes(cacheFootprintBytes())}</strong></span>
        <span><small>${t('settings.cache.onlineHistory')}</small><strong data-history-size>${formatBytes(onlineHistoryBytes())}</strong></span>
      </div>
      <div class="data-actions">
        <button class="ghost-button" data-action="clear-cache">${icon('trash', 13)} ${t('settings.cacheClear')}</button>
        <button class="ghost-button" data-action="clear-api-cache">${icon('refreshCw', 13)} ${t('settings.cache.clearApi')}</button>
        <button class="ghost-button" data-action="clear-history-cache">${icon('history', 13)} ${t('settings.cache.clearHistory')}</button>
      </div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.cache.diskCache')}</strong><small>${t('settings.cache.diskCacheBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.diskCache}" data-toggle="diskCache" aria-label="${t('settings.cache.diskCache')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.cache.lazyImages')}</strong><small>${t('settings.cache.lazyImagesBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.lazyImages}" data-toggle="lazyImages" aria-label="${t('settings.cache.lazyImages')}"></button></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.api.title')}</h2><p>${t('settings.api.body')}</p></div>${icon('activity', 18)}</div>
      <div class="api-status-list" data-api-status>${renderApiStatusPlaceholder()}</div>
      <button class="ghost-button" data-action="check-api-status">${icon('refreshCw', 13)} ${t('settings.api.check')}</button>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.data.title')}</h2><p>${t('settings.data.body')}</p></div>${icon('fileDown', 18)}</div>
      <div class="data-actions">
        <button class="ghost-button" data-action="export-data">${icon('fileDown', 13)} ${t('settings.data.export')}</button>
        <button class="ghost-button" data-action="import-data">${icon('fileUp', 13)} ${t('settings.data.import')}</button>
      </div>
    </section>`;
}

const viewNames = { home: 'nav.home', catalog: 'nav.catalog', search: 'nav.search', favorites: 'nav.favorites', recent: 'nav.recent', activity: 'nav.activity', friends: 'nav.friends', plans: 'nav.plans', settings: 'nav.settings' };

function quickGameAvatarMarkup(item) {
  const thumbnail = safeThumbnail(item.thumbnail);
  return `<span class="quick-launch-avatar">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" decoding="async" />` : icon('gamepad', 16)}</span>`;
}

function quickGameRowMarkup(item, nested = false) {
  const title = item.title || t('quick.untitled');
  return `<div class="quick-launch-row" data-quick-id="${escapeHtml(item.id)}" ${nested ? 'data-quick-nested="true"' : `data-quick-drop-game="${escapeHtml(item.id)}"`}>
      <button class="quick-launch-button" type="button" data-quick-launch="${escapeHtml(item.id)}" title="${escapeHtml(title)}" aria-label="${t('quick.launchNamed', { title: escapeHtml(title) })}">${quickGameAvatarMarkup(item)}<span class="quick-launch-copy"><strong>${escapeHtml(title)}</strong>${item.hotkey ? `<small>${escapeHtml(formatHotkey(item.hotkey))}</small>` : ''}</span></button>
      <span class="quick-launch-tools">
        <button class="quick-launch-tool" type="button" data-quick-edit="${escapeHtml(item.id)}" aria-label="${t('quick.edit')}" title="${t('quick.edit')}">${icon('edit', 12)}</button>
        <button class="quick-launch-tool ${item.hotkey ? 'has-hotkey' : ''}" type="button" data-quick-hotkey="${escapeHtml(item.id)}" aria-label="${item.hotkey ? t('quick.clearHotkey') : t('quick.setHotkey')}" title="${item.hotkey ? t('quick.clearHotkey') : t('quick.setHotkey')}">${icon('keyboard', 12)}</button>
        <button class="quick-launch-tool" type="button" data-quick-share="${escapeHtml(item.id)}" aria-label="${t('quick.share')}" title="${t('quick.share')}">${icon('share', 12)}</button>
        <button class="quick-launch-tool remove" type="button" data-quick-remove="${escapeHtml(item.id)}" data-i18n-aria="quick.remove" aria-label="${t('quick.remove')}" title="${t('quick.remove')}">${icon('close', 12)}</button>
      </span>
    </div>`;
}

function quickFolderMarkup(folder) {
  const open = quickFoldersOpen.has(folder.id);
  const folderTitle = folder.title || t('quick.folderDefault');
  const color = /^#[0-9a-f]{6}$/i.test(String(folder.color || '')) ? folder.color : '#9b7cff';
  const previews = folder.games.slice(0, 4).map((game) => {
    const thumbnail = safeThumbnail(game.thumbnail);
    return `<span class="quick-folder-thumb">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" decoding="async" />` : icon('gamepad', 9)}</span>`;
  }).join('');
  return `<div class="quick-folder" data-quick-folder="${escapeHtml(folder.id)}" aria-expanded="${open}" style="--folder-color:${escapeHtml(color)}">
      <div class="quick-launch-row" data-quick-drop-folder="${escapeHtml(folder.id)}">
        <button class="quick-launch-button" type="button" data-quick-folder-toggle="${escapeHtml(folder.id)}" title="${escapeHtml(folderTitle)}" aria-label="${escapeHtml(folderTitle)}">
          <span class="quick-folder-chevron">${icon('chevronLeft', 11)}</span><span class="quick-folder-stack">${previews}</span><span class="quick-launch-copy"><strong>${escapeHtml(folderTitle)}</strong></span>
        </button>
        <span class="quick-folder-tools"><button class="quick-folder-tool" type="button" data-quick-folder-edit="${escapeHtml(folder.id)}" aria-label="${t('quick.folderEdit')}" title="${t('quick.folderEdit')}">${icon('edit', 12)}</button><button class="quick-launch-remove" type="button" data-quick-remove="${escapeHtml(folder.id)}" aria-label="${t('quick.remove')}" title="${t('quick.remove')}">${icon('close', 12)}</button></span>
      </div>
      <div class="quick-folder-children" ${open ? '' : 'hidden'}>${folder.games.map((game) => quickGameRowMarkup(game, true)).join('')}</div>
    </div>`;
}

function renderQuickLaunchItems() {
  const root = document.getElementById('quick-launch-items');
  if (!root) return;
  const items = cleanQuickLaunchItems(preferences.quickLaunchItems);
  preferences.quickLaunchItems = items;
  root.innerHTML = items.map((item) => item.type === 'folder' ? quickFolderMarkup(item) : quickGameRowMarkup(item)).join('');
  mountIcons(root);
}

function quickLaunchGames() {
  return preferences.quickLaunchItems.flatMap((entry) => entry.type === 'folder' ? entry.games : [entry]);
}

function findQuickLaunchGame(id) {
  return quickLaunchGames().find((entry) => entry.id === String(id));
}

function updateQuickLaunchGame(id, update) {
  const visit = (items) => {
    for (const entry of items) {
      if (entry.type === 'game' && entry.id === String(id)) {
        update(entry);
        return true;
      }
      if (entry.type === 'folder' && visit(entry.games)) return true;
    }
    return false;
  };
  return visit(preferences.quickLaunchItems);
}

function updateNavigationHistoryControls() {
  const back = document.querySelector('[data-action="history-back"]');
  const forward = document.querySelector('[data-action="history-forward"]');
  if (back) back.disabled = navigationHistoryIndex <= 0;
  if (forward) forward.disabled = navigationHistoryIndex >= navigationHistory.length - 1;
}

function pushNavigationHistory(view) {
  if (view === navigationHistory[navigationHistoryIndex]) return;
  navigationHistory = navigationHistory.slice(0, navigationHistoryIndex + 1);
  navigationHistory.push(view);
  if (navigationHistory.length > 50) navigationHistory.shift();
  navigationHistoryIndex = navigationHistory.length - 1;
  updateNavigationHistoryControls();
}

function navigateHistory(direction) {
  const nextIndex = navigationHistoryIndex + direction;
  if (nextIndex < 0 || nextIndex >= navigationHistory.length) return;
  navigationHistoryIndex = nextIndex;
  const view = navigationHistory[navigationHistoryIndex];
  if (view === 'game-detail') {
    if (!detailGame) { navigationHistoryIndex += direction < 0 ? -1 : 1; return; }
    currentView = 'game-detail';
    renderPage();
    updateNavigationHistoryControls();
  } else setView(view, { track: false });
}

function renderSidebar() {
  const groups = renderSidebarNav();
  const topbar = document.querySelector('[data-nav-group="topbar"]');
  const menu = document.querySelector('[data-nav-group="menu"]');
  const space = document.querySelector('[data-nav-group="space"]');
  const bottom = document.querySelector('.sidebar-nav-bottom');
  if (topbar) topbar.innerHTML = groups.topbar;
  if (menu) menu.innerHTML = groups.menu;
  if (space) space.innerHTML = groups.space;
  if (bottom) bottom.innerHTML = groups.bottom;
  mountIcons(document.querySelector('.sidebar') || document.body);
  if (topbar) mountIcons(topbar);
  renderQuickLaunchItems();
}

function updateSidebar() {
  const activeView = ['game-detail', 'search'].includes(currentView) ? 'catalog' : currentView;
  document.querySelectorAll('[data-nav]').forEach((button) => {
    const isActive = button.dataset.nav === activeView;
    button.classList.toggle('active', isActive);
    if (isActive) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  // Breadcrumbs are gone from the topbar: the active nav item already shows location.
}

function updateSidebarCollapse() {
  const button = document.querySelector('[data-sidebar-hide]');
  if (!button) return;
  const collapsed = document.body.classList.contains('sidebar-compact');
  const label = t(collapsed ? 'sidebar.expand' : 'sidebar.collapse');
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.setAttribute('aria-expanded', String(!collapsed));
}

function renderPage() {
  hideHoverPreview();
  applyPreferences();
  reportRecentGamesToTray();
  document.body.classList.toggle('sidebar-compact', readStored('vortex.sidebarCompact', true));
  updateSidebarCollapse();
  updateSidebar();
  updateNavigationHistoryControls();
  renderQuickLaunchItems();
  renderUpdateBanner();
  const pages = { home: renderHome, catalog: renderCatalog, 'game-detail': renderGameDetail, favorites: renderFavorites, recent: renderRecent, activity: renderActivity, friends: renderFriends, plans: renderPlans, settings: renderSettings };
  pageContent.innerHTML = (pages[currentView] || renderHome)();
  mountIcons(pageContent);
  if (currentView === 'plans') void loadRoadmap();
  if (currentView === 'settings') refreshDiscordStatus();
  if (preferences.discordPresence) applyDiscordPresence();
  if (pageContent.dataset.renderedView !== currentView) {
    pageContent.dataset.renderedView = currentView;
    const systemPrefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    const shouldTransition = preferences.motion && !systemPrefersReducedMotion && preferences.pageTransition !== 'none';
    pageContent.dataset.transition = shouldTransition ? preferences.pageTransition : 'none';
    pageContent.classList.remove('page-entering');
    if (shouldTransition) {
      void pageContent.offsetWidth;
      pageContent.classList.add('page-entering');
      pageContent.onanimationend = (event) => {
        if (event.target === pageContent) pageContent.classList.remove('page-entering');
      };
    }
  }
}

function renderUpdateBanner(state) {
  if (state) {
    latestUpdateState = state;
    if (state.status !== 'checking') lastUpdateCheckAt = Date.now();
  }
  const banner = document.getElementById('update-banner');
  const updateSettingsCard = document.getElementById('update-settings-card');
  const onVersionTab = currentView === 'settings' && preferences.settingsTab === 'version';
  if (!banner) { if (updateSettingsCard && onVersionTab) updateSettingsCard.outerHTML = renderUpdateSettings(); return; }
  const status = latestUpdateState?.status;
  const visibleStatuses = ['downloading', 'downloaded', 'applying', 'error'];
  if (!visibleStatuses.includes(status) || !preferences.uiUpdateBanner) {
    banner.hidden = true;
    banner.innerHTML = '';
    // The settings card mirrors every status, including "checking" and "current".
    if (updateSettingsCard && onVersionTab) updateSettingsCard.outerHTML = renderUpdateSettings();
    return;
  }
  const progress = Math.max(0, Math.min(100, Number(latestUpdateState.progress) || 0));
  const stageKeys = { checksum: 'updates.stage.checksum', prepare: 'updates.stage.prepare', downloading: 'updates.stage.downloading', verify: 'updates.stage.verify', installing: 'updates.stage.installing' };
  const stageText = stageKeys[latestUpdateState?.stage] ? t(stageKeys[latestUpdateState.stage]) : null;
  const title = t('updates.title', { version: escapeHtml(latestUpdateState.latestVersion || '') });
  const message = status === 'downloaded' ? t('updates.ready')
    : status === 'applying' ? t('updates.applying')
      : status === 'error' ? t('updates.error', { error: escapeHtml(latestUpdateState.errorMessage || 'Unknown error') })
        : `${stageText ? `${stageText} · ` : ''}${t('updates.downloading', { percent: progress })}`;
  banner.dataset.status = status;
  banner.hidden = false;
  const bannerAction = status === 'downloaded'
    ? `<button class="primary-button update-banner-install" data-action="install-update">${t('updates.installNow')}</button>`
    : status === 'error'
      ? `<button class="ghost-button" data-action="retry-update">${t('updates.retry')}</button>`
      : `<span class="update-banner-progress" aria-label="${progress}%"><i style="--progress:${status === 'applying' ? 100 : progress}%"></i></span>`;
  banner.innerHTML = `<span class="update-banner-icon">${icon(status === 'error' ? 'close' : status === 'downloaded' ? 'check' : 'sparkle', 18)}</span><span class="update-banner-copy"><strong>${title}</strong><small>${message}</small></span>${bannerAction}`;
  if (updateSettingsCard && onVersionTab) updateSettingsCard.outerHTML = renderUpdateSettings();
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
      playStats,
      activityData
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
  if (data.activityData && typeof data.activityData === 'object') {
    activityData = {
      days: data.activityData.days && typeof data.activityData.days === 'object' ? data.activityData.days : {},
      streak: { current: 0, best: 0, lastCompletedDate: '', recoveryUsed: false, ...(data.activityData.streak || {}) },
      achievements: data.activityData.achievements && typeof data.activityData.achievements === 'object' ? data.activityData.achievements : {}
    };
  }
  savePreferences();
  localStorage.setItem('vortex.favorites', JSON.stringify([...favorites]));
  localStorage.setItem('vortex.recent', JSON.stringify(recentGames));
  localStorage.setItem('vortex.playStats', JSON.stringify(playStats));
  localStorage.setItem('vortex.activity', JSON.stringify(activityData));
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

/* ---------------------------------------------------------------- announcements
 * The feed comes from a public Gist that is edited from a local console, so new
 * announcements reach users without shipping a build. Unread state is stored in
 * preferences, keyed by announcement id.
 * ---------------------------------------------------------------------------- */

let announcementItems = [];
let announcementSource = null;
let announcementsLoaded = false;
let announcementTimer = null;
let announcementPanel = null;

function unreadAnnouncements() {
  const read = Array.isArray(preferences.readAnnouncements) ? preferences.readAnnouncements : [];
  return announcementItems.filter((item) => !read.includes(item.id));
}

function syncBellIndicator() {
  const button = document.querySelector('[data-ui-part="notifications"]');
  if (!button) return;
  const count = unreadAnnouncements().length;
  button.classList.toggle('has-unread', count > 0);
  button.title = count > 0 ? t('notifications.unread', { count }) : t('notifications.title');
}

function formatAnnouncementDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.round((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return t('notifications.today');
  if (days === 1) return t('notifications.yesterday');
  if (days < 7) return t('notifications.daysAgo', { count: days });
  return date.toLocaleDateString(preferences.language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderAnnouncementList(highlightIds) {
  if (!announcementPanel) return;
  const list = announcementPanel.querySelector('.announcements-list');
  const count = announcementPanel.querySelector('.announcements-count');
  const source = announcementPanel.querySelector('.announcements-source');
  if (!list) return;

  // While the panel is open the unread highlight follows the snapshot taken at
  // open time, so marking items read does not erase what the user is reading.
  const read = Array.isArray(preferences.readAnnouncements) ? preferences.readAnnouncements : [];
  const isUnread = (item) => (highlightIds ? highlightIds.has(item.id) : !read.includes(item.id));

  const unreadCount = announcementItems.filter(isUnread).length;
  if (count) {
    count.textContent = unreadCount > 0 ? String(unreadCount) : '';
    count.hidden = unreadCount === 0;
  }
  if (source) {
    // Say where the feed came from only when it is not live: a stale note
    // explains itself, and a built-in list means the gist is not configured yet.
    source.textContent = announcementSource === 'network' ? ''
      : announcementSource === 'cache' ? t('notifications.offline')
      : announcementSource === 'builtin' ? t('notifications.local')
      : '';
  }

  list.replaceChildren();
  if (!announcementItems.length) {
    const empty = document.createElement('div');
    empty.className = 'announcements-empty';
    empty.textContent = t('notifications.empty');
    list.appendChild(empty);
    return;
  }

  for (const item of announcementItems) {
    const row = document.createElement('article');
    row.className = `announcement level-${item.level}`;
    if (isUnread(item)) row.classList.add('is-unread');

    const head = document.createElement('div');
    head.className = 'announcement-head';
    const title = document.createElement('span');
    title.className = 'announcement-title';
    title.textContent = item.title;
    head.appendChild(title);
    const date = document.createElement('span');
    date.className = 'announcement-date';
    date.textContent = formatAnnouncementDate(item.date);
    head.appendChild(date);

    row.appendChild(head);
    if (item.body) {
      const body = document.createElement('div');
      body.className = 'announcement-body';
      window.VortexMarkdown?.render(body, item.body);
      row.appendChild(body);
    }
    if (item.url) {
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'announcement-link';
      link.textContent = t('notifications.open');
      link.addEventListener('click', () => window.vortexDesktop?.openAnnouncementLink?.(item.url));
      row.appendChild(link);
    }
    list.appendChild(row);
  }
}

function closeAnnouncementsPanel() {
  if (!announcementPanel) return;
  announcementPanel.remove();
  announcementPanel = null;
}

function markAnnouncementsRead() {
  if (!announcementItems.length) return;
  const ids = announcementItems.map((item) => item.id);
  const read = new Set(Array.isArray(preferences.readAnnouncements) ? preferences.readAnnouncements : []);
  let changed = false;
  for (const id of ids) if (!read.has(id)) { read.add(id); changed = true; }
  if (!changed) return;
  preferences.readAnnouncements = [...read].slice(-200); // keep the file small
  preferences.announcementsSeeded = true;
  savePreferences();
  syncBellIndicator();
}

function toggleAnnouncementsPanel() {
  if (announcementPanel) { closeAnnouncementsPanel(); return; }

  const panel = document.createElement('section');
  panel.className = 'announcements-panel';
  panel.innerHTML = `
    <header class="announcements-head">
      <h2>${escapeHtml(t('notifications.title'))}</h2>
      <span class="announcements-count" hidden></span>
      <span class="announcements-source"></span>
      <button type="button" class="announcements-close" aria-label="${escapeHtml(t('common.close'))}">✕</button>
    </header>
    <div class="announcements-list"></div>`;
  panel.querySelector('.announcements-close').addEventListener('click', closeAnnouncementsPanel);
  document.body.appendChild(panel);
  announcementPanel = panel;

  renderAnnouncementList();
  // Snapshot what was unread BEFORE marking, so the dots stay visible for this
  // viewing session instead of vanishing the instant the panel opens.
  const highlight = new Set(unreadAnnouncements().map((item) => item.id));
  markAnnouncementsRead();
  renderAnnouncementList(highlight);

  // Refresh in the background; only genuinely new items gain dots.
  loadAnnouncements({ force: true }).then(() => {
    renderAnnouncementList(highlight);
  });
}

async function loadAnnouncements(options = {}) {
  const load = window.vortexDesktop?.listAnnouncements;
  if (typeof load !== 'function') return;
  try {
    const result = await load(options.force ? { force: true } : undefined);
    const items = Array.isArray(result?.items) ? result.items : [];
    announcementItems = items;
    announcementSource = result?.source || null;
    announcementsLoaded = true;

    // First ever run: adopt everything as read so a backlog does not fire a
    // toast storm on install. Later notes still notify.
    if (!preferences.announcementsSeeded) {
      preferences.readAnnouncements = items.map((item) => item.id).slice(-200);
      preferences.announcementsSeeded = true;
      savePreferences();
      syncBellIndicator();
      return;
    }
    syncBellIndicator();
  } catch { /* the panel simply stays empty */ }
}

function startAnnouncementPolling() {
  if (announcementTimer) return;
  announcementTimer = window.setInterval(() => loadAnnouncements({ force: true }), 5 * 60 * 1000);
}

function showToast(message, action) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = null;
  region.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = 'toast';
  const label = typeof message === 'object' ? message.message : message;
  const act = typeof message === 'object' ? message : null;
  toast.innerHTML = `<span>${escapeHtml(label)}</span>`;
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

// The custom tray window receives the exact theme tokens computed by the main
// renderer, so saved colors and theme changes stay in sync.
const TRAY_STYLE_TOKENS = [
  '--bg', '--surface', '--surface-2', '--surface-3', '--line', '--line-strong',
  '--text', '--muted', '--subtle', '--accent', '--accent-rgb', '--accent-secondary',
  '--accent-secondary-rgb', '--accent-fill', '--accent-wash', '--accent-text',
  '--accent-contrast', '--accent-border', '--radius-card', '--font-ui'
];

function trayStylePayload() {
  const computed = getComputedStyle(document.documentElement);
  const css = Object.fromEntries(TRAY_STYLE_TOKENS.map((key) => [key, computed.getPropertyValue(key).trim()]));
  return {
    language: preferences.language,
    trayScale: preferences.trayScale,
    corners: preferences.corners,
    theme: preferences.theme,
    lightTheme: document.body.classList.contains('light-theme'),
    trayFavoriteLimit: preferences.trayFavoritesUnlimited ? 0 : Number(preferences.trayFavoritesLimit) || 5,
    trayQuickLimit: preferences.trayQuickUnlimited ? 0 : Number(preferences.trayQuickLimit) || 3,
    css
  };
}

function reportRecentGamesToTray() {
  if (!window.vortexDesktop?.reportRecentGames) return;
  const lastPlayedFor = (id) => Number(playStats[String(id)]?.lastPlayed) || 0;
  const favoriteLimit = preferences.trayFavoritesUnlimited
    ? Number.MAX_SAFE_INTEGER
    : Math.max(1, Number(preferences.trayFavoritesLimit) || 5);
  const quickLimit = preferences.trayQuickUnlimited
    ? Number.MAX_SAFE_INTEGER
    : Math.max(1, Number(preferences.trayQuickLimit) || 3);
  const favoriteGames = Array.from(favorites, String)
    .map((id) => getGame(id) || { id, title: t('quick.untitled') + ' ' + id, thumbnail: '' })
    .sort((first, second) => lastPlayedFor(second.id) - lastPlayedFor(first.id))
    .slice(0, favoriteLimit)
    .map((game) => ({
      id: String(game.id),
      title: String(game.title || (t('quick.untitled') + ' ' + game.id)),
      thumbnail: safeThumbnail(game.thumbnail) || '',
      lastPlayed: lastPlayedFor(game.id)
    }));
  const quickLaunch = quickLaunchGames()
    .map((item) => ({
      id: String(item.id),
      title: String(item.title || ''),
      thumbnail: safeThumbnail(item.thumbnail) || '',
      lastPlayed: Number(item.lastPlayed) || lastPlayedFor(item.placeId),
      method: String(item.method || 'public'),
      placeId: String(item.placeId || ''),
      linkCode: String(item.linkCode || ''),
      shareCode: String(item.shareCode || ''),
      shareType: String(item.shareType || 'Server')
    }))
    .sort((first, second) => second.lastPlayed - first.lastPlayed)
    .slice(0, quickLimit);
  const sessionActive = Boolean(preferences.trayMiniPlayer && playSessionStart && playSessionGameId && nowPlayingSnapshot);
  const nowPlaying = sessionActive && Date.now() - Number(playSessionStart) < PLAYTIME_SESSION_CAP_SECONDS * 1000
    ? {
      id: String(nowPlayingSnapshot.id),
      title: String(nowPlayingSnapshot.title || ''),
      thumbnail: safeThumbnail(nowPlayingSnapshot.thumbnail) || '',
      startedAt: Number(nowPlayingSnapshot.startedAt) || playSessionStart
    }
    : null;
  window.vortexDesktop.reportRecentGames({ favorites: favoriteGames, quickLaunch, nowPlaying, style: trayStylePayload() });
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
  const sessionStart = playSessionStart;
  const elapsed = Math.max(0, Math.round((Date.now() - sessionStart) / 1000));
  const banked = Math.min(elapsed, PLAYTIME_SESSION_CAP_SECONDS);
  const entry = playStats[playSessionGameId] || { seconds: 0, launches: 0, lastPlayed: 0 };
  entry.seconds += banked;
  entry.lastPlayed = Date.now();
  playStats[playSessionGameId] = entry;
  if (banked > 0) recordActivityTime(playSessionGameId, sessionStart, banked);
  if (resetSession) {
    playSessionStart = null;
    playSessionGameId = null;
    playSessionSource = '';
    // The mini-player only exists while a Vortex-launched session is active.
    nowPlayingSnapshot = null;
    localStorage.removeItem(PLAYTIME_SESSION_KEY);
  } else {
    playSessionStart = Date.now();
    localStorage.setItem(PLAYTIME_SESSION_KEY, JSON.stringify({ gameId: playSessionGameId, startedAt: playSessionStart }));
  }
  savePlayStats();
  reportRecentGamesToTray();
  updateActivityAchievements();
  persistActivityData();
  if (!resetSession && currentView === 'activity') renderPage();
}

function closePlaySession() { bankPlaySession(true); }
function checkpointPlaySession() { bankPlaySession(false); }

function openGame(id, gameId = '', accessCode = '') {
  const game = getGame(id) || (String(id).match(/^\d{5,20}$/) ? { id: String(id), title: t('friends.joinGameTitle') } : null);
  if (!game) return;
  // A specific server instance (joining a friend) rides along to the main process.
  const joinGameId = /^(?:\d{5,40}|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(String(gameId)) ? String(gameId) : '';
  const safeAccessCode = /^[A-Za-z0-9-]{8,100}$/.test(String(accessCode || '')) ? String(accessCode) : '';
  // A new launch closes the previous session: it is the natural end marker.
  closePlaySession();
  if (preferences.saveHistory) {
    recentGames = [game.id, ...recentGames.filter((recentId) => recentId !== game.id)].slice(0, 12);
    localStorage.setItem('vortex.recent', JSON.stringify(recentGames));
  }
  playSessionStart = Date.now();
  playSessionGameId = String(game.id);
  playSessionSource = 'launcher';
  nowPlayingSnapshot = {
    id: String(game.id),
    title: String(game.title || ''),
    thumbnail: safeThumbnail(game.thumbnail) || '',
    startedAt: playSessionStart
  };
  // Sent after the snapshot exists, so the tray mini-player appears immediately.
  reportRecentGamesToTray();
  localStorage.setItem(PLAYTIME_SESSION_KEY, JSON.stringify({ gameId: playSessionGameId, startedAt: playSessionStart }));
  // The launch count is persisted immediately; duration is banked on hide,
  // next launch or app close. This also survives a crash/restart.
  const currentEntry = playStats[playSessionGameId] || { seconds: 0, launches: 0, lastPlayed: 0 };
  currentEntry.launches += 1;
  currentEntry.lastPlayed = playSessionStart;
  playStats[playSessionGameId] = currentEntry;
  savePlayStats();
  reportRecentGamesToTray();
  if (window.vortexDesktop?.openGame) {
    window.vortexDesktop.openGame(game.id, joinGameId, safeAccessCode).then(() => showToast(t('toast.opening', { game: game.title }))).catch(() => showToast(t('toast.launchError')));
  } else {
    window.open(`https://www.roblox.com/games/start?placeId=${encodeURIComponent(game.id)}`, '_blank', 'noopener,noreferrer');
    showToast(t('toast.opening', { game: game.title }));
  }
}

// Roblox itself is the source of truth for "am I in a game right now". The
// backend reads the newest Roblox log, so joins from the Roblox website or a
// friend invite also start/stop a play session instead of being invisible.
async function startDetectedSession(placeId, startedAt) {
  const id = String(placeId || '');
  if (!id) return;
  if (playSessionGameId && playSessionGameId !== id) closePlaySession();
  if (playSessionGameId === id) return;
  const known = getGame(id);
  const start = Number(startedAt) > 0 && Number(startedAt) < Date.now() + 60_000 ? Number(startedAt) : Date.now();
  playSessionStart = start;
  playSessionGameId = id;
  playSessionSource = 'detected';
  nowPlayingSnapshot = {
    id,
    title: known?.title || t('activity.unknownGame'),
    thumbnail: safeThumbnail(known?.thumbnail) || '',
    startedAt: start
  };
  if (preferences.saveHistory) {
    recentGames = [id, ...recentGames.filter((recentId) => recentId !== id)].slice(0, 12);
    localStorage.setItem('vortex.recent', JSON.stringify(recentGames));
  }
  const entry = playStats[id] || { seconds: 0, launches: 0, lastPlayed: 0 };
  entry.launches += 1;
  entry.lastPlayed = start;
  playStats[id] = entry;
  savePlayStats();
  reportRecentGamesToTray();
  if (!known && runtimeResolvingPlace !== id) {
    runtimeResolvingPlace = id;
    try {
      // Resolve the exact place instead of searching for its numeric id: a
      // search can return an unrelated first result, which used to put the wrong
      // game in the tray mini-player.
      const response = await window.vortexDesktop?.getGameDetails?.({ placeId: id });
      const item = response?.ok ? response.game : null;
      if (item?.title) {
        const normalized = normalizeDiscoveredGame(item, id);
        normalized.id = id;
        dynamicGames = [normalized, ...dynamicGames.filter((game) => String(game.id) !== id)].slice(-1200);
        localStorage.setItem('vortex.discovered', JSON.stringify(dynamicGames));
        if (nowPlayingSnapshot?.id === id) {
          nowPlayingSnapshot.title = normalized.title;
          nowPlayingSnapshot.thumbnail = safeThumbnail(normalized.thumbnail) || '';
        }
        reportRecentGamesToTray();
        if (['home', 'favorites', 'recent', 'activity', 'game-detail', 'friends'].includes(currentView)) renderPage();
      }
    } catch { /* keep the generic title; the next poll retries */ }
    finally { runtimeResolvingPlace = ''; }
  }
}

async function pollRobloxRuntime() {
  if (!window.vortexDesktop?.getRobloxRuntime) return;
  let data = null;
  try { data = await window.vortexDesktop.getRobloxRuntime(); } catch { return; }
  if (!data || data.available === false) return;
  if (data.running && data.placeId) {
    const placeId = String(data.placeId);
    if (placeId !== playSessionGameId) await startDetectedSession(placeId, data.startedAt);
    return;
  }
  if (!playSessionGameId) return;
  const aliveFor = Date.now() - Number(playSessionStart || 0);
  // A launch from Vortex needs a grace period: Roblox takes a moment to write
  // the first log and the window can still be loading. Detected sessions stop
  // as soon as the log goes quiet, which is the accurate end of playtime.
  if (playSessionSource === 'detected' || aliveFor > 150_000) {
    closePlaySession();
    if (['home', 'favorites', 'recent', 'activity', 'game-detail', 'friends'].includes(currentView)) renderPage();
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

function inferGenreKey(game) {
  const text = `${game.genre || ''} ${game.title || ''} ${game.description || ''}`.toLocaleLowerCase();
  const rules = [
    ['horror', /horror|хоррор|ужас|страш|scary|doors/], ['roleplay', /role.?play|ролевая|ролев|rp\b|brookhaven/],
    ['fashion', /fashion|мод|dress to impress|одежд/], ['parkour', /parkour|паркур|obby|обби|tower of hell/],
    ['action', /action|экшен|шутер|fps|бой|combat/], ['simulator', /simulator|симулятор|tycoon|pet sim/],
    ['survival', /survival|выжив|escape|evade/], ['adventure', /adventure|приключ|quest|explore/]
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || 'other';
}

function normalizeDiscoveredGame(game, query = '') {
  const creator = String(game.creator || '');
  return {
    ...game,
    id: String(game.id),
    title: String(game.title || t('game.fallbackDescription')),
    creator,
    genre: String(game.genre || '').toLocaleLowerCase() === 'roblox' ? '' : String(game.genre || ''),
    genreKey: inferGenreKey(game),
    tagKey: 'roblox',
    art: 'live',
    iconKey: 'gamepad',
    description: String(game.description || t('game.fallbackDescription')),
    live: true,
    search: query
  };
}

async function loadDiscoveryCatalog(sortId = activeDiscoverySort, { force = false, append = false } = {}) {
  activeDiscoverySort = sortId;
  localStorage.setItem('vortex.activeDiscoverySort', JSON.stringify(activeDiscoverySort));
  const cached = discoveryCatalog[sortId];
  if (!force && !append && cached?.savedAt && Date.now() - cached.savedAt < DISCOVERY_CACHE_TTL && Array.isArray(cached.items) && cached.items.length > 0) {
    discoveryStatus = 'success';
    renderPage();
    return;
  }
  if (append && cached?.savedAt && Date.now() - cached.savedAt < DISCOVERY_CACHE_TTL && Array.isArray(cached.items) && cached.items.length > 0) {
    // Cached next category: merge into the accumulated list without a request.
    const previous = discoveryCatalog.__accumulated?.items || [];
    const knownIds = new Set(previous.map((game) => String(game.id)));
    const merged = [...previous, ...cached.items.filter((game) => !knownIds.has(String(game.id)))];
    discoveryCatalog = { ...discoveryCatalog, __accumulated: { savedAt: Date.now(), items: merged, usedSorts: [...new Set([...(discoveryCatalog.__accumulated?.usedSorts || []), String(sortId)])] } };
    activeDiscoverySort = sortId;
    discoveryStatus = 'success';
    renderPage();
    return;
  }

  const requestId = ++discoveryRequestId;
  discoveryStatus = append ? 'loading-more' : 'loading';
  if (!append) catalogVisibleCount = CATALOG_PAGE_SIZE;
  renderPage();
  try {
    if (!window.vortexDesktop?.discoverGames) throw new Error('Roblox Discover is available in the desktop app.');
    const response = await window.vortexDesktop.discoverGames({ sortId, sessionId: discoverySessionId });
    if (requestId !== discoveryRequestId) return;

    discoverySessionId = response.sessionId || discoverySessionId;
    discoverySorts = Array.isArray(response.sorts) && response.sorts.length ? response.sorts : fallbackDiscoverySorts;
    activeDiscoverySort = response.selectedSortId || sortId;
    const items = (response.items || []).map((game) => normalizeDiscoveredGame(game));
    if (append) {
      // Append mode: merge the new category's games into the shown list
      // instead of replacing it, so the catalog only ever grows.
      const previous = discoveryCatalog.__accumulated?.items || [];
      const knownIds = new Set(previous.map((game) => String(game.id)));
      const merged = [...previous, ...items.filter((game) => !knownIds.has(String(game.id)))];
      discoveryCatalog = {
        ...discoveryCatalog,
        __accumulated: { savedAt: Date.now(), items: merged, usedSorts: [...new Set([...(discoveryCatalog.__accumulated?.usedSorts || []), String(activeDiscoverySort)])] },
        [activeDiscoverySort]: { savedAt: Date.now(), items }
      };
    } else {
      discoveryCatalog = {
        ...discoveryCatalog,
        __accumulated: { savedAt: Date.now(), items, usedSorts: [String(activeDiscoverySort)] },
        [activeDiscoverySort]: { savedAt: Date.now(), items }
      };
    }

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
  activeCategory = preferences.catalogGenre || 'all';
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
  else if (!value.trim()) {
    if (!discoveryCatalog[activeDiscoverySort]?.items) loadDiscoveryCatalog(activeDiscoverySort);
    if (isGenreSearchActive() && (genreStatus === 'idle' || !genreResults.length)) fetchGenreGames(false);
  }
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
  reportRecentGamesToTray();
  renderPage();
}

function renderQuickGameFields(method = quickGameMethod) {
  quickGameMethod = ['private', 'share', 'public'].includes(method) ? method : 'public';
  const fieldHost = document.getElementById('quick-game-fields');
  if (!fieldHost) return;
  document.querySelectorAll('[data-quick-method]').forEach((button) => {
    const active = button.dataset.quickMethod === quickGameMethod;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const placeField = `<label class="quick-game-field"><span>${t('quick.placeIdLabel')}</span><input name="placeId" inputmode="numeric" autocomplete="off" maxlength="20" placeholder="1234567890" ${quickGameMethod === 'share' ? 'hidden' : 'required'} /><small>${t('quick.placeIdHint')}</small></label>`;
  const linkField = `<label class="quick-game-field"><span>${t('quick.linkCodeLabel')}</span><input name="linkCode" autocomplete="off" maxlength="100" placeholder="${t('quick.linkCodePlaceholder')}" ${quickGameMethod === 'private' ? 'required' : 'hidden'} /><small>${t('quick.linkCodeHint')}</small></label>`;
  const shareField = `<label class="quick-game-field"><span>${t('quick.shareCodeLabel')}</span><input name="shareCode" autocomplete="off" maxlength="512" placeholder="${t('quick.shareCodePlaceholder')}" ${quickGameMethod === 'share' ? 'required' : 'hidden'} /><small>${t('quick.shareCodeHint')}</small></label>`;
  const optionalSharePlace = `<label class="quick-game-field"><span>${t('quick.sharePlaceIdLabel')}</span><input name="placeId" inputmode="numeric" autocomplete="off" maxlength="20" placeholder="${t('quick.sharePlaceIdPlaceholder')}" /><small>${t('quick.sharePlaceIdHint')}</small></label>`;
  fieldHost.innerHTML = quickGameMethod === 'private' ? `${placeField}${linkField}` : quickGameMethod === 'share' ? `${shareField}${optionalSharePlace}` : placeField;
}

function setQuickGameDialogMode(isEditing) {
  const title = document.getElementById('quick-game-title');
  const iconHost = document.querySelector('[data-quick-submit-icon]');
  const label = document.querySelector('[data-quick-submit-label]');
  if (title) title.textContent = t(isEditing ? 'quick.editDialogTitle' : 'quick.dialogTitle');
  if (iconHost) iconHost.innerHTML = icon(isEditing ? 'check' : 'plus', 13);
  if (label) label.textContent = t(isEditing ? 'quick.saveChanges' : 'quick.save');
}

function openQuickGameModal(editId = '') {
  const modal = document.getElementById('quick-game-modal');
  if (!modal) return;
  quickGameDialogReturnFocus = document.activeElement;
  const item = editId ? findQuickLaunchGame(editId) : null;
  editingQuickGameId = item?.id || '';
  document.getElementById('quick-game-error').hidden = true;
  const form = document.getElementById('quick-game-form');
  form?.reset();
  quickGameMethod = item?.method || 'private';
  setQuickGameDialogMode(Boolean(item));
  renderQuickGameFields();
  if (item && form) {
    form.elements.namedItem('title').value = item.title || '';
    const setField = (name, value) => {
      const fields = Array.from(form.elements).filter((field) => field.name === name);
      const field = fields.find((candidate) => !candidate.hidden) || fields[0];
      if (field) field.value = value || '';
    };
    setField('placeId', item.placeId);
    setField('linkCode', item.linkCode);
    setField('shareCode', item.shareCode);
  }
  modal.hidden = false;
  requestAnimationFrame(() => document.querySelector('#quick-game-fields input:not([hidden])')?.focus());
}

function closeQuickGameModal() {
  const modal = document.getElementById('quick-game-modal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  editingQuickGameId = '';
  setQuickGameDialogMode(false);
  const returnFocus = quickGameDialogReturnFocus;
  quickGameDialogReturnFocus = null;
  if (returnFocus instanceof HTMLElement) returnFocus.focus();
}

function openQuickFolderModal(id) {
  const folder = preferences.quickLaunchItems.find((item) => item.type === 'folder' && item.id === id);
  const modal = document.getElementById('quick-folder-modal');
  const form = document.getElementById('quick-folder-form');
  if (!folder || !modal || !form) return;
  quickFolderDialogReturnFocus = document.activeElement;
  editingQuickFolderId = folder.id;
  form.elements.namedItem('title').value = folder.title || t('quick.folderDefault');
  const color = /^#[0-9a-f]{6}$/i.test(folder.color || '') ? folder.color : '#9b7cff';
  form.elements.namedItem('color').value = color;
  if (colorPopoverState.name === 'folderColor') closeColorPopover();
  syncFolderColorTrigger();
  modal.hidden = false;
  requestAnimationFrame(() => form.elements.namedItem('title')?.focus());
}

function closeQuickFolderModal() {
  const modal = document.getElementById('quick-folder-modal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  editingQuickFolderId = '';
  if (colorPopoverState.name === 'folderColor') closeColorPopover();
  const returnFocus = quickFolderDialogReturnFocus;
  quickFolderDialogReturnFocus = null;
  if (returnFocus instanceof HTMLElement) returnFocus.focus();
}

function submitQuickFolderForm(event) {
  event.preventDefault();
  const folder = preferences.quickLaunchItems.find((item) => item.type === 'folder' && item.id === editingQuickFolderId);
  const form = event.currentTarget;
  if (!folder) { closeQuickFolderModal(); return; }
  folder.title = String(form.elements.namedItem('title').value || '').trim().slice(0, 48) || t('quick.folderDefault');
  const color = String(form.elements.namedItem('color').value || '').toLowerCase();
  folder.color = /^#[0-9a-f]{6}$/.test(color) ? color : '#9b7cff';
  persistQuickLaunchItems();
  closeQuickFolderModal();
}

function normalizeShareCode(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return { code: '', type: 'Server' };
  try {
    const parsed = new URL(raw);
    const code = parsed.searchParams.get('code');
    const type = parsed.searchParams.get('type');
    if (code) return { code: code.trim(), type: ['Server', 'ExperienceInvite', 'ExperienceDetails'].includes(type) ? type : 'Server' };
  } catch { /* The user may paste the raw share code. */ }
  return { code: raw, type: 'Server' };
}

async function quickGameMetadata(placeId, preferredTitle) {
  const local = getGame(placeId);
  if (local) return { title: preferredTitle || local.title || local.name || '', thumbnail: safeThumbnail(local.thumbnail || local.icon) };
  try {
    const result = await window.vortexDesktop?.getGameDetails?.({ placeId });
    const game = result?.game;
    if (game) return { title: preferredTitle || game.title || game.name || '', thumbnail: safeThumbnail(game.thumbnail || game.icon) };
  } catch { /* Keep the quick launch usable while Roblox metadata is offline. */ }
  return { title: preferredTitle || '', thumbnail: '' };
}

function persistQuickLaunchItems() {
  preferences.quickLaunchItems = cleanQuickLaunchItems(preferences.quickLaunchItems);
  savePreferences();
  renderQuickLaunchItems();
  void refreshQuickLaunchMetadata();
}

async function refreshQuickLaunchMetadata() {
  const games = preferences.quickLaunchItems.flatMap((entry) => entry.type === 'folder' ? entry.games : [entry]);
  const missing = games.filter((game) => game.placeId && (!game.thumbnail || game.autoTitle)).slice(0, 12);
  if (!missing.length) return;
  await Promise.all(missing.map(async (game) => {
    try {
      const metadata = await quickGameMetadata(game.placeId);
      let changed = false;
      const live = preferences.quickLaunchItems
        .flatMap((entry) => entry.type === 'folder' ? entry.games : [entry])
        .find((entry) => entry.id === game.id);
      if (!live) return;
      if (!live.thumbnail && metadata.thumbnail) { live.thumbnail = metadata.thumbnail; changed = true; }
      if (live.autoTitle && metadata.title) { live.title = metadata.title; changed = true; }
      if (changed) {
        preferences.quickLaunchItems = cleanQuickLaunchItems(preferences.quickLaunchItems);
        savePreferences();
        renderQuickLaunchItems();
      }
    } catch { /* Keep the saved shortcut; retry the next time the launcher starts. */ }
  }));
}

function replaceQuickLaunchGame(item) {
  const replace = (items) => {
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index >= 0) { items[index] = item; return true; }
    for (const entry of items) {
      if (entry.type === 'folder' && replace(entry.games)) return true;
    }
    return false;
  };
  return replace(preferences.quickLaunchItems);
}

function encodeQuickLaunchCode(item) {
  const payload = {
    version: 1, method: item.method, placeId: item.placeId || '', linkCode: item.linkCode || '',
    shareCode: item.shareCode || '', shareType: item.shareType || 'Server',
    title: item.title || '', thumbnail: item.thumbnail || ''
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return 'VORTEXQL1-' + btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function importQuickLaunchCode(raw) {
  const code = String(raw || '').trim().replace(/^VORTEXQL1-/i, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!code || code.length > 12000) return false;
  try {
    const binary = atob(code + '='.repeat((4 - code.length % 4) % 4));
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0))));
    if (payload?.version !== 1) return false;
    const item = cleanQuickLaunchItems([{ ...payload, type: 'game', id: 'quickimport' }])[0];
    if (!item) return false;
    quickGameMethod = item.method;
    renderQuickGameFields();
    const form = document.getElementById('quick-game-form');
    if (!form) return false;
    form.elements.namedItem('title').value = item.title || '';
    for (const [name, value] of Object.entries({ placeId: item.placeId, linkCode: item.linkCode, shareCode: item.shareCode })) {
      const fields = Array.from(form.elements).filter((field) => field.name === name);
      const field = fields.find((candidate) => !candidate.hidden) || fields[0];
      if (field) field.value = value || '';
    }
    return true;
  } catch {
    return false;
  }
}

function startQuickLaunchHotkeyRecording(id, button) {
  button.classList.add('recording');
  button.title = t('quick.pressHotkey');
  const finish = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    document.removeEventListener('keydown', finish, true);
    if (event && !['Control', 'Shift', 'Alt', 'Meta', 'Escape'].includes(event.key)) {
      const combo = {
        code: event.code || '', key: event.key,
        ctrl: Boolean(event.ctrlKey || event.metaKey), shift: Boolean(event.shiftKey), alt: Boolean(event.altKey)
      };
      for (const other of quickLaunchGames()) {
        if (other.id !== id && other.hotkey && matchesHotkey(event, other.hotkey)) other.hotkey = null;
      }
      updateQuickLaunchGame(id, (item) => { item.hotkey = combo; });
      savePreferences();
    }
    renderQuickLaunchItems();
  };
  document.addEventListener('keydown', finish, true);
}

async function submitQuickGameForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.getElementById('quick-game-error');
  const field = (name) => String(form.elements.namedItem(name)?.value || '').trim();
  const preferredTitle = field('title').slice(0, 64);
  const existing = editingQuickGameId ? findQuickLaunchGame(editingQuickGameId) : null;
  const item = {
    ...(existing || {}),
    type: 'game', id: existing?.id || quickLaunchId(), method: quickGameMethod,
    placeId: '', linkCode: '', shareCode: '', title: '', thumbnail: '',
    lastPlayed: Number(existing?.lastPlayed) || 0, hotkey: existing?.hotkey || null
  };
  if (quickGameMethod === 'private') {
    item.placeId = field('placeId');
    item.linkCode = field('linkCode');
    if (!/^\d{1,20}$/.test(item.placeId) || !/^[a-z\d_-]{1,100}$/i.test(item.linkCode)) {
      error.textContent = t('quick.invalidPrivate'); error.hidden = false; return;
    }
  } else if (quickGameMethod === 'public') {
    item.placeId = field('placeId');
    if (!/^\d{1,20}$/.test(item.placeId)) { error.textContent = t('quick.invalidPlace'); error.hidden = false; return; }
  } else {
    const share = normalizeShareCode(field('shareCode'));
    item.shareCode = share.code;
    item.shareType = share.type;
    if (!/^[a-z\d_-]{1,128}$/i.test(item.shareCode)) { error.textContent = t('quick.invalidShare'); error.hidden = false; return; }
    item.placeId = field('placeId');
    if (item.placeId && !/^\d{1,20}$/.test(item.placeId)) { error.textContent = t('quick.invalidPlace'); error.hidden = false; return; }
  }

  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  error.hidden = true;
  try {
    if (item.placeId) {
      const metadata = await quickGameMetadata(item.placeId, preferredTitle);
      item.title = metadata.title || (t('quick.untitled') + ' ' + item.placeId);
      item.thumbnail = metadata.thumbnail || (existing?.placeId === item.placeId ? existing.thumbnail : '');
    } else {
      item.title = preferredTitle || t('quick.shareDefaultTitle');
      item.thumbnail = existing?.thumbnail || '';
    }
    item.autoTitle = !preferredTitle;
    if (existing) replaceQuickLaunchGame(item);
    else preferences.quickLaunchItems.push(item);
    persistQuickLaunchItems();
    closeQuickGameModal();
    showToast(t(existing ? 'quick.updated' : 'quick.added', { title: item.title }));
  } catch {
    error.textContent = t('quick.saveError'); error.hidden = false;
  } finally {
    submit.disabled = false;
  }
}

function removeQuickLaunchItem(id) {
  const removeFrom = (items) => {
    const index = items.findIndex((item) => item.id === id);
    if (index >= 0) {
      const [removed] = items.splice(index, 1);
      if (removed.type === 'folder') items.splice(index, 0, ...removed.games);
      return true;
    }
    for (let i = 0; i < items.length; i += 1) {
      const folder = items[i];
      if (folder.type !== 'folder') continue;
      const childIndex = folder.games.findIndex((game) => game.id === id);
      if (childIndex >= 0) {
        folder.games.splice(childIndex, 1);
        if (folder.games.length < 2) items.splice(i, 1, ...(folder.games || []));
        return true;
      }
    }
    return false;
  };
  removeFrom(preferences.quickLaunchItems);
  persistQuickLaunchItems();
}

function organizeQuickLaunchDrop(sourceId, targetGameId = '', targetFolderId = '') {
  if (!sourceId || sourceId === targetGameId) return;
  const items = preferences.quickLaunchItems;
  let source;
  const detach = (list) => {
    const index = list.findIndex((item) => item.type === 'game' && item.id === sourceId);
    if (index >= 0) { [source] = list.splice(index, 1); return true; }
    for (let i = 0; i < list.length; i += 1) {
      const folder = list[i];
      if (folder.type !== 'folder') continue;
      const childIndex = folder.games.findIndex((game) => game.id === sourceId);
      if (childIndex >= 0) {
        [source] = folder.games.splice(childIndex, 1);
        if (folder.games.length < 2) list.splice(i, 1, ...folder.games);
        return true;
      }
    }
    return false;
  };
  if (!detach(items) || !source) return;
  if (targetFolderId) {
    const folder = items.find((item) => item.type === 'folder' && item.id === targetFolderId);
    if (folder) {
      folder.games.push(source);
      quickFoldersOpen.add(folder.id);
      persistQuickLaunchItems();
    } else { items.push(source); }
    return;
  }
  const targetIndex = items.findIndex((item) => item.type === 'game' && item.id === targetGameId);
  if (targetIndex < 0) { items.push(source); return; }
  const [target] = items.splice(targetIndex, 1);
  const folder = { type: 'folder', id: quickLaunchId(), title: t('quick.folderDefault'), color: '#9b7cff', games: [target, source] };
  items.splice(targetIndex, 0, folder);
  quickFoldersOpen.add(folder.id);
  persistQuickLaunchItems();
}

async function launchQuickGame(id) {
  const item = findQuickLaunchGame(id);
  if (!item) return;
  try {
    if (!window.vortexDesktop?.launchQuickGame) throw new Error('Desktop launcher unavailable');
    const launchedAt = Date.now();
    item.lastPlayed = launchedAt;
    localStorage.setItem('vortex.preferences', JSON.stringify(preferences));
    if (item.placeId) {
      const game = getGame(item.placeId) || { id: item.placeId, title: item.title, thumbnail: item.thumbnail };
      closePlaySession();
      if (preferences.saveHistory) {
        recentGames = [game.id, ...recentGames.filter((recentId) => recentId !== game.id)].slice(0, 12);
        localStorage.setItem('vortex.recent', JSON.stringify(recentGames));
      }
      playSessionStart = Date.now();
      playSessionGameId = String(game.id);
      nowPlayingSnapshot = { id: String(game.id), title: String(item.title || game.title || ''), thumbnail: safeThumbnail(item.thumbnail || game.thumbnail) || '', startedAt: playSessionStart };
      reportRecentGamesToTray();
      localStorage.setItem(PLAYTIME_SESSION_KEY, JSON.stringify({ gameId: playSessionGameId, startedAt: playSessionStart }));
      const currentEntry = playStats[playSessionGameId] || { seconds: 0, launches: 0, lastPlayed: 0 };
      currentEntry.launches += 1;
      currentEntry.lastPlayed = playSessionStart;
      playStats[playSessionGameId] = currentEntry;
      savePlayStats();
    }
    reportRecentGamesToTray();
    await window.vortexDesktop.launchQuickGame({
      method: item.method, placeId: item.placeId, linkCode: item.linkCode, shareCode: item.shareCode, shareType: item.shareType
    });
    showToast(t('quick.launching', { title: item.title }));
  } catch (launchError) {
    showToast(t('quick.launchError', { error: String(launchError?.message || launchError || '') }));
  }
}

document.getElementById('quick-game-form')?.addEventListener('submit', submitQuickGameForm);
document.getElementById('quick-folder-form')?.addEventListener('submit', submitQuickFolderForm);
function clearQuickLaunchDrag() {
  document.querySelectorAll('.quick-launch-row.is-dragging, .quick-launch-row.is-drop-target').forEach((row) => row.classList.remove('is-dragging', 'is-drop-target'));
  quickDragState?.ghost?.remove();
  quickDragState = null;
}

document.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || !(event.target instanceof Element)) return;
  const row = event.target.closest('.quick-launch-row[data-quick-id]');
  if (!row || event.target.closest('.quick-launch-tools, .quick-folder-tools')) return;
  quickDragState = {
    id: row.dataset.quickId,
    row,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    dragging: false,
    target: null,
    ghost: null
  };
  try { row.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional on WebView2. */ }
});

document.addEventListener('pointermove', (event) => {
  const drag = quickDragState;
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!drag.dragging && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 7) return;
  if (!drag.dragging) {
    drag.dragging = true;
    drag.row.classList.add('is-dragging');
    const game = findQuickLaunchGame(drag.id);
    if (game) {
      drag.ghost = document.createElement('div');
      drag.ghost.className = 'quick-launch-drag-ghost';
      drag.ghost.innerHTML = quickGameAvatarMarkup(game);
      document.body.appendChild(drag.ghost);
    }
  }
  event.preventDefault();
  if (drag.ghost) {
    drag.ghost.style.left = `${event.clientX - 22}px`;
    drag.ghost.style.top = `${event.clientY - 22}px`;
  }
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const target = hit instanceof Element ? hit.closest('[data-quick-drop-game], [data-quick-drop-folder]') : null;
  const validTarget = target && target !== drag.row && target.dataset.quickDropGame !== drag.id ? target : null;
  if (drag.target !== validTarget) {
    drag.target?.classList.remove('is-drop-target');
    drag.target = validTarget;
    drag.target?.classList.add('is-drop-target');
  }
}, { passive: false });

document.addEventListener('pointerup', (event) => {
  const drag = quickDragState;
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (drag.dragging) {
    event.preventDefault();
    if (drag.target) {
      const folderId = drag.target.dataset.quickDropFolder || '';
      const gameId = drag.target.dataset.quickDropGame || '';
      organizeQuickLaunchDrop(drag.id, gameId, folderId);
      suppressQuickLaunchClick = true;
      window.setTimeout(() => { suppressQuickLaunchClick = false; }, 500);
    }
  }
  clearQuickLaunchDrag();
});
document.addEventListener('pointercancel', clearQuickLaunchDrag);
window.addEventListener('blur', clearQuickLaunchDrag);
document.addEventListener('click', (event) => {
  if (!suppressQuickLaunchClick) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  suppressQuickLaunchClick = false;
}, true);

function setView(view, { track = true } = {}) {
  if (track && view !== currentView) pushNavigationHistory(view);
  currentView = view;
  if (view !== 'favorites') favoritesVisibleCount = 24;
  // The search tab keeps its own results: switching tabs does not wipe them.
  if (view !== 'catalog' && view !== 'search') {
    searchQuery = '';
    searchInput.value = '';
    activeCategory = preferences.catalogGenre || 'all';
    if (searchTimer) window.clearTimeout(searchTimer);
    searchRequestId += 1;
  }
  renderPage();
  updateNavigationHistoryControls();
  if (view === 'catalog' && !searchQuery) {
    loadDiscoveryCatalog(activeDiscoverySort);
    if (isGenreSearchActive() && (genreStatus === 'idle' || !genreResults.length)) fetchGenreGames(false);
  }
  window.scrollTo({ top: 0, behavior: preferences.motion ? 'smooth' : 'auto' });
}

document.addEventListener('click', async (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!target) return;
  const colorOpen = target.closest('[data-color-open]');
  if (colorOpen) {
    openColorPopover(colorOpen.dataset.colorOpen, colorOpen);
    return;
  }
  // Any click that is not inside the panel or on the bell dismisses it.
  if (announcementPanel && !target.closest('.announcements-panel') && !target.closest('[data-action="notifications"]')) {
    closeAnnouncementsPanel();
  }
  const move = target.closest('[data-ui-move]');
  if (move) {
    moveNavItem(move.dataset.uiMove, move.dataset.direction);
    updateUiRowHandles(move.closest('[data-ui-order]'));
    return;
  }
  const widgetMove = target.closest('[data-widget-move]');
  if (widgetMove) {
    moveHomeWidget(widgetMove.dataset.widgetMove, widgetMove.dataset.direction);
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

  const quickMethod = target.closest('[data-quick-method]');
  if (quickMethod) { renderQuickGameFields(quickMethod.dataset.quickMethod); document.getElementById('quick-game-error').hidden = true; return; }
  const quickLaunch = target.closest('[data-quick-launch]');
  if (quickLaunch) { void launchQuickGame(quickLaunch.dataset.quickLaunch); return; }
  const quickFolderEdit = target.closest('[data-quick-folder-edit]');
  if (quickFolderEdit) { openQuickFolderModal(quickFolderEdit.dataset.quickFolderEdit); return; }
  const quickFolderToggle = target.closest('[data-quick-folder-toggle]');
  if (quickFolderToggle) {
    const id = quickFolderToggle.dataset.quickFolderToggle;
    if (quickFoldersOpen.has(id)) quickFoldersOpen.delete(id); else quickFoldersOpen.add(id);
    renderQuickLaunchItems();
    return;
  }
  const quickEdit = target.closest('[data-quick-edit]');
  if (quickEdit) { openQuickGameModal(quickEdit.dataset.quickEdit); return; }
  const quickHotkey = target.closest('[data-quick-hotkey]');
  if (quickHotkey) {
    const item = findQuickLaunchGame(quickHotkey.dataset.quickHotkey);
    if (item?.hotkey) {
      updateQuickLaunchGame(item.id, (entry) => { entry.hotkey = null; });
      savePreferences();
      renderQuickLaunchItems();
    } else if (item) startQuickLaunchHotkeyRecording(item.id, quickHotkey);
    return;
  }
  const quickShare = target.closest('[data-quick-share]');
  if (quickShare) {
    const item = findQuickLaunchGame(quickShare.dataset.quickShare);
    if (!item) return;
    if (await copyText(encodeQuickLaunchCode(item))) showToast(t('quick.codeCopied'));
    else showToast(t('quick.codeCopyFailed'));
    return;
  }
  const quickRemove = target.closest('[data-quick-remove]');
  if (quickRemove) { removeQuickLaunchItem(quickRemove.dataset.quickRemove); return; }

  const nav = target.closest('[data-nav]');
  if (nav) { setView(nav.dataset.nav); return; }

  const recorder = target.closest('[data-record-hotkey]');
  if (recorder) { startHotkeyRecording(recorder.dataset.recordHotkey, recorder); return; }

  const action = target.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'history-back') { navigateHistory(-1); return; }
    if (action.dataset.action === 'history-forward') { navigateHistory(1); return; }
    if (action.dataset.action === 'open-update-release') { window.vortexDesktop?.openExternalUrl?.(latestUpdateState?.releaseUrl); return; }
    if (action.dataset.action === 'download-update') {
      if (retryUpdateBusy) return;
      retryUpdateBusy = true;
      renderUpdateBanner({ ...(latestUpdateState || {}), status: 'downloading', progress: 0, errorMessage: null });
      Promise.resolve(window.vortexDesktop?.downloadUpdate?.()).catch((error) => {
        renderUpdateBanner({ ...(latestUpdateState || {}), status: 'error', progress: 0, errorMessage: String(error?.message || error || 'Download failed') });
      }).finally(() => { retryUpdateBusy = false; });
      return;
    }
    if (action.dataset.action === 'install-update') {
      if (retryUpdateBusy) return;
      retryUpdateBusy = true;
      renderUpdateBanner({ ...(latestUpdateState || {}), status: 'applying', progress: 100 });
      Promise.resolve(window.vortexDesktop?.installUpdate?.()).catch((error) => {
        retryUpdateBusy = false;
        renderUpdateBanner({ ...(latestUpdateState || {}), status: 'error', progress: 0, errorMessage: String(error?.message || error || 'Install failed') });
      });
      return;
    }
    if (action.dataset.action === 'open-quick-game-modal') { openQuickGameModal(); return; }
    if (action.dataset.action === 'close-quick-game-modal') { closeQuickGameModal(); return; }
    if (action.dataset.action === 'close-quick-folder-modal') { closeQuickFolderModal(); return; }
    if (action.dataset.action === 'import-quick-code') {
      const input = document.querySelector('[data-quick-code]');
      if (importQuickLaunchCode(input?.value)) {
        input.value = '';
        showToast(t('quick.codeImported'));
      } else showToast(t('quick.codeInvalid'));
      return;
    }
    if (action.dataset.action === 'toggle-friends-drawer') {
      if (document.getElementById('friends-drawer')?.classList.contains('is-open')) closeFriendsDrawer();
      else openFriendsDrawer();
      return;
    }
    if (action.dataset.action === 'close-friends-drawer') { closeFriendsDrawer(); return; }
    if (action.dataset.action === 'friends-drawer-view-all') { closeFriendsDrawer(); setView('friends'); return; }
    if (action.dataset.action === 'refresh-friends') {
      const username = String(preferences.robloxUsername || '').trim();
      if (username) { friendsCache = { at: 0, data: null }; void loadFriends(username, true); showToast(t('friends.refreshing')); }
      else autoDetectRobloxAccountOnce();
      return;
    }
    if (action.dataset.action === 'refresh-friends-drawer') {
      const username = String(preferences.robloxUsername || '').trim();
      if (username) void loadFriends(username, true);
      else autoDetectRobloxAccountOnce();
      return;
    }
    if (action.dataset.action === 'restore-activity-streak') {
      if (!activityRecoveryAvailable()) return;
      activityData.streak.lastCompletedDate = shiftActivityDate(activityDateKey(), -1);
      activityData.streak.current = Number(activityData.streak.current || 0) + 1;
      activityData.streak.best = Math.max(activityData.streak.best, activityData.streak.current);
      activityData.streak.recoveryUsed = true;
      if (activityQualifiedGames().length >= ACTIVITY_DAILY_GAMES) completeDailyActivity();
      updateActivityAchievements();
      persistActivityData();
      showToast(t('activity.recoveryDone'));
      renderPage();
      return;
    }
    if (action.dataset.action === 'open-social-link') { window.vortexDesktop?.openExternalUrl?.(action.dataset.url); return; }
    if (action.dataset.action === 'toggle-detail-description') { detailDescriptionExpanded = !detailDescriptionExpanded; renderPage(); return; }
    if (action.dataset.action === 'favorites-more') { favoritesVisibleCount += 24; renderPage(); return; }
    if (action.dataset.action === 'paid-more') { showMorePaidGames(); return; }
    if (action.dataset.action === 'paid-rescan') { void loadPaidGames(true); return; }
    if (action.dataset.action === 'refresh-recommendations') { void loadRecommendations(true); return; }
    if (action.dataset.action === 'reset-hotkeys') { preferences.hotkeys = {}; savePreferences(); showToast(t('settings.hotkeys.resetDone')); renderPage(); return; }
    if (action.dataset.action === 'check-api-status') { void checkApiStatus(); return; }
    if (action.dataset.action === 'clear-api-cache') { responseCacheLocal.clear(); localStorage.removeItem('vortex.detailCache'); showToast(t('settings.cache.apiCleared')); renderPage(); return; }
    if (action.dataset.action === 'clear-history-cache') {
      for (const key of Object.keys(localStorage)) if (key.startsWith('vortex.onlineHistory.')) localStorage.removeItem(key);
      showToast(t('settings.cache.historyCleared'));
      renderPage();
      return;
    }
    if (action.dataset.action === 'detail-back') { if (navigationHistoryIndex > 0) navigateHistory(-1); else { setView('catalog'); restoreCatalogScroll(); } return; }
    if (action.dataset.action === 'open-details') { captureCatalogScroll(); openGameDetails(action.dataset.id); return; }
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
    if (action.dataset.action === 'favorite') { toggleFavorite(action.dataset.id); if (currentView === 'game-detail' && detailGame) renderPage(); }
    if (action.dataset.action === 'play') openGame(action.dataset.id);
    if (action.dataset.action === 'refresh-online') { void refreshGameOnline(); return; }
    if (action.dataset.action === 'show-more-badges') { detailBadgeCount += 3; renderPage(); return; }
    if (action.dataset.action === 'toggle-badges') { detailBadgesExpanded = !detailBadgesExpanded; renderPage(); return; }
    if (action.dataset.action === 'gallery-prev') { detailGalleryIndex = Math.max(0, detailGalleryIndex - 1); renderPage(); return; }
    if (action.dataset.action === 'gallery-next') { detailGalleryIndex = Math.min(detailGalleryCount - 1, detailGalleryIndex + 1); renderPage(); return; }
    if (action.dataset.action === 'gallery-goto') { detailGalleryIndex = Math.max(0, Number(action.dataset.index) || 0); renderPage(); return; }

    if (action.dataset.action === 'toggle-description') {
      const id = String(action.dataset.id);
      if (expandedDescriptions.has(id)) expandedDescriptions.delete(id);
      else expandedDescriptions.add(id);
      renderPage();
    }
    if (action.dataset.action === 'load-more' || action.dataset.action === 'load-more-genre') {
      // One unified manual "load more": pick the right source and append.
      if (searchQuery.length >= 2) fetchLiveSearch(true);
      else if (isGenreSearchActive()) fetchGenreGames(true);
      else {
        const list = filterGames();
        if (catalogVisibleCount < list.length) { catalogVisibleCount += CATALOG_PAGE_SIZE; renderPage(); }
        else if (allDiscoverySortsUsed() || discoveryCatalog.__accumulated?.searchFallbackStarted) {
          if (!generalLoadingMore) appendGeneralSearch();
        } else {
          // Fetch the next unused Discover category in append mode.
          const sorts = discoverySorts.length ? discoverySorts : fallbackDiscoverySorts;
          const unused = sorts.find((sort) => !(discoveryCatalog.__accumulated?.usedSorts || []).includes(sort.id));
          if (unused) loadDiscoveryCatalog(unused.id, { append: true });
          else if (!(discoveryCatalog.__accumulated?.searchFallbackStarted)) startGeneralSearchFallback();
        }
      }
    }
    if (action.dataset.action === 'notifications') toggleAnnouncementsPanel();
    if (action.dataset.action === 'refresh-announcements') {
      action.disabled = true;
      loadAnnouncements({ force: true }).then(() => {
        const card = document.getElementById('announcement-settings-card');
        if (card) card.outerHTML = renderAnnouncementSettings();
        const fresh = document.getElementById('announcement-settings-card');
        if (fresh) fresh.querySelector('[data-action="refresh-announcements"]')?.removeAttribute('disabled');
        showToast(t('notifications.refreshed', { count: announcementItems.length }));
      }).catch(() => {
        action.disabled = false;
        showToast(t('notifications.refreshError'));
      });
    }
    if (action.dataset.action === 'retry-update') {
      if (retryUpdateBusy) return;
      retryUpdateBusy = true;
      const card = action.closest('.settings-card');
      const label = action.querySelector('span') || action;
      const original = label.textContent;
      label.textContent = t('updates.checkingShort');
      action.disabled = true;
      renderUpdateBanner({ status: 'checking', progress: 0 });
      Promise.resolve(window.vortexDesktop?.retryUpdateCheck?.()).catch(() => {}).finally(() => {
        retryUpdateBusy = false;
        if (label.isConnected) { label.textContent = original; action.disabled = false; }
      });
      window.setTimeout(() => { if (latestUpdateState?.status === 'checking') renderUpdateBanner({ status: latestUpdateState.status }); }, 100);
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
      preferences.topbarOrder = [];
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
    if (action.dataset.action === 'reset-home-widgets') {
      preferences.homeWidgetOrder = [];
      preferences.homeWidgetHidden = [];
      preferences.homeWidgetCollapsed = [];
      savePreferences();
      renderPage();
      showToast(t('home.widgets.resetDone'));
    }
    if (action.dataset.action === 'save-profile') {
      const name = pageContent.querySelector('[data-profile-name]')?.value;
      if (saveProfileFromCurrent(name)) {
        showToast(t('settings.profiles.saved', { name: String(name).trim() }));
        renderPage();
      } else showToast(t('settings.profiles.needName'));
    }
    if (action.dataset.action === 'export-profiles') {
      const blob = new Blob([JSON.stringify(readProfiles(), null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'vortex-profiles.json';
      link.click();
      URL.revokeObjectURL(link.href);
    }
    if (action.dataset.action === 'reset-section-titles') {
      preferences.homeSectionTitles = {};
      savePreferences();
      renderPage();
      showToast(t('settings.home.titlesReset'));
    }
    if (action.dataset.action === 'import-profiles') {
      pageContent.querySelector('[data-profiles-file]')?.click();
    }
    if (action.dataset.action === 'pick-wallpaper') {
      pageContent.querySelector('[data-wallpaper-file]')?.click();
    }
    if (action.dataset.action === 'remove-wallpaper') {
      preferences.themeWallpaper = '';
      savePreferences();
      applyPreferences();
      renderPage();
    }
    if (action.dataset.action === 'toggle-discord-help') {
      discordHelpOpen = !discordHelpOpen;
      action.setAttribute('aria-expanded', String(discordHelpOpen));
      pageContent.querySelector('.discord-help-panel')?.classList.toggle('is-open', discordHelpOpen);
      return;
    }
    if (action.dataset.action === 'save-discord-client') {
      const input = pageContent.querySelector('[data-discord-client-id]');
      const value = String(input?.value || '').replace(/\D/g, '').slice(0, 22);
      if (value && (value.length < 15 || value.length > 22)) { showToast(t('settings.integrations.discordIdInvalid')); return; }
      preferences.discordClientId = value;
      savePreferences();
      try {
        discordStatusCache = await window.vortexDesktop?.setDiscordClientId?.(value);
      } catch { discordStatusCache = null; }
      renderPage();
      refreshDiscordStatus();
      showToast(t('settings.integrations.discordIdSaved'));
      return;
    }
  }

  // Home widget collapse/expand (the chevron in the widget heading).
  const widgetCollapse = target.closest('[data-widget-collapse]');
  if (widgetCollapse) {
    const key = widgetCollapse.dataset.widgetCollapse;
    const list = Array.isArray(preferences.homeWidgetCollapsed) ? preferences.homeWidgetCollapsed.map(String) : [];
    const at = list.indexOf(key);
    if (at >= 0) list.splice(at, 1); else list.push(key);
    preferences.homeWidgetCollapsed = list;
    savePreferences();
    renderPage();
    return;
  }
  const searchSubmit = target.closest('[data-search-page-submit]');
  if (searchSubmit) {
    const input = pageContent.querySelector('[data-search-page-input]');
    submitSearchPage(input ? input.value : searchQuery);
    return;
  }
  const searchClear = target.closest('[data-search-page-clear]');
  if (searchClear) {
    submitSearchPage('');
    return;
  }

  const sidebarHide = target.closest('[data-sidebar-hide]');
  if (sidebarHide) {
    const compact = !document.body.classList.contains('sidebar-compact');
    localStorage.setItem('vortex.sidebarCompact', JSON.stringify(compact));
    document.body.classList.toggle('sidebar-compact', compact);
    updateSidebarCollapse();
    return;
  }
  const catalogView = target.closest('[data-catalog-view]');
  if (catalogView) { preferences.catalogView = catalogView.dataset.catalogView === 'list' ? 'list' : 'grid'; savePreferences(); renderPage(); return; }

  const category = target.closest('[data-category]');
  if (category) {
    activeCategory = category.dataset.category;
    preferences.catalogGenre = activeCategory;
    savePreferences();
    // Full reset of genre pagination when the user switches filters.
    genreResults = []; genrePageToken = null; genreStatus = 'idle'; genreLoadingMore = false; genreTermIndex = 0;
    paidVisibleCount = PAID_PAGE_SIZE;
    paidExhausted = false;
    if (activeAccess === 'paid') { void loadPaidGames(); renderPage(); return; }
    if (activeDiscoverySort === RECOMMENDED_SORT.id && activeAccess !== 'paid') { renderPage(); return; }
    if (isGenreSearchActive()) fetchGenreGames(false);
    else renderPage();
    return;
  }

  const access = target.closest('[data-access]');
  if (access) {
    activeAccess = access.dataset.access === 'paid' ? 'paid' : 'all';
    preferences.catalogAccess = activeAccess;
    savePreferences();
    paidVisibleCount = PAID_PAGE_SIZE;
    paidExhausted = false;
    if (activeAccess === 'paid') {
      // Re-entering the paid view always starts from the first page again.
      paidStatus = paidGames.length ? 'success' : 'idle';
      if (!paidGames.length) void loadPaidGames();
    }
    renderPage();
    return;
  }

  const catalogCustomize = target.closest('[data-catalog-customize]');
  if (catalogCustomize) { currentView = 'settings'; preferences.settingsTab = 'cards'; savePreferences(); renderPage(); return; }

  const discoverySort = target.closest('[data-discovery-sort]');
  if (discoverySort) {
    const sortId = discoverySort.dataset.discoverySort;
    if (sortId === RECOMMENDED_SORT.id) {
      activeDiscoverySort = sortId;
      localStorage.setItem('vortex.activeDiscoverySort', sortId);
      catalogVisibleCount = CATALOG_PAGE_SIZE;
      renderPage();
      void loadRecommendations();
      return;
    }
    loadDiscoveryCatalog(sortId);
    return;
  }

  const tab = target.closest('[data-settings-tab]');
  if (tab) { preferences.settingsTab = tab.dataset.settingsTab; savePreferences(); renderPage(); return; }

  const accent = target.closest('[data-accent]');
  if (accent) {
    // Accent is only an accent: theme colors stay exactly as the user set them.
    preferences.accent = accent.dataset.accent;
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
        rememberRobloxAccount(result.account);
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
        void refreshRobloxAccount();
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
        rememberRobloxAccount(result.account);
        preferences.robloxUsername = result.account.name;
        friendsCache = { at: 0, data: null };
        savePreferences();
        renderPage();
        renderFriendsDrawer();
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
      gradientAngle: preferences.gradientAngle,
      grain: preferences.themeGrain,
      grainStrength: preferences.themeGrainStrength,
      vignette: preferences.themeVignette,
      vignetteStrength: preferences.themeVignetteStrength
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

  // ---------- Customization profiles: non-action buttons ----------
  const applyProfileBtn = target.closest('[data-apply-profile]');
  if (applyProfileBtn) {
    const ok = applyProfile(applyProfileBtn.dataset.applyProfile);
    showToast(ok ? t('settings.profiles.applied', { name: applyProfileBtn.dataset.applyProfile }) : t('settings.profiles.missing'));
    return;
  }
  const overwriteProfileBtn = target.closest('[data-overwrite-profile]');
  if (overwriteProfileBtn) {
    const name = overwriteProfileBtn.dataset.overwriteProfile;
    saveProfileFromCurrent(name);
    showToast(t('settings.profiles.saved', { name }));
    renderPage();
    return;
  }
  const removeProfileBtn = target.closest('[data-remove-profile]');
  if (removeProfileBtn) {
    deleteProfile(removeProfileBtn.dataset.removeProfile);
    renderPage();
    return;
  }

  const friendJoin = target.closest('[data-friend-join]');
  if (friendJoin) {
    const placeId = friendJoin.dataset.friendJoin;
    const gameId = friendJoin.dataset.friendGame || '';
    closeFriendsDrawer();
    openGame(placeId, gameId);
    return;
  }

  const segment = target.closest('[data-pref]');
  if (segment) {
    preferences[segment.dataset.pref] = segment.dataset.value;
    // Choosing Dark / Light / OLED is a complete theme choice. Custom theme
    // colors left behind by the color picker would otherwise keep overriding it,
    // making the theme buttons look dead.
    if (segment.dataset.pref === 'theme') {
      preferences.themeBackground = '';
      preferences.themeSurface = '';
      preferences.themeText = '';
      preferences.themeMuted = '';
      preferences.themeLine = '';
    }
    savePreferences();
    // Language change re-renders the sidebar too: its labels come from t() at
    // renderSidebar() time, so switching needs a fresh pass, not just renderPage.
    if (segment.dataset.pref === 'language') renderSidebar();
    renderPage();
    if (segment.dataset.pref === 'language') showToast(t('settings.languageUpdated'));
    if (segment.dataset.pref === 'trayScale') { reportRecentGamesToTray(); showToast(t('settings.tray.updated')); }
  }

  // Native button.toggle switches for wallpaper effects and card flags.
  const grainToggle = target.closest('[data-wallpaper-grain-toggle]');
  if (grainToggle) { preferences.themeGrain = !preferences.themeGrain; savePreferences(); applyPreferences(); renderPage(); return; }
  const vignetteToggle = target.closest('[data-wallpaper-vignette-toggle]');
  if (vignetteToggle) { preferences.themeVignette = !preferences.themeVignette; savePreferences(); applyPreferences(); renderPage(); return; }
  const cardFlagToggle = target.closest('[data-card-flag-toggle]');
  if (cardFlagToggle) {
    const flag = cardFlagToggle.dataset.cardFlagToggle;
    if (['cardShowDescription', 'cardShowLikes', 'cardShowPlaytime', 'cardShowGenre'].includes(flag)) {
      preferences[flag] = !preferences[flag];
      savePreferences(); refreshCardPreview();
      // Update the switch's aria state in place (renderPage would drop slider focus).
      cardFlagToggle.setAttribute('aria-checked', String(preferences[flag]));
    }
    return;
  }
  const widgetVisibleToggle = target.closest('[data-widget-visible-toggle]');
  if (widgetVisibleToggle) {
    const key = widgetVisibleToggle.dataset.widgetVisibleToggle;
    const list = Array.isArray(preferences.homeWidgetHidden) ? preferences.homeWidgetHidden.map(String) : [];
    const at = list.indexOf(key);
    if (at >= 0) list.splice(at, 1); else list.push(key);
    preferences.homeWidgetHidden = list;
    savePreferences(); renderPage();
    return;
  }

  const prefToggle = target.closest('[data-pref-toggle]');
  if (prefToggle) {
    const key = prefToggle.dataset.prefToggle;
    preferences[key] = !preferences[key];
    savePreferences(); applyPreferences(); renderPage();
    return;
  }
  const toggle = target.closest('[data-toggle]');
  if (toggle) {
    const key = toggle.dataset.toggle;
    preferences[key] = !preferences[key];
    savePreferences();
    if (key === 'discordPresence') { applyDiscordPresence(); showToast(t(preferences.discordPresence ? 'settings.integrations.discordOn' : 'settings.integrations.discordOff')); }
    if (key === 'diskCache') window.vortexDesktop?.setDiskCacheEnabled?.(preferences.diskCache);
    if (key === 'trayMiniPlayer') reportRecentGamesToTray();
    renderPage();
    return;
  }
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
  // Profiles import (see the change listener above).

  // Imported profiles file: merge known profile objects into storage.
  if (event.target.matches('[data-profiles-file]')) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        if (!imported || typeof imported !== 'object' || Array.isArray(imported)) throw new Error('shape');
        const profiles = readProfiles();
        let count = 0;
        for (const [name, profile] of Object.entries(imported)) {
          const clean = String(name).slice(0, 32);
          if (!clean || !profile || typeof profile !== 'object' || !profile.settings) continue;
          profiles[clean] = { version: 1, savedAt: Number(profile.savedAt) || Date.now(), settings: profile.settings };
          count += 1;
        }
        if (!count) throw new Error('empty');
        writeProfiles(profiles);
        renderPage();
        showToast(t('settings.profiles.imported', { count: String(count) }));
      } catch {
        showToast(t('settings.profiles.importInvalid'));
      }
    };
    reader.readAsText(file);
    event.target.value = '';
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
  if (event.target.matches('[data-glass-strength]')) {
    preferences.glassStrength = Math.max(0, Math.min(100, Number(event.target.value) || 0));
    pageContent.querySelector('[data-glass-strength-value]')?.replaceChildren(preferences.glassStrength + '%');
    savePreferences(); applyPreferences();
    return;
  }
  if (event.target.matches('[data-tray-limit]')) {
    const key = event.target.dataset.trayLimit;
    const value = Math.max(1, Math.min(20, Number(event.target.value) || 1));
    preferences[key] = value;
    pageContent.querySelector(`[data-tray-limit-value="${key}"]`)?.replaceChildren(String(value));
    savePreferences();
    return;
  }
  if (event.target.matches('[data-animation-duration]')) {
    preferences.animationDuration = Math.max(0.5, Math.min(2, Number(event.target.value) / 100 || 1));
    event.target.dataset.preview = `animationDuration:${Math.round(preferences.animationDuration * 100)}`;
    pageContent.querySelector('[data-animation-duration-value]')?.replaceChildren(Math.round(preferences.animationDuration * 100) + '%');
    savePreferences(); applyPreferences();
    if (activePreviewTarget === event.target) showHoverPreview(event.target);
    return;
  }
  if (event.target.matches('[data-card-size]')) {
    preferences.cardSize = Math.max(0.7, Math.min(1.3, Number(event.target.value) || 1));
    event.target.dataset.preview = `cardSize:${preferences.cardSize}`;
    pageContent.querySelector('[data-card-size-value]')?.replaceChildren(Math.round(preferences.cardSize * 100) + '%');
    savePreferences(); applyPreferences(); refreshCardPreview();
    if (activePreviewTarget === event.target) showHoverPreview(event.target);
    return;
  }

  if (event.target.matches('[data-card-radius]')) {
    preferences.cardRadius = Math.max(0, Math.min(20, Number(event.target.value) || 0));
    preferences.customCardRadius = true;
    event.target.dataset.preview = `cardRadius:${preferences.cardRadius}`;
    pageContent.querySelector('[data-card-radius-value]')?.replaceChildren(preferences.cardRadius + 'px');
    savePreferences(); applyPreferences(); refreshCardPreview();
    if (activePreviewTarget === event.target) showHoverPreview(event.target);
    return;
  }
  if (event.target.matches('[data-wallpaper-blur]')) {
    preferences.themeWallpaperBlur = Number(event.target.value) || 0;
    pageContent.querySelector('[data-wallpaper-blur-value]')?.replaceChildren(preferences.themeWallpaperBlur + 'px');
    savePreferences(); applyPreferences();
    return;
  }
  if (event.target.matches('[data-wallpaper-dim]')) {
    preferences.themeWallpaperDim = Number(event.target.value) || 0;
    pageContent.querySelector('[data-wallpaper-dim-value]')?.replaceChildren(preferences.themeWallpaperDim + '%');
    savePreferences(); applyPreferences();
    return;
  }
  if (event.target.matches('[data-wallpaper-grain-strength]')) {
    preferences.themeGrainStrength = Math.max(0.01, Math.min(0.25, Number(event.target.value) / 100));
    pageContent.querySelector('[data-wallpaper-grain-strength-value]')?.replaceChildren(Math.round(preferences.themeGrainStrength * 100) + '%');
    savePreferences(); applyPreferences();
    return;
  }
  if (event.target.matches('[data-wallpaper-vignette-strength]')) {
    preferences.themeVignetteStrength = Math.max(0.1, Math.min(2.5, Number(event.target.value) / 100));
    pageContent.querySelector('[data-wallpaper-vignette-strength-value]')?.replaceChildren(Math.round(preferences.themeVignetteStrength * 100) + '%');
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
  if (event.target.matches('[data-search-page-input]')) {
    // Typing just updates the query string; search fires only on Enter or
    // the search button — no automatic loading while typing.
    searchQuery = event.target.value;
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
    const draggedAxis = event.target.dataset.colorAxis;
    // hslToHex at lightness/saturation extremes loses hue (grey has none), so the
    // hex roundtrip would reset untouched sliders. Remember the slider values and
    // restore them: the sliders stay the source of truth while the user drags.
    const sliderHsl = { hue: value('hue'), saturation: value('saturation'), lightness: value('lightness') };
    preferences[name] = hslToHex(sliderHsl.hue, sliderHsl.saturation, sliderHsl.lightness);
    savePreferences();
    applyPreferences();
    syncColorTuner(name, preferences[name], ['hue', 'saturation', 'lightness']);
    // Re-assert every slider from the values the user set (not from the hex).
    for (const axis of ['hue', 'saturation', 'lightness']) {
      const input = tuner.querySelector(`[data-color-axis="${axis}"]`);
      const output = tuner.querySelector(`[data-color-value="${axis}"]`);
      if (input) input.value = sliderHsl[axis];
      if (output) output.value = `${sliderHsl[axis]}${axis === 'hue' ? '°' : '%'}`;
    }
    if (name === 'accent') document.querySelectorAll('.palette-option').forEach((button) => button.classList.toggle('active', button.dataset.accent === preferences.accent));
    return;
  }
  if (event.target.matches('[data-home-greeting]')) {
    preferences.homeGreeting = event.target.value.slice(0, 48);
    savePreferences();
    return;
  }
  if (event.target.hasAttribute('data-widget-title')) {
    const key = event.target.dataset.widgetTitle;
    preferences.homeSectionTitles = { ...(preferences.homeSectionTitles || {}), [key]: event.target.value.slice(0, 36) };
    savePreferences();
    return;
  }
  if (event.target.matches('[data-home-section-scale]')) {
    preferences.homeSectionScale = Math.max(0.8, Math.min(1.6, Number(event.target.value) || 1));
    pageContent.querySelector('[data-home-section-scale-value]')?.replaceChildren(Math.round(preferences.homeSectionScale * 100) + '%');
    savePreferences(); applyPreferences(); renderSidebar();
    return;
  }
  if (event.target.matches('[data-setting="glow"]')) {
    preferences.glow = Number(event.target.value);
    event.target.dataset.preview = `glow:${preferences.glow}`;
    savePreferences();
    applyPreferences();
    const value = document.getElementById('glow-value');
    if (value) value.textContent = `${preferences.glow}%`;
    if (activePreviewTarget === event.target) showHoverPreview(event.target);
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

function syncColorTuner(name, color, axesToSkip = []) {
  const field = pageContent.querySelector(`[data-color-field="${name}"]`);
  if (!field) return;
  const trigger = field.querySelector(`[data-color-open="${name}"]`);
  if (trigger) trigger.dataset.colorCurrent = color;
  field.querySelector('.color-swatch')?.style.setProperty('--sample-color', color);
  const code = field.querySelector(`[data-color-code="${name}"]`);
  if (code) code.textContent = color.toUpperCase();
}

document.addEventListener('dblclick', (event) => {
  if (event.target.closest('[data-window-drag]')) window.vortexDesktop?.toggleMaximizeWindow?.();
});

document.addEventListener('keydown', (event) => {
  const isTyping = event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName));
  if (event.key === 'Escape' && !document.getElementById('quick-game-modal')?.hidden) {
    event.preventDefault();
    closeQuickGameModal();
    return;
  }
  if (event.key === 'Escape' && !document.getElementById('quick-folder-modal')?.hidden) {
    event.preventDefault();
    closeQuickFolderModal();
    return;
  }
  if (event.key === 'Escape' && document.getElementById('friends-drawer')?.classList.contains('is-open')) {
    event.preventDefault();
    closeFriendsDrawer();
    document.querySelector('[data-action="toggle-friends-drawer"]')?.focus();
    return;
  }
  if (event.key === 'Tab') {
    const drawer = document.getElementById('friends-drawer');
    if (drawer?.classList.contains('is-open')) {
      const items = [...drawer.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((item) => !item.hidden);
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  // Escape always closes the palette, no matter where focus currently is.
  if (event.key === 'Escape' && paletteOpen()) {
    event.preventDefault();
    closeCommandPalette();
    return;
  }
  // ...and the announcements panel, before any other Escape handling.
  if (event.key === 'Escape' && announcementPanel) {
    event.preventDefault();
    closeAnnouncementsPanel();
    return;
  }
  const openMenu = document.querySelector('[data-custom-select] .custom-select-menu:not([hidden])');
  if (event.key === 'Escape' && openMenu) {
    event.preventDefault();
    openMenu.hidden = true;
    const trigger = openMenu.closest('[data-custom-select]').querySelector('[data-sort-toggle]');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
    return;
  }
  // User-configurable shortcuts, driven by preferences.hotkeys.
  if (matchesHotkey(event, hotkeyCombo('search'))) {
    event.preventDefault();
    if (paletteOpen()) closeCommandPalette();
    // Ctrl+K focuses the topbar search box instead of opening the palette.
    searchInput.focus();
    searchInput.select?.();
    return;
  }
  if (matchesHotkey(event, hotkeyCombo('palette'))) {
    event.preventDefault();
    if (paletteOpen()) closeCommandPalette();
    else openCommandPalette();
    return;
  }
  if (matchesHotkey(event, hotkeyCombo('settings'))) {
    event.preventDefault();
    if (paletteOpen()) closeCommandPalette();
    setView('settings');
    return;
  }
  if (matchesHotkey(event, hotkeyCombo('friends'))) {
    event.preventDefault();
    if (paletteOpen()) closeCommandPalette();
    setView('friends');
    return;
  }
  if (matchesHotkey(event, hotkeyCombo('sidebar')) && !isTyping) {
    event.preventDefault();
    toggleSidebarVisibility();
    return;
  }
  const quickShortcut = quickLaunchGames().find((item) => item.hotkey && matchesHotkey(event, item.hotkey));
  if (quickShortcut && !isTyping) {
    event.preventDefault();
    void launchQuickGame(quickShortcut.id);
    return;
  }
  // event.target may be document (not an Element), which has no matches().
  const targetIs = (selector) => typeof event.target?.matches === 'function' && event.target.matches(selector);
  if (event.key === 'Enter' && targetIs('[data-search-page-input]')) {
    event.preventDefault();
    submitSearchPage(event.target.value);
    return;
  }
  if (event.key === 'Escape' && targetIs('[data-search-page-input]')) {
    event.preventDefault();
    if (searchQuery) submitSearchPage('');
    return;
  }
  if (event.key === '/' && !isTyping) {
    event.preventDefault();
    searchInput.focus();
    return;
  }
  if (matchesHotkey(event, hotkeyCombo('back')) && currentView === 'game-detail') {
    event.preventDefault();
    if (navigationHistoryIndex > 0) navigateHistory(-1);
    else { setView('catalog'); restoreCatalogScroll(); }
    return;
  }
  if (event.key === 'Escape' && document.activeElement === searchInput) {
    searchInput.value = '';
    scheduleLiveSearch('');
    searchInput.blur();
  }
  if (event.key === 'Escape' && paletteOpen()) {
    event.preventDefault();
    closeCommandPalette();
  }
});

// ---------- Command palette (Stage 5) ----------
// Ctrl+K opens a palette that searches EVERYTHING: navigation views, settings
// tabs, theme presets, accent colors, toggles and quick actions. Arrow keys
// move, Enter runs, Escape closes. Typing filters by title and hint text.
let paletteState = { open: false, index: 0, items: [] };

function paletteOpen() { return paletteState.open; }

function paletteCommands() {
  const commands = [];
  // Navigation
  NAV_ITEMS.forEach((item) => commands.push({
    icon: item.icon, title: t(`nav.${item.key}`), hint: t('palette.go'), run: () => setView(item.key)
  }));
  // Settings tabs
  const tabs = [
    ['home', 'settings.home.title', 'home'], ['cards', 'settings.cardTuning.title', 'grid'], ['effects', 'settings.effects.title', 'wand'],
    ['interface', 'settings.ui.navTitle', 'monitor'], ['general', 'settings.language.title', 'message'], ['integrations', 'settings.integrations.title', 'sparkles'], ['data', 'settings.cache.title', 'database'], ['version', 'updates.settingsTitle', 'refreshCw'], ['accent', 'settings.theme.title', 'palette']
  ];
  tabs.forEach(([tab, key, ic]) => commands.push({
    icon: ic, title: t(key), hint: t('palette.openSettings'), run: () => { preferences.settingsTab = tab; savePreferences(); setView('settings'); }
  }));
  // Theme presets
  [['dark', 'moon'], ['light', 'sun'], ['oled', 'contrast']].forEach(([theme, ic]) => commands.push({
    icon: ic, title: t(`settings.${theme}`), hint: t('palette.theme'), run: () => { preferences.theme = theme; savePreferences(); applyPreferences(); renderPage(); }
  }));
  // Motion toggle
  commands.push({ icon: 'motion', title: t('settings.motion.title'), hint: t('palette.toggle'), run: () => { preferences.motion = !preferences.motion; savePreferences(); applyPreferences(); renderPage(); showToast(`${t('settings.motion.title')}: ${t(preferences.motion ? 'palette.on' : 'palette.off')}`); } });
  // Descriptions toggle (card element)
  commands.push({ icon: 'grid', title: t('settings.cardTuning.description'), hint: t('palette.toggle'), run: () => { preferences.cardShowDescription = !preferences.cardShowDescription; savePreferences(); renderPage(); showToast(`${t('settings.cardTuning.description')}: ${t(preferences.cardShowDescription ? 'palette.on' : 'palette.off')}`); } });
  // Playtime badge on cards
  commands.push({ icon: 'clock', title: t('settings.cardTuning.playtime'), hint: t('palette.toggle'), run: () => { preferences.cardShowPlaytime = !preferences.cardShowPlaytime; savePreferences(); renderPage(); showToast(`${t('settings.cardTuning.playtime')}: ${t(preferences.cardShowPlaytime ? 'palette.on' : 'palette.off')}`); } });
  // Like badges on cards
  commands.push({ icon: 'thumb', title: t('settings.cardTuning.likes'), hint: t('palette.toggle'), run: () => { preferences.cardShowLikes = !preferences.cardShowLikes; savePreferences(); renderPage(); showToast(`${t('settings.cardTuning.likes')}: ${t(preferences.cardShowLikes ? 'palette.on' : 'palette.off')}`); } });
  // Discord Rich Presence
  commands.push({ icon: 'sparkle', title: t('settings.integrations.discord'), hint: t('palette.toggle'), run: () => { preferences.discordPresence = !preferences.discordPresence; savePreferences(); applyDiscordPresence(); renderPage(); showToast(`${t('settings.integrations.discord')}: ${t(preferences.discordPresence ? 'palette.on' : 'palette.off')}`); } });
  // Friend alerts
  commands.push({ icon: 'bell', title: t('settings.integrations.friendAlerts'), hint: t('palette.toggle'), run: () => { preferences.friendFavoriteAlerts = !preferences.friendFavoriteAlerts; savePreferences(); renderPage(); showToast(`${t('settings.integrations.friendAlerts')}: ${t(preferences.friendFavoriteAlerts ? 'palette.on' : 'palette.off')}`); } });
  // Catalog view switch
  commands.push({ icon: 'grid', title: t('catalog.gridView'), hint: t('palette.view'), run: () => { preferences.catalogView = 'grid'; savePreferences(); setView('catalog'); } });
  commands.push({ icon: 'layout', title: t('catalog.listView'), hint: t('palette.view'), run: () => { preferences.catalogView = 'list'; savePreferences(); setView('catalog'); } });
  // Cache sweep
  commands.push({ icon: 'rotate', title: t('settings.cacheClear'), hint: t('palette.action'), run: () => { for (const key of Object.keys(localStorage)) if (key.startsWith('vortex.') && !key.startsWith('vortex.preferences') && !key.startsWith('vortex.profiles')) localStorage.removeItem(key); showToast(t('settings.cache.cleared')); renderPage(); } });
  // Update check
  commands.push({ icon: 'download', title: t('updates.checkNow'), hint: t('palette.action'), run: () => { preferences.settingsTab = 'version'; savePreferences(); setView('settings'); window.vortexDesktop?.retryUpdateCheck?.(); } });
  return commands;
}

function openCommandPalette() {
  paletteState = { open: true, index: 0, items: paletteCommands() };
  let root = document.getElementById('command-palette');
  if (!root) {
    root = document.createElement('div');
    root.id = 'command-palette';
    root.innerHTML = `<div class="palette-backdrop" data-palette-close></div>
      <div class="palette-panel" role="dialog" aria-modal="true" aria-label="${t('palette.title')}">
        <div class="palette-input-row"><span class="palette-input-icon"></span><input type="text" class="palette-input" placeholder="${t('palette.placeholder')}" autocomplete="off" spellcheck="false" /></div>
        <div class="palette-list" role="listbox"></div>
        <div class="palette-foot"><span>${t('palette.navigate')}</span><span>${t('palette.run')}</span><span>${t('palette.close')}</span></div>
      </div>`;
    document.body.appendChild(root);
    root.querySelector('.palette-input').addEventListener('input', renderPaletteList);
    root.querySelector('.palette-input').addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        paletteState.index = Math.max(0, Math.min(paletteState.filtered.length - 1, paletteState.index + delta));
        renderPaletteSelection();
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        runPaletteIndex(paletteState.index);
      }
    });
    root.addEventListener('click', (event) => {
      if (event.target.closest('[data-palette-close]')) { closeCommandPalette(); return; }
      const row = event.target.closest('[data-palette-index]');
      if (row) runPaletteIndex(Number(row.dataset.paletteIndex));
    });
  }
  root.hidden = false;
  renderPaletteList();
  const input = root.querySelector('.palette-input');
  input.value = '';
  input.focus();
}

function closeCommandPalette() {
  const root = document.getElementById('command-palette');
  if (root) root.hidden = true;
  paletteState.open = false;
}

function renderPaletteList() {
  const root = document.getElementById('command-palette');
  if (!root) return;
  const query = root.querySelector('.palette-input').value.trim().toLocaleLowerCase(preferences.language);
  paletteState.filtered = paletteState.items.filter((item) => {
    const haystack = `${item.title} ${item.hint}`.toLocaleLowerCase(preferences.language);
    return !query || haystack.includes(query);
  });
  paletteState.index = Math.min(paletteState.index, Math.max(0, paletteState.filtered.length - 1));
  const list = root.querySelector('.palette-list');
  list.innerHTML = paletteState.filtered.map((item, index) => `
    <button class="palette-row ${index === paletteState.index ? 'active' : ''}" data-palette-index="${index}" role="option" aria-selected="${index === paletteState.index}">
      <span class="palette-row-icon">${icon(item.icon, 14)}</span>
      <span class="palette-row-title">${escapeHtml(item.title)}</span>
      <span class="palette-row-hint">${escapeHtml(item.hint)}</span>
    </button>`).join('') || `<p class="palette-empty">${t('palette.noResults')}</p>`;
}

function renderPaletteSelection() {
  const root = document.getElementById('command-palette');
  if (!root) return;
  root.querySelectorAll('.palette-row').forEach((row) => {
    const active = Number(row.dataset.paletteIndex) === paletteState.index;
    row.classList.toggle('active', active);
    row.setAttribute('aria-selected', String(active));
  });
  root.querySelector('.palette-row.active')?.scrollIntoView({ block: 'nearest' });
}

function runPaletteIndex(index) {
  const item = paletteState.filtered && paletteState.filtered[index];
  closeCommandPalette();
  if (item) item.run();
}

// Classic scripts run before ES modules: wait for the module bundle to be
// published on window, then boot. If it never arrives (module error), boot
// with the fallback shims after a short grace period.
// Friend card hover preview: floating panel with avatar, name, game and a
// join action. Sits above the grid and follows the hovered card.
let friendPreviewEl = null;
let friendPreviewCard = null;
function showFriendPreview(card) {
  if (!card || card.classList.contains('offline')) {
    hideFriendPreview();
    return;
  }
  if (friendPreviewCard === card && friendPreviewEl?.isConnected) return;
  hideFriendPreview();
  friendPreviewCard = card;
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
  friendPreviewCard = null;
}
document.addEventListener('pointerover', (event) => {
  const card = event.target.closest?.('.friend-card');
  if (card) {
    if (!card.contains(event.relatedTarget)) showFriendPreview(card);
  } else if (event.target.closest?.('.friend-preview')) {
    return;
  } else {
    hideFriendPreview();
  }
});
document.addEventListener('pointerout', (event) => {
  const card = event.target.closest?.('.friend-card');
  if (card && !card.contains(event.relatedTarget) && !friendPreviewEl?.contains(event.relatedTarget)) hideFriendPreview();
});
document.addEventListener('focusin', (event) => {
  const card = event.target.closest?.('.friend-card');
  if (card) showFriendPreview(card);
});
document.addEventListener('focusout', (event) => {
  const card = event.target.closest?.('.friend-card');
  if (card && !card.contains(event.relatedTarget) && !card.matches(':hover')) hideFriendPreview();
});
document.addEventListener('scroll', hideFriendPreview, true);

function bootVortex() {
restorePlaySession();
mountIcons();
renderSidebar();
applyPreferences();
renderPage();
// Hovering the thin left strip peeks the rail; leaving the rail hides it again.
document.querySelector('.sidebar-hover-zone')?.addEventListener('mouseenter', () => {
  document.body.classList.add('sidebar-peek');
});
document.getElementById('app-sidebar')?.addEventListener('mouseleave', () => {
  document.body.classList.remove('sidebar-peek');
});
void refreshRobloxAccount();
void refreshQuickLaunchMetadata();
reportRecentGamesToTray();
runtimePollTimer = window.setInterval(pollRobloxRuntime, 15 * 1000);
window.setTimeout(pollRobloxRuntime, 4000);
window.addEventListener('focus', pollRobloxRuntime);
window.addEventListener('beforeunload', closePlaySession);
// The desktop close action may hide the window into the tray, so unload is not
// guaranteed. Periodic checkpoints keep playtime accurate without ending the
// current session when the launcher is merely hidden.
window.setInterval(checkpointPlaySession, 60 * 1000);
window.vortexDesktop?.onWindowState?.(({ isMaximized }) => setWindowMaximized(Boolean(isMaximized)));
window.vortexDesktop?.onUpdateState?.(renderUpdateBanner);
window.vortexDesktop?.onTrayLaunch?.(({ kind, id }) => {
  if (kind === 'quick') void launchQuickGame(String(id));
  else if (kind === 'favorite') openGame(String(id));
});
window.vortexDesktop?.getUpdateState?.().then(renderUpdateBanner).catch(() => {});
hydrateFeaturedGames();
loadDiscoveryCatalog(activeDiscoverySort);
applyDiscordPresence();
if (preferences.discordPresence) refreshDiscordStatus();
loadAnnouncements();
startAnnouncementPolling();
// Coming back from the tray is the moment a user expects fresh news.
window.addEventListener('focus', () => loadAnnouncements());
}

bootVortex();
