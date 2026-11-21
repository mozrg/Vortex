function listCollectionGames() {
  const games = [...favorites].map(id => getGame(id) || { id: String(id), title: 'Roblox #' + id });
  return [...new Map([...games, ...openGameTabs.map(tab => tab.game)].map(game => [String(game.id), game])).values()];
}

function collectionGame(game) {
  const id = String(game?.id || '');
  if (!gameIdPattern.test(id)) return null;
  return { id, title: String(game.title || 'Roblox #' + id).slice(0, 140), thumbnail: safeThumbnail(game.thumbnail) };
}

function openCollectionEditor(payload = null, localCollection = null) {
  const imported = payload !== null;
  if (imported && (payload?.app !== 'vortex-collection' || payload.version !== 1 || !Array.isArray(payload.games))) {
    showToast(t('settings.data.invalid'));
    return;
  }
  const candidates = imported ? payload.games : localCollection ? localCollection.games.filter(id => favorites.has(id)).map(libraryGame) : listCollectionGames();
  const games = [...new Map(candidates.slice(0, 300)
    .map(collectionGame).filter(Boolean).map(game => [game.id, game])).values()];
  collectionDraft = { imported, games, name: String(payload?.title || localCollection?.title || '').slice(0, 100) };
  openLauncherDialog(t(imported ? 'tools.openCollection' : 'tools.collection'), `<form data-launcher-form="collection" class="launcher-dialog-form">
    <label>${t('tools.collectionName')}<input name="title" maxlength="100" value="${escapeHtml(collectionDraft.name)}" ${imported ? 'readonly' : ''}></label>
    ${games.length ? `<ul class="launcher-dialog-list launcher-collection-list">${games.map(game =>
      `<li><label><input type="checkbox" name="games" value="${game.id}" checked>${gameArt(game)}<span>${escapeHtml(game.title)}</span></label></li>`).join('')}</ul>
      <button class="primary-button" type="submit">${t(imported ? 'tools.saveSelected' : 'tools.downloadCollection')}</button>`
      : `<p>${t('tools.collectionEmpty')}</p>`}</form>`);
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
function folderGamesPreview(games) {
  return `<ul class="launcher-dialog-list launcher-collection-list">${games.map(game => `<li><span class="shared-folder-game">
    ${gameArt(game)}<strong>${escapeHtml(preferences.streamMode && game.method !== 'public' ? t('tools.privateShortcut') : game.title || 'Roblox #' + game.placeId)}</strong>
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
    <button class="primary-button" type="submit">${t('tools.saveFolder')}</button></form>`);
}

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
  const games = payload.games.slice(0, 80).filter(game => game && typeof game === 'object' &&
    ['public', 'private', 'share', 'instance', 'access'].includes(game.method))
    .map(game => ({ ...game, type: 'game', id: quickLaunchId(), hotkey: null, lastPlayed: 0 }));
  const [folder] = cleanQuickLaunchItems([{ type: 'folder', id: quickLaunchId(), title: payload.title, color: payload.color, server: payload.server, showInTray: payload.showInTray, games }]);
  if (folder?.type !== 'folder') { showToast(t('tools.folderInvalid')); return; }
  sharedQuickFolder = folder;
  openLauncherDialog(t('tools.openFolder'), `<form data-launcher-form="folder-import" class="launcher-dialog-form">
    <strong>${escapeHtml(folder.title || t('quick.folderDefault'))}</strong>
    ${folderGamesPreview(folder.games)}<button class="primary-button" type="submit">${t('tools.addFolder')}</button></form>`);
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

const profilePreferenceKeys = ['robloxUsername','robloxDisplayName','robloxAvatar','robloxAccountId','friendsNoticeAccepted'];
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
  const data = payload?.data;
  if (payload?.app !== 'vortex' || !data?.preferences || typeof data.preferences !== 'object' || Array.isArray(data.preferences)) {
    showToast(t('settings.data.invalid'));
    return;
  }
  const excluded = new Set([...profilePreferenceKeys, 'customGames','quickLaunchItems','settingsTab','streamMode']);
  const incoming = Object.fromEntries(Object.entries(data.preferences)
    .filter(([key, value]) => Object.hasOwn(preferenceDefaults, key) && !excluded.has(key)
      && JSON.stringify(preferences[key]) !== JSON.stringify(value)));
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
  if (Object.keys(incoming).length) sections.push(['settings', 'tools.importSettings', Object.keys(incoming).map(settingName)]);
  if (libraryChanges.length) sections.push(['library','tools.importLibrary', libraryChanges]);
  if (Array.isArray(data.preferences.quickLaunchItems)) {
    const changed = listImportChanges(preferences.quickLaunchItems, folderChanges, id, launchLabel);
    if (changed.length) sections.push(['folders','tools.importFolders',changed]);
  }
  if (data.sessionHistory || data.activityData || data.playStats) {
    sections.push(['activity','tools.importActivity', (Array.isArray(data.sessionHistory) ? data.sessionHistory : [])
      .map(row => row?.title || 'Roblox #' + row?.gameId)]);
  }
  if (!sections.length) { showToast(t('settings.data.invalid')); return; }
  importPreview = { payload, incoming, folderChanges };
  openLauncherDialog(t('tools.importCompare'), `<form data-launcher-form="backup-import" class="launcher-dialog-form">
    <p class="catalog-disclaimer">${t('tools.importStorage')}</p>
    ${sections.map(([key, label, changes]) => `<details class="launcher-import-section"><summary>
      <input type="checkbox" name="groups" value="${key}" aria-label="${t(label)}">
      <strong>${t(label)}</strong> <small>${t('tools.importChange', { count: changes.length })}</small></summary>
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
  const { payload, incoming, folderChanges } = importPreview;
  const data = { preferences: { ...preferences } };
  if (picked.has('settings')) Object.assign(data.preferences, incoming);
  if (picked.has('folders')) data.preferences.quickLaunchItems = folderChanges;
  if (picked.has('library')) for (const key of ['favorites','customGames']) data[key] = payload.data[key];
  if (picked.has('activity')) for (const key of ['recentGames','recentDetails','activityData','playStats','sessionHistory']) data[key] = payload.data[key];
  try {
    if (await applyDataImport({ ...payload, data })) {
      launcherDialog.close();
      showToast(t('settings.data.imported'));
    }
  } catch { showToast(t('settings.data.importError')); }
}
