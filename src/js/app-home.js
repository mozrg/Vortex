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

function getGame(id) {
  const key = String(id);
  return allGames().find(game => String(game.id) === key) || recommendationState.items.find(game => String(game.id) === key);
}

function experienceKey(game) {
  return Number(game?.universeId) > 0 ? 'universe:' + game.universeId : 'place:' + game?.id;
}

// Keep the most recently joined place in each experience. Unresolved places
// retain their IDs until Roblox supplies their universe metadata.
function uniqueRecentIds(ids) {
  const byId = new Map(allGames().map(game => [String(game.id), game]));
  const seen = new Set();
  const result = [];
  for (const value of ids) {
    const id = String(value ?? '').trim();
    if (!/^\d+$/.test(id)) continue;
    const key = experienceKey(byId.get(id) || { id });
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(id);
    if (result.length === 12) break;
  }
  return result;
}

function saveRecentGames(ids) {
  recentGames = uniqueRecentIds(ids);
  accountStorage.setItem('vortex.recent', JSON.stringify(recentGames));
}
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

function renderVerifiedCreatorBadge(game) {
  if (!game.creator || game.creatorVerified !== true) return '';
  const label = escapeHtml(t('game.verifiedCreator'));
  return `<span class="verified-badge" role="img" aria-label="${label}" data-tooltip="${label}">${icon('verified', 15)}</span>`;
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

// Use the same hour unit for short and long sessions.
function formatPlaytime(totalSeconds) {
  const minutes = Math.floor(Number(totalSeconds) / 60);
  if (!Number.isFinite(minutes) || minutes < 1) return null;
  if (minutes < 60) return { value: minutes, unit: t('time.minutes') };
  const hours = minutes / 60;
  return { value: Math.round(hours * 10) / 10, unit: t('time.hours') };
}
// Keep the stored place IDs for launching. Statistics combine places once their
// shared Roblox universe is known, including sessions saved by older versions.
function groupedPlaytime(entries, gamesById) {
  const groups = new Map();
  for (const [id, entry] of Object.entries(entries || {})) {
    const key = experienceKey(gamesById.get(id) || { id });
    const total = groups.get(key) || { id, seconds: 0, launches: 0, lastPlayed: 0 };
    total.seconds += Math.max(0, Number(entry?.seconds ?? entry) || 0);
    total.launches += Math.max(0, Number(entry?.launches) || 0);
    if (Number(entry?.lastPlayed) > total.lastPlayed) {
      total.id = id;
      total.lastPlayed = Number(entry.lastPlayed);
    }
    groups.set(key, total);
  }
  return groups;
}

let playtimeSummary = null;
function playtimeForView() {
  if (!playtimeSummary) {
    const gamesById = new Map(allGames().map(game => [String(game.id), game]));
    if (currentView === 'game-detail' && detailGame?.universeId) gamesById.set(String(detailGame.id), detailGame);
    playtimeSummary = { gamesById, totals: groupedPlaytime(playStats, gamesById) };
  }
  return playtimeSummary;
}

function renderPlaytimeBadge(gameId) {
  const { totals, gamesById } = playtimeForView();
  const entry = totals.get(experienceKey(gamesById.get(String(gameId)) || { id: gameId }));
  const formatted = entry && entry.seconds ? formatPlaytime(entry.seconds) : null;
  if (!formatted) return '';
  const label = formatted.value.toLocaleString(preferences.language === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 1 });
  return `<span class="card-playtime">${icon('clock', 11)} ${label}${formatted.unit}</span>`;
}

function openGameDetails(id) {
  // Paid results live in their own list, so they must be searched too.
  const game = getGame(id) || openGameTabs.find(tab => tab.id === String(id))?.game
    || genreResults.find((item) => String(item.id) === String(id))
    || searchResults.find((item) => String(item.id) === String(id))
    || (currentView === 'catalog' ? catalogFriendGames().find(item => String(item.id) === String(id)) : null)
    || paidGames.find((item) => String(item.id) === String(id))
    || (libraryTabs.some(tab => tab.id === currentView) && gameIdPattern.test(String(id)) ? libraryGame(id) : null);
  if (!game) return;
  const fromCatalog = currentView === 'catalog';
  rememberGameTab(game);
  const requestId = ++detailRequestId;
  detailBadgeCount = 3;
  detailBadgesExpanded = true;
  detailDescriptionExpanded = false;
  detailOnlineUpdatedAt = 0;
  detailOnlineRefreshing = false;
  const placeId = String(game.id);
  detailGame = { ...game, upVotes: Number(game.upVotes) || 0, downVotes: Number(game.downVotes) || 0, playing: Number(game.playerCount) || 0, visits: Number(game.visits) || 0, favorites: Number(game.favorites) || 0 };
  detailStatus = 'loading';
  pushNavigationHistory('game-detail');
  currentView = 'game-detail';
  renderPage();
  if (fromCatalog) document.querySelector('.main-area').scrollTop = 0;
  const cacheKey = String(game.universeId || game.id);
  const cached = readDetailCache(cacheKey);
  if (cached) {
    detailGame = { ...detailGame, ...cached, id: placeId };
    detailStatus = 'success';
    renderPage();
    return;
  }
  if (!window.vortexDesktop?.getGameDetails) { detailStatus = 'error'; renderPage(); return; }
  const timeout = new Promise((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 14000));
  Promise.race([window.vortexDesktop.getGameDetails({ universeId: game.universeId, placeId: game.id }), timeout]).then((response) => {
    if (requestId !== detailRequestId || currentView !== 'game-detail') return;
    if (!response?.ok) { detailStatus = 'error'; renderPage(); return; }
    detailGame = { ...detailGame, ...response.game, id: placeId };
    detailStatus = 'success';
    writeDetailCache(cacheKey, response.game);
    renderPage();
    loadGameReleaseHistory(requestId);
  }).catch(() => { if (requestId === detailRequestId && currentView === 'game-detail') { detailStatus = 'error'; renderPage(); } });
}

async function loadGameReleaseHistory(requestId) {
  if (!detailGame?.universeId || !window.vortexDesktop?.getReleaseHistory) return;
  try {
    const history = await window.vortexDesktop.getReleaseHistory(String(detailGame.universeId));
    if (requestId !== detailRequestId || currentView !== 'game-detail') return;
    if (!Array.isArray(history) || !history.length) return;
    detailGame = { ...detailGame, releaseHistory: history };
    renderPage();
  } catch { /* Release history is optional. */ }
}

// Refresh just the live numbers of the open game: the rest of the page keeps
// its scroll and its loaded media.
async function refreshGameOnline() {
  if (!detailGame || detailOnlineRefreshing) return;
  const requestId = detailRequestId;
  detailOnlineRefreshing = true;
  renderPage();
  try {
    const response = await window.vortexDesktop?.getGameOnline?.({
      universeId: String(detailGame.universeId || ''),
      placeId: String(detailGame.id || '')
    });
    if (requestId !== detailRequestId) return;
    if (response?.ok && currentView === 'game-detail') {
      detailGame = {
        ...detailGame,
        playing: Number(response.playing) || 0,
        visits: Number(response.visits ?? detailGame.visits) || 0,
        favorites: Number(response.favorites ?? detailGame.favorites) || 0,
        updated: response.updated || detailGame.updated,
        upVotes: Number(response.upVotes ?? detailGame.upVotes) || 0,
        downVotes: Number(response.downVotes ?? detailGame.downVotes) || 0
      };
      detailOnlineUpdatedAt = Date.now();
      writeDetailCache(String(detailGame.universeId || detailGame.id), detailGame);
    } else if (response && !response.ok) {
      showToast(t('game.onlineRefreshError'));
    }
  } catch {
    if (requestId === detailRequestId) showToast(t('game.onlineRefreshError'));
  } finally {
    if (requestId === detailRequestId) {
      detailOnlineRefreshing = false;
      if (currentView === 'game-detail') renderPage();
    }
  }
}

function renderGameCard(game, options) {
  game = localizeGame(game);
  const isFavorite = favorites.has(game.id);
  const id = escapeHtml(game.id);
  const art = ['blox', 'doors', 'brookhaven', 'dti', 'tower', 'arsenal', 'adopt', 'evade', 'live'].includes(game.art) ? game.art : 'live';
  const thumbnail = safeThumbnail(game.thumbnail);
  const likes = Number(game.upVotes) + Number(game.downVotes) > 0 ? Math.round((Number(game.upVotes) / (Number(game.upVotes) + Number(game.downVotes))) * 100) : null;
  const liveStats = game.live ? `<div class="game-live-stats"><span>${icon('users', 12)} ${t('search.players', { count: formatCount(game.playerCount) })}</span>${likes === null ? '' : `<span>${icon('thumb', 12)} ${t('search.likes', { percent: likes })}</span>`}</div>` : '';
  const cardVerified = renderVerifiedCreatorBadge(game);
  const cardPrice = Number(game.price) > 0 ? `<span class="card-price-tag">${formatCount(game.price)} R$</span>` : '';
  const cardUnavailable = game.availability === 'unavailable' ? `<span class="card-unavailable-tag">${t('game.notAvailable')}</span>` : '';
  const description = String(game.description || t('game.fallbackDescription')).trim();
  const category = game.genre ? `<span class="game-category"><i></i>${escapeHtml(game.genre)}</span>` : '<span></span>';
  const expandedDescription = expandedDescriptions.has(String(game.id));
  const canExpandDescription = description.length > 100;
  const reason = showRecommendationReason(game);
  return `<article class="game-card${reason ? ' is-recommendation' : ''}" style="--game-color: var(--accent)" data-game="${id}" data-universe-id="${escapeHtml(game.universeId || '')}" ${options?.draggable ? `data-library-favorite-drag="${id}"` : ''}>
    <div class="game-cover art-${art} ${thumbnail ? 'has-thumbnail' : ''}">
      <button class="game-cover-action" type="button" data-action="open-details" data-id="${id}" aria-label="${t('card.openDetails', { title: escapeHtml(game.title) })}"></button>
      ${thumbnail ? `<img class="game-thumbnail" src="${escapeHtml(thumbnail)}" alt="" loading="${preferences.lazyImages ? 'lazy' : 'eager'}" decoding="async" />` : ''}
      <span class="cover-shine"></span>
      ${cardUnavailable}
      <button class="favorite-button ${isFavorite ? 'is-favorite' : ''}" data-action="favorite" data-id="${id}" aria-label="${isFavorite ? t('card.favoriteRemove') : t('card.favoriteAdd')}" aria-pressed="${isFavorite}">${icon('star', 15)}</button>
    </div>
    <div class="game-info">
      <div class="game-card-copy">
      <h3 class="game-title-row"><button class="game-title" type="button" data-action="open-details" data-id="${id}">${escapeHtml(game.title)}</button>${cardVerified}</h3>
      ${preferences.cardShowDescription ? `<p class="game-description ${expandedDescription ? 'expanded' : ''}" data-tooltip="${escapeHtml(description)}">${escapeHtml(description)}</p>
      ${canExpandDescription ? `<button class="description-more" data-action="toggle-description" data-id="${id}" aria-expanded="${expandedDescription}">${t(expandedDescription ? 'card.readLess' : 'card.readMore')}</button>` : ''}` : ''}
      ${preferences.cardShowLikes ? liveStats : ''}
      </div>
      <div class="game-card-end">${reason}
      <div class="game-card-footer"><span class="game-card-meta">${preferences.cardShowGenre ? category : ''}${cardPrice}${preferences.cardShowPlaytime ? renderPlaytimeBadge(game.id) : ''}</span><button class="card-play" data-action="play" data-id="${id}">${icon('play', 11)} ${t('card.play')}</button></div></div>
    </div>
  </article>`;
}

function renderGrid(list, emptyTitle, emptyText, emptyAction = 'catalog', view = preferences.catalogView) {
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
      .map(([genre, games]) => `<section class="catalog-genre-section"><div class="catalog-genre-head"><h2>${escapeHtml(genre)}</h2><span>${games.length}</span></div><div class="game-grid ${view === 'list' ? 'catalog-list-view' : ''}">${games.map(renderGameCard).join('')}</div></section>`).join('');
    return `<div class="catalog-genre-groups">${sections}</div>`;
  }
  return `<div class="game-grid ${view === 'list' ? 'catalog-list-view' : ''}">${list.map(renderGameCard).join('')}</div>`;
}

function pageHeading(eyebrow, title, description, action = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ''}</div>`;
}

// "Most played" strip for the home page: top games by banked playtime.
function renderPlayStats(limit = 3) {
  const { totals, gamesById } = playtimeForView();
  const entries = [...totals.values()]
    .filter(entry => gamesById.has(entry.id) && (entry.launches || entry.seconds))
    .sort((a, b) => b.seconds - a.seconds)
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
    <div class="play-stats-grid">${entries.map(entry => { const game = gamesById.get(entry.id); const thumbnail = safeThumbnail(game.thumbnail); return `
      <button class="play-stat-card" data-action="play" data-id="${escapeHtml(String(game.id))}">
        <span class="play-stat-art ${thumbnail ? 'has-thumbnail' : ''}">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" />` : ''}</span>
        <span class="play-stat-copy"><strong>${escapeHtml(game.title)}</strong><small>${formatTime(Number(entry.seconds))} · ${formatLaunches(entry.launches || 1)}</small></span>
        <span class="play-stat-track" aria-hidden="true"><i style="width:${100 * (Number(entry.seconds) || 0) / Math.max(1, entries[0].seconds || 0)}%"></i></span>
      </button>`; }).join('')}</div>
  </section>`;
}

// ---------- Home widgets (Stage 4) ----------
// The home page is assembled from blocks the user can reorder, hide and collapse.
// Order/visibility/collapsed state live in preferences; the drag machinery from
// the sidebar (data-ui-order + ui-row) is reused for the widget list.
const HOME_WIDGETS = [
  { key: 'hero', titleKey: 'settings.home.hero', bodyKey: 'settings.home.heroHint', icon: 'image' },
  { key: 'playstats', titleKey: 'home.widgets.playstats', bodyKey: 'home.widgets.playstatsBody', icon: 'chartBars' },
  { key: 'favorites', titleKey: 'home.widgets.favorites', bodyKey: 'home.widgets.favoritesBody', icon: 'star' },
  { key: 'recent', titleKey: 'home.widgets.recent', bodyKey: 'home.widgets.recentBody', icon: 'history' },
  { key: 'picks', titleKey: 'settings.home.recommendations', bodyKey: 'settings.home.recommendationsHint', icon: 'grid' }
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

function renderWeekActivity() {
  const today = activityDateKey();
  const monday = shiftActivityDate(today, -((new Date().getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const key = shiftActivityDate(monday, index);
    const seconds = Object.values(activityData.days[key]?.games || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
    return { key, seconds };
  });
  const peak = Math.max(1, ...days.map(day => day.seconds));
  const total = days.reduce((sum, day) => sum + day.seconds, 0);
  return `<button type="button" class="week-activity" data-nav="activity">
    <span>${t('home.thisWeek')}</span><strong>${formatActivityMinutes(total)}</strong>
    <span class="week-bars" aria-hidden="true">${days.map(({ key, seconds }) =>
      `<i class="${key === today ? 'today' : ''}" style="height:${Math.max(6, Math.round(100 * seconds / peak))}%"></i>`).join('')}</span>
  </button>`;
}

function resolveHomeHeroCandidate(customGames, featured) {
  const recentMeta = typeof recentMetadata === 'function' ? recentMetadata() : {};
  const lastExited = typeof getLastExitedSession === 'function' ? getLastExitedSession() : null;

  // User-pinned banner game ("На баннер") always takes top priority.
  if (featured) {
    const featuredId = String(featured.id);
    const exitedSame = lastExited?.placeId === featuredId ? lastExited.serverId : '';
    const srv = typeof validSessionServer === 'function'
      ? (validSessionServer(exitedSame) || validSessionServer(recentMeta?.[featuredId]?.serverId))
      : '';
    return { game: featured, isLastPlayed: false, rejoinPlaceId: featuredId, rejoinServerId: srv };
  }

  const active = typeof currentPlayingInviteState === 'function' ? currentPlayingInviteState() : null;
  const recentId = Array.isArray(recentGames) && recentGames.length ? String(recentGames[0]) : '';

  if (active?.placeId) {
    const known = getGame(active.placeId) || customGames.find(g => String(g.id) === active.placeId);
    const game = known ? localizeGame(known) : { id: active.placeId, title: active.title, thumbnail: active.thumbnail, description: '' };
    return { game, isLastPlayed: true, rejoinPlaceId: active.placeId, rejoinServerId: active.serverId || lastExited?.serverId || '' };
  }
  if (lastExited?.placeId) {
    const known = getGame(lastExited.placeId) || customGames.find(g => String(g.id) === lastExited.placeId);
    const game = known ? localizeGame(known) : { id: lastExited.placeId, title: lastExited.title, thumbnail: lastExited.thumbnail, description: '' };
    return { game, isLastPlayed: true, rejoinPlaceId: lastExited.placeId, rejoinServerId: lastExited.serverId || '' };
  }
  if (recentId) {
    const known = getGame(recentId) || customGames.find(g => String(g.id) === recentId);
    if (known) {
      const srv = typeof validSessionServer === 'function' ? validSessionServer(recentMeta?.[recentId]?.serverId) : '';
      return { game: localizeGame(known), isLastPlayed: true, rejoinPlaceId: recentId, rejoinServerId: srv };
    }
  }
  return { game: null, isLastPlayed: false, rejoinPlaceId: '', rejoinServerId: '' };
}

function renderShelfBanner(featured, heroState = null) {
  const game = heroState?.game || featured;
  const isLastPlayed = Boolean(heroState?.isLastPlayed);
  const rejoinPlaceId = heroState?.rejoinPlaceId || (game ? String(game.id) : '');
  const rejoinServerId = heroState?.rejoinServerId || '';
  const art = safeThumbnail(game?.thumbnail);
  const title = game ? escapeHtml(game.title) : t('home.empty.title');
  const description = game ? (game.description ? escapeHtml(game.description) :
    escapeHtml(game.creator || '') + renderVerifiedCreatorBadge(game)) : t('home.empty.body');
  const kickerText = game ? (isLastPlayed ? t('home.lastPlayedKicker') : t('hero.kicker')) : t('page.home.title');
  const serverHint = !preferences.streamMode && rejoinServerId
    ? `<span class="hero-server-tag" data-tooltip="${escapeHtml(rejoinServerId)}">${t('library.server')} ${escapeHtml(rejoinServerId.slice(0, 8))}</span>`
    : '';
  return `<section class="hero-card shelf-banner ${game ? 'home-widget' : 'shelf-empty'}" ${game ? 'data-home-widget="hero"' : ''} ${art ? `style="--shelf-art:${escapeHtml('url(' + JSON.stringify(art) + ')')}"` : ''}>
    <div class="hero-copy"><div class="hero-kicker-row"><span class="hero-kicker">${kickerText}</span>${serverHint}</div>
      <h2>${title}</h2><p>${description}</p>
      <div class="hero-actions">${game
        ? `<button class="primary-button" type="button" data-action="play" data-id="${escapeHtml(game.id)}">${icon('play', 14)} ${t('card.play')}</button>
           <button class="control-button hero-rejoin-button" type="button" data-action="rejoin-last-banner" data-id="${escapeHtml(rejoinPlaceId)}" data-server="${escapeHtml(rejoinServerId)}">${icon('rotate', 14)} ${t('home.rejoinLastServer')}</button>
           <button class="ghost-button" type="button" data-action="home-settings">${t('home.changeGame')}</button>`
        : `<button class="primary-button" type="button" data-action="home-settings">${icon('plus', 14)} ${t('quick.dialogTitle')}</button>
           <button class="ghost-button" type="button" data-nav="catalog">${t('nav.catalog')}</button>`}</div>
    </div>${renderWeekActivity()}
  </section>`;
}

function renderHome() {
  // The home page shows the user's own games and highlights the most recently launched game in the banner.
  const customGames = [...new Map((preferences.customGames || []).map((game) => [String(game.id), game])).values()]
    .map((game) => localizeGame(game));
  const featured = customGames.find((game) => String(game.id) === String(preferences.homeFeaturedGame)) || null;
  const heroState = resolveHomeHeroCandidate(customGames, featured);
  const heroGame = heroState.game;
  const picksIds = Array.isArray(preferences.homePicks) ? preferences.homePicks.map(String) : [];
  const picks = (picksIds.length
    ? picksIds.map((id) => customGames.find((game) => String(game.id) === id)).filter(Boolean)
    : customGames.filter((game) => String(game.id) !== String(heroGame?.id)))
    .slice(0, Number(preferences.homeGameCount) || 4);
  const greeting = preferences.homeGreeting.trim() || t('page.home.title');
  const emptyHint = (customGames.length || heroGame) ? '' : renderShelfBanner(null);

  // Each widget renders to a <section class="home-widget" data-home-widget="key">
  // with a heading that carries collapse + move controls.
  const widgetBodies = {
    hero: preferences.homeShowHero && heroGame ? renderShelfBanner(heroGame, heroState) : '',
    picks: customGames.length ? `<section class="section-block home-widget" data-home-widget="picks">${renderWidgetHeading('picks', t('home.section.title'), t('home.section.subtitle'))}
      ${renderGrid(picks, t('home.picks.emptyTitle'), t('home.picks.emptyBody'), 'settings', preferences.homeGameView)}</section>` : '',
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
    ${preferences.homeGreeting.trim() || (customGames.length && !widgetBodies.hero) ? pageHeading('', escapeHtml(greeting), '') : `<h1 class="visually-hidden">${escapeHtml(greeting)}</h1>`}
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
    <div class="home-widget-copy"><h2>${escapeHtml(shownTitle)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>
    ${key === 'picks' ? renderGameViewSwitch('homeGameView', 'settings.home.gameView', 'home-game-view') : ''}
    <button class="home-widget-collapse" data-widget-collapse="${key}" aria-expanded="${!collapsed}" aria-label="${escapeHtml(shownTitle)}">${icon(collapsed ? 'chevronRight' : 'chevronDown', 14)}</button>
    <button class="icon-button widget-hide" data-widget-visible-toggle="${key}" aria-label="${escapeHtml(t('home.hideWidget', { title: shownTitle }))}" data-tooltip="${escapeHtml(t('home.hideWidget', { title: shownTitle }))}">${icon('eyeOff', 15)}</button>
    <span class="home-widget-grip" data-widget-drag="${key}" aria-hidden="true">${icon('grip', 13)}</span>
  </div>`;
}

// Compact favorites/recent strips for the home page: one row of mini-cards.
function renderHomeFavoritesPreview() {
  const list = allGames().filter((game) => favorites.has(game.id)).slice(0, 4);
  return `<section class="section-block home-widget" data-home-widget="favorites">${renderWidgetHeading('favorites', t('home.widgets.favorites'))}
    ${list.length ? `<div class="home-strip">${list.map(renderHomeStripCard).join('')}</div>` : renderEmptyShelf('favorites')}
  </section>`;
}

function renderHomeRecentPreview() {
  const list = uniqueRecentIds(recentGames).map(getGame).filter(Boolean).slice(0, 4);
  return `<section class="section-block home-widget" data-home-widget="recent">${renderWidgetHeading('recent', t('home.widgets.recent'))}
    ${list.length ? `<div class="home-strip">${list.map(renderHomeStripCard).join('')}</div>` : renderEmptyShelf('recent')}
  </section>`;
}

function renderEmptyShelf(key) {
  return `<div class="shelf-placeholder"><span>${icon(key === 'favorites' ? 'heart' : 'clock', 22)}</span><p>${t(`empty.${key}.body`)}</p></div>`;
}

function renderHomeStripCard(game) {
  const thumbnail = safeThumbnail(game.thumbnail);
  // Playtime first; genre or creator as fallback — never an action-style hint.
  const sub = renderPlaytimeBadge(game.id) || `<span class="strip-no-playtime">${t('stats.noData')}</span>`;
  return `<button class="home-strip-card" data-action="play" data-id="${escapeHtml(String(game.id))}" data-tooltip="${escapeHtml(game.title)}">
    <span class="home-strip-art ${thumbnail ? 'has-thumbnail' : ''}">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" />` : ''}</span>
    <span class="home-strip-copy"><strong>${escapeHtml(game.title)}</strong><small>${sub}</small></span><span class="strip-play" aria-hidden="true">${icon('play', 15)}</span>
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

function isGenreSearchActive() { return catalogGenreExplore && !searchQuery && activeCategory !== 'all'; }

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
  if (isRecommendationsView()) return recommendationVisibleItems();
  const query = searchQuery.trim().toLocaleLowerCase(preferences.language);
  const source = query ? searchResults : isGenreSearchActive() ? genreResults : discoveryCatalog[activeDiscoverySort]?.items || games;
  const list = filterCatalogFriends(source.filter(game => {
    const localized = localizeGame(game);
    const matchesQuery = !query || String(game.id).includes(query) ||
      [localized.title, localized.genre, localized.description, game.search].join(' ').toLocaleLowerCase(preferences.language).includes(query);
    const matchesAccess = !query || activeAccess !== 'paid' || gameIsPaid(game);
    return matchesQuery && matchesAccess && (isGenreSearchActive() || activeCategory === 'all' || game.genreKey === activeCategory);
  }));
  const compare = {
    alpha: (a, b) => a.title.localeCompare(b.title, preferences.language),
    updated: (a, b) => new Date(b.updated || 0) - new Date(a.updated || 0),
    visits: (a, b) => (Number(b.visits) || 0) - (Number(a.visits) || 0),
    players: (a, b) => (Number(b.playerCount) || 0) - (Number(a.playerCount) || 0),
    likes: (a, b) => (catalogLikeRatio(b) ?? -1) - (catalogLikeRatio(a) ?? -1)
  }[sortMode];
  return compare ? list.sort(compare) : list;
}

function discoverySortLabel(sort) {
  const key = `catalog.sort.${sort.id}`;
  const translated = t(key);
  return translated === key ? sort.title : translated;
}

function renderCustomSortSelect(isLiveSearch) {
  const options = [
    { value: 'default', glyph: isLiveSearch ? 'crosshair' : 'sortOrder', label: t(isLiveSearch ? 'sort.relevance' : 'sort.curated') },
    { value: 'players', glyph: 'users', label: t('sort.players') },
    { value: 'likes', glyph: 'thumb', label: t('sort.likes') },
    { value: 'updated', glyph: 'calendar', label: t('sort.updated') },
    { value: 'visits', glyph: 'eye', label: t('sort.visits') },
    { value: 'alpha', glyph: 'sortAlpha', label: t('sort.alpha') }
  ];
  return renderVortexDropdown({ label: t('search.sort'), value: sortMode, kind: 'catalog-sort', className: 'vortex-dropdown-pill',
    options: options.map(({ value, glyph, label: text }) => ({ value, glyph, text, action: `data-sort-value="${value}"` })) });
}

function renderGenreFilters() {
  const genres = ['all', ...Object.keys(GENRE_SEARCH_BASE)];
  const label = genre => t(genre === 'all' ? 'chart.allGenres' : 'genre.' + genre);
  return renderVortexDropdown({ label: t('search.genre'), prefix: t('search.genre'), value: activeCategory, kind: 'catalog-genre', className: 'vortex-dropdown-pill',
    options: genres.map(genre => ({ value: genre, text: label(genre), action: `data-category="${genre}"` })) });
}

function renderAccessFilters() {
  const options = [['all', t('catalog.accessAll')], ['paid', t('catalog.accessPaid')]];
  return `<div class="catalog-filter-group"><span class="catalog-filter-label">${t('catalog.access')}</span><div class="filter-row access-filter-row">${options.map(([value, label]) => `<button class="filter-chip ${activeAccess === value ? 'active' : ''}" data-access="${value}">${value === 'paid' ? icon('coin', 12) : ''}${label}</button>`).join('')}</div></div>`;
}
function renderCatalogViewToggle() {
  return renderGameViewSwitch('catalogView', 'catalog.view', 'catalog-view-toggle');
}

function renderGameViewSwitch(pref, label, className = '', withLabels = false) {
  return `<div class="game-view-switch ${className}" role="group" aria-label="${t(label)}">${['list', 'grid'].map(view => {
    const text = t('catalog.' + view + 'View');
    const active = preferences[pref] === view;
    return `<button type="button" class="game-view-option ${active ? 'active' : ''}" data-pref="${pref}" data-value="${view}"
      ${className === 'catalog-view-toggle' ? `data-catalog-view="${view}"` : ''} data-tooltip="${text}" aria-pressed="${active}" aria-label="${text}">
      ${icon(view, 14)}${withLabels ? `<span>${text}</span>` : ''}</button>`;
  }).join('')}</div>`;
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
  if (robloxSearchLink(value)) { scheduleLiveSearch(value); return; }
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

