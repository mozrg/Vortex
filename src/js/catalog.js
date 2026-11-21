const catalogSortOrder = ['recommended', 'top-playing-now', 'top-trending', 'up-and-coming', 'top-rated',
  'top-revisited', 'fun-with-friends', 'gems'];
const catalogSortGlyphs = {
  recommended: 'sparkles', 'top-playing-now': 'playCircle', 'top-trending': 'trend', 'up-and-coming': 'rocket',
  'top-rated': 'trophy', 'top-revisited': 'repeat', 'fun-with-friends': 'party', gems: 'gem'
};
const catalogRankStorageKey = 'vortex.catalogRankHistory';
const catalogHour = 3600000;
let catalogRankHistory;
let catalogFriendsOnly = false;
let catalogGenreExplore = false;
let catalogFriendCache = new Map();
let catalogRecommendationsScroll = 0;
let recommendationObserver;

function rememberRecommendationScroll() {
  catalogRecommendationsScroll = document.querySelector('.main-area').scrollTop;
}

function restoreRecommendationScroll() {
  requestAnimationFrame(() => {
    if (isRecommendationsView()) document.querySelector('.main-area').scrollTop = catalogRecommendationsScroll;
  });
}

function selectCatalogCollection(sortId) {
  const alreadyOpen = currentView === 'catalog';
  if (alreadyOpen && !searchQuery && activeDiscoverySort === sortId && !catalogGenreExplore && activeAccess !== 'paid') return;
  if (isRecommendationsView()) rememberRecommendationScroll();
  if (!alreadyOpen) pushNavigationHistory('catalog');
  currentView = 'catalog';
  if (searchQuery) {
    searchQuery = '';
    searchInput.value = '';
    clearTimeout(searchTimer);
    searchRequestId += 1;
  }
  catalogGenreExplore = false;
  sortMode = 'default';
  if (activeAccess === 'paid') {
    activeAccess = 'all';
    preferences.catalogAccess = 'all';
    savePreferences();
  }
  if (sortId === RECOMMENDED_SORT.id) {
    discoveryRequestId += 1;
    activeDiscoverySort = sortId;
    localStorage.setItem('vortex.activeDiscoverySort', JSON.stringify(sortId));
    renderPage();
    restoreRecommendationScroll();
    void loadRecommendations();
  } else {
    void loadDiscoveryCatalog(sortId);
    document.querySelector('.main-area').scrollTop = 0;
  }
}

function toggleCatalogFriends() {
  catalogFriendsOnly = !catalogFriendsOnly;
  if (currentView === 'catalog') renderPage();
  else setView('catalog');
}

function renderCatalog() {
  const link = robloxSearchLink(searchQuery) || (preferences.streamMode && searchQuery === t('tools.streamLink') ? inboundRobloxLink : null);
  if (link) return pageHeading('', t('nav.catalog'), '') + renderRobloxSearchLink(link);
  if (looksLikeRobloxLink(searchQuery)) return pageHeading('', t('nav.catalog'), '') + `<p class="catalog-disclaimer">${t('tools.badLink')}</p>`;
  const recommended = isRecommendationsView();
  const query = searchQuery.trim();
  const chart = !query && !recommended && !isGenreSearchActive() && activeAccess !== 'paid';
  const chartData = discoveryCatalog[activeDiscoverySort];
  if (activeAccess === 'paid' && !query && paidStatus === 'idle') setTimeout(() => {
    if (currentView === 'catalog' && activeAccess === 'paid' && !searchQuery) void loadPaidGames();
  }, 0);
  if (recommended && recommendationState.status === 'idle') queueMicrotask(() => {
    if (isRecommendationsView()) void loadRecommendations();
  });
  indexCatalogFriends();
  if (shouldRefreshCatalogFriends() && !pauseBackgroundRefresh() && !friendsLoading &&
      (!friendsCache.data || Date.now() - friendsCache.at > FRIENDS_TTL)) {
    queueMicrotask(() => { if (shouldRefreshCatalogFriends()) void loadFriends(String(preferences.robloxUsername).trim()); });
  }
  const heading = `<header class="catalog-heading"><div><h1>${t(query ? 'page.search.title' : 'nav.catalog')}</h1>
    ${query ? `<p>${t('search.queryLabel', { query: escapeHtml(query) })}</p>` : ''}</div>
    <div class="catalog-heading-actions">${recommended ? `<button class="control-button control-button-pill" data-catalog-rec-settings>${icon('crosshair', 15)} ${t('chart.recommendationSettings')}</button>` : ''}
      <button class="control-button control-button-pill" data-launcher-action="surprise">${icon('die', 15)} ${t('tools.surpriseTitle')}</button>
      <button class="control-button control-button-icon control-button-pill" data-catalog-customize aria-label="${t('catalog.customize')}" data-tooltip="${t('catalog.customize')}">${icon('panels', 15)}</button></div></header>`;
  const shortcuts = query ? '' : `<div class="catalog-sort-row filter-row" role="group" aria-label="${t('chart.collections')}">
    ${catalogSorts().map(sort => {
      const active = activeDiscoverySort === sort.id;
      return `<button type="button" class="filter-chip ${active ? 'active' : ''}" aria-pressed="${active}"
        data-discovery-sort="${escapeHtml(sort.id)}">${icon(catalogSortGlyphs[sort.id] || 'catalog', 13)} ${escapeHtml(discoverySortLabel(sort))}</button>`;
    }).join('')}</div>`;
  const controls = `<div class="catalog-filter-row">
    ${renderGenreFilters()}${renderAccessFilters()}<button class="control-button control-button-pill" aria-pressed="${catalogFriendsOnly}" data-catalog-friends>
      ${icon('friendFilter', 15)} ${t('chart.onlyFriends')}</button>
    ${recommended ? '' : renderCustomSortSelect(!!query)}<span class="catalog-spacer"></span>
    ${chart ? renderChartRefresh(chartData) : ''}${recommended ? '' : renderCatalogViewToggle()}
  </div>`;
  return `<div class="catalog-page">${heading}<div class="catalog-controls">${shortcuts}${controls}</div>
    ${recommended ? renderRecommendations() : renderCatalogBody(query, chart, chartData)}</div>`;
}

function renderChartRefresh(chartData) {
  const date = new Date(chartData?.savedAt);
  const time = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(preferences.language, {
    ...(activityDateKey(date.getTime()) === activityDateKey() ? {} : { day: 'numeric', month: 'short' }),
    hour: '2-digit', minute: '2-digit'
  }).format(date) : '';
  const refreshing = discoveryStatus === 'loading';
  return `<div class="catalog-refresh">
    ${time ? `<time datetime="${date.toISOString()}" data-tooltip="${escapeHtml(date.toLocaleString(preferences.language))}">${t('chart.updatedAt', { time })}</time>` : ''}
    <button class="icon-button" data-catalog-refresh aria-label="${t('chart.refresh')}" data-tooltip="${t('chart.refresh')}"
      ${refreshing ? 'disabled aria-busy="true"' : ''}>${icon('refreshCw', 15)}</button></div>`;
}

function renderCatalogBody(query, chart, chartData) {
  const footer = (action, loading = false) => loading ? catalogLoading('search.loadingMore') :
    `<div class="catalog-feed-footer"><button class="ghost-button load-more-button" data-action="${action}">${t('catalog.loadMore')} ${icon('arrow', 13)}</button></div>`;
  const note = text => `<p class="catalog-disclaimer">${t(text)}</p>`;
  const list = filterGames();
  if (query) {
    if (query.length < 2) return catalogEmptyState('search.shortTitle', 'search.shortBody');
    if (searchStatus === 'loading') return catalogLoading(/^\d{5,20}$/.test(query) ? 'search.placeIdLoading' : 'search.loading');
    return (searchStatus === 'error' ? note('search.errorBody') : '') +
      renderCatalogResults(list) + (isLoadingMore || searchPageToken ? footer('load-more', isLoadingMore) : '');
  }
  if (activeAccess === 'paid') {
    if (paidStatus === 'loading') return catalogLoading('catalog.paidLoading');
    if (paidStatus === 'error') return note('catalog.paidError');
    const paid = filterCatalogFriends(paidGames.filter(game => activeCategory === 'all' || game.genreKey === activeCategory));
    const visible = paid.slice(0, paidVisibleCount);
    return renderCatalogResults(visible, { empty: catalogEmptyState('catalog.paidEmptyTitle', 'catalog.paidEmptyBody') }) +
      (paidExhausted && paid.length <= visible.length ? '' : footer('paid-more', paidStatus === 'loading-more'));
  }
  if (isGenreSearchActive()) {
    if (genreStatus === 'loading') return catalogLoading('catalog.loading');
    return (genreStatus === 'error' ? note('catalog.errorBody') : '') + renderCatalogResults(list) + footer('load-more-genre', genreLoadingMore);
  }
  if (!chartData && discoveryStatus === 'loading') return catalogLoading('catalog.loading');
  const previous = catalogPreviousRanks(activeDiscoverySort, chartData?.savedAt);
  const explore = activeCategory !== 'all' && !catalogFriendsOnly ? `<div class="catalog-feed-footer">
    <button class="ghost-button" data-catalog-explore-genre>${t('chart.exploreGenre')} ${icon('arrow', 13)}</button></div>` : '';
  return (discoveryStatus === 'error' ? note('catalog.errorBody') : '') +
    renderCatalogResults(list.slice(0, catalogVisibleCount), { chart, previous }) +
    (list.length > catalogVisibleCount ? footer('load-more') : explore);
}

async function loadDiscoveryCatalog(sortId = activeDiscoverySort, { force = false, preserveCount = false } = {}) {
  if (sortId === RECOMMENDED_SORT.id) {
    if (isRecommendationsView()) return loadRecommendations(force);
    return;
  }
  activeDiscoverySort = sortId;
  const requestId = ++discoveryRequestId;
  localStorage.setItem('vortex.activeDiscoverySort', JSON.stringify(sortId));
  const cached = discoveryCatalog[sortId];
  if (!preserveCount) catalogVisibleCount = CATALOG_PAGE_SIZE;
  if (!force && cached?.savedAt && Date.now() - cached.savedAt < DISCOVERY_CACHE_TTL &&
      Array.isArray(cached.items) && (!cached.items.length || cached.items.some(game => Number.isInteger(game.catalogRank)))) {
    discoveryStatus = 'success';
    if (currentView === 'catalog') renderPage();
    return;
  }
  discoveryStatus = 'loading';
  if (currentView === 'catalog') renderPage();
  try {
    if (!window.vortexDesktop?.discoverGames) throw new Error('Desktop catalog unavailable');
    const source = sortId === 'gems' ? 'top-rated' : sortId;
    const response = await window.vortexDesktop.discoverGames({ sortId: source, sessionId: discoverySessionId });
    if (requestId !== discoveryRequestId) return;
    if (!Array.isArray(response.items)) throw new Error('No chart items');
    discoverySessionId = response.sessionId || discoverySessionId;
    discoverySorts = Array.isArray(response.sorts) && response.sorts.length ? response.sorts : fallbackDiscoverySorts;
    const loaded = response.items.map(game => normalizeDiscoveredGame(game));
    const items = sortId === 'gems' ? chooseCatalogGems(loaded) : loaded;
    const savedAt = Date.now();
    catalogRankSnapshot(sortId, items, savedAt);
    discoveryCatalog = { ...discoveryCatalog, [sortId]: { savedAt, items } };
    const known = new Map(dynamicGames.map(game => [String(game.id), game]));
    for (const { catalogRank, ...game } of items) known.set(game.id, { ...known.get(game.id), ...game });
    dynamicGames = [...known.values()].slice(-1200);
    try {
      localStorage.setItem('vortex.discoverySessionId', JSON.stringify(discoverySessionId));
      localStorage.setItem('vortex.discoverySorts', JSON.stringify(discoverySorts));
      localStorage.setItem('vortex.discoveryCatalog', JSON.stringify(discoveryCatalog));
      localStorage.setItem('vortex.discovered', JSON.stringify(dynamicGames));
    } catch { /* The current chart is still available in the session. */ }
    discoveryStatus = 'success';
  } catch {
    if (requestId !== discoveryRequestId) return;
    discoveryStatus = 'error';
  }
  if (currentView === 'catalog') renderPage();
}

function isRecommendationsView() {
  return typeof currentView !== 'undefined' && currentView === 'catalog' && !searchQuery &&
    activeAccess !== 'paid' && activeDiscoverySort === RECOMMENDED_SORT.id;
}

function catalogRankSnapshot(sortId, games, at) {
  catalogRankHistory ||= readStored(catalogRankStorageKey, {}) || {};
  const ranks = Object.fromEntries(games.filter(game => Number.isInteger(game.catalogRank) && game.catalogRank > 0)
    .map(game => [experienceKey(game), game.catalogRank]));
  if (!Object.keys(ranks).length) return;
  const since = at - 49 * catalogHour;
  const recent = (Array.isArray(catalogRankHistory[sortId]) ? catalogRankHistory[sortId] : []).filter(entry => entry.at > since);
  if (at - (recent.at(-1)?.at || 0) < catalogHour / 2) return;
  catalogRankHistory[sortId] = [...recent, { at, ranks }].slice(-100);
  try { localStorage.setItem(catalogRankStorageKey, JSON.stringify(catalogRankHistory)); } catch { /* The session can still compare snapshots. */ }
}

function catalogPreviousRanks(sortId, at) {
  catalogRankHistory ||= readStored(catalogRankStorageKey, {}) || {};
  const snapshots = catalogRankHistory[sortId];
  if (!at || !Array.isArray(snapshots)) return null;
  const target = at - 24 * catalogHour;
  let closest = null;
  let distance = 2 * catalogHour;
  for (const snap of snapshots) {
    const delta = Math.abs(snap.at - target);
    if (delta <= distance) { distance = delta; closest = snap.ranks; }
  }
  return closest;
}

function catalogLikeRatio(game) {
  const up = Math.max(0, Number(game.upVotes) || 0);
  const down = Math.max(0, Number(game.downVotes) || 0);
  return up + down ? up / (up + down) : null;
}

function chooseCatalogGems(games) {
  return games.filter(game => {
    const online = Number(game.playerCount);
    return online > 0 && online <= 5000 && catalogLikeRatio(game) >= .82 && Number(game.upVotes) + Number(game.downVotes) >= 40;
  }).sort((a, b) => (catalogLikeRatio(b) * Math.log1p(b.upVotes) / Math.pow(Math.max(30, b.playerCount), .33)) -
    (catalogLikeRatio(a) * Math.log1p(a.upVotes) / Math.pow(Math.max(30, a.playerCount), .33)))
    .map((game, index) => ({ ...game, catalogRank: index + 1 }));
}

function indexCatalogFriends() {
  catalogFriendCache = new Map();
  for (const [i, friend] of (friendsCache.data?.friends || []).entries()) {
    if (friend.presence !== 'playing') continue;
    const keys = [friend.universeId && 'universe:' + friend.universeId, ...[friend.rootPlaceId, friend.placeId, friend.playingPlaceId]
      .filter(Boolean).map(id => 'place:' + id)];
    const display = safeFriendForDisplay(friend, i);
    for (const key of new Set(keys.filter(Boolean))) {
      if (!catalogFriendCache.has(key)) catalogFriendCache.set(key, []);
      catalogFriendCache.get(key).push(display);
    }
  }
}

function catalogFriendsFor(game) {
  return [...new Map([...(catalogFriendCache.get(experienceKey(game)) || []), ...(catalogFriendCache.get('place:' + game.id) || [])]
    .map(friend => [friend.id, friend])).values()];
}

function filterCatalogFriends(list) {
  return catalogFriendsOnly ? list.filter(game => catalogFriendsFor(game).length) : list;
}

function shouldRefreshCatalogFriends() {
  return currentView === 'catalog' && !!String(preferences.robloxUsername || '').trim();
}

function catalogFriendTarget(friend) {
  const place = String(friend.placeId || friend.playingPlaceId || '');
  const server = String(friend.gameId || '');
  return gameIdPattern.test(place) && serverIdPattern.test(server) ? { place, server } : null;
}

function renderCatalogFriends(game) {
  const playing = catalogFriendsFor(game);
  if (!playing.length) return '<span class="catalog-no-friends">—</span>';
  const summary = t('chart.friendsPlaying', { count: playing.length });
  return renderVortexPopup({ label: summary, triggerClass: 'catalog-friends-trigger',
    trigger: `<span class="catalog-avatars" aria-hidden="true">${playing.slice(0, 3).map(renderCatalogAvatar).join('')}</span><span>${playing.length}</span>`,
    panel: playing.map(friend => {
        const target = catalogFriendTarget(friend);
        const name = friend.displayName || friend.name || t('friends.unknown');
        return `<div class="catalog-friend-entry">${renderCatalogAvatar(friend)}<span>${escapeHtml(name)}</span>
          ${target && !preferences.streamMode ? `<button type="button" class="control-button" data-catalog-join="${escapeHtml(String(friend.id))}">${icon('doorOut', 13)} ${t('place.join')}</button>` : ''}</div>`;
      }).join('') });
}

function renderCatalogAvatar(friend) {
  const avatar = safeThumbnail(friend.avatar);
  return `<span class="catalog-avatar" aria-hidden="true">${avatar ? `<img src="${escapeHtml(avatar)}" alt="" loading="lazy">`
    : escapeHtml((friend.displayName || friend.name || '?').slice(0, 1).toUpperCase())}</span>`;
}

function catalogEmptyState(title = 'empty.noResults', message = 'empty.filterHint', button = '') {
  if (catalogFriendsOnly) {
    if (!preferences.robloxUsername) {
      title = 'chart.friendsSetup'; message = 'chart.friendsSetupHint';
      button = `<button class="ghost-button" data-catalog-friends-settings>${t('friends.setup.action')}</button>`;
    } else if (!friendsLoading && friendsCache.data?.ok === false) {
      title = 'chart.friendsError'; message = 'friends.networkBody';
      button = `<button class="ghost-button" data-catalog-friends-refresh>${t('friends.refresh')}</button>`;
    } else if (friendsLoading || !friendsCache.data) {
      return catalogLoading('friends.loading');
    } else {
      title = 'chart.noFriendsFound'; message = 'chart.noFriendsFoundHint';
    }
  }
  return `<div class="empty-state catalog-empty"><div class="empty-icon">${icon(catalogFriendsOnly ? 'users' : 'search', 20)}</div>
    <h2>${t(title)}</h2><p>${t(message)}</p>${button}</div>`;
}

function catalogLoading(key) {
  return `<div class="search-loading" role="status"><span class="loading-spinner"></span><strong>${t(key)}</strong></div>`;
}

function catalogRankText(game, previous, type = 'rank') {
  const rank = game.catalogRank;
  if (!Number.isInteger(rank) || rank < 1) return '—';
  if (type === 'rank') return String(rank);
  const old = previous?.[experienceKey(game)];
  if (!Number.isInteger(old)) return '—';
  const delta = old - rank;
  return delta ? `<span class="catalog-rank-change ${delta > 0 ? 'up' : 'down'}" aria-label="${escapeHtml(t(delta > 0 ? 'chart.rise' : 'chart.fall', { count: Math.abs(delta) }))}">${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}</span>` : '0';
}

function renderCatalogArt(game, { hero = false, eager = false } = {}) {
  const cover = hero && Array.isArray(game.media) ? game.media.find(item => item.type === 'image')?.url : '';
  const art = safeThumbnail(cover) || safeThumbnail(game.thumbnail || game.icon);
  return art ? `<img src="${escapeHtml(art)}" alt="" loading="${hero || eager || !preferences.lazyImages ? 'eager' : 'lazy'}" decoding="async">` :
    `<span class="catalog-art-fallback">${icon('gamepad', 24)}</span>`;
}

function renderCatalogStar(game) {
  const id = String(game.id);
  const picked = favorites.has(id);
  const label = t(picked ? 'card.favoriteRemove' : 'card.favoriteAdd');
  return `<button class="icon-button catalog-star" type="button" data-action="favorite" data-id="${escapeHtml(id)}"
    aria-label="${escapeHtml(label)}" data-tooltip="${escapeHtml(label)}" aria-pressed="${picked}">${icon('star', 16)}</button>`;
}

function renderCatalogPlay(game, className = 'catalog-play') {
  return `<button class="ghost-button ${className}" type="button" data-action="play" data-id="${escapeHtml(String(game.id))}"
    ${game.availability === 'unavailable' ? 'disabled' : ''}>${icon('play', 12)} ${t('card.play')}</button>`;
}

function renderCatalogTitle(game) {
  const id = escapeHtml(String(game.id));
  const label = escapeHtml(game.title);
  const hint = preferences.cardShowDescription && game.description ? label + ' · ' + escapeHtml(game.description) : label;
  return `<span class="catalog-game-name"><button type="button" class="catalog-game-title" data-action="open-details"
    data-id="${id}" data-tooltip="${hint}">${label}</button>${renderVerifiedCreatorBadge(game)}</span>`;
}

function renderCatalogGenre(game) {
  const genre = catalogGenreLabel(game);
  const price = Number(game.price || game.priceInRobux);
  return [preferences.cardShowGenre && genre ? escapeHtml(genre) : '', price > 0 ? formatCount(price) + ' R$' : '',
    preferences.cardShowPlaytime ? renderPlaytimeBadge(game.id) : ''].filter(Boolean).join(' <span aria-hidden="true">·</span> ');
}

function catalogGenreLabel(game) {
  return game.genreKey === 'other' && game.genre ? String(game.genre) : localizeGame(game).genre;
}

function renderCatalogRating(game) {
  const ratio = catalogLikeRatio(game);
  if (ratio === null) return '—';
  const percent = Math.round(ratio * 100);
  return `<span class="catalog-rating" aria-label="${escapeHtml(t('search.likes', { percent }))}">${icon('thumb', 13)} ${percent}%</span>`;
}

function renderCatalogPlayers(game) {
  const count = game.playerCount ?? game.playing;
  return Number.isFinite(Number(count)) && count !== null && count !== '' ? formatCount(count) : '—';
}

function renderCatalogResults(list, { chart = false, previous = null, empty = '' } = {}) {
  if (!list.length) return empty || catalogEmptyState();
  const context = { chart, previous };
  if (!preferences.catalogGroupByGenre) return renderCatalogCollection(list, context);
  const groups = new Map();
  for (const game of list) {
    const genre = catalogGenreLabel(game);
    if (!groups.has(genre)) groups.set(genre, []);
    groups.get(genre).push(game);
  }
  return `<div class="catalog-genre-groups">${[...groups].map(([genre, items]) => `<section class="catalog-genre-section">
    <div class="catalog-genre-head"><h2>${escapeHtml(genre)}</h2><span>${items.length}</span></div>${renderCatalogCollection(items, context)}</section>`).join('')}</div>`;
}

function renderCatalogCollection(list, context) {
  if (preferences.catalogView !== 'list') {
    return `<div class="catalog-tiles">${list.map(game => renderCatalogTile(game, context)).join('')}</div>`;
  }
  const { chart, previous } = context;
  return `<div class="catalog-table-wrap"><table class="catalog-table">
    <thead><tr>${chart ? '<th class="catalog-col-rank" scope="col">#</th>' : ''}<th scope="col">${t('chart.game')}</th>
      <th scope="col" class="catalog-col-players">${t('chart.players')}</th>${chart ? `<th scope="col" class="catalog-col-change">${t('chart.day')}</th>` : ''}
      ${preferences.cardShowLikes ? `<th scope="col" class="catalog-col-rating">${t('chart.rating')}</th>` : ''}
      <th scope="col" class="catalog-col-friends">${t('nav.friends')}</th>
      <th scope="col" class="catalog-col-actions" aria-label="${t('chart.actions')}"></th></tr></thead>
    <tbody>${list.map((game, index) => `<tr data-game="${escapeHtml(String(game.id))}">
      ${chart ? `<td class="catalog-col-rank">${catalogRankText(game, previous)}</td>` : ''}
      <td><div class="catalog-row-game"><span class="catalog-art">${renderCatalogArt(game, { eager: index < 12 })}</span><div>
        ${renderCatalogTitle(game)}<div class="catalog-game-meta">${renderCatalogGenre(game)}</div></div></div></td>
      <td class="catalog-col-players">${renderCatalogPlayers(game)}</td>${chart ? `<td class="catalog-col-change">${catalogRankText(game, previous, 'change')}</td>` : ''}
      ${preferences.cardShowLikes ? `<td class="catalog-col-rating">${renderCatalogRating(game)}</td>` : ''}
      <td class="catalog-col-friends">${renderCatalogFriends(game)}</td>
      <td class="catalog-col-actions"><div>${renderCatalogStar(game)}${renderCatalogPlay(game)}</div></td></tr>`).join('')}</tbody></table></div>`;
}

function renderCatalogTile(game, { chart = false, previous = null, recommended = false } = {}) {
  const id = escapeHtml(String(game.id));
  const score = recommended && game.recommendationReason && game.recommendationScore;
  const rank = chart && Number.isInteger(game.catalogRank) ? `#${game.catalogRank}` : '';
  const players = renderCatalogPlayers(game);
  return `<article class="catalog-tile" data-game="${id}"><div class="catalog-art catalog-tile-art">
    ${renderCatalogArt(game)}
    <button type="button" class="catalog-cover-link" data-action="open-details" data-id="${id}"
      aria-label="${escapeHtml(t('card.openDetails', { title: game.title }))}"></button>
    ${rank ? `<span class="catalog-image-label catalog-rank-label">${rank}</span>` : ''}
    ${players === '—' ? '' : `<span class="catalog-image-label catalog-players-label">${t('search.players', { count: players })}</span>`}
    ${renderCatalogStar(game)}${renderCatalogPlay(game, 'catalog-tile-play')}
    </div><div class="catalog-tile-copy">${renderCatalogTitle(game)}<div class="catalog-game-meta">${renderCatalogGenre(game)}</div>
    <div class="catalog-tile-meta">${preferences.cardShowLikes ? renderCatalogRating(game) : ''}
      ${chart ? catalogRankText(game, previous, 'change') : ''}
      ${score ? renderCatalogMatch(score) : ''}<span class="catalog-spacer"></span>
      ${renderCatalogFriends(game)}${recommended ? renderRecommendationMenu(game) : ''}</div>
    ${recommended && game.recommendationReason ? `<small class="catalog-tile-reason" data-tooltip="${escapeHtml(catalogReason(game))}">${escapeHtml(catalogReason(game))}</small>` : ''}</div></article>`;
}

function bindRecommendationScroll() {
  recommendationObserver?.disconnect();
  const next = document.querySelector('[data-recommendation-next]');
  if (!next || !isRecommendationsView() || typeof IntersectionObserver !== 'function') return;
  recommendationObserver ||= new IntersectionObserver(entries => {
    if (!isRecommendationsView() || pauseBackgroundRefresh() || document.hidden) return;
    if (entries.some(entry => entry.target.isConnected && entry.isIntersecting)) {
      recommendationObserver.disconnect();
      void loadRecommendations(false, true);
    }
  }, { root: document.querySelector('.main-area'), rootMargin: '0px 0px 420px 0px' });
  recommendationObserver.observe(next);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isRecommendationsView()) bindRecommendationScroll();
});

document.addEventListener('click', event => {
  if (currentView !== 'catalog') return;
  const open = '.catalog-page details[open]';
  for (const details of document.querySelectorAll(open)) if (!details.contains(event.target)) details.open = false;
  const button = event.target.closest?.('button');
  if (!button) return;
  if (button.hasAttribute('data-catalog-friends')) {
    toggleCatalogFriends();
    return;
  }
  if (button.hasAttribute('data-catalog-rec-settings')) {
    showRecommendationSettings();
    return;
  }
  if (button.hasAttribute('data-catalog-friends-settings')) {
    preferences.settingsTab = 'general';
    setView('settings');
    return;
  }
  if (button.hasAttribute('data-catalog-friends-refresh')) {
    void loadFriends(String(preferences.robloxUsername || '').trim(), true);
    return;
  }
  if (button.hasAttribute('data-catalog-refresh')) {
    void loadDiscoveryCatalog(activeDiscoverySort, { force: true });
    return;
  }
  if (button.hasAttribute('data-catalog-explore-genre')) {
    catalogGenreExplore = true;
    void fetchGenreGames(false);
    return;
  }
  if (button.dataset.catalogJoin && !preferences.streamMode) {
    const friend = friendsCache.data?.friends?.find(friend => String(friend.id) === button.dataset.catalogJoin);
    const target = friend?.presence === 'playing' && catalogFriendTarget(friend);
    if (target) void openGame(target.place, target.server);
    else showToast(t('chart.friendLeft'));
  }
});

document.addEventListener('keydown', event => {
  const open = event.target.closest?.('.catalog-page details[open]');
  if (event.key !== 'Escape' || !open) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  open.open = false;
  open.querySelector('summary').focus();
}, true);
