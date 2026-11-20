const ACTIVITY_ACHIEVEMENTS = [
  // Existing IDs are part of the backup format.
  ['first-day', 'sparkle', 'first', 'streak', 1],
  ['three-day-streak', 'activity', 'three', 'streak', 3],
  ['seven-day-streak', 'trophy', 'seven', 'streak', 7],
  ['two-weeks', 'sun', 'fortnight', 'streak', 14],
  ['thirty-day-streak', 'award', 'bright', 'streak', 30],
  ['first-world', 'door', 'arrival', 'worlds', 1],
  ['five-games', 'compass', 'explorer', 'worlds', 5],
  ['fifteen-worlds', 'rocket', 'atlas', 'worlds', 15],
  ['one-hour', 'clock', 'hour', 'hours', 1],
  ['ten-hours', 'clock', 'hours', 'hours', 10],
  ['fifty-hours', 'star', 'veteran', 'hours', 50],
  ['home-world', 'home', 'home', 'worldHours', 5],
  ['three-in-a-day', 'grid', 'tour', 'dailyWorlds', 3],
  ['return-five-days', 'rotate', 'regular', 'returnDays', 5],
  ['seven-active-days', 'flag', 'visitor', 'days', 7],
  ['thirty-active-days', 'mountain', 'season', 'days', 30],
  ['sixty-day-streak', 'sun', 'emberKeeper', 'streak', 60],
  ['hundred-day-streak', 'sparkles', 'auroraKeeper', 'streak', 100],
  ['fifty-worlds', 'compass', 'wanderer', 'worlds', 50],
  ['hundred-hours', 'trophy', 'centuryHours', 'hours', 100],
  ['twenty-hours-world', 'gamepad', 'favoriteWorld', 'worldHours', 20],
  ['four-in-a-day', 'grid', 'fourWorlds', 'dailyWorlds', 4],
  ['return-fourteen-days', 'rotate', 'twoWeekRegular', 'returnDays', 14],
  ['two-hour-day', 'clock', 'longDay', 'dayHours', 2]
].map(([id, icon, name, metric, target]) => ({ id, icon, name, metric, target }));

function activityMetrics() {
  const { totals, gamesById } = playtimeForView();
  const played = [...totals.values()].filter(game => game.seconds > 0);
  const metrics = {
    streak: Number(activityData.streak.best) || 0, worlds: played.length,
    hours: Math.floor(played.reduce((sum, game) => sum + game.seconds, 0) / 3600),
    worldHours: Math.floor(played.reduce((best, game) => Math.max(best, game.seconds), 0) / 3600),
    dailyWorlds: 0, returnDays: 0, days: 0, dayHours: 0
  };
  const visits = new Map();
  for (const day of Object.values(activityData.days)) {
    const games = groupedPlaytime(day?.games, gamesById);
    let dailyWorlds = 0;
    let daySeconds = 0;
    for (const [key, game] of games) {
      if (!game.seconds) continue;
      daySeconds += game.seconds;
      const days = (visits.get(key) || 0) + 1;
      visits.set(key, days);
      metrics.returnDays = Math.max(metrics.returnDays, days);
      if (game.seconds >= ACTIVITY_GAME_MINUTES * 60) dailyWorlds++;
    }
    if (daySeconds) metrics.days++;
    metrics.dayHours = Math.max(metrics.dayHours, Math.floor(daySeconds / 3600));
    metrics.dailyWorlds = Math.max(metrics.dailyWorlds, dailyWorlds);
  }
  return metrics;
}

function updateActivityAchievements(metrics) {
  const remaining = ACTIVITY_ACHIEVEMENTS.filter(({ id }) => !activityData.achievements[id]);
  if (!remaining.length) return false;
  metrics ??= activityMetrics();
  let changed = false;
  for (const { id, metric, target } of remaining) {
    if (metrics[metric] >= target) {
      activityData.achievements[id] = new Date().toISOString();
      changed = true;
    }
  }
  return changed;
}

function renderAchievements(metrics) {
  const earnedCount = ACTIVITY_ACHIEVEMENTS.filter(a => activityData.achievements[a.id]).length;
  const cards = ACTIVITY_ACHIEVEMENTS.map(({ id, icon: glyph, name, target, metric }) => {
    const earned = Boolean(activityData.achievements[id]);
    const value = Math.min(target, metrics[metric]);
    const progress = earned ? t('activity.earned') : value + ' / ' + target;
    return '<li class="achievement-card' + (earned ? ' is-earned' : '') + '"><span class="achievement-icon">' + icon(glyph, 18) +
      '</span><div class="achievement-copy"><strong>' + t('activity.achievement.' + name) + '</strong><small>' + t('activity.achievement.' + name + 'Body') +
      '</small><em>' + (earned ? icon('check', 12) : '') + progress + '</em></div></li>';
  }).join('');
  return '<section class="settings-card activity-achievements"><header class="settings-card-head"><h2>' + t('activity.achievementsTitle') +
    '</h2><span class="award-count">' + t('activity.earnedCount', { count: earnedCount, total: ACTIVITY_ACHIEVEMENTS.length }) +
    '</span></header><ul class="achievement-grid">' + cards + '</ul></section>';
}

const streakLevels = [[0, 'cold'], [1, 'spark'], [3, 'flame'], [7, 'bonfire'], [14, 'gold'], [30, 'blue'], [100, 'aurora']];
function activityDays(count) {
  const category = new Intl.PluralRules(preferences.language).select(count);
  return count + ' ' + t('activity.days.' + category);
}

function renderStreak(count) {
  const i = streakLevels.findLastIndex(([min]) => count >= min);
  const [start, level] = streakLevels[Math.max(0, i)];
  const next = streakLevels[i + 1];
  const progress = next ? (count - start) / (next[0] - start) * 100 : 100;
  return '<div class="streak-emblem" data-flame="' + level + '"><svg class="streak-art" viewBox="0 0 108 108" aria-hidden="true">' +
    '<defs><linearGradient id="streak-outer" x2=".26" y2="1"><stop class="streak-flare"/><stop offset="1" class="streak-base"/></linearGradient>' +
    '<linearGradient id="streak-inner" x2="0" y2="1"><stop class="streak-hot"/><stop offset="1" class="streak-flare"/></linearGradient></defs>' +
    '<circle class="streak-medallion" cx="54" cy="54" r="47"/><circle class="streak-ring" cx="54" cy="54" r="43"/>' +
    (progress > 0 ? '<circle class="streak-ring-progress" cx="54" cy="54" r="43" pathLength="100" stroke-dasharray="' +
      progress.toFixed(2) + ' 100" transform="rotate(-90 54 54)"/>' : '') +
    '<ellipse class="streak-ember-bed" cx="54" cy="81" rx="20" ry="3"/><g class="fire-shape">' +
    '<path fill="url(#streak-outer)" d="M54 81c-14 0-24-9-24-21 0-9 5-15 11-20-1 6 0 9 3 11 0-11 9-16 12-29 10 7 15 18 13 28 4-2 6-5 7-8 9 13 7 28-2 35-5 3-11 4-20 4Z"/>' +
    '<path fill="url(#streak-inner)" d="M55 79c-8 0-14-5-14-12 0-5 3-8 6-10 0 3 1 5 3 6 2-6 7-9 9-17 7 6 9 13 6 17 3-1 4-3 5-4 4 11-1 19-15 20Z"/>' +
    '<path class="fire-core" d="M55 78c-4 0-7-3-7-6 0-3 2-4 4-6l2 3c3-2 5-4 5-7 5 4 6 16-4 16Z"/></g>' +
    '<g class="fire-sparks"><path d="m30 37 1.5-3 1.4 3 3.1 1.4-3.1 1.5-1.4 3-1.5-3-3-1.5z"/><path d="m73 28 1.4-2.6 1.3 2.6 2.7 1.5-2.7 1.2-1.3 2.7-1.4-2.7-2.6-1.2z"/><circle cx="80" cy="49" r="1.3"/></g></svg>' +
    '<div class="streak-caption"><span class="streak-level">' + t('activity.flame.' + level) + '</span><strong>' +
    t('activity.streakLength', { days: activityDays(count) }) + '</strong><small>' + t('activity.bestStreak', { count: activityData.streak.best }) + '</small>' +
    (next ? '<small>' + t('activity.nextFlame', { level: t('activity.flame.' + next[1]), days: activityDays(next[0]) }) + '</small>' : '') + '</div></div>';
}

const activityJournalPage = 6;
let journalLimit = activityJournalPage;
let journalDate = '';
let journalRows = [];
let journalStatus = 'idle';
let journalRead = 0;
let recordingSession = null;

function stopJournalRecording() {
  if (!recordingSession) return;
  const from = Math.max(playSessionStart, activityData.confirmedThrough);
  writeJournalInterval(from, runtimeConfirmedAt, true);
  recordingSession = null;
}

function writeJournalInterval(from, through, closed = false) {
  if (!recordingSession) return;
  const row = { ...recordingSession, from, through, closed,
    title: getGame(recordingSession.gameId)?.title || recordingSession.title || '' };
  sessionJournal.record(row).then(journalChanged, () => {
    journalStatus = 'error';
    paintJournal();
  });
}

function journalChanged() {
  if (currentView === 'activity') void loadJournalRows();
  else journalStatus = 'idle';
}

async function loadJournalRows() {
  const generation = ++journalRead;
  journalStatus = 'loading';
  try {
    const { empty, range, matches } = journalQuery();
    const rows = empty ? [] : await sessionJournal.recent(journalLimit, range, matches);
    if (generation !== journalRead) return;
    journalRows = rows;
    journalStatus = 'ready';
  } catch {
    if (generation !== journalRead) return;
    journalStatus = 'error';
  }
  paintJournal();
}

function filterJournalByDate(date) {
  journalDate = date;
  journalLimit = activityJournalPage;
  journalRows = [];
  document.getElementById('activity-journal-filter').innerHTML = journalFilter();
  void loadJournalRows();
  paintJournal();
}

function journalFilter() {
  if (!journalDate) return '';
  const date = new Intl.DateTimeFormat(preferences.language, { dateStyle: 'long' }).format(activityLocalDate(journalDate));
  return `<div class="journal-filter"><span role="status">${t('activity.journal.startedOn', { date })}</span>
    <button type="button" class="ghost-button" data-action="activity-calendar-clear" data-activity-control="journal-clear">${t('activity.journal.all')}</button>
  </div>`;
}

function paintJournal() {
  const panel = document.getElementById('activity-journal-body');
  if (!panel) return;
  const focusAction = panel.contains(document.activeElement) && document.activeElement.dataset.action;
  panel.innerHTML = journalContent();
  if (focusAction) (panel.querySelector('button') || panel).focus({ preventScroll: true });
}

function journalDuration(row, active) {
  const pending = active ? Math.max(0, runtimeConfirmedAt - Math.max(row.seenAt, playSessionStart, activityData.confirmedThrough)) : 0;
  const seconds = Math.floor((row.trackedMs + pending) / 1000);
  return seconds ? activityDuration(seconds) : t('activity.journal.seconds', { count: 0 });
}

function tickJournalClock() {
  const clock = document.getElementById('journal-current-duration');
  const row = clock && journalRows.find(item => item.key === recordingSession?.key);
  if (row) clock.textContent = journalDuration(row, true);
}

function journalContent() {
  const rows = journalRows.slice(0, journalLimit);
  let text = '';
  if (!rows.length && journalStatus !== 'error') {
    const message = journalStatus === 'loading' ? 'activity.journal.loading'
      : Object.values(journalFilters).some(Boolean) ? 'tools.emptySessions'
      : journalDate ? 'activity.journal.dayEmpty' : preferences.saveHistory ? 'activity.journal.empty' : 'activity.journal.off';
    return '<p class="journal-empty">' + t(message) + '</p>';
  }
  const fmtDate = new Intl.DateTimeFormat(preferences.language, { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtTime = new Intl.DateTimeFormat(preferences.language, { hour: '2-digit', minute: '2-digit' });
  let dateKey = '';
  for (const row of rows) {
    const day = activityDateKey(row.startedAt);
    if (day !== dateKey) {
      if (dateKey) text += '</ul>';
      text += '<h3 class="journal-date">' + fmtDate.format(row.startedAt) + '</h3><ul class="journal-day">';
      dateKey = day;
    }
    const game = getGame(row.gameId);
    const active = recordingSession?.key === row.key && !row.endedAt && !runtimeSample?.unknown;
    const until = row.endedAt ?? row.seenAt;
    const stop = (day !== activityDateKey(until) ? fmtDate.format(until) + ' ' : '') + fmtTime.format(until);
    const period = !active && !row.endedAt ? t('activity.journal.lastSeen', { start: fmtTime.format(row.startedAt), stop })
      : fmtTime.format(row.startedAt) + ' – ' + (active ? t('activity.journal.now') : stop);
    const duration = journalDuration(row, active);
    const art = safeThumbnail(game?.thumbnail);
    text += '<li class="journal-row"><span class="journal-art">' +
      (art ? '<img src="' + escapeHtml(art) + '" alt="" loading="lazy">' : icon('gamepad', 18)) +
      '</span><span class="journal-copy"><strong>' + escapeHtml(game?.title || row.title || t('activity.unknownGame') + ' #' + row.gameId) +
      '</strong><small>' + period + '</small></span><span class="journal-duration">' +
      (active ? '<span class="journal-live">' + t('activity.journal.playing') + '</span><span id="journal-current-duration">' + duration + '</span>' : duration) + '</span></li>';
  }
  if (dateKey) text += '</ul>';
  if (journalStatus === 'error') text += '<p class="journal-empty">' + t('activity.journal.error') + '</p><button class="ghost-button" data-action="journal-retry">' + t('activity.journal.retry') + '</button>';
  else if (journalRows.length > journalLimit) text += '<button class="ghost-button journal-more" data-action="journal-more">' + t('activity.journal.more') + '</button>';
  return text;
}

function renderSessionJournal() {
  if (journalStatus === 'idle') void loadJournalRows();
  return '<section class="settings-card activity-journal"><header class="settings-card-head"><div><h2>' + t('activity.journal.title') +
    '</h2><p>' + t('activity.journal.hint') + '</p></div>' + icon('history', 18) + '</header>' + renderJournalFilters() +
    '<div id="activity-journal-filter">' + journalFilter() +
    '</div><div id="activity-journal-body" tabindex="-1">' +
    journalContent() + '</div></section>';
}
