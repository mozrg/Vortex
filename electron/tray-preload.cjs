const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vortexTray', {
  getGames: () => ipcRenderer.invoke('tray:get-games'),
  getStyle: () => ipcRenderer.invoke('tray:get-style'),
  onGames: (callback) => {
    const listener = (_event, games, style, nowPlaying) => callback(games, style, nowPlaying);
    ipcRenderer.on('tray:games', listener);
    return () => ipcRenderer.removeListener('tray:games', listener);
  },
  openApp: () => ipcRenderer.send('tray:open'),
  quitApp: () => ipcRenderer.send('tray:quit'),
  launchGame: (placeId) => ipcRenderer.send('tray:launch', placeId),
  dismiss: () => ipcRenderer.send('tray:dismiss')
});