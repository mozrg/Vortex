let activityCalendarMonth = '';
let activityCalendarTabDate = '';

function activityLocalDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function activityDuration(seconds) {
  return seconds > 0 && seconds < 60
    ? t('activity.journal.seconds', { count: Math.floor(seconds) })
    : formatActivityMinutes(seconds);
}

function summarizeActivity(from, to, gamesById) {
  const byPlace = Object.create(null);
  for (let day = from; day <= to; day = shiftActivityDate(day, 1)) {
    for (const [id, value] of Object.entries(activityData.days[day]?.games || {})) {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) byPlace[id] = (byPlace[id] || 0) + seconds;
    }
  }
  let total = 0;
  let leader = null;
  for (const entry of groupedPlaytime(byPlace, gamesById).values()) {
    total += entry.seconds;
    if (!leader || entry.seconds > leader.seconds) leader = entry;
  }
  return { from, to, total, leader };
}

function summaryLeader(summary, label, ranges, gamesById) {
  const game = gamesById.get(summary.leader?.id);
  const art = safeThumbnail(game?.thumbnail);
  const title = summary.leader
    ? game?.title || t('activity.unknownGame') + ' #' + summary.leader.id
    : t('activity.summary.noGames');
  return `<div class="activity-summary-row">
    <span class="journal-art">${art ? `<img src="${escapeHtml(art)}" alt="" loading="lazy">` : icon('gamepad', 17)}</span>
    <div class="activity-summary-game">
      <small>${t(label)} · ${ranges.formatRange(activityLocalDate(summary.from), activityLocalDate(summary.to))}</small>
      <strong data-tooltip="${escapeHtml(title)}">${escapeHtml(title)}</strong>
    </div>
    ${summary.leader ? `<span class="activity-summary-duration">${activityDuration(summary.leader.seconds)}</span>` : ''}
  </div>`;
}

function activitySummaryContent() {
  const range = libraryPeriodRange();
  const { gamesById } = playtimeForView();
  const current = summarizeActivity(range.from, range.to, gamesById);
  const priorRange = libraryPeriod === 'all' ? null : libraryPeriodRange(libraryPeriod, libraryPeriodOffset - 1);
  const previous = priorRange ? summarizeActivity(priorRange.from, priorRange.to, gamesById) : null;
  const change = current.total - (previous?.total || 0);
  const changeLabel = !previous?.total ? 'noPrevious' : change === 0 ? 'same' : change > 0 ? 'more' : 'less';
  const ranges = new Intl.DateTimeFormat(preferences.language, { day: 'numeric', month: 'short', year: libraryPeriod === 'year' || libraryPeriod === 'all' ? 'numeric' : undefined });
  return `<header class="settings-card-head activity-overview-head">
    <h2>${t('activity.summary.title')}</h2>
  </header>
  <div class="activity-summary-body">
    <div class="activity-summary-total"><div><small>${t('activity.summary.total')}</small><strong>${activityDuration(current.total)}</strong></div>
      ${previous ? `<div class="activity-summary-comparison">
        ${previous.total ? `<span>${t('activity.summary.previousTotal', { time: activityDuration(previous.total) })}</span>` : ''}
        <span>${t('activity.summary.' + changeLabel, { time: activityDuration(Math.abs(change)) })}</span>
      </div>` : ''}</div>
    ${summaryLeader(current, 'activity.summary.leader', ranges, gamesById)}
    ${previous ? summaryLeader(previous, 'activity.summary.previousLeader', ranges, gamesById) : ''}
  </div>`;
}

function activityCalendarContent(today) {
  const month = activityCalendarMonth || today.slice(0, 7);
  const firstDay = month + '-01';
  const cursor = activityLocalDate(firstDay);
  const leading = (cursor.getDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat(preferences.language, { month: 'long', year: 'numeric' }).format(cursor);
  cursor.setMonth(cursor.getMonth() + 1, 0);
  const lastDay = cursor.getDate();
  const weekday = new Intl.DateTimeFormat(preferences.language, { weekday: 'short' });
  const spokenDate = new Intl.DateTimeFormat(preferences.language, { dateStyle: 'full' });
  const tabDate = activityCalendarTabDate.startsWith(month) ? activityCalendarTabDate
    : today.startsWith(month) ? today : firstDay;
  const labels = Array.from({length: 7}, (_, index) =>
    `<span class="activity-weekday">${weekday.format(activityLocalDate(shiftActivityDate(firstDay, index - leading)))}</span>`).join('');
  const cells = Array.from({length: lastDay}, (_, index) => {
    const date = month + '-' + String(index + 1).padStart(2, '0');
    const total = Object.values(activityData.days[date]?.games || {}).reduce((sum, value) => {
      const seconds = Number(value);
      return Number.isFinite(seconds) && seconds > 0 ? sum + seconds : sum;
    }, 0);
    const label = escapeHtml(spokenDate.format(activityLocalDate(date)) + ' · ' + activityDuration(total));
    const level = total >= 7200 ? 3 : total >= 1800 ? 2 : total > 0 ? 1 : 0;
    return `<button type="button" class="activity-calendar-day" data-level="${level}" data-date="${date}"
      data-action="activity-calendar-day" data-activity-control="day-${date}" aria-label="${label}" data-tooltip="${label}"
      aria-pressed="${date === journalDate}" ${date === today ? 'aria-current="date"' : ''} ${date > today ? 'disabled' : ''}
      tabindex="${date === tabDate ? 0 : -1}">${index + 1}</button>`;
  }).join('');
  return `<header class="settings-card-head"><h2>${t('activity.calendar.title')}</h2>${icon('calendar', 18)}</header>
    <div class="activity-calendar-nav"><strong id="activity-calendar-month">${monthLabel}</strong>
      <div>
        <button type="button" class="ghost-button" data-action="activity-calendar-month" data-activity-control="month-prev" data-step="-1"
          aria-label="${t('activity.calendar.prev')}" data-tooltip="${t('activity.calendar.prev')}">${icon('chevronLeft', 15)}</button>
        <button type="button" class="ghost-button" data-action="activity-calendar-month" data-activity-control="month-next" data-step="1"
          aria-label="${t('activity.calendar.next')}" data-tooltip="${t('activity.calendar.next')}" ${today.startsWith(month) ? 'disabled' : ''}>${icon('chevronRight', 15)}</button>
      </div>
    </div>
    <div class="activity-calendar-grid" role="group" aria-labelledby="activity-calendar-month">
      ${labels}${'<span aria-hidden="true"></span>'.repeat(leading)}${cells}
    </div>
    <div class="activity-calendar-footer">
      ${journalDate ? `<button type="button" class="activity-journal-jump" data-action="activity-calendar-journal"
        data-activity-control="journal-jump">${t('activity.calendar.showJournal')} ${icon('navDown', 12)}</button>`
        : `<small>${t('activity.calendar.hint')}</small>`}
      <div class="activity-calendar-legend">${[0, 1, 2, 3].map(level => `<span data-level="${level}"
        data-tooltip="${t('activity.calendar.level' + level)}"></span>`).join('')}</div>
    </div>`;
}

function focusActivityControl(key) {
  if (!key) return;
  document.querySelector(`[data-activity-control="${CSS.escape(key)}"]:not(:disabled)`)?.focus({ preventScroll: true });
}

function handleActivityOverviewAction(button) {
  const today = activityDateKey();
  const calendar = document.getElementById('activity-calendar');
  switch (button.dataset.action) {
    case 'activity-calendar-month': {
      const first = activityLocalDate((activityCalendarMonth || today.slice(0, 7)) + '-01');
      first.setMonth(first.getMonth() + Number(button.dataset.step));
      const month = activityDateKey(first).slice(0, 7);
      activityCalendarMonth = month === today.slice(0, 7) ? '' : month;
      activityCalendarTabDate = '';
      calendar.innerHTML = activityCalendarContent(today);
      focusActivityControl(activityCalendarMonth ? button.dataset.activityControl : 'month-prev');
      return true;
    }
    case 'activity-calendar-day': {
      activityCalendarTabDate = button.dataset.date;
      const date = journalDate === activityCalendarTabDate ? '' : activityCalendarTabDate;
      journalDate = date;
      calendar.innerHTML = activityCalendarContent(today);
      focusActivityControl(button.dataset.activityControl);
      return true;
    }
    case 'activity-calendar-clear':
      filterJournalByDate('');
      return true;
    case 'activity-calendar-journal':
      journalQuickPeriod = 'all';
      journalFilters = { query: '', from: '', to: '', min: '', max: '' };
      journalFriendsOnly = false;
      journalHourOnly = false;
      resetLibraryJournal();
      showLibraryActivityPane('history');
      return true;
    default:
      return false;
  }
}

document.addEventListener('keydown', event => {
  const day = event.target.closest?.('.activity-calendar-day');
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
  if (!day || !step || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  event.preventDefault();
  const date = shiftActivityDate(day.dataset.date, step);
  const next = day.parentElement.querySelector(`[data-date="${date}"]:not(:disabled)`);
  if (!next) return;
  day.tabIndex = -1;
  next.tabIndex = 0;
  activityCalendarTabDate = date;
  next.focus();
});
