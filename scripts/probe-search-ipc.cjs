// Temporary diagnostic: runs the workspace app in dev mode with the real main process and
// checks what the Roblox search IPC handler actually returns.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('host-resolver-rules', 'MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1');
const output = path.join(__dirname, '..', 'dist-update-test', 'logs', 'search-ipc.json');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, '..', 'electron', 'preload.cjs') }
  });
  const load = window.loadFile(path.join(__dirname, '..', 'index.html'));
  await Promise.race([load.catch(() => {}), wait(6000)]);
  await wait(2000);

  const result = await window.webContents.executeJavaScript(`(async () => {
    const response = await window.vortexDesktop.searchGames({ query: 'blox fruits' });
    const items = (response?.items || []).slice(0, 3).map((item) => ({
      id: item.id,
      title: item.title,
      creator: item.creator,
      genre: item.genre,
      descriptionLength: String(item.description || '').length,
      description: String(item.description || '').slice(0, 120),
      thumbnail: String(item.thumbnail || '').slice(0, 60),
      playerCount: item.playerCount
    }));
    return { count: (response?.items || []).length, items };
  })()`).catch((error) => ({ error: error.message }));

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(result, null, 2), 'utf8');
  console.log('RESULT:', JSON.stringify(result));
  app.exit(0);
});
