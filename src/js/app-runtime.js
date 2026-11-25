function savePlayStats() {
  playtimeSummary = null;
  accountStorage.setItem('vortex.playStats', JSON.stringify(playStats));
}

// The cursor advances by whole seconds. Fractional seconds carry into the next
// checkpoint, including when time is split across midnight.
function bankPlaySession(through = runtimeConfirmedAt) {
  if (!playSessionStart || !playSessionGameId) return;
  const from = Math.max(playSessionStart, activityData.confirmedThrough);
  const seconds = Math.floor((through - from) / 1000);
  if (!(seconds > 0)) return;
  const end = from + seconds * 1000;
  // Advance the cursor before storage, notifications or rendering can throw.
  playSessionStart = end;
  activityData.confirmedThrough = end;
  const credited = recordActivityTime(playSessionGameId, from, seconds);
  if (!credited) {
    persistActivityData();
    return;
  }
  const entry = playStats[playSessionGameId] ||= { seconds: 0, launches: 0 };
  entry.seconds = (Number(entry.seconds) || 0) + credited;
  entry.lastPlayed = end;
  persistActivityData();
  savePlayStats();
  writeJournalInterval(from, from + credited * 1000);
  const completed = completeDailyActivity();
  if (updateActivityAchievements() || completed) persistActivityData();
  if (currentView === 'activity' && libraryActivityPane === 'overview' && !pageContent.contains(document.activeElement)) renderPage();
}

function finishDetectedSession(through) {
  bankPlaySession(through);
  if (recordingSession) writeJournalInterval(Math.max(playSessionStart, activityData.confirmedThrough), through, true);
  recordingSession = null;
  playSessionStart = null;
  playSessionGameId = null;
  runtimeSessionKey = '';
  nowPlayingSnapshot = null;
  accountStorage.removeItem(PLAYTIME_SESSION_KEY);
}

function recordGameLaunch(game, isPrivate = false) {
  pendingLaunch = { ...game, at: Date.now(), isPrivate: Boolean(isPrivate) };
  if (preferences.saveHistory) {
    saveRecentGames([game.id, ...recentGames]);
    saveRecentDetails({ ...recentMetadata(), [game.id]: { at: pendingLaunch.at, serverId: '' } });
  }
  reportRecentGamesToTray();
  window.setTimeout(pollRobloxRuntime, 750);
}

async function openGame(id, gameId = '', accessCode = '', { skipConfirm = false, beforeLaunch, endsSession = false } = {}) {
  const game = getGame(id) || (String(detailGame?.id) === String(id) ? detailGame : null) ||
    (gameIdPattern.test(String(id)) ? { id: String(id), title: t('friends.joinGameTitle') } : null);
  if (!game) return;
  // A specific server instance (joining a friend) rides along to the main process.
  const joinGameId = serverIdPattern.test(String(gameId)) || /^\d{5,40}$/.test(String(gameId)) ? String(gameId) : '';
  if (gameId && !joinGameId) { showToast(t('toast.launchError')); return false; }
  const rawAccessCode = String(accessCode || '').trim();
  const safeAccessCode = /^[A-Za-z0-9_-]{6,128}$/.test(rawAccessCode) ? rawAccessCode : '';
  if (rawAccessCode && !safeAccessCode) { showToast(t('toast.launchError')); return false; }
  if (!skipConfirm && preferences.confirmLaunch && typeof confirmVortexAction === 'function') {
    if (beforeLaunch) {
      try { await window.vortexDesktop?.showMainWindow?.(); } catch { /* Keep the confirmation available in the main window. */ }
    }
    const meta = typeof resolveGameSecurityMeta === 'function' ? await resolveGameSecurityMeta(game.id) : game;
    const metaHtml = typeof renderSecurityMetaCard === 'function' ? renderSecurityMetaCard(meta, { isUrl: true, authentic: true, host: 'roblox.com', reason: 'authentic' }) : '';
    const ok = await confirmVortexAction({
      title: t('confirm.launchTitle'),
      body: t(endsSession ? 'hotkeys.switchSession.confirm' : 'confirm.launchBody', { title: meta?.title || game.title }),
      confirmText: t('confirm.launchAction'),
      metaHtml
    });
    if (!ok) return false;
  }
  try {
    if (beforeLaunch && !await beforeLaunch()) return false;
    if (window.vortexDesktop?.openGame) {
      await window.vortexDesktop.openGame(String(game.id), joinGameId, safeAccessCode);
    } else {
      window.open(`https://www.roblox.com/games/start?placeId=${encodeURIComponent(game.id)}`, '_blank', 'noopener,noreferrer');
    }
  } catch {
    showToast(t('toast.launchError'));
    return;
  }
  recordGameLaunch(game, Boolean(safeAccessCode));
  showToast(t('toast.opening', { game: game.title }));
  return true;
}

// Roblox itself is the source of truth for "am I in a game right now". The
// backend reads the newest Roblox log, so joins from the Roblox website or a
// friend invite also start/stop a play session instead of being invisible.
function startDetectedSession(id, key, start, joinedAt, serverId) {
  const correlatedLaunch = String(pendingLaunch?.id) === id &&
    (joinedAt || start) >= pendingLaunch.at - 1000 && (joinedAt || start) <= pendingLaunch.at + 120000
    ? pendingLaunch : null;
  const known = getGame(id) || correlatedLaunch;
  const stored = readStored(PLAYTIME_SESSION_KEY, null);
  playSessionStart = start;
  playSessionGameId = id;
  runtimeSessionKey = key;
  nowPlayingSnapshot = { id, title: known?.title || t('activity.unknownGame'),
    thumbnail: safeThumbnail(known?.thumbnail) || '', startedAt: joinedAt || start,
    serverId, isPrivate: Boolean(correlatedLaunch?.isPrivate) };
  if (typeof rememberLastActiveServerSession === 'function') {
    rememberLastActiveServerSession(id, serverId, joinedAt || start);
  }
  if (preferences.saveHistory) {
    saveRecentGames([id, ...recentGames]);
    const recent = recentMetadata()[id];
    if (!recent || correlatedLaunch || (joinedAt || start) >= recent.at) {
      saveRecentDetails({ ...recentMetadata(), [id]: { at: joinedAt || start, serverId } });
    }
  }
  const entry = playStats[id] || { seconds: 0, launches: 0 };
  if (stored?.session !== key) {
    entry.launches = (Number(entry.launches) || 0) + 1;
    entry.lastLaunchAt = joinedAt || start;
  }
  entry.lastPlayed = start;
  playStats[id] = entry;
  savePlayStats();
  accountStorage.setItem(PLAYTIME_SESSION_KEY, JSON.stringify({ session: key }));
  lastResolvedAttempt = 0;
  if (preferences.saveHistory) {
    recordingSession = { key: joinedAt ? key : id + '/' + start, gameId: id, startedAt: Math.min(joinedAt || start, start), title: known?.title || '', serverId, friends: [] };
    writeJournalInterval(start, start);
  }
  if (correlatedLaunch) pendingLaunch = null;
}

async function resolvePlayingGame(id) {
  if (getGame(id) || runtimeResolvingPlace === id || Date.now() - lastResolvedAttempt < 30000) return;
  lastResolvedAttempt = Date.now();
  runtimeResolvingPlace = id;
  try {
    const response = await window.vortexDesktop?.getGameDetails?.({ placeId: id });
    if (!response?.ok || !response.game?.title) return;
    const game = normalizeDiscoveredGame(response.game, id);
    game.id = id;
    dynamicGames = [...dynamicGames.filter(item => String(item.id) !== id), game].slice(-1200);
    if (window.vortexIdbCache?.persistCache) window.vortexIdbCache.persistCache('vortex.discovered', dynamicGames);
    else try { localStorage.setItem('vortex.discovered', JSON.stringify(dynamicGames)); } catch { /* In-memory cache. */ }
    saveRecentGames(recentGames);
    if (nowPlayingSnapshot?.id === id) {
      nowPlayingSnapshot.title = game.title;
      nowPlayingSnapshot.thumbnail = safeThumbnail(game.thumbnail) || '';
      reportRecentGamesToTray();
      if (preferences.discordPresence) applyDiscordPresence();
    }
    if (['home','recent','activity'].includes(currentView)) renderPage();
  } catch { /* Retry a transient lookup while the session is still active. */ }
  finally { if (runtimeResolvingPlace === id) runtimeResolvingPlace = ''; }
}

function observeRobloxRuntime(data) {
  const valid = Boolean(data?.available && Number.isSafeInteger(data.observedAt) && data.observedAt > 0);
  const at = valid ? data.observedAt : Date.now();
  const awake = Number.isSafeInteger(data?.awakeMs) && data.awakeMs >= 0 ? data.awakeMs : null;
  const previous = runtimeSample;
  const sample = { at, awake, unknown: !valid, serverId: validSessionServer(data?.serverId) };
  const continuous = runtimeIntervalIsContinuous(previous, sample);
  const floor = continuous ? previous.at : at;
  if (!continuous) {
    bankPlaySession(runtimeConfirmedAt);
    runtimeConfirmedAt = 0;
    if (playSessionStart) playSessionStart = at;
  }
  runtimeSample = sample;
  if (!valid) {
    updateGameOverlaySession(null, '', 0);
    if (currentView === 'activity' && !previous?.unknown) paintJournal();
    return;
  }
  const id = data.running && /^\d{1,20}$/.test(String(data.placeId)) ? String(data.placeId) : '';
  const joined = Number.isSafeInteger(data.startedAt) && data.startedAt > 0 && data.startedAt <= at ? data.startedAt : 0;
  updateGameOverlaySession(data, id, joined);
  const key = id ? id + '/' + joined : '';
  const continuedSession = runtimeSessionKey === key;
  if (runtimeSessionKey !== key) {
    const ended = Number(data.endedAt) || 0;
    if (playSessionGameId) {
      const boundary = ended >= floor && ended <= at ? ended : id && joined >= floor ? Math.min(at, joined) : floor;
      finishDetectedSession(boundary);
    }
    if (id) startDetectedSession(id, key, Math.min(at, Math.max(floor, joined)), joined, validSessionServer(data.serverId));
    applyLauncherModes();
    reportRecentGamesToTray();
    if (preferences.discordPresence) applyDiscordPresence();
    if (['activity','recent','home'].includes(currentView)) renderPage();
  }
  if (id) {
    runtimeConfirmedAt = at;
    const server = validSessionServer(data.serverId);
    if (server && nowPlayingSnapshot && nowPlayingSnapshot.serverId !== server) {
      nowPlayingSnapshot.serverId = server;
      rememberLastActiveServerSession(id, server, nowPlayingSnapshot.startedAt);
      const recent = recentMetadata()[id];
      if (preferences.saveHistory && recent?.at === nowPlayingSnapshot.startedAt) {
        saveRecentDetails({ ...recentMetadata(), [id]: { ...recent, serverId: server } });
      }
    }
    if (recordingSession && server) {
      if (recordingSession.serverId !== server) {
        recordingSession.serverId = server;
        writeJournalInterval(at, at);
        if (preferences.discordPresence) applyDiscordPresence();
      }
      observeLibraryFriends();
    } else if (server) {
      if (preferences.discordPresence) applyDiscordPresence();
      observeLibraryFriends();
    }
    checkLibraryBreakReminder(continuous && continuedSession ? at - floor : 0);
    if (currentView === 'activity') {
      updateActivityNowPlayingCard();
      if (previous?.unknown) paintJournal();
      else tickJournalClock();
    }
    if (at - playSessionStart >= 30000) bankPlaySession(at);
    void resolvePlayingGame(id);
  } else {
    runtimeConfirmedAt = 0;
    if (!data.running) accountStorage.removeItem(PLAYTIME_SESSION_KEY);
  }
  if (pendingLaunch && at - pendingLaunch.at > 120000) pendingLaunch = null;
}

async function pollRobloxRuntime() {
  if (!runtimeOwner || runtimePollBusy || dataImportInProgress || !window.vortexDesktop?.getRobloxRuntime) return;
  runtimePollBusy = true;
  try { const data = await window.vortexDesktop.getRobloxRuntime(); if (runtimeOwner && !dataImportInProgress) observeRobloxRuntime(data); }
  catch { if (runtimeOwner && !dataImportInProgress) observeRobloxRuntime(null); }
  finally { runtimePollBusy = false; }
}

function monitorRobloxRuntime() {
  async function watch() {
    activityClockReady = (async () => {
      const stats = readStored('vortex.playStats', playStats) || {};
      activityData = await prepareActivityClock(normalizeActivityData(readStored('vortex.activity', activityData)), stats);
      playStats = synchronizePlayStats(stats, activityData.days);
      persistActivityData();
      savePlayStats();
      if (['home', 'activity', 'game-detail', 'recent', 'favorites'].includes(currentView)) renderPage();
    })();
    await activityClockReady;
    runtimeOwner = true;
    runtimeSample = null;
    void pollRobloxRuntime();
    runtimePollTimer = window.setInterval(pollRobloxRuntime, 5000);
    window.addEventListener('focus', pollRobloxRuntime);
    await new Promise(resolve => window.addEventListener('pagehide', resolve, { once: true }));
    runtimeOwner = false;
    updateGameOverlaySession(null, '', 0);
    window.clearInterval(runtimePollTimer);
    window.removeEventListener('focus', pollRobloxRuntime);
    bankPlaySession();
  }
  // Only one window writes the play clock for this WebView profile.
  const tracking = navigator.locks ? navigator.locks.request('vortex-playtime', watch) : watch();
  void tracking.catch(error => console.warn('Could not initialize the play clock.', error));
}

async function prepareActivityClock(data, stats) {
  if (activityClockIsValid(data)) return data;
  return rebuildActivityClock(data, stats, await sessionJournal.recent(Infinity));
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
  const rules = [
    ['horror', /horror|хоррор|ужас|страш|scary|doors/], ['roleplay', /role.?play|ролевая|ролев|\brpg?\b|brookhaven/],
    ['fashion', /fashion|мод|dress to impress|одежд/], ['parkour', /parkour|паркур|obby|обби|tower of hell/],
    ['action', /action|экшен|шутер|fps|бой|combat|shooter|fighting/], ['simulator', /simulat|симулятор|tycoon|pet sim/],
    ['survival', /survival|выжив|escape|evade/], ['adventure', /adventure|приключ|quest|explore/]
  ];
  for (const value of [game.genre, `${game.title || ''} ${game.description || ''}`]) {
    const hit = rules.find(([, pattern]) => pattern.test(String(value || '').toLocaleLowerCase()));
    if (hit) return hit[0];
  }
  return 'other';
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
    if (window.vortexIdbCache?.persistCache) window.vortexIdbCache.persistCache('vortex.discovered', dynamicGames);
    else try { localStorage.setItem('vortex.discovered', JSON.stringify(dynamicGames)); } catch { /* Current search results remain in memory. */ }
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
  const link = robloxSearchLink(value);
  if (link && preferences.streamMode && link.method !== 'public') {
    inboundRobloxLink = link;
    value = t('tools.streamLink');
    searchInput.value = value;
  }
  if (isRecommendationsView() && value) rememberRecommendationScroll();
  searchQuery = value;
  if (currentView !== 'catalog') pushNavigationHistory('catalog');
  currentView = 'catalog';
  activeCategory = preferences.catalogGenre || 'all';
  catalogGenreExplore = false;
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
  if (link || looksLikeRobloxLink(value)) return;
  if (value.trim().length >= 2) searchTimer = window.setTimeout(() => fetchLiveSearch(false), 420);
  else if (!value.trim()) {
    if (!discoveryCatalog[activeDiscoverySort]?.items) loadDiscoveryCatalog(activeDiscoverySort);
    if (isGenreSearchActive() && (genreStatus === 'idle' || !genreResults.length)) fetchGenreGames(false);
  }
}

function toggleFavorite(id) {
  const key = String(id);
  const isNowFavorite = !favorites.has(key);
  if (isNowFavorite) {
    favorites.add(key);
    showToast(t('toast.favoriteAdded'));
  } else {
    favorites.delete(key);
    showToast(t('toast.favoriteRemoved'));
  }
  accountStorage.setItem('vortex.favorites', JSON.stringify([...favorites]));
  reportRecentGamesToTray();
  if (currentView === 'favorites' || currentView === 'home' || currentView === 'library') {
    renderPage();
    return;
  }
  const label = t(isNowFavorite ? 'card.favoriteRemove' : 'card.favoriteAdd');
  document.querySelectorAll('[data-action="favorite"]').forEach((btn) => {
    if (String(btn.dataset.id) !== key) return;
    btn.setAttribute('aria-pressed', String(isNowFavorite));
    if (btn.classList.contains('favorite-button')) {
      btn.classList.toggle('is-favorite', isNowFavorite);
      btn.setAttribute('aria-label', label);
    } else if (btn.classList.contains('game-page-favorite')) {
      btn.setAttribute('data-tooltip', t(isNowFavorite ? 'place.favoriteRemoveTip' : 'place.favoriteAddTip'));
      btn.innerHTML = `${icon('star', 15)} ${t(isNowFavorite ? 'place.favorited' : 'place.favorite')}`;
    } else {
      btn.setAttribute('aria-label', label);
      if (btn.hasAttribute('data-tooltip')) btn.setAttribute('data-tooltip', label);
    }
  });
}

function renderQuickGameFields(method = quickGameMethod) {
  quickGameMethod = ['private', 'share', 'public', 'access'].includes(method) ? method : 'public';
  const fieldHost = document.getElementById('quick-game-fields');
  if (!fieldHost) return;
  document.querySelectorAll('[data-quick-method]').forEach((button) => {
    const active = button.dataset.quickMethod === quickGameMethod
      || (quickGameMethod === 'access' && button.dataset.quickMethod === 'private');
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const placeField = `<label class="quick-game-field"><span>${t('quick.placeIdLabel')}</span><input name="placeId" inputmode="numeric" autocomplete="off" maxlength="20" placeholder="1234567890" ${quickGameMethod === 'share' ? 'hidden' : 'required'} /><small>${t('quick.placeIdHint')}</small></label>`;
  const linkField = `<label class="quick-game-field"><span>${t('quick.linkCodeLabel')}</span><input name="linkCode" autocomplete="off" maxlength="100" placeholder="${t('quick.linkCodePlaceholder')}" ${quickGameMethod === 'private' ? 'required' : 'hidden'} /><small>${t('quick.linkCodeHint')}</small></label>`;
  const accessLabel = t('quick.accessCodeLabel');
  const accessHint = t('quick.accessCodeHint');
  const accessField = `<label class="quick-game-field"><span>${escapeHtml(accessLabel)}</span><input name="accessCode" autocomplete="off" maxlength="128" required /><small>${escapeHtml(accessHint)}</small></label>`;
  const shareField = `<label class="quick-game-field"><span>${t('quick.shareCodeLabel')}</span><input name="shareCode" autocomplete="off" maxlength="512" placeholder="${t('quick.shareCodePlaceholder')}" ${quickGameMethod === 'share' ? 'required' : 'hidden'} /><small>${t('quick.shareCodeHint')}</small></label>`;
  const optionalSharePlace = `<label class="quick-game-field"><span>${t('quick.sharePlaceIdLabel')}</span><input name="placeId" inputmode="numeric" autocomplete="off" maxlength="20" placeholder="${t('quick.sharePlaceIdPlaceholder')}" /><small>${t('quick.sharePlaceIdHint')}</small></label>`;
  fieldHost.innerHTML = quickGameMethod === 'private' ? `${placeField}${linkField}`
    : quickGameMethod === 'access' ? `${placeField}${accessField}`
      : quickGameMethod === 'share' ? `${shareField}${optionalSharePlace}` : placeField;
}

function setQuickGameDialogMode(isEditing) {
  const title = document.getElementById('quick-game-title');
  const iconHost = document.querySelector('[data-quick-submit-icon]');
  const label = document.querySelector('[data-quick-submit-label]');
  if (title) title.textContent = t(isEditing ? 'quick.editDialogTitle' : 'quick.dialogTitle');
  if (iconHost) {
    iconHost.dataset.icon = isEditing ? 'save' : 'gamePlus';
    iconHost.innerHTML = icon(iconHost.dataset.icon, 14);
  }
  if (label) label.textContent = t(isEditing ? 'quick.saveChanges' : 'quick.save');
}

function openQuickGameModal(editId = '', folderId = '') {
  const modal = document.getElementById('quick-game-modal');
  if (!modal || preferences.streamMode) return;
  quickGameDialogReturnFocus = document.activeElement;
  const item = editId ? findQuickLaunchGame(editId) : null;
  editingQuickGameId = item?.id || '';
  addingQuickGameToFolder = folderId;
  document.getElementById('quick-game-error').hidden = true;
  const form = document.getElementById('quick-game-form');
  form?.reset();
  quickGameMethod = item?.method || (folderId ? 'public' : 'private');
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
    setField('accessCode', item.accessCode);
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
  addingQuickGameToFolder = '';
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
  const color = /^#[0-9a-f]{6}$/i.test(folder.color || '') ? folder.color : '#a68bff';
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
  folder.color = /^#[0-9a-f]{6}$/.test(color) ? color : '#a68bff';
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
  refreshLibraryQuick();
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
        refreshLibraryQuick();
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
  const trimmed = String(raw || '').trim();
  if (/^VORTEXFD1-/i.test(trimmed) && typeof decodeQuickFolderCode === 'function') {
    const folderPayload = decodeQuickFolderCode(trimmed);
    if (!folderPayload) return false;
    closeQuickGameModal();
    openSharedFolder(folderPayload);
    return true;
  }
  const code = trimmed.replace(/^VORTEXQL1-/i, '').replace(/-/g, '+').replace(/_/g, '/');
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
  button.dataset.tooltip = t('quick.pressHotkey');
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
    refreshLibraryQuick();
  };
  document.addEventListener('keydown', finish, true);
}

async function submitQuickGameForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.getElementById('quick-game-error');
  const field = (name) => String(form.elements.namedItem(name)?.value || '').trim();
  if (typeof inspectRobloxLinkSafety === 'function') {
    for (const rawVal of [field('placeId'), field('linkCode'), field('shareCode')]) {
      const check = inspectRobloxLinkSafety(rawVal);
      if (check.isUrl && !check.authentic) {
        error.textContent = t(check.reason === 'homograph' ? 'security.domainHomograph' : 'security.domainSpoofed', { host: check.host });
        error.hidden = false;
        return;
      }
    }
  }
  const preferredTitle = field('title').slice(0, 64);
  const existing = editingQuickGameId ? findQuickLaunchGame(editingQuickGameId) : null;
  const folderId = addingQuickGameToFolder;
  const item = {
    ...(existing || {}),
    type: 'game', id: existing?.id || quickLaunchId(), method: quickGameMethod,
    placeId: '', linkCode: '', accessCode: '', shareCode: '', title: '', thumbnail: '',
    lastPlayed: Number(existing?.lastPlayed) || 0, hotkey: existing?.hotkey || null
  };
  if (quickGameMethod === 'private') {
    item.placeId = field('placeId');
    item.linkCode = field('linkCode');
    if (!/^\d{1,20}$/.test(item.placeId) || !/^[a-z\d_-]{1,100}$/i.test(item.linkCode)) {
      error.textContent = t('quick.invalidPrivate'); error.hidden = false; return;
    }
  } else if (quickGameMethod === 'access') {
    item.placeId = field('placeId');
    item.accessCode = field('accessCode');
    if (!/^\d{1,20}$/.test(item.placeId) || !/^[a-z\d_-]{6,128}$/i.test(item.accessCode)) {
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
    else {
      const folder = preferences.quickLaunchItems.find(entry => entry.type === 'folder' && entry.id === folderId);
      const destination = folder?.games || preferences.quickLaunchItems;
      if (destination.length >= 80) {
        error.textContent = t('tools.folderLimit'); error.hidden = false; return;
      }
      destination.push(item);
    }
    persistQuickLaunchItems();
    closeQuickGameModal();
    showToast(t(existing ? 'quick.updated' : 'quick.added', { title: item.title }));
  } catch {
    error.textContent = t('quick.saveError'); error.hidden = false;
  } finally {
    submit.disabled = false;
  }
}

async function removeQuickLaunchItem(id) {
  if (preferences.confirmDelete !== false && typeof confirmVortexAction === 'function') {
    const found = preferences.quickLaunchItems.find(item => item.id === id) || findQuickLaunchGame(id);
    const label = found?.title || t('quick.folderDefault');
    const ok = await confirmVortexAction({
      title: t('confirm.deleteTitle'),
      body: t('confirm.deleteBody', { title: label }),
      confirmText: t('confirm.deleteAction'),
      danger: true
    });
    if (!ok) return;
  }
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
  if (targetIndex < 0) { items.push(source); persistQuickLaunchItems(); return; }
  const [target] = items.splice(targetIndex, 1);
  const folder = { type: 'folder', id: quickLaunchId(), title: t('quick.folderDefault'), color: '#a68bff', games: [target, source] };
  items.splice(targetIndex, 0, folder);
  quickFoldersOpen.add(folder.id);
  persistQuickLaunchItems();
}

async function launchQuickGame(id) {
  const item = findQuickLaunchGame(id);
  if (!item) return;
  if (preferences.confirmLaunch && typeof confirmVortexAction === 'function') {
    const meta = item.placeId && typeof resolveGameSecurityMeta === 'function'
      ? await resolveGameSecurityMeta(item.placeId)
      : { title: item.title, creator: '', thumbnail: item.thumbnail };
    const metaHtml = typeof renderSecurityMetaCard === 'function'
      ? renderSecurityMetaCard(meta, { isUrl: true, authentic: true, host: 'roblox.com', reason: 'authentic' })
      : '';
    const ok = await confirmVortexAction({
      title: t('confirm.launchTitle'),
      body: t('confirm.launchBody', { title: meta?.title || item.title }),
      confirmText: t('confirm.launchAction'),
      metaHtml
    });
    if (!ok) return false;
  }
  try {
    if (!window.vortexDesktop?.launchQuickGame) throw new Error('Desktop launcher unavailable');
    const folder = preferences.quickLaunchItems.find(entry => entry.type === 'folder' && entry.games.some(game => game.id === item.id));
    if (item.method === 'public' && folder?.server && folder.server !== 'default') {
      const server = await preferredPublicServer(item.placeId, folder.server);
      if (!server || !await openGame(item.placeId, server.id, '', { skipConfirm: true })) {
        if (!server) showToast(t('place.launchNoServer'));
        return false;
      }
    } else await window.vortexDesktop.launchQuickGame({
      method: item.method, placeId: item.placeId, linkCode: item.linkCode, shareCode: item.shareCode, shareType: item.shareType,
      serverId: item.serverId, accessCode: item.accessCode
    });
    const launchedAt = Date.now();
    updateQuickLaunchGame(id, entry => { entry.lastPlayed = launchedAt; });
    accountStorage.setItem('vortex.preferences', JSON.stringify(preferences));
    if (item.placeId && !(item.method === 'public' && folder?.server && folder.server !== 'default')) {
      const game = getGame(item.placeId);
      recordGameLaunch({ id: item.placeId, title: item.title || game?.title, thumbnail: item.thumbnail || game?.thumbnail },
        item.method === 'private' || item.method === 'access' || item.method === 'share');
    } else {
      reportRecentGamesToTray();
    }
    showToast(t('quick.launching', { title: item.title }));
    return true;
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

});

document.addEventListener('pointermove', (event) => {
  const drag = quickDragState;
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!drag.dragging && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 7) return;
  if (!drag.dragging) {
    drag.dragging = true;
    try { drag.row.setPointerCapture(event.pointerId); } catch { /* Optional on WebView2. */ }
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
    suppressQuickLaunchClick = true;
    setTimeout(() => { suppressQuickLaunchClick = false; }, 0);
    if (drag.target) {
      const folderId = drag.target.dataset.quickDropFolder || '';
      const gameId = drag.target.dataset.quickDropGame || '';
      organizeQuickLaunchDrop(drag.id, gameId, folderId);

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

