const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vortexDesktop', {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onWindowState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('window:state', listener);
    return () => ipcRenderer.removeListener('window:state', listener);
  },
  openGame: (placeId, gameId = '', accessCode = '') => ipcRenderer.invoke('game:open', placeId, gameId, accessCode),
  getUpdateState: () => ipcRenderer.invoke('updates:get-state'),
  retryUpdateCheck: () => ipcRenderer.invoke('updates:retry'),
  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('updates:state', listener);
    return () => ipcRenderer.removeListener('updates:state', listener);
  },
  searchGames: (request) => ipcRenderer.invoke('games:search', request),
  getGameDetails: (request) => ipcRenderer.invoke('games:details', request),
  getSimilarGames: (request) => ipcRenderer.invoke('games:similar', request),
  getPaidGames: () => ipcRenderer.invoke('games:paid'),
  getReleaseHistory: (universeId) => ipcRenderer.invoke('games:release-history', universeId),
  openExternalUrl: (url) => ipcRenderer.invoke('shell:open-external', url),
  getRobloxApiStatus: () => ipcRenderer.invoke('roblox:api-status'),
  setDiskCacheEnabled: (enabled) => ipcRenderer.invoke('cache:set-disk-enabled', enabled),
  getDiskCacheStats: () => ipcRenderer.invoke('cache:disk-stats'),
  clearDiskCache: (kind) => ipcRenderer.invoke('cache:clear-disk', kind),
  setDiscordEnabled: (enabled) => ipcRenderer.invoke('discord:set-enabled', enabled),
  getDiscordStatus: () => ipcRenderer.invoke('discord:status'),
  setDiscordActivity: (activity) => ipcRenderer.invoke('discord:set-activity', activity),
  notifyFriendPlaying: (payload) => ipcRenderer.invoke('notifications:friend-playing', payload),
  discoverGames: (request) => ipcRenderer.invoke('games:discover', request),
  getFeaturedGames: (placeIds) => ipcRenderer.invoke('games:featured', placeIds),
  clearSearchCache: () => ipcRenderer.invoke('games:clear-cache'),
  reportRecentGames: (payload) => ipcRenderer.send('tray:recent-games', payload),
  listFriends: (username) => ipcRenderer.invoke('friends:list', { username }),
  detectRobloxAccount: () => ipcRenderer.invoke('friends:detect-account'),
  setPresenceCookie: (cookie) => ipcRenderer.invoke('friends:presence-cookie', { cookie }),
  removePresenceCookie: () => ipcRenderer.invoke('friends:presence-cookie', { remove: true }),
  getPresenceStatus: () => ipcRenderer.invoke('friends:presence-status'),
  getRobloxCurrentUser: () => ipcRenderer.invoke('auth:roblox-current-user')
});
