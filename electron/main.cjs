const { app, BrowserWindow, ipcMain, shell, session, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { createHash, randomUUID } = require('node:crypto');

const CACHE_TTL = 5 * 60 * 1000;
const MIN_SPLASH_VISIBLE_MS = 1300;
const GITHUB_REPOSITORY = 'mozrg/Vortex';
const MAX_INSTALLER_BYTES = 350 * 1024 * 1024;
const responseCache = new Map();
let startupWindow = null;
let updateFilePath = null;
let updateState = { status: 'checking', progress: 0, currentVersion: app.getVersion(), latestVersion: null, releaseUrl: null };

function publicUpdateState() {
  const { status, progress, currentVersion, latestVersion, releaseUrl } = updateState;
  return { status, progress, currentVersion, latestVersion, releaseUrl };
}

function broadcastUpdateState() {
  const state = publicUpdateState();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('updates:state', state);
  }
  if (startupWindow && !startupWindow.isDestroyed()) startupWindow.webContents.send('updates:state', state);
}

function setUpdateState(changes) {
  updateState = { ...updateState, ...changes, currentVersion: app.getVersion() };
  broadcastUpdateState();
}

function numericVersion(value) {
  const match = String(value ?? '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? match.slice(1, 4).map(Number) : null;
}

function isNewerVersion(candidate, current) {
  const left = numericVersion(candidate);
  const right = numericVersion(current);
  if (!left || !right) return false;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return false;
}

function validReleaseAssetUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && url.pathname.startsWith(`/${GITHUB_REPOSITORY}/releases/download/`);
  } catch {
    return false;
  }
}

async function fetchReleaseAsset(url, timeout = 15000) {
  if (!validReleaseAssetUrl(url)) throw new Error('The release asset URL is not trusted.');
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), redirect: 'follow' });
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(finalUrl.hostname)) {
    throw new Error('The download was redirected to an untrusted host.');
  }
  if (!response.ok) throw new Error(`GitHub asset request failed (${response.status}).`);
  return response;
}

async function hashFile(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function downloadUpdate(release, version, installer, checksumAsset) {
  const checksumResponse = await fetchReleaseAsset(checksumAsset.browser_download_url);
  const checksumText = await checksumResponse.text();
  if (checksumText.length > 2048) throw new Error('The installer checksum file is too large.');
  const expectedHash = checksumText.trim().split(/\s+/)[0].toLowerCase();
  if (!/^[a-f\d]{64}$/.test(expectedHash)) throw new Error('The installer checksum is invalid.');

  const updateDirectory = path.join(app.getPath('userData'), 'updates');
  await fsp.mkdir(updateDirectory, { recursive: true });
  const fileName = `Vortex Launcher Setup ${version}.exe`;
  const finalPath = path.join(updateDirectory, fileName);
  try {
    if ((await fsp.stat(finalPath)).size === installer.size && (await hashFile(finalPath)) === expectedHash) {
      updateFilePath = finalPath;
      setUpdateState({ status: 'downloaded', progress: 100, latestVersion: version, releaseUrl: release.html_url });
      return;
    }
  } catch {
    // No verified cached installer exists; download a fresh copy below.
  }

  const response = await fetchReleaseAsset(installer.browser_download_url, 10 * 60 * 1000);
  const tempPath = path.join(updateDirectory, `${fileName}.${randomUUID()}.partial`);
  let downloaded = 0;
  let lastProgressUpdate = 0;
  const hash = createHash('sha256');
  const progressTransform = new Transform({
    transform(chunk, _encoding, callback) {
      downloaded += chunk.length;
      if (downloaded > installer.size || downloaded > MAX_INSTALLER_BYTES) {
        callback(new Error('The installer download exceeded its published size.'));
        return;
      }
      hash.update(chunk);
      const now = Date.now();
      if (now - lastProgressUpdate >= 350) {
        lastProgressUpdate = now;
        setUpdateState({ status: 'downloading', progress: Math.min(99, Math.floor((downloaded / installer.size) * 100)), latestVersion: version, releaseUrl: release.html_url });
      }
      callback(null, chunk);
    }
  });

  try {
    if (!response.body) throw new Error('GitHub did not return an installer file.');
    setUpdateState({ status: 'downloading', progress: 0, latestVersion: version, releaseUrl: release.html_url });
    await pipeline(Readable.fromWeb(response.body), progressTransform, fs.createWriteStream(tempPath, { flags: 'wx' }));
    const downloadedHash = hash.digest('hex');
    if (downloaded !== installer.size || downloadedHash !== expectedHash) throw new Error('The installer did not pass its size and checksum verification.');
    await fsp.rm(finalPath, { force: true });
    await fsp.rename(tempPath, finalPath);
    updateFilePath = finalPath;
    setUpdateState({ status: 'downloaded', progress: 100, latestVersion: version, releaseUrl: release.html_url });
  } catch (error) {
    await fsp.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function checkForUpdates() {
  if (!app.isPackaged) {
    setUpdateState({ status: 'development', progress: 0 });
    return;
  }

  setUpdateState({ status: 'checking', progress: 0, latestVersion: null, releaseUrl: null });
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Vortex-Place-Launcher' },
      signal: AbortSignal.timeout(6000)
    });
    if (response.status === 404) {
      setUpdateState({ status: 'unavailable', progress: 0 });
      return;
    }
    if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
    const release = await response.json();
    const version = String(release.tag_name ?? '').replace(/^v/i, '');
    if (!numericVersion(version)) throw new Error('The release version is invalid.');
    if (!isNewerVersion(version, app.getVersion())) {
      setUpdateState({ status: 'current', progress: 0, latestVersion: version, releaseUrl: release.html_url });
      return;
    }

    const expectedName = `Vortex Launcher Setup ${version}.exe`;
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const installer = assets.find((asset) => asset.name === expectedName && Number(asset.size) > 0 && Number(asset.size) <= MAX_INSTALLER_BYTES);
    const checksumAsset = assets.find((asset) => asset.name === `${expectedName}.sha256` && Number(asset.size) <= 2048);
    if (!release.html_url?.startsWith(`https://github.com/${GITHUB_REPOSITORY}/releases/`) || !installer?.browser_download_url || !checksumAsset?.browser_download_url) {
      throw new Error('This release is missing its installer or SHA-256 file.');
    }
    await downloadUpdate(release, version, installer, checksumAsset);
  } catch (error) {
    console.warn('Vortex update check failed:', error.message);
    setUpdateState({ status: 'error', progress: 0 });
  }
}

function createWindow() {
  const splash = new BrowserWindow({
    width: 520,
    height: 360,
    minWidth: 520,
    minHeight: 360,
    maxWidth: 520,
    maxHeight: 360,
    frame: false,
    resizable: false,
    show: false,
    backgroundColor: '#0b0c11',
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'startup-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });
  startupWindow = splash;
  splash.webContents.once('did-finish-load', () => splash.webContents.send('updates:state', publicUpdateState()));
  splash.once('closed', () => { if (startupWindow === splash) startupWindow = null; });
  // loadFile() resolving only means navigation completed; the first renderer
  // frame may still be blank. Wait until Chromium has painted the splash.
  let splashShownAt = null;
  let splashFailed = false;
  let mainReady = false;
  let startupTransitionStarted = false;
  const revealMainWindow = () => {
    if (!mainReady || startupTransitionStarted || (splashShownAt === null && !splashFailed)) return;
    startupTransitionStarted = true;
    const visibleFor = splashShownAt === null ? MIN_SPLASH_VISIBLE_MS : Date.now() - splashShownAt;
    const remaining = Math.max(0, MIN_SPLASH_VISIBLE_MS - visibleFor);
    setTimeout(() => {
      if (!window.isDestroyed()) window.show();
      if (!splash.isDestroyed()) splash.destroy();
    }, remaining);
  };

  splash.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`Splash failed to load (${errorCode}): ${errorDescription}`);
    splashFailed = true;
    revealMainWindow();
  });

  splash.once('ready-to-show', () => {
    if (startupTransitionStarted) {
      if (!splash.isDestroyed()) splash.destroy();
      return;
    }
    splashShownAt = Date.now();
    if (!splash.isDestroyed()) splash.show();
    revealMainWindow();
  });
  splash.loadFile(path.join(__dirname, '..', 'startup.html')).catch((error) => {
    console.error('Could not load the startup screen:', error);
    splashFailed = true;
    revealMainWindow();
  });

  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 900,
    minHeight: 650,
    frame: false,
    resizable: true,
    show: false,
    backgroundColor: '#0b0c10',
    title: 'Vortex — Roblox Place Launcher',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const sendWindowState = () => window.webContents.send('window:state', { isMaximized: window.isMaximized() });
  window.on('maximize', sendWindowState);
  window.on('unmaximize', sendWindowState);
  window.webContents.once('did-finish-load', sendWindowState);
  window.webContents.once('did-finish-load', () => window.webContents.send('updates:state', publicUpdateState()));
  window.once('ready-to-show', () => {
    mainReady = true;
    revealMainWindow();
  });
  window.loadFile(path.join(__dirname, '..', 'index.html'));
}

function windowFromEvent(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

ipcMain.handle('window:minimize', (event) => {
  windowFromEvent(event)?.minimize();
});

ipcMain.handle('window:toggle-maximize', (event) => {
  const window = windowFromEvent(event);
  if (!window) return false;
  if (window.isMaximized()) window.unmaximize();
  else window.maximize();
  return window.isMaximized();
});

ipcMain.handle('window:close', (event) => {
  windowFromEvent(event)?.close();
});

ipcMain.handle('updates:get-state', () => publicUpdateState());

ipcMain.handle('updates:open-installer', async () => {
  if (updateState.status !== 'downloaded' || !updateFilePath) throw new Error('No verified update installer is ready.');
  await fsp.access(updateFilePath, fs.constants.R_OK);
  const error = await shell.openPath(updateFilePath);
  if (error) throw new Error(error);
  return true;
});

async function fetchJson(url, timeout = 12000) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error(`Roblox returned ${response.status}.`);
  return response.json();
}

async function fetchCachedJson(url, timeout = 12000) {
  const cacheKey = String(url);
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await fetchJson(url, timeout);
  responseCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL });
  if (responseCache.size > 400) {
    for (const [key, entry] of responseCache) {
      if (entry.expiresAt <= Date.now() || responseCache.size > 350) responseCache.delete(key);
      if (responseCache.size <= 350) break;
    }
  }
  return value;
}

function cleanThumbnail(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'tr.rbxcdn.com' ? url.href : '';
  } catch {
    return '';
  }
}

async function getThumbnails(universeIds) {
  const ids = [...new Set(universeIds.map(String).filter((id) => /^\d{1,20}$/.test(id)))].slice(0, 150);
  if (!ids.length) return new Map();

  const batches = [];
  for (let index = 0; index < ids.length; index += 50) batches.push(ids.slice(index, index + 50));
  const results = await Promise.all(batches.map(async (batch) => {
    const url = new URL('https://thumbnails.roblox.com/v1/games/icons');
    url.searchParams.set('universeIds', batch.join(','));
    url.searchParams.set('size', '512x512');
    url.searchParams.set('format', 'Png');
    url.searchParams.set('isCircular', 'false');
    try {
      const payload = await fetchCachedJson(url, 10000);
      return (payload.data ?? []).map((item) => [String(item.targetId), cleanThumbnail(item.imageUrl)]);
    } catch {
      return [];
    }
  }));
  return new Map(results.flat());
}

function mapGame(game, thumbnail = '', launchPlaceId = game.rootPlaceId) {
  return {
    id: String(launchPlaceId ?? game.rootPlaceId ?? ''),
    universeId: String(game.id ?? game.universeId ?? ''),
    title: String(game.name ?? 'Roblox experience').slice(0, 100),
    description: String(game.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 240),
    creator: String(game.creator?.name ?? game.creatorName ?? '').slice(0, 70),
    genre: String(game.genreL1 ?? game.genre ?? '').slice(0, 50),
    playerCount: Math.max(0, Number(game.playing ?? game.playerCount) || 0),
    upVotes: Math.max(0, Number(game.upVotes ?? game.totalUpVotes) || 0),
    downVotes: Math.max(0, Number(game.downVotes ?? game.totalDownVotes) || 0),
    thumbnail: cleanThumbnail(thumbnail)
  };
}

async function getGameDetailsByUniverse(universeIds) {
  const ids = [...new Set(universeIds.map(String).filter((id) => /^\d{1,20}$/.test(id)))].slice(0, 50);
  if (!ids.length) return [];
  const url = new URL('https://games.roblox.com/v1/games');
  url.searchParams.set('universeIds', ids.join(','));
  const payload = await fetchCachedJson(url);
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const thumbnails = await getThumbnails(rows.map((row) => row.id));
  return rows.map((row) => mapGame(row, thumbnails.get(String(row.id))));
}

ipcMain.handle('game:open', async (_event, placeId) => {
  const normalizedId = String(placeId ?? '');
  if (!/^\d{5,20}$/.test(normalizedId)) throw new Error('Некорректный идентификатор игры.');

  try {
    await shell.openExternal(`roblox://placeId=${normalizedId}`);
    return 'player';
  } catch {
    await shell.openExternal(`https://www.roblox.com/games/start?placeId=${normalizedId}`);
    return 'browser';
  }
});

ipcMain.handle('games:search', async (_event, request = {}) => {
  const query = String(request.query ?? '').trim().slice(0, 100);
  if (query.length < 2) return { items: [], nextPageToken: null, sessionId: null };

  if (/^\d{5,20}$/.test(query)) {
    const placeResponse = await fetchCachedJson(`https://apis.roblox.com/universes/v1/places/${query}/universe`);
    const universeId = String(placeResponse.universeId ?? '');
    if (!/^\d{1,20}$/.test(universeId)) return { items: [], nextPageToken: null, sessionId: null };
    const games = await getGameDetailsByUniverse([universeId]);
    if (!games.length) return { items: [], nextPageToken: null, sessionId: null };
    return { items: [{ ...games[0], id: query }], nextPageToken: null, sessionId: null };
  }

  const sessionId = /^[\da-f-]{36}$/i.test(String(request.sessionId ?? '')) ? request.sessionId : randomUUID();
  const searchUrl = new URL('https://apis.roblox.com/search-api/omni-search');
  searchUrl.searchParams.set('searchQuery', query);
  searchUrl.searchParams.set('sessionId', sessionId);
  searchUrl.searchParams.set('pageType', 'all');
  if (typeof request.pageToken === 'string' && request.pageToken.length < 512) {
    searchUrl.searchParams.set('pageToken', request.pageToken);
  }

  const payload = await fetchCachedJson(searchUrl);
  const groups = Array.isArray(payload.searchResults) ? payload.searchResults : [];
  const records = groups
    .filter((group) => !group.contentGroupType || /game/i.test(String(group.contentGroupType)))
    .flatMap((group) => Array.isArray(group.contents) ? group.contents : [])
    .filter((game) => {
      const placeId = game.rootPlaceId ?? game.placeId;
      return /^\d{5,20}$/.test(String(placeId ?? '')) && /^\d{1,20}$/.test(String(game.universeId ?? '')) && Boolean(game.name);
    });

  const thumbnails = await getThumbnails(records.map((game) => game.universeId));
  const items = records.map((game) => mapGame({
    id: game.universeId,
    rootPlaceId: game.rootPlaceId ?? game.placeId,
    name: game.name,
    description: game.description,
    creatorName: game.creatorName,
    playerCount: game.playerCount,
    totalUpVotes: game.totalUpVotes,
    totalDownVotes: game.totalDownVotes
  }, thumbnails.get(String(game.universeId)), game.rootPlaceId ?? game.placeId));

  return { items, nextPageToken: payload.nextPageToken || null, sessionId };
});

ipcMain.handle('games:featured', async (_event, placeIds = []) => {
  const ids = [...new Set((Array.isArray(placeIds) ? placeIds : []).map(String).filter((id) => /^\d{5,20}$/.test(id)))].slice(0, 20);
  const universePairs = await Promise.all(ids.map(async (placeId) => {
    try {
      const result = await fetchCachedJson(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
      return [placeId, String(result.universeId ?? '')];
    } catch {
      return [placeId, ''];
    }
  }));
  const validPairs = universePairs.filter(([, universeId]) => /^\d{1,20}$/.test(universeId));
  const games = await getGameDetailsByUniverse(validPairs.map(([, universeId]) => universeId));
  const gamesByUniverse = new Map(games.map((game) => [game.universeId, game]));
  return validPairs.map(([placeId, universeId]) => {
    const game = gamesByUniverse.get(universeId);
    return game ? { ...game, id: placeId } : null;
  }).filter(Boolean);
});

ipcMain.handle('games:discover', async (_event, request = {}) => {
  const sessionId = /^[\da-f-]{36}$/i.test(String(request.sessionId ?? '')) ? request.sessionId : randomUUID();
  const requestedSortId = String(request.sortId ?? '').slice(0, 80);
  const sortsUrl = new URL('https://apis.roblox.com/explore-api/v1/get-sorts');
  sortsUrl.searchParams.set('sessionId', sessionId);
  sortsUrl.searchParams.set('device', 'computer');
  sortsUrl.searchParams.set('country', 'all');
  const payload = await fetchCachedJson(sortsUrl);
  let sorts = (Array.isArray(payload.sorts) ? payload.sorts : [])
    .filter((sort) => String(sort.contentType ?? '').toLowerCase() === 'games' && /^[\da-z_-]{2,80}$/i.test(String(sort.sortId ?? sort.id ?? '')))
    .map((sort) => ({
      id: String(sort.sortId ?? sort.id),
      title: String(sort.sortDisplayName ?? sort.name ?? 'Roblox').slice(0, 80),
      description: String(sort.topicLayoutData?.infoText ?? '').replace(/\s+/g, ' ').trim().slice(0, 180),
      games: Array.isArray(sort.games) ? sort.games : []
    }));

  const selectedSort = sorts.find((sort) => sort.id === requestedSortId) ?? sorts[0];
  if (!selectedSort) return { sessionId, sorts: [], items: [], nextSortsPageToken: payload.nextSortsPageToken ?? null };

  let sourceGames = selectedSort.games;
  if (!sourceGames.length) {
    const contentUrl = new URL('https://apis.roblox.com/explore-api/v1/get-sort-content');
    contentUrl.searchParams.set('sessionId', sessionId);
    contentUrl.searchParams.set('sortId', selectedSort.id);
    contentUrl.searchParams.set('device', 'computer');
    contentUrl.searchParams.set('country', 'all');
    const content = await fetchCachedJson(contentUrl);
    sourceGames = Array.isArray(content.games) ? content.games : [];
    selectedSort.games = sourceGames;
  }

  const validGames = sourceGames.filter((game) => /^\d{5,20}$/.test(String(game.rootPlaceId ?? '')) && /^\d{1,20}$/.test(String(game.universeId ?? '')) && Boolean(game.name));
  const thumbnails = await getThumbnails(validGames.map((game) => game.universeId));
  const items = validGames.map((game) => mapGame({
    id: game.universeId,
    rootPlaceId: game.rootPlaceId,
    name: game.name,
    description: game.description,
    creatorName: game.creatorName,
    playerCount: game.playerCount,
    totalUpVotes: game.totalUpVotes,
    totalDownVotes: game.totalDownVotes,
    genreL1: game.genreL1
  }, thumbnails.get(String(game.universeId)), game.rootPlaceId));

  return {
    sessionId,
    sorts: sorts.map(({ id, title, description }) => ({ id, title, description, count: sorts.find((sort) => sort.id === id)?.games.length ?? 0 })),
    selectedSortId: selectedSort.id,
    items,
    nextSortsPageToken: payload.nextSortsPageToken ?? null
  };
});

ipcMain.handle('games:clear-cache', async () => {
  responseCache.clear();
  await session.defaultSession.clearCache();
  return true;
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  void checkForUpdates();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
