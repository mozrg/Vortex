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
let dashboardDirty = true;
let breakReminderSession = '';
let breakReminderCount = 0;
let breakReminderElapsed = 0;

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
  return tabs + (libraryActivityPane === 'overview' ? renderLibraryActivityDashboard() + renderActivity() : `<div class="library-history">
    ${renderSessionJournal()}
    <aside class="library-history-aside">${renderLibraryAchievementPreview()}
      <section class="library-panel library-recap"><h2>${t('library.yearRecap')}</h2>
        <p>${t('library.recapHint')}</p>${libraryAction('year-recap', 'library.viewRecap', 'calendar')}</section>
    </aside></div>`);
}

function refreshLibraryDashboard() {
  dashboardDirty = true;
  recentJournalKey = null;
  if (currentView === 'recent') {
    void loadLibraryRecent(uniqueRecentIds(recentGames));
  } else if (currentView === 'activity' && libraryActivityPane === 'overview') {
    void loadLibraryDashboardRows();
  }
}

async function loadLibraryDashboardRows() {
  if (!dashboardDirty || dashboardRequest) return;
  dashboardDirty = false;
  const request = sessionJournal.recent(Infinity);
  dashboardRequest = request;
  try { dashboardRows = await request; } catch { dashboardRows = []; }
  finally {
    dashboardRequest = null;
    const panel = document.getElementById('library-dashboard');
    if (panel && libraryActivityPane === 'overview') {
      const content = panel.querySelector('[data-library-dashboard-content]');
      if (content) content.innerHTML = libraryDashboardContent();
    }
    if (dashboardDirty && currentView === 'activity' && libraryActivityPane === 'overview') void loadLibraryDashboardRows();
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
        const date = new Intl.DateTimeFormat(preferences.language, { dateStyle: 'medium' }).format(activityLocalDate(key));
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

function observeLibraryFriends() {
  const server = recordingSession?.serverId;
  const username = String(preferences.robloxUsername || '').trim();
  if (!server || !preferences.saveHistory || !username) return;
  const age = Date.now() - friendsCache.at;
  if (age > FRIENDS_TTL) {
    if (Date.now() - libraryPresenceRequestedAt > 60000 && !friendsLoading) {
      libraryPresenceRequestedAt = Date.now();
      const session = recordingSession.key;
      void (async () => {
        const enabled = preferences.friendsNoticeAccepted ||
          (await window.vortexDesktop?.getPresenceStatus().catch(() => null))?.enabled;
        if (enabled && recordingSession?.key === session && username === String(preferences.robloxUsername || '').trim()) {
          await loadFriends(username);
          if (recordingSession?.key === session) observeLibraryFriends();
        }
      })();
    }
    return;
  }
  if (!friendsCache.data?.ok || friendsCache.at < recordingSession.startedAt) return;
  const seen = new Set(recordingSession.friends.map(friend => friend.id));
  const matches = cleanSessionFriends(friendsCache.data.friends
    .filter(friend => friend.presence === 'playing' && validSessionServer(friend.gameId) === server)
    .map(friend => ({ id: friend.id, name: friend.displayName || friend.name, avatar: friend.avatar })));
  const additions = matches.filter(friend => !seen.has(friend.id));
  if (additions.length) {
    recordingSession.friends.push(...additions);
    writeJournalInterval(runtimeConfirmedAt, runtimeConfirmedAt);
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
  dashboardRows = [];
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
