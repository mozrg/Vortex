
let journalFilters = { query: '', from: '', to: '', min: '', max: '' };

function renderJournalFilters() {
  const fields = [
    ['query', 'tools.findSessions', 'search'],
    ['from', 'tools.fromDate', 'date'], ['to', 'tools.toDate', 'date'],
    ['min', 'tools.minMinutes', 'number'], ['max', 'tools.maxMinutes', 'number']
  ];
  return `<form class="journal-filters" data-launcher-form="journal-filters">${fields.map(([name, key, type]) =>
    `<label>${t(key)}<input type="${type}" name="${name}" value="${escapeHtml(journalFilters[name])}"
      ${type === 'number' ? 'min="0" step="any"' : type === 'date' ? 'min="1970-01-01" max="9999-12-31"' : ''}></label>`).join('')}
    <div class="launcher-tool-actions"><button type="submit" class="ghost-button">${t('tools.filter')}</button>
      <button class="ghost-button" type="button" data-launcher-action="journal-reset">${t('tools.reset')}</button></div></form>`;
}

function journalQuery() {
  const { query, from, to, min, max } = journalFilters;
  const period = journalQuickPeriod === 'all' ? null : libraryPeriodRange(journalQuickPeriod, 0);
  const first = [from, journalDate, period?.from].filter(Boolean).sort().at(-1);
  const last = [to, journalDate, period?.to].filter(Boolean).sort()[0];
  const empty = Boolean(first && last && first > last);
  const lower = query.toLocaleLowerCase(preferences.language);
  return {
    empty,
    range: !empty && (first || last) ? IDBKeyRange.bound(
      first ? activityLocalDate(first).getTime() : 0,
      last ? activityLocalDate(shiftActivityDate(last, 1)).getTime() : 8640000000000000, false, true
    ) : null,
    matches(row) {
      const seconds = row.trackedMs / 1000;
      return (!min || seconds >= Number(min) * 60) && (!max || seconds <= Number(max) * 60) &&
        (!journalHourOnly || seconds > 3600) && (!journalFriendsOnly || preferences.streamMode || row.friends?.length > 0) &&
        (!lower || [row.gameId, row.title, getGame(row.gameId)?.title].some(value =>
          String(value || '').toLocaleLowerCase(preferences.language).includes(lower)));
    }
  };
}

const settingIndex = [
  ['general', 'windows-autostart', 'settings.autostart.title', 'загрузка вход в систему windows startup autostart автозагрузка автозапуск'],
  ['home', 'homeGameView', 'settings.home.gameView', 'главная вид список сетка плитки home layout list grid'],
  ['accent', 'accent', 'settings.accent.title', 'цвет акцент accent color'],
  ['accent', 'theme', 'tools.themePreview', 'цвет тема theme предпросмотр'],
  ['effects', 'motion', 'settings.motion.title', 'анимация анимации эффекты motion animation'],
  ['effects', 'gamingMode', 'tools.gaming', 'игра режим game mode'],
  ['in-game', 'gameOverlay', 'overlay.title', 'fps фпс ping пинг overlay оверлей таймер счетчик кадров друзья онлайн регион время jitter стабильность прозрачность размер hud'],
  ['hotkeys', 'muteRobloxHotkey', 'hotkeys.gameTitle', 'хоткеи горячие клавиши звук роблокс mute server hop смена сервера перезайти rejoin инвайт'],
  ['interface', 'textScale', 'tools.textScale', 'шрифт размер масштаб интерфейс text font zoom'],
  ['interface', 'sidebarAutoHide', 'settings.ui.autoHide', 'боковая панель sidebar'],
  ['interface', 'uiTooltips', 'settings.ui.tooltips', 'подсказки tooltip hover наведение предпросмотр'],
  ['tray', 'trayMiniPlayer', 'settings.tray.miniPlayer', 'трей окно мини плеер tray now playing'],
  ['tray', 'trayScale', 'settings.tray.scale', 'трей размер масштаб tray size'],
  ['general', 'saveHistory', 'settings.history.title', 'история время сессии журнал history session tracking'],
  ['general', 'streamMode', 'tools.stream', 'стрим приватность запись stream privacy'],
  ['integrations', 'discordPresence', 'settings.integrations.discord', 'дискорд discord'],
  ['integrations', 'cookie', 'settings.presence.cookie', 'roblox roblosecurity друзья cookie'],
  ['data', 'export-data', 'settings.data.export', 'копия экспорт перенос backup export'],
  ['version', 'download-update', 'updates.download', 'версия обновление update install']
];

function renderSettingsSearch() {
  return `<div class="launcher-setting-search"><label>${icon('search', 16)}<input type="search"
    data-settings-search aria-label="${t('tools.settingsSearch')}" placeholder="${t('tools.settingsSearch')}"></label>
    <div data-settings-matches hidden></div></div>`;
}

function searchSetting(input) {
  const query = input.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const output = input.closest('.launcher-setting-search').querySelector('[data-settings-matches]');
  output.hidden = !query.length;
  if (!query.length) return;
  const matches = completeSettingsIndex().filter(([tab, selector, label, aliases]) => query.every(word =>
    (label + ' ' + aliases).toLocaleLowerCase().includes(word)));
  output.innerHTML = matches.length ? matches.slice(0, 12).map(([tab, selector, label]) =>
    `<button class="ghost-button" data-launcher-action="setting-open" data-tab="${tab}" data-setting-selector="${escapeHtml(selector)}">${escapeHtml(label)}</button>`).join('')
    : `<p>${t('tools.settingsEmpty')}</p>`;
}

let cachedSettingsIndex;
function completeSettingsIndex() {
  if (cachedSettingsIndex?.language === preferences.language) return cachedSettingsIndex.rows;
  const isolated = document.createElement('div');
  const controls = '[data-pref], [data-toggle], [data-setting], [data-pref-toggle], [data-tray-limit], [data-text-scale], [data-action], [data-color-open], [data-presence-cookie], [data-overlay-range], [data-hotkey-pref]';
  const sections = { home: renderHomeSettings, cards: renderCardSettings, effects: renderEffectSettings,
    interface: renderInterfaceSettings, general: renderGeneralSettings, 'in-game': renderGameOverlaySettings,
    hotkeys: renderHotkeySettings, tray: renderTraySettings,
    integrations: renderIntegrationSettings, data: renderDataSettings, version: renderUpdateSettings, accent: renderAccentSettings };
  const rows = [];
  for (const [tab, render] of Object.entries(sections)) {
    isolated.innerHTML = render() + renderLauncherSettings(tab);
    for (const control of isolated.querySelectorAll(controls)) {
      const row = control.closest('.setting-line, .settings-card');
      const title = row?.querySelector('.setting-label strong, h2')?.textContent || control.getAttribute('aria-label') || control.textContent.trim();
      if (!title || rows.some(entry => entry[0] === tab && entry[2] === title)) continue;
      const attribute = [...control.attributes].find(attr => controls.includes('[' + attr.name + ']'));
      if (!attribute) continue;
      rows.push([tab, '[' + attribute.name + '="' + CSS.escape(attribute.value) + '"]', title, t('settings.' + tab)]);
    }
  }
  for (const [tab, key, title, aliases] of settingIndex) {
    const selector = ['data-setting', 'data-toggle', 'data-pref', 'data-action', 'data-color-open', 'data-text-scale']
      .map(attribute => '[' + attribute + '="' + key + '"]').join(',') + (key === 'cookie' ? ',[data-presence-cookie]' : '');
    const found = rows.find(row => row[0] === tab && row[1] && selector.includes(row[1]));
    if (found) found[3] += ' ' + aliases;
    else rows.push([tab, selector, t(title), aliases]);
  }
  cachedSettingsIndex = { language: preferences.language, rows };
  return rows;
}

function renderLauncherSettings(tab) {
  const toggle = (key, label, hint) => `<div class="setting-line"><div class="setting-label"><strong>${t(label)}</strong><small>${t(hint)}</small></div>
    <button class="toggle" data-toggle="${key}" role="switch" aria-label="${t(label)}" aria-checked="${Boolean(preferences[key])}"></button></div>`;
  if (tab === 'general') return `<section class="settings-card"><div class="settings-card-head"><h2>${t('tools.stream')}</h2>${icon('eyeOff', 18)}</div>
    ${toggle('streamMode', 'tools.stream', 'tools.streamHint')}</section>`;
  if (tab === 'effects') return `<section class="settings-card"><div class="settings-card-head"><h2>${t('tools.gaming')}</h2>${icon('gamepad', 18)}</div>
    ${toggle('gamingMode', 'tools.gaming', 'tools.gamingHint')}</section>`;
  if (tab === 'interface') return `<section class="settings-card"><div class="settings-card-head"><h2>${t('tools.textScale')}</h2>${icon('textSize', 18)}</div>
    <label class="range-control"><input type="range" min="85" max="140" step="5" data-text-scale="textScale"
      aria-label="${t('tools.textScale')}" value="${Number(preferences.textScale) || 100}"><output data-text-scale-value>${Number(preferences.textScale) || 100}%</output></label></section>`;
  return '';
}

function renderAccentWindowPreview() {
  return `<div class="launcher-theme-preview" aria-label="${t('tools.themePreview')}" role="img">
    <div class="launcher-theme-rail"><span>Vortex</span><span>${icon('home', 12)} ${t('nav.home')}</span></div>
    <div class="launcher-theme-page"><strong>${t('nav.catalog')}</strong><div><span>${icon('gamepad', 18)}</span><b>Roblox</b></div>
      <em>${icon('play', 11)} ${t('card.play')}</em></div>
  </div>`;
}

function applyLauncherModes() {
  const streaming = Boolean(preferences.streamMode);
  document.body.classList.toggle('stream-mode', streaming);
  document.querySelector('[data-launcher-action="stream-toggle"]')?.setAttribute('aria-pressed', String(streaming));
  if (streaming && typeof hideFriendPreview === 'function') hideFriendPreview();
  document.body.classList.toggle('in-game-mode', Boolean(preferences.gamingMode && playSessionGameId));
  const scale = Math.max(85, Math.min(140, Number(preferences.textScale) || 100)) / 100;
  document.documentElement.style.setProperty('--vortex-text-scale', scale);
}

function setLauncherStreamMode(enabled) {
  preferences.streamMode = enabled;
  localStorage.setItem(streamModeKey, JSON.stringify(enabled));
  if (enabled && looksLikeRobloxLink(searchQuery)) {
    searchQuery = '';
    searchInput.value = '';
  }
  savePreferences();
  renderPage();
  renderFriendsDrawer();
  reportRecentGamesToTray();
}

function pauseBackgroundRefresh() {
  return Boolean(preferences.gamingMode && playSessionGameId && (document.hidden || !document.hasFocus()));
}

const pinnedFriendActivity = new Map();
function friendPins() { return readStored('vortex.friendPins', {}); }
function friendPinControls(friend, pins) {
  const id = String(friend.id);
  if (!gameIdPattern.test(id)) return '';
  const pinned = Object.hasOwn(pins, id);
  const label = t(pinned ? 'tools.unpinFriend' : 'tools.pinFriend');
  return `<span class="friend-pin-controls">
    <button class="friend-pin-button" type="button" data-launcher-action="friend-pin" data-id="${id}"
      data-tooltip="${label}" aria-label="${label}" aria-pressed="${pinned}">${icon('pin', 16)}</button>
    ${pinned ? `<button class="ghost-button" data-launcher-action="friend-alert" data-id="${id}"
      data-tooltip="${t('tools.friendAlert')}" aria-label="${t('tools.friendAlert')}" aria-pressed="${Boolean(pins[id])}">${icon('bell', 13)}</button>` : ''}</span>`;
}

function notifyPinnedFriends(friends) {
  const pins = friendPins();
  for (const friend of friends) {
    const id = String(friend.id);
    if (!pins[id]) continue;
    const now = friend.presence === 'playing' ? String(friend.placeId || friend.playingPlaceId || 'playing') : '';
    const was = pinnedFriendActivity.get(id);
    pinnedFriendActivity.set(id, now);
    if (!now || was === undefined || was === now || preferences.streamMode) continue;
    void window.vortexDesktop?.notifyFriendPlaying?.({ friend: friend.displayName || friend.name || t('friends.unknown'),
      game: friend.gameName || t('friends.someGame') }).then(shown => {
      if (!shown && !preferences.streamMode) showToast(t('tools.friendStarted', {
        friend: friend.displayName || friend.name || t('friends.unknown'), game: friend.gameName || t('friends.someGame')
      }));
    }).catch(() => {});
  }
}

function safeFriendForDisplay(friend, index) {
  if (!preferences.streamMode) return friend;
  return { ...friend, displayName: t('tools.streamFriend', { count: index + 1 }), name: '', avatar: '' };
}
