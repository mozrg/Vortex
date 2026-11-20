let launcherDialog;
let launcherDialogReturn;
let inboundRobloxLink;
let openGameTabs = [];
let catalogReturn;
let surpriseSeen = new Set();
let importPreview;
let collectionDraft;
const gameIdPattern = /^\d{1,20}$/;
const linkCodePattern = /^[a-z0-9_-]{1,128}$/i;
const looksLikeRobloxLink = input => /^(?:https?:\/\/)?(?:www\.)?roblox\.com\/|^roblox:\/\//i.test(String(input).trim());

function openLauncherDialog(title, content) {
  if (!launcherDialog) {
    launcherDialog = document.createElement('dialog');
    launcherDialog.className = 'launcher-tool-dialog settings-card';
    launcherDialog.addEventListener('close', () => launcherDialogReturn?.focus({ preventScroll: true }));
    document.body.append(launcherDialog);
  }
  launcherDialog.setAttribute('aria-label', title);
  launcherDialog.innerHTML = `<header class="settings-card-head"><h2>${escapeHtml(title)}</h2>
    <button type="button" class="ghost-button" data-launcher-action="close" aria-label="${t('common.cancel')}">${icon('close', 16)}</button></header>${content}`;
  if (!launcherDialog.open) {
    launcherDialogReturn = document.activeElement;
    launcherDialog.showModal();
  }
}

function robloxSearchLink(text) {
  let url;
  const input = String(text || '').trim();
  if (!/^(https?:\/\/|roblox:\/\/|(?:www\.)?roblox\.com\/)/i.test(input)) return null;
  try { url = new URL(input.includes('://') ? input : 'https://' + input); } catch { return null; }
  const native = url.protocol === 'roblox:';
  if (!native && (!['https:', 'http:'].includes(url.protocol) ||
      !['roblox.com', 'www.roblox.com'].includes(url.hostname) || url.username || url.password || url.port)) return null;
  const params = new URLSearchParams(native && !url.search ? input.slice('roblox://'.length) : url.search);
  const code = params.get('code') || '';
  const shareType = params.get('type') || 'Server';
  if (/(?:^|\/)share(?:_links)?\/?$/i.test(url.pathname) && linkCodePattern.test(code) &&
      ['Server', 'ExperienceInvite', 'ExperienceDetails'].includes(shareType)) {
    return { method: 'share', shareCode: code, shareType, placeId: '' };
  }
  const placeId = url.pathname.match(/\/games\/(\d{1,20})(?:\/|$)/)?.[1] || params.get('placeId') || '';
  if (!gameIdPattern.test(placeId)) return null;
  const linkCode = params.get('privateServerLinkCode') || params.get('linkCode') || '';
  const serverId = params.get('gameInstanceId') || params.get('gameId') || '';
  const accessCode = params.get('accessCode') || '';
  if (linkCode && /^[a-z0-9_-]{1,100}$/i.test(linkCode)) return { method: 'private', placeId, linkCode };
  if (serverId && /^[a-z0-9-]{5,64}$/i.test(serverId)) return { method: 'instance', placeId, serverId };
  if (accessCode && /^[a-z0-9-]{8,100}$/i.test(accessCode)) return { method: 'access', placeId, accessCode };
  return { method: 'public', placeId };
}

function renderRobloxSearchLink(target) {
  inboundRobloxLink = target;
  const server = target.method !== 'public';
  return `<section class="settings-card launcher-link-found">
    <h2>${t(server ? 'tools.serverLink' : 'tools.gameLink')}</h2>
    ${target.placeId ? `<p>Place ID ${target.placeId}</p>` : ''}
    <div class="launcher-tool-actions">
      ${target.placeId ? `<button class="ghost-button" data-launcher-action="link-open">${t('tools.openGame')}</button>` : ''}
      <button class="primary-button" data-launcher-action="link-play">${icon('play', 13)} ${t('card.play')}</button>
      <button class="ghost-button" data-launcher-action="link-pin">${t('tools.pinGame')}</button>
    </div></section>`;
}

async function openLauncherGame(id) {
  let game = getGame(id);
  if (!game) {
    const response = await window.vortexDesktop?.getGameDetails?.({ placeId: id }).catch(() => null);
    game = response?.ok ? normalizeDiscoveredGame(response.game, id) : { id, title: 'Roblox #' + id, genreKey: 'other' };
    dynamicGames = [...dynamicGames.filter(item => String(item.id) !== id), { ...game, id }].slice(-1200);
    try { localStorage.setItem('vortex.discovered', JSON.stringify(dynamicGames)); } catch { /* In-memory game remains. */ }
  }
  openGameDetails(id);
}

function rememberGameTab(game) {
  const id = String(game.id);
  if (currentView === 'catalog' || currentView === 'search') {
    const area = document.querySelector('.main-area');
    catalogReturn = { view: currentView, top: area?.scrollTop || 0, query: searchQuery, results: searchResults,
      status: searchStatus, token: searchPageToken, genre: activeCategory, session: searchSessionId };
  }
  if (!openGameTabs.some(tab => tab.id === id)) openGameTabs.push({ id, title: game.title, game });
}

function renderGameTabs() {
  if (!openGameTabs.length) return '';
  return `<nav class="launcher-game-tabs" aria-label="${t('tools.gameTabs')}">
    ${catalogReturn ? `<button class="ghost-button" data-launcher-action="catalog-return">${icon('chevronLeft', 14)} ${t('nav.catalog')}</button>` : ''}
    ${openGameTabs.map(tab => `<span class="launcher-game-tab">
      <button class="ghost-button" data-launcher-action="tab-open" data-id="${tab.id}" title="${escapeHtml(tab.title)}"
        ${currentView === 'game-detail' && String(detailGame?.id) === tab.id ? 'aria-current="page"' : ''}>${escapeHtml(tab.title)}</button>
      <button class="ghost-button" data-launcher-action="tab-close" data-id="${tab.id}" aria-label="${escapeHtml(t('tools.closeTab', { game: tab.title }))}">${icon('close', 12)}</button>
    </span>`).join('')}</nav>`;
}

function returnToSavedCatalog() {
  if (!catalogReturn) { setView('catalog'); return; }
  const { view, top, query, results, status, token, genre, session } = catalogReturn;
  searchQuery = query;
  searchResults = results;
  searchStatus = status;
  searchPageToken = token;
  searchSessionId = session;
  activeCategory = genre;
  searchInput.value = query;
  setView(view);
  requestAnimationFrame(() => { const area = document.querySelector('.main-area'); if (area) area.scrollTop = top; });
}

async function showSurprise(filters, choose = false) {
  const preferred = recommendationProfile().seeds.find(seed => Object.hasOwn(GENRE_SEARCH_BASE, seed.game.genreKey))?.game?.genreKey;
  const genre = filters?.genre || preferred || 'all';
  const unfamiliar = filters?.unfamiliar ?? true;
  const free = filters?.free ?? true;
  const chooseOptions = `<form data-launcher-form="surprise" class="launcher-dialog-form">
    <label>${t('tools.genre')} <select name="genre">${['all', ...Object.keys(GENRE_SEARCH_BASE)].map(value =>
      `<option value="${value}" ${value === genre ? 'selected' : ''}>${t('genre.' + value)}</option>`).join('')}</select></label>
    <label><input type="checkbox" name="free" ${free ? 'checked' : ''}> ${t('tools.freeOnly')}</label>
    <label><input type="checkbox" name="unfamiliar" ${unfamiliar ? 'checked' : ''}> ${t('tools.unplayedOnly')}</label>
    <button class="primary-button" type="submit">${t(choose ? 'tools.surpriseAgain' : 'tools.surprise')}</button>
  </form><div data-surprise-result role="status"></div>`;
  openLauncherDialog(t('tools.surpriseTitle'), chooseOptions);
  if (!choose) { surpriseSeen = new Set(); return; }
  const outlet = launcherDialog.querySelector('[data-surprise-result]');
  outlet.textContent = t('tools.loading');
  const played = new Set([...Object.keys(playStats), ...recentGames].map(id => experienceKey(getGame(id) || { id })));
  const eligible = games => {
    const found = new Map();
    for (const game of games) {
      const key = experienceKey(game);
      if (!gameIdPattern.test(String(game.id || '')) || surpriseSeen.has(key) || (unfamiliar && played.has(key))) continue;
      if (game.availability === 'unavailable' || (free && gameIsPaid(game))) continue;
      if (genre !== 'all' && (game.genreKey || inferGenreKey(game)) !== genre) continue;
      found.set(key, game);
    }
    return [...found.values()];
  };
  let pool = eligible([...recommendationState.items, ...allGames()]);
  if (!pool.length && window.vortexDesktop?.searchGames) {
    const query = GENRE_SEARCH_BASE[genre] || 'popular';
    const result = await window.vortexDesktop.searchGames({ query }).catch(() => null);
    const rows = Array.isArray(result?.items) ? result.items : [];
    pool = eligible(rows.filter(item => item?.id).map(item => normalizeDiscoveredGame(item, query)));
  }
  if (!outlet.isConnected) return;
  const game = pool[Math.floor(Math.random() * pool.length)];
  if (!game) { outlet.textContent = t('tools.surpriseEmpty'); return; }
  const id = String(game.id);
  surpriseSeen.add(experienceKey(game));
  if (!getGame(id)) dynamicGames = [...dynamicGames, game].slice(-1200);
  outlet.innerHTML = `<div class="launcher-surprise-result">${gameArt(game)}<strong>${escapeHtml(game.title)}</strong>
    <button class="ghost-button" data-launcher-action="collection-open-game" data-id="${id}">${t('tools.openGame')}</button></div>`;
}

function gameArt(game) {
  const art = safeThumbnail(game?.thumbnail);
  return `<span class="journal-art">${art ? `<img src="${escapeHtml(art)}" alt="" loading="lazy">` : icon('gamepad', 17)}</span>`;
}

function gameIsPaid(game) {
  return Number(game.price) > 0 || Number(game.priceInRobux) > 0 || game.isPaid === true ||
    paidGames.some(item => experienceKey(item) === experienceKey(game));
}

function recommendationFeedback() {
  return readStored('vortex.recommendationFeedback', { hidden: [], boosted: {} });
}

function showRecommendationReason(game) {
  const reason = game.recommendationReason;
  if (!reason || currentView !== 'catalog' || activeDiscoverySort !== RECOMMENDED_SORT.id || searchQuery) return '';
  const label = t(reason.signal === 'favorite' ? 'tools.becauseFavorite' : reason.signal === 'feedback' ? 'tools.becauseFeedback' : 'tools.becausePlayed',
    { game: reason.title });
  return `<aside class="recommendation-reason"><p title="${escapeHtml(label)}">${icon('sparkle', 12)} ${escapeHtml(label)}</p>
    <div class="launcher-tool-actions"><button class="ghost-button" data-launcher-action="recommend-hide" data-id="${game.id}">${t('tools.notInterested')}</button>
    <button class="ghost-button" data-launcher-action="recommend-more" data-id="${game.id}">${t('tools.moreLike')}</button></div></aside>`;
}

function updateRecommendationFeedback(action, id) {
  const game = recommendationState.items.find(item => String(item.id) === id);
  if (!game) return;
  const key = experienceKey(game);
  const data = recommendationFeedback();
  if (action === 'recommend-hide') {
    data.hidden = [...new Set([...data.hidden, key, 'place:' + id])].slice(-400);
  } else {
    data.boosted = Object.fromEntries([...Object.entries(data.boosted).filter(([seed]) => seed !== id),
      [id, { ...collectionGame(game), genreKey: game.genreKey || inferGenreKey(game), universeId: game.universeId }]].slice(-12));
  }
  accountStorage.setItem('vortex.recommendationFeedback', JSON.stringify(data));
  recommendationState.items = recommendationState.items.filter(item => experienceKey(item) !== key);
  renderPage();
  void loadRecommendations(true);
  showToast(t('tools.feedbackSaved'));
}

async function launchPastedLink(target) {
  if (!target) return;
  try {
    await window.vortexDesktop.launchQuickGame(target);
    if (target.placeId) recordGameLaunch(getGame(target.placeId) || { id: target.placeId });
  } catch { showToast(t('toast.launchError')); }
}

async function pinPastedLink(target) {
  if (!target) return;
  const known = getGame(target.placeId);
  const item = { ...target, id: quickLaunchId(), type: 'game',
    title: known?.title || (target.placeId ? 'Roblox #' + target.placeId : t('tools.serverLink')),
    thumbnail: known?.thumbnail, autoTitle: Boolean(target.placeId && !known) };
  const fields = ['method','placeId','linkCode','shareCode','shareType','serverId','accessCode'];
  if (quickLaunchGames().some(game => fields.every(key => !item[key] || item[key] === game[key]))) {
    showToast(t('tools.alreadyPinned'));
    return;
  }
  preferences.quickLaunchItems.push(item);
  persistQuickLaunchItems();
  showToast(t('tools.gamePinned'));
}

async function saveDesktopShortcut(button) {
  const item = button.dataset.quick ? findQuickLaunchGame(button.dataset.id) : getGame(button.dataset.id) || detailGame;
  if (!item) return;
  try {
    await window.vortexDesktop.createDesktopShortcut({
      title: item.title, method: item.method || 'public', placeId: item.placeId || String(item.id),
      linkCode: item.linkCode, shareCode: item.shareCode, shareType: item.shareType, serverId: item.serverId, accessCode: item.accessCode
    });
    showToast(t('tools.shortcutMade'));
  } catch { showToast(t('tools.shortcutError')); }
}

document.addEventListener('click', async event => {
  const button = event.target.closest?.('[data-launcher-action]');
  if (!button) return;
  const { launcherAction: action, id } = button.dataset;
  switch (action) {
    case 'close': launcherDialog.close(); return;
    case 'accounts': openAccountMenu(); return;
    case 'account-switch': switchLauncherAccount(id); return;
    case 'friends-open': launcherDialog.close(); openFriendsDrawer(); return;
    case 'surprise': void showSurprise(); return;
    case 'link-open': void openLauncherGame(inboundRobloxLink.placeId); return;
    case 'link-play': void launchPastedLink(inboundRobloxLink); return;
    case 'link-pin': void pinPastedLink(inboundRobloxLink); return;
    case 'recommend-hide':
    case 'recommend-more': updateRecommendationFeedback(action, id); return;
    case 'tab-open': openGameDetails(id); return;
    case 'tab-close': {
      const index = openGameTabs.findIndex(tab => tab.id === id);
      openGameTabs = openGameTabs.filter(tab => tab.id !== id);
      const next = openGameTabs[Math.min(index, openGameTabs.length - 1)];
      if (currentView === 'game-detail' && String(detailGame?.id) === id) {
        if (next) openGameDetails(next.id);
        else returnToSavedCatalog();
      } else renderPage();
      return;
    }
    case 'catalog-return': returnToSavedCatalog(); return;
    case 'friend-pin':
    case 'friend-alert': {
      if (!gameIdPattern.test(id)) return;
      const pins = friendPins();
      if (action === 'friend-alert') pins[id] = !pins[id];
      else if (Object.hasOwn(pins, id)) delete pins[id];
      else pins[id] = false;
      pinnedFriendActivity.delete(id);
      accountStorage.setItem('vortex.friendPins', JSON.stringify(pins));
      if (pins[id]) notifyPinnedFriends(friendsCache.data?.friends || []);
      if (currentView === 'friends') renderPage();
      renderFriendsDrawer();
      return;
    }
    case 'journal-reset':
      journalFilters = { query: '', from: '', to: '', min: '', max: '' };
      filterJournalByDate('');
      renderPage();
      return;
    case 'setting-open': {
      preferences.settingsTab = button.dataset.tab;
      savePreferences();
      setView('settings');
      const control = pageContent.querySelector(button.dataset.settingSelector);
      if (control) { control.scrollIntoView({ block: 'center' }); control.focus({ preventScroll: true }); }
      return;
    }
    case 'stream-toggle':
      setLauncherStreamMode(!preferences.streamMode);
      return;
    case 'collection-export': openCollectionEditor(); return;
    case 'collection-import': pickCollectionFile(); return;
    case 'collection-open-game': launcherDialog.close(); void openLauncherGame(id); return;
    case 'shortcut': void saveDesktopShortcut(button); return;
  }
});

document.addEventListener('submit', event => {
  const action = event.target.dataset.launcherForm;
  if (!action) return;
  event.preventDefault();
  const form = new FormData(event.target);
  switch (action) {
    case 'account-add':
      if (!createLauncherAccount(String(form.get('username')).trim())) showToast(t('tools.accountInvalid'));
      return;
    case 'collection': submitCollection(form); return;
    case 'backup-import': void submitLauncherImport(form); return;
    case 'surprise':
      void showSurprise({ genre: form.get('genre'), free: form.has('free'), unfamiliar: form.has('unfamiliar') }, true);
      return;
    case 'journal-filters': {
      const candidate = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value).trim()]));
      if ((candidate.from && candidate.to && candidate.from > candidate.to) ||
          (candidate.min !== '' && candidate.max !== '' && Number(candidate.min) > Number(candidate.max))) {
        showToast(t('tools.badRange'));
        return;
      }
      journalFilters = candidate;
      filterJournalByDate('');
      renderPage();
      return;
    }
  }
});

document.addEventListener('input', event => {
  if (event.target.matches?.('[data-settings-search]')) searchSetting(event.target);
  if (event.target.matches?.('[data-text-scale]')) {
    preferences.textScale = Number(event.target.value);
    pageContent.querySelector('[data-text-scale-value]').textContent = preferences.textScale + '%';
    savePreferences();
    applyLauncherModes();
    reportRecentGamesToTray();
  }
});
