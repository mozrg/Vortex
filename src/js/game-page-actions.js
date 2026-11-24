function gameLaunchChoices(game) {
  const id = String(game.id);
  const key = experienceKey(game);
  return quickLaunchGames().filter(item => item.method !== 'public' && item.placeId &&
    (String(item.placeId) === id || experienceKey(getGame(item.placeId) || { id: item.placeId }) === key));
}

function gameLaunchOptions(game) {
  const id = String(game.id);
  const saved = Object.hasOwn(preferences.gameLaunchOptions || {}, id) ? preferences.gameLaunchOptions[id] : null;
  const validRegions = ['any', 'eu', 'us-east', 'us-west', 'asia', 'sa', 'au'];
  const region = validRegions.includes(String(saved?.region)) ? String(saved.region) : 'any';
  return { server: String(saved?.server || 'default'), region, hide: saved?.hide === true };
}

function writeGameLaunchOptions(game, changes) {
  const id = String(game.id);
  if (!gameIdPattern.test(id)) return;
  preferences.gameLaunchOptions = { ...preferences.gameLaunchOptions, [id]: { ...gameLaunchOptions(game), ...changes } };
  savePreferences();
}

function renderGameLaunch(game) {
  const { server, region, hide } = gameLaunchOptions(game);
  const choices = [
    ['default', t('place.normalServer')], ['ping', t('place.bestPing')], ['small', t('place.fewerPlayers')],
    ...gameLaunchChoices(game).map(item => ['saved:' + item.id, preferences.streamMode ? t('tools.privateShortcut') : item.title])
  ];
  const regionChoices = [
    ['any', t('hotkeys.serverHop.region.any')],
    ['eu', t('hotkeys.serverHop.region.eu')],
    ['us-east', t('hotkeys.serverHop.region.us-east')],
    ['us-west', t('hotkeys.serverHop.region.us-west')],
    ['asia', t('hotkeys.serverHop.region.asia')],
    ['sa', t('hotkeys.serverHop.region.sa')],
    ['au', t('hotkeys.serverHop.region.au')]
  ];
  if (server.startsWith('saved:') && !choices.some(([key]) => key === server)) choices.push([server, t('place.savedServerUnavailable'), true]);
  return `<div class="game-page-columns"><section class="game-page-card game-launch-card">
    <h2>${t('place.launch')}</h2>
    <div class="setting-line">
      <div class="setting-label"><strong>${t('place.serverAtLaunch')}</strong><small>${t('place.serverAtLaunchHint')}</small></div>
      ${renderVortexDropdown({ label: t('place.serverAtLaunch'), value: server, kind: 'game-launch-server',
        options: choices.map(([value, text, disabled]) => ({ value, text, disabled })),
        input: `<input type="hidden" data-game-launch="server" data-vortex-field value="${escapeHtml(server)}">` })}
    </div>
    <div class="setting-line">
      <div class="setting-label"><strong>${t('place.regionAtLaunch')}</strong><small>${t('place.regionAtLaunchHint')}</small></div>
      ${renderVortexDropdown({ label: t('place.regionAtLaunch'), value: region, kind: 'game-launch-region',
        options: regionChoices.map(([value, text]) => ({ value, text })),
        input: `<input type="hidden" data-game-launch="region" data-vortex-field value="${escapeHtml(region)}">` })}
    </div>
    <div class="setting-line"><div class="setting-label"><strong>${t('place.hideLauncher')}</strong>
      <small>${t('place.hideLauncherHint')}</small></div>
      <button class="toggle" type="button" role="switch" aria-checked="${hide}" aria-label="${t('place.hideLauncher')}" data-game-page-action="toggle-hide"></button></div>
    <button class="ghost-button" data-game-page-action="reset-launch">${t('place.resetLaunch')}</button>
  </section><aside>
    <section class="game-page-card"><h2>${t('place.forThisGame')}</h2>
      <p class="game-page-note">${t('place.launchScope')}</p></section>
  </aside></div>`;
}

function renderGameOther(game) {
  if (!officialGameUrl(game)) return gamePageEmpty('gamepad', 'game.detailNotFound');
  const isEn = preferences.language === 'en';
  return `<section class="game-page-card game-page-other"><h2>${t('place.other')}</h2>
    <div class="game-page-other-actions">
      <button class="ghost-button" data-launcher-action="shortcut" data-id="${escapeHtml(game.id)}" data-tooltip="${isEn ? 'Create a Windows desktop shortcut for this game' : 'Создать ярлык этой игры на рабочем столе Windows'}">${icon('monitor', 16)} ${t('tools.shortcut')}</button>
      <button class="ghost-button" data-game-page-action="pin-place" data-tooltip="${isEn ? 'Pin this game to the Quick Launch sidebar' : 'Закрепить игру в панели «Быстрый запуск»'}">${icon('star', 16)} ${t('tools.pinGame')}</button>
      <button class="ghost-button" data-game-page-action="copy-place" data-tooltip="${isEn ? 'Copy numeric Place ID to clipboard' : 'Скопировать цифровой Place ID в буфер обмена'}">${icon('link', 16)} ${t('place.copyId')}</button>
      <button class="ghost-button" data-action="open-social-link" data-url="${officialGameUrl(game)}" data-tooltip="${isEn ? 'Open official game page on roblox.com' : 'Открыть официальную страницу игры на roblox.com'}">${icon('arrowUpRight', 16)} ${t('place.openRoblox')}</button>
    </div>
  </section>`;
}

async function preferredPublicServer(id, mode, region = 'any') {
  if (typeof selectServerHopCandidate === 'function') {
    const hopMode = mode === 'small' ? 'low-players' : (region && region !== 'any' && mode === 'default' ? 'region' : 'low-ping');
    return selectServerHopCandidate(id, '', hopMode, region || 'any');
  }
  const payload = await window.vortexDesktop?.getPublicServers?.({ placeId: id, smallest: true }).catch(() => null);
  const open = normalizeBrowserServers(payload?.servers).filter(row => row.playing < row.capacity);
  return mode === 'ping'
    ? open.filter(row => row.ping !== null).sort((a, b) => a.ping - b.ping)[0]
    : open.sort((a, b) => a.playing - b.playing)[0];
}

async function detailLaunch(game, place = '', instance = '', accessCode = '') {
  const id = String(game.id);
  const view = gamePageView(id);
  if (!gameIdPattern.test(id) || (place && !gameIdPattern.test(place)) || (instance && !serverIdPattern.test(instance)) || view.launching) return;
  const { server, region, hide } = gameLaunchOptions(game);
  view.launching = true;
  renderPage();
  try {
    let launched;
    if (place && accessCode) launched = await openGame(place, '', accessCode);
    else if (place && instance) launched = await openGame(place, instance);
    else if (server.startsWith('saved:')) {
      const item = gameLaunchChoices(game).find(choice => choice.id === server.slice(6));
      if (item) launched = await launchQuickGame(item.id);
      else showToast(t('place.savedServerMissing'));
    } else {
      let target;
      if (server === 'ping' || server === 'small' || (region && region !== 'any')) {
        target = await preferredPublicServer(id, server, region);
        if (!target) {
          showToast(t('place.launchNoServer'));
          return;
        }
      }
      launched = await openGame(id, target?.id);
    }
    if (launched && hide) await window.vortexDesktop?.closeWindow?.();
  } catch {
    showToast(t('toast.launchError'));
  } finally {
    view.launching = false;
    if (isCurrentGamePage(id)) renderPage();
  }
}

function requestGamePageFriends(force = false) {
  const username = String(preferences.robloxUsername || '').trim();
  if (username) void loadFriends(username, force);
}

function scheduleGamePageData(game, view) {
  const id = String(game.id);
  if (view.pane === 'overview') queueMicrotask(() => {
    if (isCurrentGamePage(id, 'overview')) loadGamePageJournal(game);
  });
  if (['overview', 'friends', 'servers'].includes(view.pane) && (!friendsCache.data || Date.now() - friendsCache.at > FRIENDS_TTL) && !friendsLoading) {
    queueMicrotask(() => { if (isCurrentGamePage(id)) requestGamePageFriends(); });
  }
  if (view.pane === 'servers' && view.serverMode !== 'friends' && gameServerPage(view).status === 'idle') {
    queueMicrotask(() => {
      if (isCurrentGamePage(id, 'servers') && gameServerPage(view).status === 'idle') void loadGameServers(game);
    });
  }
  if (view.pane === 'servers' && preferences.showPrivateServers !== false && !preferences.streamMode && typeof gamePrivateServerPage === 'function') {
    const priv = gamePrivateServerPage(view);
    const shouldLoadPriv = priv.status === 'idle' || (priv.status === 'error' && (priv.reason === 'auth-required' || priv.reason === 'cookie-expired'));
    if (shouldLoadPriv) {
      queueMicrotask(() => {
        if (isCurrentGamePage(id, 'servers') && preferences.showPrivateServers !== false && !preferences.streamMode) {
          void loadPrivateServers(game);
        }
      });
    }
  }
  if (view.pane === 'servers' && view.serverMode !== 'friends') {
    const pub = gameServerPage(view);
    if (pub.status === 'success' && pub.rows.length && (pub.resolveStatus === 'auth-required' || pub.resolveStatus === 'cookie-expired')) {
      queueMicrotask(() => {
        if (isCurrentGamePage(id, 'servers')) void resolveServersForView(game, view, pub.rows, view.serverMode);
      });
    }
  }
}

function selectGamePane(pane) {
  if (!detailGame || !gamePanes.includes(pane)) return;
  const view = gamePageView(detailGame.id);
  if (view.pane === pane) return;
  const tabs = document.querySelector('.game-page-tabs');
  const oldLineNode = tabs?.querySelector('[aria-selected="true"] .game-page-tab-line');
  const oldLine = oldLineNode?.getBoundingClientRect();
  const scrollLeft = tabs?.scrollLeft || 0;
  const direction = Math.sign(gamePanes.indexOf(pane) - gamePanes.indexOf(view.pane));
  view.pane = pane;
  renderPage();
  const active = document.getElementById('game-pane-' + pane);
  if (active) {
    if (active.parentElement) active.parentElement.scrollLeft = scrollLeft;
    active.focus({ preventScroll: true });
    active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    const line = active.querySelector('.game-page-tab-line');
    const newLine = line?.getBoundingClientRect();
    if (line && oldLine && newLine && newLine.width > 0) {
      window.vortexMotion.animate(line, [
        { transform: `translateX(${oldLine.left - newLine.left}px) scaleX(${oldLine.width / newLine.width})` },
        { transform: 'none' }
      ], 210);
    }
  }
  revealGameContent(document.getElementById('game-page-panel'), direction * 8);
}

function revealGameContent(node, offset = 0) {
  window.vortexMotion.animate(node, [
    { opacity: .45, translate: `${offset}px ${offset ? 0 : 5}px` },
    { opacity: 1, translate: '0 0' }
  ], 210);
}

async function copyGamePageValue(value) {
  try { await navigator.clipboard.writeText(value); showToast(t('place.copied')); }
  catch { showToast(t('place.copyFailed')); }
}

async function pinPrivateServerFromGamePage(game, target) {
  if (!game || !target || target.dataset.pinning === '1') return;
  const placeId = String(target.dataset.placeId || game.id || '').trim();
  const accessCode = String(target.dataset.accessCode || '').trim();
  const vipServerId = String(target.dataset.vipServerId || '').trim();
  const isMine = target.dataset.isMine === '1';
  const serverName = String(target.dataset.serverName || game.title || '').trim();
  if (!placeId || (!accessCode && !(isMine && /^\d+$/.test(vipServerId)))) return;

  const title = serverName ? `${game.title} — ${serverName}`.slice(0, 64) : undefined;
  const thumbnail = safeThumbnail(game.icon || game.thumbnail) || '';
  target.dataset.pinning = '1';
  target.disabled = true;
  try {
    // For the user's own VIP server, prefer Roblox's official share/invite link when enabled
    // so Quick Launch uses the same native share_links / linkCode route as Roblox itself.
    if (isMine && /^\d+$/.test(vipServerId) && window.vortexDesktop?.getPrivateServerConfig) {
      try {
        const res = await window.vortexDesktop.getPrivateServerConfig({ vipServerId });
        const server = res?.ok ? res.server : null;
        const rawLink = typeof server?.link === 'string' ? server.link.trim() : '';
        const parsed = rawLink && typeof robloxSearchLink === 'function' ? robloxSearchLink(rawLink) : null;
        if (parsed?.method === 'share' && parsed.shareCode) {
          await pinPastedLink({
            method: 'share',
            shareCode: parsed.shareCode,
            shareType: parsed.shareType || 'Server',
            placeId,
            title,
            thumbnail
          });
          return;
        }
        if (parsed?.method === 'private' && parsed.linkCode) {
          await pinPastedLink({
            method: 'private',
            placeId: parsed.placeId || placeId,
            linkCode: parsed.linkCode,
            title,
            thumbnail
          });
          return;
        }
        const joinCode = typeof server?.joinCode === 'string' ? server.joinCode.trim() : '';
        if (joinCode && /^[a-z0-9_-]{1,100}$/i.test(joinCode)) {
          await pinPastedLink({
            method: 'private',
            placeId,
            linkCode: joinCode,
            title,
            thumbnail
          });
          return;
        }
      } catch { /* Fall back to pinning by accessCode below. */ }
    }

    if (accessCode) {
      await pinPastedLink({
        method: 'access',
        placeId,
        accessCode,
        title,
        thumbnail
      });
    }
  } finally {
    delete target.dataset.pinning;
    target.disabled = false;
  }
}

document.addEventListener('click', event => {
  if (currentView !== 'game-detail' || !detailGame) return;
  const target = event.target.closest?.('[data-game-pane],[data-game-page-action]');
  if (!target) return;
  if (target.dataset.gamePane) { selectGamePane(target.dataset.gamePane); return; }
  const game = detailGame;
  const view = gamePageView(game.id);
  switch (target.dataset.gamePageAction) {
    case 'media-select':
    case 'media-next':
    case 'media-prev': {
      const items = gamePageMedia(game);
      if (!items.length) return;
      const old = view.media;
      const step = target.dataset.gamePageAction === 'media-next' ? 1 : -1;
      view.media = target.dataset.index === undefined ? (old + step + items.length) % items.length : Number(target.dataset.index);
      if (view.media === old) return;
      renderPage();
      revealGameContent(document.querySelector('.game-page-media-main > :is(img,.game-page-video)'),
        (target.dataset.index === undefined ? step : Math.sign(view.media - old)) * 8);
      if (target.dataset.index === undefined) document.querySelector('[data-game-page-action="' + target.dataset.gamePageAction + '"]')?.focus();
      else document.querySelector('[data-game-page-action="media-select"][aria-pressed="true"]')?.focus();
      return;
    }
    case 'server-mode':
      if (!['all', 'friends', 'small'].includes(target.dataset.mode) || view.serverMode === target.dataset.mode) return;
      view.serverMode = target.dataset.mode;
      view.serverSearch = '';
      renderPage();
      revealGameContent(document.getElementById('game-page-server-results'));
      if (view.serverMode === 'friends') requestGamePageFriends();
      return;
    case 'server-region': {
      const nextRegion = target.dataset.region || 'all';
      if (view.serverRegion === nextRegion) return;
      view.serverRegion = nextRegion;
      document.querySelectorAll('[data-game-page-action="server-region"]').forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.region === nextRegion));
      });
      const resultsNode = document.getElementById('game-page-server-results');
      if (resultsNode) {
        resultsNode.innerHTML = gameServerResults(game, view);
        revealGameContent(resultsNode);
      }
      return;
    }
    case 'server-refresh':
      if (view.serverMode === 'friends') requestGamePageFriends(true);
      else void loadGameServers(game);
      if (preferences.showPrivateServers !== false && typeof loadPrivateServers === 'function') {
        void loadPrivateServers(game);
      }
      return;
    case 'server-more': void loadGameServers(game, true); return;
    case 'private-refresh': if (typeof loadPrivateServers === 'function') void loadPrivateServers(game); return;
    case 'private-more': if (typeof loadPrivateServers === 'function') void loadPrivateServers(game, true); return;
    case 'private-filter': {
      const next = target.dataset.filter || 'all';
      if (view.privateFilter === next) return;
      view.privateFilter = next;
      if (typeof updatePrivateServerResults === 'function') updatePrivateServerResults(game, view);
      return;
    }
    case 'private-pin': {
      void pinPrivateServerFromGamePage(game, target);
      return;
    }
    case 'ping-regions': if (typeof openRegionPingModal === 'function') void openRegionPingModal(); return;
    case 'private-config': if (typeof openPrivateServerConfigModal === 'function') void openPrivateServerConfigModal(game, target.dataset.vipServerId); return;
    case 'private-create': if (typeof openCreatePrivateServerModal === 'function') void openCreatePrivateServerModal(game, view); return;
    case 'friends-refresh': requestGamePageFriends(true); return;
    case 'friends-settings': preferences.settingsTab = 'general'; setView('settings'); return;
    case 'join': void detailLaunch(game, target.dataset.placeId, target.dataset.serverId); return;
    case 'join-private': void detailLaunch(game, target.dataset.placeId, '', target.dataset.accessCode); return;
    case 'play': void detailLaunch(game); return;
    case 'toggle-hide': {
      const hide = !gameLaunchOptions(game).hide;
      writeGameLaunchOptions(game, { hide });
      target.setAttribute('aria-checked', hide);
      return;
    }
    case 'reset-launch': {
      const options = { ...preferences.gameLaunchOptions };
      delete options[String(game.id)];
      preferences.gameLaunchOptions = options;
      savePreferences();
      renderPage();
      document.querySelector('[data-game-page-action="reset-launch"]')?.focus({ preventScroll: true });
      return;
    }
    case 'pin-place': void pinPastedLink({ method: 'public', placeId: String(game.id) }); return;
    case 'copy-place': void copyGamePageValue(String(game.id)); return;
    case 'copy-server': void copyGamePageValue(target.dataset.serverId); return;
  }
});

document.addEventListener('input', event => {
  if (!detailGame) return;
  if (event.target.matches?.('[data-game-alias-input]')) {
    const id = String(event.target.dataset.gameAliasInput || detailGame.id);
    const val = event.target.value.slice(0, 64);
    const next = { ...(preferences.gameAliases || {}) };
    if (val.trim()) next[id] = val;
    else delete next[id];
    preferences.gameAliases = next;
    savePreferencesDebounced();
    const h1 = document.querySelector('.game-page-title h1');
    if (h1) h1.textContent = val.trim() || detailGame.title || '';
    return;
  }
  if (event.target.matches?.('[data-game-note-input]')) {
    const id = String(event.target.dataset.gameNoteInput || detailGame.id);
    const val = event.target.value.slice(0, 500);
    const next = { ...(preferences.gameNotes || {}) };
    if (val.trim()) next[id] = val;
    else delete next[id];
    preferences.gameNotes = next;
    savePreferencesDebounced();
    return;
  }
  if (!event.target.matches?.('[data-game-server-search]')) return;
  const view = gamePageView(detailGame.id);
  view.serverSearch = event.target.value;
  const results = document.getElementById('game-page-server-results');
  if (results) results.innerHTML = gameServerResults(detailGame, view);
  if (typeof updatePrivateServerResults === 'function') updatePrivateServerResults(detailGame, view);
});

document.addEventListener('change', event => {
  if (!detailGame) return;
  if (event.target.matches?.('[data-game-launch="server"]')) {
    writeGameLaunchOptions(detailGame, { server: event.target.value });
  } else if (event.target.matches?.('[data-game-launch="region"]')) {
    writeGameLaunchOptions(detailGame, { region: event.target.value });
  } else if (event.target.matches?.('[data-game-private-toggle]')) {
    preferences.showPrivateServers = Boolean(event.target.checked);
    savePreferences();
    const view = gamePageView(detailGame.id);
    if (typeof updatePrivateServerResults === 'function') {
      updatePrivateServerResults(detailGame, view);
      if (preferences.showPrivateServers) {
        revealGameContent(document.getElementById('game-page-private-servers'));
        if (typeof gamePrivateServerPage === 'function' && gamePrivateServerPage(view).status === 'idle') {
          void loadPrivateServers(detailGame);
        }
      }
    }
  }
});

document.addEventListener('keydown', event => {
  if (!event.target.matches?.('[role="tab"][data-game-pane]')) return;
  const pane = gamePanes.indexOf(event.target.dataset.gamePane);
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? gamePanes.length - 1
    : event.key === 'ArrowLeft' ? (pane - 1 + gamePanes.length) % gamePanes.length
    : event.key === 'ArrowRight' ? (pane + 1) % gamePanes.length : -1;
  if (index < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  selectGamePane(gamePanes[index]);
});
