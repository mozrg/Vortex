(() => {
  const hud = document.querySelector('.game-hud');
  const metrics = Object.fromEntries([...hud.children].map(node => [node.dataset.metric, node]));
  const sparkPolyline = metrics.stability?.querySelector('polyline');
  let start = 0;
  let showClock = false;
  let clock = 0;

  function formatSystemTime() {
    const now = new Date();
    return [now.getHours(), now.getMinutes()].map(unit => String(unit).padStart(2, '0')).join(':');
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

    metrics.fps.hidden = data.fps == null;
    metrics.fps.firstElementChild.textContent = data.fps?.measured ?? '—';

    metrics.ping.hidden = data.ping == null;
    metrics.ping.firstElementChild.textContent = data.ping?.measured ?? '—';

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
      metrics.region.firstElementChild.textContent = data.region || '—';
      metrics.region.lastElementChild.textContent = data.badServer
        ? (english ? '⚠ Bad ping' : '⚠ Плохой пинг')
        : (english ? 'Region' : 'Регион');
    }

    if (metrics.clock) {
      metrics.clock.hidden = !showClock;
      metrics.clock.firstElementChild.textContent = formatSystemTime();
      metrics.clock.lastElementChild.textContent = english ? 'Time' : 'Время';
    }

    metrics.friends.hidden = !data.showFriends;
    metrics.friends.firstElementChild.textContent = data.friendCount ?? '—';
    metrics.friends.lastElementChild.textContent = english ? 'Friends online' : 'Друзья онлайн';

    hud.hidden = Object.values(metrics).every(metric => metric.hidden);
    paintClock();
  }

  function flashNotice(ruText, enText) {
    const english = document.documentElement.lang === 'en';
    const target = Object.values(metrics).find(metric => !metric.hidden && metric.dataset.metric !== 'stability')
      || Object.values(metrics).find(metric => !metric.hidden);
    if (!target) return;
    const label = target.lastElementChild;
    if (!label) return;
    const notice = english ? enText : ruText;
    const previous = label.textContent;
    const wasHidden = label.hidden;
    if (previous === notice) return;
    label.hidden = false;
    label.textContent = notice;
    setTimeout(() => {
      if (label.textContent === notice) {
        label.textContent = previous;
        label.hidden = wasHidden;
      }
    }, 1600);
  }

  async function startOverlay() {
    const tauri = window.__TAURI__;
    if (!tauri?.event || !tauri?.core) return;
    let received = false;
    await tauri.event.listen('game-overlay:content', ({ payload }) => {
      received = true;
      paint(payload);
    });
    await tauri.event.listen('game-overlay:invite-copied', () => {
      flashNotice('Инвайт скопирован', 'Invite copied');
    });
    await tauri.event.listen('game-overlay:mute-toggled', ({ payload }) => {
      if (payload?.muted) flashNotice('Звук Roblox выкл', 'Roblox muted');
      else flashNotice('Звук Roblox вкл', 'Roblox unmuted');
    });
    await tauri.event.listen('game-overlay:server-hop', () => {
      flashNotice('Смена сервера…', 'Hopping server…');
    });
    await tauri.event.listen('game-overlay:rejoin', () => {
      flashNotice('Перезаход…', 'Rejoining…');
    });
    const initial = await tauri.core.invoke('game_overlay_ready');
    if (!received) paint(initial);
  }

  void startOverlay().catch(error => console.warn('Game overlay could not start.', error));
})();
