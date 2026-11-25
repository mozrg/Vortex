const playClockVersion = 1;
const maxRuntimeGapMs = 90000;

function activityDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftActivityDate(dateKey, days) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date = new Date(year, month - 1, day + days, 12);
  return activityDateKey(date.getTime());
}

function activityDayDistance(fromKey, toKey) {
  if (!fromKey || !toKey) return Infinity;
  const toUtc = (key) => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(toKey) - toUtc(fromKey)) / 86400000);
}

function normalizeActivityData(value) {
  const data = value && typeof value === 'object' ? value : {};
  return {
    clockVersion: Number(data.clockVersion) || 0,
    confirmedThrough: Number.isSafeInteger(data.confirmedThrough) ? data.confirmedThrough : 0,
    legacyTime: data.legacyTime || null,
    days: data.days && typeof data.days === 'object' ? data.days : {},
    streak: { current: 0, best: 0, lastCompletedDate: '', recoveryUsed: false, ...data.streak },
    achievements: data.achievements && typeof data.achievements === 'object' ? data.achievements : {}
  };
}

function addActivitySeconds(days, key, id, seconds) {
  const day = days[key] ||= { games: {} };
  day.games ||= {};
  day.games[id] = (Number(day.games[id]) || 0) + seconds;
}

function activityClockIsValid(data) {
  if (data.clockVersion !== playClockVersion) return false;
  return Object.entries(data.days).every(([key, day]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    const start = activityLocalDate(key).getTime();
    const next = activityLocalDate(shiftActivityDate(key, 1)).getTime();
    const times = Object.values(day?.games || {});
    return activityDateKey(start) === key && times.every(seconds => Number.isSafeInteger(seconds) && seconds >= 0)
      && times.reduce((total, seconds) => total + seconds, 0) <= (next - start) / 1000;
  });
}

function activitySlices(from, through, add) {
  while (from < through) {
    const date = activityDateKey(from);
    const end = Math.min(through, activityLocalDate(shiftActivityDate(date, 1)).getTime());
    if (!(end > from)) break;
    add(date, end - from);
    from = end;
  }
}

function rebuildActivityClock(data, stats, sessions) {
  const days = {};
  let confirmedThrough = 0;
  for (const row of [...sessions].sort((a, b) => a.startedAt - b.startedAt || a.seenAt - b.seenAt)) {
    const { startedAt, seenAt, trackedMs, gameId } = row;
    if (!/^\d{1,20}$/.test(gameId) || !Number.isSafeInteger(startedAt) ||
        !Number.isSafeInteger(seenAt) || seenAt > Date.now() || !Number.isSafeInteger(trackedMs)) continue;
    const span = seenAt - startedAt;
    if (!(trackedMs > 0 && trackedMs <= span)) continue;
    let lastEnd = startedAt;
    let intervalTime = 0;
    const exact = Array.isArray(row.intervals) && row.intervals.every(interval => {
      if (!Array.isArray(interval)) return false;
      const [from, to] = interval;
      if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < lastEnd || to <= from || to > seenAt) return false;
      lastEnd = to;
      intervalTime += to - from;
      return true;
    }) && intervalTime === trackedMs;
    if (exact) {
      let carry = 0;
      for (const [from, to] of row.intervals) {
        activitySlices(Math.max(confirmedThrough, from), to, (date, slice) => {
          const seconds = Math.floor((carry + slice) / 1000);
          carry = (carry + slice) % 1000;
          if (seconds > 0) addActivitySeconds(days, date, gameId, seconds);
        });
      }
    } else if (span - trackedMs < 26 * 3600000) {
      activitySlices(Math.max(confirmedThrough, startedAt), seenAt, (date, slice) => {
        // The old journal stored the duration, but not the position of gaps
        // within a session. Recover only time that must fall on this date.
        const seconds = Math.floor((slice - (span - trackedMs)) / 1000);
        if (seconds > 0) addActivitySeconds(days, date, gameId, seconds);
      });
    }
    confirmedThrough = Math.max(confirmedThrough, seenAt);
  }
  const oldTotals = Object.fromEntries(Object.entries(stats)
    .filter(([, entry]) => Number(entry?.seconds) > 0)
    .map(([id, entry]) => [id, entry.seconds]));
  const hasOldTime = Object.keys(data.days).length || Object.keys(oldTotals).length;
  return {
    ...data, days, confirmedThrough, clockVersion: playClockVersion,
    legacyTime: data.legacyTime || (hasOldTime ? { days: data.days, totals: oldTotals } : null)
  };
}

function synchronizePlayStats(stats, days) {
  stats ||= {};
  const totals = new Map();
  for (const day of Object.values(days)) {
    for (const [id, value] of Object.entries(day?.games || {})) {
      const seconds = Number(value);
      if (/^\d{1,20}$/.test(id) && Number.isFinite(seconds) && seconds > 0) {
        totals.set(id, (totals.get(id) || 0) + seconds);
      }
    }
  }
  const entries = Object.entries(stats).filter(([id]) => /^\d{1,20}$/.test(id))
    .map(([id, entry]) => [id, { ...entry, seconds: totals.get(id) || 0 }]);
  for (const [id, seconds] of totals) {
    if (!Object.hasOwn(stats, id)) entries.push([id, { seconds, launches: 0, lastPlayed: 0 }]);
  }
  return Object.fromEntries(entries);
}

function runtimeIntervalIsContinuous(previous, current) {
  if (!previous || previous.unknown || current.unknown) return false;
  const elapsed = current.at - previous.at;
  if (!(elapsed >= 0 && elapsed <= maxRuntimeGapMs)) return false;
  // Windows' awake clock excludes sleep. Check both directions because the
  // wall clock can also be advanced or turned back while Windows is awake.
  if (previous.awake === null || current.awake === null) return true;
  const awake = current.awake - previous.awake;
  return awake >= 0 && Math.abs(elapsed - awake) <= 2000;
}
