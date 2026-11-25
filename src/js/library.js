const libraryTabs = [
  { id: 'favorites', icon: 'star', label: 'nav.favorites' },
  { id: 'recent', icon: 'history', label: 'nav.recent' },
  { id: 'quick', icon: 'rocket', label: 'library.quick' },
  { id: 'activity', icon: 'activity', label: 'nav.activity' }
];
let lastLibraryTab = 'favorites';
let activeFavoriteCollection = '';
let favoriteGenre = '';
let favoriteSort = 'new';
let favoriteSearch = '';
let recentFilter = 'all';
let recentPlace = '';
let selectedLibraryFolder = '';
let recentJournalRows = [];
let recentJournalKey = null;
let recentDetails = null;

function libraryGame(id) {
  id = String(id);
  return getGame(id) || { id, title: 'Roblox #' + id, genreKey: 'other' };
}

function libraryArt(game) {
  const image = safeThumbnail(game?.thumbnail);
  return `<span class="library-art">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">` : icon('gamepad', 17)}</span>`;
}

function librarySelect(key, label, options, value) {
  const text = t(label);
  return renderVortexDropdown({ label: text, prefix: text, value, kind: key,
    options: options.map(([id, name]) => ({ value: id, text: name })),
    input: `<input type="hidden" data-vortex-field data-library-select="${key}" value="${escapeHtml(value)}">` });
}

function libraryAction(action, label, glyph, data = '', primary = false) {
  return `<button type="button" class="${primary ? 'primary-button' : 'control-button'}" data-library-action="${action}" ${data}>
    ${icon(glyph, 14)} ${t(label)}</button>`;
}

function renderLibrary() {
  const tab = libraryTabs.find(entry => entry.id === currentView) || libraryTabs[0];
  const counts = { favorites: favorites.size, recent: uniqueRecentIds(recentGames).length, quick: quickLaunchGames().length };
  const renderers = { favorites: renderLibraryFavorites, recent: renderLibraryRecent, quick: renderLibraryQuick, activity: renderLibraryActivity };
  return `<section class="library-page">
    ${pageHeading('', t('nav.library'), t('library.' + tab.id + 'Hint'))}
    <nav class="library-tabs" aria-label="${t('nav.library')}">${libraryTabs.map(entry =>
      `<button type="button" class="filter-chip" data-nav="${entry.id}" ${entry.id === tab.id ? 'aria-current="page"' : ''}>
        ${icon(entry.icon, 15)} ${t(entry.label)} ${counts[entry.id] ? `<span>${counts[entry.id]}</span>` : ''}</button>`).join('')}</nav>
    ${renderers[tab.id]()}
  </section>`;
}

function favoriteCollections() {
  const source = Array.isArray(preferences.favoriteCollections) ? preferences.favoriteCollections : [];
  return source.slice(0, 80).flatMap(entry => {
    if (typeof entry?.id !== 'string' || !/^[a-z\d_-]{1,64}$/i.test(entry.id) || typeof entry.title !== 'string') return [];
    const ids = Array.isArray(entry.games) ? entry.games.map(String).filter(id => gameIdPattern.test(id)) : [];
    return [{ id: entry.id, title: entry.title.slice(0, 60), games: [...new Set(ids)] }];
  });
}

function currentFavoriteCollection() {
  return favoriteCollections().find(entry => entry.id === activeFavoriteCollection);
}

function renderLibraryFavorites() {
  const collections = favoriteCollections();
  const selected = currentFavoriteCollection();
  const games = (selected?.games || [...favorites]).filter(id => favorites.has(id)).map(libraryGame).map(localizeGame);
  const genres = [...new Set(games.map(game => game.genre))].sort((a, b) => a.localeCompare(b, preferences.language));
  const genre = genres.includes(favoriteGenre) ? favoriteGenre : '';
  const fileButton = (action, label, glyph) => `<button type="button" class="control-button" data-launcher-action="${action}">${icon(glyph, 14)} ${t(label)}</button>`;
  return `<div class="library-toolbar">
    <div class="library-tools">${[{ id: '', title: t('library.all'), games: [...favorites] }, ...collections].map(entry => {
      const count = entry.games.filter(id => favorites.has(id)).length;
      return `<button type="button" class="filter-chip" data-library-action="favorite-collection" data-id="${entry.id}"
        aria-pressed="${entry.id === (selected?.id || '')}">${escapeHtml(entry.title)} <span>${count}</span></button>`;
    }).join('')}${libraryAction('edit-collection', 'library.newCollection', 'plus')}
    ${selected ? libraryAction('edit-collection', 'library.editCollection', 'edit', `data-id="${selected.id}"`) : ''}</div>
    <div class="library-tools">
      <label class="library-search">${icon('search', 14)}<input type="search" data-library-favorite-search
        aria-label="${t('library.findFavorite')}" placeholder="${t('library.findFavorite')}" value="${escapeHtml(favoriteSearch)}"></label>
      ${librarySelect('favorite-genre', 'library.genre', [['', t('library.all')], ...genres.map(name => [name, name])], genre)}
      ${librarySelect('favorite-sort', 'library.sort', [['new', t('library.newest')], ['name', t('library.byName')], ['played', t('library.byPlayed')]], favoriteSort)}
      ${selected ? libraryAction('share-collection', 'tools.collection', 'share') : fileButton('collection-export', 'tools.collection', 'share')}
      ${fileButton('collection-import', 'tools.openCollection', 'fileUp')}
    </div>
  </div><div id="library-favorite-results">${libraryFavoriteResults(games, genre, Boolean(selected))}</div>`;
}

function libraryFavoriteResults(games, genre, collection) {
  const term = favoriteSearch.trim().toLocaleLowerCase(preferences.language);
  const filtered = games.filter(game => (!genre || game.genre === genre) &&
    (!term || game.id.includes(term) || game.title.toLocaleLowerCase(preferences.language).includes(term)));
  if (favoriteSort === 'name') filtered.sort((a, b) => a.title.localeCompare(b.title, preferences.language));
  else if (favoriteSort === 'played') filtered.sort((a, b) => (playStats[b.id]?.lastPlayed || 0) - (playStats[a.id]?.lastPlayed || 0));
  else filtered.reverse();
  const visible = filtered.slice(0, favoritesVisibleCount);
  const more = filtered.length - visible.length;
  return `${visible.length ? `<div class="game-grid library-favorites-grid">${visible.map(game => renderGameCard(game, { draggable: true })).join('')}</div>` :
    renderGrid([], t('empty.favorites.title'), t(collection || genre || term ? 'library.emptyFiltered' : 'empty.favorites.body'))}
  ${more > 0 ? `<div class="load-more-row"><button class="control-button" data-action="favorites-more">${t('catalog.showMore', { count: String(Math.min(24, more)) })}</button></div>` : ''}`;
}

function editFavoriteCollection(id) {
  const collection = favoriteCollections().find(entry => entry.id === id);
  const selected = new Set(collection?.games || []);
  openLauncherDialog(t(collection ? 'library.editCollection' : 'library.newCollection'), `
    <form class="launcher-dialog-form" data-library-form="collection" data-id="${collection?.id || ''}">
      <label>${t('tools.collectionName')}<input name="title" required maxlength="60" value="${escapeHtml(collection?.title || '')}"></label>
      <ul class="launcher-dialog-list launcher-collection-list">${[...favorites].map(libraryGame).map(game => `<li><label>
        <input type="checkbox" name="game" value="${escapeHtml(game.id)}" ${selected.has(game.id) ? 'checked' : ''}>
        ${gameArt(game)}<span>${escapeHtml(game.title)}</span></label></li>`).join('')}</ul>
      <div class="library-tools"><button type="submit" class="primary-button">${t('common.save')}</button>
        ${collection ? libraryAction('delete-collection', 'library.deleteCollection', 'trash', `data-id="${collection.id}"`) : ''}</div>
    </form>`);
}

function recentMetadata() {
  if (!recentDetails) {
    recentDetails = readStored('vortex.recentDetails', {});
    if (!recentDetails || typeof recentDetails !== 'object' || Array.isArray(recentDetails)) recentDetails = {};
  }
  return recentDetails;
}

function cleanRecentDetails(rows, ids) {
  return Object.fromEntries(ids.flatMap(id => {
    const entry = rows?.[id];
    if (!entry || !Number.isSafeInteger(entry.at) || entry.at <= 0 || entry.at > Date.now() + 60000) return [];
    return [[id, { at: entry.at, serverId: validSessionServer(entry.serverId) }]];
  }));
}

function saveRecentDetails(rows) {
  recentDetails = cleanRecentDetails(rows, uniqueRecentIds(recentGames));
  accountStorage.setItem('vortex.recentDetails', JSON.stringify(recentDetails));
}

async function loadLibraryRecent(ids) {
  const key = ids.join(',');
  if (recentJournalKey === key) return;
  recentJournalKey = key;
  if (!ids.length) { recentJournalRows = []; return; }
  try {
    const rows = await latestJournalForExperiences(ids);
    if (recentJournalKey !== key) return;
    recentJournalRows = rows;
    if (currentView === 'recent') {
      const list = document.getElementById('library-recent-list');
      if (list && !list.contains(document.activeElement)) list.innerHTML = libraryRecentList(ids);
    }
  } catch {
    if (recentJournalKey === key) recentJournalKey = null;
  }
}

async function latestJournalForExperiences(ids) {
  const { gamesById } = playtimeForView();
  const groupOf = id => experienceKey(gamesById.get(String(id)) || { id });
  const wanted = new Set(ids.map(groupOf));
  const places = [...ids];
  for (const id of gamesById.keys()) {
    if (wanted.has(groupOf(id))) places.push(id);
  }
  const latest = await sessionJournal.latestByGame(places.map(String));
  return latest.filter(row => wanted.delete(groupOf(row.gameId)));
}

function renderLibraryRecent() {
  const ids = uniqueRecentIds(recentGames);
  void loadLibraryRecent(ids);
  return `<div class="library-toolbar">
    <div class="library-tools">${[['all', 'library.all'], ['favorites', 'library.onlyFavorites'], ['older', 'library.older']].map(([id, label]) =>
      `<button class="filter-chip" type="button" data-library-action="recent-filter" data-id="${id}" aria-pressed="${id === recentFilter}">${t(label)}</button>`).join('')}
      ${librarySelect('recent-place', 'library.game', [['', t('library.allGames')], ...ids.map(id => [id, libraryGame(id).title])], recentPlace)}
    </div>${ids.length ? libraryAction('clear-recent', 'library.clearHistory', 'trash') : ''}
    </div><div id="library-recent-list">${libraryRecentList(ids)}</div>`;
}

function libraryRecentList(ids) {
  const now = Date.now();
  const fmt = new Intl.DateTimeFormat(preferences.language, { dateStyle: 'medium', timeStyle: 'short' });
  const groups = new Map();
  const latest = new Map(recentJournalRows.map(row => [experienceKey(libraryGame(row.gameId)), row]));
  const recent = recentMetadata();
  for (const id of ids) {
    if (recentPlace && recentPlace !== id || recentFilter === 'favorites' && !favorites.has(id)) continue;
    const game = libraryGame(id);
    const row = latest.get(experienceKey(game));
    const timestamps = [recent[id]?.at, Number(playStats[id]?.lastLaunchAt), row?.startedAt];
    const launched = Math.max(0, ...timestamps.filter(value => Number.isSafeInteger(value) && value > 0 && value <= now + 60000));
    const age = launched ? activityDayDistance(activityDateKey(launched), activityDateKey(now)) : Infinity;
    if (recentFilter === 'older' && age < 7) continue;
    const group = age === 0 ? 'today' : age === 1 ? 'yesterday' : age <= (new Date(now).getDay() + 6) % 7 ? 'lastWeek' : 'earlier';
    if (!groups.has(group)) groups.set(group, []);
    const server = preferences.streamMode ? '' : validSessionServer(launched > (row?.startedAt || 0) && recent[id]?.at === launched
      ? recent[id].serverId : row?.gameId === id ? row.serverId : '');
    groups.get(group).push(`<li class="library-recent-row">
      <button class="library-game-link" type="button" data-action="open-details" data-id="${id}">
        ${libraryArt(game)}<span><strong>${escapeHtml(game.title)}</strong><small>${launched ? fmt.format(launched) : '—'}</small></span></button>
      <span class="library-recent-duration">${row ? journalDuration(row, false) : '—'}</span>
      <div class="library-row-actions">
        ${server ? libraryAction('rejoin', 'library.rejoin', 'rotate', `data-id="${id}" data-server="${escapeHtml(server)}"`) : ''}
        <button class="icon-button library-favorite" type="button" data-action="favorite" data-id="${id}" aria-label="${t(favorites.has(id) ? 'card.favoriteRemove' : 'card.favoriteAdd')}"
          aria-pressed="${favorites.has(id)}">${icon('star', 16)}</button>
        <button class="primary-button" type="button" data-action="play" data-id="${id}">${icon('play', 13)} ${t('card.play')}</button>
      </div></li>`);
  }
  if (!groups.size) return renderGrid([], t('empty.recent.title'), t(ids.length ? 'library.emptyFiltered' : 'empty.recent.body'));
  return `<div class="library-panel library-recent-groups">${['today', 'yesterday', 'lastWeek', 'earlier'].filter(group => groups.has(group))
    .map(group => `<section><h2>${t('library.' + group)}</h2><ul>${groups.get(group).join('')}</ul></section>`).join('')}</div>`;
}

function refreshLibraryQuick() {
  if (currentView === 'quick' && !libraryDrag?.ghost) renderPage();
}

function libraryQuickFolder(id) {
  return preferences.quickLaunchItems.find(item => item.type === 'folder' && item.id === id);
}

function renderLibraryQuick() {
  const folders = preferences.quickLaunchItems.filter(item => item.type === 'folder');
  const loose = preferences.quickLaunchItems.filter(item => item.type === 'game');
  const folder = libraryQuickFolder(selectedLibraryFolder) || (!loose.length && selectedLibraryFolder !== '@loose' ? folders[0] : null);
  selectedLibraryFolder = folder?.id || '@loose';
  const games = folder?.games || loose;
  return `<div class="library-quick">
    <aside class="library-panel library-folders">
      <h2>${t('library.groups')}</h2>
      ${folders.map(item => `<button type="button" class="library-folder" data-library-action="pick-folder" data-id="${item.id}"
        data-library-drop-folder="${item.id}" aria-pressed="${item.id === folder?.id}">
        <i style="--folder-color:${item.color}">${icon('folder', 15)}</i><strong>${escapeHtml(item.title || t('quick.folderDefault'))}</strong><small>${item.games.length}</small></button>`).join('')}
      ${loose.length || !folders.length || !folder ? `<button type="button" class="library-folder" data-library-action="pick-folder" data-id="@loose" aria-pressed="${!folder}">
        <i>${icon('gamepad', 15)}</i><strong>${t('library.ungrouped')}</strong><small>${loose.length}</small></button>` : ''}
      ${libraryAction('new-folder', 'library.newGroup', 'plus')}
    </aside>
    <section class="library-quick-main">
      <div class="library-toolbar library-quick-heading"><div class="library-tools"><h2>${folder ? escapeHtml(folder.title || t('quick.folderDefault')) : t('library.ungrouped')}</h2>
        ${folder ? `<button type="button" class="icon-button" data-quick-folder-edit="${folder.id}" aria-label="${t('quick.folderEdit')}">${icon('edit', 15)}</button>` : ''}</div>
        ${folder ? `<label class="library-check"><input type="checkbox" data-library-select="tray-folder" ${folder.showInTray ? 'checked' : ''}> ${t('library.showInTray')}</label>` : ''}</div>
      <div class="library-toolbar"><div class="library-tools">
        ${folder ? librarySelect('folder-server', 'library.server', [['default', t('place.normalServer')], ['ping', t('place.bestPing')], ['small', t('place.fewerPlayers')]], folder.server) : ''}
        ${folder ? `<button type="button" class="icon-button" data-quick-remove="${folder.id}" aria-label="${t('library.ungroupFolder')}" data-tooltip="${t('library.ungroupFolder')}">${icon('trash', 15)}</button>` : ''}
      </div><div class="library-tools">
        <button type="button" class="control-button" data-launcher-action="collection-import">${icon('fileUp', 14)} ${t('library.import')}</button>
        ${folder && !preferences.streamMode ? `<button type="button" class="control-button" data-launcher-action="folder-export" data-id="${folder.id}">${icon('fileDown', 14)} ${t('library.export')}</button>` : ''}
        ${!preferences.streamMode ? libraryAction('add-quick', 'library.addGame', 'gamePlus', '', true) : ''}
      </div></div>
      ${games.length ? `<div class="library-quick-grid">${games.map(item => renderLibraryQuickGame(item, folder)).join('')}</div>` : ''}
      <div class="library-quick-drop" ${folder ? `data-library-drop-folder="${folder.id}"` : ''}>
        <p>${t(folder ? 'library.quickDrop' : 'library.quickEmpty')}</p>
        ${folder && favorites.size ? libraryAction('add-favorites', 'library.addFavorites', 'star') : ''}
      </div>
    </section></div>`;
}

function renderLibraryQuickGame(item, folder) {
  const hidden = preferences.streamMode && item.method !== 'public';
  const title = hidden ? t('tools.privateShortcut') : item.title || t('quick.untitled');
  const id = item.id;
  const tool = (name, label, glyph) => `<button type="button" class="icon-button" data-quick-${name}="${id}"
    data-tooltip="${t(label)}" aria-label="${t(label)}">${icon(glyph, 14)}</button>`;
  return `<article class="library-panel library-quick-game" data-library-quick-game="${id}" tabindex="0"
    aria-label="${escapeHtml(title)}" aria-keyshortcuts="ArrowLeft ArrowRight" data-tooltip="${t('library.reorderGame')}">
    <div class="library-quick-tools"><div>${!hidden && item.method !== 'instance' ? tool('edit', 'quick.edit', 'edit') : ''}
      ${tool('hotkey', item.hotkey ? 'quick.clearHotkey' : 'quick.setHotkey', 'keyboard')}${tool('remove', 'quick.remove', 'close')}</div></div>
    ${libraryArt(hidden ? {} : item)}
    <strong data-tooltip="${escapeHtml(title)}">${escapeHtml(title)}</strong>
    ${item.hotkey ? `<kbd>${escapeHtml(formatHotkey(item.hotkey))}</kbd>` : ''}
    <button type="button" class="primary-button" data-quick-launch="${id}">${icon('play', 13)} ${t('card.play')}</button></article>`;
}

function addLibraryQuickFavorites(folder, ids) {
  if (!folder) return;
  for (const id of [...new Set(ids)]) {
    if (folder.games.length >= 80 || !gameIdPattern.test(id) || !favorites.has(id) || folder.games.some(item => item.placeId === id && item.method === 'public')) continue;
    const game = libraryGame(id);
    folder.games.push({ type: 'game', method: 'public', id: quickLaunchId(), placeId: id, title: game.title, thumbnail: game.thumbnail, autoTitle: true });
  }
  quickFoldersOpen.add(folder.id);
  persistQuickLaunchItems();
}

function focusLibraryControl(selector) {
  pageContent.querySelector(selector)?.focus({ preventScroll: true });
}

document.addEventListener('input', event => {
  if (!event.target.hasAttribute?.('data-library-favorite-search')) return;
  favoriteSearch = event.target.value;
  favoritesVisibleCount = 24;
  const collection = currentFavoriteCollection();
  const games = (collection?.games || [...favorites]).filter(id => favorites.has(id)).map(libraryGame).map(localizeGame);
  const genre = games.some(game => game.genre === favoriteGenre) ? favoriteGenre : '';
  document.getElementById('library-favorite-results').innerHTML = libraryFavoriteResults(games, genre, Boolean(collection));
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && libraryDrag?.ghost) {
    event.preventDefault();
    event.stopImmediatePropagation();
    finishLibraryDrag(false);
    return;
  }
  const card = event.target;
  if (!card.matches?.('[data-library-quick-game]') || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  const cards = [...card.parentElement.children];
  const index = cards.indexOf(card);
  const next = index + (event.key === 'ArrowLeft' ? -1 : 1);
  if (index < 0 || next < 0 || next >= cards.length) return;
  event.preventDefault();
  const [moved] = cards.splice(index, 1);
  cards.splice(next, 0, moved);
  flipLibraryCards(card.parentElement, () => card.parentElement.append(...cards));
  card.focus({ preventScroll: true });
  saveLibraryCardOrder(selectedLibraryFolder, cards);
}, true);

document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-library-action]');
  if (!button) return;
  const { libraryAction: action, id, server } = button.dataset;
  switch (action) {
    case 'favorite-collection':
      activeFavoriteCollection = id; favoritesVisibleCount = 24; renderPage();
      focusLibraryControl('[data-library-action="favorite-collection"][aria-pressed="true"]'); break;
    case 'edit-collection': editFavoriteCollection(id); break;
    case 'delete-collection':
      preferences.favoriteCollections = favoriteCollections().filter(entry => entry.id !== id);
      savePreferences(); launcherDialog.close(); renderPage(); break;
    case 'share-collection': {
      const collection = currentFavoriteCollection();
      if (collection) openCollectionEditor(null, collection);
      break;
    }
    case 'recent-filter':
      recentFilter = id; renderPage(); focusLibraryControl('[data-library-action="recent-filter"][aria-pressed="true"]'); break;
    case 'clear-recent':
    case 'clear-sessions':
      openLauncherDialog(t('library.clearHistory'), `<form class="launcher-dialog-form" data-library-form="${action}">
        <p>${t(action === 'clear-recent' ? 'library.clearRecentHint' : 'library.clearSessionsHint')}</p>
        <button class="control-button" type="submit">${icon('trash', 14)} ${t('library.clearHistory')}</button></form>`); break;
    case 'rejoin': if (!preferences.streamMode && validSessionServer(server)) void openGame(id, server); break;
    case 'pick-folder':
      selectedLibraryFolder = id; renderPage(); focusLibraryControl('.library-folder[aria-pressed="true"]'); break;
    case 'new-folder':
      openLauncherDialog(t('library.newGroup'), `<form class="launcher-dialog-form" data-library-form="folder">
        <label>${t('tools.collectionName')}<input name="title" required maxlength="48"></label>
        <button class="primary-button" type="submit">${t('common.save')}</button></form>`); break;
    case 'add-quick': openQuickGameModal('', libraryQuickFolder(selectedLibraryFolder)?.id || ''); break;
    case 'add-favorites': {
      const folder = libraryQuickFolder(selectedLibraryFolder);
      if (!folder) break;
      const available = [...favorites].filter(id => !folder.games.some(item => item.placeId === id && item.method === 'public'));
      openLauncherDialog(t('library.addFavorites'), `<form class="launcher-dialog-form" data-library-form="quick-favorites" data-id="${folder.id}">
        ${available.length ? `<ul class="launcher-dialog-list launcher-collection-list">${available.map(libraryGame).map(game =>
          `<li><label><input type="checkbox" name="game" value="${escapeHtml(game.id)}">${gameArt(game)}<span>${escapeHtml(game.title)}</span></label></li>`).join('')}</ul>
          <button class="primary-button" type="submit">${t('library.addGame')}</button>` : `<p>${t('library.emptyFiltered')}</p>`}</form>`);
      break;
    }
    default: handleLibraryActivityAction(action, button);
  }
});

document.addEventListener('change', event => {
  const field = event.target;
  const key = field.dataset?.librarySelect;
  if (!key) return;
  if (key === 'favorite-genre') { favoriteGenre = field.value; favoritesVisibleCount = 24; }
  else if (key === 'favorite-sort') { favoriteSort = field.value; favoritesVisibleCount = 24; }
  else if (key === 'recent-place') recentPlace = field.value;
  else if (key === 'folder-server' || key === 'tray-folder') {
    const folder = libraryQuickFolder(selectedLibraryFolder);
    if (folder) {
      if (key === 'folder-server') folder.server = field.value;
      else folder.showInTray = field.checked;
      savePreferences();
    }
    return;
  } else if (!handleLibraryActivitySelect(key, field.value)) return;
  renderPage();
  focusLibraryControl(`[data-vortex-dropdown="${key}"] .vortex-dropdown-trigger, [data-library-select="${key}"]:not([type="hidden"])`);
});

document.addEventListener('submit', async event => {
  const form = event.target;
  const action = form.dataset?.libraryForm;
  if (!action) return;
  event.preventDefault();
  const data = new FormData(form);
  const title = String(data.get('title') || '').trim();
  if ((action === 'collection' || action === 'folder') && !title) return;
  if (action === 'collection') {
    const id = form.dataset.id || quickLaunchId();
    const entry = { id, title, games: data.getAll('game').filter(game => favorites.has(game)) };
    const collections = favoriteCollections();
    const index = collections.findIndex(item => item.id === id);
    if (index >= 0) collections[index] = entry;
    else {
      if (collections.length >= 80) { showToast(t('tools.folderLimit')); return; }
      collections.push(entry);
    }
    preferences.favoriteCollections = collections;
    activeFavoriteCollection = id;
    favoritesVisibleCount = 24;
    savePreferences();
  } else if (action === 'folder') {
    if (preferences.quickLaunchItems.length >= 80) { showToast(t('tools.folderLimit')); return; }
    selectedLibraryFolder = quickLaunchId();
    preferences.quickLaunchItems.push({ id: selectedLibraryFolder, type: 'folder', title, color: preferences.accent, games: [] });
    quickFoldersOpen.add(selectedLibraryFolder);
    persistQuickLaunchItems();
  } else if (action === 'quick-favorites') {
    addLibraryQuickFavorites(libraryQuickFolder(form.dataset.id), data.getAll('game'));
  } else if (action === 'clear-recent') {
    saveRecentGames([]);
    saveRecentDetails({});
    recentPlace = '';
    recentJournalKey = null;
  } else if (action === 'clear-sessions') {
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try { await clearLibrarySessions(); } catch {
      submit.disabled = false;
      showToast(t('activity.journal.error'));
      return;
    }
  }
  launcherDialog.close();
  renderPage();
});

let libraryDrag = null;
let suppressLibraryDragClick = false;
const libraryCardEffects = new WeakMap();

function saveLibraryCardOrder(folderId, cards) {
  const folder = libraryQuickFolder(folderId);
  const list = folder?.games || preferences.quickLaunchItems;
  const games = new Map(list.filter(item => item.type === 'game').map(item => [item.id, item]));
  if (games.size !== cards.length || cards.some(card => !games.has(card.dataset.libraryQuickGame))) return;
  const ordered = cards.map(card => games.get(card.dataset.libraryQuickGame));
  let index = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i].type === 'game') list[i] = ordered[index++];
  }
  savePreferences();
  renderQuickLaunchItems();
}

function flipLibraryCards(grid, change) {
  const cards = [...grid.children];
  const before = cards.map(card => card.getBoundingClientRect());
  cards.forEach(card => libraryCardEffects.get(card)?.cancel());
  change();
  cards.forEach((card, index) => {
    if (card.classList.contains('library-drag-source')) return;
    const after = card.getBoundingClientRect();
    const x = before[index].left - after.left;
    const y = before[index].top - after.top;
    if (Math.abs(x) + Math.abs(y) < 2) return;
    const effect = window.vortexMotion.animate(card, [{ translate: `${x}px ${y}px` }, { translate: '0 0' }], 190);
    if (effect) libraryCardEffects.set(card, effect);
  });
}

function previewLibraryCardSlot(drag, x, y) {
  const { grid, card } = drag;
  if (!grid?.isConnected) return false;
  const bounds = grid.getBoundingClientRect();
  if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return false;
  const children = [...grid.children];
  const dx = x - bounds.left;
  const dy = y - bounds.top;
  const distance = node => Math.hypot(dx - node.offsetLeft - node.offsetWidth / 2, dy - node.offsetTop - node.offsetHeight / 2);
  const nearest = children.reduce((best, node) => distance(node) < distance(best) ? node : best, children[0]);
  if (nearest !== card) {
    const after = children.indexOf(card) < children.indexOf(nearest);
    flipLibraryCards(grid, () => grid.insertBefore(card, after ? nearest.nextElementSibling : nearest));
  }
  return true;
}

function updateLibraryDrag(drag, x, y) {
  drag.ghost.style.left = x - drag.grabX + 'px';
  drag.ghost.style.top = y - drag.grabY + 'px';
  let target = document.elementFromPoint(x, y);
  if (drag.favorite && target?.closest('.library-tabs [data-nav="quick"]') && currentView === 'favorites') {
    setView('quick');
    target = document.elementFromPoint(x, y);
  }
  const folder = target?.closest('[data-library-drop-folder]');
  const targetFolder = folder?.dataset.libraryDropFolder;
  const destination = targetFolder && targetFolder !== drag.folderId && libraryQuickFolder(targetFolder);
  const drop = destination && destination.games.length < 80 ? folder : null;
  if (drop !== drag.drop) {
    drag.drop?.classList.remove('library-drop-target');
    drop?.classList.add('library-drop-target');
    drag.drop = drop;
  }
  drag.inGrid = !drag.favorite && currentView === 'quick' && previewLibraryCardSlot(drag, x, y);
}

function finishLibraryDrag(commit, event) {
  const drag = libraryDrag;
  if (!drag || event && event.pointerId !== drag.pointer) return;
  libraryDrag = null;
  if (!drag.ghost) return;
  if (event?.cancelable) event.preventDefault();
  suppressLibraryDragClick = true;
  window.setTimeout(() => { suppressLibraryDragClick = false; }, 180);
  if (document.documentElement.hasPointerCapture(drag.pointer)) document.documentElement.releasePointerCapture(drag.pointer);
  drag.drop?.classList.remove('library-drop-target');
  const folder = commit && drag.drop?.isConnected && libraryQuickFolder(drag.drop.dataset.libraryDropFolder);
  const inGrid = commit && drag.inGrid && currentView === 'quick' && drag.grid?.isConnected;
  if (folder && drag.favorite) addLibraryQuickFavorites(folder, [drag.id]);
  else if (folder) {
    const source = libraryQuickFolder(drag.folderId)?.games || preferences.quickLaunchItems;
    const index = source.findIndex(item => item.id === drag.id && item.type === 'game');
    if (index >= 0 && folder.games.length < 80) {
      folder.games.push(...source.splice(index, 1));
      persistQuickLaunchItems();
    }
  } else if (inGrid) saveLibraryCardOrder(drag.folderId, [...drag.grid.children]);
  else if (drag.grid?.isConnected) flipLibraryCards(drag.grid, () => drag.grid.append(...drag.original));
  drag.card.classList.remove('library-drag-source');
  document.body.classList.remove('library-drag-active');
  const rect = inGrid && !folder ? drag.card.getBoundingClientRect() : null;
  const effect = rect ? window.vortexMotion.animate(drag.ghost, [
    { transform: 'none', opacity: 1 },
    { transform: `translate(${rect.left - drag.ghost.offsetLeft}px, ${rect.top - drag.ghost.offsetTop}px)`, opacity: .2 }
  ], 155) : window.vortexMotion.animate(drag.ghost, [{ opacity: 1 }, { opacity: 0, scale: .96 }], 125);
  if (effect) effect.finished.then(() => drag.ghost.remove(), () => drag.ghost.remove());
  else drag.ghost.remove();
}

document.addEventListener('pointerdown', event => {
  suppressLibraryDragClick = false;
  if (!event.isPrimary || event.button !== 0) return;
  const card = event.target.closest?.('[data-library-quick-game], [data-library-favorite-drag]');
  const button = event.target.closest?.('button, a, input');
  const favorite = Boolean(card?.dataset.libraryFavoriteDrag);
  if (!card || (button && !(favorite && button.matches('.game-cover-action, .game-title')))) return;
  const grid = favorite ? null : card.parentElement;
  libraryDrag = {
    id: favorite ? card.dataset.libraryFavoriteDrag : card.dataset.libraryQuickGame,
    card, grid, favorite, original: grid ? [...grid.children] : [],
    folderId: favorite ? '' : selectedLibraryFolder,
    pointer: event.pointerId, x: event.clientX, y: event.clientY,
    ghost: null, drop: null, inGrid: false
  };
});

document.addEventListener('pointermove', event => {
  const drag = libraryDrag;
  if (!drag || event.pointerId !== drag.pointer) return;
  if (!drag.ghost) {
    if (!drag.card.isConnected) { libraryDrag = null; return; }
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 7) return;
    try { document.documentElement.setPointerCapture(drag.pointer); } catch { /* The document still receives the gesture. */ }
    const bounds = drag.card.getBoundingClientRect();
    const ghost = drag.favorite ? document.createElement('div') : drag.card.cloneNode(true);
    if (drag.favorite) ghost.innerHTML = libraryArt(libraryGame(drag.id));
    ghost.classList.add('library-drag-ghost');
    if (drag.favorite) ghost.classList.add('library-drag-copy');
    ghost.removeAttribute('data-library-quick-game');
    ghost.inert = true;
    ghost.setAttribute('aria-hidden', 'true');
    if (!drag.favorite) ghost.style.width = bounds.width + 'px';
    drag.grabX = drag.favorite ? 32 : drag.x - bounds.left;
    drag.grabY = drag.favorite ? 32 : drag.y - bounds.top;
    drag.card.classList.add('library-drag-source');
    document.body.classList.add('library-drag-active');
    document.body.append(ghost);
    drag.ghost = ghost;
    window.vortexOverlays.closeTooltip(true);
    window.vortexMotion.animate(ghost, [{ opacity: .6, scale: .98 }, { opacity: 1, scale: 1 }], 125);
  }
  event.preventDefault();
  updateLibraryDrag(drag, event.clientX, event.clientY);
}, { passive: false });

document.addEventListener('pointerup', event => {
  if (libraryDrag?.ghost && event.pointerId === libraryDrag.pointer) updateLibraryDrag(libraryDrag, event.clientX, event.clientY);
  finishLibraryDrag(true, event);
});
document.addEventListener('pointercancel', event => finishLibraryDrag(false, event));
window.addEventListener('blur', () => finishLibraryDrag(false));
document.addEventListener('click', event => {
  if (!suppressLibraryDragClick || event.detail === 0) return;
  suppressLibraryDragClick = false;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
