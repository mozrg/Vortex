function gameLaunchChoices(game) {
  const id = String(game.id);
  const key = experienceKey(game);
  return quickLaunchGames().filter(item => item.method !== 'public' && item.placeId &&
    (String(item.placeId) === id || experienceKey(getGame(item.placeId) || { id: item.placeId }) === key));
}

function gameLaunchOptions(game) {
  const id = String(game.id);
  const saved = Object.hasOwn(preferences.gameLaunchOptions || {}, id) ? preferences.gameLaunchOptions[id] : null;
  return { server: String(saved?.server || 'default'), hide: saved?.hide === true };
}

function writeGameLaunchOptions(game, changes) {
  const id = String(game.id);
  if (!gameIdPattern.test(id)) return;
  preferences.gameLaunchOptions = { ...preferences.gameLaunchOptions, [id]: { ...gameLaunchOptions(game), ...changes } };
  savePreferences();
}

function renderGameLaunch(game) {
  const { server, hide } = gameLaunchOptions(game);
  const choices = [
    ['default', t('place.normalServer')], ['ping', t('place.bestPing')], ['small', t('place.fewerPlayers')],
    ...gameLaunchChoices(game).map(item => ['saved:' + item.id, preferences.streamMode ? t('tools.privateShortcut') : item.title])
  ];
  if (server.startsWith('saved:') && !choices.some(([key]) => key === server)) choices.push([server, t('place.savedServerUnavailable'), true]);
  return `<div class="game-page-columns"><section class="game-page-card game-launch-card">
    <h2>${t('place.launch')}</h2>
    <div class="setting-line">
      <div class="setting-label"><strong>${t('place.serverAtLaunch')}</strong><small>${t('place.serverAtLaunchHint')}</small></div>
      <details class="surprise-select game-launch-select">
        <summary aria-label="${t('place.serverAtLaunch')}"><span data-game-launch-label>${escapeHtml(choices.find(([key]) => key === server)?.[1] || choices[0][1])}</span>${icon('chevronDown', 14)}</summary>
        <fieldset class="surprise-choices game-launch-choices" aria-label="${t('place.serverAtLaunch')}">
          ${choices.map(([key, label, unavailable]) => `<label ${unavailable ? 'data-unavailable-server' : ''}><input type="radio" name="game-launch-server" data-game-launch="server"
            value="${escapeHtml(key)}" ${key === server ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`).join('')}
        </fieldset>
      </details>
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
  return `<section class="game-page-card game-page-other"><h2>${t('place.other')}</h2>
    <div class="game-page-other-actions">
      <button class="ghost-button" data-launcher-action="shortcut" data-id="${escapeHtml(game.id)}">${icon('monitor', 16)} ${t('tools.shortcut')}</button>
      <button class="ghost-button" data-game-page-action="pin-place">${icon('star', 16)} ${t('tools.pinGame')}</button>
      <button class="ghost-button" data-game-page-action="copy-place">${icon('link', 16)} ${t('place.copyId')}</button>
      <button class="ghost-button" data-action="open-social-link" data-url="${officialGameUrl(game)}">${icon('arrowUpRight', 16)} ${t('place.openRoblox')}</button>
    </div>
  </section>`;
}

async function detailLaunch(game, place = '', instance = '') {
  const id = String(game.id);
  const view = gamePageView(id);
  if (!gameIdPattern.test(id) || (place && !gameIdPattern.test(place)) || (instance && !serverIdPattern.test(instance)) || view.launching) return;
  const { server, hide } = gameLaunchOptions(game);
  view.launching = true;
  renderPage();
  try {
    let launched;
    if (place && instance) launched = await openGame(place, instance);
    else if (server.startsWith('saved:')) {
      const item = gameLaunchChoices(game).find(choice => choice.id === server.slice(6));
      if (item) launched = await launchQuickGame(item.id);
      else showToast(t('place.savedServerMissing'));
    } else {
      let target;
      if (server === 'ping' || server === 'small') {
        const payload = await window.vortexDesktop?.getPublicServers?.({ placeId: id, smallest: true }).catch(() => null);
        const open = normalizeBrowserServers(payload?.servers).filter(row => row.playing < row.capacity);
        if (server === 'ping') target = open.filter(row => row.ping !== null).sort((a, b) => a.ping - b.ping)[0];
        else target = open.sort((a, b) => a.playing - b.playing)[0];
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
}

function selectGamePane(pane) {
  if (!detailGame || !gamePanes.includes(pane)) return;
  const view = gamePageView(detailGame.id);
  if (view.pane === pane) return;
  const tabs = document.querySelector('.game-page-tabs');
  const oldLine = tabs.querySelector('[aria-selected="true"] .game-page-tab-line').getBoundingClientRect();
  const scrollLeft = tabs.scrollLeft;
  const direction = Math.sign(gamePanes.indexOf(pane) - gamePanes.indexOf(view.pane));
  view.pane = pane;
  renderPage();
  const active = document.getElementById('game-pane-' + pane);
  active.parentElement.scrollLeft = scrollLeft;
  active.focus({ preventScroll: true });
  active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  const line = active.querySelector('.game-page-tab-line');
  const newLine = line.getBoundingClientRect();
  window.vortexMotion.animate(line, [
    { transform: `translateX(${oldLine.left - newLine.left}px) scaleX(${oldLine.width / newLine.width})` },
    { transform: 'none' }
  ], 210);
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
    case 'server-refresh':
      if (view.serverMode === 'friends') requestGamePageFriends(true);
      else void loadGameServers(game);
      return;
    case 'server-more': void loadGameServers(game, true); return;
    case 'friends-refresh': requestGamePageFriends(true); return;
    case 'friends-settings': preferences.settingsTab = 'general'; setView('settings'); return;
    case 'join': void detailLaunch(game, target.dataset.placeId, target.dataset.serverId); return;
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
      const menu = document.querySelector('.game-launch-select');
      const normal = menu.querySelector('[data-game-launch="server"][value="default"]');
      normal.checked = true;
      menu.querySelector('[data-game-launch-label]').textContent = normal.nextElementSibling.textContent;
      menu.open = false;
      document.querySelector('[data-game-page-action="toggle-hide"]').setAttribute('aria-checked', 'false');
      const obsolete = menu.querySelector('[data-unavailable-server]');
      obsolete?.remove();
      return;
    }
    case 'pin-place': void pinPastedLink({ method: 'public', placeId: String(game.id) }); return;
    case 'copy-place': void copyGamePageValue(String(game.id)); return;
    case 'copy-server': void copyGamePageValue(target.dataset.serverId); return;
  }
});

document.addEventListener('input', event => {
  if (!event.target.matches?.('[data-game-server-search]') || !detailGame) return;
  const view = gamePageView(detailGame.id);
  view.serverSearch = event.target.value;
  document.getElementById('game-page-server-results').innerHTML = gameServerResults(detailGame, view);
});

document.addEventListener('change', event => {
  if (!event.target.matches?.('[data-game-launch="server"]') || !detailGame) return;
  writeGameLaunchOptions(detailGame, { server: event.target.value });
  const menu = event.target.closest('.game-launch-select');
  menu.querySelector('[data-game-launch-label]').textContent = event.target.nextElementSibling.textContent;
  menu.open = false;
  menu.querySelector('summary').focus({ preventScroll: true });
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
