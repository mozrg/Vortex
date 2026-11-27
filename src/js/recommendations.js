const recommendationDiscoverySorts = ['top-trending', 'up-and-coming', 'top-rated', 'top-playing-now'];
const recommendationStopWords = /^(the|and|with|new|upd|update|beta|alpha|release|roblox|blox|games?|simulator|official|test|event|part|free|limited|world|ultimate|mega|reborn|remastered|remake|rework|anniversary|season|legends|edition|игра|новый|новая|обновление|бета|событие|бесплатно|сезон|ремастер)$/i;
const recommendationThemes = [
  ['tower defense', /\btower\s+defen[cs]e\b|защит[ауы] баш/],
  ['tycoon', /\btycoon\b|тайкун/],
  ['co-op', /\bco[ -]?op\b|\bcooperative\b|кооператив/],
  ['story', /\bstory\b|\bstory driven\b|сюжет/],
  ['puzzle', /\bpuzzles?\b|головолом/],
  ['racing', /\bracing\b|\bdrift\b|гонки|дрифт/],
  ['building', /\bsandbox\b|\bcrafting\b|\bbuilding\b|строительств|крафт/],
  ['rhythm', /\brhythm\b|ритм-игр/],
  ['anime', /\banime\b|аниме/],
  ['survival horror', /\bsurvival horror\b|хоррор на выживан/],
  ['zombies', /\bzombies?\b|зомби/],
  ['action rpg', /\baction[ -]rpg\b|\barpg\b/],
  ['obby', /\bobb(?:y|ies)\b|\bparkour\b|полоса препятствий|паркур/],
  ['roleplay', /\brole[ -]?play\b|ролевая игра/]
];
const broadRecommendationTopics = new Set(['anime', 'co-op', 'story', 'building']);
const recommendationDay = 86_400_000;
const recommendationFriendArt = new Map();
const recommendationFriendArtAttempts = new Map();
let loadingRecommendationFriendArt = false;

function newRecommendationState() {
  return { status: 'idle', items: [], signature: '', sourceSignature: '', personalized: false,
    sources: [], usedQueries: new Set(), usedCharts: new Set(),
    visible: CATALOG_PAGE_SIZE, round: 0, fetching: false, refreshPending: false, retry: false, retryAt: 0, dryBatches: 0 };
}

function recommendationTitle(game) {
  return String(game.title || '').replace(/\[[^\]]*\]/g, ' ').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function recommendationWords(game) {
  return [...new Set(recommendationTitle(game).toLowerCase().split(' ').filter(word =>
    word.length > 2 && !recommendationStopWords.test(word) && /\p{L}/u.test(word)))];
}

function recommendationTopics(game) {
  const text = `${recommendationTitle(game)} ${game.genre || ''} ${game.description || ''}`.toLowerCase();
  return recommendationThemes.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function recommendationProfile() {
  const byId = new Map(allGames().map(game => [String(game.id), game]));
  const recent = new Map(uniqueRecentIds(recentGames).map((id, index) => [String(id), index]));
  const favoriteIds = new Set([...favorites].map(String));
  const knownIds = new Set([...favoriteIds, ...Object.keys(playStats), ...recent.keys()]);
  const feedback = recommendationFeedback();
  const hidden = new Set(feedback.hidden);
  for (const key of feedback.hidden) {
    const known = key.startsWith('place:') && byId.get(key.slice(6));
    if (known) hidden.add(experienceKey(known));
  }
  const excluded = new Set(hidden);
  const experiences = new Map();
  const metadata = recentMetadata();
  const now = Date.now();
  for (const id of knownIds) {
    excluded.add('place:' + id);
    const game = byId.get(id);
    if (!game) continue;
    const key = experienceKey(game);
    if (hidden.has('place:' + id) || hidden.has(key)) {
      excluded.add(key);
      continue;
    }
    excluded.add(key);
    const seed = experiences.get(key) || { game, favorite: false, seconds: 0, launches: 0, freshness: 0 };
    const stats = playStats[id] || {};
    seed.favorite ||= favoriteIds.has(id);
    seed.seconds += Math.max(0, Number(stats.seconds) || 0);
    seed.launches += Math.max(0, Number(stats.launches) || 0);
    const lastPlayed = Math.max(Number(stats.lastPlayed) || 0, Number(stats.lastLaunchAt) || 0, Number(metadata[id]?.at) || 0);
    const freshness = lastPlayed > 0 && lastPlayed <= now
      ? 2 ** (-(now - lastPlayed) / (45 * recommendationDay))
      : (recent.has(id) ? (15 - recent.get(id)) / 15 : 0);
    seed.freshness = Math.max(seed.freshness, freshness);
    experiences.set(key, seed);
  }
  for (const [id, saved] of Object.entries(feedback.boosted)) {
    const game = byId.get(id) || saved;
    const key = experienceKey(game);
    if (hidden.has(key) || hidden.has('place:' + id)) continue;
    excluded.add(key);
    excluded.add('place:' + id);
    experiences.set(key, { game, ...experiences.get(key), feedback: true });
  }
  const ranked = [...experiences.values()].map(seed => {
    const freshness = seed.freshness || 0;
    const activity = Math.min(50, 16 * Math.log1p((seed.seconds || 0) / 1800)) +
      Math.min(16, 5 * Math.log1p(seed.launches || 0));
    return { ...seed, weight: (seed.feedback ? 72 : 0) + (seed.favorite ? 42 : 0) +
      activity * (.25 + .75 * freshness) + 20 * freshness };
  }).sort((a, b) => b.weight - a.weight);
  const mandatory = [ranked.find(seed => seed.feedback), ranked.find(seed => seed.favorite),
    ranked.find(seed => seed.seconds || seed.launches || seed.freshness)];
  const diverse = new Map();
  for (const seed of ranked) {
    const genre = seed.game.genreKey || inferGenreKey(seed.game);
    if (!diverse.has(genre)) diverse.set(genre, seed);
  }
  const seeds = [...new Set([...mandatory, ...diverse.values(), ...ranked].filter(Boolean))].slice(0, 6);
  const genres = recommendationGenres();
  const personalized = Boolean(knownIds.size || seeds.length || genres.length);
  const sourceSignature = JSON.stringify([personalized, seeds.map(({ game }) => [
    experienceKey(game), recommendationWords(game), recommendationTopics(game), game.genreKey || inferGenreKey(game)
  ]), genres]);
  const signature = JSON.stringify([sourceSignature, seeds.map(seed => [
    Math.round(seed.weight / 5), seed.game.title, seed.game.creator, !!seed.favorite, !!seed.feedback
  ])]);
  return { seeds, excluded, genres, signature, sourceSignature, personalized };
}

function recommendationGenres() {
  return Array.isArray(preferences.recommendationGenres) ? preferences.recommendationGenres.filter(key => Object.hasOwn(GENRE_SEARCH_BASE, key)) : [];
}

function pushRecommendationSource(state, query, seed = '') {
  query = query.trim().slice(0, 90);
  const key = query.toLocaleLowerCase();
  if (key.length < 2 || state.usedQueries.has(key)) return;
  state.usedQueries.add(key);
  state.sources.push({ query, seed, sessionId: createSearchSessionId(), token: null, cursors: new Set() });
}

function addPersonalRecommendationSources(state, profile) {
  for (const genre of profile.genres) pushRecommendationSource(state, GENRE_SEARCH_BASE[genre]);
  for (const { game } of profile.seeds) {
    const key = experienceKey(game);
    const words = recommendationWords(game);
    const genre = GENRE_SEARCH_BASE[game.genreKey || inferGenreKey(game)] || '';
    const topics = recommendationTopics(game);
    for (const topic of topics.slice(0, 3)) {
      if (topic !== genre && genre) pushRecommendationSource(state, topic + ' ' + genre, key);
      if (!broadRecommendationTopics.has(topic)) pushRecommendationSource(state, topic, key);
    }
    if (words.length) pushRecommendationSource(state, words.slice(0, 4).join(' '), key);
    if (!topics.length && genre) pushRecommendationSource(state, genre, key);
    if (words.length && genre) pushRecommendationSource(state, words[0] + ' ' + genre, key);
  }
}

function refreshRecommendationPreferences() {
  const state = recommendationState;
  const profile = recommendationProfile();
  applyRecommendationProfile(state, profile, true);
  state.retry = false;
  state.dryBatches = 0;
}

function applyRecommendationProfile(state, profile, force = false) {
  if (!force && state.signature === profile.signature) return;
  state.signature = profile.signature;
  state.personalized = profile.personalized;
  if (state.sourceSignature !== profile.sourceSignature) {
    state.sourceSignature = profile.sourceSignature;
    state.sources = [];
    state.usedQueries.clear();
    state.usedCharts.clear();
    state.round = 0;
    state.retry = false;
    state.dryBatches = 0;
    addPersonalRecommendationSources(state, profile);
  }
  const existing = state.items.splice(0).map(game => ({ game, seed: game.recommendationSource }));
  addRecommendations(state, profile, existing);
}

function addExplorationQueries(state, category) {
  const genres = [...new Set([category, ...Object.keys(GENRE_SEARCH_BASE)])].filter(key => Object.hasOwn(GENRE_SEARCH_BASE, key));
  // Expand into real genre and theme terms as the initial title searches run out.
  const round = state.round++;
  const themes = ['co-op', 'story', 'puzzle', 'tower defense', 'tycoon', 'open world', 'racing', 'sandbox',
    'crafting', 'rhythm', 'mystery', 'combat', 'exploration', 'building', 'arcade', 'strategy', 'obby', 'roleplay'];
  for (const [i, genre] of genres.entries()) {
    const theme = themes[(round + i * 3) % themes.length];
    const qualifier = round < themes.length ? '' : ' ' + themes[Math.floor(round / themes.length) % themes.length];
    pushRecommendationSource(state, GENRE_SEARCH_BASE[genre] + ' ' + theme + qualifier);
  }
}

function scoreRecommendation(game, profile, sourceSeed, interests) {
  const genre = game.genreKey || inferGenreKey(game);
  const creator = String(game.creator || '').trim().toLocaleLowerCase();
  const words = new Set(recommendationWords(game));
  const topics = new Set(recommendationTopics(game));
  const explicitlySelected = profile.genres.includes(genre);
  let match = explicitlySelected ? { key: 'genre:' + genre, title: t('genre.' + genre), signal: 'interest' } : null;
  let weight = explicitlySelected ? .45 : 0;
  for (const { seed, terms, type, author, themes } of interests) {
    const hits = terms.filter(word => words.has(word)).length;
    const sharedThemes = themes.filter(theme => topics.has(theme));
    const sameGenre = Object.hasOwn(GENRE_SEARCH_BASE, genre) && genre === type;
    const sameCreator = Boolean(creator && creator !== 'roblox' && creator === author);
    const related = sharedThemes.some(theme => !broadRecommendationTopics.has(theme)) ||
      hits >= 2 || (hits > 0 && (sameGenre || sameCreator || sharedThemes.length > 0)) ||
      (sameGenre && (sameCreator || sharedThemes.length >= 2));
    if (!related) continue;
    const points = (sameGenre ? .31 : 0) + (sameCreator ? .30 : 0) +
      Math.min(.38, hits * .19) + Math.min(.30, sharedThemes.length * .26);
    const sourceBonus = sourceSeed === experienceKey(seed.game) ? .07 : 0;
    const relevance = (points + sourceBonus) * (1 + Math.min(seed.weight, 160) / 280);
    if (relevance <= weight) continue;
    weight = relevance;
    match = { key: experienceKey(seed.game), title: seed.game.title, seconds: seed.seconds || 0,
      signal: seed.feedback ? 'feedback' : seed.favorite && !seed.seconds ? 'favorite' : 'played' };
  }
  if (explicitlySelected) weight += .13;
  const ratio = catalogLikeRatio(game);
  const votes = Math.max(0, (Number(game.upVotes) || 0) + (Number(game.downVotes) || 0));
  const quality = ratio === null ? .08 : (ratio * votes + 18) / (votes + 25) * .18;
  return { ...game, genreKey: genre, recommendationSource: sourceSeed, recommendationReason: match,
    recommendationScore: match ? Math.min(99, Math.round(46 + weight * 46)) : null,
    relevance: weight + quality + Math.min(.07, Math.log1p(Math.max(0, Number(game.playerCount) || 0)) / 150) };
}

function addRecommendations(state, profile, candidates) {
  const universes = new Map([...state.items, ...candidates.map(({ game }) => game)]
    .filter(game => Number(game?.universeId) > 0).map(game => [String(game.id), game.universeId]));
  const seen = new Set();
  for (const game of state.items) {
    seen.add('place:' + game.id);
    const universe = universes.get(String(game.id));
    if (universe) seen.add('universe:' + universe);
  }
  const excluded = new Set(profile.excluded);
  for (const [id, universe] of universes) {
    if (excluded.has('place:' + id)) excluded.add('universe:' + universe);
  }
  const choices = new Map();
  const interests = profile.seeds.map(seed => ({ seed, type: seed.game.genreKey || inferGenreKey(seed.game),
    author: String(seed.game.creator || '').trim().toLocaleLowerCase(), terms: recommendationWords(seed.game),
    themes: recommendationTopics(seed.game) }));
  for (const { game: candidate, seed } of candidates) {
    const game = candidate && !(Number(candidate.universeId) > 0) && universes.has(String(candidate.id))
      ? { ...candidate, universeId: universes.get(String(candidate.id)) } : candidate;
    if (!game?.id || game.availability === 'unavailable') continue;
    const key = experienceKey(game);
    const place = 'place:' + game.id;
    if (seen.has(key) || seen.has(place) || excluded.has(key) || excluded.has(place)) continue;
    const item = scoreRecommendation(game, profile, seed, interests);
    if (profile.personalized && !item.recommendationReason) continue;
    if (!choices.has(key) || choices.get(key).relevance < item.relevance) choices.set(key, item);
  }
  const queue = [...choices.values()].sort((a, b) => b.relevance - a.relevance);
  const appended = [];
  let lastGenre = state.items.at(-1)?.genreKey;
  let streak = 0;
  for (let i = state.items.length - 1; i >= 0 && state.items[i].genreKey === lastGenre && streak < 3; i--) streak++;
  for (; queue.length;) {
    const alternate = streak >= 3 ? queue.findIndex(game => game.genreKey !== lastGenre &&
      game.relevance >= queue[0].relevance - .25) : -1;
    const [game] = queue.splice(alternate < 0 ? 0 : alternate, 1);
    const place = 'place:' + game.id;
    if (seen.has(place)) continue;
    seen.add(place);
    if (game.genreKey === lastGenre) streak++;
    else { lastGenre = game.genreKey; streak = 1; }
    appended.push(game);
  }
  state.items.push(...appended);
}

function recommendationVisibleItems() {
  const items = recommendationState.items.filter(game => activeCategory === 'all' || game.genreKey === activeCategory);
  return filterCatalogFriends(items);
}

function recommendationHasSources(state) {
  return !state.personalized || state.sources.length > 0 ||
    recommendationDiscoverySorts.some(id => !state.usedCharts.has(id));
}

async function loadRecommendations(force = false, append = false) {
  const state = recommendationState;
  if (state.fetching) {
    if (force) state.refreshPending = true;
    return;
  }
  const profile = recommendationProfile();
  const changed = state.signature !== profile.signature;
  applyRecommendationProfile(state, profile);
  if (!force && !append && !changed && state.status !== 'idle') return;
  const count = () => recommendationVisibleItems().length;
  if (append && count() > state.visible) {
    state.visible += CATALOG_PAGE_SIZE;
    state.retry = false;
    state.dryBatches = 0;
    renderRecommendationUpdate();
    return;
  }
  if (state.retryAt > Date.now() || !recommendationHasSources(state)) {
    if (changed) renderRecommendationUpdate();
    return;
  }
  const target = append ? state.visible + CATALOG_PAGE_SIZE : state.visible;
  const before = count();
  if (!state.items.length) {
    const cached = Object.values(discoveryCatalog).flatMap(entry => entry?.items || []);
    if (profile.personalized) cached.push(...allGames());
    addRecommendations(state, profile, cached.map(game => ({ game })));
  }
  state.fetching = true;
  state.retry = false;
  state.status = state.items.length ? 'success' : 'loading';
  renderRecommendationUpdate();
  const sources = [];
  const sourceSignature = state.sourceSignature;
  try {
    for (let round = 0; round < 3; round++) {
      if (recommendationState !== state) return;
      const sortId = recommendationDiscoverySorts.find(id => !state.usedCharts.has(id));
      if (!profile.personalized && state.sources.length < 2) addExplorationQueries(state, activeCategory);
      const useChart = sortId && (round === 0 || !state.sources.length);
      const batch = state.sources.splice(0, useChart ? 1 : 2);
      const requests = batch.map(source => ({
        source, request: () => window.vortexDesktop.searchGames({ query: source.query, sessionId: source.sessionId, pageToken: source.token })
      }));
      if (useChart) requests.push({ sortId, request: () => window.vortexDesktop.discoverGames({ sortId, sessionId: discoverySessionId }) });
      if (!requests.length) break;
      const pages = await Promise.allSettled(requests.map(({ request }) => Promise.resolve().then(request)));
      if (recommendationState !== state) return;
      if (state.sourceSignature !== sourceSignature) break;
      for (const [i, response] of pages.entries()) {
        const { source, sortId } = requests[i];
        if (response.status === 'rejected' || !Array.isArray(response.value?.items)) {
          const reason = String(response.reason || '');
          if (/\b429\b/.test(reason) && state.retryAt <= Date.now()) {
            state.retryAt = Date.now() + 60_000;
            setTimeout(() => {
              if (recommendationState !== state) return;
              state.retry = false;
              state.dryBatches = 0;
              renderRecommendationUpdate();
            }, 60_000);
          }
          const obsolete = /\b(400|404|410)\b/.test(reason);
          if (source && !obsolete) state.sources.push(source);
          if (sortId && obsolete) state.usedCharts.add(sortId);
          state.retry = true;
          continue;
        }
        if (sortId) state.usedCharts.add(sortId);
        const page = response.value;
        sources.push(...page.items.filter(game => game?.id).map(game => ({
          game: normalizeDiscoveredGame(game, source?.query), seed: source?.seed
        })));
        if (source && page.nextPageToken && !source.cursors.has(page.nextPageToken)) {
          source.cursors.add(page.nextPageToken);
          source.token = page.nextPageToken;
          source.sessionId = page.sessionId || source.sessionId;
          state.sources.push(source);
        }
      }
      if ((!profile.personalized && sources.length >= CATALOG_PAGE_SIZE * 2) || state.retryAt > Date.now()) break;
    }
    const currentProfile = recommendationProfile();
    applyRecommendationProfile(state, currentProfile);
    const existingIds = new Set(state.items.map(game => String(game.id)));
    if (!append) sources.push(...state.items.splice(0).map(game => ({ game, seed: game.recommendationSource })));
    addRecommendations(state, currentProfile, sources);
    const newItems = state.items.filter(game => !existingIds.has(String(game.id)));
    if (newItems.length) {
      const known = new Map(dynamicGames.map(game => [String(game.id), game]));
      for (const item of newItems) {
        const { recommendationReason, recommendationScore, recommendationSource, relevance, catalogRank, ...game } = item;
        known.set(String(item.id), { ...known.get(String(item.id)), ...game });
      }
      dynamicGames = [...known.values()].slice(-1200);
      window.vortexIdbCache.persistCache('vortex.discovered', dynamicGames);
    }
    state.visible = Math.min(target, Math.max(state.visible, count()));
    state.dryBatches = before === count() ? state.dryBatches + 1 : 0;
    state.retry = state.retryAt > Date.now() || (state.retry && state.dryBatches > 0) || state.dryBatches >= 2;
    state.status = state.items.length ? 'success' : state.retry ? 'empty' : 'success';
  } finally {
    state.fetching = false;
    if (recommendationState === state) {
      renderRecommendationUpdate();
      if (state.refreshPending) {
        state.refreshPending = false;
        if (isRecommendationsView()) void loadRecommendations(true);
      }
    }
  }
}

function renderRecommendationUpdate() {
  if (!isRecommendationsView()) return;
  const area = document.querySelector('.main-area');
  const top = area.scrollTop;
  renderPage();
  area.scrollTop = top;
}

function catalogReason(game, detailed = false) {
  const reason = game.recommendationReason;
  if (!reason) return t('chart.discoverPick');
  if (detailed && reason.signal === 'played' && reason.seconds >= 60) {
    return t('chart.becauseHours', { time: activityDuration(reason.seconds), game: reason.title });
  }
  const key = { interest: 'chart.becauseGenre', favorite: 'tools.becauseFavorite', feedback: 'tools.becauseFeedback' }[reason.signal] || 'tools.becausePlayed';
  return t(key, { game: reason.title });
}

function renderCatalogMatch(score) {
  return `<span class="catalog-match" data-tooltip="${t('chart.matchHint')}">${t('chart.match', { count: score })}</span>`;
}

function renderRecommendationMenu(game) {
  const id = escapeHtml(String(game.id));
  return renderVortexPopup({ label: t('chart.feedback'), triggerClass: 'icon-button catalog-recommendation-trigger',
    trigger: icon('dots', 15), panel: `
      <button class="vortex-dropdown-option" type="button" data-launcher-action="recommend-more" data-id="${id}">${icon('plus', 14)} ${t('tools.moreLike')}</button>
      <button class="vortex-dropdown-option" type="button" data-launcher-action="recommend-hide" data-id="${id}">${icon('eyeOff', 14)} ${t('tools.notInterested')}</button>` });
}

function catalogFriendGames() {
  const result = new Map();
  const known = new Map(allGames().flatMap(game => [[experienceKey(game), game], ['place:' + game.id, game]]));
  for (const friend of friendsCache.data?.friends || []) {
    if (friend.presence !== 'playing') continue;
    const id = String(friend.rootPlaceId || friend.placeId || friend.playingPlaceId || '');
    if (!gameIdPattern.test(id)) continue;
    const knownGame = known.get('universe:' + friend.universeId) || known.get('place:' + id);
    const game = (safeThumbnail(knownGame?.thumbnail) ? knownGame : recommendationFriendArt.get(id) || knownGame) ||
      { id, universeId: friend.universeId, title: friend.gameName || 'Roblox #' + id, live: true, genreKey: 'other' };
    result.set(experienceKey(game), game);
  }
  return [...result.values()];
}

async function hydrateRecommendationFriendArt(games) {
  if (!isRecommendationsView() || pauseBackgroundRefresh() || loadingRecommendationFriendArt || !window.vortexDesktop?.getFeaturedGames) return;
  const now = Date.now();
  const ids = games.filter(game => !safeThumbnail(game.thumbnail) && gameIdPattern.test(String(game.id)) &&
    now - (recommendationFriendArtAttempts.get(String(game.id)) || 0) >= 10 * 60_000).slice(0, 10).map(game => String(game.id));
  if (!ids.length) return;
  for (const id of ids) recommendationFriendArtAttempts.set(id, now);
  loadingRecommendationFriendArt = true;
  let changed = false;
  try {
    const response = await window.vortexDesktop.getFeaturedGames(ids);
    for (const game of Array.isArray(response) ? response : []) {
      if (!ids.includes(String(game.id)) || !safeThumbnail(game.thumbnail)) continue;
      recommendationFriendArt.set(String(game.id), normalizeDiscoveredGame(game));
      changed = true;
    }
  } catch {
    // The presence title and direct join still work while metadata is unavailable.
  } finally {
    loadingRecommendationFriendArt = false;
    if (changed) renderRecommendationUpdate();
  }
}

function renderRecommendations() {
  const state = recommendationState;
  const items = recommendationVisibleItems();
  const list = items.slice(0, state.visible);
  if ((state.status === 'idle' || state.status === 'loading') && !list.length) return catalogLoading('catalog.recommendedLoading');
  const featured = list[0];
  const hasCachedPage = items.length > state.visible;
  const hasMore = hasCachedPage || recommendationHasSources(state);
  const rateLimited = state.retryAt > Date.now();
  const canAutoload = hasMore && !state.fetching && !state.retry && (!catalogFriendsOnly || hasCachedPage);
  const retryLabel = rateLimited ? 'catalog.recommendedBusy' : state.retry ? 'chart.continueSearching' : '';
  const footer = state.fetching ? `<div class="load-more-status" role="status"><span class="loading-spinner small"></span>${t('search.loadingMore')}</div>`
    : hasMore ? `<div class="catalog-feed-footer" ${canAutoload ? 'data-recommendation-next' : ''}>
      ${retryLabel ? `<p role="status">${t(retryLabel)}</p>` : ''}
      <button type="button" class="ghost-button load-more-button" data-action="more-recommendations" ${rateLimited && !hasCachedPage ? 'disabled' : ''}>${t('catalog.loadMore')} ${icon('arrow', 13)}</button></div>`
    : featured ? `<div class="catalog-feed-footer"><p role="status">${t('chart.similarEnd')}</p></div>` : '';
  const used = new Set(featured ? [experienceKey(featured)] : []);
  const related = featured?.recommendationReason
    ? list.slice(1).filter(game => game.recommendationReason?.key === featured.recommendationReason.key).slice(0, 5) : [];
  related.forEach(game => used.add(experienceKey(game)));
  const hidden = new Set(recommendationFeedback().hidden);
  const friends = catalogFriendGames().filter(game => !used.has(experienceKey(game)) &&
    !hidden.has(experienceKey(game)) && !hidden.has('place:' + game.id) &&
    (activeCategory === 'all' || activeCategory === game.genreKey)).slice(0, catalogFriendsOnly ? undefined : 5);
  if (friends.some(game => !safeThumbnail(game.thumbnail))) queueMicrotask(() => void hydrateRecommendationFriendArt(friends));
  friends.forEach(game => used.add(experienceKey(game)));
  const rest = list.filter(game => !used.has(experienceKey(game)));
  const tiles = games => `<div class="catalog-tiles">${games.map(game => renderCatalogTile(game, { recommended: true })).join('')}</div>`;
  const shelf = (title, items) => items.length ? `<section class="catalog-feed-shelf"><h2>${escapeHtml(title)}</h2>${tiles(items)}</section>` : '';
  const hero = featured ? `<section class="catalog-recommendation-hero" data-game="${escapeHtml(String(featured.id))}">
    <div class="catalog-art catalog-recommendation-art">${renderCatalogArt(featured, { hero: true })}
      ${featured.recommendationScore ? renderCatalogMatch(featured.recommendationScore) : ''}</div>
    <div class="catalog-recommendation-copy">
      <span class="catalog-feed-kicker">${t(featured.recommendationReason ? 'chart.topPick' : 'chart.discoverPick')}</span>
      <h2>${renderCatalogTitle(featured)}</h2>
      ${featured.recommendationReason ? `<p>${escapeHtml(catalogReason(featured, true))}</p>` : ''}
      <div class="catalog-hero-actions">${renderCatalogPlay(featured)}${renderCatalogStar(featured)}
        <button class="ghost-button" data-launcher-action="recommend-hide" data-id="${escapeHtml(String(featured.id))}">${t('tools.notInterested')}</button>${renderRecommendationMenu(featured)}
        <span class="catalog-spacer"></span>${preferences.cardShowLikes ? renderCatalogRating(featured) : ''}
        ${renderCatalogPlayers(featured) === '—' ? '' : escapeHtml(t('search.players', { count: renderCatalogPlayers(featured) }))}${renderCatalogFriends(featured)}</div>
    </div></section>` : '';
  const friendShelf = shelf(t('chart.friendsShelf'), friends);
  if (!featured && !friendShelf) return catalogEmptyState('catalog.recommendedEmptyTitle',
    hasMore ? 'chart.noRecommendations' : 'chart.noSimilarGames') + footer;
  return hero + shelf(featured ? catalogReason(featured) : '', related) + friendShelf + shelf(t('chart.moreGames'), rest) + footer;
}

function showRecommendationSettings() {
  const selected = new Set(recommendationGenres());
  const feedback = recommendationFeedback();
  const byKey = new Map(allGames().flatMap(game => [[experienceKey(game), game], ['place:' + game.id, game]]));
  const hidden = new Map();
  for (const key of feedback.hidden) {
    const game = byKey.get(key) || feedback.hiddenGames?.[key];
    const group = game ? experienceKey(game) : key;
    if (!hidden.has(group)) hidden.set(group, { game, keys: [] });
    hidden.get(group).keys.push(key);
  }
  openLauncherDialog(t('chart.recommendationSettings'), `<form class="launcher-dialog-form" data-catalog-recommendation-settings>
    <fieldset class="catalog-interest-list"><legend>${t('chart.interests')}</legend><div>${Object.keys(GENRE_SEARCH_BASE).map(genre =>
      `<label><input type="checkbox" name="genre" value="${genre}" ${selected.has(genre) ? 'checked' : ''}><span>${t('genre.' + genre)}</span></label>`).join('')}</div></fieldset>
    <fieldset class="catalog-hidden-list"><legend>${t('chart.hiddenGames')}</legend>
      ${hidden.size ? [...hidden.values()].map(({game, keys}) => `<label><input name="restore" type="checkbox" value="${escapeHtml(JSON.stringify(keys))}">
        <span>${escapeHtml(game?.title || 'Roblox #' + keys[0].split(':').at(-1))}</span></label>`).join('') : `<p>${t('chart.noHiddenGames')}</p>`}</fieldset>
    ${hidden.size ? `<small>${t('chart.restoreHint')}</small>` : ''}
    <button class="primary-button" type="submit">${t('common.save')}</button></form>`);
}

document.addEventListener('submit', event => {
  if (!event.target.matches?.('[data-catalog-recommendation-settings]')) return;
  event.preventDefault();
  const data = new FormData(event.target);
  preferences.recommendationGenres = data.getAll('genre').filter(key => Object.hasOwn(GENRE_SEARCH_BASE, key));
  const feedback = recommendationFeedback();
  const restore = new Set(data.getAll('restore').flatMap(value => JSON.parse(value)));
  const games = new Map(allGames().flatMap(game => [['place:' + game.id, game], [experienceKey(game), game]]));
  const restored = [...restore].map(key => games.get(key) || feedback.hiddenGames?.[key]).filter(Boolean);
  feedback.hidden = feedback.hidden.filter(key => !restore.has(key));
  if (feedback.hiddenGames) for (const key of restore) delete feedback.hiddenGames[key];
  accountStorage.setItem('vortex.recommendationFeedback', JSON.stringify(feedback));
  savePreferences();
  launcherDialog.close();
  const profile = recommendationProfile();
  addRecommendations(recommendationState, profile, restored.map(game => ({ game })));
  refreshRecommendationPreferences();
  void loadRecommendations(true);
});
