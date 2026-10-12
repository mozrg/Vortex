const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vortexStartup', {
  getUpdateState: () => ipcRenderer.invoke('updates:get-state'),
  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('updates:state', listener);
    return () => ipcRenderer.removeListener('updates:state', listener);
  }
});
