(() => {
  const hud = document.querySelector('.game-hud');
  const metrics = Object.fromEntries(
    [...hud.querySelectorAll('.game-hud-metric')].map(node => [node.dataset.metric, node])
  );
  const sparkPolyline = metrics.stability?.querySelector('polyline');
  const alertBox = document.getElementById('game-hud-alert');
  const alertText = document.getElementById('game-hud-alert-text');
  let start = 0;
  let showClock = false;
  let clock = 0;
  let alertTimer = 0;

  function formatSystemTime() {
    const now = new Date();
    return [now.getHours(), now.getMinutes()].map(unit => String(unit).padStart(2, '0')).join(':');
  }

  function formatRamValue(ramMb) {
    const mb = Number(ramMb);
    if (!Number.isFinite(mb) || mb <= 0) return '—';
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${Math.round(mb)} MB`;
  }

  function paintClock() {
    if (start) {
      const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const time = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];
      metrics.timer.firstElementChild.textContent = time.map(unit => String(unit).padStart(2, '0')).join(':');
    }
    if (showClock && metrics.clock) {
      metrics.clock.firstElementChild.textContent = formatSystemTime();
    }
  }

  function buildSparkPoints(history) {
    const list = Array.isArray(history) ? history.filter(v => Number.isFinite(v) && v > 0) : [];
    if (list.length < 2) return '1,7 37,7';
    const min = Math.min(...list);
    const max = Math.max(...list);
    const span = Math.max(12, max - min);
    const base = min - Math.max(0, (12 - (max - min)) / 2);
    return list.map((val, index) => {
      const x = 1 + (index / (list.length - 1)) * 36;
      const ratio = Math.max(0, Math.min(1, (val - base) / span));
      const y = 12 - ratio * 10;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  function renderBadPingPrompt(span, english, badServer, badPingPrompt, hopHotkey) {
    span.replaceChildren();
    if (!badServer) {
      span.textContent = english ? 'Region' : 'Регион';
      return;
    }
    const cleanHotkey = String(hopHotkey || '').trim();
    if (!badPingPrompt || !cleanHotkey) {
      span.textContent = english ? 'Bad ping' : 'Плохой пинг';
      return;
    }
    span.append(document.createTextNode(english ? 'Bad ping · Press ' : 'Плохой пинг · Нажмите '));
    const kbd = document.createElement('kbd');
    kbd.className = 'hud-kbd';
    kbd.textContent = cleanHotkey;
    span.append(kbd);
    span.append(document.createTextNode(english ? ' to switch' : ', чтобы сменить'));
  }

  function paint(data) {
    if (!data) return;
    const english = data.language === 'en';
    document.documentElement.lang = english ? 'en' : 'ru';
    hud.toggleAttribute('data-motion', Boolean(data.motion));
    if (/^#[0-9a-f]{6}$/i.test(data.accent)) hud.style.setProperty('--hud-accent', data.accent);
    const scale = Math.max(70, Math.min(150, Number(data.scale) || 100)) / 100;
    const gap = Math.max(0, Math.min(24, Number.isFinite(Number(data.gap)) ? Number(data.gap) : 5));
    const opacity = Math.max(20, Math.min(100, Number(data.opacity) || 74)) / 100;
    hud.style.setProperty('--hud-scale', scale.toFixed(2));
    hud.style.setProperty('--hud-gap', `${gap}px`);
    hud.style.setProperty('--hud-opacity', opacity.toFixed(2));
    hud.dataset.style = ['capsule', 'frameless', 'vertical'].includes(data.style) ? data.style : 'capsule';
    hud.dataset.badServer = data.badServer ? 'true' : 'false';

    showClock = Boolean(data.showClock);
    const nextStart = data.startedAt || 0;
    if (start !== nextStart || (!clock && (nextStart || showClock))) {
      start = nextStart;
      clearInterval(clock);
      clock = (start || showClock) ? setInterval(paintClock, 250) : 0;
    } else if (!start && !showClock && clock) {
      clearInterval(clock);
      clock = 0;
    }

    metrics.timer.hidden = !start;
    metrics.timer.lastElementChild.textContent = english ? 'Session' : 'Сессия';

    const lowFpsThreshold = Number(data.lowFps) || 30;
    const badPingThreshold = Number(data.badPingMs) || 130;

    metrics.fps.hidden = data.fps == null;
    metrics.fps.firstElementChild.textContent = data.fps?.measured ?? '—';
    metrics.fps.dataset.low = (Number.isFinite(data.fps?.measured) && data.fps.measured < lowFpsThreshold) ? 'true' : 'false';

    metrics.ping.hidden = data.ping == null;
    metrics.ping.firstElementChild.textContent = data.ping?.measured ?? '—';
    metrics.ping.dataset.bad = (Number.isFinite(data.ping?.measured) && data.ping.measured >= badPingThreshold) ? 'true' : 'false';

    if (metrics.stability) {
      metrics.stability.hidden = !data.showStability;
      const jitter = data.jitter;
      metrics.stability.firstElementChild.textContent = jitter != null ? `±${jitter} ms` : '±— ms';
      metrics.stability.dataset.unstable = (Number(jitter) >= 20) ? 'true' : 'false';
      if (sparkPolyline) sparkPolyline.setAttribute('points', buildSparkPoints(data.pingHistory));
    }

    if (metrics.region) {
      const showRegion = Boolean(data.showRegion || data.badServer);
      metrics.region.hidden = !showRegion;
      metrics.region.dataset.bad = data.badServer ? 'true' : 'false';
      const strong = metrics.region.querySelector('strong');
      const span = metrics.region.querySelector('span');
      if (strong) strong.textContent = data.region || '—';
      if (span) renderBadPingPrompt(span, english, Boolean(data.badServer), data.badPingPrompt !== false, data.serverHopHotkey);
    }

    if (metrics.system) {
      const showSystem = Boolean(data.showSystem);
      metrics.system.hidden = !showSystem;
      if (showSystem) {
        const ramMb = Number(data.ramMb) || 0;
        const cpuPct = data.cpuPercent != null ? `${data.cpuPercent}% CPU` : 'RAM';
        metrics.system.dataset.highRam = ramMb >= 3200 ? 'true' : 'false';
        metrics.system.firstElementChild.textContent = formatRamValue(ramMb);
        metrics.system.lastElementChild.textContent = cpuPct;
      }
    }

    if (metrics.clock) {
      metrics.clock.hidden = !showClock;
      metrics.clock.firstElementChild.textContent = formatSystemTime();
      metrics.clock.lastElementChild.textContent = english ? 'Time' : 'Время';
    }

    metrics.friends.hidden = !data.showFriends;
    metrics.friends.firstElementChild.textContent = data.friendCount ?? '—';
    metrics.friends.lastElementChild.textContent = english ? 'Friends online' : 'Друзья онлайн';

    hud.hidden = Object.values(metrics).every(metric => metric.hidden) && (alertBox ? alertBox.hidden : true);
    paintClock();
  }

  function showHudAlert(message, durationMs = 2200) {
    if (!alertBox || !alertText || !message) return;
    clearTimeout(alertTimer);
    alertText.textContent = message;
    alertBox.hidden = false;
    hud.hidden = false;
    alertTimer = setTimeout(() => {
      alertBox.hidden = true;
      hud.hidden = Object.values(metrics).every(metric => metric.hidden);
    }, durationMs);
  }

  function flashNotice(ruText, enText, durationMs = 1800) {
    const english = document.documentElement.lang === 'en';
    showHudAlert(english ? enText : ruText, durationMs);
  }

  async function startOverlay() {
    const tauri = window.__TAURI__;
    if (!tauri?.event || !tauri?.core) return;
    let received = false;
    await tauri.event.listen('game-overlay:content', ({ payload }) => {
      received = true;
      paint(payload);
    });
    await tauri.event.listen('game-overlay:notice', ({ payload }) => {
      if (typeof payload === 'string' && payload.trim()) {
        showHudAlert(payload.trim(), 3800);
      }
    });
    await tauri.event.listen('game-overlay:invite-copied', () => {
      flashNotice('Инвайт-ссылка скопирована', 'Invite link copied');
    });
    await tauri.event.listen('game-overlay:mute-toggled', ({ payload }) => {
      const muted = typeof payload === 'boolean' ? payload : Boolean(payload?.muted);
      if (muted) flashNotice('Звук Roblox выключен', 'Roblox audio muted');
      else flashNotice('Звук Roblox включён', 'Roblox audio unmuted');
    });
    await tauri.event.listen('game-overlay:server-hop', () => {
      flashNotice('Подбираем новый сервер…', 'Switching server…');
    });
    await tauri.event.listen('game-overlay:rejoin', () => {
      flashNotice('Перезаходим на сервер…', 'Rejoining server…');
    });
    const initial = await tauri.core.invoke('game_overlay_ready');
    if (!received) paint(initial);
  }

  void startOverlay().catch(error => console.warn('Game overlay could not start.', error));
})();
