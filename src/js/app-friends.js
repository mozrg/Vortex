let friendsCache = { at: 0, data: null };const FRIENDS_TTL = 30 * 1000;
let friendsLoading = false;
let friendsAutoDetectStarted = false;
// First visit to the Friends page with no username: detect the local Roblox
// account automatically, so the user never has to type anything.
let detectingFriendAccount = false;
async function autoDetectRobloxAccountOnce(force = false) {
  if (detectingFriendAccount || (!force && friendsAutoDetectStarted) || preferences.robloxUsername) return;
  detectingFriendAccount = true;
  friendsAutoDetectStarted = true;
  try {
    const result = await window.vortexDesktop?.detectRobloxAccount();
    if (result && result.ok && result.account && result.account.name) {
      rememberRobloxAccount(result.account);
      preferences.robloxUsername = result.account.name;
      friendsCache = { at: 0, data: null };
      savePreferences();
      renderPage();
      renderFriendsDrawer();
      if (!document.getElementById('friends-drawer')?.hidden) void loadFriends(preferences.robloxUsername);
    }
  } catch { /* stay on the setup screen */ } finally {
    detectingFriendAccount = false;
    if (force && !preferences.robloxUsername) showToast(t('friends.setup.body'));
  }
}

function friendsErrorCopy(data) {
  const err = data?.error;
  if (err === 'cookie-expired') {
    return { title: t('friends.cookieExpiredTitle'), body: t('friends.cookieExpiredBody'), showCookieBtn: true };
  }
  if (err === 'auth-required') {
    return { title: t('friends.authRequiredTitle'), body: t('friends.authRequiredBody'), showCookieBtn: true };
  }
  if (err === 'rate-limited') {
    return { title: t('friends.rateLimitedTitle'), body: t('friends.rateLimitedBody'), showCookieBtn: false };
  }
  if (err === 'network') {
    return { title: t('friends.networkTitle'), body: t('friends.networkBody'), showCookieBtn: true };
  }
  return { title: t('friends.notFound.title'), body: t('friends.notFound.body'), showCookieBtn: false };
}

// Friends page as a card grid: one compact card per friend, richer info on
// hover (avatar, game, join) in a floating preview panel.
function renderFriends() {
  const username = String(preferences.robloxUsername || '').trim();
  const refreshAction = `<button class="ghost-button icon-only-button friends-refresh" data-action="refresh-friends" ${friendsLoading ? 'disabled' : ''} aria-label="${t('friends.refresh')}" data-tooltip="${t('friends.refresh')}">${icon('refreshCw', 15)}</button>`;
  const heading = pageHeading(t('page.friends.eyebrow'), t('page.friends.title'), t('page.friends.description'), refreshAction);
  if (!username) {
    autoDetectRobloxAccountOnce();
    return `${heading}
      <section class="section-block"><div class="empty-state"><div class="empty-icon">${icon('users', 20)}</div><h2>${t('friends.setup.title')}</h2><p>${t('friends.setup.body')}</p><button class="primary-button" data-detect-username-home>${icon('users')} ${t('friends.detect')}</button> <button class="ghost-button" data-nav="settings">${icon('sliders')} ${t('friends.setup.action')}</button></div></section>`;
  }
  if (!friendsCache.data || Date.now() - friendsCache.at > FRIENDS_TTL) {
    loadFriends(username);
    if (!friendsCache.data) {
      return `${heading}
        <section class="section-block"><div class="friends-loading">${icon('users', 18)}<p>${t('friends.loading')}</p></div></section>`;
    }
  }
  const data = friendsCache.data;
  if (!data.ok) {
    const { title: errorTitle, body: errorBody, showCookieBtn } = friendsErrorCopy(data);
    return `${heading}
      <section class="section-block"><div class="empty-state"><div class="empty-icon">${icon('users', 20)}</div><h2>${errorTitle}</h2><p>${errorBody}</p><div class="empty-state-actions">${showCookieBtn ? `<button class="primary-button" data-action="open-integrations-settings">${icon('lock', 13)} ${t('friends.openIntegrations')}</button> ` : ''}<button class="ghost-button" data-action="refresh-friends">${icon('refreshCw', 13)} ${t('friends.refresh')}</button></div></div></section>`;
  }
  const friends = (data.friends || []).map(safeFriendForDisplay);
  const pins = friendPins();
  const pinned = friends.filter(friend => Object.hasOwn(pins, String(friend.id)));
  const unpinned = friends.filter(friend => !Object.hasOwn(pins, String(friend.id)));
  const playing = unpinned.filter((f) => f.presence === 'playing');
  const online = unpinned.filter((f) => f.presence === 'online');
  const offline = unpinned.filter((f) => f.presence === 'offline');
  const presenceNote = data.livePresence ? '' : `<div class="friends-presence-note">${icon('bell', 12)} ${t('friends.presenceOff')}</div>`;
  const card = (friend) => {
    const name = friend.displayName || friend.name || t('friends.unknown');
    const gameName = friend.presence === 'playing' ? (friend.gameName || t('friends.inGame')) : '';
    return `<article class="friend-card ${friend.presence}" data-friend-id="${escapeHtml(friend.id)}" data-friend-name="${escapeHtml(name)}" data-friend-avatar="${escapeHtml(friend.avatar || '')}" data-game-name="${escapeHtml(gameName)}" data-game-thumb="${escapeHtml(friend.presence === 'playing' ? friend.gameThumbnail || '' : '')}" tabindex="0">
      <span class="friend-avatar ${friend.avatar ? 'has-avatar' : ''}">${friend.avatar ? `<img src="${escapeHtml(friend.avatar)}" alt="" loading="eager" decoding="async" />` : escapeHtml(name[0].toLocaleUpperCase())}</span>
      <span class="friend-copy"><strong>${escapeHtml(name)}</strong><small>${friend.presence === 'playing' ? escapeHtml(gameName) : friend.presence === 'online' ? t('friends.online') : t('friends.offline')}</small></span>
      ${friendPinControls(friend, pins)}${friend.presence === 'playing' && friend.placeId ? `<button class="friend-join" data-friend-join="${escapeHtml(friend.placeId)}" data-friend-game="${escapeHtml(friend.gameId || '')}" data-tooltip="${t('friends.join')}">${icon('play', 12)}</button>` : ''}
    </article>`;
  };
  const section = (titleKey, list) => !list.length ? '' : `<p class="friends-group-title">${t(titleKey)} · ${list.length}</p>
    <div class="friends-grid">${list.map(card).join('')}</div>`;
  return `${heading}
    <section class="section-block">
      ${presenceNote}
      ${section('tools.pinnedFriends', pinned)}
      ${typeof renderPinnedFriendsLogCard === 'function' ? renderPinnedFriendsLogCard(pinned) : ''}
      ${section('friends.groupPlaying', playing)}
      ${section('friends.groupOnline', online)}
      ${section('friends.groupOffline', offline)}
      ${friends.length ? '' : `<div class="empty-state"><div class="empty-icon">${icon('users', 20)}</div><h2>${t('friends.empty.title')}</h2><p>${t('friends.empty.body')}</p></div>`}
      <p class="catalog-disclaimer">${t('friends.disclaimer')}</p>
    </section>`;
}

async function loadFriends(username, force = false) {
  if (friendsLoading) return;
  if (!force && friendsCache.username === username && friendsCache.data && Date.now() - friendsCache.at <= FRIENDS_TTL) return;
  friendsLoading = true;
  const refresh = pageContent.querySelector('[data-action="refresh-friends"]');
  if (refresh) { refresh.disabled = true; refresh.setAttribute('aria-busy', 'true'); }
  renderFriendsDrawer();
  try {
    const data = await window.vortexDesktop?.listFriends(username);
    if (username !== String(preferences.robloxUsername || '').trim()) return;
    friendsCache = { at: Date.now(), username, data: data || { ok: false, error: 'unavailable' } };
    if (data?.ok) { notifyFriendsInFavorites(data.friends); notifyPinnedFriends(data.friends || []); }
  } catch {
    if (username === String(preferences.robloxUsername || '').trim()) {
      friendsCache = { at: Date.now(), username, data: { ok: false, error: 'network' } };
    }
  } finally {
    friendsLoading = false;
    reportGameOverlay();
    if (currentView === 'friends' || shouldRefreshCatalogFriends() || isCurrentGamePage(detailGame?.id, 'overview') ||
        isCurrentGamePage(detailGame?.id, 'friends') || isCurrentGamePage(detailGame?.id, 'servers')) renderPage();
    renderFriendsDrawer();
  }
}

function renderFriendsDrawer() {
  const content = document.getElementById('friends-drawer-content');
  if (!content) return;
  const username = String(preferences.robloxUsername || '').trim();
  if (!username) {
    content.innerHTML = `<div class="friends-drawer-empty"><span class="friends-drawer-empty-icon">${icon('users', 19)}</span><strong>${t('friends.setup.title')}</strong><p>${t('friends.setup.body')}</p><button class="primary-button" data-detect-username-home>${icon('users', 14)} ${t('friends.detect')}</button><button class="text-button" data-action="friends-drawer-view-all">${t('friends.setup.action')}</button></div>`;
    mountIcons(content);
    return;
  }
  if (friendsLoading || !friendsCache.data || Date.now() - friendsCache.at > FRIENDS_TTL) {
    content.innerHTML = `<div class="friends-drawer-loading"><span class="loading-spinner small"></span><span>${t('friends.loading')}</span></div><button class="text-button friends-drawer-all" data-action="friends-drawer-view-all">${t('activity.viewAllFriends')}</button>`;
    mountIcons(content);
    if (!friendsLoading) void loadFriends(username);
    return;
  }
  const data = friendsCache.data;
  if (!data?.ok) {
    const { title: errorTitle, body: errorBody, showCookieBtn } = friendsErrorCopy(data);
    content.innerHTML = `<div class="friends-drawer-empty"><span class="friends-drawer-empty-icon">${icon('users', 19)}</span><strong>${errorTitle}</strong><p>${errorBody}</p>${showCookieBtn ? `<button class="primary-button" data-action="open-integrations-settings">${icon('lock', 13)} ${t('friends.openIntegrations')}</button>` : ''}<button class="ghost-button" data-action="refresh-friends-drawer">${icon('refreshCw', 13)} ${t('friends.refresh')}</button></div>`;
    mountIcons(content);
    return;
  }
  const friends = (Array.isArray(data.friends) ? data.friends : []).map(safeFriendForDisplay);
  const pins = friendPins();
  const unpinned = friends.filter(friend => !Object.hasOwn(pins, String(friend.id)));
  const groups = [
    ['tools.pinnedFriends', friends.filter(friend => Object.hasOwn(pins, String(friend.id)))],
    ['friends.groupPlaying', unpinned.filter((friend) => friend.presence === 'playing')],
    ['friends.groupOnline', unpinned.filter((friend) => friend.presence === 'online')],
    ['friends.groupOffline', unpinned.filter((friend) => friend.presence !== 'playing' && friend.presence !== 'online')]
  ];
  const row = (friend) => {
    const name = friend.displayName || friend.name || t('friends.unknown');
    const status = friend.presence === 'playing' ? friend.gameName || t('friends.inGame') : friend.presence === 'online' ? t('friends.online') : t('friends.offline');
    return `<div class="friends-drawer-row ${friend.presence}"><span class="friend-avatar ${friend.avatar ? 'has-avatar' : ''}">${friend.avatar ? `<img src="${escapeHtml(friend.avatar)}" alt="" loading="lazy" decoding="async" />` : escapeHtml(name[0].toLocaleUpperCase())}<i></i></span><span class="friend-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(status)}</small></span>${friendPinControls(friend, pins)}${friend.presence === 'playing' && friend.placeId ? `<button class="friend-join" data-friend-join="${escapeHtml(friend.placeId)}" data-friend-game="${escapeHtml(friend.gameId || '')}" data-tooltip="${t('friends.join')}" aria-label="${t('friends.join')}">${icon('play', 12)}</button>` : ''}</div>`;
  };
  const groupMarkup = groups.filter(([, list]) => list.length).map(([title, list]) => `<section class="friends-drawer-group"><h3>${t(title)}<span>${list.length}</span></h3>${list.map(row).join('')}</section>`).join('');
  content.innerHTML = `${data.livePresence ? '' : `<p class="friends-presence-note">${icon('bell', 12)} ${t('friends.presenceOff')}</p>`}${friends.length ? groupMarkup : `<div class="friends-drawer-empty compact"><span class="friends-drawer-empty-icon">${icon('users', 18)}</span><strong>${t('friends.empty.title')}</strong><p>${t('friends.empty.body')}</p></div>`}<button class="text-button friends-drawer-all" data-action="friends-drawer-view-all">${t('activity.viewAllFriends')} ${icon('arrow', 12)}</button>`;
  mountIcons(content);
}

function openFriendsDrawer() {
  const drawer = document.getElementById('friends-drawer');
  const backdrop = document.getElementById('friends-drawer-backdrop');
  if (!drawer || !backdrop) return;
  drawer.hidden = false;
  backdrop.hidden = false;
  drawer.inert = false;
  requestAnimationFrame(() => {
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.querySelector('[data-action="toggle-friends-drawer"]')?.setAttribute('aria-expanded', 'true');
    drawer.querySelector('[data-action="close-friends-drawer"]')?.focus();
  });
  renderFriendsDrawer();
  const username = String(preferences.robloxUsername || '').trim();
  if (username && (!friendsCache.data || Date.now() - friendsCache.at > FRIENDS_TTL)) void loadFriends(username);
  else if (!username) autoDetectRobloxAccountOnce();
}

function closeFriendsDrawer() {
  const drawer = document.getElementById('friends-drawer');
  const backdrop = document.getElementById('friends-drawer-backdrop');
  if (!drawer || drawer.hidden) return;
  drawer.classList.remove('is-open');
  backdrop?.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.inert = true;
  document.querySelector('[data-action="toggle-friends-drawer"]')?.setAttribute('aria-expanded', 'false');
  window.setTimeout(() => {
    if (!drawer.classList.contains('is-open')) {
      drawer.hidden = true;
      if (backdrop) backdrop.hidden = true;
      document.querySelector('[data-action="toggle-friends-drawer"]')?.focus();
    }
  }, 230);
}

// Notifies once per friend/game pair when a friend starts a favourite of yours.
const notifiedFriendGames = new Set();

function notifyFriendsInFavorites(friends) {
  if (preferences.streamMode || !preferences.friendFavoriteAlerts || !Array.isArray(friends) || !favorites.size) return;
  for (const friend of friends) {
    if (!friend || !friend.isOnline || !friend.playingPlaceId) continue;
    const placeId = String(friend.playingPlaceId);
    if (!favorites.has(placeId)) continue;
    const key = `${friend.id}:${placeId}`;
    if (notifiedFriendGames.has(key)) continue;
    notifiedFriendGames.add(key);
    const game = getGame(placeId);
    window.vortexDesktop?.notifyFriendPlaying?.({
      friend: friend.displayName || friend.name || t('friends.unknown'),
      game: game?.title || t('friends.someGame')
    });
  }
}

function persistActivityData() {
  accountStorage.setItem('vortex.activity', JSON.stringify(activityData));
}

function recordActivityTime(gameId, startedAt, seconds) {
  let carryMs = 0;
  let credited = 0;
  activitySlices(startedAt, startedAt + seconds * 1000, (date, slice) => {
    // Round cumulative time so subsecond slices around midnight add up to the
    // same whole seconds as the session cursor.
    const whole = Math.floor((carryMs + slice) / 1000);
    const daySeconds = Object.values(activityData.days[date]?.games || {}).reduce((sum, value) => sum + value, 0);
    const dayLength = (activityLocalDate(shiftActivityDate(date, 1)) - activityLocalDate(date)) / 1000;
    const accepted = Math.min(whole, Math.max(0, dayLength - daySeconds));
    if (accepted > 0) addActivitySeconds(activityData.days, date, String(gameId), accepted);
    carryMs = (carryMs + slice) % 1000;
    credited += accepted;
  });
  return credited;
}

function activityQualifiedGames(dateKey = activityDateKey()) {
  const totals = groupedPlaytime(activityData.days[dateKey]?.games, playtimeForView().gamesById);
  return [...totals.values()].filter(entry => entry.seconds >= ACTIVITY_GAME_MINUTES * 60).map(entry => entry.id);
}

function activityRecoveryAvailable() {
  const { lastCompletedDate, recoveryUsed } = activityData.streak;
  const today = activityDateKey();
  return !recoveryUsed && activityData.streak.current > 0 && activityDayDistance(lastCompletedDate, today) === 2;
}

function completeDailyActivity() {
  if (activityQualifiedGames().length < ACTIVITY_DAILY_GAMES) return false;
  const today = activityDateKey();
  const streak = activityData.streak;
  if (streak.lastCompletedDate === today) return false;
  const distance = activityDayDistance(streak.lastCompletedDate, today);
  if (distance === 2 && activityRecoveryAvailable()) return false;
  streak.current = distance === 1 ? Number(streak.current || 0) + 1 : 1;
  streak.best = Math.max(Number(streak.best || 0), streak.current);
  streak.lastCompletedDate = today;
  if (distance !== 1) streak.recoveryUsed = false;
  return true;
}

function formatActivityMinutes(seconds) {
  const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  if (minutes < 60) return `${minutes}${t('time.minutes')}`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}${t('time.hours')}${remainder ? ` ${remainder}${t('time.minutes')}` : ''}`;
}

function renderActivity() {
  const today = activityDateKey();
  const completedNow = completeDailyActivity();
  const metrics = activityMetrics();
  if (updateActivityAchievements(metrics) || completedNow) persistActivityData();
  const day = activityData.days[today] || { games: {} };
  const threshold = ACTIVITY_GAME_MINUTES * 60;
  const gamesToday = [...groupedPlaytime(day.games, playtimeForView().gamesById).values()].sort((a, b) => b.seconds - a.seconds);
  const qualified = activityQualifiedGames(today);
  const completed = qualified.length >= ACTIVITY_DAILY_GAMES;
  const streakDistance = activityDayDistance(activityData.streak.lastCompletedDate, today);
  const currentStreak = streakDistance <= 1 || activityRecoveryAvailable() ? activityData.streak.current : 0;
  const gameRows = gamesToday.length ? gamesToday.map(({ id, seconds }) => {
    const game = getGame(id);
    const title = game?.title || t('activity.unknownGame');
    const progress = Math.min(100, Math.round(Number(seconds) / threshold * 100));
    return `<div class="activity-game-row"><span class="activity-game-icon">${game?.thumbnail ? `<img src="${escapeHtml(safeThumbnail(game.thumbnail))}" alt="" />` : icon('gamepad', 16)}</span><span class="activity-game-copy"><strong>${escapeHtml(title)}</strong><small>${formatActivityMinutes(seconds)} / ${ACTIVITY_GAME_MINUTES}${t('time.minutes')}</small></span><span class="activity-game-progress"><i style="--progress:${progress}%"></i></span><span class="activity-game-check ${Number(seconds) >= threshold ? 'is-complete' : ''}">${Number(seconds) >= threshold ? icon('check', 13) : `${progress}%`}</span></div>`;
  }).join('') : `<div class="activity-empty-note">${icon('gamepad', 16)}<span>${t('activity.emptyGames')}</span></div>`;
  return `
    ${activityData.legacyTime ? `<p class="activity-clock-note">${icon('history', 15)} ${t('activity.clock.repaired')}</p>` : ''}
    <section class="activity-hero"><div class="activity-hero-copy"><span class="activity-eyebrow">${icon('sparkle', 13)} ${t('activity.today')}</span><h2>${completed ? t('activity.goalComplete') : t('activity.goalTitle')}</h2><p>${t('activity.goalBody', { games: ACTIVITY_DAILY_GAMES, minutes: ACTIVITY_GAME_MINUTES })}</p><div class="activity-goal-track"><i style="--progress:${Math.min(100, Math.round(qualified.length / ACTIVITY_DAILY_GAMES * 100))}%"></i></div><small>${t('activity.gamesProgress', { done: Math.min(ACTIVITY_DAILY_GAMES, qualified.length), total: ACTIVITY_DAILY_GAMES })}</small></div>${renderStreak(currentStreak)}</section>
    ${activityRecoveryAvailable() ? `<section class="activity-recovery"><span>${icon('refreshCw', 16)} ${t('activity.recoveryHint')}</span><button class="ghost-button" data-action="restore-activity-streak">${t('activity.recoveryAction')}</button></section>` : ''}
    <div class="activity-overview">
      <section class="settings-card" id="activity-calendar">${activityCalendarContent(today)}</section>
      <section class="settings-card" id="activity-summary">${activitySummaryContent()}</section>
    </div>
    <section class="settings-card activity-daily-card"><div class="settings-card-head"><div><h2>${t('activity.dailyTitle')}</h2><p>${t('activity.dailyBody')}</p></div>${icon('crosshair', 18)}</div><div class="activity-game-list">${gameRows}</div></section>`;
}

const PLANS_STAGE_LABELS = { research: 'plans.filter.research', design: 'plans.filter.design', dev: 'plans.filter.dev', idea: 'plans.filter.idea' };
let roadmapItems = null;
let roadmapStage = 'all';
let roadmapLoadGeneration = 0;

function renderPlans() {
  const items = Array.isArray(roadmapItems) ? roadmapItems : [];
  return `${pageHeading(t('page.plans.eyebrow'), t('page.plans.title'), t('page.plans.description'))}
    ${items.length ? `<div class="plans-filters">${['all', ...Object.keys(PLANS_STAGE_LABELS)].map(key =>
      `<button class="plans-filter ${roadmapStage === key ? 'active' : ''}" data-roadmap-stage="${key}" aria-pressed="${roadmapStage === key}">${t(`plans.filter.${key}`)}</button>`).join('')}</div>` : ''}
    <div class="roadmap-grid">${items.filter(plan => roadmapStage === 'all' || (Object.hasOwn(PLANS_STAGE_LABELS, plan.stage) ? plan.stage : 'idea') === roadmapStage).map((plan) => {
      const localized = (value) => typeof value === 'string' ? value : value?.[preferences.language] || value?.ru || value?.en || '';
      const stage = Object.hasOwn(PLANS_STAGE_LABELS, plan.stage) ? plan.stage : 'idea';
      const iconName = /^[a-zA-Z0-9_-]{1,32}$/.test(String(plan.icon || '')) ? plan.icon : 'flag';
      return `<article class="roadmap-card" data-stage="${stage}"><div class="roadmap-icon">${icon(iconName)}</div><h3>${escapeHtml(localized(plan.title))}</h3><p>${escapeHtml(localized(plan.body))}</p><span class="roadmap-state">${t(PLANS_STAGE_LABELS[stage])}</span></article>`;
    }).join('') || `<p class="catalog-disclaimer">${t(roadmapItems === null ? 'plans.loading' : 'plans.empty')}</p>`}</div>`;
}

async function loadRoadmap() {
  if (!window.vortexDesktop?.listPlans) return;
  const generation = ++roadmapLoadGeneration;
  try {
    const result = await window.vortexDesktop.listPlans();
    if (generation !== roadmapLoadGeneration || currentView !== 'plans') return;
    const items = Array.isArray(result?.items) ? result.items : [];
    if (JSON.stringify(roadmapItems) === JSON.stringify(items)) return;
    roadmapItems = items;
    pageContent.innerHTML = renderPlans();
    mountIcons(pageContent);
  } catch { /* The bundled site/plans.json remains available when offline. */ }
}

