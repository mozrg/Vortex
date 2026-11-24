const accountActiveKey = 'vortex.account.active';
const streamModeKey = 'vortex.streamMode';
const storedAccountProfile = localStorage.getItem(accountActiveKey);
// Keep the library and encrypted presence session selected in 1.2.3.
const activeAccountProfile = /^[0-9a-f]{32}$/.test(storedAccountProfile) ? storedAccountProfile : 'default';
const accountScopedKeys = new Set([
  'vortex.preferences', 'vortex.cardAspectDefault', 'vortex.activity', 'vortex.playStats',
  'vortex.playSession', 'vortex.recent', 'vortex.recentDetails', 'vortex.favorites', 'vortex.friendPins', 'vortex.recommendationFeedback'
]);

function accountStorageKey(key, profile = activeAccountProfile) {
  return profile === 'default' || !accountScopedKeys.has(key) ? key : key + '.' + profile;
}

const DISPOSABLE_STORAGE_KEYS = [
  'vortex.featuredCache',
  'vortex.discoveryCatalog',
  'vortex.discovered',
  'vortex.catalogRankHistory'
];

function evictDisposableStorageCaches(preserveKey) {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k !== preserveKey && k.startsWith('vortex.searchCache.')) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) localStorage.removeItem(k);
    for (const k of DISPOSABLE_STORAGE_KEYS) {
      if (k !== preserveKey) localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage enumeration failures in restricted environments.
  }
}

function safeLocalStorageSet(rawKey, value) {
  try {
    localStorage.setItem(rawKey, value);
    return true;
  } catch (error) {
    const isQuota = error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014 || /quota/i.test(String(error?.message || ''));
    if (isQuota) {
      evictDisposableStorageCaches(rawKey);
      try {
        localStorage.setItem(rawKey, value);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

const accountStorage = {
  getItem: key => localStorage.getItem(accountStorageKey(key)),
  setItem: (key, value) => safeLocalStorageSet(accountStorageKey(key), value),
  removeItem: key => localStorage.removeItem(accountStorageKey(key))
};

