const libraryPeriods = ['week', 'month', 'year', 'all'];
let libraryActivityPane = 'overview';
let libraryPeriod = 'week';
let libraryPeriodOffset = 0;
let libraryChartMetric = 'hours';
let libraryCompare = false;
let journalQuickPeriod = 'all';
let journalFriendsOnly = false;
let journalHourOnly = false;
let dashboardRows = null;
let dashboardRequest = null;
let dashboardRange = null;
let dashboardJournalRevision = 0;
let breakReminderSession = '';
let breakReminderCount = 0;
let breakReminderElapsed = 0;
let rebindingInviteHotkey = false;

const LAST_EXITED_SESSION_KEY = 'vortex.lastExitedSession';
let cachedLastExitedSession = null;

const activityInviteLabels = [
  ['activity.nowPlaying.title', 'Текущая сессия', 'Current session'],
  ['activity.nowPlaying.live', 'Сейчас в игре', 'Playing now'],
  ['activity.nowPlaying.lastExitedBadge', 'Последний сервер, с которого вы вышли', 'Last server you exited from'],
  ['activity.nowPlaying.rejoinSame', 'Перезайти на тот же сервер', 'Rejoin same server'],
  ['activity.nowPlaying.rejoinExited', 'Зайти на тот же сервер', 'Join the same server'],
  ['activity.nowPlaying.idleTitle', 'Сейчас вы не в игре', 'No active game right now'],
  ['activity.nowPlaying.idleHint', 'Запустите любой плейс в Roblox — здесь появится текущая игра, кнопка копирования инвайт-ссылки и быстрый возврат на последний сервер после выхода.', 'Join any Roblox experience to see your live session, copy a direct invite link, or rejoin the last server you exited from.'],
  ['activity.nowPlaying.connecting', 'Определяем сервер…', 'Detecting server…'],
  ['activity.nowPlaying.copyInvite', 'Скопировать инвайт-ссылку', 'Copy invite link'],
  ['activity.nowPlaying.hotkeyLabel', 'Хоткей инвайта', 'Invite hotkey'],
  ['activity.nowPlaying.changeHotkey', 'Изменить', 'Rebind'],
  ['activity.nowPlaying.pressKeys', 'Нажмите клавиши…', 'Press keys…'],
  ['activity.nowPlaying.hotkeyHint', 'Работает прямо внутри Roblox и в лаунчере. Нажмите, чтобы переназначить.', 'Works right inside Roblox and in the launcher. Click to rebind.'],
  ['activity.nowPlaying.hotkeySaved', 'Хоткей инвайт-ссылки: {hotkey}', 'Invite link hotkey: {hotkey}'],
  ['activity.nowPlaying.inviteCopied', 'Инвайт-ссылка на сервер скопирована!', 'Server invite link copied!'],
  ['activity.nowPlaying.notInGame', 'Сначала зайдите в игру в Roblox.', 'Join a Roblox game first.']
];
for (const [key, ru, en] of activityInviteLabels) {
  translations.ru[key] = ru;
  translations.en[key] = en;
}

function rememberLastActiveServerSession(placeId, serverId = '', startedAt = Date.now()) {
  const place = String(placeId || '').trim();
  if (!gameIdPattern.test(place)) return;
  const server = validSessionServer(serverId);
  const existing = cachedLastExitedSession || readStored(LAST_EXITED_SESSION_KEY, null);
  const started = Number(startedAt) || Date.now();
  const sameSession = existing?.placeId === place && existing.startedAt === started;
  const nextServer = server || (sameSession ? validSessionServer(existing.serverId) : '');
  if (sameSession && nextServer === existing.serverId) return;
  const known = getGame(place);
  const record = {
    placeId: place,
    serverId: nextServer,
    title: known?.title || nowPlayingSnapshot?.title || (sameSession && existing.title) || ('Roblox #' + place),
    thumbnail: safeThumbnail(known?.thumbnail || nowPlayingSnapshot?.thumbnail || (sameSession && existing.thumbnail)) || '',
    startedAt: started,
    updatedAt: Date.now()
  };
  cachedLastExitedSession = record;
  try {
    accountStorage.setItem(LAST_EXITED_SESSION_KEY, JSON.stringify(record));
  } catch { /* ignore storage quota */ }
}

function getLastExitedSession() {
  const stored = cachedLastExitedSession || readStored(LAST_EXITED_SESSION_KEY, null);
  let placeId = String(stored?.placeId || '').trim();
  let serverId = validSessionServer(stored?.serverId);
  let updatedAt = Number(stored?.startedAt || stored?.updatedAt) || 0;
  let fallbackTitle = stored?.title || '';
  let fallbackThumb = stored?.thumbnail || '';

  // Compare session starts, including sessions with an unknown server.
  const consider = (id, at, server, title = '') => {
    if (!gameIdPattern.test(id) || !(at > 0)) return;
    if (at > updatedAt) {
      if (id !== placeId) fallbackThumb = '';
      placeId = id;
      serverId = server;
      updatedAt = at;
      fallbackTitle = title;
    } else if (at === updatedAt && id === placeId && !serverId) {
      serverId = server;
    }
  };
  if (typeof recentMetadata === 'function') {
    for (const [id, entry] of Object.entries(recentMetadata() || {})) {
      consider(id, Number(entry?.at), validSessionServer(entry?.serverId));
    }
  }
  // Each list is ordered by session start.
  for (const row of [journalRows?.[0], dashboardRows?.[0]]) {
    if (row) consider(String(row.gameId), row.startedAt, validSessionServer(row.serverId), row.title);
  }

  if (!gameIdPattern.test(placeId)) return null;
  const known = getGame(placeId);
  const title = known?.title || fallbackTitle || ('Roblox #' + placeId);
  const thumbnail = safeThumbnail(known?.thumbnail || fallbackThumb) || '';
  const game = known || { id: placeId, title, thumbnail };
  const url = buildServerInviteUrl(placeId, serverId);
  return { placeId, serverId, title, thumbnail, updatedAt, game, url };
}

function formatInviteHotkey(spec) {
  const clean = String(spec || 'Alt+C').trim() || 'Alt+C';
  return clean.split('+').map(part => part.trim()).filter(Boolean).join(' + ');
}

function formatNowPlayingClock(startedAt) {
  const seconds = Math.max(0, Math.floor((Date.now() - (Number(startedAt) || Date.now())) / 1000));
  const units = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];
  return units.map(unit => String(unit).padStart(2, '0')).join(':');
}

function buildServerInviteUrl(placeId, serverId = '') {
  const place = String(placeId || '').trim();
  if (!gameIdPattern.test(place)) return '';
  const server = validSessionServer(serverId);
  return server
    ? `https://www.roblox.com/games/start?placeId=${encodeURIComponent(place)}&gameInstanceId=${encodeURIComponent(server)}`
    : `https://www.roblox.com/games/start?placeId=${encodeURIComponent(place)}`;
}

function currentPlayingInviteState() {
  if (runtimeSample?.unknown) return null;
  const placeId = String(playSessionGameId || '').trim();
  if (!gameIdPattern.test(placeId)) return null;
  const serverId = validSessionServer(nowPlayingSnapshot?.serverId);
  const known = getGame(placeId);
  const title = known?.title || nowPlayingSnapshot?.title || recordingSession?.title || ('Roblox #' + placeId);
  const thumbnail = safeThumbnail(known?.thumbnail || nowPlayingSnapshot?.thumbnail) || '';
  const startedAt = Number(nowPlayingSnapshot?.startedAt || playSessionStart) || 0;
  const game = known || { id: placeId, title, thumbnail };
  const isPrivate = Boolean(nowPlayingSnapshot?.isPrivate);
  const url = buildServerInviteUrl(placeId, serverId);
  const pid = gameOverlaySession?.placeId === placeId && gameOverlaySession.startedAt === startedAt
    ? gameOverlaySession.pid : null;
  return { placeId, serverId, title, thumbnail, startedAt, game, url, isPrivate, pid };
}

async function writeInviteToClipboard(url) {
  if (!url) return false;
  if (window.vortexDesktop?.copyToClipboard) {
    try {
      await window.vortexDesktop.copyToClipboard(url);
      return true;
    } catch { /* Fall back to the browser clipboard API. */ }
  }
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

async function copyServerInviteUrl(placeId, serverId = '') {
  const url = buildServerInviteUrl(placeId, serverId);
  if (!url) {
    showToast(t('activity.nowPlaying.notInGame'));
    return false;
  }
  if (await writeInviteToClipboard(url)) {
    showToast(t('activity.nowPlaying.inviteCopied'));
    return true;
  }
  showToast(t('place.copyFailed'));
  return false;
}

async function copyActiveServerInviteLink() {
  const active = currentPlayingInviteState();
  if (!active) {
    showToast(t('activity.nowPlaying.notInGame'));
    return false;
  }
  return copyServerInviteUrl(active.placeId, active.serverId);
}

let lastActivityNowPlayingSignature = '';

function activityNowPlayingSignature(active = currentPlayingInviteState(), lastExited = !active ? getLastExitedSession() : null) {
  return JSON.stringify([
    active?.placeId || '',
    active?.serverId || '',
    active?.title || '',
    active?.thumbnail || '',
    active?.startedAt || 0,
    lastExited?.placeId || '',
    lastExited?.serverId || '',
    lastExited?.title || '',
    lastExited?.thumbnail || '',
    rebindingInviteHotkey,
    preferences.inviteHotkey,
    preferences.language,
    preferences.streamMode
  ]);
}

function renderActivityNowPlayingCard() {
  const active = currentPlayingInviteState();
  const lastExited = !active ? getLastExitedSession() : null;
  lastActivityNowPlayingSignature = activityNowPlayingSignature(active, lastExited);
  const hotkeyText = rebindingInviteHotkey
    ? t('activity.nowPlaying.pressKeys')
    : formatInviteHotkey(preferences.inviteHotkey);
  const hotkeyButton = `<div class="activity-invite-hotkey">
      <span class="activity-invite-hotkey-label">${icon('keyboard', 14)} ${t('activity.nowPlaying.hotkeyLabel')}</span>
      <button type="button" class="control-button activity-hotkey-trigger ${rebindingInviteHotkey ? 'is-recording' : ''}"
        data-library-action="rebind-invite-hotkey" aria-pressed="${rebindingInviteHotkey}"
        data-tooltip="${escapeHtml(t('activity.nowPlaying.hotkeyHint'))}">
        <kbd>${escapeHtml(hotkeyText)}</kbd>
        <span>${t(rebindingInviteHotkey ? 'common.cancel' : 'activity.nowPlaying.changeHotkey')}</span>
      </button>
    </div>`;
  if (!active && lastExited) {
    const showLastServer = lastExited.serverId && !preferences.streamMode;
    return `<section class="library-panel activity-now-playing is-exited" id="activity-now-playing">
      <div class="activity-now-main">
        <button type="button" class="library-game-link activity-now-game" data-action="open-details" data-id="${escapeHtml(lastExited.placeId)}">
          ${libraryArt(lastExited.game)}
          <span>
            <span class="activity-now-topline">
              <span class="activity-now-badge">${icon('history', 13)} ${t('activity.nowPlaying.lastExitedBadge')}</span>
              ${showLastServer ? `<span class="library-server" data-tooltip="${escapeHtml(lastExited.serverId)}">${t('library.server')} ${escapeHtml(lastExited.serverId.slice(0, 8))}</span>` : ''}
            </span>
            <strong>${escapeHtml(lastExited.title)}</strong>
          </span>
        </button>
      </div>
      <div class="activity-now-actions">
        ${hotkeyButton}
        <button type="button" class="control-button activity-copy-invite" data-library-action="copy-last-invite">
          ${icon('link', 14)} ${t('activity.nowPlaying.copyInvite')}
        </button>
        ${lastExited.serverId
          ? `<button type="button" class="primary-button activity-rejoin-server" data-library-action="rejoin-last-server">${icon('rotate', 14)} ${t('activity.nowPlaying.rejoinExited')}</button>`
          : `<button type="button" class="primary-button" data-action="play" data-id="${escapeHtml(lastExited.placeId)}">${icon('play', 14)} ${t('card.play')}</button>`}
      </div>
    </section>`;
  }
  if (!active) {
    return `<section class="library-panel activity-now-playing is-idle" id="activity-now-playing">
      <div class="activity-now-main">
        <span class="library-art activity-now-art">${icon('gamepad', 20)}</span>
        <div class="activity-now-copy">
          <div class="activity-now-topline">
            <span class="activity-now-badge">${icon('pulse', 13)} ${t('activity.nowPlaying.title')}</span>
          </div>
          <strong>${t('activity.nowPlaying.idleTitle')}</strong>
          <p>${t('activity.nowPlaying.idleHint')}</p>
        </div>
      </div>
      <div class="activity-now-actions">
        ${hotkeyButton}
        <button type="button" class="primary-button activity-copy-invite" data-library-action="copy-active-invite" disabled
          data-tooltip="${escapeHtml(t('activity.nowPlaying.notInGame'))}">
          ${icon('link', 14)} ${t('activity.nowPlaying.copyInvite')}
        </button>
      </div>
    </section>`;
  }
  const showServer = active.serverId && !preferences.streamMode;
  return `<section class="library-panel activity-now-playing is-live" id="activity-now-playing">
    <div class="activity-now-main">
      <button type="button" class="library-game-link activity-now-game" data-action="open-details" data-id="${escapeHtml(active.placeId)}">
        ${libraryArt(active.game)}
        <span>
          <span class="activity-now-topline">
            <span class="activity-now-badge is-live"><i class="activity-now-dot" aria-hidden="true"></i>${t('activity.nowPlaying.live')}</span>
            <span class="activity-now-clock" data-activity-now-duration data-started-at="${active.startedAt}">${formatNowPlayingClock(active.startedAt)}</span>
            ${showServer ? `<span class="library-server" data-tooltip="${escapeHtml(active.serverId)}">${t('library.server')} ${escapeHtml(active.serverId.slice(0, 8))}</span>`
              : !preferences.streamMode ? `<small class="activity-now-connecting">${t('activity.nowPlaying.connecting')}</small>` : ''}
          </span>
          <strong>${escapeHtml(active.title)}</strong>
        </span>
      </button>
    </div>
    <div class="activity-now-actions">
      ${hotkeyButton}
      <button type="button" class="control-button activity-rejoin-server" data-library-action="rejoin-active-server" ${active.serverId ? '' : 'disabled'}>
        ${icon('rotate', 14)} ${t('activity.nowPlaying.rejoinSame')}
      </button>
      <button type="button" class="primary-button activity-copy-invite" data-library-action="copy-active-invite">
        ${icon('link', 14)} ${t('activity.nowPlaying.copyInvite')}
      </button>
    </div>
  </section>`;
}

function updateActivityNowPlayingCard(force = false) {
  const node = document.getElementById('activity-now-playing');
  if (!node) return;
  const signature = activityNowPlayingSignature();
  if (!force && signature === lastActivityNowPlayingSignature) {
    tickActivityNowPlayingClock();
    return;
  }
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderActivityNowPlayingCard();
  const next = wrapper.firstElementChild;
  if (next) node.replaceWith(next);
}

function tickActivityNowPlayingClock() {
  if (document.hidden) return;
  const clock = document.querySelector('[data-activity-now-duration]');
  if (!clock) return;
  const startedAt = Number(clock.dataset.startedAt);
  if (startedAt > 0) clock.textContent = formatNowPlayingClock(startedAt);
}
window.setInterval(tickActivityNowPlayingClock, 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tickActivityNowPlayingClock();
});

function normalizeKeyTokenFromEvent(event) {
  const code = String(event.code || '');
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  const allowed = [
    'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown',
    'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash',
    'Semicolon', 'Quote', 'Backquote', 'Comma', 'Period', 'Slash'
  ];
  if (allowed.includes(code)) return code;
  const key = String(event.key || '');
  if (/^[a-zA-Z0-9]$/.test(key)) return key.toUpperCase();
  if (/^F([1-9]|1[0-2])$/i.test(key)) return key.toUpperCase();
  return '';
}

function hotkeySpecFromEvent(event) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return '';
  const token = normalizeKeyTokenFromEvent(event);
  if (!token) return '';
  const parts = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  const isFunctionOrNav = /^(F([1-9]|1[0-2])|Insert|Delete|Home|End|PageUp|PageDown)$/.test(token);
  if (!parts.length && !isFunctionOrNav) return '';
  parts.push(token);
  return parts.join('+');
}

document.addEventListener('keydown', event => {
  if (rebindingInviteHotkey) {
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      rebindingInviteHotkey = false;
      updateActivityNowPlayingCard();
      return;
    }
    const spec = hotkeySpecFromEvent(event);
    if (!spec) return;
    rebindingInviteHotkey = false;
    preferences.inviteHotkey = spec;
    savePreferences();
    updateActivityNowPlayingCard();
    showToast(t('activity.nowPlaying.hotkeySaved', { hotkey: formatInviteHotkey(spec) }));
    return;
  }
  if (event.repeat || event.defaultPrevented) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
  const configured = String(preferences.inviteHotkey || 'Alt+C').trim();
  if (!configured) return;
  const pressed = hotkeySpecFromEvent(event);
  if (pressed && pressed.toLowerCase() === configured.toLowerCase()) {
    event.preventDefault();
    void copyActiveServerInviteLink();
  }
}, true);

function libraryPeriodRange(period = libraryPeriod, offset = libraryPeriodOffset) {
  const today = activityDateKey();
  if (period === 'all') {
    return { from: Object.keys(activityData.days).sort()[0] || today, to: today };
  }
  const date = activityLocalDate(today);
  if (period === 'week') {
    const monday = shiftActivityDate(today, 7 * offset - (date.getDay() + 6) % 7);
    return { from: monday, to: shiftActivityDate(monday, 6) };
  }
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = period === 'month' ? new Date(year, month + offset, 1) : new Date(year + offset, 0, 1);
  const end = period === 'month' ? new Date(year, month + offset + 1, 0) : new Date(year + offset, 11, 31);
  return { from: activityDateKey(start), to: activityDateKey(end) };
}

function libraryRangeLabel(range) {
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(preferences.language, options)
    .formatRange(activityLocalDate(range.from), activityLocalDate(range.to));
}

function showLibraryActivityPane(pane) {
  libraryActivityPane = pane;
  if (pane === 'history') journalStatus = 'idle';
  if (currentView !== 'activity') setView('activity');
  else renderPage();
  focusLibraryControl('[data-library-action="activity-pane"][aria-pressed="true"]');
}

function renderLibraryActivity() {
  const tabs = `<div class="library-toolbar library-activity-tabs"><div class="library-tools" role="group" aria-label="${t('nav.activity')}">
    ${[['overview', 'library.overview', 'chartBars'], ['history', 'library.history', 'clock']].map(([id, label, glyph]) =>
      `<button type="button" class="filter-chip" data-library-action="activity-pane" data-id="${id}" aria-pressed="${libraryActivityPane === id}">${icon(glyph, 14)} ${t(label)}</button>`).join('')}
    </div><div class="library-tools">
      <label class="library-check"><input type="checkbox" data-library-select="record-history" ${preferences.saveHistory ? 'checked' : ''}> ${t('library.recordHistory')}</label>
      ${libraryAction('export-csv', 'library.csv', 'fileDown')}
    </div></div>`;
  return tabs + renderActivityNowPlayingCard() + (libraryActivityPane === 'overview' ? renderLibraryActivityDashboard() + renderActivity() : `<div class="library-history">
    ${renderSessionJournal()}
    <aside class="library-history-aside">${renderLibraryAchievementPreview()}
      <section class="library-panel library-recap"><h2>${t('library.yearRecap')}</h2>
        <p>${t('library.recapHint')}</p>${libraryAction('year-recap', 'library.viewRecap', 'calendar')}</section>
    </aside></div>`);
}

function refreshLibraryDashboard(row) {
  if (!row) {
    dashboardJournalRevision += 1;
    dashboardRange = null;
    dashboardRows = null;
  } else if (dashboardRange && dashboardRows) {
    if (row.startedAt < dashboardRange.until && row.seenAt >= dashboardRange.from) {
      const index = dashboardRows.findIndex(item => item.key === row.key);
      if (index >= 0) dashboardRows[index] = row;
      else {
        dashboardRows.push(row);
        dashboardRows.sort((a, b) => b.startedAt - a.startedAt);
      }
    }
  } else if (dashboardRequest) {
    dashboardJournalRevision += 1;
  }
  recentJournalKey = null;
  if (currentView === 'recent') {
    void loadLibraryRecent(uniqueRecentIds(recentGames));
  } else if (currentView === 'activity' && libraryActivityPane === 'overview') {
    if (dashboardRows) paintLibraryDashboardRows();
    else void loadLibraryDashboardRows();
  }
}

function dashboardJournalRange() {
  const current = libraryPeriodRange();
  const previous = libraryPeriod === 'all' ? current : libraryPeriodRange(libraryPeriod, libraryPeriodOffset - 1);
  return {
    from: activityLocalDate(previous.from).getTime(),
    until: activityLocalDate(shiftActivityDate(current.to, 1)).getTime()
  };
}

function matchesDashboardRange(first, second) {
  return first?.from === second.from && first?.until === second.until;
}

function paintLibraryDashboardRows() {
  if (currentView !== 'activity' || libraryActivityPane !== 'overview') return;
  const content = document.querySelector('#library-dashboard [data-library-dashboard-content]');
  if (content) content.innerHTML = libraryDashboardContent();
}

async function loadLibraryDashboardRows() {
  const range = dashboardJournalRange();
  if (matchesDashboardRange(dashboardRange, range)) return;
  dashboardRows = null;
  dashboardRange = null;
  if (dashboardRequest && matchesDashboardRange(dashboardRequest.range, range)) return;
  const request = { range, revision: dashboardJournalRevision };
  dashboardRequest = request;
  let rows;
  try { rows = await sessionJournal.overlapping(range.from, range.until); }
  catch { rows = []; }
  if (dashboardRequest === request) {
    dashboardRequest = null;
    if (request.revision !== dashboardJournalRevision || !matchesDashboardRange(range, dashboardJournalRange())) {
      if (currentView === 'activity' && libraryActivityPane === 'overview') void loadLibraryDashboardRows();
      return;
    }
    dashboardRange = range;
    dashboardRows = rows;
    paintLibraryDashboardRows();
  }
}

function libraryDayTotals(range) {
  return Object.entries(activityData.days).filter(([key]) => key >= range.from && key <= range.to);
}

function libraryRankedGames(days) {
  const totals = Object.create(null);
  for (const [, day] of days) for (const [id, seconds] of Object.entries(day.games || {})) {
    totals[id] = (totals[id] || 0) + seconds;
  }
  return [...groupedPlaytime(totals, playtimeForView().gamesById).values()].sort((a, b) => b.seconds - a.seconds);
}

function libraryRowsInRange(rows, range) {
  const start = activityLocalDate(range.from).getTime();
  const end = activityLocalDate(shiftActivityDate(range.to, 1)).getTime();
  return rows.filter(row => row.startedAt >= start && row.startedAt < end);
}

function libraryHeatmap(rows, range) {
  const start = activityLocalDate(range.from).getTime();
  const end = activityLocalDate(shiftActivityDate(range.to, 1)).getTime();
  const heat = Array(28).fill(0);
  for (const row of rows) {
    if (row.startedAt >= end || row.seenAt <= start) continue;
    const intervals = row.intervals || (row.trackedMs === row.seenAt - row.startedAt ? [[row.startedAt, row.seenAt]] : []);
    for (const [from, to] of intervals) {
      let at = Math.max(from, start);
      const until = Math.min(to, end);
      while (at < until) {
        const time = new Date(at);
        const period = Math.floor(time.getHours() / 6);
        const day = (time.getDay() + 6) % 7;
        time.setHours(6 * (period + 1), 0, 0, 0);
        const next = Math.min(time.getTime(), until);
        heat[day * 4 + period] += next - at;
        at = next;
      }
    }
  }
  return heat;
}

function libraryChartBuckets(range, period, days, rows) {
  const months = period === 'year' || period === 'all';
  const bucketKey = key => months ? key.slice(0, 7) + '-01' : key;
  const totals = new Map();
  const add = (key, amount) => totals.set(bucketKey(key), (totals.get(bucketKey(key)) || 0) + amount);
  if (libraryChartMetric === 'sessions') {
    for (const row of rows) add(activityDateKey(row.startedAt), 1);
  } else {
    for (const [date, day] of days) add(date, Object.values(day.games || {}).reduce((sum, seconds) => sum + seconds, 0));
  }
  const dateFormat = new Intl.DateTimeFormat(preferences.language, months
    ? { month: 'short', year: period === 'all' ? '2-digit' : undefined }
    : period === 'week' ? { weekday: 'short' } : { day: 'numeric' });
  const next = key => {
    if (!months) return shiftActivityDate(key, 1);
    const date = activityLocalDate(key);
    date.setMonth(date.getMonth() + 1);
    return activityDateKey(date);
  };
  const entries = [];
  for (let key = bucketKey(range.from); key <= bucketKey(range.to); key = next(key)) {
    entries.push({ key, label: dateFormat.format(activityLocalDate(key)), value: totals.get(key) || 0 });
  }
  return entries;
}

function renderLibraryChart(current, previous) {
  const peak = Math.max(1, ...current.map(point => point.value), ...previous.map(point => point.value));
  const duration = value => libraryChartMetric === 'hours' ? activityDuration(value) : String(value);
  const dateFormat = new Intl.DateTimeFormat(preferences.language, { dateStyle: 'medium' });
  const step = current.length > 14 ? Math.ceil(current.length / 10) : 1;
  return `<section class="library-panel library-chart"><div class="library-panel-heading">
    <h2>${t(libraryPeriod === 'year' || libraryPeriod === 'all' ? 'library.byMonth' : 'library.byDay')}</h2>
    <div class="library-tools">${[['hours', 'library.hours'], ['sessions', 'library.sessions']].map(([id, label]) =>
      `<button type="button" class="filter-chip" data-library-action="chart-metric" data-id="${id}" aria-pressed="${libraryChartMetric === id}">${t(label)}</button>`).join('')}
      ${libraryPeriod !== 'all' ? `<button type="button" class="filter-chip" data-library-action="chart-compare" aria-pressed="${libraryCompare}">${t('library.compare')}</button>` : ''}
    </div></div>
    <div class="library-chart-series" style="--chart-columns:${current.length}" data-dense="${current.length > 14}">
      ${current.map(({ key, label, value }, index) => {
        const comparison = previous[index];
        const date = dateFormat.format(activityLocalDate(key));
        const name = escapeHtml(date + ' · ' + duration(value) + (comparison ? ' · ' + t('library.previous') + ' ' + duration(comparison.value) : ''));
        return `<div class="library-chart-point" data-tooltip="${name}" aria-label="${name}">
          <div class="library-chart-bars">${comparison ? `<i class="library-chart-previous" style="--level:${comparison.value / peak * 100}%"></i>` : ''}
          <i style="--level:${value / peak * 100}%"></i></div>
          <small>${index % step === 0 ? label : '&nbsp;'}</small></div>`;
      }).join('')}
    </div></section>`;
}

function renderLibraryHeatmap(heat) {
  const max = Math.max(1, ...heat);
  const periods = ['night', 'morning', 'day', 'evening'].map(key => t('library.' + key));
  const fmt = new Intl.DateTimeFormat(preferences.language, { weekday: 'short' });
  const cells = heat.map((value, index) => {
    const day = fmt.format(new Date(2024, 0, 1 + Math.floor(index / 4)));
    const label = escapeHtml(day + ' · ' + periods[index % 4] + ' · ' + activityDuration(value / 1000));
    const intensity = value ? Math.max(16, Math.round(value / max * 100)) : 0;
    return (index % 4 === 0 ? `<small>${day}</small>` : '') +
      `<span data-tooltip="${label}" aria-label="${label}" style="--heat:${intensity}%"></span>`;
  });
  return `<section class="library-panel library-heatmap"><h2>${t('library.heatmap')}</h2>
    <div class="library-heat-grid"><span></span>${periods.map(label => `<small>${label}</small>`).join('')}${cells.join('')}</div>
    ${!heat.some(Boolean) ? `<p>${t('library.heatmapEmpty')}</p>` : ''}</section>`;
}

function renderLibraryTopGames(list) {
  return `<section class="library-panel library-top-games"><h2>${t('library.topGames')}</h2>
    ${list.length ? `<ol>${list.slice(0, 5).map(({ id, seconds }) => {
      const game = libraryGame(id);
      return `<li><button type="button" class="library-game-link" data-action="open-details" data-id="${id}">
        ${libraryArt(game)}<span><strong>${escapeHtml(game.title)}</strong>
          <i class="library-meter"><i style="--meter:${seconds / list[0].seconds * 100}%"></i></i></span></button>
        <small>${activityDuration(seconds)}</small></li>`;
    }).join('')}</ol>` : `<p>${t('activity.summary.noGames')}</p>`}</section>`;
}

function renderLibraryGoal() {
  const week = libraryRankedGames(libraryDayTotals(libraryPeriodRange('week', 0)));
  const total = week.reduce((sum, entry) => sum + entry.seconds, 0);
  const hours = libraryHourSetting('activityWeeklyGoal', 168);
  const goal = hours * 3600;
  const percent = goal ? Math.min(100, Math.round(total / goal * 100)) : 0;
  const interval = libraryHourSetting('activityBreakHours', 24);
  return `<section class="library-panel library-goal"><div class="library-panel-heading"><h2>${t('library.goal')}</h2>
    <button type="button" class="icon-button" data-library-action="goal-settings" aria-label="${t('nav.settings')}">${icon('settings', 15)}</button></div>
    ${goal ? `<div class="library-goal-meter"><span style="--goal:${percent}%"><strong>${percent}%</strong></span>
      <p>${t('library.goalProgress', { time: activityDuration(total), goal: activityDuration(goal) })}</p></div>`
    : `<p>${t('library.goalHint')}</p>`}
    <small>${t('library.breakStatus', { value: interval ? activityDuration(interval * 3600) : t('library.off') })}</small>
    </section>`;
}

function libraryDashboardContent() {
  const range = libraryPeriodRange();
  const previous = libraryPeriod !== 'all' ? libraryPeriodRange(libraryPeriod, libraryPeriodOffset - 1) : null;
  const rows = dashboardRows || [];
  const currentRows = libraryRowsInRange(rows, range);
  const previousRows = previous ? libraryRowsInRange(rows, previous) : [];
  const days = libraryDayTotals(range);
  const previousDays = previous ? libraryDayTotals(previous) : [];
  const ranked = libraryRankedGames(days);
  const total = ranked.reduce((sum, entry) => sum + entry.seconds, 0);
  const previousTotal = libraryRankedGames(previousDays).reduce((sum, entry) => sum + entry.seconds, 0);
  const duration = currentRows.reduce((sum, row) => sum + row.trackedMs, 0);
  const longest = currentRows.reduce((best, row) => !best || row.trackedMs > best.trackedMs ? row : best, null);
  const distance = activityDayDistance(activityData.streak.lastCompletedDate, activityDateKey());
  const streak = distance <= 1 || activityRecoveryAvailable() ? activityData.streak.current : 0;
  const difference = total - previousTotal;
  const metrics = [
    ['library.playtime', activityDuration(total), previous ? (difference >= 0 ? '+' : '−') + activityDuration(Math.abs(difference)) + ' · ' + t('library.previous') : ''],
    ['library.sessions', dashboardRows ? currentRows.length : '—', previousRows.length ? (currentRows.length - previousRows.length >= 0 ? '+' : '') + (currentRows.length - previousRows.length) + ' · ' + t('library.previous') : ''],
    ['library.average', currentRows.length ? activityDuration(duration / currentRows.length / 1000) : '—', ''],
    ['library.longest', longest ? activityDuration(longest.trackedMs / 1000) : '—', longest ? getGame(longest.gameId)?.title || longest.title : ''],
    ['library.streak', activityDays(streak), t('activity.bestStreak', { count: activityData.streak.best })]
  ];
  return `<div class="library-dashboard-metrics">${metrics.map(([label, value, detail]) => `<section class="library-panel library-metric">
      <h2>${t(label)}</h2><strong>${value}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</section>`).join('')}</div>
    <div class="library-dashboard-grid">
      ${renderLibraryChart(libraryChartBuckets(range, libraryPeriod, days, currentRows),
        libraryCompare && previous ? libraryChartBuckets(previous, libraryPeriod, previousDays, previousRows) : [])}
      ${renderLibraryHeatmap(libraryHeatmap(rows, range))}
      <div class="library-dashboard-aside">${renderLibraryGoal()}${renderLibraryTopGames(ranked)}</div>
    </div>`;
}

function renderLibraryActivityDashboard() {
  void loadLibraryDashboardRows();
  const range = libraryPeriodRange();
  return `<section id="library-dashboard">
    <div class="library-toolbar"><div class="library-tools" role="group" aria-label="${t('activity.summary.period')}">${libraryPeriods.map(id =>
      `<button type="button" class="filter-chip" data-library-action="dashboard-period" data-id="${id}" aria-pressed="${id === libraryPeriod}">${t('library.period.' + id)}</button>`).join('')}</div>
      ${libraryPeriod !== 'all' ? `<div class="library-date-step">
        <button type="button" class="icon-button" data-library-action="period-step" data-id="-1" aria-label="${t('library.previous')}">${icon('chevronLeft', 14)}</button>
        <span>${escapeHtml(libraryRangeLabel(range))}</span>
        <button type="button" class="icon-button" data-library-action="period-step" data-id="1" aria-label="${t('library.next')}" ${libraryPeriodOffset === 0 ? 'disabled' : ''}>${icon('chevronRight', 14)}</button>
      </div>` : ''}</div>
    <div data-library-dashboard-content>${libraryDashboardContent()}</div>
    </section>`;
}

function renderLibraryAchievementPreview() {
  const metrics = activityMetrics();
  if (updateActivityAchievements(metrics)) persistActivityData();
  const sorted = ACTIVITY_ACHIEVEMENTS.map(entry => ({
    ...entry, value: Math.min(entry.target, metrics[entry.metric]), earned: Boolean(activityData.achievements[entry.id])
  })).sort((a, b) => Number(a.earned) - Number(b.earned) || b.value / b.target - a.value / a.target);
  const latest = [...sorted].filter(entry => entry.earned)
    .sort((a, b) => String(activityData.achievements[b.id]).localeCompare(String(activityData.achievements[a.id])))[0];
  const goals = [...sorted.filter(entry => !entry.earned).slice(0, latest ? 3 : 4), ...(latest ? [latest] : [])];
  return `<section class="library-panel library-achievements"><h2>${t('activity.achievementsTitle')}</h2>
    <ul>${goals.map(({ name, value, target, earned, icon: glyph }) =>
      `<li><div><strong>${icon(glyph, 14)} ${t('activity.achievement.' + name)}</strong><small>${earned ? t('activity.earned') : value + ' / ' + target}</small></div>
        <p>${t('activity.achievement.' + name + 'Body')}</p>
        <span class="library-meter" data-earned="${earned}"><i style="--meter:${earned ? 100 : value / target * 100}%"></i></span></li>`).join('')}</ul>
    ${libraryAction('all-achievements', 'library.allAchievements', 'trophy')}</section>`;
}

function libraryHourSetting(key, max) {
  return Math.max(0, Math.min(max, Number(preferences[key]) || 0));
}

function checkLibraryBreakReminder(interval) {
  const hours = libraryHourSetting('activityBreakHours', 24);
  if (!hours || !runtimeSessionKey) return;
  if (breakReminderSession !== runtimeSessionKey) {
    breakReminderSession = runtimeSessionKey;
    breakReminderCount = 0;
    breakReminderElapsed = 0;
  }
  breakReminderElapsed += interval;
  const threshold = hours * 3600000;
  const count = Math.floor(breakReminderElapsed / threshold);
  if (count <= breakReminderCount) return;
  breakReminderCount = count;
  if (document.visibilityState === 'visible' && document.hasFocus()) showToast(t('library.breakMessage'));
  else if (window.__TAURI__) void window.vortexDesktop?.notifyBreak?.(t('library.breakTitle'), t('library.breakMessage')).catch(() => {});
}

let overlayNotifiedFriendsSession = '';
const overlayNotifiedFriends = new Set();

function observeLibraryFriends() {
  const server = validSessionServer(recordingSession?.serverId) || validSessionServer(gameOverlaySession?.serverId);
  const username = String(preferences.robloxUsername || '').trim();
  const wantOverlayNotice = Boolean(preferences.gameOverlay && preferences.gameOverlayFriendJoin !== false);
  if (!server || (!preferences.saveHistory && !wantOverlayNotice) || !username) return;
  const sessionKey = recordingSession?.key || runtimeSessionKey || (playSessionGameId + '/' + server);
  if (overlayNotifiedFriendsSession !== sessionKey) {
    overlayNotifiedFriendsSession = sessionKey;
    overlayNotifiedFriends.clear();
  }
  const age = Date.now() - friendsCache.at;
  if (age > FRIENDS_TTL) {
    if (Date.now() - libraryPresenceRequestedAt > 60000 && !friendsLoading) {
      libraryPresenceRequestedAt = Date.now();
      void (async () => {
        const enabled = preferences.friendsNoticeAccepted ||
          (await window.vortexDesktop?.getPresenceStatus().catch(() => null))?.enabled;
        if (enabled && (recordingSession?.key === sessionKey || runtimeSessionKey === sessionKey) && username === String(preferences.robloxUsername || '').trim()) {
          await loadFriends(username);
          observeLibraryFriends();
        }
      })();
    }
    return;
  }
  const sessionStart = Number(recordingSession?.startedAt || gameOverlaySession?.startedAt || playSessionStart) || 0;
  if (!friendsCache.data?.ok || friendsCache.at < sessionStart) return;
  const matches = cleanSessionFriends(friendsCache.data.friends
    .filter(friend => friend.presence === 'playing' && validSessionServer(friend.gameId) === server)
    .map(friend => ({ id: friend.id, name: friend.displayName || friend.name, avatar: friend.avatar })));
  if (wantOverlayNotice) {
    for (const friend of matches) {
      if (!overlayNotifiedFriends.has(friend.id)) {
        overlayNotifiedFriends.add(friend.id);
        const friendLabel = friend.name || friend.id;
        void window.vortexDesktop?.notifyGameOverlay?.(t('overlay.friendJoinedHud', { friend: friendLabel })).catch(() => {});
      }
    }
  }
  if (recordingSession && preferences.saveHistory) {
    const seen = new Set(recordingSession.friends.map(friend => friend.id));
    const additions = matches.filter(friend => !seen.has(friend.id));
    if (additions.length) {
      recordingSession.friends.push(...additions);
      writeJournalInterval(runtimeConfirmedAt, runtimeConfirmedAt);
    }
  }
}
let libraryPresenceRequestedAt = 0;

async function clearLibrarySessions() {
  const previous = recordingSession;
  recordingSession = null;
  try { await sessionJournal.clear(); } catch (error) {
    if (previous && !recordingSession && playSessionGameId === previous.gameId) recordingSession = previous;
    throw error;
  }
  journalRows = [];
  recentJournalRows = [];
  refreshLibraryDashboard();
  await loadJournalRows();
}

async function exportLibraryCsv(button) {
  button.disabled = true;
  try {
    const range = libraryActivityPane === 'history' ? journalQuery() : null;
    const rows = range?.empty ? [] : await sessionJournal.recent(Infinity, range?.range, range?.matches);
    const filtered = range ? rows : libraryRowsInRange(rows, libraryPeriodRange());
    const csvCell = value => {
      const text = String(value ?? '');
      return '"' + (/^[=+\-@\t\r\n]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
    };
    const head = ['Started at', 'Ended at', 'Place ID', 'Game', 'Tracked seconds', 'Server', 'Friends'];
    const records = filtered.map(row => [
      new Date(row.startedAt).toISOString(), row.endedAt ? new Date(row.endedAt).toISOString() : '',
      row.gameId, getGame(row.gameId)?.title || row.title, Math.floor(row.trackedMs / 1000),
      preferences.streamMode ? '' : row.serverId, preferences.streamMode ? '' : (row.friends || []).map(friend => friend.name || friend.id).join(', ')
    ]);
    const contents = '\ufeff' + [head, ...records].map(row => row.map(csvCell).join(',')).join('\r\n');
    if (await window.vortexDesktop.saveShareFile({ filename: 'vortex-sessions-' + activityDateKey() + '.csv', contents })) showToast(t('tools.fileSaved'));
  } catch { showToast(t('activity.journal.exportError')); }
  finally { button.disabled = false; }
}

async function openLibraryRecap(year = new Date().getFullYear()) {
  const days = Object.keys(activityData.days).map(key => Number(key.slice(0, 4))).filter(Number.isFinite);
  const rows = await sessionJournal.recent(Infinity).catch(() => []);
  const years = [...new Set([new Date().getFullYear(), ...days, ...rows.map(row => new Date(row.startedAt).getFullYear())])].sort((a, b) => b - a);
  if (!years.includes(year)) year = years[0];
  const range = { from: year + '-01-01', to: year + '-12-31' };
  const current = libraryRowsInRange(rows, range);
  const ranked = libraryRankedGames(libraryDayTotals(range));
  const total = ranked.reduce((sum, entry) => sum + entry.seconds, 0);
  const longest = current.reduce((best, row) => Math.max(best, row.trackedMs), 0);
  const qualified = Object.keys(activityData.days).filter(date => date >= range.from && date <= range.to).sort()
    .filter(date => activityQualifiedGames(date).length >= ACTIVITY_DAILY_GAMES);
  let best = 0;
  let streak = 0;
  let previous = '';
  for (const date of qualified) {
    streak = activityDayDistance(previous, date) === 1 ? streak + 1 : 1;
    best = Math.max(best, streak);
    previous = date;
  }
  const friends = new Map();
  if (!preferences.streamMode) for (const row of current) for (const friend of row.friends || []) {
    friends.set(friend.id, { ...friend, count: (friends.get(friend.id)?.count || 0) + 1 });
  }
  const topFriend = [...friends.values()].sort((a, b) => b.count - a.count)[0];
  openLauncherDialog(t('library.yearRecap'), `<div class="launcher-dialog-form">
    ${librarySelect('recap-year', 'library.period.year', years.map(value => [String(value), String(value)]), String(year))}
    <dl class="library-recap-metrics">
      ${[['library.playtime', activityDuration(total)], ['library.sessions', current.length], ['library.longest', longest ? activityDuration(longest / 1000) : '—'],
        ['library.streak', activityDays(best)], ...topFriend ? [['library.topFriend', (topFriend.name || topFriend.id) + ' · ' + topFriend.count]] : []]
        .map(([label, value]) => `<div><dt>${t(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}
    </dl>${renderLibraryTopGames(ranked)}</div>`);
}

function handleLibraryActivityAction(action, button) {
  const id = button.dataset.id;
  switch (action) {
    case 'activity-pane': showLibraryActivityPane(id); return;
    case 'dashboard-period': libraryPeriod = id; libraryPeriodOffset = 0; break;
    case 'period-step': libraryPeriodOffset = Math.min(0, libraryPeriodOffset + Number(id)); break;
    case 'chart-metric': libraryChartMetric = id; break;
    case 'chart-compare': libraryCompare = !libraryCompare; break;
    case 'journal-friends': journalFriendsOnly = !journalFriendsOnly; break;
    case 'journal-hour': journalHourOnly = !journalHourOnly; break;
    case 'export-csv': void exportLibraryCsv(button); return;
    case 'copy-active-invite': void copyActiveServerInviteLink(); return;
    case 'copy-last-invite': {
      const last = getLastExitedSession();
      if (last) void copyServerInviteUrl(last.placeId, last.serverId);
      else showToast(t('activity.nowPlaying.notInGame'));
      return;
    }
    case 'rejoin-active-server':
      if (typeof triggerServerRejoin === 'function') void triggerServerRejoin(currentPlayingInviteState());
      return;
    case 'rejoin-last-server': {
      const last = getLastExitedSession();
      if (last && typeof triggerServerRejoin === 'function') void triggerServerRejoin(last);
      else if (last) void openGame(last.placeId, last.serverId);
      else showToast(t('hotkeys.rejoin.noServer'));
      return;
    }
    case 'copy-session-invite': void copyServerInviteUrl(button.dataset.id, button.dataset.server); return;
    case 'rebind-invite-hotkey':
      rebindingInviteHotkey = !rebindingInviteHotkey;
      updateActivityNowPlayingCard();
      document.querySelector('[data-library-action="rebind-invite-hotkey"]')?.focus({ preventScroll: true });
      return;
    case 'year-recap': void openLibraryRecap(); return;
    case 'all-achievements': openLauncherDialog(t('activity.achievementsTitle'), renderAchievements(activityMetrics())); return;
    case 'goal-settings':
      openLauncherDialog(t('library.goalSettings'), `<form class="launcher-dialog-form" id="library-goal-form">
        <label>${t('library.goalHours')}<input name="goal" type="number" min="0" max="168" step=".5" value="${libraryHourSetting('activityWeeklyGoal', 168)}"></label>
        <label>${t('library.breakHours')}<input name="break" type="number" min="0" max="24" step=".25" value="${libraryHourSetting('activityBreakHours', 24)}"></label>
        <p>${t('library.zeroDisables')}</p><button class="primary-button" type="submit">${t('common.save')}</button></form>`);
      return;
    default: return;
  }
  if (action.startsWith('journal-')) resetLibraryJournal();
  renderPage();
  focusLibraryControl(`[data-library-action="${action}"]${id ? `[data-id="${id}"]` : ''}`);
}

function resetLibraryJournal() {
  journalLimit = activityJournalPage;
  journalRows = [];
  journalStatus = 'idle';
  ++journalRead;
}

function handleLibraryActivitySelect(key, value) {
  if (key === 'record-history') {
    preferences.saveHistory = document.querySelector('[data-library-select="record-history"]')?.checked === true;
    if (!preferences.saveHistory) stopJournalRecording();
    else if (playSessionGameId && runtimeSessionKey && !recordingSession && !runtimeSample?.unknown) {
      const start = Math.max(Date.now(), playSessionStart || 0);
      recordingSession = { key: playSessionGameId + '/' + start, gameId: playSessionGameId, startedAt: start,
        serverId: validSessionServer(runtimeSample?.serverId), friends: [] };
      writeJournalInterval(start, start);
    }
    savePreferences();
  } else if (key === 'journal-period') {
    journalQuickPeriod = value;
    journalDate = '';
    resetLibraryJournal();
  } else if (key === 'recap-year') {
    void openLibraryRecap(Number(value));
    return false;
  } else return false;
  return true;
}

document.addEventListener('submit', event => {
  if (event.target.id !== 'library-goal-form') return;
  event.preventDefault();
  const data = new FormData(event.target);
  preferences.activityWeeklyGoal = Math.max(0, Math.min(168, Number(data.get('goal')) || 0));
  preferences.activityBreakHours = Math.max(0, Math.min(24, Number(data.get('break')) || 0));
  savePreferences();
  launcherDialog.close();
  renderPage();
  focusLibraryControl('[data-library-action="goal-settings"]');
});
