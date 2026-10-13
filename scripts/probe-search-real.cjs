// Temporary diagnostic: runs the real app main process (workspace copy) with a hidden
// window and calls the real games:search IPC to verify description enrichment.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('host-resolver-rules', 'MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1');

// Use a scratch userData so the real profile is untouched.
app.setPath('userData', path.join(__dirname, '..', 'dist-update-test', 'probe-userdata'));
app.setPath('sessionData', path.join(__dirname, '..', 'dist-update-test', 'probe-userdata'));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  // Load the real main handlers by requiring the app's main entry's handler
  // registration indirectly: instead run the actual main module.
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, '..', 'electron', 'preload.cjs') }
  });
  await window.loadURL('about:blank');
  const result = await window.webContents.executeJavaScript(`(async () => {
    const response = await window.vortexDesktop.searchGames({ query: 'Blox Fruits' });
    return (response?.items || []).slice(0, 3).map((item) => ({
      title: item.title,
      description: String(item.description || '').slice(0, 60),
      hasDescription: String(item.description || '').length > 10,
      creator: item.creator,
      thumbnail: Boolean(item.thumbnail)
    }));
  })()`, true).catch((error) => ({ error: error.message }));
  console.log('SEARCH IPC:', JSON.stringify(result, null, 2));
  app.exit(0);
});
