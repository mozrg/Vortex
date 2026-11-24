const serverRegionFilterList = [
  ['all', 'Все регионы', 'All regions'],
  ['eu', 'EU · Европа', 'EU · Europe'],
  ['us-east', 'US · Восток', 'US · East'],
  ['us-west', 'US · Запад', 'US · West'],
  ['asia', 'ASIA · Азия', 'ASIA · Asia'],
  ['sa', 'SA · Юж. Америка', 'SA · S. America'],
  ['au', 'AU · Австралия', 'AU · Australia']
];

const serverTableLabels = [
  ['place.regionColumn', 'Регион', 'Region'],
  ['place.regionFilterLabel', 'Фильтр по региону', 'Filter by region'],
  ['place.regionAtLaunch', 'Предпочитаемый регион сервера', 'Preferred server region'],
  ['place.regionAtLaunchHint', 'Подбирает сервер в выбранном географическом регионе при нажатии «Играть» на странице этого плейса.', 'Picks a server in the selected geographic region when you press Play on this place page.'],
  ['place.regionProbing', 'Определяем…', 'Probing…'],
  ['place.pingAvgSuffix', 'ср.', 'avg'],
  ['place.pingAvgHint', 'Средний пинг игроков на сервере (не ваш)', 'Average ping of players on this server (not yours)'],
  ['place.pingRealHint', 'Ваш реальный пинг до дата-центра сервера', 'Your real ping to this server datacenter'],
  ['place.regionAuthHint', 'Подключите cookie Roblox в Настройки → Интеграции, чтобы видеть реальный регион и ваш пинг до каждого сервера.', 'Connect your Roblox cookie in Settings → Integrations to see each server’s real region and your personal ping.'],
  ['place.regionCookieExpired', 'Cookie Roblox устарела — обновите её в Настройки → Интеграции, чтобы определять реальные регионы и ваш пинг.', 'Your Roblox cookie expired — update it in Settings → Integrations to resolve real regions and your ping.'],
  ['place.showPrivateServers', 'Показывать приватные серверы', 'Show private servers'],
  ['place.privateServersTitle', 'Приватные серверы', 'Private servers'],
  ['place.privateMine', 'Мой сервер', 'My server'],
  ['place.privateFriend', 'Сервер друга', 'Friend’s server'],
  ['place.privateIdle', 'Свободен · ожидает игроков', 'Idle · waiting for players'],
  ['place.privateDeactivated', 'Деактивирован', 'Deactivated'],
  ['place.privateRateLimited', 'Roblox временно ограничил запросы — нажмите «Обновить» через пару секунд.', 'Roblox temporarily rate-limited requests — click Refresh in a few seconds.'],
  ['place.vipCreate.priceUnknown', 'Уточнить на Roblox', 'Check on Roblox'],
  ['place.privateEmpty', 'Нет доступных приватных серверов для этого плейса (ваших или друзей).', 'No private servers available for this place (yours or friends’).'],
  ['place.privateAuthHint', 'Подключите cookie Roblox в Настройки → Интеграции, чтобы видеть свои приватные серверы и серверы друзей.', 'Connect your Roblox cookie in Settings → Integrations to view your own and friends’ private servers.'],
  ['place.privateCookieExpired', 'Cookie Roblox устарела — обновите её в Настройки → Интеграции, чтобы загрузить приватные серверы.', 'Your Roblox cookie expired — update it in Settings → Integrations to load private servers.'],
  ['place.privateStreamHidden', 'Приватные серверы скрыты в «Режиме стрима».', 'Private servers are hidden while Stream Mode is enabled.'],
  ['place.privateConfigure', 'Настроить сервер', 'Configure server'],
  ['place.privateError', 'Не удалось загрузить приватные серверы.', 'Could not load private servers.'],
  ['place.publicServersTitle', 'Публичные серверы', 'Public servers'],
  ['place.vipConfig.title', 'Настройки приватного сервера', 'Private server settings'],
  ['place.vipConfig.name', 'Название сервера', 'Server name'],
  ['place.vipConfig.save', 'Сохранить', 'Save'],
  ['place.vipConfig.active', 'Сервер активен', 'Server active'],
  ['place.vipConfig.activeHint', 'Если выключить, никто не сможет подключиться к этому приватному серверу.', 'When turned off, nobody can join this private server.'],
  ['place.vipConfig.link', 'Ссылка-приглашение', 'Invite link'],
  ['place.vipConfig.linkDisabled', 'Ссылка отключена — нажмите «Создать ссылку», чтобы сгенерировать новую.', 'Link is disabled — click Generate link to create a new one.'],
  ['place.vipConfig.copyLink', 'Копировать', 'Copy'],
  ['place.vipConfig.regenLink', 'Обновить ссылку', 'Regenerate'],
  ['place.vipConfig.createLink', 'Создать ссылку', 'Generate link'],
  ['place.vipConfig.disableLink', 'Отключить', 'Disable'],
  ['place.vipConfig.friendsAllowed', 'Разрешить вход друзьям', 'Allow friends to join'],
  ['place.vipConfig.friendsAllowedHint', 'Все ваши друзья в Roblox смогут зайти без отдельного приглашения.', 'All your Roblox friends can join without a separate invite.'],
  ['place.vipConfig.allowedUsers', 'Приглашённые игроки', 'Allowed players'],
  ['place.vipConfig.addPlaceholder', 'Ник игрока в Roblox…', 'Roblox username…'],
  ['place.vipConfig.addUser', 'Добавить', 'Add'],
  ['place.vipConfig.noUsers', 'Никто не добавлен вручную.', 'No users added manually.'],
  ['place.vipConfig.openRoblox', 'Открыть на Roblox', 'Open on Roblox'],
  ['place.vipConfig.saved', 'Настройки сервера сохранены', 'Server settings saved'],
  ['place.vipConfig.userNotFound', 'Игрок с таким ником не найден', 'Roblox user not found'],
  ['place.vipConfig.loadError', 'Не удалось загрузить настройки приватного сервера', 'Could not load private server settings'],
  ['place.vipConfig.subscription', 'Подписка', 'Subscription'],
  ['place.vipConfig.free', 'Бесплатный', 'Free'],
  ['place.vipCreate.button', 'Создать приватный сервер', 'Create private server'],
  ['place.vipCreate.alreadyOwned', 'Приватный сервер уже есть', 'Private server already owned'],
  ['place.vipCreate.unavailable', 'Приватные серверы недоступны', 'Private servers unavailable'],
  ['place.vipCreate.title', 'Создать приватный сервер', 'Create private server'],
  ['place.vipCreate.priceLabel', 'Стоимость', 'Price'],
  ['place.vipCreate.balanceLabel', 'Ваш баланс', 'Your balance'],
  ['place.vipCreate.free', 'Бесплатно', 'Free'],
  ['place.vipCreate.notEnough', 'Недостаточно Robux для создания этого приватного сервера.', 'Not enough Robux to create this private server.'],
  ['place.vipCreate.submit', 'Создать', 'Create'],
  ['place.vipCreate.created', 'Приватный сервер создан!', 'Private server created!'],
  ['place.vipCreate.error', 'Не удалось создать приватный сервер', 'Could not create private server']
];
for (const [key, ru, en] of serverTableLabels) {
  translations.ru[key] = ru;
  translations.en[key] = en;
}
for (const [id, ru, en] of serverRegionFilterList) {
  translations.ru['place.regionFilter.' + id] = ru;
  translations.en['place.regionFilter.' + id] = en;
}

const resolvedServerMetaCache = new Map();

function getResolvedServerMeta(serverId) {
  if (!serverId) return null;
  const entry = resolvedServerMetaCache.get(String(serverId).toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.at > 5 * 60 * 1000) {
    resolvedServerMetaCache.delete(String(serverId).toLowerCase());
    return null;
  }
  return entry;
}

function storeResolvedServerMap(resolved) {
  if (!resolved || typeof resolved !== 'object') return;
  const now = Date.now();
  for (const [id, meta] of Object.entries(resolved)) {
    if (!meta || typeof meta !== 'object') continue;
    resolvedServerMetaCache.set(String(id).toLowerCase(), {
      ip: meta.ip || '',
      regionGroup: meta.regionGroup || 'other',
      regionCode: meta.regionCode || '',
      regionLabel: meta.regionLabel || '—',
      realPing: Number.isFinite(Number(meta.realPing)) && Number(meta.realPing) > 0 ? Math.round(Number(meta.realPing)) : null,
      at: now
    });
  }
}

function serverRegionAndPingInfo(row, isProbing = false) {
  const meta = getResolvedServerMeta(row?.id);
  const realPing = meta?.realPing ?? null;
  const fallbackPing = Number.isFinite(Number(row?.ping)) && Number(row.ping) > 0 ? Math.round(Number(row.ping)) : null;
  const displayPing = realPing ?? fallbackPing;
  const isRealPing = realPing !== null;
  const tier = !displayPing ? 'unknown' : displayPing < 85 ? 'good' : displayPing < 145 ? 'warn' : 'bad';
  const barPct = displayPing ? Math.max(10, Math.min(100, Math.round((displayPing / 240) * 100))) : 0;
  if (meta && meta.regionLabel) {
    return {
      group: meta.regionGroup || 'other',
      code: meta.regionCode || '',
      label: meta.regionLabel,
      verified: true,
      displayPing,
      isRealPing,
      tier,
      barPct
    };
  }
  return {
    group: isProbing ? 'probing' : 'unknown',
    code: '',
    label: isProbing ? '…' : '—',
    verified: false,
    displayPing,
    isRealPing: false,
    tier,
    barPct
  };
}

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

async function resolveServersForView(game, view, rows, mode, limit = 8) {
  const id = String(game.id);
  const page = gameServerPage(view, mode);
  const resolveFn = window.vortexDesktop?.resolveGameServers;
  if (typeof resolveFn !== 'function' || !Array.isArray(rows) || !rows.length) return;
  const unresolved = rows
    .filter(row => row?.id && !getResolvedServerMeta(row.id))
    .map(row => row.id)
    .slice(0, limit);
  if (!unresolved.length) return;

  const token = (page.resolveToken || 0) + 1;
  page.resolveToken = token;
  page.resolveStatus = 'probing';
  if (isCurrentGamePage(id, 'servers') && view.serverMode === mode) {
    updateGameServerResults(detailGame, view);
  }

  let authReason = null;
  try {
    const result = await resolveFn({ placeId: id, serverIds: unresolved });
    if (page.resolveToken !== token) return;
    if (result?.resolved) storeResolvedServerMap(result.resolved);
    if (result?.ok === false && (result.reason === 'auth-required' || result.reason === 'cookie-expired')) {
      authReason = result.reason;
    }
  } catch {
    // finish gracefully
  }

  if (page.resolveToken !== token) return;
  page.resolveStatus = authReason || 'done';
  if (isCurrentGamePage(id, 'servers') && view.serverMode === mode) {
    updateGameServerResults(detailGame, view);
  }
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
  if (page.status === 'success' && page.rows.length) {
    void resolveServersForView(game, view, page.rows, mode, 10);
  }
}

function updateGameServerResults(game, view) {
  const results = document.getElementById('game-page-server-results');
  if (!results) return;
  const loading = gameServerPage(view).status === 'loading';
  const refreshBtn = document.querySelector('.game-page [data-game-page-action="server-refresh"]');
  if (refreshBtn) refreshBtn.disabled = loading;
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
  const regionFilter = view.serverRegion || 'all';
  const isProbing = page.resolveStatus === 'probing';
  const now = view.serverMode === 'friends'
    ? [...friends.values()].map(row => ({ ...view.pages.get('all')?.rows.find(server => server.id === row.id), ...row }))
    : page.rows.map(row => ({ ...row, placeId: String(game.id), friends: friends.get(row.id)?.friends || [] }));
  const enriched = now.map((row, index) => {
    const regionInfo = serverRegionAndPingInfo(row, isProbing);
    return {
      ...row,
      index: index + 1,
      regionInfo
    };
  });
  const openWithReal = enriched.filter(row => row.regionInfo.isRealPing && Number.isFinite(row.regionInfo.displayPing) && row.playing < row.capacity);
  const openWithAny = enriched.filter(row => Number.isFinite(row.regionInfo.displayPing) && row.playing < row.capacity);
  const bestPool = openWithReal.length ? openWithReal : openWithAny;
  const best = bestPool.reduce((choice, row) => !choice || choice.regionInfo.displayPing > row.regionInfo.displayPing ? row : choice, null);
  return enriched.map(row => ({
    ...row,
    best: row.id === best?.id
  })).filter(row =>
    (regionFilter === 'all' || row.regionInfo.group === regionFilter) &&
    (!query || row.id.includes(query) || String(row.index) === query || row.regionInfo.label.toLowerCase().includes(query))
  );
}

function gameServerResults(game, view) {
  const page = gameServerPage(view);
  const friendsOnly = view.serverMode === 'friends';
  const rows = gameServerRows(game, view);
  const authBanner = !friendsOnly && (page.resolveStatus === 'auth-required' || page.resolveStatus === 'cookie-expired')
    ? `<div class="game-server-auth-banner">
        <span>${t(page.resolveStatus === 'cookie-expired' ? 'place.regionCookieExpired' : 'place.regionAuthHint')}</span>
        <button type="button" class="ghost-button" data-game-page-action="friends-settings">${t('friends.setup.action')}</button>
      </div>`
    : '';
  const label = friendsOnly && friendsLoading || page.status === 'loading' ? 'tools.loading'
    : page.status === 'error' ? 'place.serversError'
      : (view.serverSearch || (view.serverRegion && view.serverRegion !== 'all')) ? 'place.noServerMatch' : friendsOnly ? 'place.noFriendServers' : 'place.noServers';
  const retry = page.status === 'error' ?
    `<button class="ghost-button" data-game-page-action="server-refresh">${t('game.refreshServers')}</button>` : '';
  const table = rows.length ? `<div class="game-page-server-table-wrap"><table class="game-page-server-table">
    <thead><tr><th>${t('place.server')}</th><th>${t('place.regionColumn')}</th><th>${t('place.players')}</th><th>${t('place.ping')}</th><th><span class="visually-hidden">${t('place.join')}</span></th></tr></thead>
    <tbody>${rows.map(row => {
      const filled = Number.isInteger(row.playing) && row.capacity > 0;
      const full = filled && row.playing >= row.capacity;
      const percent = filled ? Math.min(100, row.playing / row.capacity * 100) : 0;
      const reg = row.regionInfo;
      const pingText = reg.displayPing
        ? (reg.isRealPing ? t('place.ms', { ping: reg.displayPing }) : `~${t('place.ms', { ping: reg.displayPing })}`)
        : '—';
      const pingTooltip = reg.displayPing
        ? t(reg.isRealPing ? 'place.pingRealHint' : 'place.pingAvgHint')
        : '';
      return `<tr class="${row.best ? 'is-fast' : ''}">
        <td><div class="game-server-label"><strong>${t('place.serverNumber', { index: row.index })}</strong>
          ${row.best ? `<small class="game-server-ping-badge">${t('place.lowPing')}</small>` : ''}</div>
          ${row.friends.length ? `<small class="game-server-friends">${escapeHtml(row.friends.join(', '))}</small>` : ''}
          <button class="game-server-id" type="button" data-game-page-action="copy-server" data-server-id="${row.id}" data-tooltip="${row.id}">#${row.id.slice(0, 8)}</button></td>
        <td><span class="game-server-region-tag" data-region="${escapeHtml(reg.group)}">${escapeHtml(reg.label)}</span></td>
        <td>${filled ? `<span>${row.playing} / ${row.capacity}</span><div class="game-server-capacity"><i style="width:${percent}%"></i></div>` : '—'}</td>
        <td><div class="game-server-ping-cell" data-ping-tier="${escapeHtml(reg.tier)}" ${pingTooltip ? `data-tooltip="${escapeHtml(pingTooltip)}"` : ''}>
          <span class="game-server-ping-line"><i class="ping-tier-dot" aria-hidden="true"></i><strong>${pingText}</strong>${reg.displayPing && !reg.isRealPing ? `<small class="game-server-ping-avg">${t('place.pingAvgSuffix')}</small>` : ''}</span>
          ${reg.displayPing ? `<div class="game-server-ping-bar" aria-hidden="true"><i style="width:${reg.barPct}%"></i></div>` : ''}
        </div></td>
        <td><button type="button" class="ghost-button game-page-join" data-game-page-action="join" data-server-id="${row.id}" data-place-id="${row.placeId}" ${full ? 'disabled' : ''}>${t(full ? 'place.full' : 'place.join')}</button></td>
      </tr>`;
    }).join('')}</tbody></table></div>` : gamePageEmpty('grid', label);
  return authBanner + table + retry + (!friendsOnly && page.cursor ? `<button class="ghost-button game-page-more" data-game-page-action="server-more" ${page.status === 'loading' ? 'disabled' : ''}>${t(page.status === 'loading' ? 'tools.loading' : 'catalog.loadMore')}</button>` : '');
}

function gamePrivateServerPage(view) {
  if (!view.privateServers) {
    view.privateServers = { rows: [], status: 'idle', reason: null, cursor: '', used: new Set(), meta: null };
  }
  return view.privateServers;
}

async function loadPrivateServers(game, append = false) {
  const id = String(game.id);
  const view = gamePageView(id);
  if (!gameIdPattern.test(id) || preferences.streamMode) return;
  const page = gamePrivateServerPage(view);
  if (page.status === 'loading' || (append && !page.cursor)) return;
  const cursor = append ? page.cursor : '';
  page.status = 'loading';
  page.reason = null;
  if (isCurrentGamePage(id, 'servers')) updatePrivateServerResults(detailGame, view);
  try {
    const payload = await window.vortexDesktop?.getPrivateServers?.({ placeId: id, cursor });
    if (!payload) throw new Error('Missing private servers');
    if (payload.meta && typeof payload.meta === 'object') page.meta = payload.meta;
    if (payload.ok === false) {
      page.status = 'error';
      page.reason = payload.reason || 'network';
      if (!append) page.rows = [];
      page.cursor = '';
    } else {
      const rows = Array.isArray(payload.servers) ? payload.servers.filter(r => r && (r.accessCode || r.vipServerId > 0)) : [];
      if (!append) page.used.clear();
      if (cursor) page.used.add(cursor);
      page.rows = [...new Map([...(append ? page.rows : []), ...rows].map(row => [row.accessCode || ('vip-' + row.vipServerId), row])).values()];
      page.cursor = payload.nextCursor && !page.used.has(payload.nextCursor) ? payload.nextCursor : '';
      page.status = 'success';
      page.reason = null;
    }
  } catch {
    page.status = 'error';
    page.reason = 'network';
  }
  if (isCurrentGamePage(id, 'servers')) {
    updatePrivateServerResults(detailGame, view);
    revealGameContent(document.getElementById('game-page-private-servers'));
  }
}

function renderPrivateServerCta(game, view) {
  const page = gamePrivateServerPage(view);
  const activeMine = page.rows.find(r => r.isMine && r.active !== false && r.accessCode);
  if (activeMine) {
    return `<button type="button" class="ghost-button game-private-cta is-owned" data-game-page-action="private-config" data-vip-server-id="${escapeHtml(String(activeMine.vipServerId))}">${icon('check', 14)} ${t('place.vipCreate.alreadyOwned')}</button>`;
  }
  if (page.meta && page.meta.allowed === false) {
    return `<span class="game-private-cta is-unavailable" aria-disabled="true">${icon('lock', 14)} ${t('place.vipCreate.unavailable')}</span>`;
  }
  const rawPrice = page.meta ? page.meta.price : null;
  const price = rawPrice !== null && rawPrice !== undefined && Number.isFinite(Number(rawPrice))
    ? Math.max(0, Math.floor(Number(rawPrice)))
    : null;
  const priceBadge = price === null
    ? ''
    : price === 0
      ? `<small class="game-private-price-pill is-free">${t('place.vipCreate.free')}</small>`
      : `<small class="game-private-price-pill">${escapeHtml(formatRobuxValue(price))} R$</small>`;
  return `<button type="button" class="ghost-button game-private-cta" data-game-page-action="private-create">${icon('lock', 14)} <span>${t('place.vipCreate.button')}</span>${priceBadge}</button>`;
}

function updatePrivateServerResults(game, view) {
  const container = document.getElementById('game-page-private-servers');
  if (container) container.innerHTML = renderPrivateServersContent(game, view);
  const cta = document.getElementById('game-page-private-cta');
  if (cta) cta.innerHTML = renderPrivateServerCta(game, view);
}

function renderPrivateServersContent(game, view) {
  if (preferences.showPrivateServers === false) return '';
  const page = gamePrivateServerPage(view);
  const query = view.serverSearch.toLowerCase().trim();
  const count = page.rows.length;

  if (preferences.streamMode) {
    return `<section class="game-private-servers-section">
      <header class="game-private-servers-head">
        <h3>${icon('lock', 14)} ${t('place.privateServersTitle')}</h3>
      </header>
      <p class="game-private-servers-note">${t('place.privateStreamHidden')}</p>
    </section>`;
  }

  let body = '';
  if (page.status === 'loading' && !count) {
    body = `<div class="game-private-servers-loading">${t('tools.loading')}</div>`;
  } else if (page.status === 'error' && (page.reason === 'auth-required' || page.reason === 'cookie-expired')) {
    body = `<div class="game-server-auth-banner">
      <span>${t(page.reason === 'cookie-expired' ? 'place.privateCookieExpired' : 'place.privateAuthHint')}</span>
      <button type="button" class="ghost-button" data-game-page-action="friends-settings">${t('friends.setup.action')}</button>
    </div>`;
  } else if (page.status === 'error') {
    const errKey = page.reason === 'rate-limited' ? 'place.privateRateLimited' : 'place.privateError';
    body = `<div class="game-private-servers-empty">
      <span>${t(errKey)}</span>
      <button type="button" class="ghost-button" data-game-page-action="private-refresh">${t('game.refreshServers')}</button>
    </div>`;
  } else if (!count && page.status === 'success') {
    body = `<p class="game-private-servers-note">${t('place.privateEmpty')}</p>`;
  } else if (count) {
    const privFilter = view.privateFilter || 'all';
    const filtered = page.rows.filter(row => {
      if (privFilter === 'mine' && !row.isMine) return false;
      if (privFilter === 'active' && !(row.active !== false && row.playing > 0)) return false;
      if (!query) return true;
      const hay = [row.name, row.owner?.displayName, row.owner?.name, ...(row.players || [])]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(query);
    });
    if (!filtered.length) {
      body = `<p class="game-private-servers-note">${t('place.noServerMatch')}</p>`;
    } else {
      body = `<div class="game-private-servers-grid">${filtered.map((row, idx) => {
        const ownerName = row.owner?.displayName || row.owner?.name || t('friends.unknown');
        const ownerHandle = row.owner?.name ? `@${row.owner.name}` : '';
        const avatar = safeThumbnail(row.owner?.avatar);
        const initial = (ownerName[0] || 'P').toUpperCase();
        const filled = Number.isInteger(row.playing) && row.capacity > 0;
        const full = filled && row.playing >= row.capacity;
        const percent = filled ? Math.min(100, (row.playing / row.capacity) * 100) : 0;
        const meta = row.id ? getResolvedServerMeta(row.id) : null;
        const hasConfig = row.isMine && row.vipServerId > 0;
        return `<article class="game-private-server-card ${row.isMine ? 'is-mine' : 'is-friend'}" style="--stagger-i:${Math.min(idx, 10)}">
          <div class="game-private-server-main">
            <span class="friend-avatar">${avatar ? `<img src="${escapeHtml(avatar)}" alt="" loading="lazy">` : escapeHtml(initial)}</span>
            <div class="game-private-server-info">
              <div class="game-private-server-title-row">
                <strong>${escapeHtml(row.name || ownerName)}</strong>
                <span class="game-private-owner-badge ${row.isMine ? 'is-mine' : ''}">${t(row.isMine ? 'place.privateMine' : 'place.privateFriend')}</span>
                ${meta?.regionLabel ? `<span class="game-server-region-tag" data-region="${escapeHtml(meta.regionGroup || 'other')}">${escapeHtml(meta.regionLabel)}${meta.realPing ? ` · ${meta.realPing} ms` : ''}</span>` : ''}
              </div>
              <small class="game-private-server-owner">${escapeHtml(ownerName)}${ownerHandle && ownerHandle.toLowerCase() !== '@' + ownerName.toLowerCase() ? ` (${escapeHtml(ownerHandle)})` : ''}</small>
              ${row.players?.length ? `<small class="game-server-friends">${escapeHtml(row.players.slice(0, 5).join(', '))}${row.players.length > 5 ? ` +${row.players.length - 5}` : ''}</small>` : ''}
            </div>
          </div>
          <div class="game-private-server-meta">
            ${row.active === false || !row.accessCode
              ? `<span class="game-private-server-idle">${t('place.privateDeactivated')}</span>`
              : row.playing > 0 && filled
                ? `<div class="game-private-server-cap"><span>${row.playing} / ${row.capacity}</span><div class="game-server-capacity"><i style="width:${percent}%"></i></div></div>`
                : `<span class="game-private-server-idle">${t('place.privateIdle')}</span>`}
            <div class="game-private-server-actions">
              ${row.active !== false && row.accessCode ? `<button type="button" class="ghost-button game-page-icon-button" data-game-page-action="private-pin" data-place-id="${escapeHtml(String(game.id))}" data-access-code="${escapeHtml(row.accessCode)}" data-server-name="${escapeHtml(row.name || ownerName)}" data-tooltip="${preferences.language === 'en' ? 'Pin to Quick Launch' : 'В быстрый запуск'}" aria-label="${preferences.language === 'en' ? 'Pin to Quick Launch' : 'В быстрый запуск'}">${icon('star', 14)}</button>` : ''}
              ${hasConfig ? `<button type="button" class="ghost-button game-page-icon-button" data-game-page-action="private-config" data-vip-server-id="${escapeHtml(String(row.vipServerId))}" data-tooltip="${escapeHtml(t('place.privateConfigure'))}" aria-label="${escapeHtml(t('place.privateConfigure'))}">${icon('settings', 14)}</button>` : ''}
              <button type="button" class="ghost-button game-page-join" data-game-page-action="join-private" data-place-id="${escapeHtml(String(game.id))}" data-access-code="${escapeHtml(row.accessCode || '')}" ${full || row.active === false || !row.accessCode ? 'disabled' : ''}>${t(full ? 'place.full' : 'place.join')}</button>
            </div>
          </div>
        </article>`;
      }).join('')}</div>`;
      if (page.cursor) {
        body += `<button type="button" class="ghost-button game-page-more" data-game-page-action="private-more" ${page.status === 'loading' ? 'disabled' : ''}>${t(page.status === 'loading' ? 'tools.loading' : 'catalog.loadMore')}</button>`;
      }
    }
  }

  const privFilter = view.privateFilter || 'all';
  const privFilterLabels = preferences.language === 'en'
    ? [['all', 'All'], ['mine', 'Mine'], ['active', 'Active']]
    : [['all', 'Все'], ['mine', 'Мои'], ['active', 'Активные']];
  const privFilterBar = count ? `<div class="game-private-filter-bar" role="group">${privFilterLabels.map(([id, label]) =>
    `<button type="button" class="filter-chip" data-game-page-action="private-filter" data-filter="${id}" aria-pressed="${privFilter === id}">${label}</button>`
  ).join('')}</div>` : '';

  return `<section class="game-private-servers-section">
    <header class="game-private-servers-head">
      <div class="game-private-servers-head-left">
        <h3>${icon('lock', 14)} ${t('place.privateServersTitle')} ${count ? `<small>${count}</small>` : ''}</h3>
        ${privFilterBar}
      </div>
      <button type="button" class="ghost-button game-page-icon-button" data-game-page-action="private-refresh" data-tooltip="${escapeHtml(t('game.refreshServers'))}" aria-label="${escapeHtml(t('game.refreshServers'))}" ${page.status === 'loading' ? 'disabled' : ''}>${icon('refreshCw', 13)}</button>
    </header>
    ${body}
  </section>`;
}

function renderGameServers(game, view) {
  const page = gameServerPage(view);
  const official = officialGameUrl(game);
  const currentRegion = view.serverRegion || 'all';
  const showPrivate = preferences.showPrivateServers !== false;
  return `<div class="game-page-server-controls">
    <label class="game-page-server-search">${icon('search', 15)}<input data-game-server-search type="search" value="${escapeHtml(view.serverSearch)}"
      aria-label="${t('place.serverSearch')}" placeholder="${t('place.serverSearch')}"></label>
    <div class="game-page-server-filters" role="group" aria-label="${t('game.servers')}">
      ${['all', 'friends', 'small'].map(mode => {
        const modeTips = preferences.language === 'en'
          ? { all: 'Show all public servers', friends: 'Servers where your friends are playing', small: 'Servers with the fewest players' }
          : { all: 'Показать все публичные серверы', friends: 'Серверы, на которых сейчас играют друзья', small: 'Серверы с наименьшим числом игроков' };
        return `<button class="ghost-button" data-game-page-action="server-mode" data-mode="${mode}"
        data-tooltip="${escapeHtml(modeTips[mode])}"
        aria-pressed="${mode === view.serverMode}">${t('place.serverFilter.' + mode)}</button>`;
      }).join('')}
    </div>
    <button class="ghost-button" data-game-page-action="server-refresh" data-tooltip="${preferences.language === 'en' ? 'Reload public and private server lists' : 'Обновить список публичных и приватных серверов'}" ${page.status === 'loading' || (view.serverMode === 'friends' && friendsLoading) ? 'disabled' : ''}>${icon('refreshCw', 14)} ${t('game.refreshServers')}</button>
    <span id="game-page-private-cta">${renderPrivateServerCta(game, view)}</span>
  </div>
  <div class="game-page-server-toolbar-row">
    <div class="game-page-server-region-bar" role="group" aria-label="${t('place.regionFilterLabel')}">
      ${serverRegionFilterList.map(([id]) => `<button type="button" class="filter-chip" data-game-page-action="server-region" data-region="${id}" aria-pressed="${currentRegion === id}">${t('place.regionFilter.' + id)}</button>`).join('')}
      <button type="button" class="filter-chip game-ping-regions-btn" data-game-page-action="ping-regions" data-tooltip="${preferences.language === 'en' ? 'Measure your real ping to all Roblox datacenters' : 'Измерить реальный пинг до всех датацентров Roblox'}">${icon('zap', 12)} ${preferences.language === 'en' ? 'Region Ping' : 'Пинг регионов'}</button>
    </div>
    <label class="game-server-private-toggle">
      <input type="checkbox" data-game-private-toggle ${showPrivate ? 'checked' : ''}>
      <span class="game-server-private-checkbox" aria-hidden="true"></span>
      <span>${t('place.showPrivateServers')}</span>
    </label>
  </div>
  <div id="game-page-private-servers" aria-live="polite">${renderPrivateServersContent(game, view)}</div>
  <div id="game-page-server-results" aria-live="polite">${gameServerResults(game, view)}</div>
  <p class="game-page-note">${t(view.serverMode === 'friends' ? 'place.presenceHint' : 'place.pingHint')}</p>`;
}

let vipConfigModalState = null;

function closePrivateServerConfigModal() {
  const existing = document.getElementById('vortex-vip-config-modal');
  if (existing) existing.remove();
  vipConfigModalState = null;
}

function renderVipConfigModalBody() {
  const modal = document.getElementById('vortex-vip-config-modal');
  if (!modal || !vipConfigModalState) return;
  const { vipServerId, loading, busy, error, server } = vipConfigModalState;
  const robloxUrl = `https://www.roblox.com/private-server/configure/${vipServerId}`;
  const body = modal.querySelector('[data-vip-modal-body]');
  if (!body) return;

  if (loading && !server) {
    body.innerHTML = `<p class="vip-config-loading">${t('tools.loading')}</p>`;
    return;
  }
  if (error && !server) {
    body.innerHTML = `<div class="vip-config-error">
      <p>${escapeHtml(error)}</p>
      <button type="button" class="ghost-button" data-vip-action="reload">${t('game.refreshServers')}</button>
    </div>`;
    return;
  }
  if (!server) return;

  const perms = server.permissions || {};
  const users = Array.isArray(perms.users) ? perms.users : [];
  const sub = server.subscription || null;
  const link = typeof server.link === 'string' && server.link.trim() ? server.link.trim() : '';
  const shownLink = preferences.streamMode && link ? '••••••••••••••••••••••••••••••' : link;
  const subInfo = sub
    ? (sub.price > 0
      ? `${sub.price} R$${sub.expirationDate ? ` · ${gamePageDate(sub.expirationDate, false)}` : ''}`
      : t('place.vipConfig.free'))
    : '';

  body.innerHTML = `
    ${error ? `<p class="vip-config-inline-error">${escapeHtml(error)}</p>` : ''}
    <div class="vip-config-field">
      <label for="vip-config-name-input">${t('place.vipConfig.name')}</label>
      <div class="vip-config-row">
        <input id="vip-config-name-input" type="text" maxlength="50" value="${escapeHtml(server.name || '')}" ${busy ? 'disabled' : ''}>
        <button type="button" class="primary-button" data-vip-action="save-name" ${busy ? 'disabled' : ''}>${t('place.vipConfig.save')}</button>
      </div>
    </div>

    <div class="setting-line">
      <div class="setting-label">
        <strong>${t('place.vipConfig.active')}</strong>
        <small>${t('place.vipConfig.activeHint')}</small>
      </div>
      <button type="button" class="toggle" role="switch" aria-checked="${Boolean(server.active)}" data-vip-action="toggle-active" ${busy ? 'disabled' : ''}></button>
    </div>

    <div class="vip-config-field">
      <label>${t('place.vipConfig.link')}</label>
      ${link
        ? `<div class="vip-config-link-box">
            <input type="text" readonly value="${escapeHtml(shownLink)}" aria-label="${escapeHtml(t('place.vipConfig.link'))}">
            <div class="vip-config-link-actions">
              <button type="button" class="ghost-button" data-vip-action="copy-link" ${busy ? 'disabled' : ''}>${icon('link', 13)} ${t('place.vipConfig.copyLink')}</button>
              <button type="button" class="ghost-button" data-vip-action="regen-link" ${busy ? 'disabled' : ''}>${icon('refreshCw', 13)} ${t('place.vipConfig.regenLink')}</button>
              <button type="button" class="ghost-button" data-vip-action="disable-link" ${busy ? 'disabled' : ''}>${t('place.vipConfig.disableLink')}</button>
            </div>
          </div>`
        : `<div class="vip-config-link-empty">
            <span>${t('place.vipConfig.linkDisabled')}</span>
            <button type="button" class="ghost-button" data-vip-action="regen-link" ${busy ? 'disabled' : ''}>${icon('link', 13)} ${t('place.vipConfig.createLink')}</button>
          </div>`}
    </div>

    <div class="setting-line">
      <div class="setting-label">
        <strong>${t('place.vipConfig.friendsAllowed')}</strong>
        <small>${t('place.vipConfig.friendsAllowedHint')}</small>
      </div>
      <button type="button" class="toggle" role="switch" aria-checked="${Boolean(perms.friendsAllowed)}" data-vip-action="toggle-friends" ${busy ? 'disabled' : ''}></button>
    </div>

    <div class="vip-config-field">
      <label for="vip-config-user-input">${t('place.vipConfig.allowedUsers')} ${users.length ? `<small>(${users.length})</small>` : ''}</label>
      <div class="vip-config-row">
        <input id="vip-config-user-input" type="text" placeholder="${escapeHtml(t('place.vipConfig.addPlaceholder'))}" ${busy ? 'disabled' : ''}>
        <button type="button" class="ghost-button" data-vip-action="add-user" ${busy ? 'disabled' : ''}>${t('place.vipConfig.addUser')}</button>
      </div>
      ${users.length
        ? `<div class="vip-config-users">${users.map(u => `
            <span class="vip-config-user-chip">
              <span>${escapeHtml(u.displayName || u.name || String(u.id))}</span>
              <button type="button" data-vip-action="remove-user" data-user-id="${escapeHtml(String(u.id))}" aria-label="Remove" ${busy ? 'disabled' : ''}>${icon('close', 11)}</button>
            </span>`).join('')}</div>`
        : `<p class="vip-config-muted">${t('place.vipConfig.noUsers')}</p>`}
    </div>

    <div class="vip-config-footer">
      ${subInfo ? `<span class="vip-config-sub">${t('place.vipConfig.subscription')}: <strong>${escapeHtml(subInfo)}</strong></span>` : '<span></span>'}
      <button type="button" class="ghost-button" data-action="open-social-link" data-url="${escapeHtml(robloxUrl)}">${icon('arrowUpRight', 13)} ${t('place.vipConfig.openRoblox')}</button>
    </div>`;
}

async function fetchVipServerConfigDetails() {
  if (!vipConfigModalState) return;
  vipConfigModalState.loading = true;
  vipConfigModalState.error = '';
  renderVipConfigModalBody();
  try {
    const res = await window.vortexDesktop?.getPrivateServerConfig?.({ vipServerId: vipConfigModalState.vipServerId });
    if (!vipConfigModalState) return;
    if (res?.ok && res.server) {
      vipConfigModalState.server = res.server;
      vipConfigModalState.error = '';
    } else {
      vipConfigModalState.error = res?.message || t('place.vipConfig.loadError');
    }
  } catch {
    if (vipConfigModalState) vipConfigModalState.error = t('place.vipConfig.loadError');
  } finally {
    if (vipConfigModalState) {
      vipConfigModalState.loading = false;
      renderVipConfigModalBody();
    }
  }
}

async function openPrivateServerConfigModal(game, vipServerId) {
  if (!vipServerId || !/^\d+$/.test(String(vipServerId))) return;
  closePrivateServerConfigModal();
  vipConfigModalState = {
    game,
    vipServerId: String(vipServerId),
    loading: true,
    busy: false,
    error: '',
    server: null
  };

  const overlay = document.createElement('div');
  overlay.id = 'vortex-vip-config-modal';
  overlay.className = 'vip-config-backdrop';
  overlay.innerHTML = `<div class="vip-config-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(t('place.vipConfig.title'))}">
    <header class="vip-config-header">
      <h2>${icon('settings', 16)} ${t('place.vipConfig.title')}</h2>
      <button type="button" class="icon-button" data-vip-action="close" aria-label="${escapeHtml(t('common.cancel'))}">${icon('close', 16)}</button>
    </header>
    <div class="vip-config-body" data-vip-modal-body></div>
  </div>`;
  document.body.appendChild(overlay);
  renderVipConfigModalBody();
  await fetchVipServerConfigDetails();
}

document.addEventListener('click', async event => {
  const modal = document.getElementById('vortex-vip-config-modal');
  if (!modal || !vipConfigModalState) return;
  if (event.target === modal) {
    closePrivateServerConfigModal();
    return;
  }
  const btn = event.target.closest?.('[data-vip-action]');
  if (!btn || !modal.contains(btn)) return;
  const action = btn.dataset.vipAction;
  if (action === 'close') {
    closePrivateServerConfigModal();
    return;
  }
  if (action === 'reload') {
    void fetchVipServerConfigDetails();
    return;
  }
  if (vipConfigModalState.busy || !vipConfigModalState.server) return;
  const { vipServerId, game, server } = vipConfigModalState;

  if (action === 'copy-link') {
    if (server.link) void copyGamePageValue(server.link);
    return;
  }

  vipConfigModalState.busy = true;
  vipConfigModalState.error = '';
  renderVipConfigModalBody();

  try {
    let res = null;
    if (action === 'save-name') {
      const input = modal.querySelector('#vip-config-name-input');
      const nextName = String(input?.value || '').trim();
      if (nextName) {
        res = await window.vortexDesktop?.updatePrivateServer?.({ vipServerId, name: nextName });
      }
    } else if (action === 'toggle-active') {
      res = await window.vortexDesktop?.updatePrivateServer?.({ vipServerId, active: !server.active });
    } else if (action === 'regen-link') {
      res = await window.vortexDesktop?.updatePrivateServer?.({ vipServerId, newJoinCode: true });
    } else if (action === 'disable-link') {
      res = await window.vortexDesktop?.updatePrivateServer?.({ vipServerId, newJoinCode: false });
    } else if (action === 'toggle-friends') {
      const current = Boolean(server.permissions?.friendsAllowed);
      res = await window.vortexDesktop?.updatePrivateServerPermissions?.({ vipServerId, friendsAllowed: !current });
    } else if (action === 'add-user') {
      const input = modal.querySelector('#vip-config-user-input');
      const username = String(input?.value || '').trim();
      if (username) {
        res = await window.vortexDesktop?.updatePrivateServerPermissions?.({ vipServerId, addUsername: username });
      }
    } else if (action === 'remove-user') {
      const uid = Number(btn.dataset.userId);
      if (Number.isInteger(uid) && uid > 0) {
        res = await window.vortexDesktop?.updatePrivateServerPermissions?.({ vipServerId, removeUserId: uid });
      }
    }

    if (!vipConfigModalState) return;
    if (res && res.ok) {
      showToast(t('place.vipConfig.saved'));
      await fetchVipServerConfigDetails();
      if (game && typeof loadPrivateServers === 'function') void loadPrivateServers(game);
    } else if (res) {
      vipConfigModalState.error = res.reason === 'user-not-found'
        ? t('place.vipConfig.userNotFound')
        : (res.message || t('place.vipConfig.loadError'));
    }
  } catch {
    if (vipConfigModalState) vipConfigModalState.error = t('place.vipConfig.loadError');
  } finally {
    if (vipConfigModalState) {
      vipConfigModalState.busy = false;
      renderVipConfigModalBody();
    }
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.getElementById('vortex-vip-config-modal')) {
    event.preventDefault();
    closePrivateServerConfigModal();
  }
  if (event.key === 'Escape' && document.getElementById('vortex-vip-create-modal')) {
    event.preventDefault();
    closeCreatePrivateServerModal();
  }
});

let vipCreateModalState = null;

function closeCreatePrivateServerModal() {
  const existing = document.getElementById('vortex-vip-create-modal');
  if (existing) existing.remove();
  vipCreateModalState = null;
}

function renderVipCreateModalBody() {
  const modal = document.getElementById('vortex-vip-create-modal');
  if (!modal || !vipCreateModalState) return;
  const body = modal.querySelector('[data-vip-create-body]');
  if (!body) return;
  const { game, price, busy, error, defaultName } = vipCreateModalState;
  const priceUnknown = price === null || price === undefined;
  const hasBalance = typeof accountRobuxBalance === 'number' && Number.isFinite(accountRobuxBalance);
  const notEnough = !priceUnknown && price > 0 && hasBalance && accountRobuxBalance < price;
  const priceStr = priceUnknown
    ? t('place.vipCreate.priceUnknown')
    : price === 0
      ? t('place.vipCreate.free')
      : `${formatRobuxValue(price)} R$`;
  const official = officialGameUrl(game);

  body.innerHTML = `
    ${error ? `<p class="vip-config-inline-error">${escapeHtml(error)}</p>` : ''}
    <div class="vip-config-field">
      <label for="vip-create-name-input">${t('place.vipConfig.name')}</label>
      <input id="vip-create-name-input" type="text" maxlength="50" value="${escapeHtml(defaultName)}" ${busy ? 'disabled' : ''}>
    </div>
    <div class="vip-create-summary">
      <div><span>${t('place.vipCreate.priceLabel')}</span><strong class="${priceUnknown ? '' : price === 0 ? 'is-free' : 'is-robux'}">${escapeHtml(priceStr)}</strong></div>
      ${hasBalance ? `<div><span>${t('place.vipCreate.balanceLabel')}</span><strong>${escapeHtml(formatRobuxValue(accountRobuxBalance))} R$</strong></div>` : ''}
    </div>
    ${notEnough ? `<p class="vip-config-inline-error">${t('place.vipCreate.notEnough')}</p>` : ''}
    <div class="vip-config-footer">
      ${official ? `<button type="button" class="ghost-button" data-action="open-social-link" data-url="${escapeHtml(official)}#!/game-instances">${icon('arrowUpRight', 13)} ${t('place.vipConfig.openRoblox')}</button>` : '<span></span>'}
      <div class="vip-create-actions">
        <button type="button" class="ghost-button" data-vip-create-action="close" ${busy ? 'disabled' : ''}>${t('common.cancel')}</button>
        <button type="button" class="primary-button" data-vip-create-action="submit" ${busy || notEnough || priceUnknown ? 'disabled' : ''}>${t('place.vipCreate.submit')}</button>
      </div>
    </div>`;
}

async function openCreatePrivateServerModal(game, view) {
  const page = gamePrivateServerPage(view);
  if (page.reason === 'auth-required' || page.reason === 'cookie-expired') {
    preferences.settingsTab = 'general';
    setView('settings');
    return;
  }
  if (page.status === 'idle' || !page.meta) {
    await loadPrivateServers(game);
  }
  if (page.reason === 'auth-required' || page.reason === 'cookie-expired') {
    preferences.settingsTab = 'general';
    setView('settings');
    return;
  }
  const activeMine = page.rows.find(r => r.isMine && r.active !== false && r.accessCode);
  if (activeMine) {
    void openPrivateServerConfigModal(game, activeMine.vipServerId);
    return;
  }
  if (page.meta && page.meta.allowed === false) {
    showToast(t('place.vipCreate.unavailable'));
    return;
  }
  const universeId = String(page.meta?.universeId || game.universeId || '').trim();
  if (!/^\d+$/.test(universeId)) {
    const official = officialGameUrl(game);
    if (official) void window.vortexDesktop?.openExternalUrl?.(`${official}#!/game-instances`);
    return;
  }
  const rawPrice = page.meta ? page.meta.price : null;
  const price = rawPrice !== null && rawPrice !== undefined && Number.isFinite(Number(rawPrice))
    ? Math.max(0, Math.floor(Number(rawPrice)))
    : null;
  const userLabel = String(preferences.robloxDisplayName || preferences.robloxUsername || 'My').trim();
  const defaultName = `${userLabel}'s Server`.slice(0, 50);

  closeCreatePrivateServerModal();
  vipCreateModalState = { game, universeId, price, busy: false, error: '', defaultName };

  const overlay = document.createElement('div');
  overlay.id = 'vortex-vip-create-modal';
  overlay.className = 'vip-config-backdrop';
  overlay.innerHTML = `<div class="vip-config-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(t('place.vipCreate.title'))}">
    <header class="vip-config-header">
      <h2>${icon('lock', 16)} ${t('place.vipCreate.title')}</h2>
      <button type="button" class="icon-button" data-vip-create-action="close" aria-label="${escapeHtml(t('common.cancel'))}">${icon('close', 16)}</button>
    </header>
    <div class="vip-config-body" data-vip-create-body></div>
  </div>`;
  document.body.appendChild(overlay);
  renderVipCreateModalBody();
  overlay.querySelector('#vip-create-name-input')?.focus();
}

document.addEventListener('click', async event => {
  const modal = document.getElementById('vortex-vip-create-modal');
  if (!modal || !vipCreateModalState) return;
  if (event.target === modal) {
    closeCreatePrivateServerModal();
    return;
  }
  const btn = event.target.closest?.('[data-vip-create-action]');
  if (!btn || !modal.contains(btn)) return;
  const action = btn.dataset.vipCreateAction;
  if (action === 'close') {
    closeCreatePrivateServerModal();
    return;
  }
  if (action === 'submit' && !vipCreateModalState.busy) {
    const input = modal.querySelector('#vip-create-name-input');
    const name = String(input?.value || '').trim();
    if (!name) return;
    vipCreateModalState.defaultName = name;
    vipCreateModalState.busy = true;
    vipCreateModalState.error = '';
    renderVipCreateModalBody();
    try {
      const res = await window.vortexDesktop?.createPrivateServer?.({
        universeId: vipCreateModalState.universeId,
        name,
        expectedPrice: vipCreateModalState.price
      });
      if (!vipCreateModalState) return;
      if (res?.ok) {
        const game = vipCreateModalState.game;
        closeCreatePrivateServerModal();
        showToast(t('place.vipCreate.created'));
        if (typeof loadPrivateServers === 'function') void loadPrivateServers(game);
        if (typeof refreshRobloxAccount === 'function') void refreshRobloxAccount();
      } else {
        vipCreateModalState.error = res?.message || t('place.vipCreate.error');
        vipCreateModalState.busy = false;
        renderVipCreateModalBody();
      }
    } catch {
      if (vipCreateModalState) {
        vipCreateModalState.error = t('place.vipCreate.error');
        vipCreateModalState.busy = false;
        renderVipCreateModalBody();
      }
    }
  }
});

// ---- One-click Roblox Datacenter Region Ping Test Modal ----
function closeRegionPingModal() {
  document.getElementById('vortex-region-ping-modal')?.remove();
}

async function openRegionPingModal() {
  closeRegionPingModal();
  const isEn = preferences.language === 'en';
  const overlay = document.createElement('div');
  overlay.id = 'vortex-region-ping-modal';
  overlay.className = 'vip-config-backdrop';
  overlay.innerHTML = `<div class="vip-config-dialog region-ping-dialog" role="dialog" aria-modal="true" aria-label="${isEn ? 'Roblox Region Ping Test' : 'Пинг до регионов Roblox'}">
    <header class="vip-config-header">
      <h2>${icon('zap', 16)} ${isEn ? 'Roblox Datacenter Ping' : 'Пинг до регионов Roblox'}</h2>
      <div style="display:flex;gap:6px;align-items:center;">
        <button type="button" class="ghost-button game-page-icon-button" data-region-ping-action="retest" aria-label="${isEn ? 'Retest' : 'Повторить'}">${icon('refreshCw', 13)}</button>
        <button type="button" class="icon-button" data-region-ping-action="close" aria-label="${escapeHtml(t('common.cancel'))}">${icon('close', 16)}</button>
      </div>
    </header>
    <div class="vip-config-body" data-region-ping-body>
      <p class="vip-config-loading">${isEn ? 'Measuring real latency to Roblox datacenters...' : 'Измеряем реальный пинг до датацентров Roblox...'}</p>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  const runProbe = async () => {
    const body = overlay.querySelector('[data-region-ping-body]');
    if (!body) return;
    body.innerHTML = `<p class="vip-config-loading">${isEn ? 'Measuring real latency to Roblox datacenters...' : 'Измеряем реальный пинг до датацентров Roblox...'}</p>`;
    try {
      const res = await window.vortexDesktop?.pingRobloxRegions?.();
      if (!overlay.isConnected) return;
      const rows = Array.isArray(res?.regions) ? res.regions : [];
      if (!rows.length) {
        body.innerHTML = `<p class="game-page-note">${isEn ? 'Could not measure regions.' : 'Не удалось измерить пинг регионов.'}</p>`;
        return;
      }
      const currentHop = preferences.serverHopRegion || 'any';
      body.innerHTML = `<div class="region-ping-list">${rows.map(row => {
        const ms = Number.isFinite(row.ping) ? row.ping : null;
        const tone = ms === null ? 'muted' : ms < 80 ? 'good' : ms < 140 ? 'warn' : 'bad';
        const selected = currentHop === row.group;
        return `<div class="region-ping-row">
          <div class="region-ping-info">
            <span class="game-server-region-tag" data-region="${escapeHtml(row.group)}">${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.city)}</strong>
          </div>
          <div class="region-ping-right">
            <span class="region-ping-ms is-${tone}">${ms !== null ? `${ms} ms` : '—'}</span>
            <button type="button" class="ghost-button region-ping-pick" data-region-ping-action="pick" data-group="${escapeHtml(row.group)}" ${selected ? 'aria-pressed="true"' : ''}>
              ${selected ? (isEn ? 'Selected' : 'Выбран') : (isEn ? 'Use for Hop' : 'Для Server Hop')}
            </button>
          </div>
        </div>`;
      }).join('')}</div>
      <p class="game-page-note" style="margin-top:10px;">${isEn ? 'Direct TCP RTT to Roblox UDMUX datacenter edges. Pick your lowest-ping region for Server Hop.' : 'Прямой TCP RTT до узлов Roblox UDMUX. Выбери ближайший регион для Server Hop.'}</p>`;
    } catch {
      if (overlay.isConnected && body) {
        body.innerHTML = `<p class="game-page-note">${isEn ? 'Ping test failed.' : 'Ошибка замера пинга.'}</p>`;
      }
    }
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { closeRegionPingModal(); return; }
    const btn = e.target.closest?.('[data-region-ping-action]');
    if (!btn) return;
    const act = btn.dataset.regionPingAction;
    if (act === 'close') { closeRegionPingModal(); return; }
    if (act === 'retest') { void runProbe(); return; }
    if (act === 'pick') {
      const group = btn.dataset.group || 'any';
      preferences.serverHopRegion = group;
      savePreferences();
      showToast(isEn ? `Server Hop region set: ${group.toUpperCase()}` : `Регион Server Hop: ${group.toUpperCase()}`);
      overlay.querySelectorAll('[data-region-ping-action="pick"]').forEach(el => {
        const isSel = el.dataset.group === group;
        el.setAttribute('aria-pressed', String(isSel));
        el.textContent = isSel ? (isEn ? 'Selected' : 'Выбран') : (isEn ? 'Use for Hop' : 'Для Server Hop');
      });
    }
  });

  await runProbe();
}
