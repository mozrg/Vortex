(() => {
  const invoke = (command, args = {}) => window.__TAURI__?.core?.invoke?.(command, args);
  const eventApi = window.__TAURI__?.event;
  const copy = {
    ru: {
      favorites: 'Избранное', quick: 'Быстрый запуск', open: 'Открыть Vortex', quit: 'Выход',
      launch: 'Запустить', launchHint: 'Нажмите, чтобы запустить',
      emptyFavorites: 'Добавьте игры в избранное, чтобы запускать их отсюда.',
      emptyQuick: 'Добавьте игры через «Быстрый запуск» в приложении.',
      justNow: 'только что', minutes: 'мин назад', hours: 'ч назад', days: 'дн назад',
      launching: 'Запускаем…', playing: 'В игре', collapse: 'Свернуть раздел', expand: 'Развернуть раздел',
      sessionInvite: 'Инвайт-ссылка', sessionHop: 'Сменить сервер (Hop)',
      sessionRejoin: 'Перезайти (Rejoin)', sessionMute: 'Выключить / включить звук Roblox',
      inviteCopied: 'Инвайт-ссылка скопирована', hopping: 'Смена сервера…',
      rejoining: 'Перезаход на сервер…', muted: 'Звук Roblox выключен', unmuted: 'Звук Roblox включён'
    },
    en: {
      favorites: 'Favorites', quick: 'Quick launch', open: 'Open Vortex', quit: 'Quit',
      launch: 'Launch', launchHint: 'Click to launch',
      emptyFavorites: 'Add games to your favorites to launch them here.',
      emptyQuick: 'Add games from Quick launch in the app.',
      justNow: 'just now', minutes: 'm ago', hours: 'h ago', days: 'd ago',
      launching: 'Launching…', playing: 'Playing', collapse: 'Collapse section', expand: 'Expand section',
      sessionInvite: 'Copy invite link', sessionHop: 'Switch server (Hop)',
      sessionRejoin: 'Rejoin server', sessionMute: 'Mute / unmute Roblox audio',
      inviteCopied: 'Invite link copied', hopping: 'Switching server…',
      rejoining: 'Rejoining server…', muted: 'Roblox audio muted', unmuted: 'Roblox audio unmuted'
    }
  };
  const cssTokens = ['--bg', '--surface', '--surface-2', '--surface-3', '--line', '--line-strong', '--text', '--muted', '--subtle', '--accent', '--accent-rgb', '--accent-secondary', '--accent-secondary-rgb', '--accent-fill', '--accent-wash', '--accent-text', '--accent-contrast', '--accent-border', '--radius-card', '--font-ui'];
  const state = { favorites: [], quickLaunch: [], style: {}, language: 'ru', collapsed: {} };
  try { state.collapsed = JSON.parse(localStorage.getItem('vortex.trayCollapsed') || '{}') || {}; } catch { state.collapsed = {}; }
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
    document.body.classList.toggle('no-motion', style.motion === false);
    window.vortexOverlays.enableTooltips(style.tooltips !== false);
    root.style.setProperty('--speed', String(({ slow: 1.6, fast: .55 })[style.animationSpeed] || 1));
    root.style.colorScheme = style.theme === 'light' || style.lightTheme ? 'light' : 'dark';
    document.body.classList.toggle('tray-sharp', style.corners === 'sharp');
    document.documentElement.lang = state.language;
    document.querySelectorAll('[data-copy]').forEach((node) => {
      const key = node.dataset.copy;
      node.textContent = strings()[key] || node.textContent;
    });
    applyCollapsed();
    $('[data-tray-action="quit"]')?.setAttribute('aria-label', state.language === 'en' ? 'Quit Vortex completely' : 'Закрыть Vortex полностью');
    const sessionLabels = {
      'session-invite': strings().sessionInvite,
      'session-hop': strings().sessionHop,
      'session-rejoin': strings().sessionRejoin,
      'session-mute': strings().sessionMute
    };
    document.querySelectorAll('[data-tray-session]').forEach((btn) => {
      const label = sessionLabels[btn.dataset.traySession] || '';
      btn.dataset.tooltip = label;
      btn.setAttribute('aria-label', label);
    });
  }

  const gamepadIcon = icon('gamepad', 16);
  const playIcon = `<span class="tray-play" aria-hidden="true">${icon('play', 13)}</span>`;

  function gameRow(game, kind, index) {
    const title = escapeHtml(game.title || game.id || 'Roblox');
    const thumbnail = /^https:\/\/[a-z0-9.-]+\.rbxcdn\.com\//i.test(String(game.thumbnail || ''))
      ? `<img src="${escapeHtml(game.thumbnail)}" alt="" />`
      : gamepadIcon;
    return `<button class="tray-game" type="button" data-tray-launch="${kind}" data-index="${index}" data-tooltip="${escapeHtml(strings().launch)}: ${title}">
      <span class="tray-game-art">${thumbnail}</span><span class="tray-game-copy"><strong>${title}</strong><small>${escapeHtml(timeAgo(game.lastPlayed))}</small></span>${playIcon}
    </button>`;
  }

  function emptyRow(text, glyph) {
    return `<div class="tray-empty">${icon(glyph, 15)}<span>${escapeHtml(text)}</span></div>`;
  }

  function render(data = {}) {
    state.favorites = Array.isArray(data.favorites) ? data.favorites : [];
    state.quickLaunch = Array.isArray(data.quickLaunch) ? data.quickLaunch : [];
    $('#tray-favorites').innerHTML = state.favorites.length
      ? state.favorites.map((game, index) => gameRow(game, 'favorite', index)).join('')
      : emptyRow(strings().emptyFavorites, 'star');
    $('#tray-quick-launch').innerHTML = state.quickLaunch.length
      ? state.quickLaunch.map((game, index) => gameRow(game, 'quick', index)).join('')
      : emptyRow(strings().emptyQuick, 'rocket');
    const favoriteLimit = Number(state.style.trayFavoriteLimit) === 0
      ? null
      : Number(state.style.trayFavoriteLimit) || 5;
    const quickLimit = Number(state.style.trayQuickLimit) === 0
      ? null
      : Number(state.style.trayQuickLimit) || 3;
    $('[data-favorite-count]').textContent = `${state.favorites.length}${favoriteLimit === null ? ' / ∞' : ` / ${favoriteLimit}`}`;
    $('[data-quick-count]').textContent = `${state.quickLaunch.length}${quickLimit === null ? ' / ∞' : ` / ${quickLimit}`}`;
    applyCollapsed();
    renderNowPlaying(data.nowPlaying);
    fitContent();
  }

  function applyCollapsed(changedKey) {
    document.querySelectorAll('[data-tray-collapse]').forEach((button) => {
      const key = button.dataset.trayCollapse;
      const collapsed = state.collapsed[key] === true;
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute('aria-label', collapsed ? strings().expand : strings().collapse);
      button.classList.toggle('is-collapsed', collapsed);
      const section = button.closest('.tray-section');
      const list = section?.querySelector('.tray-list');
      if (!list) return;
      if (key === changedKey) {
        const effect = window.vortexMotion.disclose(list, !collapsed);
        if (effect && collapsed) {
          effect.finished.then(() => { if (state.collapsed[key]) syncCollapsed(); }, () => {});
        } else syncCollapsed();
      } else if (!list.getAnimations().length) {
        list.hidden = collapsed;
        list.inert = collapsed;
      }
    });
  }

  function fitContent() {
    window.requestAnimationFrame(() => {
      const shell = document.querySelector('.tray-shell');
      const height = Math.ceil((shell?.getBoundingClientRect().height || 0) + 12);
      if (height < 60 || Math.abs(window.innerHeight - height) < 2) return;
      void Promise.resolve(invoke('tray_fit_content', { height })).catch(() => {});
    });
  }

  function syncCollapsed() {
    void Promise.resolve(invoke('tray_set_collapsed', {
      favorites: state.collapsed.favorites === true,
      quick: state.collapsed.quick === true
    })).catch(() => {});
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
    const sessionBtn = target.closest('[data-tray-session]');
    if (sessionBtn) {
      const kind = sessionBtn.dataset.traySession;
      try {
        if (kind === 'session-mute') {
          const muted = await invoke('roblox_toggle_mute', { muted: null });
          sessionBtn.classList.toggle('is-muted', Boolean(muted));
          showToast(muted ? strings().muted : strings().unmuted);
          return;
        }
        await invoke('tray_launch_game', { kind, id: '' });
        if (kind === 'session-invite') {
          showToast(strings().inviteCopied);
        } else if (kind === 'session-hop') {
          showToast(strings().hopping);
          window.setTimeout(() => void invoke('tray_dismiss'), 420);
        } else if (kind === 'session-rejoin') {
          showToast(strings().rejoining);
          window.setTimeout(() => void invoke('tray_dismiss'), 420);
        }
      } catch {
        showToast(state.language === 'en' ? 'Action unavailable' : 'Действие недоступно');
      }
      return;
    }
    const collapse = target.closest('[data-tray-collapse]');
    if (collapse) {
      const key = collapse.dataset.trayCollapse;
      state.collapsed[key] = state.collapsed[key] !== true;
      try { localStorage.setItem('vortex.trayCollapsed', JSON.stringify(state.collapsed)); } catch { /* ignore */ }
      applyCollapsed(key);
      return;
    }
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
  if (window.ResizeObserver) {
    const shell = document.querySelector('.tray-shell');
    if (shell) new ResizeObserver(() => fitContent()).observe(shell);
  }
  mountIcons();
  syncCollapsed();
  void refresh();
})();
