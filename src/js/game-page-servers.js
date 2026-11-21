function isCurrentGamePage(id, pane) {
  return currentView === 'game-detail' && String(detailGame?.id) === String(id) &&
    (!pane || gamePageView(id).pane === pane);
}

function detailGameFriends(game) {
  const place = String(game.id);
  const universe = game.universeId ? String(game.universeId) : '';
  const list = friendsCache.data?.friends;
  if (!Array.isArray(list)) return [];
  return list.filter(friend => friend.presence === 'playing' && (
    String(friend.placeId || friend.playingPlaceId) === place || String(friend.rootPlaceId) === place ||
    (universe && String(friend.universeId) === universe)
  )).map(safeFriendForDisplay);
}

function renderGameFriendSection(game, compact = false) {
  const friends = detailGameFriends(game);
  const pins = friendPins();
  const refresh = `<button class="ghost-button game-page-icon-button" data-game-page-action="friends-refresh"
    data-tooltip="${t('friends.refresh')}" aria-label="${t('friends.refresh')}" ${friendsLoading ? 'disabled' : ''}>${icon('refreshCw', 14)}</button>`;
  const configure = `<button class="ghost-button" data-game-page-action="friends-settings">${t('friends.setup.action')}</button>`;
  const fullList = `<button class="ghost-button" data-game-pane="friends">${t('place.viewFriends')}</button>`;
  const hasAccount = Boolean(preferences.robloxUsername);
  const label = compact ? 'place.friendsHere' : 'place.nowPlaying';
  return `<section class="game-page-card">
    <header class="game-page-card-head"><h2>${t(label)} ${friends.length ? `<small>${friends.length}</small>` : ''}</h2>${!compact && hasAccount ? refresh : ''}</header>
    ${friends.length ? `<div class="game-page-friend-grid ${compact ? 'is-compact' : ''}">${friends.slice(0, compact ? 3 : undefined).map(friend => {
      const name = friend.displayName || friend.name || t('friends.unknown');
      const avatar = safeThumbnail(friend.avatar);
      const place = String(friend.placeId || friend.playingPlaceId || '');
      const server = String(friend.gameId || '');
      return `<article class="game-page-friend">
        <span class="friend-avatar">${avatar ? `<img src="${escapeHtml(avatar)}" alt="" loading="lazy">` : escapeHtml(name[0].toUpperCase())}</span>
        <span class="friend-copy"><strong>${escapeHtml(name)}</strong><small>${t('friends.inGame')}</small></span>
        ${compact ? '' : friendPinControls(friend, pins)}
        ${!compact && gameIdPattern.test(place) && serverIdPattern.test(server) ?
          `<button class="ghost-button" data-game-page-action="join" data-server-id="${server}" data-place-id="${place}">${t('place.join')}</button>` : ''}
      </article>`;
    }).join('')}</div>` :
      `<p class="game-page-note">${t(!hasAccount ? 'place.friendsConnect' : friendsLoading ? 'friends.loading'
        : friendsCache.data?.ok === false ? 'friends.networkBody' : 'place.noPlayingFriends')}</p>`}
    ${!hasAccount ? configure : compact ? fullList : ''}
  </section>`;
}

function renderGameFriendsPage(game) {
  const { total, weekly, lastLaunch } = gamePageStats(game);
  return `<div class="game-page-columns"><div>
    ${renderGameFriendSection(game)}
    <p class="game-page-note">${t('place.presenceHint')}</p>
  </div><aside><section class="game-page-card game-page-facts"><h2>${t('place.myTime')}</h2>
    <dl><div><dt>${t('game.playtime')}</dt><dd>${activityDuration(total)}</dd></div>
      <div><dt>${t('place.week')}</dt><dd>${activityDuration(weekly)}</dd></div>
      <div><dt>${t('place.lastLaunch')}</dt><dd>${gamePageDate(lastLaunch, true)}</dd></div></dl>
  </section></aside></div>`;
}

function gameServerPage(view, mode = view.serverMode) {
  if (!view.pages.has(mode)) view.pages.set(mode, { rows: [], status: 'idle', cursor: '', used: new Set() });
  return view.pages.get(mode);
}

function normalizeBrowserServers(items) {
  return (Array.isArray(items) ? items : []).filter(row => row && serverIdPattern.test(String(row.id)) &&
    Number.isInteger(row.playing) && row.playing >= 0 && Number.isInteger(row.capacity) && row.capacity > 0)
    .map(row => ({ ...row, id: String(row.id).toLowerCase(), ping: Number(row.ping) > 0 ? Number(row.ping) : null }));
}

async function loadGameServers(game, append = false) {
  const id = String(game.id);
  const view = gamePageView(id);
  const mode = view.serverMode;
  if (!gameIdPattern.test(id) || mode === 'friends') return;
  const page = gameServerPage(view);
  if (page.status === 'loading' || (append && !page.cursor)) return;
  const cursor = append ? page.cursor : '';
  page.status = 'loading';
  if (isCurrentGamePage(id, 'servers')) updateGameServerResults(detailGame, view);
  try {
    const payload = await window.vortexDesktop?.getPublicServers?.({ placeId: id, smallest: mode === 'small', cursor });
    if (!payload || !Array.isArray(payload.servers)) throw new Error('Missing public servers');
    const rows = normalizeBrowserServers(payload.servers);
    if (!append) page.used.clear();
    if (cursor) page.used.add(cursor);
    page.rows = [...new Map([...(append ? page.rows : []), ...rows].map(row => [row.id, row])).values()];
    page.cursor = payload.nextCursor && !page.used.has(payload.nextCursor) ? payload.nextCursor : '';
    page.status = 'success';
  } catch {
    page.status = 'error';
  }
  if (isCurrentGamePage(id, 'servers') && view.serverMode === mode) {
    updateGameServerResults(detailGame, view);
    revealGameContent(document.getElementById('game-page-server-results'));
  }
}

function updateGameServerResults(game, view) {
  const results = document.getElementById('game-page-server-results');
  if (!results) return;
  const loading = gameServerPage(view).status === 'loading';
  document.querySelector('.game-page [data-game-page-action="server-refresh"]').disabled = loading;
  results.innerHTML = gameServerResults(game, view);
}

function serverFriendGroups(game) {
  const groups = new Map();
  for (const friend of detailGameFriends(game)) {
    const server = String(friend.gameId || '').toLowerCase();
    const place = String(friend.placeId || friend.playingPlaceId || '');
    if (!serverIdPattern.test(server) || !gameIdPattern.test(place)) continue;
    const entry = groups.get(server) || { id: server, placeId: place, friends: [] };
    entry.friends.push(friend.displayName || friend.name || t('friends.unknown'));
    groups.set(server, entry);
  }
  return groups;
}

function gameServerRows(game, view) {
  const friends = serverFriendGroups(game);
  const page = gameServerPage(view);
  const query = view.serverSearch.toLowerCase().trim();
  const now = view.serverMode === 'friends'
    ? [...friends.values()].map(row => ({ ...view.pages.get('all')?.rows.find(server => server.id === row.id), ...row }))
    : page.rows.map(row => ({ ...row, placeId: String(game.id), friends: friends.get(row.id)?.friends || [] }));
  const validPing = now.filter(row => Number.isFinite(row.ping) && row.playing < row.capacity);
  const best = validPing.reduce((choice, row) => !choice || choice.ping > row.ping ? row : choice, null);
  return now.map((row, index) => ({ ...row, index: index + 1, best: row.id === best?.id })).filter(row =>
    !query || row.id.includes(query) || String(row.index) === query);
}

function gameServerResults(game, view) {
  const page = gameServerPage(view);
  const friendsOnly = view.serverMode === 'friends';
  const rows = gameServerRows(game, view);
  const label = friendsOnly && friendsLoading || page.status === 'loading' ? 'tools.loading'
    : page.status === 'error' ? 'place.serversError'
      : view.serverSearch ? 'place.noServerMatch' : friendsOnly ? 'place.noFriendServers' : 'place.noServers';
  const retry = page.status === 'error' ?
    `<button class="ghost-button" data-game-page-action="server-refresh">${t('game.refreshServers')}</button>` : '';
  const table = rows.length ? `<div class="game-page-server-table-wrap"><table class="game-page-server-table">
    <thead><tr><th>${t('place.server')}</th><th>${t('place.players')}</th><th>${t('place.ping')}</th><th><span class="visually-hidden">${t('place.join')}</span></th></tr></thead>
    <tbody>${rows.map(row => {
      const filled = Number.isInteger(row.playing) && row.capacity > 0;
      const full = filled && row.playing >= row.capacity;
      const percent = filled ? Math.min(100, row.playing / row.capacity * 100) : 0;
      return `<tr class="${row.best ? 'is-fast' : ''}">
        <td><div class="game-server-label"><strong>${t('place.serverNumber', { index: row.index })}</strong>
          ${row.best ? `<small class="game-server-ping-badge">${t('place.lowPing')}</small>` : ''}</div>
          ${row.friends.length ? `<small class="game-server-friends">${escapeHtml(row.friends.join(', '))}</small>` : ''}
          <button class="game-server-id" type="button" data-game-page-action="copy-server" data-server-id="${row.id}" data-tooltip="${row.id}">#${row.id.slice(0, 8)}</button></td>
        <td>${filled ? `<span>${row.playing} / ${row.capacity}</span><div class="game-server-capacity"><i style="width:${percent}%"></i></div>` : '—'}</td>
        <td>${row.ping ? t('place.ms', { ping: row.ping }) : '—'}</td>
        <td><button type="button" class="ghost-button game-page-join" data-game-page-action="join" data-server-id="${row.id}" data-place-id="${row.placeId}" ${full ? 'disabled' : ''}>${t(full ? 'place.full' : 'place.join')}</button></td>
      </tr>`;
    }).join('')}</tbody></table></div>` : gamePageEmpty('grid', label);
  return table + retry + (!friendsOnly && page.cursor ? `<button class="ghost-button game-page-more" data-game-page-action="server-more" ${page.status === 'loading' ? 'disabled' : ''}>${t(page.status === 'loading' ? 'tools.loading' : 'catalog.loadMore')}</button>` : '');
}

function renderGameServers(game, view) {
  const page = gameServerPage(view);
  const official = officialGameUrl(game);
  return `<div class="game-page-server-controls">
    <label class="game-page-server-search">${icon('search', 15)}<input data-game-server-search type="search" value="${escapeHtml(view.serverSearch)}"
      aria-label="${t('place.serverSearch')}" placeholder="${t('place.serverSearch')}"></label>
    <div class="game-page-server-filters" role="group" aria-label="${t('game.servers')}">
      ${['all', 'friends', 'small'].map(mode => `<button class="ghost-button" data-game-page-action="server-mode" data-mode="${mode}"
        aria-pressed="${mode === view.serverMode}">${t('place.serverFilter.' + mode)}</button>`).join('')}
    </div>
    <button class="ghost-button" data-game-page-action="server-refresh" ${page.status === 'loading' || (view.serverMode === 'friends' && friendsLoading) ? 'disabled' : ''}>${icon('refreshCw', 14)} ${t('game.refreshServers')}</button>
    ${official ? `<button class="ghost-button" data-action="open-social-link" data-url="${official}#!/game-instances">${icon('lock', 14)} ${t('game.privateServer')}</button>` : ''}
  </div>
  <div id="game-page-server-results" aria-live="polite">${gameServerResults(game, view)}</div>
  <p class="game-page-note">${t(view.serverMode === 'friends' ? 'place.presenceHint' : 'place.pingHint')}</p>`;
}
