const viewNames = { home: 'nav.home', catalog: 'nav.catalog', search: 'nav.search', library: 'nav.library', friends: 'nav.friends', plans: 'nav.plans', settings: 'nav.settings' };

function quickGameAvatarMarkup(item) {
  const thumbnail = safeThumbnail(item.thumbnail);
  return `<span class="quick-launch-avatar">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" decoding="async" />` : icon('gamepad', 16)}<span class="quick-play-overlay" aria-hidden="true">${icon('play', 16)}</span></span>`;
}

function quickGameRowMarkup(item, nested = false) {
  const privateItem = item.method !== 'public';
  const restricted = preferences.streamMode && privateItem;
  const title = restricted ? t('tools.privateShortcut') : item.title || t('quick.untitled');
  return `<div class="quick-launch-row" data-quick-id="${escapeHtml(item.id)}" ${nested ? 'data-quick-nested="true"' : `data-quick-drop-game="${escapeHtml(item.id)}"`}>
      <button class="quick-launch-button" type="button" data-quick-launch="${escapeHtml(item.id)}" data-tooltip="${escapeHtml(title)}" aria-label="${t('quick.launchNamed', { title: escapeHtml(title) })}">${quickGameAvatarMarkup(restricted ? {} : item)}<span class="quick-launch-copy"><strong>${escapeHtml(title)}</strong>${item.hotkey ? `<small>${escapeHtml(formatHotkey(item.hotkey))}</small>` : ''}</span></button>
      <span class="quick-launch-tools">
        <button ${restricted || item.method === 'instance' ? 'hidden' : ''} class="quick-launch-tool" type="button" data-quick-edit="${escapeHtml(item.id)}" aria-label="${t('quick.edit')}" data-tooltip="${t('quick.edit')}">${icon('edit', 12)}</button>
        <button class="quick-launch-tool ${item.hotkey ? 'has-hotkey' : ''}" type="button" data-quick-hotkey="${escapeHtml(item.id)}" aria-label="${item.hotkey ? t('quick.clearHotkey') : t('quick.setHotkey')}" data-tooltip="${item.hotkey ? t('quick.clearHotkey') : t('quick.setHotkey')}">${icon('keyboard', 12)}</button>
        <button ${restricted || ['access','instance'].includes(item.method) ? 'hidden' : ''} class="quick-launch-tool" type="button" data-quick-share="${escapeHtml(item.id)}" aria-label="${t('quick.share')}" data-tooltip="${t('quick.share')}">${icon('share', 12)}</button>
        <button ${restricted ? 'hidden' : ''} class="quick-launch-tool" type="button" data-launcher-action="shortcut" data-quick="true" data-id="${escapeHtml(item.id)}" aria-label="${t('tools.shortcut')}" data-tooltip="${t('tools.shortcut')}">${icon('windowMaximize', 12)}</button>
        <button class="quick-launch-tool remove" type="button" data-quick-remove="${escapeHtml(item.id)}" data-i18n-aria="quick.remove" aria-label="${t('quick.remove')}" data-tooltip="${t('quick.remove')}">${icon('close', 12)}</button>
      </span>
    </div>`;
}

function quickFolderMarkup(folder) {
  const open = quickFoldersOpen.has(folder.id);
  const folderTitle = folder.title || t('quick.folderDefault');
  const color = /^#[0-9a-f]{6}$/i.test(String(folder.color || '')) ? folder.color : '#a68bff';
  const previews = folder.games.slice(0, 4).map((game) => {
    const thumbnail = safeThumbnail(game.thumbnail);
    return `<span class="quick-folder-thumb">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" decoding="async" />` : icon('gamepad', 9)}</span>`;
  }).join('');
  return `<div class="quick-folder" data-quick-folder="${escapeHtml(folder.id)}" aria-expanded="${open}" style="--folder-color:${escapeHtml(color)}">
      <div class="quick-launch-row" data-quick-drop-folder="${escapeHtml(folder.id)}">
        <button class="quick-launch-button" type="button" data-quick-folder-toggle="${escapeHtml(folder.id)}" aria-expanded="${open}" data-tooltip="${escapeHtml(folderTitle)}" aria-label="${escapeHtml(folderTitle)}">
          <span class="quick-folder-chevron">${icon('chevronLeft', 11)}</span><span class="quick-folder-stack">${previews}</span><span class="quick-launch-copy"><strong>${escapeHtml(folderTitle)}</strong></span>
        </button>
        <span class="quick-folder-tools">
          ${preferences.streamMode ? '' : `<button class="quick-folder-tool" type="button" data-launcher-action="folder-export" data-id="${escapeHtml(folder.id)}" aria-label="${t('tools.shareFolder')}" data-tooltip="${t('tools.shareFolder')}">${icon('share', 12)}</button>`}
          <button class="quick-folder-tool" type="button" data-quick-folder-edit="${escapeHtml(folder.id)}" aria-label="${t('quick.folderEdit')}" data-tooltip="${t('quick.folderEdit')}">${icon('edit', 12)}</button><button class="quick-launch-remove" type="button" data-quick-remove="${escapeHtml(folder.id)}" aria-label="${t('quick.remove')}" data-tooltip="${t('quick.remove')}">${icon('close', 12)}</button></span>
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
  if (releaseLogRoutes.has(view)) {
    showReleaseLog(view, { track: false });
  } else if (view === 'game-detail') {
    if (!detailGame) { navigationHistoryIndex += direction < 0 ? -1 : 1; return; }
    currentView = 'game-detail';
    renderPage();
    updateNavigationHistoryControls();
  } else if (currentView === 'game-detail' && catalogReturn?.view === view) {
    returnToSavedCatalog({ track: false });
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
  const activeView = ['game-detail', 'search'].includes(currentView) ? 'catalog' : libraryTabs.some(tab => tab.id === currentView) ? 'library' : currentView;
  document.querySelectorAll('[data-nav]').forEach((button) => {
    if (button.closest('.library-tabs')) return;
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
  button.dataset.tooltip = label;
  button.setAttribute('aria-expanded', String(!collapsed));
}

function renderPage() {
  window.vortexOverlays.closeTooltip();
  window.vortexOverlays.closeMenu();
  playtimeSummary = null;
  hideHoverPreview();
  hideFriendPreview();
  applyPreferences();
  searchInput.placeholder = t(currentView === 'catalog' ? 'chart.searchPlaceholder' : 'search.placeholder');
  reportRecentGamesToTray();
  reportGameOverlay();
  document.body.classList.toggle('sidebar-compact', readStored('vortex.sidebarCompact', window.innerWidth <= 940));
  updateSidebarCollapse();
  updateSidebar();
  updateNavigationHistoryControls();
  renderUpdateBanner();
  const pages = { home: renderHome, catalog: renderCatalog, 'game-detail': renderGameDetail, 'release-log': renderReleaseLog, library: renderLibrary,
    favorites: renderLibrary, recent: renderLibrary, quick: renderLibrary, activity: renderLibrary, friends: renderFriends, plans: renderPlans, settings: renderSettings };
  const viewKey = currentView === 'settings' ? 'settings/' + preferences.settingsTab
    : currentView === 'catalog' ? ['catalog', activeDiscoverySort, activeCategory, activeAccess].join('/')
    : currentView === 'game-detail' ? 'game/' + detailGame?.id
    : currentView === 'release-log' ? shownReleaseLog
    : currentView === 'plans' ? 'plans/' + roadmapStage : currentView === 'activity' ? 'activity/' + libraryActivityPane : currentView;
  const sameView = pageContent.dataset.renderedView === viewKey;
  const gamePaneFocus = currentView === 'game-detail' && document.activeElement.matches?.('[role="tab"][data-game-pane]')
    ? document.activeElement.id : '';
  const activityControl = sameView && currentView === 'activity' ? document.activeElement?.dataset.activityControl : '';
  const movingCards = '.game-grid [data-game], .catalog-tile[data-game]';
  const existing = sameView ? new Set([...pageContent.querySelectorAll(movingCards)].map(el => el.dataset.game)) : null;
  pageContent.innerHTML = (pages[currentView] || renderHome)();
  renderGameTabs();
  if (gamePaneFocus) document.getElementById(gamePaneFocus)?.focus({ preventScroll: true });
  focusActivityControl(activityControl);
  if (existing) for (const card of pageContent.querySelectorAll(movingCards)) {
    card.classList.add(existing.has(card.dataset.game) ? 'motion-retained' : 'motion-added');
  }
  mountIcons(pageContent);
  bindRecommendationScroll();
  if (currentView === 'plans') void loadRoadmap();
  if (currentView === 'settings') refreshDiscordStatus();
  if (preferences.discordPresence) applyDiscordPresence();
  if (pageContent.dataset.renderedView !== viewKey) {
    pageContent.dataset.renderedView = viewKey;
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
  const visibleStatuses = ['available', 'downloading', 'downloaded', 'applying', 'error'];
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
  const totalBytes = Number(latestUpdateState.totalBytes) || 0;
  const downloadedBytes = Number(latestUpdateState.downloadedBytes) || 0;
  const speedBps = Number(latestUpdateState.speedBps) || 0;
  const transferInfo = totalBytes > 0
    ? ` · ${(downloadedBytes / 1048576).toFixed(1)} / ${(totalBytes / 1048576).toFixed(1)} ${t('unit.mb')}${speedBps > 0 ? ` (${speedBps >= 1048576 ? `${(speedBps / 1048576).toFixed(1)} ${t('unit.mbps')}` : `${Math.max(1, Math.round(speedBps / 1024))} ${t('unit.kbps')}`})` : ''}`
    : '';
  const message = status === 'available' ? t('updates.available')
    : status === 'downloaded' ? t('updates.ready')
      : status === 'applying' ? t('updates.applying')
        : status === 'error' ? t('updates.error', { error: escapeHtml(latestUpdateState.errorMessage || 'Unknown error') })
          : `${stageText ? `${stageText} · ` : ''}${t('updates.downloading', { percent: progress })}${transferInfo}`;
  banner.dataset.status = status;
  banner.hidden = false;
  const bannerAction = status === 'available'
    ? `<button class="primary-button update-banner-install" data-action="install-update">${t('updates.downloadNow')}</button>`
    : status === 'downloaded'
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
const DATA_EXPORT_VERSION = 2;
const MAX_BACKUP_BYTES = 128 * 1024 * 1024;
const BACKUP_SECTIONS = {
  settings: ['profiles'],
  library: ['favorites', 'customGames'],
  folders: [],
  friends: ['friendPins'],
  activity: ['recentGames', 'recentDetails', 'activityData', 'playStats', 'sessionHistory']
};
const LOCAL_BACKUP_PREFERENCES = new Set([
  'robloxUsername', 'robloxDisplayName', 'robloxAvatar', 'robloxAccountId',
  'friendsNoticeAccepted', 'settingsTab', 'streamMode', 'customGames', 'quickLaunchItems'
]);
const isBackupObject = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function backupPreferences(source) {
  return Object.fromEntries(Object.entries(source).filter(([key, value]) => {
    if (!Object.hasOwn(preferenceDefaults, key) || LOCAL_BACKUP_PREFERENCES.has(key)) return false;
    const fallback = preferenceDefaults[key];
    if (Array.isArray(fallback)) return Array.isArray(value);
    if (isBackupObject(fallback)) return isBackupObject(value);
    if (fallback === null) return value === null || typeof value === 'string';
    return value !== null && typeof value === typeof fallback;
  }));
}

function validateDataBackup(payload) {
  if (payload?.app !== 'vortex' || ![1, DATA_EXPORT_VERSION].includes(payload.version) ||
      !isBackupObject(payload.data) || !isBackupObject(payload.data.preferences)) {
    throw new Error('Unsupported Vortex backup');
  }
  const { data } = payload;
  for (const key of ['customGames', 'favorites', 'recentGames', 'sessionHistory']) {
    if (Object.hasOwn(data, key) && !Array.isArray(data[key])) throw new Error('Invalid backup field: ' + key);
  }
  for (const key of ['playStats', 'activityData', 'recentDetails', 'profiles', 'friendPins']) {
    if (Object.hasOwn(data, key) && !isBackupObject(data[key])) throw new Error('Invalid backup field: ' + key);
  }
  const quick = data.preferences.quickLaunchItems;
  if (quick !== undefined && !Array.isArray(quick)) throw new Error('Invalid quick launch data');
  if (data.profiles && Object.values(data.profiles).some(profile => !isBackupObject(profile?.settings))) {
    throw new Error('Invalid appearance profile');
  }
  if (data.sessionHistory?.length) sessionJournal.validate(data.sessionHistory);
  return data;
}

async function buildDataExport() {
  await Promise.resolve(activityClockReady).catch(() => {});
  bankPlaySession();
  const sessionHistory = await sessionJournal.recent(Infinity);
  return {
    app: 'vortex',
    version: DATA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      preferences: { ...backupPreferences(preferences), quickLaunchItems: preferences.quickLaunchItems },
      customGames: preferences.customGames || [],
      favorites: [...favorites],
      recentGames,
      playStats,
      activityData,
      profiles: typeof readProfiles === 'function' ? readProfiles() : {},
      friendPins: readStored('vortex.friendPins', {}),
      sessionHistory,
      recentDetails: recentMetadata()
    }
  };
}

async function applyDataImport(payload, groups = Object.keys(BACKUP_SECTIONS)) {
  if (dataImportInProgress) return false;
  dataImportInProgress = true;
  try {
    return await restoreDataBackup(payload, groups);
  } finally {
    dataImportInProgress = false;
  }
}

async function restoreDataBackup(payload, groups) {
  const source = validateDataBackup(payload);
  const picked = new Set(groups);
  const data = {};
  for (const [section, fields] of Object.entries(BACKUP_SECTIONS)) {
    if (!picked.has(section)) continue;
    for (const field of fields) if (Object.hasOwn(source, field)) data[field] = source[field];
  }
  await Promise.resolve(activityClockReady).catch(() => {});
  const nextPreferences = { ...preferences };
  if (picked.has('settings')) Object.assign(nextPreferences, backupPreferences(source.preferences));
  if (picked.has('folders') && Array.isArray(source.preferences.quickLaunchItems)) {
    nextPreferences.quickLaunchItems = cleanQuickLaunchItems(source.preferences.quickLaunchItems);
  }
  if (data.customGames) {
    nextPreferences.customGames = data.customGames.filter(game => isBackupObject(game) && gameIdPattern.test(String(game.id)));
  }
  const nextFavorites = data.favorites ? new Set(data.favorites.map(String).filter(id => gameIdPattern.test(id))) : favorites;
  const nextRecent = data.recentGames ? uniqueRecentIds(data.recentGames) : recentGames;
  const nextDetails = data.recentDetails || data.recentGames
    ? cleanRecentDetails(data.recentDetails || {}, nextRecent) : recentMetadata();
  const replacesJournal = Boolean(data.sessionHistory?.length);
  const restoresClock = Boolean(data.playStats || data.activityData || replacesJournal);
  let nextActivity = activityData;
  let nextStats = playStats;
  if (restoresClock) {
    const importedActivity = data.activityData ? normalizeActivityData(data.activityData) : activityData;
    const importedStats = data.playStats || playStats;
    const rows = activityClockIsValid(importedActivity) ? undefined
      : replacesJournal ? data.sessionHistory : await sessionJournal.recent(Infinity);
    nextActivity = rows ? rebuildActivityClock(importedActivity, importedStats, rows) : importedActivity;
    nextStats = synchronizePlayStats(importedStats, nextActivity.days);
  }

  const writes = new Map();
  if (picked.has('settings') || picked.has('folders') || data.customGames) {
    writes.set('vortex.preferences', nextPreferences);
  }
  if (data.profiles) writes.set('vortex.profiles', { ...readProfiles(), ...data.profiles });
  if (data.friendPins) writes.set('vortex.friendPins', data.friendPins);
  if (data.favorites) writes.set('vortex.favorites', [...nextFavorites]);
  if (data.recentGames) writes.set('vortex.recent', nextRecent);
  if (data.recentDetails || data.recentGames) writes.set('vortex.recentDetails', nextDetails);
  if (restoresClock) {
    writes.set('vortex.activity', nextActivity);
    writes.set('vortex.playStats', nextStats);
  }
  const previous = new Map();
  try {
    for (const [key, value] of writes) {
      const storageKey = accountStorageKey(key);
      const oldValue = localStorage.getItem(storageKey);
      if (!safeLocalStorageSet(storageKey, JSON.stringify(value))) throw new Error('Backup does not fit in storage');
      previous.set(storageKey, oldValue);
    }
    // Version 1 could export [] on an IndexedDB failure. Empty history from
    // any version leaves the destination journal intact.
    if (replacesJournal) await sessionJournal.restore(data.sessionHistory);
  } catch (error) {
    // Remove the attempted values first so the original values fit again.
    for (const key of previous.keys()) localStorage.removeItem(key);
    for (const [key, value] of previous) if (value !== null) localStorage.setItem(key, value);
    throw error;
  }

  Object.assign(preferences, nextPreferences);
  favorites = nextFavorites;
  recentGames = nextRecent;
  recentDetails = nextDetails;
  if (restoresClock) {
    activityData = nextActivity;
    playStats = nextStats;
    playtimeSummary = null;
    runtimeSample = null;
    runtimeConfirmedAt = 0;
  }
  if (replacesJournal) {
    if (!preferences.saveHistory) recordingSession = null;
    journalRows = [];
    journalChanged();
  } else if (!preferences.saveHistory) {
    stopJournalRecording();
  }
  applyPreferences();
  reportGameOverlay();
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
  button.dataset.tooltip = count > 0 ? t('notifications.unread', { count }) : t('notifications.title');
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

  const sortedAnnouncements = [...announcementItems]
    .map((item, idx) => ({ item, idx, ts: Date.parse(item?.date || '') || 0 }))
    .sort((a, b) => (b.ts - a.ts) || (b.idx - a.idx))
    .map((entry) => entry.item);

  for (const item of sortedAnnouncements) {
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
    const hasLog = announcementHasLog(item);
    if (item.url || hasLog) {
      const actions = document.createElement('div');
      actions.className = 'announcement-actions';
      row.appendChild(actions);
      if (hasLog) {
        const log = document.createElement('button');
        log.type = 'button';
        log.className = 'announcement-link';
        log.textContent = t('notifications.viewLog');
        log.addEventListener('click', () => routeToReleaseLog(item));
        actions.appendChild(log);
      }
      if (item.url) {
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'announcement-link';
        link.textContent = t('notifications.open');
        link.addEventListener('click', () => window.vortexDesktop?.openAnnouncementLink?.(item.url));
        actions.appendChild(link);
      }
    }
    list.appendChild(row);
  }
}

function closeAnnouncementsPanel() {
  if (!announcementPanel) return;
  window.vortexMotion.dismiss(announcementPanel);
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
  announcementTimer = window.setInterval(() => { if (!pauseBackgroundRefresh()) loadAnnouncements({ force: true }); }, 5 * 60 * 1000);
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
    motion: preferences.motion,
    tooltips: preferences.uiTooltips,
    animationSpeed: preferences.animationSpeed,
    trayScale: preferences.trayScale,
    corners: preferences.corners,
    theme: preferences.theme,
    lightTheme: document.body.classList.contains('light-theme'),
    trayFavoriteLimit: preferences.trayFavoritesUnlimited ? 0 : Number(preferences.trayFavoritesLimit) || 5,
    trayQuickLimit: preferences.trayQuickUnlimited ? 0 : Number(preferences.trayQuickLimit) || 3,
    css
  };
}

let reportedTrayPayload = '';
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
  const quickLaunch = preferences.quickLaunchItems.flatMap(item => item.type === 'game' ? [item] : item.showInTray ? item.games : [])
    .map((item) => ({
      id: String(item.id),
      title: preferences.streamMode && item.method !== 'public' ? t('tools.privateShortcut') : String(item.title || ''),
      thumbnail: preferences.streamMode && item.method !== 'public' ? '' : safeThumbnail(item.thumbnail) || '',
      lastPlayed: Number(item.lastPlayed) || lastPlayedFor(item.placeId),
      method: String(item.method || 'public'),
      placeId: String(item.placeId || ''),
      linkCode: preferences.streamMode ? '' : String(item.linkCode || ''),
      shareCode: preferences.streamMode ? '' : String(item.shareCode || ''),
      shareType: String(item.shareType || 'Server')
    }))
    .sort((first, second) => second.lastPlayed - first.lastPlayed)
    .slice(0, quickLimit);
  const sessionActive = Boolean(preferences.trayMiniPlayer && playSessionStart && playSessionGameId && nowPlayingSnapshot);
  const nowPlaying = sessionActive
    ? {
      id: String(nowPlayingSnapshot.id),
      title: String(nowPlayingSnapshot.title || ''),
      thumbnail: safeThumbnail(nowPlayingSnapshot.thumbnail) || '',
      startedAt: Number(nowPlayingSnapshot.startedAt) || playSessionStart
    }
    : null;
  const payload = { favorites: favoriteGames, quickLaunch, nowPlaying, style: trayStylePayload() };
  const serialized = JSON.stringify(payload);
  if (reportedTrayPayload === serialized) return;
  reportedTrayPayload = serialized;
  Promise.resolve(window.vortexDesktop.reportRecentGames(payload)).catch(() => {
    if (reportedTrayPayload === serialized) reportedTrayPayload = '';
  });
}

