(() => {
  const invoke = (command, args = {}) => window.__TAURI__?.core?.invoke?.(command, args);
  const eventApi = window.__TAURI__?.event;
  const copy = {
    ru: { favorites: 'Избранное', quick: 'Быстрый запуск', open: 'Открыть Vortex', quit: 'Выход', launch: 'Запустить', launchHint: 'Нажмите, чтобы запустить', emptyFavorites: 'Добавьте игры в избранное, чтобы запускать их отсюда.', emptyQuick: 'Добавьте игры через «Быстрый запуск» в приложении.', justNow: 'только что', minutes: 'мин назад', hours: 'ч назад', days: 'дн назад', launching: 'Запускаем…', playing: 'Играет' },
    en: { favorites: 'Favorites', quick: 'Quick launch', open: 'Open Vortex', quit: 'Quit', launch: 'Launch', launchHint: 'Click to launch', emptyFavorites: 'Add games to your favorites to launch them here.', emptyQuick: 'Add games from Quick launch in the app.', justNow: 'just now', minutes: 'm ago', hours: 'h ago', days: 'd ago', launching: 'Launching…', playing: 'Playing' }
  };
  const cssTokens = ['--bg', '--surface', '--surface-2', '--surface-3', '--line', '--line-strong', '--text', '--muted', '--subtle', '--accent', '--accent-rgb', '--accent-secondary', '--accent-secondary-rgb', '--accent-fill', '--accent-wash', '--accent-text', '--accent-contrast', '--accent-border', '--radius-card', '--font-ui'];
  const state = { favorites: [], quickLaunch: [], style: {}, language: 'ru' };
  const $ = (selector) => document.querySelector(selector);
  let toastTimer = 0;
  let nowPlayingTimer = 0;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const strings = () => copy[state.language] || copy.ru;
  const timeAgo = (value) => {
    const stamp = Number(value) || 0;
    if (!stamp) return strings().launchHint;
    const minutes = Math.max(0, Math.floor((Date.now() - stamp) / 60000));
    if (!minutes) return strings().justNow;
    if (minutes < 60) return `${minutes} ${strings().minutes}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${strings().hours}`;
    return `${Math.floor(hours / 24)} ${strings().days}`;
  };

  function applyStyle(style = {}) {
    state.style = style || {};
    state.language = style.language === 'en' ? 'en' : 'ru';
    const root = document.documentElement;
    for (const token of cssTokens) {
      const value = style.css?.[token];
      if (typeof value === 'string' && value.trim()) root.style.setProperty(token, value);
    }
    const scale = { compact: .82, normal: .9, large: 1 }[style.trayScale] || .9;
    root.style.setProperty('--tray-scale', String(scale));
    root.style.colorScheme = style.theme === 'light' || style.lightTheme ? 'light' : 'dark';
    document.body.classList.toggle('tray-sharp', style.corners === 'sharp');
    document.documentElement.lang = state.language;
    document.querySelectorAll('[data-copy]').forEach((node) => {
      const key = node.dataset.copy;
      node.textContent = strings()[key] || node.textContent;
    });
    $('[data-tray-action="quit"]')?.setAttribute('aria-label', state.language === 'en' ? 'Quit Vortex completely' : 'Закрыть Vortex полностью');
  }

  const gamepadIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 11.5h11a4.5 4.5 0 0 1 4.3 5.9l-.5 1.5a2.4 2.4 0 0 1-3.8 1.1L14.8 17h-5.6l-2.7 3a2.4 2.4 0 0 1-3.8-1.1l-.5-1.5a4.5 4.5 0 0 1 4.3-5.9Z"/><path d="M8 8V4m-2 2h4m7 0h.01M19 8h.01"/></svg>';
  const playIcon = '<span class="tray-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m8 5 12 7-12 7z"/></svg></span>';

  function gameRow(game, kind, index) {
    const title = escapeHtml(game.title || game.id || 'Roblox');
    const thumbnail = /^https:\/\/[a-z0-9.-]+\.rbxcdn\.com\//i.test(String(game.thumbnail || ''))
      ? `<img src="${escapeHtml(game.thumbnail)}" alt="" />`
      : gamepadIcon;
    return `<button class="tray-game" type="button" data-tray-launch="${kind}" data-index="${index}" title="${escapeHtml(strings().launch)}: ${title}">
      <span class="tray-game-art">${thumbnail}</span><span class="tray-game-copy"><strong>${title}</strong><small>${escapeHtml(timeAgo(game.lastPlayed))}</small></span>${playIcon}
    </button>`;
  }

  function emptyRow(text) {
    return `<div class="tray-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.9c0 4.2-8.8 10.2-8.8 10.2S3.2 13.1 3.2 8.9a4.2 4.2 0 0 1 7.5-2.6L12 7.8l1.3-1.5a4.2 4.2 0 0 1 7.5 2.6Z"/></svg><span>${escapeHtml(text)}</span></div>`;
  }

  function render(data = {}) {
    state.favorites = Array.isArray(data.favorites) ? data.favorites.slice(0, 5) : [];
    state.quickLaunch = Array.isArray(data.quickLaunch) ? data.quickLaunch.slice(0, 3) : [];
    $('#tray-favorites').innerHTML = state.favorites.length
      ? state.favorites.map((game, index) => gameRow(game, 'favorite', index)).join('')
      : emptyRow(strings().emptyFavorites);
    $('#tray-quick-launch').innerHTML = state.quickLaunch.length
      ? state.quickLaunch.map((game, index) => gameRow(game, 'quick', index)).join('')
      : emptyRow(strings().emptyQuick);
    $('[data-favorite-count]').textContent = `${state.favorites.length} / 5`;
    $('[data-quick-count]').textContent = `${state.quickLaunch.length} / 3`;
    renderNowPlaying(data.nowPlaying);
    window.requestAnimationFrame(() => {
      const height = Math.ceil(document.documentElement.scrollHeight);
      if (height > 0) void Promise.resolve(invoke('tray_fit_content', { height })).catch(() => {});
    });
  }

  function renderNowPlaying(nowPlaying) {
    const host = $('#tray-now-playing');
    if (!host) return;
    if (!nowPlaying?.id) {
      host.hidden = true;
      window.clearInterval(nowPlayingTimer);
      nowPlayingTimer = 0;
      return;
    }
    host.hidden = false;
    const thumbnail = /^https:\/\/[a-z0-9.-]+\.rbxcdn\.com\//i.test(String(nowPlaying.thumbnail || ''));
    $('#tray-now-art').innerHTML = thumbnail ? `<img src="${escapeHtml(nowPlaying.thumbnail)}" alt="" />` : gamepadIcon;
    $('#tray-now-title').textContent = nowPlaying.title || '';
    const startedAt = Number(nowPlaying.startedAt) || Date.now();
    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      $('#tray-now-time').textContent = `${strings().playing} · ${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    };
    tick();
    window.clearInterval(nowPlayingTimer);
    nowPlayingTimer = window.setInterval(tick, 1000);
  }

  async function refresh() {
    try {
      const data = await invoke('tray_get_state');
      if (data?.style) applyStyle(data.style);
      render(data || {});
    } catch {
      render({});
    }
  }

  function showToast(message) {
    const node = $('#tray-toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => node.classList.remove('is-visible'), 1600);
  }

  document.addEventListener('click', async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const action = target.closest('[data-tray-action]')?.dataset.trayAction;
    if (action === 'open') { await invoke('tray_open_app'); return; }
    if (action === 'quit') { await invoke('tray_quit_app'); return; }
    const launchButton = target.closest('[data-tray-launch]');
    if (!launchButton) return;
    const list = launchButton.dataset.trayLaunch === 'favorite' ? state.favorites : state.quickLaunch;
    const item = list[Number(launchButton.dataset.index)];
    if (!item?.id) return;
    try {
      showToast(strings().launching);
      await invoke('tray_launch_game', { kind: launchButton.dataset.trayLaunch, id: item.id });
      await invoke('tray_dismiss');
    } catch {
      showToast(state.language === 'en' ? 'Could not start the game.' : 'Не удалось запустить игру.');
    }
  });

  eventApi?.listen?.('tray:updated', (event) => {
    const data = event?.payload || {};
    if (data.style) applyStyle(data.style);
    render(data);
  });
  eventApi?.listen?.('tray:opened', () => { void refresh(); });
  void refresh();
})();
