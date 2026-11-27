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
  window.vortexOverlays.closeTooltip();
  window.vortexOverlays.closeMenu();
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
  if (/(?:^|\/)share(?:[_-]links)?\/?$/i.test(url.pathname) && linkCodePattern.test(code) &&
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
  if (accessCode && /^[a-z0-9_-]{6,128}$/i.test(accessCode)) return { method: 'access', placeId, accessCode };
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
    if (isRecommendationsView()) rememberRecommendationScroll();
    const area = document.querySelector('.main-area');
    catalogReturn = { view: currentView, top: area?.scrollTop || 0, query: searchQuery, results: searchResults,
      status: searchStatus, token: searchPageToken, genre: activeCategory, session: searchSessionId, sort: activeDiscoverySort,
      access: activeAccess, mode: sortMode, friendsOnly: catalogFriendsOnly, genreExplore: catalogGenreExplore, visible: catalogVisibleCount };
  }
  if (!openGameTabs.some(tab => tab.id === id)) openGameTabs.push({ id, title: game.title, game });
}

function renderGameTabs({ revealActive = true } = {}) {
  const host = document.querySelector('[data-game-tab-strip]');
  const markup = !openGameTabs.length ? '' : `<nav class="launcher-game-tabs" aria-label="${t('tools.gameTabs')}">
    ${openGameTabs.map(tab => `<span class="launcher-game-tab" data-game-tab="${escapeHtml(tab.id)}">
      <button class="ghost-button" data-launcher-action="tab-open" data-id="${escapeHtml(tab.id)}" data-tooltip="${escapeHtml(tab.title)}"
        ${currentView === 'game-detail' && String(detailGame?.id) === tab.id ? 'aria-current="page"' : ''}>${gameArt(tab.game)}<span>${escapeHtml(tab.title)}</span></button>
      <button class="ghost-button" data-launcher-action="tab-close" data-id="${escapeHtml(tab.id)}" aria-label="${escapeHtml(t('tools.closeTab', { game: tab.title }))}">${icon('close', 12)}</button>
    </span>`).join('')}</nav>`;
  if (host.cachedMarkup === markup) return;
  if (tabDrag) finishTabDrag();
  const scroll = host.firstElementChild?.scrollLeft || 0;
  const focused = host.contains(document.activeElement) ? document.activeElement.dataset : null;
  host.cachedMarkup = markup;
  host.innerHTML = markup;
  host.hidden = !markup;
  const strip = host.firstElementChild;
  if (!strip) return;
  strip.scrollLeft = scroll;
  if (revealActive) strip.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (focused?.id) strip.querySelector(`[data-launcher-action="${focused.launcherAction}"][data-id="${CSS.escape(focused.id)}"]`)?.focus();
  strip.addEventListener('wheel', event => {
    if (strip.scrollWidth <= strip.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    strip.scrollLeft += event.deltaY;
    event.preventDefault();
  }, { passive: false });
}

let tabDrag;
let suppressTabClick = false;
let cancelledTabPointer = null;

function placeGameTab(id, neighbor, after) {
  if (id === neighbor) return;
  const tab = openGameTabs.find(entry => entry.id === id);
  if (!tab || !openGameTabs.some(entry => entry.id === neighbor)) return;
  openGameTabs = openGameTabs.filter(entry => entry.id !== id);
  openGameTabs.splice(openGameTabs.findIndex(entry => entry.id === neighbor) + Number(after), 0, tab);
  renderGameTabs({ revealActive: false });
}

function previewTabDrop(drag, scroll = false) {
  const { strip, tabs, from, others, x, y, ghost, grabX, grabY, width } = drag;
  const bounds = strip.getBoundingClientRect();
  if (scroll && x < bounds.left + 24) strip.scrollLeft -= 12;
  else if (scroll && x > bounds.right - 24) strip.scrollLeft += 12;
  ghost.style.transform = `translate3d(${x - grabX}px, ${y - grabY}px, 0)`;

  const center = x - grabX + width / 2 - bounds.left + strip.scrollLeft;
  const next = others.findIndex(tab => center < tab.offsetLeft + tab.offsetWidth / 2);
  const to = next < 0 ? others.length : next;
  if (drag.to === to) return;
  drag.to = to;
  const source = tabs[from];
  const gap = Number.parseFloat(getComputedStyle(strip).columnGap) || 0;
  const slotWidth = width + gap;
  for (const [index, tab] of tabs.entries()) {
    let shift = 0;
    if (index === from) {
      const neighbor = tabs[to];
      shift = neighbor.offsetLeft - source.offsetLeft;
      if (to > from) shift += neighbor.offsetWidth - source.offsetWidth;
    } else if (index > from && index <= to) shift = -slotWidth;
    else if (index < from && index >= to) shift = slotWidth;
    tab.style.setProperty('--tab-drop-shift', `${shift}px`);
  }
}

function updateTabDrag() {
  if (!tabDrag?.ghost) return;
  previewTabDrop(tabDrag, true);
  tabDrag.frame = requestAnimationFrame(updateTabDrag);
}

document.addEventListener('pointerdown', event => {
  if (cancelledTabPointer === event.pointerId) cancelledTabPointer = null;
  const button = event.target.closest?.('[data-launcher-action="tab-open"]');
  if (!button || event.button !== 0 || !event.isPrimary || tabDrag || openGameTabs.length < 2) return;
  tabDrag = { id: button.dataset.id, tab: button.closest('[data-game-tab]'),
    strip: button.closest('.launcher-game-tabs'), pointer: event.pointerId,
    startX: event.clientX, startY: event.clientY };
});

document.addEventListener('pointermove', event => {
  if (!tabDrag || event.pointerId !== tabDrag.pointer) return;
  const drag = tabDrag;
  drag.x = event.clientX;
  drag.y = event.clientY;
  if (drag.ghost || Math.abs(drag.x - drag.startX) < 5) return;
  const { tab, strip } = drag;
  const bounds = tab.getBoundingClientRect();
  const tabs = [...strip.querySelectorAll('[data-game-tab]')];
  const ghost = document.createElement('div');
  ghost.className = 'launcher-game-tabs game-tab-drag-ghost';
  ghost.inert = true;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.width = `${bounds.width}px`;
  ghost.style.height = `${bounds.height}px`;
  const copy = tab.cloneNode(true);
  delete copy.dataset.gameTab;
  ghost.append(copy);
  Object.assign(drag, { ghost, tabs, from: tabs.indexOf(tab), others: tabs.filter(item => item !== tab),
    width: bounds.width, grabX: drag.startX - bounds.left, grabY: drag.startY - bounds.top });
  tab.classList.add('is-tab-dragged');
  strip.classList.add('is-tab-reordering');
  tab.setPointerCapture(event.pointerId);
  document.body.append(ghost);
  updateTabDrag();
  window.vortexMotion.animate(ghost.firstElementChild, [{ scale: .96 }, { scale: 1 }], 135);
});

function suppressClickAfterTabDrag() {
  suppressTabClick = true;
  setTimeout(() => { suppressTabClick = false; }, 0);
}

function finishTabDrag(event) {
  if (event?.type === 'pointerup' && cancelledTabPointer === event.pointerId) {
    cancelledTabPointer = null;
    suppressClickAfterTabDrag();
  }
  if (!tabDrag || (event?.pointerId != null && event.pointerId !== tabDrag.pointer)) return;
  const drag = tabDrag;
  tabDrag = null;
  if (!drag.ghost) return;
  const { id, strip, tab, tabs, from, others, frame, pointer } = drag;
  cancelAnimationFrame(frame);
  const bounds = strip.getBoundingClientRect();
  const dropped = event?.type === 'pointerup' && event.clientY >= bounds.top - 8 && event.clientY <= bounds.bottom + 8;
  if (dropped) {
    drag.x = event.clientX;
    drag.y = event.clientY;
    previewTabDrop(drag);
  }
  const { to } = drag;
  drag.ghost.remove();
  tab.classList.remove('is-tab-dragged');
  strip.classList.remove('is-tab-reordering');
  for (const item of tabs) item.style.removeProperty('--tab-drop-shift');
  if (tab.hasPointerCapture(pointer)) tab.releasePointerCapture(pointer);
  if (event?.type === 'pointerup') suppressClickAfterTabDrag();
  else if (event?.type !== 'pointercancel') cancelledTabPointer = pointer;
  if (dropped && from !== to) placeGameTab(id, (others[to] || others.at(-1)).dataset.gameTab, !others[to]);
}

document.addEventListener('pointerup', finishTabDrag);
document.addEventListener('pointercancel', finishTabDrag);
document.addEventListener('lostpointercapture', event => {
  if (event.target === tabDrag?.tab) finishTabDrag(event);
});
window.addEventListener('blur', finishTabDrag);
document.addEventListener('click', event => {
  if (suppressTabClick && event.target.closest?.('[data-game-tab-strip]')) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
}, true);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && tabDrag?.ghost) {
    event.preventDefault();
    event.stopImmediatePropagation();
    finishTabDrag();
    return;
  }
  const button = event.target.closest?.('[data-launcher-action="tab-open"]');
  const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
  if (!button || !step || !event.altKey || event.ctrlKey || event.metaKey) return;
  const id = button.dataset.id;
  const position = openGameTabs.findIndex(tab => tab.id === id);
  const neighbor = openGameTabs[position + step];
  if (neighbor) {
    event.preventDefault();
    event.stopImmediatePropagation();
    placeGameTab(id, neighbor.id, step > 0);
  }
}, true);

function returnToSavedCatalog({ track = true } = {}) {
  if (!catalogReturn) { setView('catalog', { track }); return; }
  const { view, top, query, results, status, token, genre, session, sort, access, mode, friendsOnly, genreExplore, visible } = catalogReturn;
  searchQuery = query;
  searchResults = results;
  searchStatus = status;
  searchPageToken = token;
  searchSessionId = session;
  activeCategory = genre;
  activeDiscoverySort = sort;
  activeAccess = access;
  sortMode = mode;
  catalogFriendsOnly = friendsOnly;
  catalogGenreExplore = genreExplore;
  catalogVisibleCount = visible;
  searchInput.value = query;
  setView(view, { track });
  requestAnimationFrame(() => {
    if (currentView === view) document.querySelector('.main-area').scrollTop = top;
  });
}

async function showSurprise(filters, choose = false) {
  const preferred = recommendationProfile().seeds.find(seed => Object.hasOwn(GENRE_SEARCH_BASE, seed.game.genreKey))?.game?.genreKey;
  const genre = filters?.genre || preferred || 'all';
  const unfamiliar = filters?.unfamiliar ?? true;
  const free = filters?.free ?? true;
  const chooseOptions = `<form data-launcher-form="surprise" class="launcher-dialog-form">
    <fieldset class="surprise-genre"><legend>${t('tools.genre')}</legend>
      ${renderVortexDropdown({ label: t('tools.genre'), value: genre, kind: 'surprise-genre',
        options: ['all', ...Object.keys(GENRE_SEARCH_BASE)].map(value => ({ value, text: t('genre.' + value) })),
        input: `<input type="hidden" name="genre" data-vortex-field value="${escapeHtml(genre)}">` })}</fieldset>
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
  const value = readStored('vortex.recommendationFeedback', null);
  const records = object => object && typeof object === 'object' && !Array.isArray(object) ? object : {};
  return { hidden: Array.isArray(value?.hidden) ? value.hidden.filter(key => typeof key === 'string') : [],
    boosted: Object.fromEntries(Object.entries(records(value?.boosted)).filter(([id, game]) => /^\d{1,20}$/.test(id) && game?.id)),
    hiddenGames: records(value?.hiddenGames) };
}

function showRecommendationReason(game) {
  const reason = game.recommendationReason;
  if (!reason || currentView !== 'catalog' || activeDiscoverySort !== RECOMMENDED_SORT.id || searchQuery) return '';
  const label = catalogReason(game);
  return `<aside class="recommendation-reason"><p data-tooltip="${escapeHtml(label)}">${icon('sparkle', 12)} ${escapeHtml(label)}</p>
    <div class="launcher-tool-actions"><button class="ghost-button" data-launcher-action="recommend-hide" data-id="${game.id}">${t('tools.notInterested')}</button>
    <button class="ghost-button" data-launcher-action="recommend-more" data-id="${game.id}">${t('tools.moreLike')}</button></div></aside>`;
}

function updateRecommendationFeedback(action, id) {
  const game = recommendationState.items.find(item => String(item.id) === id) || catalogFriendGames().find(item => String(item.id) === id);
  if (!game) return;
  const key = experienceKey(game);
  const data = recommendationFeedback();
  if (action === 'recommend-hide') {
    data.hidden = [...new Set([...data.hidden, key, 'place:' + id])].slice(-400);
    const saved = { ...data.hiddenGames, [key]: collectionGame(game), ['place:' + id]: collectionGame(game) };
    data.hiddenGames = Object.fromEntries(data.hidden.filter(hidden => saved[hidden]).map(hidden => [hidden, saved[hidden]]));
    recommendationState.items = recommendationState.items.filter(item => experienceKey(item) !== key && String(item.id) !== id);
  } else {
    data.boosted = Object.fromEntries([...Object.entries(data.boosted).filter(([seed]) => seed !== id),
      [id, { ...collectionGame(game), genreKey: game.genreKey || inferGenreKey(game), universeId: game.universeId }]].slice(-12));
  }
  accountStorage.setItem('vortex.recommendationFeedback', JSON.stringify(data));
  refreshRecommendationPreferences();
  renderRecommendationUpdate();
  if (action === 'recommend-more' && isRecommendationsView()) void loadRecommendations(true);
  showToast(t('tools.feedbackSaved'));
}

async function launchPastedLink(target) {
  if (!target) return;
  try {
    await window.vortexDesktop.launchQuickGame(target);
    if (target.placeId) recordGameLaunch(getGame(target.placeId) || { id: target.placeId });
  } catch { showToast(t('toast.launchError')); }
}

function sameQuickLaunchTarget(first, second) {
  if (!first || !second || first.method !== second.method) return false;
  switch (first.method) {
    case 'public': return first.placeId === second.placeId;
    case 'private': return first.placeId === second.placeId && first.linkCode === second.linkCode;
    case 'share': return first.shareCode === second.shareCode && (first.shareType || 'Server') === (second.shareType || 'Server');
    case 'instance': return first.placeId === second.placeId && first.serverId === second.serverId;
    case 'access': return first.placeId === second.placeId && first.accessCode === second.accessCode;
    default: return false;
  }
}

async function pinPastedLink(target) {
  if (!target) return false;
  const known = getGame(target.placeId) || (String(detailGame?.id) === String(target.placeId) ? detailGame : null);
  const rawItem = { ...target, id: quickLaunchId(), type: 'game',
    title: target.title || known?.title || (target.placeId ? 'Roblox #' + target.placeId : t('tools.serverLink')),
    thumbnail: safeThumbnail(target.thumbnail || known?.icon || known?.thumbnail) || '',
    autoTitle: Boolean(!target.title && target.placeId && !known) };
  const cleaned = cleanQuickLaunchItems([rawItem])[0];
  if (!cleaned) {
    showToast(t('toast.launchError'));
    return false;
  }
  if (quickLaunchGames().some(game => sameQuickLaunchTarget(cleaned, game))) {
    showToast(t('tools.alreadyPinned'));
    return false;
  }
  preferences.quickLaunchItems.push(cleaned);
  persistQuickLaunchItems();
  showToast(t('tools.gamePinned'));
  return true;
}

async function saveDesktopShortcut(button) {
  const id = button.dataset.id;
  const item = button.dataset.quick ? findQuickLaunchGame(id)
    : String(detailGame?.id) === id ? detailGame : getGame(id);
  if (!item) return;
  try {
    let thumbnail = safeThumbnail(item.icon) || safeThumbnail(item.thumbnail);
    const placeId = item.method ? item.placeId : String(item.id);
    if (!thumbnail && placeId) thumbnail = (await quickGameMetadata(placeId, item.title)).thumbnail;
    const hasIcon = await window.vortexDesktop.createDesktopShortcut({
      title: item.title, method: item.method || 'public', placeId,
      linkCode: item.linkCode, shareCode: item.shareCode, shareType: item.shareType, serverId: item.serverId, accessCode: item.accessCode,
      thumbnail: thumbnail || ''
    });
    showToast(t(hasIcon ? 'tools.shortcutMade' : 'tools.shortcutFallback'));
  } catch { showToast(t('tools.shortcutError')); }
}

document.addEventListener('click', async event => {
  const button = event.target.closest?.('[data-launcher-action]');
  if (!button) return;
  const { launcherAction: action, id } = button.dataset;
  switch (action) {
    case 'close': launcherDialog.close(); return;
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
      if (currentView === 'friends' || isCurrentGamePage(detailGame?.id, 'friends')) renderPage();
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
    case 'folder-export': openQuickFolderShare(id); return;
    case 'folder-import': pickCollectionFile(); return;
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
    case 'collection': void submitCollection(form); return;
    case 'folder-export': void submitQuickFolderShare(form); return;
    case 'folder-import': void submitSharedFolder(); return;
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
