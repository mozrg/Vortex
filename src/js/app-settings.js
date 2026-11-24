const settingsTabsList = [
  ['home', 'board'], ['accent', 'palette'], ['cards', 'cards'], ['effects', 'wand'],
  ['interface', 'panels'], ['general', 'slidersHorizontal'], ['in-game', 'monitor'], ['hotkeys', 'keyboard'],
  ['integrations', 'plug'], ['tray', 'tray'], ['data', 'database'], ['version', 'package']
];

function settingsTabs() {
  return `<nav class="settings-tabs" aria-label="${t('settings.tabNavigation')}">${settingsTabsList.map(([key, glyph]) => `<button class="settings-tab ${preferences.settingsTab === key ? 'active' : ''}" data-settings-tab="${key}" ${preferences.settingsTab === key ? 'aria-current="page"' : ''}><span class="settings-tab-glyph">${icon(glyph, 14)}</span>${t(`settings.tab.${key}`)}</button>`).join('')}</nav>`;
}

function renderHomeSettings() {
  const featuredId = String(preferences.homeFeaturedGame || '');
  const picksIds = new Set((Array.isArray(preferences.homePicks) ? preferences.homePicks : []).map(String));
  const customGames = Array.isArray(preferences.customGames) ? preferences.customGames : [];
  const optionRow = (game) => {
    const id = String(game.id);
    const thumbnail = safeThumbnail(game.thumbnail);
    const badge = (text, key, active) => `<button class="home-game-badge ${active ? 'active' : ''}" data-${key}="${escapeHtml(id)}" aria-pressed="${active}">${icon(active ? 'check' : 'plus', 12)}<span>${text}</span></button>`;
    return `<div class="custom-game-row" data-custom-row="${escapeHtml(id)}">
      <span class="home-game-art art-live ${thumbnail ? 'has-thumbnail' : ''}">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" />` : ''}</span>
      <span class="home-game-copy"><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(game.creator || game.genre || 'Roblox')}${renderVerifiedCreatorBadge(game)}</small></span>
      <span class="home-game-badges">
        ${badge(t('settings.home.forBanner'), 'banner-pick', featuredId === id)}
        ${badge(t('settings.home.forPicks'), 'picks-pick', picksIds.has(id))}
      </span>
      <button class="control-button control-button-icon control-button-quiet custom-game-remove" data-remove-custom="${escapeHtml(id)}" aria-label="${t('settings.home.remove')}">${icon('trash', 14)}</button>
    </div>`;
  };
  const customList = customGames.length
    ? `<div class="home-game-options home-game-options-list">${customGames.map(optionRow).join('')}</div>`
    : `<p class="catalog-disclaimer">${t('settings.home.customEmpty')}</p>`;
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.home.title')}</h2><p>${t('settings.home.body')}</p></div>${icon('home', 18)}</div>
      <label class="home-greeting-field"><span>${t('settings.home.greeting')}</span><input class="control-field" type="text" maxlength="48" value="${escapeHtml(preferences.homeGreeting)}" placeholder="${t('settings.home.greetingHint')}" data-home-greeting /></label>
      <div class="setting-line home-featured-head"><div class="setting-label"><strong>${t('settings.home.customTitle')}</strong><small>${t('settings.home.customBody')}</small></div></div>
      <div class="custom-game-form">
        <span class="game-search-field">
          <span class="game-search-icon">${icon('search', 14)}</span>
          <input class="control-field" type="text" maxlength="100" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="game-search-results" aria-label="${t('settings.home.searchHint')}" placeholder="${t('settings.home.searchHint')}" data-game-search />
          <div class="game-search-results" id="game-search-results" role="listbox" hidden></div>
        </span>
        <button class="control-button control-button-primary" data-add-custom>${icon('gamePlus', 15)} ${t('settings.home.add')}</button>
      </div>
      <p class="custom-game-status" data-custom-status></p>
      ${customList}
      <div class="setting-line home-setting-line"><div class="setting-label"><strong>${t('settings.home.gameCount')}</strong></div><div class="segmented">${[4, 6, 8].map((count) => `<button class="segment ${Number(preferences.homeGameCount) === count ? 'active' : ''}" data-pref="homeGameCount" data-value="${count}" data-preview="homeCount:${count}" data-preview-label="${escapeHtml(t('settings.home.gameCount'))}">${count}</button>`).join('')}</div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.home.gameView')}</strong><small>${t('settings.home.gameViewHint')}</small></div>${renderGameViewSwitch('homeGameView', 'settings.home.gameView', '', true)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.home.layout')}</strong><small>${t('settings.home.layoutBody')}</small></div><div class="segmented">${[['balanced', t('settings.home.layoutBalanced')], ['spotlight', t('settings.home.layoutSpotlight')], ['library', t('settings.home.layoutLibrary')]].map(([value, label]) => `<button class="segment ${preferences.homeLayout === value ? 'active' : ''}" data-pref="homeLayout" data-value="${value}" ${previewAttr('homeLayout', value, label)}>${label}</button>`).join('')}</div></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.home.sections')}</h2><p>${t('settings.home.sectionsBody')}</p></div>${icon('board', 18)}</div>
      <p class="ui-section-title">${t('home.widgets.orderTitle')}</p>
      <div class="ui-list home-widget-list" role="list" data-ui-order data-home-widget-config>
        ${homeWidgetOrder().map((key, index) => {
          const widget = HOME_WIDGETS.find((w) => w.key === key);
          if (!widget) return '';
          return `<div class="ui-row" data-ui-row="widget:${key}" data-widget-row="${key}" data-widget-visible="${homeWidgetVisible(key)}" data-preview="homeWidget:${key}:${homeWidgetVisible(key) ? 'on' : 'off'}" data-preview-label="${escapeHtml(t(widget.titleKey))}" role="listitem" tabindex="0" aria-roledescription="${t('settings.ui.dragHint')}">
            <span class="ui-row-grip" aria-hidden="true">${icon('grip', 14)}</span>
            <span class="ui-row-icon">${icon(widget.icon, 14)}</span>
            <span class="ui-row-copy"><strong>${t(widget.titleKey)}</strong><small>${t(widget.bodyKey)}</small></span>
            <button class="ui-row-handle" data-widget-move="${key}" data-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="${t('settings.ui.moveUp')}">${icon('navUp', 12)}</button>
            <button class="ui-row-handle" data-widget-move="${key}" data-direction="1" ${index === homeWidgetOrder().length - 1 ? 'disabled' : ''} aria-label="${t('settings.ui.moveDown')}">${icon('navDown', 12)}</button>
            <button class="toggle" role="switch" aria-checked="${homeWidgetVisible(key)}" data-widget-visible-toggle="${key}" aria-label="${t('home.widgets.visibility')}" data-tooltip="${t('home.widgets.visibility')}"></button>
          </div>`;
        }).join('')}
      </div>
      <button class="control-button control-button-quiet" data-action="reset-home-widgets">${icon('rotate', 14)} ${t('home.widgets.reset')}</button>
      <p class="catalog-disclaimer">${t('settings.home.hint')}</p>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.home.textTitle')}</h2><p>${t('settings.home.textBody')}</p></div>${icon('textSize', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.home.textScale')}</strong><small>${t('settings.home.textScaleHint')}</small></div><label class="range-control"><input type="range" min="0.8" max="1.6" step="0.05" value="${preferences.homeSectionScale || 1}" data-home-section-scale /><span class="range-value" data-home-section-scale-value>${Math.round((preferences.homeSectionScale || 1) * 100)}%</span></label></div>
      <div class="section-title-fields">
        ${HOME_WIDGETS.filter((widget) => widget.key !== 'hero').map((widget) => `<label class="home-greeting-field section-title-field"><span>${t(widget.titleKey)}</span><input class="control-field" type="text" maxlength="36" value="${escapeHtml((preferences.homeSectionTitles && preferences.homeSectionTitles[widget.key]) || '')}" placeholder="${t(widget.titleKey)}" data-widget-title="${widget.key}" /></label>`).join('')}
      </div>
      <button class="control-button control-button-quiet" data-action="reset-section-titles">${icon('rotate', 14)} ${t('settings.home.resetTitles')}</button>
    </section>`;
}

// Live game lookup for the "My games" field. Results are cached per query so typing
// back and forth does not hammer the Roblox search API.
const gameSearchCache = new Map();
const gameSearchCacheMeta = new Map();
const GAME_SEARCH_CACHE_TTL = 5 * 60 * 1000;
const GAME_SEARCH_CACHE_MAX = 50;
const gameSearchResults = new Map();
let gameSearchTimer = null;
let gameSearchRequestId = 0;
let gameSearchItems = [];
// Same-session memo for the game-add dropdown: much faster than the
// localStorage cache and shared across re-renders of the settings page.
const gameSearchMemo = new Map();
const SEARCH_MEMO_TTL = 5 * 60 * 1000;
const SEARCH_MEMO_MAX = 60;
function gameSearchMemoSet(query, items, index) {
  const key = String(query).trim().toLowerCase();
  if (!key) return;
  gameSearchMemo.set(key, { at: Date.now(), items, index: index || 0 });
  if (gameSearchMemo.size > SEARCH_MEMO_MAX) {
    const oldest = [...gameSearchMemo.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, gameSearchMemo.size - SEARCH_MEMO_MAX);
    oldest.forEach(([k]) => gameSearchMemo.delete(k));
  }
}
let gameSearchActiveIndex = -1;

function gameSearchInput() {
  return pageContent.querySelector('[data-game-search]');
}

function gameSearchList() {
  return pageContent.querySelector('.game-search-results');
}

function closeGameSearch() {
  const list = gameSearchList();
  if (list) {
    list.hidden = true;
    list.innerHTML = '';
  }
  gameSearchItems = [];
  gameSearchActiveIndex = -1;
  const input = gameSearchInput();
  if (input) input.setAttribute('aria-expanded', 'false');
}

function highlightGameSearch(index) {
  const list = gameSearchList();
  if (!list) return;
  const options = [...list.querySelectorAll('.game-search-option')];
  if (!options.length) return;
  gameSearchActiveIndex = (index + options.length) % options.length;
  options.forEach((option, position) => option.classList.toggle('active', position === gameSearchActiveIndex));
  options[gameSearchActiveIndex]?.scrollIntoView({ block: 'nearest' });
}

function renderGameSearchResults(items, note = '') {
  const list = gameSearchList();
  const input = gameSearchInput();
  if (!list || !input) return;
  gameSearchItems = items;
  gameSearchActiveIndex = -1;
  list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  if (!items.length) {
    list.innerHTML = `<p class="game-search-note">${escapeHtml(note || t('settings.home.searchEmpty'))}</p>`;
    return;
  }
  list.innerHTML = items.map((game, index) => {
    const thumbnail = safeThumbnail(game.thumbnail);
    const meta = [game.creator ? escapeHtml(game.creator) + renderVerifiedCreatorBadge(game) : '',
      game.playerCount ? escapeHtml(t('search.players', { count: formatCount(game.playerCount) })) : ''].filter(Boolean).join(' · ');
    const hint = String(game.description || '').trim();
    return `<button class="game-search-option" role="option" data-game-pick="${escapeHtml(game.id)}" data-index="${index}" aria-selected="false">
      <span class="game-search-art ${thumbnail ? 'has-thumbnail' : ''}">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" />` : ''}</span>
      <span class="game-search-copy"><strong>${escapeHtml(game.title)}</strong><small>${meta || escapeHtml(t('tag.roblox'))}</small>${hint ? `<em>${escapeHtml(hint.slice(0, 84))}</em>` : ''}</span>
      ${icon('arrow', 13)}
    </button>`;
  }).join('');
}

async function searchGamesByName(query) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    closeGameSearch();
    return;
  }
  if (!window.vortexDesktop?.searchGames) {
    renderGameSearchResults([], t('settings.home.customDesktopOnly'));
    return;
  }
  const cacheKey = trimmed.toLocaleLowerCase(preferences.language);
  const cached = gameSearchCache.get(cacheKey);
  const cachedAt = gameSearchCacheMeta.get(cacheKey) || 0;
  if (cached && Date.now() - cachedAt < GAME_SEARCH_CACHE_TTL) {
    // Refresh recency on use so the cap behaves like a small LRU cache.
    gameSearchCache.delete(cacheKey);
    gameSearchCache.set(cacheKey, cached);
    gameSearchCacheMeta.set(cacheKey, Date.now());
    renderGameSearchResults(cached);
    return;
  }
  if (cached) { gameSearchCache.delete(cacheKey); gameSearchCacheMeta.delete(cacheKey); }
  const requestId = ++gameSearchRequestId;
  renderGameSearchResults([], t('settings.home.searchLoading'));
  try {
    const response = await window.vortexDesktop.searchGames({ query: trimmed });
    if (requestId !== gameSearchRequestId) return;
    const items = (response?.items || []).slice(0, 8).map((item) => normalizeDiscoveredGame(item, trimmed));
    items.forEach((item) => {
      const idKey = String(item.id);
      if (gameSearchResults.has(idKey)) gameSearchResults.delete(idKey);
      gameSearchResults.set(idKey, item);
    });
    while (gameSearchResults.size > 300) {
      const oldestResultKey = gameSearchResults.keys().next().value;
      gameSearchResults.delete(oldestResultKey);
    }
    gameSearchCache.set(cacheKey, items);
    gameSearchCacheMeta.set(cacheKey, Date.now());
    while (gameSearchCache.size > GAME_SEARCH_CACHE_MAX) {
      const oldestKey = gameSearchCache.keys().next().value;
      gameSearchCache.delete(oldestKey);
      gameSearchCacheMeta.delete(oldestKey);
    }
    gameSearchMemoSet(trimmed, items, 0);
    if (gameSearchInput()?.value.trim() !== trimmed) return;
    renderGameSearchResults(items);
  } catch {
    if (requestId !== gameSearchRequestId) return;
    renderGameSearchResults([], t('settings.home.customError'));
  }
}

function pickGameFromSearch(placeId) {
  const game = gameSearchResults.get(String(placeId));
  if (!game) return;
  addCustomGame(game);
}

function scheduleGameSearch(query) {
  if (gameSearchTimer) window.clearTimeout(gameSearchTimer);
  if (query.trim().length < 2) {
    closeGameSearch();
    return;
  }
  // Memo hit: re-typing a recently searched query answers instantly,
  // skipping the async roundtrip entirely.
  const memo = gameSearchMemo.get(query.trim().toLowerCase());
  if (memo && Date.now() - memo.at < SEARCH_MEMO_TTL) {
    renderGameSearchResults(memo.items);
    highlightGameSearch(memo.index || 0);
    return;
  }
  gameSearchTimer = window.setTimeout(() => searchGamesByName(query), 320);
}

async function addCustomGame(preselected = null) {
  const input = pageContent.querySelector('[data-game-search], [data-custom-input]');
  const status = pageContent.querySelector('[data-custom-status]');
  const setStatus = (text) => { if (status) status.textContent = text; };
  const store = (game) => {
    const id = String(game.id);
    preferences.customGames = [game, ...(preferences.customGames || []).filter((existing) => String(existing.id) !== id)].slice(0, 12);
    // A fresh game joins the home picks right away; it becomes the banner game only
    // while the banner is still empty.
    if (!preferences.homeFeaturedGame) preferences.homeFeaturedGame = id;
    preferences.homePicks = [...new Set([...(preferences.homePicks || []).map(String), id])];
    savePreferences();
    closeGameSearch();
    renderPage();
    showToast(t('settings.home.customAdded', { game: game.title }));
    const fresh = pageContent.querySelector('[data-game-search]');
    if (fresh) fresh.value = '';
    const freshStatus = pageContent.querySelector('[data-custom-status]');
    if (freshStatus) freshStatus.textContent = '';
  };

  if (preselected) {
    store(preselected);
    return;
  }

  const raw = String(input?.value || '').trim();
  const placeId = (raw.match(/roblox\.com\/games\/(\d{5,20})/i) || raw.match(/^(\d{5,20})$/))?.[1];
  if (placeId) {
    if (!window.vortexDesktop?.searchGames) { setStatus(t('settings.home.customDesktopOnly')); return; }
    setStatus(t('settings.home.customLoading'));
    try {
      const response = await window.vortexDesktop.searchGames({ query: placeId });
      const item = response?.items?.[0];
      if (!item) { setStatus(t('settings.home.customNotFound')); return; }
      store({ ...normalizeDiscoveredGame(item), id: placeId });
    } catch {
      setStatus(t('settings.home.customError'));
    }
    return;
  }

  // A name was typed: use the first match from the live dropdown.
  if (raw.length >= 2) {
    const cached = gameSearchCache.get(raw.toLocaleLowerCase(preferences.language));
    const first = cached?.[0] ?? gameSearchItems[0];
    if (first) { store(first); return; }
    if (!window.vortexDesktop?.searchGames) { setStatus(t('settings.home.customDesktopOnly')); return; }
    setStatus(t('settings.home.searchLoading'));
    await searchGamesByName(raw);
    const found = gameSearchItems[0];
    if (found) store(found);
    else setStatus(raw ? t('settings.home.searchEmpty') : t('settings.home.customInvalid'));
    return;
  }

  setStatus(t('settings.home.customInvalid'));
}

document.addEventListener('keydown', (event) => {
  if (!event.target.matches?.('[data-game-search]')) {
    if (event.key === 'Enter' && event.target.matches?.('[data-custom-input]')) addCustomGame();
    return;
  }
  const list = gameSearchList();
  const open = list && !list.hidden && gameSearchItems.length;
  if (event.key === 'ArrowDown' && open) {
    event.preventDefault();
    highlightGameSearch(gameSearchActiveIndex + 1);
    return;
  }
  if (event.key === 'ArrowUp' && open) {
    event.preventDefault();
    highlightGameSearch(gameSearchActiveIndex - 1);
    return;
  }
  if (event.key === 'Escape') {
    closeGameSearch();
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const picked = gameSearchActiveIndex >= 0 ? gameSearchItems[gameSearchActiveIndex] : gameSearchItems[0];
    if (picked) pickGameFromSearch(picked.id);
    else addCustomGame();
  }
});

function renderAccentSettings() {
  const themeDefaults = { dark: { background: '#0f0e15', surface: '#17161f' }, light: { background: '#f5f6f7', surface: '#ffffff' }, oled: { background: '#030305', surface: '#08090c' } }[preferences.theme];
  const displayBackground = preferences.themeBackground || themeDefaults.background;
  const displaySurface = preferences.themeSurface || themeDefaults.surface;
  const isLight = relativeLuminance(displayBackground) > 0.42;
  const displayText = preferences.themeText || (isLight ? '#211e2a' : '#eceaf5');
  const displayMuted = preferences.themeMuted || (isLight ? '#777382' : '#9a97ae');
  const displayLine = preferences.themeLine || (isLight ? '#37303f' : '#2b2d36');
  return `<div class="settings-column">
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.theme.title')}</h2><p>${t('settings.theme.body')}</p></div></div><div class="segmented" style="max-width:390px">${[['dark', `${icon('moon', 13)} ${t('settings.dark')}`], ['light', `${icon('sun', 13)} ${t('settings.light')}`], ['oled', `${icon('contrast', 13)} ${t('settings.oled')}`]].map(([value, label]) => `<button class="segment ${preferences.theme === value ? 'active' : ''}" data-pref="theme" data-value="${value}" ${previewAttr('theme', value, t(`settings.${value}`))}>${label}</button>`).join('')}</div>
      <p class="theme-color-hint">${t('settings.themeColorHint')}</p><div class="theme-color-tuners">${renderColorTuner('themeBackground', displayBackground, t('settings.themeBackground'))}${renderColorTuner('themeSurface', displaySurface, t('settings.themeSurface'))}</div>
      <div class="theme-color-tuners">${renderColorTuner('themeText', displayText, t('settings.themeText'))}${renderColorTuner('themeMuted', displayMuted, t('settings.themeMuted'))}${renderColorTuner('themeLine', displayLine, t('settings.themeLine'))}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.theme.glass')}</strong><small>${t('settings.theme.glassHint')}</small></div><label class="range-control"><input type="range" min="0" max="100" value="${preferences.glassStrength}" data-glass-strength /><span class="range-value" data-glass-strength-value>${preferences.glassStrength}%</span></label></div>
       <div class="setting-line"><div class="setting-label"><strong>${t('settings.theme.schedule')}</strong><small>${t('settings.theme.scheduleHint')}</small></div><div class="segmented">${[['manual',t('settings.theme.scheduleManual')],['system',t('settings.theme.scheduleSystem')],['clock',t('settings.theme.scheduleClock')]].map(([v,l])=>`<button class="segment ${preferences.themeSchedule===v?'active':''}" data-pref="themeSchedule" data-value="${v}">${l}</button>`).join('')}</div></div>
      <div class="theme-io">
        <button class="control-button" data-action="export-theme" data-tooltip="${preferences.language === 'en' ? 'Save current colors and theme to a .json file' : 'Сохранить текущие цвета и тему в файл .json'}">${icon('fileDown', 14)} ${t('settings.themeExport')}</button>
        <button class="control-button" data-action="import-theme" data-tooltip="${preferences.language === 'en' ? 'Load colors and theme from a .json file' : 'Загрузить цвета и тему из файла .json'}">${icon('fileUp', 14)} ${t('settings.themeImport')}</button>
        <input type="file" accept=".json,application/json" data-theme-file hidden />
        <button class="control-button control-button-quiet" data-action="reset-theme-colors" data-tooltip="${preferences.language === 'en' ? 'Restore default theme colors' : 'Вернуть стандартные цвета темы'}">${icon('rotate', 14)} ${t('settings.themeReset')}</button>
      </div>
      <div class="theme-code-bar">
        <div class="setting-label">
          <strong>${preferences.language === 'en' ? 'Share theme via code' : 'Поделиться темой через код'}</strong>
          <small>${preferences.language === 'en' ? 'Copy a short VORTEXTH1- code of your colors, theme, and corners or paste one to apply' : 'Скопируй короткий код VORTEXTH1- со своими цветами, темой и скруглением или вставь чужой'}</small>
        </div>
        <div class="theme-code-controls">
          <input class="control-field" type="text" autocomplete="off" placeholder="VORTEXTH1-..." data-theme-code-input />
          <button class="control-button" type="button" data-action="import-theme-code" data-tooltip="${preferences.language === 'en' ? 'Apply pasted theme code' : 'Применить вставленный код темы'}">${icon('check', 14)} ${preferences.language === 'en' ? 'Apply' : 'Применить'}</button>
          <button class="control-button control-button-primary" type="button" data-action="copy-theme-code" data-tooltip="${preferences.language === 'en' ? 'Copy shareable code of your current theme' : 'Скопировать код текущей темы'}">${icon('copy', 14)} ${preferences.language === 'en' ? 'Copy code' : 'Скопировать код'}</button>
        </div>
      </div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.accent.title')}</h2><p>${t('settings.accent.body')}</p></div>${icon('drop', 18)}</div>
      ${renderAccentWindowPreview()}
      <div class="palette-row">${palettes.map((palette) => `<button class="palette-option ${preferences.accent.toLowerCase() === palette.color ? 'active' : ''}" aria-pressed="${preferences.accent.toLowerCase() === palette.color}" data-tooltip="${escapeHtml(t(`palette.${palette.key}`))}" aria-label="${escapeHtml(t(`palette.${palette.key}`))}" data-accent="${palette.color}" ${previewAttr('accent', palette.color, t(`palette.${palette.key}`))}><span class="palette-swatch" style="background:${palette.color};color:${palette.color}"></span></button>`).join('')}</div>
      ${renderColorTuner('accent', preferences.accent, t('settings.customColor'))}
      <div class="setting-line accent-mode-line"><div class="setting-label"><strong>${t('settings.accentMode')}</strong></div><div class="segmented"><button class="segment ${preferences.accentMode === 'solid' ? 'active' : ''}" data-pref="accentMode" data-value="solid">${t('settings.solid')}</button><button class="segment ${preferences.accentMode === 'gradient' ? 'active' : ''}" data-pref="accentMode" data-value="gradient">${t('settings.gradient')}</button></div></div>
      ${preferences.accentMode === 'gradient' ? `<div class="gradient-options">${renderColorTuner('accentSecondary', preferences.accentSecondary, t('settings.gradientEnd'))}<div class="setting-line gradient-angle-line"><div class="setting-label"><strong>${t('settings.gradientAngle')}</strong></div><label class="range-control"><input type="range" min="0" max="360" value="${preferences.gradientAngle}" data-setting="gradientAngle" /><output class="range-value" id="gradient-angle-value">${preferences.gradientAngle}°</output></label></div><div class="gradient-preview" aria-hidden="true"></div></div>` : ''}
    </section>
  </div><div class="settings-column">${renderCardPreviewSettings()}${renderWallpaperCard()}</div>`;
}

function renderWallpaperCard() {
  // Native components throughout: setting-line rows, range-control sliders,
  // button.toggle switches — identical to every other settings section.
  const hasWallpaper = Boolean(preferences.themeWallpaper);
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.wallpaper.title')}</h2><p>${t('settings.wallpaper.body')}</p></div>${icon('image', 18)}</div>
      <input type="file" accept="image/*" data-wallpaper-file hidden />
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.wallpaper.pick')}</strong><small>${hasWallpaper ? t('settings.wallpaper.removeHint') : t('settings.wallpaper.pickHint')}</small></div>
        <span class="data-actions wallpaper-actions"><button class="control-button" data-action="pick-wallpaper">${icon('upload', 14)} ${t('settings.wallpaper.pick')}</button>${hasWallpaper ? `<button class="control-button control-button-quiet" data-action="remove-wallpaper">${icon('close', 14)} ${t('settings.wallpaper.remove')}</button>` : ''}</span></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.wallpaper.blur')}</strong><small>${t('settings.wallpaper.blurHint')}</small></div><label class="range-control"><input type="range" min="0" max="40" value="${preferences.themeWallpaperBlur}" data-wallpaper-blur ${hasWallpaper ? '' : 'disabled'} /><span class="range-value" data-wallpaper-blur-value>${preferences.themeWallpaperBlur}px</span></label></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.wallpaper.dim')}</strong><small>${t('settings.wallpaper.dimHint')}</small></div><label class="range-control"><input type="range" min="0" max="90" value="${preferences.themeWallpaperDim}" data-wallpaper-dim ${hasWallpaper ? '' : 'disabled'} /><span class="range-value" data-wallpaper-dim-value>${preferences.themeWallpaperDim}%</span></label></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.wallpaper.grain')}</strong><small>${t('settings.wallpaper.grainHint')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.themeGrain}" data-wallpaper-grain-toggle aria-label="${t('settings.wallpaper.grain')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.wallpaper.grainStrength')}</strong><small>${t('settings.wallpaper.grainStrengthHint')}</small></div><label class="range-control"><input type="range" min="1" max="25" value="${Math.round((Number(preferences.themeGrainStrength) || 0.05) * 100)}" data-wallpaper-grain-strength ${preferences.themeGrain ? '' : 'disabled'} /><span class="range-value" data-wallpaper-grain-strength-value>${Math.round((Number(preferences.themeGrainStrength) || 0.05) * 100)}%</span></label></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.wallpaper.vignette')}</strong><small>${t('settings.wallpaper.vignetteHint')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.themeVignette}" data-wallpaper-vignette-toggle aria-label="${t('settings.wallpaper.vignette')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.wallpaper.vignetteStrength')}</strong><small>${t('settings.wallpaper.vignetteStrengthHint')}</small></div><label class="range-control"><input type="range" min="10" max="250" value="${Math.round((Number(preferences.themeVignetteStrength) || 1) * 100)}" data-wallpaper-vignette-strength ${preferences.themeVignette ? '' : 'disabled'} /><span class="range-value" data-wallpaper-vignette-strength-value>${Math.round((Number(preferences.themeVignetteStrength) || 1) * 100)}%</span></label></div>
  </section>`;
}

function renderCardSettings() {
  // Native components: setting-line rows, range-control sliders, button.toggle
  // switches — matches every other settings card exactly.
  const cardFlag = (flagKey, titleKey, bodyKey) => `<div class="setting-line"><div class="setting-label"><strong>${t(titleKey)}</strong><small>${t(bodyKey)}</small></div><button class="toggle" role="switch" aria-checked="${preferences[flagKey]}" data-card-flag-toggle="${flagKey}" data-preview="cardFlag:${flagKey}:${preferences[flagKey] ? 'off' : 'on'}" data-preview-label="${escapeHtml(t(titleKey))}" aria-label="${t(titleKey)}"></button></div>`;
  return `<div class="settings-column"><section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.cardTuning.title')}</h2><p>${t('settings.cardTuning.body')}</p></div>${icon('grid', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.cardTuning.size')}</strong><small>${t('settings.cardTuning.sizeHint')}</small></div><label class="range-control"><input type="range" min="0.7" max="1.3" step="0.05" value="${preferences.cardSize}" data-card-size data-preview="cardSize:${preferences.cardSize}" data-preview-label="${escapeHtml(t('settings.cardTuning.size'))}" /><span class="range-value" data-card-size-value>${Math.round(preferences.cardSize * 100)}%</span></label></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.cardTuning.radius')}</strong><small>${t('settings.cardTuning.radiusHint')}</small></div><label class="range-control"><input type="range" min="0" max="20" value="${preferences.cardRadius}" data-card-radius data-preview="cardRadius:${preferences.cardRadius}" data-preview-label="${escapeHtml(t('settings.cardTuning.radius'))}" /><span class="range-value" data-card-radius-value>${preferences.cardRadius}px</span></label></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.cardTuning.aspect')}</strong><small>${t('settings.cardTuning.aspectHint')}</small></div><div class="segmented">${[['auto',t('settings.cardTuning.aspectAuto')],['square',t('settings.cardTuning.aspectSquare')],['wide',t('settings.cardTuning.aspectWide')],['portrait',t('settings.cardTuning.aspectPortrait')]].map(([value,label])=>`<button class="segment ${preferences.cardAspect === value ? 'active' : ''}" data-pref="cardAspect" data-value="${value}" ${previewAttr('cardAspect',value,label)}>${label}</button>`).join('')}</div></div>
      ${cardFlag('cardShowDescription', 'settings.cardTuning.description', 'settings.cardTuning.descriptionHint')}
      ${cardFlag('cardShowLikes', 'settings.cardTuning.likes', 'settings.cardTuning.likesHint')}
      ${cardFlag('cardShowPlaytime', 'settings.cardTuning.playtime', 'settings.cardTuning.playtimeHint')}
      ${cardFlag('cardShowGenre', 'settings.cardTuning.genre', 'settings.cardTuning.genreHint')}
  </section>
  <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.catalog.title')}</h2><p>${t('settings.catalog.body')}</p></div>${icon('catalog', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.catalog.groupByGenre')}</strong><small>${t('settings.catalog.groupByGenreBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.catalogGroupByGenre}" data-toggle="catalogGroupByGenre" aria-label="${t('settings.catalog.groupByGenre')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.catalog.defaultView')}</strong><small>${t('settings.catalog.defaultViewBody')}</small></div>${renderGameViewSwitch('catalogView', 'settings.catalog.defaultView', '', true)}</div>
  </section>
  </div><div class="settings-column">${renderCardPreviewSettings()}</div>`;
}

function renderCardPreviewSettings() {
  return `<section class="settings-card settings-preview-card"><div class="settings-card-head"><div><h2>${t('settings.cardPreview.title')}</h2><p>${t('settings.cardPreview.body')}</p></div>${icon('eye', 18)}</div>
      <div class="card-tuning-preview">
        <article class="game-card preview-card" style="--game-color: var(--accent)">
          <div class="game-cover art-live"><span class="cover-shine"></span></div>
          <div class="game-info">
            <div class="game-title-row"><h3 class="game-title">${t('settings.cardPreview.name')}</h3></div>
            <p class="game-description" ${preferences.cardShowDescription ? '' : 'hidden'}>${t('settings.cardPreview.description')}</p>
            <div class="game-live-stats" ${preferences.cardShowLikes ? '' : 'hidden'}><span>${icon('users', 12)} ${t('search.players', { count: '2.4K' })}</span><span>${icon('thumb', 12)} ${t('search.likes', { percent: 96 })}</span></div>
            <div class="game-card-footer"><span class="game-category" ${preferences.cardShowGenre ? '' : 'hidden'}><i></i>${t('settings.cardPreview.genre')}</span><span class="card-playtime" ${preferences.cardShowPlaytime ? '' : 'hidden'}>${icon('clock', 11)} ${t('settings.cardPreview.playtime')}</span></div>
          </div>
        </article>
        <p class="preview-note"><strong>${t('settings.cardPreview.liveTitle')}</strong><small>${t('settings.cardPreview.liveBody')}</small></p>
      </div>
  </section>`;
}

function refreshCardPreview() {
  // Live-update the preview card in place: size, radius and flag-dependent rows.
  const card = pageContent.querySelector('.card-tuning-preview .preview-card');
  if (!card) return;
  const cover = card.querySelector('.game-cover');
  if (cover) {
    const radius = preferences.customCardRadius ? preferences.cardRadius : 12;
    cover.style.borderRadius = `calc(${radius}px - 3px) calc(${radius}px - 3px) 0 0`;
  }
  card.querySelector('.game-live-stats')?.toggleAttribute('hidden', !preferences.cardShowLikes);
  card.querySelector('.game-description')?.toggleAttribute('hidden', !preferences.cardShowDescription);
  card.querySelector('.game-category')?.toggleAttribute('hidden', !preferences.cardShowGenre);
  card.querySelector('.card-playtime')?.toggleAttribute('hidden', !preferences.cardShowPlaytime);
}

function renderAnimationOption(preference, value, label, active) {
  return `<button class="segment ${active ? 'active' : ''}" data-pref="${preference}" data-value="${value}" data-preview="${preference}:${value}" data-preview-label="${escapeHtml(label)}"><span>${label}</span></button>`;
}

function previewAttr(type, value, label) {
  return `data-preview="${type}:${value}" data-preview-label="${escapeHtml(label)}"`;
}

// Segmented control where every option shows a hover preview of what it changes.
function segmentsWithPreview(preference, options) {
  return `<div class="segmented">${options.map(([value, label, type]) => `<button class="segment ${preferences[preference] === value || String(preferences[preference]) === String(value) ? 'active' : ''}" data-pref="${preference}" data-value="${value}" ${previewAttr(type || preference, value, label)}>${label}</button>`).join('')}</div>`;
}

// Floating preview: every option that carries data-preview="<type>:<value>" shows a small
// mock of the launcher while the pointer is over it. Each option renders its own mock.
function previewMarkup(type, value, label, detail = '') {
  if (type === 'pageTransition') {
    const variant = { fade: 'fade', slide: 'slide', zoom: 'zoom', none: 'none' }[value] || 'fade';
    return `<div class="hover-preview-mock page-transition-mock ${variant}"><span class="mock-page"><b></b><b class="short"></b></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'cardAnimation') {
    const variant = { rise: 'rise', fade: 'fade', pop: 'pop', none: 'none' }[value] || 'rise';
    return `<div class="hover-preview-mock card-animation-mock ${variant}"><i></i><i></i><i></i></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'animationSpeed') return previewAnimationSpeed(value, label);
  if (type === 'animationEasing') return previewAnimationEasing(value, label);
  if (type === 'glow') {
    const strength = Math.max(0, Math.min(100, Number(value) || 0));
    return `<div class="hover-preview-mock glow-preview-mock" style="--preview-glow:${strength / 100}"><i></i><b></b><span></span></div><span class="hover-preview-label">${escapeHtml(label)} · ${strength}%</span>`;
  }
  if (type === 'animationDuration') {
    const duration = Math.max(50, Math.min(200, Number(value) || 100));
    return `<div class="hover-preview-mock duration-preview-mock"><i style="--preview-duration:${duration / 100}s"></i><b style="--preview-duration:${duration / 100}s"></b></div><span class="hover-preview-label">${escapeHtml(label)} · ${duration}%</span>`;
  }
  if (type === 'accent') {
    return `<div class="hover-preview-mock accent-mock" style="--mock-accent:${escapeHtml(value)}"><span class="mock-chip"></span><span class="mock-bar"></span><span class="mock-bar short"></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'accentMode') {
    return `<div class="hover-preview-mock fill-mock ${value === 'gradient' ? 'is-gradient' : ''}"><span class="mock-chip"></span><span class="mock-bar"></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'theme') {
    const tone = { dark: ['#0b0c10', '#14161d'], light: ['#f2f1f6', '#ffffff'], oled: ['#030305', '#08090c'] }[value] || ['#0b0c10', '#14161d'];
    return `<div class="hover-preview-mock theme-mock" style="--mock-bg:${tone[0]};--mock-surface:${tone[1]}"><span class="mock-side"></span><span class="mock-bar"></span><span class="mock-bar short"></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'density') {
    const columns = { spacious: 2, comfortable: 3, compact: 4 }[value] || 3;
    return `<div class="hover-preview-mock grid-mock" style="--mock-columns:${columns}">${'<i></i>'.repeat(columns * 2)}</div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'corners') {
    return `<div class="hover-preview-mock corners-mock ${value === 'sharp' ? 'is-sharp' : ''}"><i></i><i></i></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'homeLayout') {
    const heroHeight = { balanced: '34%', spotlight: '62%', library: '18%' }[value] || '34%';
    const columns = { balanced: 3, spotlight: 2, library: 4 }[value] || 3;
    return `<div class="hover-preview-mock layout-mock" style="--mock-hero:${heroHeight}"><span class="mock-hero"><b></b></span><span class="mock-grid" style="grid-template-columns:repeat(${columns},1fr)">${'<i></i>'.repeat(columns)}</span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }

  if (type === 'uiPart') {
    return previewUiPart(value, label, detail);
  }
  if (type === 'cardAspect') {
    return `<div class="hover-preview-mock aspect-mock aspect-${escapeHtml(value)}"><i></i><i></i><i></i></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'cardSize' || type === 'cardRadius') {
    const width = type === 'cardSize' ? Math.max(68, Math.min(100, Math.round(Number(value || 1) * 78))) : 82;
    const radius = type === 'cardRadius' ? Math.max(2, Math.min(18, Number(value || 0))) : Number(preferences.cardRadius || 12);
    return `<div class="hover-preview-mock card-tuning-mock" style="--mock-width:${width}%;--mock-radius:${radius}px"><i></i><b></b><span></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'cardFlag') {
    return `<div class="hover-preview-mock card-flag-mock ${detail === 'off' ? 'is-off' : ''}"><i></i><b></b><span></span><em></em></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'homeCount') {
    const count = Math.max(3, Math.min(8, Number(value) || 4));
    return `<div class="hover-preview-mock grid-mock" style="--mock-columns:${count > 6 ? 4 : count > 4 ? 3 : 2}">${'<i></i>'.repeat(count)}</div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'catalogView') {
    return `<div class="hover-preview-mock catalog-view-mock ${value === 'list' ? 'is-list' : ''}"><i></i><i></i><i></i><i></i></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'homeWidget') {
    const art = {
      hero: '<span class="sample-hero"><b></b><i></i></span>',
      playstats: '<span class="sample-bars"><i></i><i></i><i></i></span>',
      favorites: '<span class="sample-favorites">' + [0,1,2].map(() => '<i>' + icon('star', 11) + '</i>').join('') + '</span>',
      recent: '<span class="sample-recent">' + icon('clock', 15) + '<i></i><i></i></span>',
      picks: '<span class="sample-picks">' + '<i></i>'.repeat(6) + '</span>'
    };
    return `<div class="hover-preview-mock widget-sample ${detail === 'off' ? 'is-off' : ''}" aria-hidden="true">${art[value] || ''}</div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'motion') {
    return `<div class="hover-preview-mock motion-preview-mock ${value === 'off' ? 'is-off' : ''}"><i></i><b></b><span></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'contrast') {
    return `<div class="hover-preview-mock contrast-preview-mock ${value === 'on' ? 'is-strong' : ''}"><i></i><b></b><span></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  if (type === 'uiFont') {
    return `<div class="hover-preview-mock font-preview-mock ${value === 'classic' ? 'is-classic' : ''}"><strong>Vortex</strong><span>Roblox · ${escapeHtml(label)}</span><i></i></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  }
  return '';
}

// Interface part previews: each toggle shows its own corner of the launcher with the
// part highlighted, so every option is visually distinct.
function previewUiPart(part, label, state = '') {
  const active = state ? state === 'on' : Boolean(preferences[part]);
  const shell = (rows, current = active) => `<div class="hover-preview-mock ui-part-mock ui-${escapeHtml(part)} ${current ? 'is-on' : 'is-off'}">${rows}</div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
  const spark = '<span class="mock-ui-part"><i></i></span>';
  switch (part) {
    case 'uiSidebarTip':
      return shell('<span class="mock-ui-nav"></span><span class="mock-ui-nav"></span><span class="mock-ui-tip"></span>');
    case 'uiTopbarSearch':
      return shell('<span class="mock-ui-topbar"><b class="mock-crumb"></b><b class="mock-search"></b><b class="mock-bell"></b></span>');
    case 'uiBreadcrumb':
      return shell('<span class="mock-ui-topbar"><b class="mock-crumb wide"></b><b class="mock-bell"></b></span>');
    case 'uiNotifications':
      return shell('<span class="mock-ui-topbar"><b class="mock-crumb wide"></b><b class="mock-bell"></b></span>');
    case 'uiUpdateBanner':
      return shell('<span class="mock-ui-banner"><i></i><b></b></span>');
    case 'sidebarAutoHide':
      return shell('<span class="mock-ui-nav"></span><span class="mock-ui-nav"></span><span class="mock-ui-arrow"></span>');
    default:
      return shell(spark);
  }
}

// Speed preview: three dots that travel the same track at the chosen tempo.
function previewAnimationSpeed(value, label) {
  const duration = { slow: 2.1, normal: 1.3, fast: 0.7 }[value] || 1.3;
  return `<div class="hover-preview-mock speed-mock speed-${escapeHtml(value)}"><span class="mock-track"><i style="animation-duration:${duration}s"></i></span><span class="mock-track"><i style="animation-duration:${duration}s;animation-delay:.12s"></i></span><span class="mock-track"><i style="animation-duration:${duration}s;animation-delay:.24s"></i></span><span class="mock-track"><i style="animation-duration:${duration}s;animation-delay:.36s"></i></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
}

// Easing preview: one square jumping along a path with the real timing curve.
function previewAnimationEasing(value, label) {
  const curve = { smooth: 'cubic-bezier(.2,.72,.25,1)', spring: 'cubic-bezier(.16,1.2,.3,1)', linear: 'linear' }[value] || 'cubic-bezier(.2,.72,.25,1)';
  return `<div class="hover-preview-mock easing-mock"><span class="mock-ease-track"><i style="animation-timing-function:${curve}"></i><b style="animation-timing-function:${curve};animation-delay:.25s"></b></span></div><span class="hover-preview-label">${escapeHtml(label)}</span>`;
}

function previewTarget(event) {
  const path = event.composedPath?.() || [];
  const fromPath = path.find((node) => node instanceof Element && node.matches('[data-preview]'));
  if (fromPath) return fromPath;
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest?.('[data-preview]') || null;
}

let activePreviewTarget = null;
let previewHideTimer = 0;
function hideHoverPreview() {
  window.clearTimeout(previewHideTimer);
  const layer = document.getElementById('hover-preview-layer');
  if (layer) layer.hidden = true;
  activePreviewTarget = null;
}

function showHoverPreview(target) {
  if (!preferences.uiTooltips || !target?.isConnected) return;
  window.clearTimeout(previewHideTimer);
  const [type, value = '', detail = ''] = String(target.dataset.preview || '').split(':');
  const label = target.dataset.previewLabel || target.textContent.trim();
  const markup = previewMarkup(type, value, label, detail);
  if (!markup) return;
  let layer = document.getElementById('hover-preview-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'hover-preview-layer';
    layer.className = 'hover-preview-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  layer.innerHTML = markup;
  layer.hidden = false;
  const box = target.getBoundingClientRect();
  const width = layer.offsetWidth || 150;
  const height = layer.offsetHeight || 90;
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, box.left + box.width / 2 - width / 2));
  const above = box.top - height - 10;
  const top = above > 8 ? above : Math.min(window.innerHeight - height - 12, box.bottom + 10);
  layer.style.left = `${left}px`;
  layer.style.top = `${Math.max(8, top)}px`;
}

document.addEventListener('pointerover', (event) => {
  const target = previewTarget(event);
  if (!target) return;
  if (target.contains(event.relatedTarget)) return;
  if (activePreviewTarget === target) return;
  activePreviewTarget = target;
  showHoverPreview(target);
});
document.addEventListener('pointerout', (event) => {
  const target = previewTarget(event);
  if (!target || target.contains(event.relatedTarget)) return;
  if (activePreviewTarget !== target) return;
  if (previewTarget({ target: event.relatedTarget, composedPath: () => [event.relatedTarget] })) return;
  window.clearTimeout(previewHideTimer);
  previewHideTimer = window.setTimeout(() => {
    if (!activePreviewTarget?.matches(':hover')) hideHoverPreview();
  }, 60);
});
document.addEventListener('focusin', (event) => {
  const target = event.target.matches?.(':focus-visible') ? previewTarget(event) : null;
  if (!target) return;
  activePreviewTarget = target;
  showHoverPreview(target);
});
document.addEventListener('focusout', (event) => {
  const target = previewTarget(event);
  if (!target || target.contains(event.relatedTarget) || target.matches(':hover')) return;
  if (activePreviewTarget !== target) return;
  hideHoverPreview();
});
document.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  const target = previewTarget(event);
  if (target && target !== activePreviewTarget) {
    activePreviewTarget = target;
    showHoverPreview(target);
  } else if (!target && activePreviewTarget) {
    hideHoverPreview();
  } else if (activePreviewTarget && !activePreviewTarget.isConnected) {
    hideHoverPreview();
  }
});
document.documentElement.addEventListener('pointerleave', hideHoverPreview);
document.addEventListener('scroll', hideHoverPreview, true);
window.addEventListener('resize', () => activePreviewTarget?.isConnected ? showHoverPreview(activePreviewTarget) : hideHoverPreview());

function renderEffectSettings() {
  const motionOff = !preferences.motion;
  const motionAttrs = motionOff ? ' is-disabled" inert aria-disabled="true"' : '"';
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.effects.title')}</h2><p>${t('settings.effects.body')}</p></div>${icon('wand', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.glow.title')}</strong><small>${t('settings.glow.body')}</small></div><label class="range-control"><input type="range" min="0" max="100" value="${preferences.glow}" data-setting="glow" data-preview="glow:${preferences.glow}" data-preview-label="${escapeHtml(t('settings.glow.title'))}" /><span class="range-value" id="glow-value">${preferences.glow}%</span></label></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.ambient.title')}</strong><small>${t('settings.ambient.body')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.ambient}" data-toggle="ambient" data-preview="uiPart:ambient:${preferences.ambient ? 'off' : 'on'}" data-preview-label="${escapeHtml(t('settings.ambient.title'))}" aria-label="${t('settings.ambient.title')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.motion.title')}</strong><small>${t('settings.motion.body')}${motionOff ? ` · ${t('settings.motion.disabledHint')}` : ''}</small></div><button class="toggle" role="switch" aria-checked="${preferences.motion}" data-toggle="motion" data-preview="motion:${preferences.motion ? 'off' : 'on'}" data-preview-label="${escapeHtml(t('settings.motion.title'))}" aria-label="${t('settings.motion.title')}"></button></div>
      <div class="setting-line${motionAttrs}><div class="setting-label"><strong>${t('settings.transitionStyle')}</strong></div><div class="segmented animation-segmented">${renderAnimationOption('pageTransition', 'fade', t('settings.transition.fade'), preferences.pageTransition === 'fade')}${renderAnimationOption('pageTransition', 'slide', t('settings.transition.slide'), preferences.pageTransition === 'slide')}${renderAnimationOption('pageTransition', 'zoom', t('settings.transition.zoom'), preferences.pageTransition === 'zoom')}${renderAnimationOption('pageTransition', 'none', t('settings.transition.none'), preferences.pageTransition === 'none')}</div></div>
      <div class="setting-line${motionAttrs}><div class="setting-label"><strong>${t('settings.cardAnimation')}</strong></div><div class="segmented animation-segmented">${renderAnimationOption('cardAnimation', 'rise', t('settings.cards.rise'), preferences.cardAnimation === 'rise')}${renderAnimationOption('cardAnimation', 'fade', t('settings.cards.fade'), preferences.cardAnimation === 'fade')}${renderAnimationOption('cardAnimation', 'pop', t('settings.cards.pop'), preferences.cardAnimation === 'pop')}${renderAnimationOption('cardAnimation', 'none', t('settings.cards.none'), preferences.cardAnimation === 'none')}</div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.contrast.title')}</strong><small>${t('settings.contrast.body')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.contrast}" data-toggle="contrast" data-preview="contrast:${preferences.contrast ? 'off' : 'on'}" data-preview-label="${escapeHtml(t('settings.contrast.title'))}" aria-label="${t('settings.contrast.title')}"></button></div>
      <div class="setting-line${motionAttrs}><div class="setting-label"><strong>${t('settings.animationSpeed.title')}</strong><small>${t('settings.animationSpeed.body')}</small></div><div class="segmented">${[['slow', t('settings.animationSpeed.slow')], ['normal', t('settings.animationSpeed.normal')], ['fast', t('settings.animationSpeed.fast')]].map(([value, label]) => `<button class="segment ${preferences.animationSpeed === value ? 'active' : ''}" data-pref="animationSpeed" data-value="${value}" data-preview="animationSpeed:${value}" data-preview-label="${escapeHtml(label)}">${label}</button>`).join('')}</div></div>
       <div class="setting-line${motionAttrs}><div class="setting-label"><strong>${t('settings.effects.easing')}</strong><small>${t('settings.effects.easingHint')}</small></div><div class="segmented">${[['smooth', t('settings.effects.easingSmooth')], ['spring', t('settings.effects.easingSpring')], ['linear', t('settings.effects.easingLinear')]].map(([value, label]) => `<button class="segment ${preferences.animationEasing === value ? 'active' : ''}" data-pref="animationEasing" data-value="${value}" data-preview="animationEasing:${value}" data-preview-label="${escapeHtml(label)}">${label}</button>`).join('')}</div></div>
      <div class="setting-line${motionAttrs}><div class="setting-label"><strong>${t('settings.effects.pageSpeed')}</strong><small>${t('settings.effects.pageSpeedHint')}</small></div><label class="range-control"><input type="range" min="50" max="200" step="10" value="${Math.round((preferences.animationDuration || 1) * 100)}" data-animation-duration data-preview="animationDuration:${Math.round((preferences.animationDuration || 1) * 100)}" data-preview-label="${escapeHtml(t('settings.effects.pageSpeed'))}" /><span class="range-value" data-animation-duration-value>${Math.round((preferences.animationDuration || 1) * 100)}%</span></label></div>
    </section><p class="catalog-disclaimer">${t('settings.savedLocally')}</p>`;
}

function renderInterfaceSettings() {
  const navGroup = (group, titleKey) => {
    const order = navOrder(group);
    const rows = order.map((key, index) => {
      const item = NAV_ITEMS.find((entry) => entry.key === key);
      if (!item) return '';
      return `<div class="ui-row" data-ui-row="${key}" data-ui-drag="${key}" role="listitem" tabindex="0" aria-roledescription="${t('settings.ui.dragHint')}">
        <span class="ui-row-grip" aria-hidden="true">${icon('grip', 14)}</span>
        <span class="ui-row-icon" data-icon="${item.icon}"></span>
        <span class="ui-row-copy"><strong>${t(`nav.${item.key}`)}</strong></span>
        <button class="ui-row-handle" data-ui-move="${key}" data-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="${t('settings.ui.moveUp')}">${icon('navUp', 12)}</button>
        <button class="ui-row-handle" data-ui-move="${key}" data-direction="1" ${index === order.length - 1 ? 'disabled' : ''} aria-label="${t('settings.ui.moveDown')}">${icon('navDown', 12)}</button>
      </div>`;
    }).join('');
    return `<section class="nav-order-group"><h3 class="ui-section-title">${t(titleKey)}</h3>
      <div class="ui-list" role="list" aria-label="${t(titleKey)}" data-ui-order data-nav-order-group="${group}">${rows}</div></section>`;
  };
  const partToggle = (pref, titleKey, bodyKey) => `<div class="setting-line"><div class="setting-label"><strong>${t(titleKey)}</strong><small>${t(bodyKey)}</small></div><button class="toggle" role="switch" aria-checked="${preferences[pref]}" data-toggle="${pref}" data-preview="uiPart:${pref}:${preferences[pref] ? 'off' : 'on'}" data-preview-label="${escapeHtml(t(titleKey))}" aria-label="${t(titleKey)}"></button></div>`;
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.language.title')}</h2><p>${t('settings.language.body')}</p></div>${icon('message', 18)}</div>
      <div class="segmented language-segmented"><button class="segment ${preferences.language === 'ru' ? 'active' : ''}" data-pref="language" data-value="ru">${t('settings.language.ru')}</button><button class="segment ${preferences.language === 'en' ? 'active' : ''}" data-pref="language" data-value="en">${t('settings.language.en')}</button></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.ui.navTitle')}</h2><p>${t('settings.ui.navBody')}</p></div>${icon('panels', 18)}</div>
      <div class="nav-order-columns">${navGroup('topbar', 'settings.ui.group.topbar')}${navGroup('menu', 'settings.ui.group.menu')}</div>
      <p class="catalog-disclaimer">${t('settings.ui.bottomFixed')}</p>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.ui.partsTitle')}</h2><p>${t('settings.ui.partsBody')}</p></div>${icon('slidersHorizontal', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.ui.font')}</strong><small>${t('settings.ui.fontHint')}</small></div><div class="segmented">${[['modern',t('settings.ui.fontModern')],['classic',t('settings.ui.fontClassic')]].map(([v,l])=>`<button class="segment ${preferences.uiFont===v?'active':''}" data-pref="uiFont" data-value="${v}" ${previewAttr('uiFont',v,l)}>${l}</button>`).join('')}</div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.ui.autoHide')}</strong><small>${t('settings.ui.autoHideHint')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.sidebarAutoHide}" data-pref-toggle="sidebarAutoHide" data-preview="uiPart:sidebarAutoHide:${preferences.sidebarAutoHide ? 'off' : 'on'}" data-preview-label="${escapeHtml(t('settings.ui.autoHide'))}" aria-label="${t('settings.ui.autoHide')}"></button></div>

      ${partToggle('uiSidebarTip', 'settings.ui.tip', 'settings.ui.tipBody')}
      <p class="ui-section-title">${t('settings.ui.topbar')}</p>
      ${partToggle('uiTopbarSearch', 'settings.ui.search', 'settings.ui.searchBody')}
      ${partToggle('uiBreadcrumb', 'settings.ui.breadcrumb', 'settings.ui.breadcrumbBody')}
      ${partToggle('uiNotifications', 'settings.ui.notifications', 'settings.ui.notificationsBody')}
      <p class="ui-section-title">${t('settings.ui.other')}</p>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.ui.tooltips')}</strong><small>${t('settings.ui.tooltipsBody')}</small></div>
        <button class="toggle" type="button" role="switch" aria-checked="${preferences.uiTooltips}" data-toggle="uiTooltips" aria-label="${t('settings.ui.tooltips')}"></button></div>
      ${partToggle('uiUpdateBanner', 'settings.ui.updateBanner', 'settings.ui.updateBannerBody')}
      <button class="text-button theme-reset" data-action="reset-interface">${t('settings.ui.reset')}</button>
    </section>

    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.hotkeys.title')}</h2><p>${t('settings.hotkeys.body')}</p></div>${icon('keyboard', 18)}</div>
      <div class="hotkey-list">${HOTKEY_ACTIONS.map((action) => `<div class="hotkey-row"><span id="hotkey-label-${action.id}">${t(action.label)}</span><button class="hotkey-recorder" id="hotkey-key-${action.id}" data-record-hotkey="${action.id}" aria-labelledby="hotkey-label-${action.id} hotkey-key-${action.id}">${formatHotkey(hotkeyCombo(action.id))}</button></div>`).join('')}</div>
      <div class="settings-action-line"><p class="catalog-disclaimer">${t('settings.hotkeys.hint')}</p>
        <button class="control-button control-button-quiet" data-action="reset-hotkeys">${icon('rotate', 14)} ${t('settings.hotkeys.reset')}</button></div>
    </section>`;
}

function moveNavItem(key, direction) {
  const group = NAV_ITEMS.find((item) => item.key === key)?.group === 'topbar' ? 'topbar' : 'menu';
  const order = navOrder(group);
  const index = order.indexOf(key);
  const target = index + Number(direction);
  if (index < 0 || target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  preferences[group === 'topbar' ? 'topbarOrder' : 'sidebarOrder'] = order;
  savePreferences();
  renderSidebar();
  renderPage();
}

// Reordering by dragging: press the grip and move the row; the order follows the
// pointer and is saved on release. The sidebar updates live.
function reorderNavTo(fromKey, toIndex) {
  const order = navOrder();
  const fromIndex = order.indexOf(fromKey);
  if (fromIndex < 0 || toIndex < 0 || toIndex >= order.length || fromIndex === toIndex) return;
  order.splice(toIndex, 0, ...order.splice(fromIndex, 1));
  preferences.sidebarOrder = order;
}

let uiDrag = null;
const UI_DRAG_THRESHOLD = 4;

// In-flow drag reorder (Notion/Linear-style): the dragged row never leaves
// the list. While the pointer moves, the row is re-inserted in the DOM at
// the slot under the cursor, so a real gap always opens exactly where the
// row will land. No fixed positioning, no transforms, no coordinate math 
// the browser does all layout. Release commits the DOM order as-is.
function updateUiRowHandles(list) {
  if (!list) return;
  const rows = [...list.querySelectorAll('[data-ui-row]')];
  rows.forEach((row, index) => {
    const up = row.querySelector('[data-direction="-1"]');
    const down = row.querySelector('[data-direction="1"]');
    if (up) up.disabled = index === 0;
    if (down) down.disabled = index === rows.length - 1;
  });
}

function startUiDrag(event, row) {
  const list = row.closest('[data-ui-order]');
  if (!list) return;
  uiDrag = {
    row,
    list,
    started: false,
    pointerId: event.pointerId,
    pointerX: event.clientX,
    pointerY: event.clientY
  };
  event.preventDefault();
}

document.addEventListener('pointermove', (event) => {
  if (!uiDrag || event.pointerId !== uiDrag.pointerId) return;
  if (!uiDrag.started) {
    if (Math.hypot(event.clientX - uiDrag.pointerX, event.clientY - uiDrag.pointerY) < UI_DRAG_THRESHOLD) return;
    uiDrag.started = true;
    uiDrag.row.classList.add('ui-row-dragging');
    document.body.classList.add('ui-dragging');
    if (uiDrag.row.hasAttribute('draggable')) uiDrag.row.setAttribute('draggable', 'false');
  }
  // Which row is the cursor over? Insert the dragged row before it.
  // Rows are matched by the data attribute so widget sections (home-widget,
  // not ui-row) ride the same machinery when dragged on the home page.
  const rows = [...uiDrag.list.querySelectorAll('[data-ui-row]:not(.ui-row-dragging)')];
  let anchor = null;
  for (const item of rows) {
    const rect = item.getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) { anchor = item; break; }
  }
  if (anchor) {
    if (uiDrag.row.nextElementSibling !== anchor) uiDrag.list.insertBefore(uiDrag.row, anchor);
  } else {
    // Cursor below every row: move to the end.
    if (uiDrag.list.lastElementChild !== uiDrag.row) uiDrag.list.appendChild(uiDrag.row);
  }
  updateUiRowHandles(uiDrag.list);
});

function finishUiDrag() {
  if (!uiDrag) return;
  const { row, list, started } = uiDrag;
  uiDrag = null;
  if (!started) return;
  row.classList.remove('ui-row-dragging');
  document.body.classList.remove('ui-dragging');
  const order = [...list.querySelectorAll('[data-ui-row]')].map((item) => item.dataset.uiRow).filter(Boolean);
  // Widget config rows (data-ui-row="widget:<key>") reorder home widgets,
  // sidebar rows reorder nav items. The prefix tells them apart.
  if (order[0] && String(order[0]).startsWith('widget:')) {
    preferences.homeWidgetOrder = order.map((k) => String(k).slice(7)).filter(Boolean);
  } else {
    const group = list.dataset.navOrderGroup === 'topbar' ? 'topbarOrder' : 'sidebarOrder';
    preferences[group] = order;
  }
  savePreferences();
  renderSidebar();
  updateUiRowHandles(list);
}

document.addEventListener('pointerup', finishUiDrag);
document.addEventListener('pointercancel', finishUiDrag);
document.addEventListener('pointercancel', finishUiDrag);

// Keyboard support: focus a row, then reorder with the arrows.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  const row = event.target.closest?.('[data-ui-row]');
  if (!row || !row.closest('[data-ui-order]')) return;
  event.preventDefault();
  const key = String(row.dataset.uiRow);
  if (key.startsWith('widget:')) {
    moveHomeWidget(key.slice(7), event.key === 'ArrowUp' ? '-1' : '1');
  } else {
    moveNavItem(key, event.key === 'ArrowUp' ? '-1' : '1');
  }
  window.requestAnimationFrame(() => pageContent.querySelector(`[data-ui-row="${row.dataset.uiRow}"]`)?.focus());
});

document.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  // The whole row is the drag handle; the arrow buttons keep their own clicks.
  const row = event.target.closest?.('[data-ui-row]');
  if (!row || !row.closest('[data-ui-order]')) return;
  if (event.target.closest('button')) return;
  startUiDrag(event, row);
});

// Widget drag on the home page itself: grip in the widget heading drags a
// placeholder row so the same in-flow reorder machinery runs.
document.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  const grip = event.target.closest?.('[data-widget-drag]');
  if (!grip) return;
  const section = grip.closest('[data-home-widget]');
  if (!section) return;
  const homeView = section.closest('[data-home-view]');
  if (!homeView) return;
  const widgetRows = [...homeView.querySelectorAll('.home-widget')];
  const index = widgetRows.indexOf(section);
  if (index < 0) return;
  // Promote every widget section to a draggable row for the shared machinery.
  widgetRows.forEach((w) => { if (!w.dataset.uiRow) w.dataset.uiRow = `widget:${w.dataset.homeWidget}`; });
  // Tag the drag list: homeView has no [data-ui-order]; add it transiently.
  homeView.setAttribute('data-ui-order', '');
  uiDrag = {
    row: section,
    list: homeView,
    started: false,
    pointerId: event.pointerId,
    pointerX: event.clientX,
    pointerY: event.clientY
  };
  event.preventDefault();
});

function moveHomeWidget(key, direction) {
  const order = homeWidgetOrder();
  const index = order.indexOf(key);
  const target = index + Number(direction);
  if (index < 0 || target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  preferences.homeWidgetOrder = order;
  savePreferences();
  renderPage();
}

function renderUpdateSettings() {
  const state = latestUpdateState || { status: 'idle', progress: 0 };
  const status = state.status;
  const version = status === 'available' ? state.latestVersion : state.currentVersion;
  const statusMessage = status === 'downloading' ? t('updates.downloading', { percent: Math.max(0, Math.min(100, Number(state.progress) || 0)) })
    : status === 'downloaded' ? t('updates.ready')
      : status === 'applying' ? t('updates.applying')
        : status === 'error' ? t('updates.error', { error: escapeHtml(state.errorMessage || 'Unknown error') })
          : status === 'available' ? t('updates.available')
            : status === 'idle' ? t('updates.notChecked')
              : status === 'current' ? t('updates.current')
            : status === 'unavailable' ? t('updates.unavailable')
              : status === 'development' ? t('updates.development') : t('updates.checking');
  const progress = Math.max(0, Math.min(100, Number(state.progress) || 0));
  const visualProgress = status === 'applying' || status === 'downloaded' ? 100 : progress;
  const checking = status === 'checking';
  const downloading = status === 'downloading';
  const installReady = status === 'downloaded';
  const downloadingButton = downloading ? `<button class="control-button update-download-button" disabled>${icon('download', 13)} ${t('updates.downloading', { percent: progress })}</button>` : '';
  const primaryUpdateAction = status === 'available' ? `<button class="control-button control-button-primary" data-action="install-update">${icon('download', 13)} ${t('updates.downloadNow')}</button>`
    : installReady ? `<button class="control-button control-button-primary" data-action="install-update">${icon('check', 13)} ${t('updates.installNow')}</button>`
      : downloadingButton;
  return `<section class="settings-card update-settings-card" id="update-settings-card" data-update-status="${escapeHtml(status)}"><div class="settings-card-head"><div><h2>${t('updates.settingsTitle')}</h2><p>${t('updates.settingsBody')}</p></div>${icon('package', 18)}</div>
    <div class="update-settings-preview"><div class="update-preview-art" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="update-preview-copy"><strong>${escapeHtml(version ? `Vortex ${version}` : t('updates.settingsTitle'))}</strong><small>${statusMessage}</small><span class="update-settings-progress"><i style="--progress:${visualProgress}%"></i></span></div></div>
    <div class="settings-action-line"><div class="update-settings-meta">
      <span><small>${t('updates.currentVersionLabel')}</small><strong>${escapeHtml(state.currentVersion || '—')}</strong></span>
      <span><small>${t('updates.lastCheckLabel')}</small><strong>${lastUpdateCheckAt ? escapeHtml(new Date(lastUpdateCheckAt).toLocaleString(preferences.language === 'en' ? 'en-US' : 'ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) : '—'}</strong></span>
    </div>
    <div class="update-settings-actions">${primaryUpdateAction}<button class="control-button update-retry-button" data-action="retry-update" ${checking || downloading || status === 'applying' ? 'disabled' : ''}>${icon('rotate', 13)} ${checking ? t('updates.checkingShort') : t('updates.checkNow')}</button>${status === 'available' && state.releaseUrl ? `<button class="control-button control-button-quiet" data-action="open-update-release">${t('updates.openRelease')}</button>` : ''}</div></div>
  </section>`;
}

function renderAnnouncementSettings() {
  const unread = unreadAnnouncements().length;
  const sourceLabel = announcementSource === 'network' ? t('notifications.sourceNetwork')
    : announcementSource === 'cache' ? t('notifications.offline')
      : announcementSource === 'builtin' ? t('notifications.local')
        : '—';
  return `<section class="settings-card" id="announcement-settings-card"><div class="settings-card-head"><div><h2>${t('notifications.settingsTitle')}</h2><p>${t('notifications.settingsBody')}</p></div>${icon('bell', 18)}</div>
    <div class="settings-action-line"><div class="update-settings-meta">
      <span><small>${t('notifications.totalLabel')}</small><strong>${announcementItems.length}</strong></span>
      <span><small>${t('notifications.unreadLabel')}</small><strong>${unread}</strong></span>
      <span><small>${t('notifications.sourceLabel')}</small><strong>${escapeHtml(sourceLabel)}</strong></span>
    </div>
    <button class="control-button" data-action="refresh-announcements">${icon('rotate', 13)} ${t('notifications.refresh')}</button></div>
  </section>`;
}

let discordStatusCache = null;
let discordHelpOpen = false;
function discordStatusText() {
  const status = discordStatusCache;
  if (!status) return preferences.discordPresence ? t('discord.status.connecting') : t('discord.status.off');
  if (status.connected) return t('discord.status.connected', { account: status.account?.name || 'Discord' });
  if (!status.hasClientId) return t('discord.status.noClientId');
  if (status.error === 'discord-not-running') return t('discord.status.notRunning');
  if (status.error) return t('discord.status.error', { error: status.error });
  return t('discord.status.connecting');
}

async function refreshDiscordStatus() {
  try { discordStatusCache = await window.vortexDesktop?.getDiscordStatus?.(); } catch { discordStatusCache = null; }
  const host = document.querySelector('[data-discord-status]');
  if (host) host.textContent = discordStatusText();
}

let lastDiscordPayloadJson = '';

function applyDiscordPresence(force = false) {
  window.vortexDesktop?.setDiscordEnabled?.(Boolean(preferences.discordPresence));
  if (!preferences.discordPresence) {
    lastDiscordPayloadJson = '';
    return;
  }
  const active = typeof currentPlayingInviteState === 'function' ? currentPlayingInviteState() : null;
  let payload;
  if (active) {
    const startSec = Math.floor((Number(active.startedAt) || Date.now()) / 1000);
    const isPublicJoinable = Boolean(active.serverId) && !active.isPrivate;
    const showJoinButton = !preferences.streamMode && isPublicJoinable && Boolean(active.url);
    const serverState = !preferences.streamMode && active.serverId
      ? (active.isPrivate ? t('place.privateServersTitle') : t('discord.playingServer', { server: active.serverId.slice(0, 8) }))
      : t('discord.inRoblox');
    payload = {
      details: t('discord.playingGame', { game: active.title }),
      state: serverState,
      startTimestamp: startSec,
      largeImage: active.thumbnail || undefined,
      largeText: active.title || undefined,
      buttonLabel: showJoinButton ? t('discord.joinServer') : undefined,
      buttonUrl: showJoinButton ? active.url : undefined
    };
  } else {
    const viewing = currentView === 'game-detail' && detailGame ? detailGame.title : null;
    payload = {
      details: viewing ? t('discord.viewing', { game: viewing }) : t('discord.browsing'),
      state: viewing ? t('discord.inVortex') : t('discord.launcher')
    };
  }
  const serialized = JSON.stringify(payload);
  if (!force && serialized === lastDiscordPayloadJson) return;
  lastDiscordPayloadJson = serialized;
  window.vortexDesktop?.setDiscordActivity?.(payload);
  setTimeout(refreshDiscordStatus, 1200);
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / 1024 / 1024).toFixed(2)} МБ`;
}

// Sums every vortex.* key the renderer keeps in localStorage.
function cacheFootprintBytes() {
  let total = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith('vortex.')) continue;
      if (key.startsWith('vortex.onlineHistory.')) continue;
      total += key.length + String(localStorage.getItem(key) || '').length;
    }
  } catch { return 0; }
  return total;
}

function onlineHistoryBytes() {
  let total = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith('vortex.onlineHistory.')) continue;
      total += key.length + String(localStorage.getItem(key) || '').length;
    }
  } catch { return 0; }
  return total;
}

let apiStatusCache = null;

function renderApiStatusPlaceholder() {
  return apiStatusCache ? renderApiStatus(apiStatusCache) : `<p class="catalog-disclaimer">${t('settings.api.notChecked')}</p>`;
}

function renderApiStatus(result) {
  const labels = { games: t('settings.api.games'), thumbnails: t('settings.api.thumbnails'), badges: t('settings.api.badges'), search: t('settings.api.search'), discover: t('settings.api.discover'), users: t('settings.api.users') };
  return (result?.services || []).map((service) => `<div class="api-status-row ${service.ok ? 'ok' : 'bad'}"><span class="api-status-dot"></span><span><strong>${labels[service.id] || service.id}</strong><small>${service.ok ? t('settings.api.online', { ms: String(service.ms) }) : t('settings.api.offline')}</small></span></div>`).join('');
}

function updateTopbarApiIndicator(result) {
  const pill = document.getElementById('topbar-api-status');
  if (!pill) return;
  const services = Array.isArray(result?.services) ? result.services : [];
  if (!services.length) { pill.hidden = true; return; }
  const bad = services.filter((s) => !s.ok);
  if (!bad.length) {
    pill.hidden = true;
    return;
  }
  const allDown = bad.length === services.length;
  pill.hidden = false;
  pill.dataset.state = allDown ? 'down' : 'degraded';
  const tip = preferences.language === 'en'
    ? `Roblox API issues (${bad.length}/${services.length} unavailable) — click for details`
    : `Сбой Roblox API (недоступно ${bad.length} из ${services.length}) — нажмите для подробностей`;
  pill.dataset.tooltip = tip;
  pill.setAttribute('aria-label', tip);
}

async function checkApiStatus(silent = false) {
  const host = document.querySelector('[data-api-status]');
  if (host && !silent) host.innerHTML = `<p class="catalog-disclaimer">${t('settings.api.checking')}</p>`;
  try {
    apiStatusCache = await window.vortexDesktop?.getRobloxApiStatus?.();
  } catch { apiStatusCache = null; }
  updateTopbarApiIndicator(apiStatusCache);
  if (host) host.innerHTML = apiStatusCache ? renderApiStatus(apiStatusCache) : `<p class="catalog-disclaimer">${t('settings.api.failed')}</p>`;
}

// Quiet background health check shortly after launch so the topbar indicator
// only lights up if Roblox APIs are actually degraded.
window.setTimeout(() => {
  if (window.vortexDesktop?.getRobloxApiStatus && !apiStatusCache) {
    void checkApiStatus(true);
  }
}, 8000);

function renderGeneralSettings() {
  return `${renderWindowsAutostart()}
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.friends.title')}</h2><p>${t('settings.friends.body')}</p></div>${icon('users', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.friends.username')}</strong><small>${t('settings.friends.usernameHint')}</small></div>
        <span class="roblox-username-field"><input class="control-field" type="text" maxlength="20" autocomplete="off" placeholder="Roblox" aria-label="${t('settings.friends.username')}" value="${escapeHtml(preferences.robloxUsername || '')}" data-roblox-username />
          <button class="control-button" data-detect-username>${icon('userScan', 15)} ${t('friends.detect')}</button>
          <button class="control-button control-button-primary" data-save-username>${icon('userCheck', 15)} ${t('common.save')}</button></span></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.history.title')}</h2><p>${t('settings.history.body')}</p></div>${icon('history', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.history.title')}</strong><small>${t('settings.history.body')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.saveHistory}" data-toggle="saveHistory" aria-label="${t('settings.history.title')}"></button></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.safety.title')}</h2><p>${t('settings.safety.body')}</p></div>${icon('shield', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.safety.confirmLaunch')}</strong><small>${t('settings.safety.confirmLaunchHint')}</small></div><button class="toggle" role="switch" aria-checked="${Boolean(preferences.confirmLaunch)}" data-toggle="confirmLaunch" aria-label="${t('settings.safety.confirmLaunch')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.safety.confirmDelete')}</strong><small>${t('settings.safety.confirmDeleteHint')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.confirmDelete !== false}" data-toggle="confirmDelete" aria-label="${t('settings.safety.confirmDelete')}"></button></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.profiles.title')}</h2><p>${t('settings.profiles.body')}</p></div>${icon('profileStack', 18)}</div>
      <div class="profile-actions">
        <div class="profile-editor"><input class="control-field" type="text" maxlength="32" aria-label="${t('settings.profiles.namePlaceholder')}" placeholder="${t('settings.profiles.namePlaceholder')}" data-profile-name />
          <button class="control-button control-button-primary" data-action="save-profile">${icon('saveProfile', 15)} ${t('settings.profiles.save')}</button></div>
        <div class="data-actions">
          <button class="control-button" data-action="export-profiles">${icon('fileDown', 14)} ${t('settings.profiles.export')}</button>
          <button class="control-button" data-action="import-profiles">${icon('fileUp', 14)} ${t('settings.profiles.import')}</button>
          <input type="file" accept=".json,application/json" data-profiles-file hidden />
        </div>
      </div>
      <div class="profile-list">${Object.keys(readProfiles()).length ? Object.entries(readProfiles()).map(([name, profile]) => `
        <div class="profile-row">
          <span class="profile-copy"><strong>${escapeHtml(name)}</strong><small>${new Date(profile.savedAt || Date.now()).toLocaleDateString(preferences.language)}</small></span>
          <button class="control-button" data-apply-profile="${escapeHtml(name)}">${icon('check', 14)} ${t('settings.profiles.apply')}</button>
          <button class="control-button control-button-quiet" data-overwrite-profile="${escapeHtml(name)}">${t('settings.profiles.overwrite')}</button>
          <button class="control-button control-button-icon control-button-quiet" data-remove-profile="${escapeHtml(name)}" aria-label="${t('settings.profiles.remove')}">${icon('close', 14)}</button>
        </div>`).join('') : `<p class="catalog-disclaimer">${t('settings.profiles.empty')}</p>`}
      </div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.reset.title')}</h2><p>${t('settings.reset.body')}</p></div>${icon('rotate', 18)}</div>
      <button class="control-button control-button-quiet" data-action="reset-appearance">${icon('rotate', 14)} ${t('settings.resetButton')}</button>
    </section>`;
}

function renderSettings() {
  const panel = preferences.settingsTab === 'home' ? renderHomeSettings()
    : preferences.settingsTab === 'cards' ? renderCardSettings()
      : preferences.settingsTab === 'effects' ? renderEffectSettings()
        : preferences.settingsTab === 'interface' ? renderInterfaceSettings()
          : preferences.settingsTab === 'general' ? renderGeneralSettings()
            : preferences.settingsTab === 'in-game' ? renderGameOverlaySettings()
              : preferences.settingsTab === 'hotkeys' ? renderHotkeySettings()
                : preferences.settingsTab === 'tray' ? renderTraySettings()
                : preferences.settingsTab === 'integrations' ? renderIntegrationSettings()
                  : preferences.settingsTab === 'data' ? renderDataSettings()
                    : preferences.settingsTab === 'version' ? `${renderUpdateSettings()}${renderAnnouncementSettings()}`
                      : renderAccentSettings();
  return `${pageHeading('', t('page.settings.title'), t('page.settings.description'))}
    ${renderSettingsSearch()}<div class="settings-layout">${settingsTabs()}<div class="settings-panel" data-panel="${preferences.settingsTab}">${panel}${renderLauncherSettings(preferences.settingsTab)}</div></div>`;
}

// Integrations tab: Discord presence, friend alerts and the tray.
function renderTraySettings() {
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.tray.title')}</h2><p>${t('settings.tray.body')}</p></div>${icon('tray', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.tray.scale')}</strong><small>${t('settings.tray.scaleBody')}</small></div><div class="segmented tray-scale-segmented">${[['compact', t('settings.tray.compact')], ['normal', t('settings.tray.normal')], ['large', t('settings.tray.large')]].map(([value, label]) => `<button class="segment ${preferences.trayScale === value ? 'active' : ''}" data-pref="trayScale" data-value="${value}">${label}</button>`).join('')}</div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.tray.miniPlayer')}</strong><small>${t('settings.tray.miniPlayerBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.trayMiniPlayer}" data-toggle="trayMiniPlayer" aria-label="${t('settings.tray.miniPlayer')}"></button></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.tray.limitsTitle')}</h2><p>${t('settings.tray.limitsBody')}</p></div>${icon('list', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.tray.favoriteLimit')}</strong><small>${t('settings.tray.limitHint')}</small></div>
        <div class="tray-limit-control">
          <label class="range-control"><input type="range" min="1" max="20" step="1" value="${preferences.trayFavoritesLimit}" data-tray-limit="trayFavoritesLimit" ${preferences.trayFavoritesUnlimited ? 'disabled' : ''} /><span class="range-value" data-tray-limit-value="trayFavoritesLimit">${preferences.trayFavoritesUnlimited ? '∞' : preferences.trayFavoritesLimit}</span></label>
          <span class="tray-limit-toggle"><small>${t('settings.tray.noLimit')}</small><button class="toggle" role="switch" aria-checked="${preferences.trayFavoritesUnlimited}" data-pref-toggle="trayFavoritesUnlimited" aria-label="${t('settings.tray.noLimit')}"></button></span>
        </div>
      </div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.tray.quickLimit')}</strong><small>${t('settings.tray.limitHint')}</small></div>
        <div class="tray-limit-control">
          <label class="range-control"><input type="range" min="1" max="20" step="1" value="${preferences.trayQuickLimit}" data-tray-limit="trayQuickLimit" ${preferences.trayQuickUnlimited ? 'disabled' : ''} /><span class="range-value" data-tray-limit-value="trayQuickLimit">${preferences.trayQuickUnlimited ? '∞' : preferences.trayQuickLimit}</span></label>
          <span class="tray-limit-toggle"><small>${t('settings.tray.noLimit')}</small><button class="toggle" role="switch" aria-checked="${preferences.trayQuickUnlimited}" data-pref-toggle="trayQuickUnlimited" aria-label="${t('settings.tray.noLimit')}"></button></span>
        </div>
      </div>
    </section>`;
}

function renderIntegrationSettings() {
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.integrations.title')}</h2><p>${t('settings.integrations.body')}</p></div>${icon('discord', 18)}</div>
      <div class="setting-line discord-id-line"><div class="setting-label"><strong>${t('settings.integrations.discordClientId')}</strong><small>${t('settings.integrations.discordClientIdHint')}</small></div>
        <span class="discord-id-field"><input class="control-field" type="text" inputmode="numeric" autocomplete="off" maxlength="22" placeholder="1536230039870505020" aria-label="${t('settings.integrations.discordClientId')}" value="${escapeHtml(preferences.discordClientId || '')}" data-discord-client-id />
          <button class="control-button control-button-primary" data-action="save-discord-client">${icon('idCard', 15)} ${t('settings.integrations.discordSaveId')}</button></span></div>
      <button class="discord-help-toggle" type="button" data-action="toggle-discord-help" aria-expanded="${discordHelpOpen}" aria-controls="discord-help-panel">${icon('chevronDown', 13)}<span>${t('settings.integrations.discordWhere')}</span></button>
      <div class="discord-help-panel ${discordHelpOpen ? 'is-open' : ''}" id="discord-help-panel">
        <div class="discord-help-inner">
          <ol class="discord-steps">
            <li>${t('settings.integrations.discordStep1')}</li>
            <li>${t('settings.integrations.discordStep2')}</li>
            <li>${t('settings.integrations.discordStep3')}</li>
          </ol>
        </div>
      </div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.integrations.discord')}</strong><small>${t('settings.integrations.discordBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.discordPresence}" data-toggle="discordPresence" aria-label="${t('settings.integrations.discord')}"></button></div>
      <p class="catalog-disclaimer discord-status" data-discord-status>${discordStatusText()}</p>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.integrations.friendAlerts')}</strong><small>${t('settings.integrations.friendAlertsBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.friendFavoriteAlerts}" data-toggle="friendFavoriteAlerts" aria-label="${t('settings.integrations.friendAlerts')}"></button></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.presence.title')}</h2><p>${t('settings.presence.body')}</p></div>${icon('lock', 18)}</div>
      <div class="presence-form">
        <label class="presence-label" for="presence-cookie-input">${t('settings.presence.cookie')}</label>
        <textarea class="control-field" id="presence-cookie-input" rows="2" autocomplete="off" spellcheck="false" placeholder=".ROBLOSECURITY" data-presence-cookie></textarea>
        <small class="presence-cookie-meter" data-presence-meter data-hint="${t('settings.presence.cookieHint')}"></small>
        <span class="presence-cookie-error" data-presence-error></span>
        <span class="presence-actions">
          <button class="control-button control-button-primary" data-save-presence>${icon('lock', 14)} ${t('common.save')}</button>
          <button class="control-button control-button-quiet" data-remove-presence>${icon('close', 14)} ${t('settings.presence.disable')}</button>
        </span>
        <p class="presence-warning">${t('settings.presence.hint')}</p>
      </div>
    </section>
`;
}

// Data tab: caches, size limits and the Roblox API health probe.
function renderDataSettings() {
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.cache.title')}</h2><p>${t('settings.cache.body')}</p></div>${icon('database', 18)}</div>
      <div class="settings-action-line settings-action-line-cache"><div class="update-settings-meta">
        <span><small>${t('settings.cache.details')}</small><strong data-cache-size>${formatBytes(cacheFootprintBytes())}</strong></span>
        <span><small>${t('settings.cache.onlineHistory')}</small><strong data-history-size>${formatBytes(onlineHistoryBytes())}</strong></span>
      </div>
      <div class="data-actions">
        <button class="control-button" data-action="clear-cache">${icon('trash', 14)} ${t('settings.cacheClear')}</button>
        <button class="control-button" data-action="clear-api-cache">${icon('refreshCw', 14)} ${t('settings.cache.clearApi')}</button>
        <button class="control-button" data-action="clear-history-cache">${icon('history', 14)} ${t('settings.cache.clearHistory')}</button>
      </div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.cache.diskCache')}</strong><small>${t('settings.cache.diskCacheBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.diskCache}" data-toggle="diskCache" aria-label="${t('settings.cache.diskCache')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.cache.lazyImages')}</strong><small>${t('settings.cache.lazyImagesBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.lazyImages}" data-toggle="lazyImages" aria-label="${t('settings.cache.lazyImages')}"></button></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.api.title')}</h2><p>${t('settings.api.body')}</p></div>${icon('code', 18)}</div>
      <div class="api-status-list" data-api-status>${renderApiStatusPlaceholder()}</div>
      <button class="control-button" data-action="check-api-status">${icon('pulse', 14)} ${t('settings.api.check')}</button>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.data.title')}</h2><p>${t('settings.data.body')}</p></div>${icon('share', 18)}</div>
      <div class="data-actions">
        <button class="control-button control-button-primary" data-action="export-data" data-tooltip="${preferences.language === 'en' ? 'Save full backup (settings, favorites, notes, quick launch, playtime — never includes cookies)' : 'Сохранить полную резервную копию (настройки, избранное, заметки, быстрый запуск, история — без cookie)'}">${icon('fileDown', 14)} ${t('settings.data.export')}</button>
        <button class="control-button" data-action="import-data" data-tooltip="${preferences.language === 'en' ? 'Restore settings and library from a Vortex backup file' : 'Восстановить настройки и библиотеку из файла резервной копии Vortex'}">${icon('fileUp', 14)} ${t('settings.data.import')}</button>
      </div>
    </section>`;
}

