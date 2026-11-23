// Ctrl+Shift+P opens the command palette. Ctrl+K still focuses game search.
let paletteState = { open: false, index: 0, items: [], filtered: [], returnFocus: null };

function paletteOpen() { return paletteState.open; }

function paletteCommands() {
  const commands = [];
  const go = t('palette.go');
  const action = t('palette.action');
  const settingsHint = t('palette.openSettings');
  const add = (glyph, title, hint, run, aliases = '') => commands.push({ icon: glyph, title, hint, run, aliases });
  const setting = (tab, selector = '') => {
    preferences.settingsTab = tab;
    savePreferences();
    setView('settings');
    if (selector) requestAnimationFrame(() => {
      const target = pageContent.querySelector(selector);
      (target?.closest('.settings-card') || target)?.scrollIntoView({ block: 'nearest' });
      target?.focus({ preventScroll: true });
    });
  };
  const toggle = (key, label, glyph, aliases = '', after = null) => {
    add(glyph, t(label), t('palette.toggle'), () => {
      preferences[key] = !preferences[key];
      savePreferences();
      renderPage();
      after?.();
      showToast(t(label) + ' · ' + t(preferences[key] ? 'palette.on' : 'palette.off'));
    }, aliases);
  };
  for (const item of NAV_ITEMS) add(item.icon, t('nav.' + item.key), go, () => setView(item.key), item.key);
  add('search', t('nav.search'), action, () => { searchInput.focus(); searchInput.select(); }, 'find games place id поиск игра');
  for (const sort of catalogSorts()) {
    add(catalogSortGlyphs[sort.id] || 'catalog', discoverySortLabel(sort), t('nav.catalog'), () => selectCatalogCollection(sort.id),
      sort.id.replaceAll('-', ' ') + ' chart подборка');
  }
  add('die', t('tools.surpriseTitle'), t('nav.catalog'), () => void showSurprise(), 'random случайная игра');
  add('friendFilter', t('chart.onlyFriends'), t('nav.catalog'), toggleCatalogFriends, 'friends filter фильтр');
  add('crosshair', t('chart.recommendationSettings'), t('nav.catalog'), () => {
    selectCatalogCollection(RECOMMENDED_SORT.id);
    showRecommendationSettings();
  }, 'hidden games interests скрытые игры интересы');
  add('refreshCw', t('chart.refresh'), t('nav.catalog'), () => {
    if (searchQuery || currentView !== 'catalog' || isRecommendationsView() || activeAccess === 'paid' || catalogGenreExplore) {
      selectCatalogCollection(activeDiscoverySort === RECOMMENDED_SORT.id ? 'top-playing-now' : activeDiscoverySort);
    } else void loadDiscoveryCatalog(activeDiscoverySort, { force: true, preserveCount: true });
  }, 'refresh chart обновление');
  for (const tab of libraryTabs) add(tab.icon, t(tab.label), t('nav.library'), () => setView(tab.id), tab.id);
  add('history', t('activity.journal.title'), t('nav.activity'), () => showLibraryActivityPane('history'), 'sessions history журнал время');
  for (const [tab, glyph] of settingsTabsList) {
    add(glyph, t('palette.settingsCommand', { tab: t('settings.tab.' + tab) }), settingsHint, () => setting(tab), tab);
  }
  for (const [tab, glyph, label, selector, aliases] of [
    ['home', 'layout', 'settings.home.sections', '[data-home-widget-config]', 'widgets блоки переставить'],
    ['accent', 'image', 'settings.wallpaper.title', '[data-action=pick-wallpaper]', 'фон обои background wallpaper'],
    ['interface', 'keyboard', 'settings.hotkeys.title', '[data-record-hotkey]', 'keyboard shortcuts клавиатура'],
    ['general', 'profileStack', 'settings.profiles.title', '[data-profile-name]', 'профиль тема customization'],
    ['integrations', 'lock', 'settings.presence.title', '[data-presence-cookie]', 'cookie roblosecurity статус друзья'],
    ['data', 'share', 'settings.data.title', '[data-action=export-data]', 'import export backup резервная копия']
  ]) add(glyph, t(label), settingsHint, () => setting(tab, selector), aliases);
  for (const [view, key] of [['home', 'homeGameView'], ['catalog', 'catalogView']]) {
    for (const layout of ['list', 'grid']) {
      const glyph = view === 'home' ? (layout === 'list' ? 'homeList' : 'homeGrid') : layout;
      add(glyph, t('palette.layoutCommand', { view: t('nav.' + view), layout: t('catalog.' + layout + 'View') }), t('palette.view'), () => {
        preferences[key] = layout;
        savePreferences();
        if (view === 'catalog' && activeDiscoverySort === RECOMMENDED_SORT.id) selectCatalogCollection('top-playing-now');
        else setView(view);
      }, view + ' ' + layout + ' вид плитки');
    }
  }
  for (const [theme, glyph] of [['dark', 'moon'], ['light', 'sun'], ['oled', 'contrast']]) {
    add(glyph, t('settings.' + theme), t('palette.theme'), () => {
      Object.assign(preferences, { theme, themeBackground: '', themeSurface: '', themeText: '', themeMuted: '', themeLine: '' });
      savePreferences();
      renderPage();
    }, theme);
  }
  toggle('motion', 'settings.motion.title', 'motion', 'animations эффекты');
  toggle('uiTooltips', 'settings.ui.tooltips', 'message', 'tooltip hints подсказки');
  toggle('cardShowDescription', 'settings.cardTuning.description', 'textSize', 'description текст');
  toggle('cardShowPlaytime', 'settings.cardTuning.playtime', 'clock', 'playtime часы');
  toggle('cardShowLikes', 'settings.cardTuning.likes', 'thumb', 'likes оценка');
  toggle('discordPresence', 'settings.integrations.discord', 'discord', 'discord activity', applyDiscordPresence);
  toggle('friendFavoriteAlerts', 'settings.integrations.friendAlerts', 'bell', 'notifications уведомления');
  toggle('gamingMode', 'tools.gaming', 'gamepad', 'performance производительность');
  add('eyeOff', t('tools.stream'), t('palette.toggle'), () => setLauncherStreamMode(!preferences.streamMode), 'stream приватность');
  add('pulse', t('settings.api.title'), action, () => { setting('data'); void checkApiStatus(); }, 'проверить соединение api network');
  add('trash', t('settings.cacheClear'), action, () => { setting('data'); pageContent.querySelector('[data-action=clear-cache]')?.click(); }, 'clear cache очистка');
  add('download', t('updates.checkNow'), action, () => { setting('version'); pageContent.querySelector('[data-action=retry-update]')?.click(); }, 'version update версия');
  return commands;
}

function openCommandPalette() {
  paletteState = { open: true, index: 0, items: paletteCommands(), filtered: [], returnFocus: document.activeElement };
  let root = document.getElementById('command-palette');
  if (!root) {
    root = document.createElement('div');
    root.id = 'command-palette';
    root.innerHTML = `<div class="palette-backdrop" data-palette-close></div>
      <div class="palette-panel" role="dialog" aria-modal="true" aria-label="${t('palette.title')}">
        <div class="palette-input-row"><span class="palette-input-icon">${icon('search', 17)}</span><input type="text" class="palette-input"
          role="combobox" aria-autocomplete="list" aria-controls="palette-result-list" aria-expanded="true" autocomplete="off" spellcheck="false" /></div>
        <div class="palette-list" id="palette-result-list" role="listbox"></div>
        <div class="palette-foot"><span>${t('palette.navigate')}</span><span>${t('palette.run')}</span><span>${t('palette.close')}</span></div>
      </div>`;
    document.body.appendChild(root);
    root.querySelector('.palette-input').addEventListener('input', () => { paletteState.index = 0; renderPaletteList(); });
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
  root.querySelector('.palette-panel').setAttribute('aria-label', t('palette.title'));
  root.hidden = false;
  const input = root.querySelector('.palette-input');
  input.placeholder = t('palette.placeholder');
  input.setAttribute('aria-label', t('palette.placeholder'));
  input.value = '';
  renderPaletteList();
  input.focus();
}

function closeCommandPalette() {
  const root = document.getElementById('command-palette');
  if (root) root.hidden = true;
  paletteState.open = false;
  if (paletteState.returnFocus?.isConnected) paletteState.returnFocus.focus({ preventScroll: true });
}

function renderPaletteList() {
  const root = document.getElementById('command-palette');
  if (!root) return;
  const normalize = text => text.toLocaleLowerCase(preferences.language).replaceAll('ё', 'е').trim();
  const query = normalize(root.querySelector('.palette-input').value);
  const terms = query.split(/\s+/).filter(Boolean);
  paletteState.filtered = terms.length ? paletteState.items.flatMap(item => {
    const title = normalize(item.title);
    const haystack = normalize(`${item.title} ${item.hint} ${item.aliases || ''}`);
    if (!terms.every(word => haystack.includes(word))) return [];
    const rank = (title === query ? 12 : title.startsWith(query) ? 8 : title.includes(query) ? 5 : 0)
      + terms.filter(word => title.includes(word)).length;
    return [{ item, rank }];
  }).sort((a, b) => b.rank - a.rank).map(entry => entry.item) : paletteState.items;
  paletteState.index = Math.min(paletteState.index, Math.max(0, paletteState.filtered.length - 1));
  const list = root.querySelector('.palette-list');
  list.innerHTML = paletteState.filtered.map((item, index) => `
    <button type="button" class="palette-row ${index === paletteState.index ? 'active' : ''}" id="palette-option-${index}"
      tabindex="-1" data-palette-index="${index}" role="option" aria-selected="${index === paletteState.index}">
      <span class="palette-row-icon">${icon(item.icon, 14)}</span>
      <span class="palette-row-title">${escapeHtml(item.title)}</span>
      <span class="palette-row-hint">${escapeHtml(item.hint)}</span>
    </button>`).join('') || `<p class="palette-empty" role="status">${t('palette.noResults')}</p>`;
  list.scrollTop = 0;
  renderPaletteSelection();
}

function renderPaletteSelection() {
  const root = document.getElementById('command-palette');
  if (!root) return;
  root.querySelectorAll('.palette-row').forEach((row) => {
    const active = Number(row.dataset.paletteIndex) === paletteState.index;
    row.classList.toggle('active', active);
    row.setAttribute('aria-selected', String(active));
  });
  const active = root.querySelector('.palette-row.active');
  const input = root.querySelector('.palette-input');
  if (active) {
    input.setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView({ block: 'nearest' });
  } else input.removeAttribute('aria-activedescendant');
}

function runPaletteIndex(index) {
  const item = paletteState.filtered && paletteState.filtered[index];
  if (!item) return;
  closeCommandPalette();
  item.run();
}

// Classic scripts run before ES modules: wait for the module bundle to be
// published on window, then boot. If it never arrives (module error), boot
// with the fallback shims after a short grace period.
// Friend card hover preview: floating panel with avatar, name, game and a
// join action. Sits above the grid and follows the hovered card.
let friendPreviewEl = null;
let friendPreviewCard = null;
function showFriendPreview(card) {
  if (!preferences.uiTooltips || !card || card.classList.contains('offline')) {
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
  if (friendPreviewEl) window.vortexMotion.dismiss(friendPreviewEl);
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
saveRecentGames(recentGames);
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
monitorRobloxRuntime();
window.addEventListener('focus', () => { if (currentView === 'activity') journalChanged(); });
window.vortexDesktop?.onWindowState?.(({ isMaximized }) => setWindowMaximized(Boolean(isMaximized)));
window.vortexDesktop?.onUpdateState?.(renderUpdateBanner);
window.vortexDesktop?.onGameOverlayFps?.(setGameOverlayFpsState);
window.vortexDesktop?.onGameOverlayInviteCopied?.(() => showToast(t('activity.nowPlaying.inviteCopied')));
window.vortexDesktop?.onGameOverlayToggled?.(() => {
  if (typeof triggerOverlayToggle === 'function') triggerOverlayToggle();
});
window.vortexDesktop?.onGameOverlayMuteToggled?.((res) => {
  if (res && res.sessions > 0) showToast(t(res.muted ? 'hotkeys.mute.toastMuted' : 'hotkeys.mute.toastUnmuted'));
  else showToast(t('hotkeys.mute.toastNotRunning'));
});
window.vortexDesktop?.onGameOverlayServerHop?.(() => {
  if (typeof triggerServerHop === 'function') void triggerServerHop();
});
window.vortexDesktop?.onGameOverlayRejoin?.(() => {
  if (typeof triggerServerRejoin === 'function') void triggerServerRejoin();
});
window.vortexDesktop?.onTrayLaunch?.(({ kind, id }) => {
  if (kind === 'quick') void launchQuickGame(String(id));
  else if (kind === 'favorite') openGame(String(id));
  else if (kind === 'session-invite' && typeof copyActiveServerInviteLink === 'function') void copyActiveServerInviteLink();
  else if (kind === 'session-hop' && typeof triggerServerHop === 'function') void triggerServerHop();
  else if (kind === 'session-rejoin' && typeof triggerServerRejoin === 'function') void triggerServerRejoin();
  else if (kind === 'session-mute' && typeof triggerRobloxMuteToggle === 'function') void triggerRobloxMuteToggle();
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
window.setInterval(() => {
  if (pauseBackgroundRefresh()) return;
  const username = String(preferences.robloxUsername || '').trim();
  if (username && (shouldRefreshCatalogFriends() || Object.keys(friendPins()).length > 0 || preferences.friendFavoriteAlerts)) void loadFriends(username);
  if (currentView === 'catalog' && !searchQuery && !isRecommendationsView() && !isGenreSearchActive() && activeAccess !== 'paid' &&
      !document.hidden && discoveryStatus !== 'loading' && Date.now() - (discoveryCatalog[activeDiscoverySort]?.savedAt || 0) >= 30 * 60_000) {
    void loadDiscoveryCatalog(activeDiscoverySort, { force: true, preserveCount: true });
  }
}, 60000);
}

bootVortex();
