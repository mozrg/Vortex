const activityPeriods = { week: 7, month: 30, year: 365 };
let activityPeriod = 'week';
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
      <strong title="${escapeHtml(title)}">${escapeHtml(title)}</strong>
    </div>
    ${summary.leader ? `<span class="activity-summary-duration">${activityDuration(summary.leader.seconds)}</span>` : ''}
  </div>`;
}

function activitySummaryContent(today) {
  const count = activityPeriods[activityPeriod];
  const start = shiftActivityDate(today, 1 - count);
  const { gamesById } = playtimeForView();
  const current = summarizeActivity(start, today, gamesById);
  const previous = summarizeActivity(shiftActivityDate(start, -count), shiftActivityDate(start, -1), gamesById);
  const change = current.total - previous.total;
  const changeLabel = !previous.total ? 'noPrevious' : change === 0 ? 'same' : change > 0 ? 'more' : 'less';
  const ranges = new Intl.DateTimeFormat(preferences.language, { day: 'numeric', month: 'short', year: count === 365 ? 'numeric' : undefined });
  return `<header class="settings-card-head activity-overview-head">
    <h2>${t('activity.summary.title')}</h2>
    <div class="activity-periods" role="group" aria-label="${t('activity.summary.period')}">
      ${Object.entries(activityPeriods).map(([period, days]) => `<button type="button"
        data-action="activity-period" data-activity-control="period-${period}" data-period="${period}"
        aria-pressed="${period === activityPeriod}" title="${t('activity.summary.days', { count: days })}">${t('activity.summary.' + period)}</button>`).join('')}
    </div>
  </header>
  <div class="activity-summary-body">
    <div class="activity-summary-total"><div><small>${t('activity.summary.total')}</small><strong>${activityDuration(current.total)}</strong></div>
      <div class="activity-summary-comparison">
        ${previous.total ? `<span>${t('activity.summary.previousTotal', { time: activityDuration(previous.total) })}</span>` : ''}
        <span>${t('activity.summary.' + changeLabel, { time: activityDuration(Math.abs(change)) })}</span>
      </div></div>
    ${summaryLeader(current, 'activity.summary.leader', ranges, gamesById)}
    ${summaryLeader(previous, 'activity.summary.previousLeader', ranges, gamesById)}
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
      data-action="activity-calendar-day" data-activity-control="day-${date}" aria-label="${label}" title="${label}"
      aria-pressed="${date === journalDate}" ${date === today ? 'aria-current="date"' : ''} ${date > today ? 'disabled' : ''}
      tabindex="${date === tabDate ? 0 : -1}">${index + 1}</button>`;
  }).join('');
  return `<header class="settings-card-head"><h2>${t('activity.calendar.title')}</h2>${icon('calendar', 18)}</header>
    <div class="activity-calendar-nav"><strong id="activity-calendar-month">${monthLabel}</strong>
      <div>
        <button type="button" class="ghost-button" data-action="activity-calendar-month" data-activity-control="month-prev" data-step="-1"
          aria-label="${t('activity.calendar.prev')}" title="${t('activity.calendar.prev')}">${icon('chevronLeft', 15)}</button>
        <button type="button" class="ghost-button" data-action="activity-calendar-month" data-activity-control="month-next" data-step="1"
          aria-label="${t('activity.calendar.next')}" title="${t('activity.calendar.next')}" ${today.startsWith(month) ? 'disabled' : ''}>${icon('chevronRight', 15)}</button>
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
        title="${t('activity.calendar.level' + level)}"></span>`).join('')}</div>
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
    case 'activity-period':
      if (!Object.hasOwn(activityPeriods, button.dataset.period) || activityPeriod === button.dataset.period) return true;
      activityPeriod = button.dataset.period;
      document.getElementById('activity-summary').innerHTML = activitySummaryContent(today);
      focusActivityControl(button.dataset.activityControl);
      return true;
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
      filterJournalByDate(date);
      calendar.innerHTML = activityCalendarContent(today);
      focusActivityControl(button.dataset.activityControl);
      return true;
    }
    case 'activity-calendar-clear':
      filterJournalByDate('');
      calendar.innerHTML = activityCalendarContent(today);
      calendar.querySelector('.activity-calendar-day[tabindex="0"]')?.focus();
      return true;
    case 'activity-calendar-journal':
      document.getElementById('activity-journal-filter').scrollIntoView({ block: 'center' });
      focusActivityControl('journal-clear');
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
