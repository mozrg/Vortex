// One IndexedDB record per observed join. Checkpoints update that record in
// place, so a long history does not rewrite the launcher's settings or stats.
const sessionJournal = (() => {
  let connection;
  function open() {
    if (!connection) connection = new Promise((resolve, reject) => {
      const database = activeAccountProfile === 'default' ? 'vortex-session-journal' : 'vortex-session-journal-' + activeAccountProfile;
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('sessions', { keyPath: 'key' }).createIndex('start', 'startedAt');
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

  async function record({ key, gameId, startedAt, title, from, through, closed }) {
    await transaction('readwrite', store => {
      const request = store.get(key);
      request.onsuccess = () => {
        const row = request.result || { key, gameId, startedAt, title: '', trackedMs: 0, seenAt: from, endedAt: null };
        // Only credit intervals confirmed by the play clock. A sleep, outage or
        // launcher restart can leave a gap between two confirmed intervals.
        row.trackedMs += Math.max(0, through - Math.max(row.seenAt, from));
        row.seenAt = Math.max(row.seenAt, through);
        if (title) row.title = title;
        row.endedAt = closed ? row.seenAt : null;
        store.put(row);
      };
    });
  }

  async function recent(limit, range = null, matches = () => true) {
    const rows = [];
    await transaction('readonly', store => {
      const request = store.index('start').openCursor(range, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (matches(cursor.value)) rows.push(cursor.value);
        if (rows.length <= limit) cursor.continue();
      };
    });
    return rows;
  }

  async function restore(rows) {
    const validTime = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;
    if (!Array.isArray(rows) || !rows.every(row => row && /^\d{1,20}$/.test(row.gameId)
      && typeof row.key === 'string' && row.key.startsWith(row.gameId + '/') && /^\d{1,20}\/\d{1,16}$/.test(row.key)
      && validTime(row.startedAt) && validTime(row.seenAt) && row.seenAt >= row.startedAt
      && Number.isSafeInteger(row.trackedMs) && row.trackedMs >= 0 && row.trackedMs <= row.seenAt - row.startedAt
      && (row.endedAt === null || row.endedAt === row.seenAt) && typeof row.title === 'string')) {
      throw new Error('Invalid session history');
    }
    await transaction('readwrite', store => {
      store.clear();
      for (const {key, gameId, startedAt, title, trackedMs, seenAt, endedAt} of rows) {
        store.put({key, gameId: String(gameId), startedAt, title: title.slice(0, 250), trackedMs, seenAt, endedAt});
      }
    });
  }
  return { record, recent, restore };
})();
