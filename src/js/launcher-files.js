function listCollectionGames() {
  const games = [...favorites].map(id => getGame(id) || { id: String(id), title: 'Roblox #' + id });
  return [...new Map([...games, ...openGameTabs.map(tab => tab.game)].map(game => [String(game.id), game])).values()];
}

function collectionGame(game) {
  const id = String(game?.id || '');
  if (!gameIdPattern.test(id)) return null;
  return { id, title: String(game.title || 'Roblox #' + id).slice(0, 140), thumbnail: safeThumbnail(game.thumbnail) };
}

function inspectPackSuspiciousUrls(payload) {
  const suspicious = [];
  if (typeof inspectRobloxLinkSafety !== 'function' || !payload || typeof payload !== 'object') return suspicious;
  const scanValue = (val) => {
    if (typeof val !== 'string') return;
    const check = inspectRobloxLinkSafety(val);
    if (check.isUrl && !check.authentic && !val.startsWith('https://tr.rbxcdn.com/') && !val.startsWith('https://t0.rbxcdn.com/') && !/^https:\/\/[a-z0-9-]+\.rbxcdn\.com\//i.test(val)) {
      suspicious.push(check);
    }
  };
  const walk = (node, depth = 0) => {
    if (!node || depth > 4) return;
    if (typeof node === 'string') { scanValue(node); return; }
    if (Array.isArray(node)) { node.forEach(item => walk(item, depth + 1)); return; }
    if (typeof node === 'object') { Object.values(node).forEach(v => walk(v, depth + 1)); }
  };
  walk(payload);
  return suspicious;
}

async function hydratePackAuthors(containerSelector, placeIds) {
  if (typeof resolveGameSecurityMeta !== 'function' || !Array.isArray(placeIds) || !placeIds.length) return;
  const unique = [...new Set(placeIds.map(String).filter(id => /^\d{1,20}$/.test(id)))].slice(0, 20);
  await Promise.all(unique.map(async (id) => {
    const meta = await resolveGameSecurityMeta(id);
    if (!meta) return;
    document.querySelectorAll(`${containerSelector} [data-verify-place="${id}"]`).forEach((slot) => {
      const creator = meta.creator ? escapeHtml(meta.creator) : t('security.authorUnknown');
      const verified = meta.creatorVerified ? ' <span class="security-verified-mark">✓</span>' : '';
      slot.innerHTML = `${t('security.authorLabel')}: ${creator}${verified}`;
    });
  }));
}

function openCollectionEditor(payload = null, localCollection = null) {
  const imported = payload !== null;
  if (imported && (payload?.app !== 'vortex-collection' || payload.version !== 1 || !Array.isArray(payload.games))) {
    showToast(t('settings.data.invalid'));
    return;
  }
  const suspicious = imported ? inspectPackSuspiciousUrls(payload) : [];
  const candidates = imported ? payload.games : localCollection ? localCollection.games.filter(id => favorites.has(id)).map(libraryGame) : listCollectionGames();
  const games = [...new Map(candidates.slice(0, 300)
    .map(collectionGame).filter(Boolean).map(game => [game.id, game])).values()];
  collectionDraft = { imported, games, name: String(payload?.title || localCollection?.title || '').slice(0, 100) };
  const securityBanner = imported
    ? (suspicious.length
      ? `<div class="security-domain-pill is-danger">${icon('alert', 13)} ${t('security.packWarning')}</div>`
      : `<div class="security-domain-pill is-safe">${icon('check', 13)} ${t('security.packVerified')}</div>`)
    : '';
  openLauncherDialog(t(imported ? 'tools.openCollection' : 'tools.collection'), `<form data-launcher-form="collection" class="launcher-dialog-form">
    ${securityBanner}
    <label>${t('tools.collectionName')}<input name="title" maxlength="100" value="${escapeHtml(collectionDraft.name)}" ${imported ? 'readonly' : ''}></label>
    ${games.length ? `<ul class="launcher-dialog-list launcher-collection-list" data-verify-pack-list>${games.map(game =>
      `<li><label><input type="checkbox" name="games" value="${game.id}" checked>${gameArt(game)}<span class="shared-folder-copy"><strong>${escapeHtml(game.title)}</strong>${imported ? `<small class="shared-folder-author" data-verify-place="${escapeHtml(game.id)}">${t('security.checkingPack')}</small>` : ''}</span></label></li>`).join('')}</ul>
      <button class="primary-button" type="submit">${t(imported ? 'tools.saveSelected' : 'tools.downloadCollection')}</button>`
      : `<p>${t('tools.collectionEmpty')}</p>`}</form>`);
  if (imported && games.length) void hydratePackAuthors('[data-verify-pack-list]', games.map(g => g.id));
}

function pickCollectionFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.vortex-collection,.json,application/json';
  input.hidden = true;
  function removeInput() { input.remove(); }
  input.addEventListener('cancel', removeInput, { once: true });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    removeInput();
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Collection too large');
      const payload = JSON.parse(await file.text());
      if (payload?.app === 'vortex-quick-folder') openSharedFolder(payload);
      else openCollectionEditor(payload);
    } catch { showToast(t('settings.data.invalid')); }
  }, { once: true });
  document.body.append(input);
  input.click();
}

async function saveShareDocument(title, suffix, payload) {
  const filename = (title.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 48) || 'vortex') + suffix;
  const contents = JSON.stringify(payload, null, 2);
  try {
    if (await window.vortexDesktop.saveShareFile({ filename, contents })) {
      launcherDialog.close();
      showToast(t('tools.fileSaved'));
    }
  } catch { showToast(t('tools.fileSaveError')); }
}

async function submitCollection(form) {
  const selected = new Set(form.getAll('games'));
  const games = collectionDraft.games.filter(game => selected.has(game.id));
  if (!games.length) { showToast(t('tools.selectSome')); return; }
  if (collectionDraft.imported) {
    for (const game of games) {
      favorites.add(game.id);
      if (!getGame(game.id)) dynamicGames.push({ ...game, genreKey: 'other' });
    }
    dynamicGames = dynamicGames.slice(-1200);
    try { localStorage.setItem('vortex.discovered', JSON.stringify(dynamicGames)); } catch { /* In-memory cache. */ }
    accountStorage.setItem('vortex.favorites', JSON.stringify([...favorites]));
    const collections = favoriteCollections();
    if (collectionDraft.name.trim() && collections.length < 80) {
      activeFavoriteCollection = quickLaunchId();
      preferences.favoriteCollections = [...collections, {
        id: activeFavoriteCollection, title: collectionDraft.name.trim().slice(0, 60), games: games.map(game => game.id)
      }];
      savePreferences();
    }
    renderPage();
    showToast(t('tools.collectionSaved'));
  } else {
    const title = String(form.get('title') || '').trim().slice(0, 100);
    await saveShareDocument(title, '.vortex-collection.json', { app: 'vortex-collection', version: 1, title, games });
    return;
  }
  launcherDialog.close();
}

let sharedQuickFolder;
function folderGamesPreview(games, showAuthors = false) {
  return `<ul class="launcher-dialog-list launcher-collection-list" data-verify-folder-list>${games.map(game => `<li><span class="shared-folder-game">
    ${gameArt(game)}<span class="shared-folder-copy"><strong>${escapeHtml(preferences.streamMode && game.method !== 'public' ? t('tools.privateShortcut') : game.title || 'Roblox #' + game.placeId)}</strong>${showAuthors && game.placeId ? `<small class="shared-folder-author" data-verify-place="${escapeHtml(String(game.placeId))}">${t('security.checkingPack')}</small>` : ''}</span>
    ${game.method !== 'public' ? icon('lock', 13) : ''}</span></li>`).join('')}</ul>`;
}

function openQuickFolderShare(id) {
  if (preferences.streamMode) return;
  const folder = preferences.quickLaunchItems.find(item => item.id === id && item.type === 'folder');
  if (!folder) return;
  sharedQuickFolder = folder;
  openLauncherDialog(t('tools.shareFolder'), `<form data-launcher-form="folder-export" class="launcher-dialog-form">
    <strong>${escapeHtml(folder.title || t('quick.folderDefault'))}</strong>
    ${folderGamesPreview(folder.games)}
    ${folder.games.some(game => game.method !== 'public') ? `<p class="catalog-disclaimer">${t('tools.folderPrivateLinks')}</p>` : ''}
    <div class="folder-share-actions">
      <button class="ghost-button" type="button" data-copy-folder-code>${icon('link', 14)} ${t('tools.copyFolderCode')}</button>
      <button class="primary-button" type="submit">${t('tools.saveFolder')}</button>
    </div></form>`);
}

document.addEventListener('click', async (event) => {
  const btn = event.target.closest?.('[data-copy-folder-code]');
  if (!btn || !sharedQuickFolder || typeof encodeQuickFolderCode !== 'function') return;
  const code = encodeQuickFolderCode(sharedQuickFolder);
  if (!code) {
    showToast(t('tools.folderCodeTooLarge'));
    return;
  }
  await copyText(code);
  showToast(t('tools.folderCodeCopied'));
});

async function submitQuickFolderShare() {
  const { title, color, games, server, showInTray } = sharedQuickFolder;
  const entries = games.map(({ method, placeId, title, thumbnail, linkCode, shareCode, shareType, serverId, accessCode }) =>
    ({ method, placeId, title, thumbnail, linkCode, shareCode, shareType, serverId, accessCode }));
  await saveShareDocument(title || t('quick.folderDefault'), '.vortex-folder.json', {
    app: 'vortex-quick-folder', version: 1, title, color, server, showInTray, games: entries
  });
}

function openSharedFolder(payload) {
  if (payload.version !== 1 || !Array.isArray(payload.games)) { showToast(t('settings.data.invalid')); return; }
  const suspicious = inspectPackSuspiciousUrls(payload);
  const games = payload.games.slice(0, 80).filter(game => game && typeof game === 'object' &&
    ['public', 'private', 'share', 'instance', 'access'].includes(game.method))
    .map(game => ({ ...game, type: 'game', id: quickLaunchId(), hotkey: null, lastPlayed: 0 }));
  const [folder] = cleanQuickLaunchItems([{ type: 'folder', id: quickLaunchId(), title: payload.title, color: payload.color, server: payload.server, showInTray: payload.showInTray, games }]);
  if (folder?.type !== 'folder') { showToast(t('tools.folderInvalid')); return; }
  sharedQuickFolder = folder;
  const securityBanner = suspicious.length
    ? `<div class="security-domain-pill is-danger">${icon('alert', 13)} ${t('security.packWarning')}</div>`
    : `<div class="security-domain-pill is-safe">${icon('check', 13)} ${t('security.packVerified')}</div>`;
  openLauncherDialog(t('tools.openFolder'), `<form data-launcher-form="folder-import" class="launcher-dialog-form">
    ${securityBanner}
    <strong>${escapeHtml(folder.title || t('quick.folderDefault'))}</strong>
    ${folderGamesPreview(folder.games, true)}<button class="primary-button" type="submit">${t('tools.addFolder')}</button></form>`);
  void hydratePackAuthors('[data-verify-folder-list]', folder.games.map(g => g.placeId).filter(Boolean));
}

function submitSharedFolder() {
  if (preferences.quickLaunchItems.length >= 80) { showToast(t('tools.folderLimit')); return; }
  preferences.quickLaunchItems.push(sharedQuickFolder);
  if (currentView === 'quick') selectedLibraryFolder = sharedQuickFolder.id;
  quickFoldersOpen.add(sharedQuickFolder.id);
  persistQuickLaunchItems();
  launcherDialog.close();
  showToast(t('tools.folderAdded'));
}

function listImportChanges(before, after, identify, describe) {
  const previous = new Map(before.map(item => [identify(item), item]));
  const changes = [];
  for (const item of after) {
    const id = identify(item);
    const prior = previous.get(id);
    if (!prior) changes.push('+ ' + describe(item));
    else if (JSON.stringify(prior) !== JSON.stringify(item)) changes.push('↔ ' + describe(item));
    previous.delete(id);
  }
  for (const item of previous.values()) changes.push('− ' + describe(item));
  return changes;
}

function previewLauncherImport(payload) {
  const data = validateDataBackup(payload);
  const incoming = Object.entries(backupPreferences(data.preferences))
    .filter(([key, value]) => JSON.stringify(preferences[key]) !== JSON.stringify(value))
    .map(([key]) => settingName(key));
  const profiles = readProfiles();
  for (const [name, profile] of Object.entries(data.profiles || {})) {
    if (JSON.stringify(profiles[name]) !== JSON.stringify(profile)) incoming.push(name);
  }
  const folderChanges = cleanQuickLaunchItems(data.preferences.quickLaunchItems);
  const id = item => String(item?.id || item);
  const label = item => item?.title || getGame(id(item))?.title || 'Roblox #' + id(item);
  const libraryChanges = [
    ...(Array.isArray(data.favorites) ? listImportChanges([...favorites], data.favorites, id, label) : []),
    ...(Array.isArray(data.customGames) ? listImportChanges(preferences.customGames, data.customGames, id, label) : [])
  ];
  const launchLabel = entry => {
    if (entry.type === 'folder') return entry.title || t('quick.folderDefault');
    return preferences.streamMode && entry.method !== 'public' ? t('tools.privateShortcut') : entry.title || entry.placeId;
  };
  const sections = [];
  if (incoming.length) sections.push(['settings', 'tools.importSettings', incoming]);
  if (libraryChanges.length) sections.push(['library','tools.importLibrary', libraryChanges]);
  if (Array.isArray(data.preferences.quickLaunchItems)) {
    const changed = listImportChanges(preferences.quickLaunchItems, folderChanges, id, launchLabel);
    if (changed.length) sections.push(['folders','tools.importFolders',changed]);
  }
  if (data.friendPins) {
    const pinChanges = listImportChanges(Object.entries(friendPins()), Object.entries(data.friendPins),
      ([id]) => id, ([id]) => id);
    if (pinChanges.length) sections.push(['friends', 'tools.importFriends', pinChanges]);
  }
  if (BACKUP_SECTIONS.activity.some(key => Object.hasOwn(data, key))) {
    const sessions = data.sessionHistory || [];
    const labels = sessions.slice(0, 20).map(row => row.title || 'Roblox #' + row.gameId);
    if (!sessions.length) labels.push(t('tools.importKeepJournal'));
    sections.push(['activity','tools.importActivity', labels, sessions.length]);
  }
  if (!sections.length) { showToast(t('settings.data.invalid')); return; }
  importPreview = payload;
  openLauncherDialog(t('tools.importCompare'), `<form data-launcher-form="backup-import" class="launcher-dialog-form">
    <p class="catalog-disclaimer">${t('tools.importStorage')}</p>
    ${sections.map(([key, label, changes, count = changes.length]) => `<details class="launcher-import-section"><summary>
      <input type="checkbox" name="groups" value="${key}" aria-label="${t(label)}">
      <strong>${t(label)}</strong> <small>${key === 'activity' ? t('tools.importSessions', { count }) : t('tools.importChange', { count })}</small></summary>
      <ul>${changes.slice(0, 20).map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul></details>`).join('')}
    <button class="primary-button" type="submit">${t('tools.saveSelected')}</button></form>`);
}

function settingName(key) {
  const item = settingIndex.find(([, setting]) => setting === key);
  return item ? t(item[2]) : key;
}

async function submitLauncherImport(form) {
  const picked = new Set(form.getAll('groups'));
  if (!picked.size) { showToast(t('tools.selectSome')); return; }
  if (!importPreview || dataImportInProgress) return;
  const submit = launcherDialog.querySelector('[data-launcher-form="backup-import"] [type="submit"]');
  if (submit) submit.disabled = true;
  try {
    if (await applyDataImport(importPreview, picked)) {
      launcherDialog.close();
      showToast(t('settings.data.imported'));
    }
  } catch { showToast(t('tools.importWriteError')); }
  finally { if (submit) submit.disabled = false; }
}
