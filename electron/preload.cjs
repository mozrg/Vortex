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
  openGame: (placeId) => ipcRenderer.invoke('game:open', placeId),
  searchGames: (request) => ipcRenderer.invoke('games:search', request),
  discoverGames: (request) => ipcRenderer.invoke('games:discover', request),
  getFeaturedGames: (placeIds) => ipcRenderer.invoke('games:featured', placeIds),
  clearSearchCache: () => ipcRenderer.invoke('games:clear-cache')
});
