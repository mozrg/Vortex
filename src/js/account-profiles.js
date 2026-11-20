const accountProfileKey = 'vortex.accounts';
const accountActiveKey = 'vortex.account.active';
const streamModeKey = 'vortex.streamMode';
const validAccountProfileId = id => id === 'default' || /^[0-9a-f]{32}$/.test(id);
const storedAccountProfile = localStorage.getItem(accountActiveKey);
const activeAccountProfile = validAccountProfileId(storedAccountProfile) ? storedAccountProfile : 'default';
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

function launcherAccounts() {
  try {
    const accounts = JSON.parse(localStorage.getItem(accountProfileKey) || '[]');
    return accounts.filter(account => validAccountProfileId(account.id) && account.id !== 'default' && typeof account.name === 'string');
  } catch { return []; }
}

function switchLauncherAccount(id) {
  if (id === activeAccountProfile || (id !== 'default' && !launcherAccounts().some(profile => profile.id === id))) return;
  localStorage.setItem(accountActiveKey, id);
  if (typeof bankPlaySession === 'function') bankPlaySession();
  location.reload();
}

function createLauncherAccount(username) {
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return false;
  const profiles = launcherAccounts();
  if (profiles.some(profile => profile.name.toLowerCase() === username.toLowerCase())) return false;
  const id = crypto.randomUUID().replaceAll('-', '');
  const setup = {
    ...preferences, robloxUsername: username, robloxDisplayName: '', robloxAccountId: '', robloxAvatar: '',
    friendsNoticeAccepted: false, customGames: [], quickLaunchItems: [],
    homeFeaturedGame: '', homePicks: [], settingsTab: 'integrations'
  };
  localStorage.setItem(accountStorageKey('vortex.preferences', id), JSON.stringify(setup));
  localStorage.setItem(accountProfileKey, JSON.stringify([...profiles, { id, name: username }]));
  switchLauncherAccount(id);
  return true;
}

function openAccountMenu() {
  const profiles = [{ id: 'default', name: t('tools.accountDefault') }, ...launcherAccounts()];
  openLauncherDialog(t('tools.accounts'), `
    <ul class="launcher-dialog-list">${profiles.map((profile, index) => {
      const label = preferences.streamMode ? t('tools.profileNumber', { count: index + 1 }) : profile.name;
      return `<li><button class="ghost-button" data-launcher-action="account-switch" data-id="${profile.id}"
        ${profile.id === activeAccountProfile ? 'aria-current="true" disabled' : ''}>${escapeHtml(label)}${profile.id === activeAccountProfile ? icon('check', 13) : ''}</button></li>`;
    }).join('')}</ul>
    ${preferences.streamMode ? '' : `<form data-launcher-form="account-add" class="launcher-dialog-form">
      <label>${t('tools.accountUsername')}<input name="username" required maxlength="20" pattern="[A-Za-z0-9_]{3,20}" autocomplete="off"></label>
      <button class="primary-button" type="submit">${t('tools.addProfile')}</button>
    </form>`}
    <p class="catalog-disclaimer">${t('tools.profileHint')}</p>
    <button class="ghost-button" data-launcher-action="friends-open">${icon('users', 14)} ${t('nav.friends')}</button>`);
}
