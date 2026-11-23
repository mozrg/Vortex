const overlayCorners = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
  'custom'
];

const serverHopModes = ['low-ping', 'low-players', 'region'];
const serverHopRegions = ['any', 'eu', 'us-east', 'us-west', 'asia', 'sa', 'au'];

const overlayLabels = [
  ['settings.tab.in-game', 'В игре', 'In game'],
  ['settings.tab.hotkeys', 'Хоткеи', 'Hotkeys'],
  ['overlay.title', 'Оверлей Roblox «В игре»', 'In-game Roblox overlay'],
  ['overlay.description', 'Показывает выбранные метрики поверх активного окна Roblox. Клики проходят сквозь оверлей прямо в игру.', 'Shows selected metrics over the active Roblox window. Clicks pass through to the game.'],
  ['overlay.enabled', 'Показывать оверлей в игре', 'Show in-game overlay'],
  ['overlay.toggleHotkey', 'Хоткей включения / выключения оверлея', 'Overlay toggle hotkey'],
  ['overlay.toggleHotkeyHint', 'Позволяет быстро скрыть или показать HUD прямо во время игры.', 'Quickly hide or show the HUD while in game.'],
  ['overlay.corner', 'Расположение на экране', 'Screen position'],
  ['overlay.top-left', 'Сверху слева', 'Top left'],
  ['overlay.top-center', 'Сверху по центру', 'Top center'],
  ['overlay.top-right', 'Сверху справа', 'Top right'],
  ['overlay.bottom-left', 'Снизу слева', 'Bottom left'],
  ['overlay.bottom-center', 'Снизу по центру', 'Bottom center'],
  ['overlay.bottom-right', 'Снизу справа', 'Bottom right'],
  ['overlay.custom', 'Своё место', 'Custom position'],
  ['overlay.customX', 'Позиция по горизонтали (X)', 'Horizontal position (X)'],
  ['overlay.customY', 'Позиция по вертикали (Y)', 'Vertical position (Y)'],
  ['overlay.customDragHint', 'Кликните или перетащите полоску HUD на макете предпросмотра, чтобы выбрать точку.', 'Click or drag the HUD bar on the preview frame to place it anywhere.'],
  ['overlay.appearanceTitle', 'Размер и внешний вид HUD', 'HUD size & appearance'],
  ['overlay.scale', 'Размер HUD', 'HUD size'],
  ['overlay.scaleHint', 'Масштаб шрифта и плашки оверлея (70% – 150%).', 'Scale of the overlay bar and text (70% – 150%).'],
  ['overlay.gap', 'Расстояние между данными', 'Spacing between metrics'],
  ['overlay.gapHint', 'Отступы между блоками показателей внутри полоски (0 – 24 px).', 'Padding between metric blocks inside the bar (0 – 24 px).'],
  ['overlay.opacity', 'Непрозрачность фона', 'Background opacity'],
  ['overlay.opacityHint', 'Прозрачность подложки HUD поверх игры (20% – 100%).', 'Opacity of the HUD background over the game (20% – 100%).'],
  ['overlay.metricsTitle', 'Отображаемые данные', 'Displayed metrics'],
  ['overlay.timer', 'Таймер сессии', 'Session timer'],
  ['overlay.fps', 'Частота кадров (FPS)', 'Frame rate (FPS)'],
  ['overlay.ping', 'Пинг до сервера', 'Server ping'],
  ['overlay.pingHint', 'Реальная задержка до игрового сервера Roblox.', 'Real round-trip latency to the Roblox game server.'],
  ['overlay.stability', 'Индикатор стабильности соединения (Jitter / мини-график)', 'Connection stability indicator (Jitter / mini-graph)'],
  ['overlay.stabilityHint', 'Показывает разброс задержки (±ms) и мини-линию пинга прямо в полоске, чтобы сразу отличать сетевые лаги от фризов самой игры.', 'Shows latency variance (±ms) and a ping sparkline right in the bar to distinguish network lag from game freezes.'],
  ['overlay.region', 'Регион сервера и детектор плохого пинга', 'Server region & bad-server detector'],
  ['overlay.regionHint', 'Определяет дата-центр сервера (AMS, FRA, LON, NYC и др.). Если сервер плохой по пингу, оверлей покажет предупреждение.', 'Detects the server datacenter (AMS, FRA, LON, NYC, etc.). Shows a warning indicator if the server ping is poor.'],
  ['overlay.clock', 'Текущее время', 'Current time'],
  ['overlay.clockHint', 'Показывает системные часы (ЧЧ:ММ) в полоске оверлея.', 'Displays system clock (HH:MM) in the overlay bar.'],
  ['overlay.friends', 'Друзья онлайн', 'Friends online'],
  ['overlay.friendsHint', 'Использует онлайн-статусы из раздела «Друзья».', 'Uses the live statuses from Friends.'],
  ['overlay.fpsIdle', 'Замер начнётся при входе в игру.', 'Frame capture starts when you join a game.'],
  ['overlay.fpsCollecting', 'Ожидаем кадры Roblox…', 'Waiting for Roblox frames…'],
  ['overlay.fpsUnavailable', 'Не удалось измерить частоту кадров окна игры.', 'Could not measure the game window frame rate.'],
  ['overlay.fpsMeasured', 'Замер FPS работает.', 'FPS capture is running.'],
  ['overlay.preview', 'Предпросмотр (можно перетаскивать HUD мышью)', 'Preview (drag the HUD with your mouse)'],
  ['overlay.previewRegionLabel', 'Регион', 'Region'],
  ['overlay.previewTimeLabel', 'Время', 'Time'],
  ['overlay.toastEnabled', 'Оверлей «В игре» включён', 'In-game overlay enabled'],
  ['overlay.toastDisabled', 'Оверлей «В игре» выключен', 'In-game overlay disabled'],

  ['hotkeys.gameTitle', 'Игровые хоткеи (Roblox и оверлей)', 'In-game hotkeys (Roblox & overlay)'],
  ['hotkeys.gameBody', 'Работают прямо во время игры в Roblox и внутри лаунчера Vortex.', 'Work both right inside Roblox while playing and inside Vortex Launcher.'],
  ['hotkeys.unassigned', 'Не назначен', 'Unassigned'],
  ['hotkeys.assign', 'Назначить', 'Assign'],
  ['hotkeys.change', 'Изменить', 'Rebind'],
  ['hotkeys.clear', 'Сбросить хоткей', 'Clear hotkey'],
  ['hotkeys.pressKeys', 'Нажмите клавиши…', 'Press keys…'],
  ['hotkeys.saved', 'Назначен хоткей: {hotkey}', 'Hotkey assigned: {hotkey}'],
  ['hotkeys.cleared', 'Хоткей отключён', 'Hotkey cleared'],

  ['hotkeys.invite.title', 'Скопировать инвайт-ссылку на ваш сервер', 'Copy invite link to your current server'],
  ['hotkeys.invite.body', 'Мгновенно копирует прямую ссылку для подключения к вашему текущему серверу Roblox.', 'Instantly copies a direct join link to your active Roblox server.'],
  ['hotkeys.invite.action', 'Скопировать ссылку', 'Copy link'],

  ['hotkeys.overlay.title', 'Включить / выключить оверлей «В игре»', 'Toggle in-game overlay on / off'],
  ['hotkeys.overlay.body', 'Скрывает или показывает полоску HUD поверх окна Roblox.', 'Hides or shows the HUD bar over the Roblox window.'],

  ['hotkeys.mute.title', 'Выключить / включить звук Roblox', 'Mute / unmute Roblox audio'],
  ['hotkeys.mute.body', 'Отключает звук только у процесса Roblox через Windows Audio Mixer, не затрагивая другие программы.', 'Mutes only the Roblox process via Windows Audio Mixer without affecting other apps.'],
  ['hotkeys.mute.action', 'Переключить звук сейчас', 'Toggle mute now'],
  ['hotkeys.mute.toastMuted', 'Звук Roblox выключен', 'Roblox audio muted'],
  ['hotkeys.mute.toastUnmuted', 'Звук Roblox включён', 'Roblox audio unmuted'],
  ['hotkeys.mute.toastNotRunning', 'Запущенный процесс Roblox со звуком не найден', 'No active Roblox audio session found'],

  ['hotkeys.serverHop.title', 'Быстро поменять сервер плейса (Server Hop)', 'Quickly switch place server (Server Hop)'],
  ['hotkeys.serverHop.body', 'Подбирает другой сервер текущего плейса по выбранным критериям и сразу переподключает вас.', 'Finds another server for your current place using your preferences and reconnects you immediately.'],
  ['hotkeys.serverHop.action', 'Сменить сервер сейчас', 'Switch server now'],
  ['hotkeys.serverHop.modeLabel', 'Режим выбора нового сервера', 'Server selection mode'],
  ['hotkeys.serverHop.modeHint', 'По какому критерию подбирать сервер при нажатии хоткея.', 'How Vortex chooses the target server when you press the hotkey.'],
  ['hotkeys.serverHop.mode.low-ping', 'С низким пингом', 'Lowest ping'],
  ['hotkeys.serverHop.mode.low-players', 'С низким кол-вом игроков', 'Lowest player count'],
  ['hotkeys.serverHop.mode.region', 'По выбранному региону', 'By target region'],
  ['hotkeys.serverHop.regionLabel', 'Целевой регион сервера', 'Target server region'],
  ['hotkeys.serverHop.regionHint', 'Выберите регион, к которому должен относиться новый сервер.', 'Choose the preferred geographic region for the new server.'],
  ['hotkeys.serverHop.region.any', 'Авто (лучший по пингу)', 'Auto (best ping)'],
  ['hotkeys.serverHop.region.eu', 'Европа (EU · FRA / AMS / LON / WAR)', 'Europe (EU · FRA / AMS / LON / WAR)'],
  ['hotkeys.serverHop.region.us-east', 'США Восток (US-E · NYC / IAD / MIA)', 'US East (US-E · NYC / IAD / MIA)'],
  ['hotkeys.serverHop.region.us-west', 'США Запад (US-W · LAX / SJC / SEA)', 'US West (US-W · LAX / SJC / SEA)'],
  ['hotkeys.serverHop.region.asia', 'Азия (ASIA · SIN / TYO / HKG)', 'Asia (ASIA · SIN / TYO / HKG)'],
  ['hotkeys.serverHop.region.sa', 'Южная Америка (SA · GRU)', 'South America (SA · GRU)'],
  ['hotkeys.serverHop.region.au', 'Австралия (AU · SYD)', 'Australia (AU · SYD)'],
  ['hotkeys.serverHop.searching', 'Подбираем подходящий сервер…', 'Finding a suitable server…'],
  ['hotkeys.serverHop.connecting', 'Переключаемся на новый сервер ({detail})…', 'Switching to new server ({detail})…'],
  ['hotkeys.serverHop.fallback', 'Переподключаемся к новому серверу плейса…', 'Reconnecting to a new server…'],

  ['hotkeys.rejoin.title', 'Перезайти на тот же сервер (Rejoin)', 'Rejoin the same server'],
  ['hotkeys.rejoin.body', 'Перезаходит на ваш текущий сервер или на последний сервер, с которого вы уже вышли.', 'Rejoins your current server or the last server you exited from.'],
  ['hotkeys.rejoin.action', 'Перезайти на сервер', 'Rejoin server'],
  ['hotkeys.rejoin.connecting', 'Перезаходим на тот же сервер…', 'Rejoining the same server…'],
  ['hotkeys.rejoin.noServer', 'Нет активного или последнего сервера для перезахода.', 'No active or recent server available to rejoin.']
];

for (const [key, ru, en] of overlayLabels) {
  translations.ru[key] = ru;
  translations.en[key] = en;
}

let gameOverlaySession = null;
let gameOverlayFpsState = 'idle';
let gameOverlayReport = '';
let rebindingOverlayPrefKey = '';
let serverHopBusy = false;
let rejoinBusy = false;

function formatActionHotkey(spec, fallback = '') {
  const clean = String(spec ?? fallback).trim();
  if (!clean) return t('hotkeys.unassigned');
  return clean.split('+').map(part => part.trim()).filter(Boolean).join(' + ');
}

function clampOverlayNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function reportGameOverlay() {
  const configure = window.vortexDesktop?.configureGameOverlay;
  if (!configure) return;
  const fps = Boolean(preferences.gameOverlayFps);
  const ping = Boolean(preferences.gameOverlayPing);
  const stability = Boolean(preferences.gameOverlayStability);
  const region = Boolean(preferences.gameOverlayRegion);
  const clock = Boolean(preferences.gameOverlayClock);
  const friends = Boolean(preferences.gameOverlayFriends);
  const corner = overlayCorners.includes(preferences.gameOverlayCorner) ? preferences.gameOverlayCorner : 'top-right';
  const config = {
    enabled: Boolean(preferences.gameOverlay),
    corner,
    customX: clampOverlayNumber(preferences.gameOverlayCustomX, 0, 100, 96),
    customY: clampOverlayNumber(preferences.gameOverlayCustomY, 0, 100, 4),
    scale: clampOverlayNumber(preferences.gameOverlayScale, 70, 150, 100),
    gap: clampOverlayNumber(preferences.gameOverlayGap, 0, 24, 5),
    opacity: clampOverlayNumber(preferences.gameOverlayOpacity, 20, 100, 74),
    timer: Boolean(preferences.gameOverlayTimer),
    fps,
    ping,
    stability,
    region,
    clock,
    friends,
    friendCount: overlayFriendsCount(),
    language: preferences.language,
    accent: preferences.accent,
    motion: Boolean(preferences.motion),
    inviteHotkey: String(preferences.inviteHotkey ?? 'Alt+C').trim(),
    toggleHotkey: String(preferences.overlayToggleHotkey || '').trim(),
    muteHotkey: String(preferences.muteRobloxHotkey || '').trim(),
    serverHopHotkey: String(preferences.serverHopHotkey || '').trim(),
    rejoinHotkey: String(preferences.rejoinHotkey || '').trim(),
    session: gameOverlaySession
  };
  const serialized = JSON.stringify(config);
  if (serialized === gameOverlayReport) return;
  gameOverlayReport = serialized;
  configure(config).catch(() => {
    if (gameOverlayReport === serialized) gameOverlayReport = '';
  });
}

function overlayFriendsCount() {
  const username = String(preferences.robloxUsername || '').trim();
  const data = friendsCache.data;
  const list = data?.friends;
  if (!username || friendsCache.username !== username || !data?.ok || !Array.isArray(list)
    || Date.now() - friendsCache.at > FRIENDS_TTL * 2) return null;
  if (!list.length) return 0;
  return data.livePresence ? list.filter(friend => ['playing', 'online'].includes(friend.presence)).length : null;
}

function updateGameOverlaySession(data, id, startedAt) {
  const ip = typeof data?.serverIp === 'string' && /^\d{1,3}(\.\d{1,3}){3}$/.test(data.serverIp) ? data.serverIp : null;
  const port = Number.isInteger(data?.serverPort) && data.serverPort > 0 && data.serverPort <= 65535 ? data.serverPort : null;
  const serverId = typeof data?.serverId === 'string' && /^[0-9a-f-]{36}$/i.test(data.serverId) ? data.serverId : null;
  gameOverlaySession = id && Number.isInteger(data?.pid) && startedAt
    ? { pid: data.pid, startedAt, placeId: id, serverId, serverIp: ip, serverPort: port }
    : null;
  if (id && serverId && typeof rememberLastActiveServerSession === 'function') {
    rememberLastActiveServerSession(id, serverId, startedAt);
  }
  reportGameOverlay();
  const username = String(preferences.robloxUsername || '').trim();
  if (gameOverlaySession && preferences.gameOverlay && preferences.gameOverlayFriends && username) void loadFriends(username);
}

function overlayFpsMessage() {
  const state = typeof gameOverlayFpsState === 'string' ? gameOverlayFpsState : 'measured';
  const key = 'overlay.fps' + state[0].toUpperCase() + state.slice(1);
  return t(key);
}

function setGameOverlayFpsState(value) {
  gameOverlayFpsState = value;
  const status = document.querySelector('[data-game-overlay-fps-state]');
  if (status) status.textContent = overlayFpsMessage();
}

function renderActionHotkeyControl(prefKey, fallback = '') {
  const recording = rebindingOverlayPrefKey === prefKey;
  const current = String(preferences[prefKey] ?? fallback).trim();
  const text = recording ? t('hotkeys.pressKeys') : formatActionHotkey(current, '');
  const buttonLabel = recording ? t('common.cancel') : (current ? t('hotkeys.change') : t('hotkeys.assign'));
  return `<div class="action-hotkey-controls">
    <button type="button" class="control-button activity-hotkey-trigger ${recording ? 'is-recording' : ''} ${current ? 'has-hotkey' : 'is-unassigned'}"
      data-overlay-action="rebind-hotkey" data-hotkey-pref="${escapeHtml(prefKey)}" aria-pressed="${recording}">
      <kbd>${escapeHtml(text)}</kbd>
      <span>${escapeHtml(buttonLabel)}</span>
    </button>
    ${current && !recording ? `<button type="button" class="icon-button action-hotkey-clear" data-overlay-action="clear-hotkey" data-hotkey-pref="${escapeHtml(prefKey)}" data-tooltip="${escapeHtml(t('hotkeys.clear'))}" aria-label="${escapeHtml(t('hotkeys.clear'))}">${icon('close', 13)}</button>` : ''}
  </div>`;
}

function overlayPreviewStyle() {
  const corner = overlayCorners.includes(preferences.gameOverlayCorner) ? preferences.gameOverlayCorner : 'top-right';
  const scale = clampOverlayNumber(preferences.gameOverlayScale, 70, 150, 100) / 100;
  const gap = clampOverlayNumber(preferences.gameOverlayGap, 0, 24, 5);
  const opacity = clampOverlayNumber(preferences.gameOverlayOpacity, 20, 100, 74) / 100;
  const customX = clampOverlayNumber(preferences.gameOverlayCustomX, 0, 100, 96);
  const customY = clampOverlayNumber(preferences.gameOverlayCustomY, 0, 100, 4);
  const vars = [
    `--preview-hud-scale:${scale.toFixed(2)}`,
    `--preview-hud-gap:${gap}px`,
    `--preview-hud-opacity:${opacity.toFixed(2)}`
  ];
  if (corner === 'custom') {
    vars.push(`--preview-custom-x:${customX}%`, `--preview-custom-y:${customY}%`);
  }
  return vars.join(';');
}

function renderOverlayPreviewMetrics() {
  const now = new Date();
  const timeStr = [now.getHours(), now.getMinutes()].map(v => String(v).padStart(2, '0')).join(':');
  const items = [];
  if (preferences.gameOverlayTimer) items.push(`<span><strong>00:24:18</strong><small>${t(' library.session') !== ' library.session' ? (preferences.language === 'en' ? 'Session' : 'Сессия') : 'Сессия'}</small></span>`);
  if (preferences.gameOverlayFps) items.push(`<span><strong>120</strong><small>FPS</small></span>`);
  if (preferences.gameOverlayPing) items.push(`<span><strong>42</strong><small>ms</small></span>`);
  if (preferences.gameOverlayStability) {
    items.push(`<span class="preview-metric-stability"><strong>±2 ms</strong><svg viewBox="0 0 34 12" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="1,7 7,6 13,8 19,5 25,7 33,6"/></svg></span>`);
  }
  if (preferences.gameOverlayRegion) items.push(`<span><strong>AMS</strong><small>${t('overlay.previewRegionLabel')}</small></span>`);
  if (preferences.gameOverlayClock) items.push(`<span><strong>${timeStr}</strong><small>${t('overlay.previewTimeLabel')}</small></span>`);
  if (preferences.gameOverlayFriends) items.push(`<span><strong>4</strong><small>${t('overlay.friends')}</small></span>`);
  return items.join('');
}

function renderGameOverlaySettings() {
  const toggle = (key, label, hint = '') => {
    const text = t(label);
    return `<div class="setting-line"><div class="setting-label"><strong>${text}</strong>${hint ? `<small>${hint}</small>` : ''}</div>
      <button class="toggle" type="button" role="switch" aria-checked="${Boolean(preferences[key])}" data-toggle="${key}" aria-label="${text}"></button></div>`;
  };
  const corner = overlayCorners.includes(preferences.gameOverlayCorner) ? preferences.gameOverlayCorner : 'top-right';
  const scale = clampOverlayNumber(preferences.gameOverlayScale, 70, 150, 100);
  const gap = clampOverlayNumber(preferences.gameOverlayGap, 0, 24, 5);
  const opacity = clampOverlayNumber(preferences.gameOverlayOpacity, 20, 100, 74);
  const customX = clampOverlayNumber(preferences.gameOverlayCustomX, 0, 100, 96);
  const customY = clampOverlayNumber(preferences.gameOverlayCustomY, 0, 100, 4);
  const preview = renderOverlayPreviewMetrics();

  return `<section class="settings-card game-overlay-settings">
    <div class="settings-card-head"><div><h2>${t('overlay.title')}</h2><p>${t('overlay.description')}</p></div>${icon('monitor', 18)}</div>
    ${toggle('gameOverlay', 'overlay.enabled')}
    <div class="setting-line">
      <div class="setting-label"><strong>${t('overlay.toggleHotkey')}</strong><small>${t('overlay.toggleHotkeyHint')}</small></div>
      ${renderActionHotkeyControl('overlayToggleHotkey')}
    </div>
    <div class="game-overlay-options">
      <div class="game-overlay-controls-col">
        <div class="setting-line game-overlay-corner">
          <div class="setting-label"><strong>${t('overlay.corner')}</strong><small>${t('overlay.customDragHint')}</small></div>
          <div class="overlay-corner-picker" role="group" aria-label="${t('overlay.corner')}">
            ${overlayCorners.map(value => `<button type="button" class="control-button ${value === corner ? 'is-selected' : ''}" data-pref="gameOverlayCorner" data-value="${value}" aria-pressed="${value === corner}"><span class="overlay-corner-glyph" data-corner="${value}" aria-hidden="true"></span>${t('overlay.' + value)}</button>`).join('')}
          </div>
        </div>
        ${corner === 'custom' ? `<div class="overlay-custom-coords">
          <div class="setting-line">
            <div class="setting-label"><strong>${t('overlay.customX')}</strong></div>
            <label class="range-control"><input type="range" min="0" max="100" step="1" value="${customX}" data-overlay-range="gameOverlayCustomX" /><span class="range-value" data-overlay-range-value="gameOverlayCustomX">${customX}%</span></label>
          </div>
          <div class="setting-line">
            <div class="setting-label"><strong>${t('overlay.customY')}</strong></div>
            <label class="range-control"><input type="range" min="0" max="100" step="1" value="${customY}" data-overlay-range="gameOverlayCustomY" /><span class="range-value" data-overlay-range-value="gameOverlayCustomY">${customY}%</span></label>
          </div>
        </div>` : ''}

        <p class="ui-section-title">${t('overlay.appearanceTitle')}</p>
        <div class="setting-line">
          <div class="setting-label"><strong>${t('overlay.scale')}</strong><small>${t('overlay.scaleHint')}</small></div>
          <label class="range-control"><input type="range" min="70" max="150" step="5" value="${scale}" data-overlay-range="gameOverlayScale" /><span class="range-value" data-overlay-range-value="gameOverlayScale">${scale}%</span></label>
        </div>
        <div class="setting-line">
          <div class="setting-label"><strong>${t('overlay.gap')}</strong><small>${t('overlay.gapHint')}</small></div>
          <label class="range-control"><input type="range" min="0" max="24" step="1" value="${gap}" data-overlay-range="gameOverlayGap" /><span class="range-value" data-overlay-range-value="gameOverlayGap">${gap} px</span></label>
        </div>
        <div class="setting-line">
          <div class="setting-label"><strong>${t('overlay.opacity')}</strong><small>${t('overlay.opacityHint')}</small></div>
          <label class="range-control"><input type="range" min="20" max="100" step="5" value="${opacity}" data-overlay-range="gameOverlayOpacity" /><span class="range-value" data-overlay-range-value="gameOverlayOpacity">${opacity}%</span></label>
        </div>

        <p class="ui-section-title">${t('overlay.metricsTitle')}</p>
        ${toggle('gameOverlayTimer', 'overlay.timer')}
        ${toggle('gameOverlayFps', 'overlay.fps', preferences.gameOverlayFps ? `<span data-game-overlay-fps-state role="status">${overlayFpsMessage()}</span>` : '')}
        ${toggle('gameOverlayPing', 'overlay.ping', t('overlay.pingHint'))}
        ${toggle('gameOverlayStability', 'overlay.stability', t('overlay.stabilityHint'))}
        ${toggle('gameOverlayRegion', 'overlay.region', t('overlay.regionHint'))}
        ${toggle('gameOverlayClock', 'overlay.clock', t('overlay.clockHint'))}
        ${toggle('gameOverlayFriends', 'overlay.friends', t('overlay.friendsHint'))}
      </div>
      <div class="game-overlay-preview">
        <span>${t('overlay.preview')}</span>
        <div class="game-overlay-preview-frame" data-overlay-preview-frame data-corner="${corner}" style="${overlayPreviewStyle()}">
          <img src="./assets/vortex-logo.svg" alt="" draggable="false" />
          ${preview ? `<div class="game-overlay-preview-metrics" data-overlay-preview-bar aria-hidden="true">${preview}</div>` : ''}
        </div>
      </div>
    </div>
  </section>`;
}

function renderHotkeySettings() {
  const hopMode = serverHopModes.includes(preferences.serverHopMode) ? preferences.serverHopMode : 'low-ping';
  const hopRegion = serverHopRegions.includes(preferences.serverHopRegion) ? preferences.serverHopRegion : 'any';

  return `<section class="settings-card hotkeys-settings-card">
    <div class="settings-card-head">
      <div><h2>${t('hotkeys.gameTitle')}</h2><p>${t('hotkeys.gameBody')}</p></div>
      ${icon('gamepad', 18)}
    </div>

    <div class="setting-line hotkey-feature-row">
      <div class="setting-label">
        <strong>${t('hotkeys.mute.title')}</strong>
        <small>${t('hotkeys.mute.body')}</small>
      </div>
      <div class="hotkey-feature-actions">
        ${renderActionHotkeyControl('muteRobloxHotkey')}
        <button type="button" class="control-button" data-overlay-action="mute-roblox-now">${icon('bell', 14)} ${t('hotkeys.mute.action')}</button>
      </div>
    </div>

    <div class="hotkey-feature-group">
      <div class="setting-line hotkey-feature-row">
        <div class="setting-label">
          <strong>${t('hotkeys.serverHop.title')}</strong>
          <small>${t('hotkeys.serverHop.body')}</small>
        </div>
        <div class="hotkey-feature-actions">
          ${renderActionHotkeyControl('serverHopHotkey')}
          <button type="button" class="control-button" data-overlay-action="server-hop-now">${icon('refreshCw', 14)} ${t('hotkeys.serverHop.action')}</button>
        </div>
      </div>
      <div class="hotkey-subsettings">
        <div class="setting-line">
          <div class="setting-label">
            <strong>${t('hotkeys.serverHop.modeLabel')}</strong>
            <small>${t('hotkeys.serverHop.modeHint')}</small>
          </div>
          <div class="segmented server-hop-mode-segmented">
            ${serverHopModes.map(mode => `<button type="button" class="segment ${hopMode === mode ? 'active' : ''}" data-pref="serverHopMode" data-value="${mode}">${t('hotkeys.serverHop.mode.' + mode)}</button>`).join('')}
          </div>
        </div>
        <div class="setting-line">
          <div class="setting-label">
            <strong>${t('hotkeys.serverHop.regionLabel')}</strong>
            <small>${t('hotkeys.serverHop.regionHint')}</small>
          </div>
          <div class="overlay-region-picker" role="group" aria-label="${t('hotkeys.serverHop.regionLabel')}">
            ${serverHopRegions.map(reg => `<button type="button" class="control-button ${hopRegion === reg ? 'is-selected' : ''}" data-pref="serverHopRegion" data-value="${reg}" aria-pressed="${hopRegion === reg}">${t('hotkeys.serverHop.region.' + reg)}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="setting-line hotkey-feature-row">
      <div class="setting-label">
        <strong>${t('hotkeys.rejoin.title')}</strong>
        <small>${t('hotkeys.rejoin.body')}</small>
      </div>
      <div class="hotkey-feature-actions">
        ${renderActionHotkeyControl('rejoinHotkey')}
        <button type="button" class="control-button" data-overlay-action="rejoin-server-now">${icon('rotate', 14)} ${t('hotkeys.rejoin.action')}</button>
      </div>
    </div>

    <div class="setting-line hotkey-feature-row">
      <div class="setting-label">
        <strong>${t('hotkeys.invite.title')}</strong>
        <small>${t('hotkeys.invite.body')}</small>
      </div>
      <div class="hotkey-feature-actions">
        ${renderActionHotkeyControl('inviteHotkey', 'Alt+C')}
        <button type="button" class="control-button" data-overlay-action="copy-invite-now">${icon('link', 14)} ${t('hotkeys.invite.action')}</button>
      </div>
    </div>

    <div class="setting-line hotkey-feature-row">
      <div class="setting-label">
        <strong>${t('hotkeys.overlay.title')}</strong>
        <small>${t('hotkeys.overlay.body')}</small>
      </div>
      <div class="hotkey-feature-actions">
        ${renderActionHotkeyControl('overlayToggleHotkey')}
        <button class="toggle" type="button" role="switch" aria-checked="${Boolean(preferences.gameOverlay)}" data-toggle="gameOverlay" aria-label="${t('hotkeys.overlay.title')}"></button>
      </div>
    </div>
  </section>

  <section class="settings-card">
    <div class="settings-card-head"><div><h2>${t('settings.hotkeys.title')}</h2><p>${t('settings.hotkeys.body')}</p></div>${icon('keyboard', 18)}</div>
    <div class="hotkey-list">${HOTKEY_ACTIONS.map((action) => `<div class="hotkey-row"><span id="hotkey-label-${action.id}">${t(action.label)}</span><button class="hotkey-recorder" id="hotkey-key-${action.id}" data-record-hotkey="${action.id}" aria-labelledby="hotkey-label-${action.id} hotkey-key-${action.id}">${formatHotkey(hotkeyCombo(action.id))}</button></div>`).join('')}</div>
    <div class="settings-action-line"><p class="catalog-disclaimer">${t('settings.hotkeys.hint')}</p>
      <button class="control-button control-button-quiet" data-action="reset-hotkeys">${icon('rotate', 14)} ${t('settings.hotkeys.reset')}</button></div>
  </section>`;
}

async function triggerRobloxMuteToggle() {
  if (!window.vortexDesktop?.toggleRobloxMute) return;
  try {
    const res = await window.vortexDesktop.toggleRobloxMute(null);
    if (res && res.sessions > 0) {
      showToast(t(res.muted ? 'hotkeys.mute.toastMuted' : 'hotkeys.mute.toastUnmuted'));
    } else {
      showToast(t('hotkeys.mute.toastNotRunning'));
    }
  } catch {
    showToast(t('hotkeys.mute.toastNotRunning'));
  }
}

function triggerOverlayToggle() {
  preferences.gameOverlay = !preferences.gameOverlay;
  savePreferences();
  reportGameOverlay();
  if (currentView === 'settings' && ['in-game', 'hotkeys'].includes(preferences.settingsTab)) {
    renderPage();
  }
  showToast(t(preferences.gameOverlay ? 'overlay.toastEnabled' : 'overlay.toastDisabled'));
}

function regionPingBand(regionKey) {
  switch (regionKey) {
    case 'eu': return { min: 12, max: 96, ideal: 48, label: 'EU' };
    case 'us-east': return { min: 95, max: 165, ideal: 128, label: 'US-East' };
    case 'us-west': return { min: 165, max: 235, ideal: 192, label: 'US-West' };
    case 'asia': return { min: 175, max: 325, ideal: 235, label: 'Asia' };
    case 'sa': return { min: 195, max: 320, ideal: 250, label: 'SA' };
    case 'au': return { min: 235, max: 390, ideal: 295, label: 'AU' };
    default: return null;
  }
}

async function selectServerHopCandidate(placeId, currentServerId) {
  const mode = serverHopModes.includes(preferences.serverHopMode) ? preferences.serverHopMode : 'low-ping';
  const regionKey = serverHopRegions.includes(preferences.serverHopRegion) ? preferences.serverHopRegion : 'any';
  const band = (mode === 'region' || regionKey !== 'any') ? regionPingBand(regionKey) : null;

  const requests = [];
  if (mode === 'low-players') {
    requests.push(window.vortexDesktop?.getPublicServers?.({ placeId, smallest: true, cursor: '' }).catch(() => null));
  } else {
    requests.push(window.vortexDesktop?.getPublicServers?.({ placeId, smallest: false, cursor: '' }).catch(() => null));
    if (band) {
      requests.push(window.vortexDesktop?.getPublicServers?.({ placeId, smallest: true, cursor: '' }).catch(() => null));
    }
  }

  const payloads = await Promise.all(requests);
  const merged = new Map();
  for (const payload of payloads) {
    for (const row of normalizeBrowserServers(payload?.servers)) {
      if (row.playing < row.capacity && (!currentServerId || row.id.toLowerCase() !== currentServerId.toLowerCase())) {
        merged.set(row.id, row);
      }
    }
  }
  const candidates = [...merged.values()];
  if (!candidates.length) return null;

  if (mode === 'low-players') {
    const inBand = band ? candidates.filter(r => r.ping != null && r.ping >= band.min && r.ping <= band.max) : [];
    const pool = inBand.length ? inBand : candidates;
    pool.sort((a, b) => (a.playing - b.playing) || ((a.ping ?? 999) - (b.ping ?? 999)));
    return pool[0];
  }

  if (mode === 'region' && band) {
    const withPing = candidates.filter(r => r.ping != null);
    const inBand = withPing.filter(r => r.ping >= band.min && r.ping <= band.max);
    if (inBand.length) {
      inBand.sort((a, b) => Math.abs(a.ping - band.ideal) - Math.abs(b.ping - band.ideal) || (a.ping - b.ping));
      return inBand[0];
    }
    if (withPing.length) {
      withPing.sort((a, b) => Math.abs(a.ping - band.ideal) - Math.abs(b.ping - band.ideal));
      return withPing[0];
    }
  }

  // Default: low-ping (respecting region filter if specified)
  const withPing = candidates.filter(r => r.ping != null);
  if (band) {
    const inBand = withPing.filter(r => r.ping >= band.min && r.ping <= band.max);
    if (inBand.length) {
      inBand.sort((a, b) => a.ping - b.ping || a.playing - b.playing);
      return inBand[0];
    }
  }
  if (withPing.length) {
    withPing.sort((a, b) => a.ping - b.ping || a.playing - b.playing);
    return withPing[0];
  }
  candidates.sort((a, b) => a.playing - b.playing);
  return candidates[0];
}

async function triggerServerHop() {
  if (serverHopBusy) return;
  const active = typeof currentPlayingInviteState === 'function' ? currentPlayingInviteState() : null;
  const fallback = !active && typeof getLastExitedSession === 'function' ? getLastExitedSession() : null;
  const targetPlaceId = active?.placeId || fallback?.placeId || '';
  const currentServerId = active?.serverId || '';
  if (!targetPlaceId) {
    showToast(t('activity.nowPlaying.notInGame'));
    return;
  }
  serverHopBusy = true;
  try {
    showToast(t('hotkeys.serverHop.searching'));
    const chosen = await selectServerHopCandidate(targetPlaceId, currentServerId);
    if (active && window.vortexDesktop?.terminateRobloxPlayer) {
      await window.vortexDesktop.terminateRobloxPlayer().catch(() => {});
      await new Promise(resolve => window.setTimeout(resolve, 350));
    }
    if (chosen) {
      const detail = [
        chosen.ping ? `${chosen.ping} ms` : '',
        Number.isInteger(chosen.playing) ? `${chosen.playing}/${chosen.capacity}` : ''
      ].filter(Boolean).join(' · ') || ('#' + chosen.id.slice(0, 8));
      showToast(t('hotkeys.serverHop.connecting', { detail }));
      await openGame(targetPlaceId, chosen.id);
    } else {
      showToast(t('hotkeys.serverHop.fallback'));
      await openGame(targetPlaceId, '');
    }
  } finally {
    serverHopBusy = false;
  }
}

async function triggerServerRejoin(explicitTarget = null) {
  if (rejoinBusy) return;
  const active = typeof currentPlayingInviteState === 'function' ? currentPlayingInviteState() : null;
  const lastExited = typeof getLastExitedSession === 'function' ? getLastExitedSession() : null;
  const target = explicitTarget || active || lastExited;
  if (!target?.placeId) {
    showToast(t('hotkeys.rejoin.noServer'));
    return;
  }
  rejoinBusy = true;
  try {
    if (active && window.vortexDesktop?.terminateRobloxPlayer) {
      await window.vortexDesktop.terminateRobloxPlayer().catch(() => {});
      await new Promise(resolve => window.setTimeout(resolve, 350));
    }
    showToast(t('hotkeys.rejoin.connecting'));
    await openGame(target.placeId, target.serverId || '');
  } finally {
    rejoinBusy = false;
  }
}

// Live slider updates and interactive custom HUD placement on the preview frame.
document.addEventListener('input', event => {
  const slider = event.target?.closest?.('[data-overlay-range]');
  if (!slider) return;
  const key = slider.dataset.overlayRange;
  const limits = {
    gameOverlayScale: [70, 150, 100, '%'],
    gameOverlayGap: [0, 24, 5, ' px'],
    gameOverlayOpacity: [20, 100, 74, '%'],
    gameOverlayCustomX: [0, 100, 96, '%'],
    gameOverlayCustomY: [0, 100, 4, '%']
  }[key];
  if (!limits) return;
  const [min, max, fallback, suffix] = limits;
  const val = clampOverlayNumber(slider.value, min, max, fallback);
  preferences[key] = val;
  const label = document.querySelector(`[data-overlay-range-value="${key}"]`);
  if (label) label.textContent = `${val}${suffix}`;
  const frame = document.querySelector('[data-overlay-preview-frame]');
  if (frame) frame.setAttribute('style', overlayPreviewStyle());
  savePreferences();
  reportGameOverlay();
});

let overlayPreviewDragging = false;
function updateCustomPositionFromPreviewEvent(event, frame) {
  const rect = frame.getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return;
  const bar = frame.querySelector('[data-overlay-preview-bar]');
  const barW = bar ? bar.offsetWidth : 120;
  const barH = bar ? bar.offsetHeight : 24;
  const availW = Math.max(1, rect.width - barW - 16);
  const availH = Math.max(1, rect.height - barH - 16);
  const relX = event.clientX - rect.left - 8 - barW / 2;
  const relY = event.clientY - rect.top - 8 - barH / 2;
  const pctX = clampOverlayNumber((relX / availW) * 100, 0, 100, 50);
  const pctY = clampOverlayNumber((relY / availH) * 100, 0, 100, 50);
  const wasCustom = preferences.gameOverlayCorner === 'custom';
  preferences.gameOverlayCorner = 'custom';
  preferences.gameOverlayCustomX = pctX;
  preferences.gameOverlayCustomY = pctY;
  savePreferences();
  reportGameOverlay();
  if (!wasCustom) {
    renderPage();
    return;
  }
  frame.dataset.corner = 'custom';
  frame.setAttribute('style', overlayPreviewStyle());
  const xInput = document.querySelector('[data-overlay-range="gameOverlayCustomX"]');
  const yInput = document.querySelector('[data-overlay-range="gameOverlayCustomY"]');
  const xVal = document.querySelector('[data-overlay-range-value="gameOverlayCustomX"]');
  const yVal = document.querySelector('[data-overlay-range-value="gameOverlayCustomY"]');
  if (xInput) xInput.value = String(pctX);
  if (yInput) yInput.value = String(pctY);
  if (xVal) xVal.textContent = `${pctX}%`;
  if (yVal) yVal.textContent = `${pctY}%`;
}

document.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  const frame = event.target?.closest?.('[data-overlay-preview-frame]');
  if (!frame) return;
  event.preventDefault();
  overlayPreviewDragging = true;
  try { frame.setPointerCapture(event.pointerId); } catch {}
  updateCustomPositionFromPreviewEvent(event, frame);
});

document.addEventListener('pointermove', event => {
  if (!overlayPreviewDragging) return;
  const frame = document.querySelector('[data-overlay-preview-frame]');
  if (!frame) { overlayPreviewDragging = false; return; }
  updateCustomPositionFromPreviewEvent(event, frame);
});

document.addEventListener('pointerup', () => { overlayPreviewDragging = false; });
document.addEventListener('pointercancel', () => { overlayPreviewDragging = false; });

document.addEventListener('click', event => {
  const button = event.target?.closest?.('[data-overlay-action]');
  if (!button) return;
  const action = button.dataset.overlayAction;
  if (action === 'rebind-hotkey') {
    const pref = button.dataset.hotkeyPref;
    if (!pref) return;
    rebindingOverlayPrefKey = rebindingOverlayPrefKey === pref ? '' : pref;
    renderPage();
    return;
  }
  if (action === 'clear-hotkey') {
    const pref = button.dataset.hotkeyPref;
    if (!pref) return;
    rebindingOverlayPrefKey = '';
    preferences[pref] = '';
    savePreferences();
    reportGameOverlay();
    if (pref === 'inviteHotkey' && typeof updateActivityNowPlayingCard === 'function') updateActivityNowPlayingCard(true);
    renderPage();
    showToast(t('hotkeys.cleared'));
    return;
  }
  if (action === 'mute-roblox-now') {
    void triggerRobloxMuteToggle();
    return;
  }
  if (action === 'server-hop-now') {
    void triggerServerHop();
    return;
  }
  if (action === 'rejoin-server-now') {
    void triggerServerRejoin();
    return;
  }
  if (action === 'copy-invite-now') {
    if (typeof copyActiveServerInviteLink === 'function') void copyActiveServerInviteLink();
  }
});

document.addEventListener('keydown', event => {
  if (rebindingOverlayPrefKey) {
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const pref = rebindingOverlayPrefKey;
    if (event.key === 'Escape' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      rebindingOverlayPrefKey = '';
      renderPage();
      return;
    }
    const spec = typeof hotkeySpecFromEvent === 'function' ? hotkeySpecFromEvent(event) : '';
    if (!spec) return;
    rebindingOverlayPrefKey = '';
    preferences[pref] = spec;
    savePreferences();
    reportGameOverlay();
    if (pref === 'inviteHotkey' && typeof updateActivityNowPlayingCard === 'function') updateActivityNowPlayingCard(true);
    renderPage();
    showToast(t('hotkeys.saved', { hotkey: formatActionHotkey(spec) }));
    return;
  }
  if (typeof rebindingInviteHotkey !== 'undefined' && rebindingInviteHotkey) return;
  if (event.repeat || event.defaultPrevented) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
  const pressed = typeof hotkeySpecFromEvent === 'function' ? hotkeySpecFromEvent(event) : '';
  if (!pressed) return;
  const lower = pressed.toLowerCase();

  const toggleSpec = String(preferences.overlayToggleHotkey || '').trim().toLowerCase();
  if (toggleSpec && lower === toggleSpec) {
    event.preventDefault();
    triggerOverlayToggle();
    return;
  }
  const muteSpec = String(preferences.muteRobloxHotkey || '').trim().toLowerCase();
  if (muteSpec && lower === muteSpec) {
    event.preventDefault();
    void triggerRobloxMuteToggle();
    return;
  }
  const hopSpec = String(preferences.serverHopHotkey || '').trim().toLowerCase();
  if (hopSpec && lower === hopSpec) {
    event.preventDefault();
    void triggerServerHop();
    return;
  }
  const rejoinSpec = String(preferences.rejoinHotkey || '').trim().toLowerCase();
  if (rejoinSpec && lower === rejoinSpec) {
    event.preventDefault();
    void triggerServerRejoin();
  }
}, true);
