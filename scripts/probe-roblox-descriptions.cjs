// Temporary diagnostic: connects to the real running app over CDP and calls the real
// games:search handler to verify descriptions now come from the Roblox games API.
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');

const electronExe = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
const appRoot = path.join(__dirname, '..');
const port = 9331;

async function waitFor(fn, attempts = 30, delayMs = 500) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await fn()) return true;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

const child = spawn(electronExe, ['.', `--remote-debugging-port=${port}`], {
  cwd: appRoot,
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' },
  stdio: 'ignore',
  detached: false
});

async function main() {
  const version = await fetch(`http://127.0.0.1:${port}/json/version`);
  const versionInfo = await version.json();
  const webSocketDebuggerUrl = versionInfo.webSocketDebuggerUrl;
  console.log('CDP connected:', Boolean(webSocketDebuggerUrl));

  // Find the renderer target.
  let target;
  const found = await waitFor(async () => {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = list.find((item) => item.type === 'page' && item.url.includes('index.html'));
    return Boolean(target);
  });
  if (!found) { console.log('renderer target not found'); process.exit(1); }
  console.log('renderer:', target.url);

  const { WebSocket } = await import('node:ws').catch(() => ({})).then((m) => m) || {};
  let ws;
  try {
    const wsModule = require('ws');
    ws = new wsModule(target.webSocketDebuggerUrl);
  } catch {
    console.log('ws module missing, falling back to raw socket');
    process.exit(2);
  }

  await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
  let messageId = 0;
  const pending = new Map();
  ws.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++messageId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Runtime.enable');
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    return response.result?.result?.value ?? response.result;
  };

  await new Promise((resolve) => setTimeout(resolve, 3000));
  const result = await evaluate(`(async () => {
    const snapshot = localStorage.getItem('vortex.preferences');
    const response = await window.vortexDesktop.searchGames({ query: 'Blox Fruits' });
    const items = (response?.items || []).slice(0, 3).map((item) => ({
      title: item.title,
      description: String(item.description || '').slice(0, 70),
      descriptionLength: String(item.description || '').length,
      creator: item.creator,
      playerCount: item.playerCount,
      thumbnail: Boolean(item.thumbnail)
    }));
    if (snapshot !== null) localStorage.setItem('vortex.preferences', snapshot);
    return items;
  })()`);
  console.log('REAL SEARCH:', JSON.stringify(result, null, 2));

  const discover = await evaluate(`(async () => {
    const response = await window.vortexDesktop.discoverGames({ sortId: '' });
    return (response?.items || []).slice(0, 3).map((item) => ({
      title: item.title,
      descriptionLength: String(item.description || '').length,
      description: String(item.description || '').slice(0, 60)
    }));
  })()`);
  console.log('REAL DISCOVER:', JSON.stringify(discover, null, 2));

  ws.close();
  child.kill();
  process.exit(0);
}

main().catch(async (error) => {
  console.log('ERROR:', error.message);
  child.kill();
  process.exit(1);
});
