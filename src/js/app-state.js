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
  { key: 'violet', color: '#a68bff' },
  { key: 'lavender', color: '#b9a4ff' },
  { key: 'orchid', color: '#c274ec' },
  { key: 'iris', color: '#7b6cff' },
  { key: 'periwinkle', color: '#8f9cff' },
  { key: 'rose', color: '#e58bb6' },
  { key: 'mint', color: '#75c9a8' },
  { key: 'amber', color: '#e0b06a' },
  { key: 'crimson', color: '#e37680' },
  { key: 'slate', color: '#9a97ae' }
];

// Navigation order is user-configurable in Settings → Interface. Primary
// destinations and library links retain separate saved ordering in the sidebar.
const NAV_ITEMS = [
  { key: 'home', icon: 'home', group: 'topbar' },
  { key: 'catalog', icon: 'catalog', group: 'topbar' },
  { key: 'friends', icon: 'users', group: 'topbar' },
  { key: 'library', icon: 'book', group: 'menu' },
  { key: 'plans', icon: 'flag', group: 'menu' },
  // Settings live next to the profile at the very bottom of the sidebar.
  { key: 'settings', icon: 'settings', group: 'bottom' }
];
const NAV_KEYS = NAV_ITEMS.map((item) => item.key);

function navOrder(group = 'menu') {
  const items = NAV_ITEMS.filter((item) => item.group === group);
  const validKeys = items.map((item) => item.key);
  const stored = group === 'topbar' ? preferences.topbarOrder : preferences.sidebarOrder;
  const keys = Array.isArray(stored) ? stored.filter((key) => validKeys.includes(key)) : [];
  return [...new Set([...keys, ...validKeys])];
}

function navItemMarkup(item) {
  const label = t(`nav.${item.key}`);
  return `<button class="nav-item" type="button" data-nav="${item.key}" aria-label="${label}" data-tooltip="${label}"><span class="nav-icon" data-icon="${item.icon}"></span><span>${label}</span></button>`;
}

function renderSidebarNav() {
  const topbarItems = navOrder('topbar').map((key) => NAV_ITEMS.find((item) => item.key === key)).filter(Boolean);
  const menuItems = navOrder('menu').map((key) => NAV_ITEMS.find((item) => item.key === key)).filter(Boolean);
  const bottomItems = navOrder('bottom').map((key) => NAV_ITEMS.find((item) => item.key === key)).filter(Boolean);
  const group = (name) => menuItems.filter((item) => item.group === name).map(navItemMarkup).join('');
  return {
    topbar: topbarItems.map(navItemMarkup).join(''),
    menu: group('menu'),
    space: group('space'),
    bottom: bottomItems.map(navItemMarkup).join('')
  };
}

const preferenceDefaults = {
  accent: '#a68bff', accentMode: 'solid', accentSecondary: '#5b3fd6', gradientAngle: 135,
  theme: 'dark', themeBackground: '', themeSurface: '',
  density: 'comfortable', corners: 'soft', showDescriptions: true, showStats: true,
  homeGreeting: '', customGames: [], homeFeaturedGame: '', homePicks: [], homeGameCount: 4, quickLaunchItems: [], gameLaunchOptions: {},
  favoriteCollections: [], activityWeeklyGoal: 0, activityBreakHours: 0,
  homeShowHero: true, homeShowRecommendations: true,
  homeLayout: 'balanced', homeGameView: null, homeMinimal: false,
  sidebarOrder: [], topbarOrder: [], uiSidebarTip: true, uiProfileCard: true, uiTopbarSearch: true,
  uiBreadcrumb: true, uiNotifications: true, uiSidebarFoot: true, uiUpdateBanner: true, uiTooltips: true,
  pageTransition: 'fade', cardAnimation: 'rise', animationEasing: 'smooth', animationDuration: 1, glow: 72, ambient: true, motion: true,
  contrast: false, language: 'ru', saveHistory: true, settingsTab: 'home', trayScale: 'normal', robloxUsername: '', friendsNoticeAccepted: false,
  robloxAccountId: '', robloxDisplayName: '', robloxAvatar: '',
  themeText: '', themeMuted: '', themeLine: '',
  themeWallpaper: '', themeWallpaperBlur: 14, themeWallpaperDim: 45, themeGrain: false, themeGrainStrength: 0.05, themeVignette: false, themeVignetteStrength: 1,
  cardSize: 1, cardRadius: 12, customCardRadius: false, cardShowDescription: true, cardShowLikes: true, cardShowPlaytime: true, cardShowGenre: true,
  homeWidgetOrder: [], homeWidgetHidden: [], homeWidgetCollapsed: [], animationSpeed: 'normal',
  homeSectionTitles: {}, homeSectionScale: 1, catalogView: 'grid', catalogGenre: 'all', catalogAccess: 'all', cardAspect: 'wide', glassStrength: 84, themeSchedule: 'manual', scheduleDay: 'dark', scheduleNight: 'oled', sidebarAutoHide: false, uiFont: 'modern',
  discordPresence: false, friendFavoriteAlerts: false, discordClientId: '', streamMode: false, gamingMode: true, textScale: 100,
  gameOverlay: false, gameOverlayCorner: 'top-right', gameOverlayCustomX: 96, gameOverlayCustomY: 4,
  gameOverlayScale: 100, gameOverlayGap: 5, gameOverlayOpacity: 74,
  gameOverlayHideFullscreen: false, gameOverlayMinimal: false,
  gameOverlayTimer: true, gameOverlayFps: true, gameOverlayPing: true, gameOverlayStability: false,
  gameOverlayRegion: true, gameOverlayBadPingPrompt: true, gameOverlaySystem: false, gameOverlayFriendJoin: true,
  gameOverlayClock: false, gameOverlayFriends: true,
  inviteHotkey: 'Alt+C', overlayToggleHotkey: '', muteRobloxHotkey: '',
  serverHopHotkey: '', serverHopMode: 'low-ping', serverHopRegion: 'any', serverHopExcludeVisited: true, rejoinHotkey: '',
  showPrivateServers: true,
  confirmLaunch: false, confirmDelete: true,
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
  'homeLayout', 'homeGameView', 'homeMinimal', 'homeShowHero', 'homeShowRecommendations',
  'density', 'corners', 'showDescriptions', 'showStats',
  'pageTransition', 'cardAnimation', 'animationSpeed', 'animationEasing', 'animationDuration', 'glow', 'ambient', 'motion', 'contrast',
  'sidebarOrder', 'topbarOrder', 'uiSidebarTip', 'uiProfileCard', 'uiTopbarSearch', 'uiBreadcrumb', 'uiNotifications', 'uiSidebarFoot', 'uiUpdateBanner', 'uiTooltips', 'sidebarAutoHide', 'uiFont'
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
  try { const value = accountStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
};
const preferences = { ...preferenceDefaults, ...readStored('vortex.preferences', {}) };
// Preserve the original migration of legacy implicit "auto" covers,
// while keeping "auto" available if the user picks it again later.
if (accountStorage.getItem('vortex.cardAspectDefault') !== 'square') {
  if (preferences.cardAspect === 'auto') preferences.cardAspect = 'square';
  accountStorage.setItem('vortex.cardAspectDefault', 'square');
  accountStorage.setItem('vortex.preferences', JSON.stringify(preferences));
}
preferences.streamMode = readStored(streamModeKey, preferences.streamMode);
window.preferences = preferences;
let favorites = new Set(readStored('vortex.favorites', []));
let recentGames = readStored('vortex.recent', []);
if (!Array.isArray(recentGames)) recentGames = [];
// Per-game totals follow the confirmed daily ledger; launch counts and the
// last-played timestamp are stored here alongside them.
let playStats = readStored('vortex.playStats', {});
let activityData = normalizeActivityData(readStored('vortex.activity', null));
if (!activityClockIsValid(activityData)) {
  activityData.days = {};
  playStats = synchronizePlayStats(playStats, activityData.days);
}
let activityClockReady;
const ACTIVITY_GAME_MINUTES = 10;
const ACTIVITY_DAILY_GAMES = 2;
const PLAYTIME_SESSION_KEY = 'vortex.playSession';
let playSessionStart = null;
let playSessionGameId = null;
let runtimeSessionKey = '';
let runtimeSample = null;
let runtimeConfirmedAt = 0;
let runtimePollBusy = false;
let runtimePollTimer = null;
let runtimeOwner = false;
let pendingLaunch = null;
let lastResolvedAttempt = 0;
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
let addingQuickGameToFolder = '';
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
let detailDescriptionExpanded = false;
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
if (activeDiscoverySort === 'gems') activeDiscoverySort = 'like-percentage';
function createSearchSessionId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0;
    return (character === 'x' ? random : (random & 3 | 8)).toString(16);
  });
}

let discoverySessionId = readStored('vortex.discoverySessionId', '') || createSearchSessionId();
let discoveryStatus = 'idle';
let discoveryRequestId = 0;
let catalogVisibleCount = CATALOG_PAGE_SIZE;

// Catalog recommendations are a pseudo Discover sort built locally from the
// games the user actually plays and keeps in favorites.
const RECOMMENDED_SORT = { id: 'recommended', title: 'For you' };
let recommendationState = newRecommendationState();

function catalogSorts() {
  const available = new Map([...fallbackDiscoverySorts, ...discoverySorts].map(sort => [sort.id, sort]));
  available.delete('gems');
  for (const sort of [RECOMMENDED_SORT, { id: 'top-rated', title: 'Top Rated' }, { id: 'like-percentage', title: 'Like percentage' }]) {
    available.set(sort.id, sort);
  }
  return [...catalogSortOrder.map(id => available.get(id)).filter(Boolean),
    ...[...available.values()].filter(sort => !catalogSortOrder.includes(sort.id))];
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
  accountStorage.setItem('vortex.preferences', JSON.stringify(preferences));
  // Any preference change may affect the tray's look, so it re-reports its
  // style payload together with the recent games on every save.
  reportRecentGamesToTray();
  reportGameOverlay();
}

// Compact color field: the full picker lives in a popover that opens on click,
// so the settings page stays dense and the picker itself matches the app.
function renderColorTuner(name, color, label) {
  return `<div class="color-field" data-color-field="${name}">
    <span class="color-field-label">${label}</span>
    <button class="color-trigger control-button" type="button" data-color-open="${name}" data-color-current="${color}" aria-haspopup="dialog" aria-expanded="false" aria-label="${escapeHtml(label)}">
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
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : '#a68bff';
}

function syncFolderColorTrigger() {
  const inputValue = document.querySelector('[data-folder-color-value]')?.value;
  const value = /^#[0-9a-f]{6}$/i.test(String(inputValue || '')) ? String(inputValue).toLowerCase() : '#a68bff';
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
      <div class="color-presets" role="group" aria-label="${t('settings.accent.title')}">${palettes.map((palette) => `<button type="button" class="color-preset" data-color-preset="${palette.color}" style="--preset:${palette.color}" data-tooltip="${escapeHtml(t(`palette.${palette.key}`))}" aria-label="${escapeHtml(t(`palette.${palette.key}`))}"></button>`).join('')}</div>
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
      const color = /^#[0-9a-f]{6}$/i.test(String(item.color || '')) ? String(item.color).toLowerCase() : '#a68bff';
      return { type: 'folder', id, title: String(item.title || '').trim().slice(0, 48), color, games,
        showInTray: item.showInTray !== false, server: ['ping', 'small'].includes(item.server) ? item.server : 'default' };
    }
    if (item.type !== 'game') return null;
    const method = ['private', 'share', 'public', 'instance', 'access'].includes(item.method) ? item.method : 'public';
    const placeId = String(item.placeId || '').trim();
    const linkCode = String(item.linkCode || '').trim();
    const shareCode = String(item.shareCode || '').trim();
    if (method !== 'share' && !/^\d{1,20}$/.test(placeId)) return null;
    if (method === 'share' && placeId && !/^\d{1,20}$/.test(placeId)) return null;
    if (method === 'private' && !/^[a-z\d_-]{1,100}$/i.test(linkCode)) return null;
    if (method === 'share' && !/^[a-z\d_-]{1,128}$/i.test(shareCode)) return null;
    const serverId = String(item.serverId || '');
    const accessCode = String(item.accessCode || '');
    if (method === 'instance' && !/^[a-z0-9-]{5,64}$/i.test(serverId)) return null;
    if (method === 'access' && !/^[a-z0-9-]{8,100}$/i.test(accessCode)) return null;
    const rawHotkey = item.hotkey && typeof item.hotkey === 'object' ? item.hotkey : null;
    return {
      type: 'game', id, method, placeId,
      serverId: method === 'instance' ? serverId : '', accessCode: method === 'access' ? accessCode : '',
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

let accountRobuxBalance = null;

function formatRobuxValue(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num < 0) return '';
  return Math.floor(num).toLocaleString(preferences.language === 'en' ? 'en-US' : 'ru-RU');
}

function renderAccountRobux() {
  const host = document.querySelector('[data-account-robux]');
  if (!host) return;
  if (preferences.streamMode || accountRobuxBalance === null) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }
  const formatted = formatRobuxValue(accountRobuxBalance);
  const label = preferences.language === 'en' ? 'Robux balance' : 'Баланс Robux';
  host.hidden = false;
  host.setAttribute('data-tooltip', `${label}: ${formatted} R$`);
  host.setAttribute('aria-label', `${label}: ${formatted} R$`);
  host.innerHTML = `<svg class="robux-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2.2 20.4 7v10L12 21.8 3.6 17V7L12 2.2Zm0 2.3L5.6 8.15v7.7L12 19.5l6.4-3.65v-7.7L12 4.5ZM9.2 9.2h5.6v5.6H9.2V9.2Z"/></svg><span>${escapeHtml(formatted)}</span>`;
}

// Topbar avatar: the local Roblox headshot once the account is known (cookie or
// the local Roblox folder), otherwise the first letter / V fallback.
function renderAccountAvatar() {
  const host = document.querySelector('[data-account-avatar]');
  if (!host) return;
  const avatar = preferences.streamMode ? '' : safeThumbnail(preferences.robloxAvatar);
  const name = String(preferences.robloxDisplayName || preferences.robloxUsername || 'V').trim();
  const initial = preferences.streamMode ? 'V' : (name[0] || 'V').toLocaleUpperCase();
  host.classList.toggle('has-image', Boolean(avatar));
  host.innerHTML = avatar
    ? `<span class="avatar-photo" style="--avatar-image:url('${escapeHtml(avatar)}')" aria-hidden="true"></span>`
    : escapeHtml(initial);
  renderAccountRobux();
}

function rememberRobloxAccount(account) {
  if (!account || (activeAccountProfile !== 'default' && preferences.robloxUsername && account.name &&
      preferences.robloxUsername.toLowerCase() !== String(account.name).toLowerCase())) return false;
  preferences.robloxAccountId = /^\d{1,20}$/.test(String(account.id || '')) ? String(account.id) : preferences.robloxAccountId;
  preferences.robloxDisplayName = String(account.displayName || account.name || '').slice(0, 32);
  const avatar = safeThumbnail(account.avatar);
  if (avatar) preferences.robloxAvatar = avatar;
  if (Number.isFinite(Number(account.robux)) && Number(account.robux) >= 0) {
    accountRobuxBalance = Math.floor(Number(account.robux));
  }
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
  applyLauncherModes();
  if (!['ru', 'en'].includes(preferences.language)) preferences.language = 'ru';
  if (!settingsTabsList.some(([tab]) => tab === preferences.settingsTab)) preferences.settingsTab = 'home';
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
  preferences.sidebarOrder = [...new Set(legacyOrder.map(key => libraryTabs.some(tab => tab.id === key) ? 'library' : key)
    .filter((key) => NAV_ITEMS.find((item) => item.key === key)?.group === 'menu'))];
  if (!Array.isArray(preferences.topbarOrder)) preferences.topbarOrder = [];
  const savedTopbar = preferences.topbarOrder.filter((key) => NAV_ITEMS.find((item) => item.key === key)?.group === 'topbar');
  preferences.topbarOrder = [...new Set([...(savedTopbar.length ? savedTopbar : legacyOrder.filter((key) => NAV_ITEMS.find((item) => item.key === key)?.group === 'topbar')), ...NAV_ITEMS.filter((item) => item.group === 'topbar').map((item) => item.key)])];
  preferences.quickLaunchItems = cleanQuickLaunchItems(preferences.quickLaunchItems);
  for (const flag of ['uiSidebarTip', 'uiProfileCard', 'uiTopbarSearch', 'uiBreadcrumb', 'uiNotifications', 'uiSidebarFoot', 'uiUpdateBanner', 'uiTooltips']) {
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
  // Older installs shared the catalog setting. Keep their starting home layout.
  if (!['grid', 'list'].includes(preferences.homeGameView)) preferences.homeGameView = preferences.catalogView;
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
    dark: { background: '#0f0e15', surface: '#17161f' },
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
  root.setProperty('--text', preferences.themeText || (isLightCanvas ? '#211e2a' : '#eceaf5'));
  root.setProperty('--muted', preferences.themeMuted || (isLightCanvas ? '#777382' : '#9a97ae'));
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
  window.vortexOverlays.enableTooltips(preferences.uiTooltips);
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

