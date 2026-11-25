function validSessionServer(value) {
  return typeof value === 'string' && serverIdPattern.test(value) && value !== '00000000-0000-0000-0000-000000000000'
    ? value.toLowerCase() : '';
}

function cleanSessionFriends(value) {
  if (!Array.isArray(value)) return [];
  return [...new Map(value.slice(0, 200).flatMap(friend => {
    const id = String(friend?.id || '');
    if (!/^\d{1,20}$/.test(id)) return [];
    return [[id, { id, name: String(friend.name || '').slice(0, 80), avatar: safeThumbnail(friend.avatar) }]];
  })).values()];
}

// One IndexedDB record per observed join. Checkpoints update that record in
// place, so a long history does not rewrite the launcher's settings or stats.
const sessionJournal = (() => {
  let connection;
  function open() {
    if (!connection) connection = new Promise((resolve, reject) => {
      const database = activeAccountProfile === 'default' ? 'vortex-session-journal' : 'vortex-session-journal-' + activeAccountProfile;
      const request = indexedDB.open(database, 2);
      request.onupgradeneeded = (event) => {
        const store = event.oldVersion === 0
          ? request.result.createObjectStore('sessions', { keyPath: 'key' })
          : request.transaction.objectStore('sessions');
        if (!store.indexNames.contains('start')) store.createIndex('start', 'startedAt');
        if (!store.indexNames.contains('seen')) store.createIndex('seen', 'seenAt');
        if (!store.indexNames.contains('game-start')) store.createIndex('game-start', ['gameId', 'startedAt']);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); connection = null; };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    }).catch(error => { connection = null; throw error; });
    return connection;
  }

  async function transaction(mode, run) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', mode);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error('Journal transaction aborted'));
      run(tx.objectStore('sessions'));
    });
  }

  async function record({ key, gameId, startedAt, title, from, through, closed, serverId, friends }) {
    let saved;
    await transaction('readwrite', store => {
      const request = store.get(key);
      request.onsuccess = () => {
        const row = request.result || { key, gameId, startedAt, title: '', trackedMs: 0, seenAt: from, endedAt: null, intervals: [] };
        // Only credit intervals confirmed by the play clock. A sleep, outage or
        // launcher restart can leave a gap between two confirmed intervals.
        const start = Math.max(row.seenAt, from);
        if (through > start) {
          row.intervals ??= row.trackedMs && row.trackedMs === row.seenAt - row.startedAt ? [[row.startedAt, row.seenAt]] : [];
          const previous = row.intervals.at(-1);
          if (previous?.[1] === start) previous[1] = through;
          else row.intervals.push([start, through]);
          row.trackedMs += through - start;
          row.seenAt = through;
        }
        if (title) row.title = title;
        if (validSessionServer(serverId)) row.serverId = validSessionServer(serverId);
        if (friends?.length) row.friends = cleanSessionFriends([...(row.friends || []), ...friends]);
        row.endedAt = closed ? row.seenAt : null;
        store.put(row);
        saved = row;
      };
    });
    return saved;
  }

  async function recent(limit, range = null, matches = null) {
    if (limit === Infinity && !matches) {
      let rows;
      await transaction('readonly', store => {
        const request = store.index('start').getAll(range);
        request.onsuccess = () => { rows = request.result; };
      });
      return rows.reverse();
    }
    const rows = [];
    await transaction('readonly', store => {
      const request = store.index('start').openCursor(range, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (!matches || matches(cursor.value)) rows.push(cursor.value);
        if (rows.length <= limit) cursor.continue();
      };
    });
    return rows;
  }

  async function overlapping(from, until) {
    if (!(from < until)) return [];
    let rows;
    await transaction('readonly', store => {
      const starts = store.index('start');
      const ends = store.index('seen');
      const startRange = IDBKeyRange.upperBound(until, true);
      const endRange = IDBKeyRange.lowerBound(from);
      const startCount = starts.count(startRange);
      const endCount = ends.count(endRange);
      endCount.onsuccess = () => {
        const request = startCount.result < endCount.result ? starts.getAll(startRange) : ends.getAll(endRange);
        request.onsuccess = () => {
          rows = request.result.filter(row => row.startedAt < until && row.seenAt >= from)
            .sort((a, b) => b.startedAt - a.startedAt);
        };
      };
    });
    return rows;
  }

  async function latestByGame(gameIds) {
    const rows = [];
    await transaction('readonly', store => {
      const index = store.index('game-start');
      for (const id of new Set(gameIds)) {
        const range = IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
        const request = index.openCursor(range, 'prev');
        request.onsuccess = () => {
          if (request.result) rows.push(request.result.value);
        };
      }
    });
    return rows.sort((a, b) => b.startedAt - a.startedAt);
  }

  function validate(rows) {
    const validTime = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;
    if (!Array.isArray(rows) || !rows.every(row => row && /^\d{1,20}$/.test(row.gameId)
      && typeof row.key === 'string' && row.key.startsWith(row.gameId + '/') && /^\d{1,20}\/\d{1,16}$/.test(row.key)
      && validTime(row.startedAt) && validTime(row.seenAt) && row.seenAt >= row.startedAt
      && Number.isSafeInteger(row.trackedMs) && row.trackedMs >= 0 && row.trackedMs <= row.seenAt - row.startedAt
      && (row.endedAt === null || row.endedAt === row.seenAt) && typeof row.title === 'string')) {
      throw new Error('Invalid session history');
    }
  }

  async function restore(rows) {
    validate(rows);
    await transaction('readwrite', store => {
      store.clear();
      for (const {key, gameId, startedAt, title, trackedMs, seenAt, endedAt, intervals, serverId, friends} of rows) {
        const clean = {key, gameId: String(gameId), startedAt, title: title.slice(0, 250), trackedMs, seenAt, endedAt,
          serverId: validSessionServer(serverId), friends: cleanSessionFriends(friends)};
        let end = startedAt;
        let total = 0;
        if (Array.isArray(intervals) && intervals.every(interval => {
          if (!Array.isArray(interval)) return false;
          const [from, to] = interval;
          if (!validTime(from) || !validTime(to) || from < end || to <= from || to > seenAt) return false;
          end = to;
          total += to - from;
          return total <= trackedMs;
        })) clean.intervals = intervals;
        store.put(clean);
      }
    });
  }
  return { record, recent, overlapping, latestByGame, validate, restore, clear: () => transaction('readwrite', store => store.clear()) };
})();
