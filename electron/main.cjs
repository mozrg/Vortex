const { app, BrowserWindow, ipcMain, shell, session, Menu, Tray, nativeImage, screen, safeStorage, Notification } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { createHash, randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const net = require('node:net');
const gotSingleInstanceLock = app.requestSingleInstanceLock();
// Dev escape hatch: VORTEX_REMOTE_DEBUGGING=9222 opens a CDP port for UI tests.
if (process.env.VORTEX_REMOTE_DEBUGGING) {
  const port = Number(process.env.VORTEX_REMOTE_DEBUGGING) || 9222;
  app.commandLine.appendSwitch('remote-debugging-port', String(port));
}
if (!gotSingleInstanceLock) app.quit();
else app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows().find((item) => !item.isDestroyed());
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});
const CACHE_TTL = 5 * 60 * 1000;
const MIN_SPLASH_VISIBLE_MS = 1300;
const GITHUB_REPOSITORY = 'mozrg/Vortex';
const MAX_INSTALLER_BYTES = 200 * 1024 * 1024;
// A download that delivers nothing for this long is treated as stalled: the partial
// file is kept and the transfer resumes from the last received byte.
const DOWNLOAD_STALL_TIMEOUT_MS = 30000;
const DOWNLOAD_ATTEMPTS = 4;
const responseCache = new Map();
let startupWindow = null;
let updateCheckRunning = false;
// Last state seen while the splash was still visible, replayed to the main window.
let pendingUpdateStateForMainWindow = null;
let updateState = { status: 'checking', progress: 0, stage: null, currentVersion: app.getVersion(), latestVersion: null, releaseUrl: null, errorMessage: null };

function publicUpdateState() {
  const { status, progress, stage, currentVersion, latestVersion, releaseUrl, errorMessage } = updateState;
  return { status, progress, stage, currentVersion, latestVersion, releaseUrl, errorMessage };
}

function broadcastUpdateState() {
  const state = publicUpdateState();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('updates:state', state);
  }
  if (startupWindow && !startupWindow.isDestroyed()) {
    startupWindow.webContents.send('updates:state', state);
    // Remember the progress so the main window can show it after the handoff.
    pendingUpdateStateForMainWindow = state;
  }
}

// Set by createWindow(): lets the startup window reveal the main window once updates settle.
let onUpdateStateChanged = null;
let revealMainWindow = () => {};
let startupTransitionStarted = false;
// While these statuses are active the launcher keeps the compact startup window in front
// instead of opening the interface behind a running download or an installer handoff.
const UPDATE_BUSY_STATUSES = new Set(['checking', 'downloading', 'applying']);

function shouldWaitForUpdate() {
  return UPDATE_BUSY_STATUSES.has(updateState.status);
}

function setUpdateState(changes) {
  updateState = { ...updateState, ...changes, currentVersion: app.getVersion() };
  broadcastUpdateState();
  onUpdateStateChanged?.();
}

// Every update step is appended to userData/updates/apply.log so a failed
// swap can be diagnosed afterwards instead of vanishing silently.
async function appendUpdateLog(message) {
  try {
    const logDirectory = path.join(app.getPath('userData'), 'updates');
    await fsp.mkdir(logDirectory, { recursive: true });
    await fsp.appendFile(path.join(logDirectory, 'apply.log'), `${new Date().toISOString()} ${message}\n`, 'utf8');
  } catch {
    // Logging must never break the update flow.
  }
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

async function fetchReleaseAsset(url, timeout = 15000, signal = null, extraHeaders = null) {
  if (!validReleaseAssetUrl(url)) throw new Error('The release asset URL is not trusted.');
  const timeoutSignal = AbortSignal.timeout(timeout);
  const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const response = await fetch(url, {
    signal: combined,
    redirect: 'follow',
    headers: { 'User-Agent': 'Vortex-Place-Launcher', ...(extraHeaders || {}) }
  });
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

async function cleanupLegacyUpdateFiles(keepInstallerName = '') {
  const updatesDirectory = path.join(app.getPath('userData'), 'updates');
  for (const name of await fsp.readdir(updatesDirectory).catch(() => [])) {
    if (name === 'apply.log' || name === keepInstallerName) continue;
    if (/\.zip(?:\.|$)|\.partial$/i.test(name) || /^Vortex\.Launcher\.Setup\./i.test(name)) {
      await fsp.rm(path.join(updatesDirectory, name), { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }).catch(() => {});
    }
  }
  const oldStaging = path.join(app.getPath('userData'), 'update-staging');
  await fsp.rm(oldStaging, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }).catch((error) => {
    void appendUpdateLog(`update: old ZIP staging cleanup skipped: ${error.message}`);
  });
}

function waitFor(delay) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// Streams the installer into a partial file, resuming from what is already on disk.
// Returns false when the server ignored the Range header, so the caller restarts clean.
async function streamInstallerToFile(url, installer, partialPath, sizeOnDisk, expectedHash) {
  const headers = sizeOnDisk > 0 ? { Range: `bytes=${sizeOnDisk}-` } : null;
  const abort = new AbortController();
  let idleTimer = setTimeout(() => abort.abort(new Error('stalled')), DOWNLOAD_STALL_TIMEOUT_MS);
  const response = await fetchReleaseAsset(url, 10 * 60 * 1000, abort.signal, headers);
  const resumed = Boolean(headers) && response.status === 206;
  if (headers && !resumed && response.status !== 200) {
    clearTimeout(idleTimer);
    throw new Error(`GitHub asset request failed (${response.status}).`);
  }
  if (!response.body) {
    clearTimeout(idleTimer);
    throw new Error('GitHub did not return an installer file.');
  }

  const startAt = resumed ? sizeOnDisk : 0;
  const hash = createHash('sha256');
  if (resumed) {
    const existing = fs.createReadStream(partialPath);
    for await (const chunk of existing) hash.update(chunk);
  } else {
    await fsp.rm(partialPath, { force: true }).catch(() => {});
  }

  let received = startAt;
  let lastProgressUpdate = 0;
  const progressTransform = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > installer.size || received > MAX_INSTALLER_BYTES) {
        callback(new Error('The installer download exceeded its published size.'));
        return;
      }
      hash.update(chunk);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => abort.abort(new Error('stalled')), DOWNLOAD_STALL_TIMEOUT_MS);
      const now = Date.now();
      if (now - lastProgressUpdate >= 350) {
        lastProgressUpdate = now;
        setUpdateState({
          status: 'downloading',
          progress: Math.min(99, Math.floor((received / installer.size) * 100)),
          stage: 'downloading',
          latestVersion: installer.version ?? updateState.latestVersion,
          releaseUrl: updateState.releaseUrl
        });
      }
      callback(null, chunk);
    }
  });

  try {
    await pipeline(
      Readable.fromWeb(response.body),
      progressTransform,
      fs.createWriteStream(partialPath, resumed ? { flags: 'a' } : { flags: 'w' })
    );
    const digest = hash.digest('hex');
    if (received !== installer.size || digest !== expectedHash) {
      throw new Error(`The installer failed verification (${received} of ${installer.size} bytes).`);
    }
    return true;
  } finally {
    clearTimeout(idleTimer);
  }
}

async function downloadUpdate(release, version, installer, checksumAsset) {
  setUpdateState({ status: 'downloading', progress: 0, stage: 'checksum', latestVersion: version, releaseUrl: release.html_url, errorMessage: null });
  await appendUpdateLog(`download: requesting checksum for ${installer.name}`);
  const checksumResponse = await fetchReleaseAsset(checksumAsset.browser_download_url);
  const checksumText = await checksumResponse.text();
  if (checksumText.length > 2048) throw new Error('The installer checksum file is too large.');
  const expectedHash = checksumText.trim().split(/\s+/)[0].toLowerCase();
  if (!/^[a-f\d]{64}$/.test(expectedHash)) throw new Error('The installer checksum is invalid.');
  await appendUpdateLog(`download: checksum received for ${installer.name} (${installer.size} bytes)`);

  const updateDirectory = path.join(app.getPath('userData'), 'updates');
  setUpdateState({ status: 'downloading', progress: 0, stage: 'prepare', latestVersion: version, releaseUrl: release.html_url, errorMessage: null });
  await fsp.mkdir(updateDirectory, { recursive: true });
  const fileName = installer.name;
  await cleanupLegacyUpdateFiles(fileName);
  const finalPath = path.join(updateDirectory, fileName);
  try {
    if ((await fsp.stat(finalPath)).size === installer.size && (await hashFile(finalPath)) === expectedHash) {
      await appendUpdateLog('download: a verified installer is already cached, applying it');
      setUpdateState({ status: 'downloading', progress: 100, stage: 'verify', latestVersion: version, releaseUrl: release.html_url, errorMessage: null });
      await installUpdate(finalPath, version, release);
      return;
    }
  } catch {
    // No verified cached installer exists; download a fresh copy below.
  }

  const partialPath = path.join(updateDirectory, `${fileName}.partial`);
  const asset = { ...installer, version };
  let lastError = null;
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    const sizeOnDisk = await fsp.stat(partialPath).then((info) => info.size).catch(() => 0);
    const resuming = sizeOnDisk > 0 && sizeOnDisk < installer.size;
    await appendUpdateLog(`download: attempt ${attempt}/${DOWNLOAD_ATTEMPTS} for ${fileName}${resuming ? `, resuming at ${sizeOnDisk} bytes` : ''}`);
    try {
      setUpdateState({
        status: 'downloading',
        progress: resuming ? Math.min(99, Math.floor((sizeOnDisk / installer.size) * 100)) : 0,
        stage: 'downloading',
        latestVersion: version,
        releaseUrl: release.html_url,
        errorMessage: null
      });
      await streamInstallerToFile(installer.browser_download_url, asset, partialPath, resuming ? sizeOnDisk : 0, expectedHash);
      await fsp.rm(finalPath, { force: true, maxRetries: 5, retryDelay: 300 });
      setUpdateState({ status: 'downloading', progress: 100, stage: 'verify', latestVersion: version, releaseUrl: release.html_url, errorMessage: null });
      await fsp.rename(partialPath, finalPath);
      await appendUpdateLog(`download: ${fileName} verified after ${attempt} attempt(s)`);
      await installUpdate(finalPath, version, release);
      return;
    } catch (error) {
      lastError = error;
      await appendUpdateLog(`download: attempt ${attempt} failed (${error.message})`);
      if (attempt < DOWNLOAD_ATTEMPTS) await waitFor(2000 * attempt);
    }
  }
  await fsp.rm(partialPath, { force: true, maxRetries: 3, retryDelay: 250 }).catch(() => {});
  throw new Error(`Не удалось скачать обновление после ${DOWNLOAD_ATTEMPTS} попыток: ${lastError?.message ?? 'неизвестная ошибка'}`);
}

async function installUpdate(installerPath, version, release) {
  const exePath = app.getPath('exe');
  const logPath = path.join(app.getPath('userData'), 'updates', 'apply.log');
  const script = path.join(app.getPath('temp'), `vortex-installer-${randomUUID()}.ps1`);
  const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
  const body = [
    "$ErrorActionPreference = 'Continue'",
    `$log = ${q(logPath)}`,
    "function Note($message) { Add-Content -LiteralPath $log -Value ((Get-Date -Format s) + ' ' + $message) -ErrorAction SilentlyContinue }",
    "Note 'update: waiting for Vortex to close before running the signed NSIS installer'",
    `Wait-Process -Id ${process.pid} -Timeout 90 -ErrorAction SilentlyContinue`,
    `if (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue) { Note 'update: closing the old launcher'; Stop-Process -Id ${process.pid} -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2 }`,
    `Note ('update: starting verified setup ${version}')`,
    `$setup = Start-Process -FilePath ${q(installerPath)} -ArgumentList '/S' -Wait -PassThru -WindowStyle Hidden`,
    "Note ('update: setup exit code ' + $setup.ExitCode)",
    `if ($setup.ExitCode -eq 0) { Note 'update: setup succeeded, starting updated launcher'; Start-Process -FilePath ${q(exePath)} -ErrorAction Stop } else { Note 'update: setup failed; preserving verified installer for retry and reopening the existing launcher'; Start-Process -FilePath ${q(exePath)} -ErrorAction SilentlyContinue }`,
    `Remove-Item -LiteralPath ${q(script)} -Force -ErrorAction SilentlyContinue`
  ].join('\r\n');
  await fsp.writeFile(script, `\ufeff${body}`, 'utf8');
  await appendUpdateLog(`update: verified setup cached at ${installerPath}`);
  await appendUpdateLog('update: preparing hidden installer handoff');
  setUpdateState({ status: 'applying', progress: 100, stage: 'installing', latestVersion: version, releaseUrl: release.html_url, errorMessage: null });
  // The helper must outlive this process, so it is started through `cmd /c start`:
  // a detached powershell.exe is not executed reliably on Windows, while a process
  // created by `start` keeps running after the launcher exits.
  const helper = spawn('cmd.exe', [
    '/c', 'start', '/b', '',
    'powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', script
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  await new Promise((resolve, reject) => {
    helper.once('spawn', resolve);
    helper.once('error', reject);
  });
  helper.unref();
  await appendUpdateLog(`update: installer helper dispatched (cmd pid ${helper.pid})`);
  setTimeout(() => app.exit(0), 400);
}

async function checkForUpdates() {
  if (updateCheckRunning) return;
  if (!app.isPackaged) {
    setUpdateState({ status: 'development', progress: 0, stage: null });
    return;
  }

  updateCheckRunning = true;
  setUpdateState({ status: 'checking', progress: 0, stage: null, latestVersion: null, releaseUrl: null, errorMessage: null });
  // Each step is logged before and after the network call: if a check ever stalls again,
  // apply.log shows exactly which request never came back.
  const startedAt = Date.now();
  await appendUpdateLog(`check: querying ${GITHUB_REPOSITORY} releases`);
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/releases?per_page=20`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Vortex-Place-Launcher' },
      signal: AbortSignal.timeout(8000)
    });
    await appendUpdateLog(`check: release list answered with ${response.status} after ${Date.now() - startedAt} ms`);
    if (response.status === 404) {
      setUpdateState({ status: 'unavailable', progress: 0, stage: null, latestVersion: null, releaseUrl: null, errorMessage: null });
      return;
    }
    if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
    const releases = await response.json();
    const candidate = findNewestInstallerRelease(Array.isArray(releases) ? releases : []);
    if (!candidate) {
      // Releases exist but none has a complete installer + SHA-256 pair yet
      // (e.g. an empty draft-like release). Nothing to install, so this is not an error.
      await appendUpdateLog('check: no published release carries a complete installer yet');
      setUpdateState({ status: 'unavailable', progress: 0, stage: null, latestVersion: null, releaseUrl: null, errorMessage: null });
      return;
    }
    const { release, version, installer, checksumAsset } = candidate;
    await appendUpdateLog(`check: newest published version is ${version}, installed is ${app.getVersion()}`);
    if (!isNewerVersion(version, app.getVersion())) {
      setUpdateState({ status: 'current', progress: 0, stage: null, latestVersion: version, releaseUrl: release.html_url });
      return;
    }
    await downloadUpdate(release, version, installer, checksumAsset);
  } catch (error) {
    console.warn('Vortex update check failed:', error.message);
    await appendUpdateLog(`check failed after ${Date.now() - startedAt} ms: ${error.message}`);
    // The stage is intentionally preserved: the splash highlights the step that failed.
    setUpdateState({ status: 'error', progress: 0, errorMessage: String(error.message || 'Update failed').slice(0, 240) });
  } finally {
    updateCheckRunning = false;
  }
}

// Picks the highest-versioned published release that carries a complete
// installer + .sha256 pair. Empty releases (no files uploaded yet) are skipped.
function findNewestInstallerRelease(releases) {
  const candidates = [];
  for (const release of releases) {
    if (!release || release.draft || release.prerelease) continue;
    const version = String(release.tag_name ?? '').replace(/^v/i, '');
    if (!numericVersion(version)) continue;
    if (!release.html_url?.startsWith(`https://github.com/${GITHUB_REPOSITORY}/releases/`)) continue;
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const installer = assets.find((asset) => asset.name === `Vortex.Launcher.Setup.${version}.exe` && Number(asset.size) > 0 && Number(asset.size) <= MAX_INSTALLER_BYTES && asset.browser_download_url);
    const checksumAsset = assets.find((asset) => asset.name === `Vortex.Launcher.Setup.${version}.exe.sha256` && Number(asset.size) > 0 && Number(asset.size) <= 2048 && asset.browser_download_url);
    if (installer && checksumAsset) candidates.push({ release, version, installer, checksumAsset });
  }
  candidates.sort((a, b) => (isNewerVersion(a.version, b.version) ? -1 : isNewerVersion(b.version, a.version) ? 1 : 0));
  return candidates[0] ?? null;
}

function createWindow() {
  let mainWindow = null;
  // loadFile() resolving only means navigation completed; the first renderer
  // frame may still be blank. Wait until Chromium has painted the splash.
  let splashShownAt = null;
  let splashFailed = false;
  let mainReady = false;

  const splash = new BrowserWindow({
    width: 440,
    height: 420,
    minWidth: 440,
    minHeight: 420,
    maxWidth: 440,
    maxHeight: 420,
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

  revealMainWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!mainReady || startupTransitionStarted || (splashShownAt === null && !splashFailed)) return;
    // Keep the startup window open while an update is checked, downloaded or handed off.
    if (shouldWaitForUpdate()) return;
    startupTransitionStarted = true;
    const visibleFor = splashShownAt === null ? MIN_SPLASH_VISIBLE_MS : Date.now() - splashShownAt;
    const remaining = Math.max(0, MIN_SPLASH_VISIBLE_MS - visibleFor);
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) mainWindow.show();
      if (!splash.isDestroyed()) splash.destroy();
    }, remaining);
  };

  splash.webContents.once('did-finish-load', () => splash.webContents.send('updates:state', publicUpdateState()));
  splash.once('closed', () => {
    if (startupWindow === splash) startupWindow = null;
    // Alt+F4 on the splash must never leave the user with a hidden main window.
    if (!startupTransitionStarted && mainReady && mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

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
  splash.loadFile(path.join(__dirname, '..', 'src', 'startup.html')).catch((error) => {
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
  mainWindow = window;

  // Closing hides the app to the tray instead of quitting; a full exit runs from
  // the tray panel. Update installs call app.exit() directly, which bypasses this.
  window.on('close', (event) => {
    event.preventDefault();
    window.hide();
  });

  const sendWindowState = () => window.webContents.send('window:state', { isMaximized: window.isMaximized() });
  window.on('maximize', sendWindowState);
  window.on('unmaximize', sendWindowState);
  window.webContents.once('did-finish-load', sendWindowState);
  window.webContents.once('did-finish-load', () => {
    window.webContents.send('updates:state', pendingUpdateStateForMainWindow ?? publicUpdateState());
  });
  window.once('ready-to-show', () => {
    mainReady = true;
    revealMainWindow();
  });
  window.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  onUpdateStateChanged = revealMainWindow;
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
ipcMain.handle('updates:retry', () => checkForUpdates());


async function fetchJson(url, timeout = 12000) {
  // A Request object carries its own method/headers/body: passing options
  // alongside would override them (and once cost us a 415 on the username
  // lookup). Only attach the timeout signal in that case.
  const response = url instanceof Request
    ? await fetch(url, { signal: AbortSignal.timeout(timeout) })
    : await fetch(url, {
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
  const ids = [...new Set(universeIds.map(String).filter((id) => /^\d{1,20}$/.test(id)))];
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
  const ids = [...new Set(universeIds.map(String).filter((id) => /^\d{1,20}$/.test(id)))];
  if (!ids.length) return [];
  const batches = [];
  for (let index = 0; index < ids.length; index += 50) batches.push(ids.slice(index, index + 50));
  const results = await Promise.all(batches.map(async (batch) => {
    try {
      const url = new URL('https://games.roblox.com/v1/games');
      url.searchParams.set('universeIds', batch.join(','));
      const payload = await fetchCachedJson(url);
      const rows = Array.isArray(payload.data) ? payload.data : [];
      const thumbnails = await getThumbnails(rows.map((row) => row.id));
      return rows.map((row) => mapGame(row, thumbnails.get(String(row.id))));
    } catch { return []; }
  }));
  return results.flat();
}

function placeReleaseLogPath() { return path.join(app.getPath('userData'), 'place-updates.json'); }

// Roblox exposes only the latest update date, so Vortex keeps its own log:
// each time a place is seen with a newer `updated` value, the date is recorded.
async function recordPlaceUpdate(universeId, updated, title) {
  if (!universeId || !updated) return [];
  const file = placeReleaseLogPath();
  let log = {};
  try { log = JSON.parse(await fsp.readFile(file, 'utf8')); } catch { log = {}; }
  const key = String(universeId);
  const history = Array.isArray(log[key]) ? log[key] : [];
  if (!history.some((entry) => entry.updated === updated)) {
    history.unshift({ updated, seenAt: new Date().toISOString(), title: String(title || '').slice(0, 120) });
  }
  log[key] = history.slice(0, 20);
  await fsp.writeFile(file, JSON.stringify(log), 'utf8').catch(() => {});
  return log[key];
}

async function readPlaceUpdateHistory(universeId) {
  try {
    const log = JSON.parse(await fsp.readFile(placeReleaseLogPath(), 'utf8'));
    return Array.isArray(log[String(universeId)]) ? log[String(universeId)] : [];
  } catch { return []; }
}

ipcMain.handle('games:release-history', async (_event, universeIdValue) => {
  const universeId = String(universeIdValue || '').match(/^\d{1,20}$/)?.[0] || '';
  if (!universeId) return [];
  return readPlaceUpdateHistory(universeId);
});

ipcMain.handle('shell:open-external', async (_event, value) => {
  try {
    const url = new URL(String(value || ''));
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    await shell.openExternal(url.href);
    return true;
  } catch { return false; }
});

// Lightweight health probe for the Roblox endpoints the app depends on.
ipcMain.handle('roblox:api-status', async () => {
  const checks = [
    { id: 'games', url: 'https://games.roblox.com/v1/games?universeIds=1818' },
    { id: 'thumbnails', url: 'https://thumbnails.roblox.com/v1/games/icons?universeIds=1818&size=512x512&format=Png&isCircular=false' },
    { id: 'badges', url: 'https://badges.roblox.com/v1/universes/1818/badges?limit=1' }
  ];
  const results = await Promise.allSettled(checks.map(async ({ id, url }) => {
    const started = Date.now();
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
    return { id, ok: response.ok, status: response.status, ms: Date.now() - started };
  }));
  return {
    checkedAt: new Date().toISOString(),
    services: results.map((result, index) => result.status === 'fulfilled'
      ? result.value
      : { id: checks[index].id, ok: false, status: 0, ms: 0 })
  };
});

ipcMain.handle('games:details', async (_event, request = {}) => {
  const universeId = String(request.universeId ?? '').match(/^\d{1,20}$/)?.[0] || '';
  const placeId = String(request.placeId ?? '').match(/^\d{5,20}$/)?.[0] || '';
  if (!universeId && !placeId) return { ok: false, error: 'invalid-id' };
  let resolvedUniverseId = universeId;
  if (!resolvedUniverseId && placeId) {
    try {
      const place = await fetchCachedJson(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`, 9000);
      resolvedUniverseId = String(place?.universeId ?? '');
    } catch { return { ok: false, error: 'universe-lookup-failed' }; }
  }
  if (!/^\d{1,20}$/.test(resolvedUniverseId)) return { ok: false, error: 'not-found' };
  const [game, votes, badges, social, media, screenshots] = await Promise.allSettled([
    fetchCachedJson(`https://games.roblox.com/v1/games?universeIds=${resolvedUniverseId}`, 9000),
    fetchCachedJson(`https://games.roblox.com/v1/games/${resolvedUniverseId}/votes`, 9000),
    fetchCachedJson(`https://badges.roblox.com/v1/universes/${resolvedUniverseId}/badges?limit=100&sortOrder=Asc`, 9000),
    robloxSecurityCookie ? fetchJson(new Request(`https://games.roblox.com/v1/games/${resolvedUniverseId}/social-links/list`, { headers: { Cookie: `.ROBLOSECURITY=${robloxSecurityCookie}` } }), 9000) : Promise.resolve(null),
    fetchCachedJson(`https://games.roblox.com/v2/games/${resolvedUniverseId}/media?limit=10`, 9000),
    fetchCachedJson(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${resolvedUniverseId}&countPerUniverse=10&size=768x432&format=Png&isCircular=false`, 9000)
  ]);
  const row = game.status === 'fulfilled' && Array.isArray(game.value?.data) ? game.value.data[0] : null;
  if (!row) return { ok: false, error: 'not-found' };
  const thumbs = await getThumbnails([resolvedUniverseId]);
  const base = mapGame(row, thumbs.get(resolvedUniverseId), placeId || row.rootPlaceId);
  const voteData = votes.status === 'fulfilled' ? votes.value || {} : {};
  void recordPlaceUpdate(resolvedUniverseId, row.updated || '', row.name);
  return { ok: true, game: {
    ...base, description: String(row.description ?? base.description), universeId: resolvedUniverseId, placeId: String(row.rootPlaceId || placeId || ''),
    visits: Number(row.visits) || 0, favorites: Number(row.favoritedCount ?? row.favorites) || 0,
    updated: row.updated || row.created || '', created: row.created || '',
    playing: Number(row.playing) || 0, upVotes: Number(voteData.upVotes ?? base.upVotes) || 0,
    downVotes: Number(voteData.downVotes ?? base.downVotes) || 0,
    creatorId: String(row.creator?.id ?? ''), creator: String(row.creator?.name ?? base.creator),
    genre: String(row.genreL1 ?? row.genre ?? base.genre),
    badges: badges.status === 'fulfilled' && Array.isArray(badges.value?.data) ? badges.value.data.map((badge) => ({ id: String(badge.id), name: String(badge.name || ''), description: String(badge.description || ''), icon: String(badge.iconImageId || '') })) : [],
    socialLinks: social.status === 'fulfilled' && Array.isArray(social.value?.data) ? social.value.data : [],
    media: media.status === 'fulfilled' && Array.isArray(media.value?.data) ? media.value.data.map((item) => ({ type: String(item.assetType || item.assetTypeId || '').toLowerCase().includes('video') ? 'video' : 'image', url: String(item.videoUrl || item.imageUrl || item.assetUrl || ''), thumbnail: String(item.thumbnailUrl || ''), title: String(item.title || '') })).filter((item) => item.url) : [],
    screenshots: screenshots.status === 'fulfilled' && Array.isArray(screenshots.value?.data) ? screenshots.value.data.flatMap((entry) => entry.thumbnails || []).map((item) => ({ url: String(item.imageUrl || ''), title: String(item.name || '') })).filter((item) => item.url) : [],
  }};
});

ipcMain.handle('game:open', async (_event, placeId, gameId, accessCode) => {
  const normalizedId = String(placeId ?? '');
  if (!/^\d{5,20}$/.test(normalizedId)) throw new Error('Некорректный идентификатор игры.');

  // gameId = a specific server instance: joining a friend's server needs it.
  const normalizedGameId = /^(?:\d{5,40}|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(String(gameId ?? '')) ? String(gameId) : '';
  try {
    const normalizedAccessCode = /^[A-Za-z0-9-]{8,100}$/.test(String(accessCode ?? '')) ? String(accessCode) : '';
    await shell.openExternal(`roblox://placeId=${normalizedId}${normalizedGameId ? `&gameInstanceId=${normalizedGameId}` : ''}${normalizedAccessCode ? `&accessCode=${encodeURIComponent(normalizedAccessCode)}` : ''}`);
    return 'player';
  } catch {
    await shell.openExternal(`https://www.roblox.com/games/start?placeId=${normalizedId}`);
    return 'browser';
  }
});

ipcMain.handle('games:similar', async (_event, request = {}) => {
  const universeId = String(request.universeId ?? '').match(/^\d{1,20}$/)?.[0] || '';
  const genre = String(request.genre ?? '').slice(0, 60).trim();
  const title = String(request.title ?? '').slice(0, 60).trim();
  if (!universeId) return [];
  try {
    // Roblox has no "similar games" endpoint, so run an omni-search on the
    // genre (or the title as a fallback) and drop the current place.
    const sessionId = randomUUID();
    const query = genre || title || 'popular';
    const url = new URL('https://apis.roblox.com/search-api/omni-search');
    url.searchParams.set('searchQuery', query);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('pageType', 'all');
    const payload = await fetchCachedJson(url, 12000);
    const games = [];
    const targetUniverse = String(request.universeId || '');
    for (const group of (Array.isArray(payload?.searchResults) ? payload.searchResults : [])) {
      if (String(group?.contentGroupType || '').toLowerCase() !== 'game') continue;
      for (const row of (Array.isArray(group?.contents) ? group.contents : [])) {
        // Omni-search game rows carry `universeId` plus `rootPlaceId`, not `id`.
        const candidateUniverse = String(row?.universeId ?? '');
        if (!/^\d{1,20}$/.test(candidateUniverse) || candidateUniverse === targetUniverse) continue;
        games.push(candidateUniverse);
      }
    }
    const unique = [...new Set(games)].slice(0, 12);
    if (!unique.length) return [];
    const details = await getGameDetailsByUniverse(unique);
    return details.filter((game) => String(game.universeId || game.id) !== targetUniverse).slice(0, 12);
  } catch { return []; }
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

  // Omni-search returns no descriptions, so every hit is enriched with full game
  // details (description, creator, votes, thumbnail) from the games API.
  const details = await getGameDetailsByUniverse(records.map((game) => game.universeId));
  const detailsByUniverse = new Map(details.map((game) => [game.universeId, game]));
  const items = records
    .map((game) => {
      const placeId = game.rootPlaceId ?? game.placeId;
      const detail = detailsByUniverse.get(String(game.universeId));
      if (detail) return { ...detail, id: String(placeId) };
      return mapGame({
        id: game.universeId,
        rootPlaceId: placeId,
        name: game.name,
        description: game.description,
        creatorName: game.creatorName,
        playerCount: game.playerCount,
        totalUpVotes: game.totalUpVotes,
        totalDownVotes: game.totalDownVotes
      }, '', placeId);
    })
    .filter((item) => Boolean(item.id));

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
  // Discover rows carry no descriptions either — enrich them from the games API.
  const details = await getGameDetailsByUniverse(validGames.map((game) => game.universeId));
  const detailsByUniverse = new Map(details.map((game) => [game.universeId, game]));
  const items = validGames
    .map((game) => {
      const detail = detailsByUniverse.get(String(game.universeId));
      if (detail) return { ...detail, id: String(game.rootPlaceId), genre: detail.genre || String(game.genreL1 ?? '') };
      return mapGame({
        id: game.universeId,
        rootPlaceId: game.rootPlaceId,
        name: game.name,
        description: game.description,
        creatorName: game.creatorName,
        playerCount: game.playerCount,
        totalUpVotes: game.totalUpVotes,
        totalDownVotes: game.totalDownVotes,
        genreL1: game.genreL1
      }, '', game.rootPlaceId);
    })
    .filter((item) => Boolean(item.id));

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

// ---------- Roblox friends (public endpoints, no account link needed) ----------
// username -> userId via the public user lookup; friends + presence via the
// public friends/presence APIs. No .ROBLOSECURITY cookie is ever requested:
// everything here is readable anonymously, exactly like on the public site.
async function resolveRobloxUserId(username) {
  const clean = String(username ?? '').trim().slice(0, 25);
  if (!/^[A-Za-z0-9_]{3,20}$/.test(clean)) return null;
  try {
    const payload = await fetchJson(new Request('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [clean], excludeBannedUsers: true })
    }), 10000);
    const hit = (payload && payload.data && payload.data[0]) || null;
    return hit ? { id: String(hit.id), name: hit.name, displayName: hit.displayName || hit.name } : null;
  } catch { return null; }
}

async function fetchRobloxFriends(userId) {
  try {
    const payload = await fetchCachedJson(new URL(`https://friends.roblox.com/v1/users/${userId}/friends`), 20000);
    const list = Array.isArray(payload && payload.data) ? payload.data : [];
    return list.map((friend) => ({
      id: String(friend.id),
      name: friend.name,
      displayName: friend.displayName || friend.name,
      isOnline: Boolean(friend.isOnline)
    })).slice(0, 500);
  } catch { return []; }
}

// Presence: who plays what right now. Falls back gracefully when the endpoint
// refuses anonymous requests (some presence scopes require a session).
// Friend entries can arrive with empty names (privacy). The batch users
// endpoint still resolves them anonymously: fill the display names in.
async function fetchRobloxUserNames(userIds) {
  if (!userIds.length) return new Map();
  const result = new Map();
  const batches = [];
  for (let index = 0; index < userIds.length; index += 100) batches.push(userIds.slice(index, index + 100));
  for (const batch of batches) {
    try {
      const payload = await fetchJson(new Request('https://users.roblox.com/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: batch, excludeBannedUsers: false })
      }), 10000);
      for (const user of (payload.data ?? [])) {
        result.set(String(user.id), { name: user.name || '', displayName: user.displayName || user.name || '' });
      }
    } catch { /* names stay hidden for this batch */ }
  }
  return result;
}

// Live presence needs an authenticated session; Roblox hides all statuses
// from anonymous callers. The .ROBLOSECURITY cookie is OPTIONAL and stored
// encrypted on disk (safeStorage)  never in plain JSON preferences.
let robloxSecurityCookie = '';
function cookieFilePath() { return path.join(app.getPath('userData'), 'rbx-presence.bin'); }

async function loadRobloxCookie() {
  robloxSecurityCookie = '';
  try {
    const blob = await fsp.readFile(cookieFilePath());
    const decrypted = safeStorage.decryptString(blob);
    if (decrypted) robloxSecurityCookie = decrypted;
  } catch { /* no cookie stored yet */ }
}

async function saveRobloxCookie(cookie) {
  robloxSecurityCookie = cookie;
  try {
    if (!cookie) { await fsp.rm(cookieFilePath(), { force: true }); return true; }
    const encrypted = safeStorage.encryptString(cookie);
    await fsp.writeFile(cookieFilePath(), encrypted);
    return true;
  } catch { return false; }
}

async function fetchRobloxPresence(userIds) {
  if (!userIds.length) return [];
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (robloxSecurityCookie) headers.Cookie = '.ROBLOSECURITY=' + robloxSecurityCookie;
    const payload = await fetchJson(new Request('https://presence.roblox.com/v1/presence/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userIds: userIds.slice(0, 100) })
    }), 10000);
    return Array.isArray(payload && payload.userPresences) ? payload.userPresences : [];
  } catch { return []; }
}

async function fetchRobloxUserThumbnails(userIds) {
  if (!userIds.length) return new Map();
  const result = new Map();
  for (let index = 0; index < userIds.length; index += 100) {
    try {
      const url = new URL('https://thumbnails.roblox.com/v1/users/avatar-headshot');
      url.searchParams.set('userIds', userIds.slice(index, index + 100).join(','));
      url.searchParams.set('size', '150x150');
      url.searchParams.set('format', 'Png');
      url.searchParams.set('isCircular', 'false');
      const payload = await fetchCachedJson(url, 30000);
      for (const item of (payload.data ?? [])) result.set(String(item.targetId), cleanThumbnail(item.imageUrl));
    } catch { /* continue with the remaining batches */ }
  }
  return result;
}

// ---------- Roblox account auto-detection ----------
// The local Roblox install keeps one folder per logged-in account under
// %LOCALAPPDATA%\Roblox\<userId> (numeric names only; '0' is the guest slot).
// Resolve each candidate through the public users API and pick the most
// recently active one. No files are read beyond the folder listing: no
// cookies, no credentials, no session data.
async function detectLocalRobloxAccount() {
  const candidates = [];
  try {
    // localData exists in newer Electron; getPath THROWS on older keys, which
    // would silently kill the whole detection  resolve it defensively.
    let localData = process.env.LOCALAPPDATA;
    try { localData = app.getPath('localData') || localData; } catch { /* keep the env value */ }
    const robloxFolder = path.join(localData, 'Roblox');
    for (const entry of await fs.promises.readdir(robloxFolder, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^\d{3,20}$/.test(entry.name) || entry.name === '0') continue;
      // Recency signal: the newest file inside the account folder.
      let newest = 0;
      try {
        const files = await fs.promises.readdir(path.join(robloxFolder, entry.name), { recursive: true });
        for (const f of files.slice(0, 400)) {
          try {
            const stat = await fs.promises.stat(path.join(robloxFolder, entry.name, String(f)));
            if (stat.isFile() && stat.mtimeMs > newest) newest = stat.mtimeMs;
          } catch { /* broken links and long paths are fine to skip */ }
        }
      } catch { /* unreadable folder: fall back to folder mtime */ }
      if (!newest) {
        try { newest = (await fs.promises.stat(path.join(robloxFolder, entry.name))).mtimeMs; } catch { newest = 0; }
      }
      candidates.push({ userId: entry.name, lastActive: newest });
    }
  } catch { return null; }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.lastActive - a.lastActive);
  // Resolve the freshest candidate to a username; try the next one if the
  // API rejects it (deleted account, etc.).
  for (const candidate of candidates.slice(0, 3)) {
    try {
      const payload = await fetchCachedJson(new URL(`https://users.roblox.com/v1/users/${candidate.userId}`), 60000);
      if (payload && payload.id && payload.name) {
        return { id: String(payload.id), name: payload.name, displayName: payload.displayName || payload.name, lastActive: candidate.lastActive };
      }
    } catch { /* try the next candidate */ }
  }
  return null;
}

ipcMain.handle('friends:presence-cookie', async (_event, request = {}) => {
  const cookie = String(request.cookie ?? '').trim();
  if (request.remove) { await saveRobloxCookie(''); return { ok: true, enabled: false }; }
  // The real .ROBLOSECURITY value: 100-2200 chars, URL-safe base64-ish with
  // warning prefix containing ';' and '-'. Validate loosely, let Roblox judge.
  // Loose sanity check: long, no whitespace/quotes. Roblox itself is the
  // real judge via the authenticated-user probe below.
  if (cookie.length < 100 || cookie.length > 2200 || /[\s"']/.test(cookie)) return { ok: false, error: 'invalid' };
  // Validate the cookie with a light authenticated call before storing.
  try {
    const headers = { Cookie: '.ROBLOSECURITY=' + cookie };
    const me = await fetchJson(new Request('https://users.roblox.com/v1/users/authenticated', { headers }), 10000);
    if (!me || !me.id) return { ok: false, error: 'rejected' };
    await saveRobloxCookie(cookie);
    return { ok: true, enabled: true, userId: String(me.id), name: me.name };
  } catch { return { ok: false, error: 'rejected' }; }
});

ipcMain.handle('friends:presence-status', () => ({ enabled: Boolean(robloxSecurityCookie) }));
ipcMain.handle('auth:roblox-current-user', async () => {
  if (!robloxSecurityCookie) return null;
  try {
    const me = await fetchJson(new Request('https://users.roblox.com/v1/users/authenticated', { headers: { Cookie: `.ROBLOSECURITY=${robloxSecurityCookie}` } }), 8000);
    return me?.id ? { id: String(me.id), name: String(me.name || ''), displayName: String(me.displayName || me.name || '') } : null;
  } catch { return null; }
});

ipcMain.handle('friends:detect-account', async () => {
  const account = await detectLocalRobloxAccount();
  return { ok: Boolean(account), account };
});

ipcMain.handle('friends:list', async (_event, request = {}) => {
  const username = String(request.username ?? '');
  const user = await resolveRobloxUserId(username);
  if (!user) return { ok: false, error: 'user-not-found', friends: [] };
  const friends = await fetchRobloxFriends(user.id);
  if (!friends.length) return { ok: true, user, friends: [] };
  const presence = await fetchRobloxPresence(friends.map((f) => f.id));
  const thumbs = await fetchRobloxUserThumbnails(friends.map((f) => f.id));
  const missingNames = friends.filter((f) => !f.name && !f.displayName).map((f) => f.id);
  const resolvedNames = missingNames.length ? await fetchRobloxUserNames(missingNames) : new Map();
  const presenceByUser = new Map(presence.map((p) => [String(p.userId), p]));
  const enriched = friends.map((friend) => {
    const p = presenceByUser.get(friend.id) || {};
    const resolved = resolvedNames.get(friend.id) || {};
    const name = friend.name || resolved.name || '';
    const displayName = friend.displayName || resolved.displayName || name;
    const playing = (p.userPresenceType ?? 0) >= 2; // 0 offline, 1 online, 2+ in game
    return {
      ...friend,
      name,
      displayName,
      avatar: thumbs.get(friend.id) || '',
      presence: playing ? 'playing' : (p.userPresenceType === 1 ? 'online' : 'offline'),
      placeId: p.placeId ? String(p.placeId) : '',
      gameId: p.gameId ? String(p.gameId) : '',
      gameName: p.lastLocation ? String(p.lastLocation).slice(0, 80) : ''
    };
  });
  // Game art for friends that are playing: placeId -> universeId -> icon.
  const playingFriends = enriched.filter((f) => f.presence === 'playing' && f.placeId);
  for (const friend of playingFriends) {
    try {
      const universe = await fetchCachedJson(new URL(`https://apis.roblox.com/universes/v1/places/${friend.placeId}/universe`), 300000);
      const universeId = universe && universe.universeId ? String(universe.universeId) : '';
      if (universeId) {
        friend.universeId = universeId;
        if (!friend.gameName) {
          const details = await fetchCachedJson(new URL(`https://games.roblox.com/v1/games?universeIds=${universeId}`), 300000);
          friend.gameName = String(details?.data?.[0]?.name || '').slice(0, 80);
        }
        const thumb = await fetchCachedJson(new URL(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=256x256&format=Png`), 300000);
        friend.gameThumbnail = cleanThumbnail(thumb?.data?.[0]?.imageUrl) || '';
      }
    } catch { /* art stays empty; the name from presence still shows */ }
  }

  const rank = { playing: 0, online: 1, offline: 2 };
  enriched.sort((a, b) => (rank[a.presence] ?? 2) - (rank[b.presence] ?? 2));
  return { ok: true, user, friends: enriched, livePresence: Boolean(robloxSecurityCookie) };
});

// ---------- Tray ----------
// Closing the window hides it to the tray instead of quitting; the tray panel
// (styled like the launcher itself) can reopen the app, relaunch one of the five
// most recent games, or quit completely.
let tray = null;
let trayWindow = null;
let trayIcon = null;
let recentGamesForTray = [];
// The tray panel mirrors the launcher's appearance; the renderer pushes this
// palette whenever settings change (accent, theme, tray scale, language).
const TRAY_SCALES = { compact: 0.9, normal: 1, large: 1.1 };
let trayStyle = {
  accent: '#9b7cff', accentMode: 'solid', accentSecondary: '#c274ec', gradientAngle: 135,
  theme: 'dark', themeBackground: '', themeSurface: '', corners: 'soft', trayScale: 'normal', language: 'ru', accentText: ''
};

function sanitizeTrayStyle(style) {
  const next = { ...trayStyle, ...style };
  const hex = /^#[0-9a-f]{6}$/i;
  if (!hex.test(String(next.accent))) next.accent = '#9b7cff';
  if (!hex.test(String(next.accentSecondary))) next.accentSecondary = '#c274ec';
  if (!['solid', 'gradient'].includes(next.accentMode)) next.accentMode = 'solid';
  if (!['dark', 'light', 'oled'].includes(next.theme)) next.theme = 'dark';
  if (!hex.test(String(next.themeBackground))) next.themeBackground = '';
  if (!hex.test(String(next.themeSurface))) next.themeSurface = '';
  if (!['soft', 'sharp'].includes(next.corners)) next.corners = 'soft';
  if (!Object.keys(TRAY_SCALES).includes(next.trayScale)) next.trayScale = 'normal';
  if (!['ru', 'en'].includes(next.language)) next.language = 'ru';
  next.gradientAngle = Math.max(0, Math.min(360, Number(next.gradientAngle) || 135));
  next.accentText = hex.test(String(next.accentText)) ? String(next.accentText) : '';
  return next;
}

function trayScale() {
  return TRAY_SCALES[trayStyle.trayScale] ?? 1;
}

// Steam-style menu geometry: 280px wide, height follows content.
const TRAY_MENU_WIDTH = 280;
const TRAY_MENU_MIN_HEIGHT = 150;
const TRAY_MENU_MAX_HEIGHT = 420;
let trayMenuHeight = TRAY_MENU_MIN_HEIGHT;

function trayBounds() {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const width = Math.round(TRAY_MENU_WIDTH * trayScale());
  const height = Math.round(trayMenuHeight * trayScale());
  return {
    x: Math.max(display.workArea.x, Math.min(display.workArea.x + display.workArea.width - width, cursor.x - width / 2)),
    y: Math.max(display.workArea.y, Math.min(display.workArea.y + display.workArea.height - height, cursor.y - height - 12))
  };
}

// Measure the real panel height once the page has rendered and size the
// window to it, so no scrollbars or empty voids ever appear.
function fitTrayWindowToContent() {
  if (!trayWindow || trayWindow.isDestroyed()) return;
  void trayWindow.webContents.executeJavaScript(`(() => {
    const panel = document.querySelector('.tray-panel');
    return panel ? Math.ceil(panel.getBoundingClientRect().height) : 0;
  })()`).then((height) => {
    if (!trayWindow || trayWindow.isDestroyed() || !Number.isFinite(height) || height <= 0) return;
    trayMenuHeight = Math.max(TRAY_MENU_MIN_HEIGHT, Math.min(TRAY_MENU_MAX_HEIGHT, height));
    const next = trayBounds();
    trayWindow.setSize(Math.round(TRAY_MENU_WIDTH * trayScale()), Math.round(trayMenuHeight * trayScale()), false);
    trayWindow.setPosition(next.x, next.y, false);
  }).catch(() => {});
}

function showTrayWindow() {
  const position = trayBounds();
  if (!trayWindow || trayWindow.isDestroyed()) {
    trayWindow = new BrowserWindow({
      width: Math.round(TRAY_MENU_WIDTH * trayScale()),
      height: Math.round(TRAY_MENU_MAX_HEIGHT * trayScale()),
      x: position.x,
      y: position.y,
      show: false,
      frame: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'tray-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    // Clicking anywhere outside the panel (another app, the desktop, or the
    // empty margin of this window) closes the tray; see tray.html's
    // pointerdown handler, which hides via the 'tray:dismiss' channel.
    trayWindow.on('blur', () => {
      if (!trayWindow || trayWindow.isDestroyed() || !trayWindow.isVisible()) return;
      // Fade out quickly, then actually hide the OS window.
      void trayWindow.webContents.executeJavaScript(`window.__trayExit && window.__trayExit();`).catch(() => {});
      setTimeout(() => { if (trayWindow && !trayWindow.isDestroyed()) trayWindow.hide(); }, 110);
    });
    trayWindow.loadFile(path.join(__dirname, '..', 'src', 'tray.html'));
  }
  // Keep the window in step with the current tray scale preference, then
  // re-measure the content height (games list changes) and fit.
  const next = trayBounds();
  trayWindow.setSize(Math.round(TRAY_MENU_WIDTH * trayScale()), Math.round(trayMenuHeight * trayScale()), false);
  trayWindow.setPosition(next.x, next.y, false);
  trayWindow.webContents.send('tray:games', recentGamesForTray, trayStyle);
  setTimeout(fitTrayWindowToContent, 60);
  if (!trayWindow.isVisible()) {
    // Rise-from-taskbar entrance, like a native tray flyout.
    trayWindow.show();
    trayWindow.focus();
    void trayWindow.webContents.executeJavaScript(`window.__trayEnter && window.__trayEnter();`).catch(() => {});
  } else {
    trayWindow.focus();
  }
}

function createTray() {
  if (tray) return;
  trayIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'vortex-app-icon.ico'));
  if (trayIcon.isEmpty()) trayIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'vortex-app-icon.svg'));
  tray = new Tray(trayIcon.isEmpty() ? undefined : trayIcon);
  tray.setToolTip('Vortex — Roblox Place Launcher');
  // Left click opens the app, the right click opens the tray panel — both
  // use the styled window so the tray always matches the launcher design.
  tray.on('click', () => showMainWindowFromTray());
  tray.on('right-click', () => showTrayWindow());
}

function showMainWindowFromTray() {
  const window = BrowserWindow.getAllWindows().find((item) => !item.isDestroyed() && item !== trayWindow);
  if (!window) { createWindow(); return; }
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

async function launchFromTray(placeId) {
  const normalizedId = String(placeId ?? '');
  if (!/^\d{5,20}$/.test(normalizedId)) return;
  try {
    await shell.openExternal(`roblox://placeId=${normalizedId}`);
  } catch {
    await shell.openExternal(`https://www.roblox.com/games/start?placeId=${normalizedId}`);
  }
  if (trayWindow && !trayWindow.isDestroyed()) trayWindow.hide();
}

ipcMain.on('tray:recent-games', (_event, payload = []) => {
  // The renderer sends { games, style }: the games feed the tray list and the
  // context menu, the style payload lets tray.html match the launcher design.
  const request = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : { games: payload };
  recentGamesForTray = (Array.isArray(request.games) ? request.games : [])
    .filter((game) => game && /^\d{5,20}$/.test(String(game.id)) && String(game.title || '').length > 0)
    .slice(0, 5)
    .map((game) => ({
      id: String(game.id),
      title: String(game.title).slice(0, 60),
      // Roblox CDN thumbnails for the tray rows (optional, sanitized).
      thumbnail: /^https:\/\/tr\.rbxcdn\.com\/.+$/.test(String(game.thumbnail || '')) ? String(game.thumbnail) : '',
      lastPlayed: Number(game.lastPlayed) > 0 ? Number(game.lastPlayed) : 0
    }));
  if (request.style && typeof request.style === 'object') trayStyle = sanitizeTrayStyle(request.style);
  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.webContents.send('tray:games', recentGamesForTray, trayStyle);
    setTimeout(fitTrayWindowToContent, 60);
  }
});

ipcMain.handle('tray:get-style', () => trayStyle);

ipcMain.on('tray:open', () => { if (trayWindow && !trayWindow.isDestroyed()) trayWindow.hide(); showMainWindowFromTray(); });
ipcMain.on('tray:dismiss', () => { if (trayWindow && !trayWindow.isDestroyed()) trayWindow.hide(); });
ipcMain.on('tray:quit', () => app.exit(0));
ipcMain.handle('tray:get-games', () => recentGamesForTray);
ipcMain.on('tray:launch', (_event, placeId) => { void launchFromTray(placeId); });

app.whenReady().then(async () => {
  await loadRobloxCookie();
  if (!gotSingleInstanceLock) return;
  Menu.setApplicationMenu(null);
  createTray();
  createWindow();
  void checkForUpdates();
  app.on('activate', () => {
    showMainWindowFromTray();
  });
});

// Discord Rich Presence over the local IPC pipe. The discord-rpc style handshake
// is small enough to speak directly, so no extra dependency is needed.
let discordSocket = null;
let discordReady = false;
let discordReconnectTimer = null;
let discordActivity = null;
let discordEnabled = false;
const DISCORD_CLIENT_ID = '1030000000000000000';

function discordPipePath(index) {
  return process.platform === 'win32' ? `\\\\?\\pipe\\discord-ipc-${index}` : path.join(process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp', `discord-ipc-${index}`);
}

function discordFrame(opcode, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const header = Buffer.alloc(8);
  header.writeInt32LE(opcode, 0);
  header.writeInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

let discordPending = Buffer.alloc(0);

function connectDiscord() {
  if (discordSocket || !DISCORD_CLIENT_ID) return;
  const attempts = [0, 1, 2, 3];
  const tryIndex = (position) => {
    if (position >= attempts.length) { scheduleDiscordReconnect(); return; }
    const socket = net.createConnection(discordPipePath(attempts[position]));
    socket.once('connect', () => {
      discordSocket = socket;
      discordReady = false;
      socket.write(discordFrame(0, { v: 1, client_id: DISCORD_CLIENT_ID }));
      socket.on('data', (chunk) => {
        discordPending = Buffer.concat([discordPending, chunk]);
        while (discordPending.length >= 8) {
          const length = discordPending.readInt32LE(4);
          if (discordPending.length < 8 + length) break;
          const body = JSON.parse(discordPending.subarray(8, 8 + length).toString('utf8'));
          discordPending = discordPending.subarray(8 + length);
          if (body.cmd === 'DISPATCH' && body.evt === 'READY') { discordReady = true; pushDiscordActivity(); }
        }
      });
      socket.on('error', () => cleanupDiscord());
      socket.on('close', () => cleanupDiscord());
    });
    socket.once('error', () => { socket.destroy(); tryIndex(position + 1); });
  };
  tryIndex(0);
}

function cleanupDiscord() {
  if (discordSocket) { try { discordSocket.destroy(); } catch { /* already closed */ } }
  discordSocket = null;
  discordReady = false;
  discordPending = Buffer.alloc(0);
  scheduleDiscordReconnect();
}

function scheduleDiscordReconnect() {
  if (!discordEnabled || discordReconnectTimer) return;
  discordReconnectTimer = setTimeout(() => { discordReconnectTimer = null; connectDiscord(); }, 20000);
  discordReconnectTimer.unref?.();
}

function pushDiscordActivity() {
  if (!discordSocket || !discordReady) return;
  const activity = discordEnabled && discordActivity
    ? { details: String(discordActivity.details || '').slice(0, 128), state: String(discordActivity.state || '').slice(0, 128), assets: { large_text: 'Vortex Launcher' } }
    : null;
  try {
    discordSocket.write(discordFrame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity }, nonce: randomUUID() }));
  } catch { cleanupDiscord(); }
}

ipcMain.handle('discord:set-enabled', (_event, enabled) => {
  discordEnabled = Boolean(enabled);
  if (discordEnabled) connectDiscord(); else pushDiscordActivity();
  return { enabled: discordEnabled, connected: discordReady };
});

ipcMain.handle('discord:set-activity', (_event, activity) => {
  discordActivity = activity && typeof activity === 'object' ? activity : null;
  pushDiscordActivity();
  return { connected: discordReady };
});

// Fires a Windows toast when a friend starts playing one of your favourites.
ipcMain.handle('notifications:friend-playing', (_event, payload = {}) => {
  if (!Notification.isSupported()) return false;
  const friend = String(payload.friend || '').slice(0, 60);
  const game = String(payload.game || '').slice(0, 90);
  if (!friend || !game) return false;
  const notification = new Notification({ title: `${friend} играет в избранное`, body: game, silent: false });
  notification.on('click', () => { showMainWindowFromTray(); });
  notification.show();
  return true;
});

