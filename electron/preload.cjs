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
  openPrivateServerPage: (placeId) => ipcRenderer.invoke('game:private-page', placeId),
  discoverGames: (request) => ipcRenderer.invoke('games:discover', request),
  getFeaturedGames: (placeIds) => ipcRenderer.invoke('games:featured', placeIds),
  clearSearchCache: () => ipcRenderer.invoke('games:clear-cache'),
  reportRecentGames: (payload) => ipcRenderer.send('tray:recent-games', payload),
  listFriends: (username) => ipcRenderer.invoke('friends:list', { username }),
  detectRobloxAccount: () => ipcRenderer.invoke('friends:detect-account'),
  setPresenceCookie: (cookie) => ipcRenderer.invoke('friends:presence-cookie', { cookie }),
  removePresenceCookie: () => ipcRenderer.invoke('friends:presence-cookie', { remove: true }),
  getPresenceStatus: () => ipcRenderer.invoke('friends:presence-status')
});
