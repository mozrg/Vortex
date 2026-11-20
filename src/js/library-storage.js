const accountActiveKey = 'vortex.account.active';
const streamModeKey = 'vortex.streamMode';
const storedAccountProfile = localStorage.getItem(accountActiveKey);
// Keep the library and encrypted presence session selected in 1.2.3.
const activeAccountProfile = /^[0-9a-f]{32}$/.test(storedAccountProfile) ? storedAccountProfile : 'default';
const accountScopedKeys = new Set([
  'vortex.preferences', 'vortex.cardAspectDefault', 'vortex.activity', 'vortex.playStats',
  'vortex.playSession', 'vortex.recent', 'vortex.favorites', 'vortex.friendPins', 'vortex.recommendationFeedback'
]);

function accountStorageKey(key, profile = activeAccountProfile) {
  return profile === 'default' || !accountScopedKeys.has(key) ? key : key + '.' + profile;
}

const accountStorage = {
  getItem: key => localStorage.getItem(accountStorageKey(key)),
  setItem: (key, value) => localStorage.setItem(accountStorageKey(key), value),
  removeItem: key => localStorage.removeItem(accountStorageKey(key))
};

