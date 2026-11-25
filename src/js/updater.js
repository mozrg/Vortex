(() => {
  const card = document.getElementById('updater-card');
  const titleEl = document.getElementById('updater-title');
  const fromEl = document.getElementById('version-from');
  const toEl = document.getElementById('version-to');
  const statusEl = document.getElementById('updater-status');
  const percentEl = document.getElementById('updater-percent');
  const barEl = document.getElementById('updater-bar');
  const trackEl = document.querySelector('.updater-track');
  const detailEl = document.getElementById('updater-detail');
  const errorBox = document.getElementById('updater-error-box');
  const errorText = document.getElementById('updater-error-text');
  const retryBtn = document.getElementById('updater-retry-btn');
  const closeBtn = document.getElementById('updater-close-btn');

  const ORDER = ['closing', 'downloading', 'verifying', 'installing', 'launching'];
  let lang = 'ru';
  let latestSequence = -1;
  let latestStage = 'closing';
  let pollTimer = 0;
  let themeSignature = '';

  const COPY = {
    ru: {
      title: 'Обновление Vortex',
      steps: { closing: 'Подготовка', downloading: 'Загрузка', verifying: 'Проверка', installing: 'Установка', launching: 'Запуск' },
      messages: {
        closing: 'Завершаем текущий процесс Vortex…',
        downloading: 'Скачиваем обновление с GitHub…',
        verifying: 'Проверяем контрольную сумму SHA-256…',
        installing: 'Распаковываем и устанавливаем обновление…',
        launching: 'Готово! Запускаем обновлённый Vortex…',
        done: 'Обновление установлено!'
      },
      failed: 'Обновление остановлено',
      disconnected: 'Нет связи с загрузчиком. Повторяем подключение…',
      unknownProgress: 'Выполняется',
      retry: 'Повторить',
      close: 'Закрыть'
    },
    en: {
      title: 'Updating Vortex',
      steps: { closing: 'Prepare', downloading: 'Download', verifying: 'Verify', installing: 'Install', launching: 'Launch' },
      messages: {
        closing: 'Closing current Vortex process…',
        downloading: 'Downloading update from GitHub…',
        verifying: 'Verifying SHA-256 checksum…',
        installing: 'Extracting and installing update…',
        launching: 'Done! Launching updated Vortex…',
        done: 'Update installed!'
      },
      failed: 'Update stopped',
      disconnected: 'Lost contact with the updater. Reconnecting…',
      unknownProgress: 'In progress',
      retry: 'Retry',
      close: 'Close'
    }
  };

  function applyTheme({ theme, accent, accentSecondary, language }) {
    lang = language === 'en' ? 'en' : 'ru';
    document.documentElement.lang = lang;
    document.body.classList.toggle('light-theme', theme === 'light');
    document.body.classList.toggle('oled-theme', theme === 'oled');
    if (/^#[0-9a-f]{6}$/i.test(accent || '')) {
      document.documentElement.style.setProperty('--up-accent', accent);
    }
    if (/^#[0-9a-f]{6}$/i.test(accentSecondary || '')) {
      document.documentElement.style.setProperty('--up-accent-2', accentSecondary);
    }
    const dict = COPY[lang];
    if (titleEl) titleEl.textContent = dict.title;
    if (retryBtn) retryBtn.textContent = dict.retry;
    if (closeBtn) closeBtn.textContent = dict.close;
    for (const key of ORDER) {
      const lbl = document.querySelector(`[data-step-label="${key}"]`);
      if (lbl) lbl.textContent = dict.steps[key];
    }
  }

  function applyProgress(payload) {
    if (!payload) return;
    const sequence = Number(payload.sequence) || 0;
    if (sequence <= latestSequence) return;
    latestSequence = sequence;
    const theme = JSON.stringify([payload.theme, payload.accent, payload.accentSecondary, payload.language]);
    if (theme !== themeSignature) {
      themeSignature = theme;
      applyTheme(payload);
    }
    if (payload.fromVersion && fromEl) fromEl.textContent = `v${String(payload.fromVersion).replace(/^v/i, '')}`;
    if (payload.toVersion && toEl) toEl.textContent = `v${String(payload.toVersion).replace(/^v/i, '')}`;

    const pct = Math.max(0, Math.min(100, Math.round(Number(payload.progress) || 0)));
    if (barEl) barEl.style.width = `${pct}%`;
    const stage = String(payload.stage || 'closing');
    const dict = COPY[lang];
    const indeterminate = stage === 'downloading' && payload.indeterminate === true;
    if (percentEl) percentEl.textContent = indeterminate ? '…' : `${pct}%`;
    trackEl?.toggleAttribute('data-indeterminate', indeterminate);
    if (indeterminate) {
      trackEl?.removeAttribute('aria-valuenow');
      trackEl?.setAttribute('aria-valuetext', dict.unknownProgress);
    } else {
      trackEl?.setAttribute('aria-valuenow', String(pct));
      trackEl?.removeAttribute('aria-valuetext');
    }
    const msg = payload.message || (stage === 'error' ? dict.failed : dict.messages[stage]) || '';
    if (statusEl && msg && statusEl.textContent !== msg) statusEl.textContent = msg;
    if (detailEl) {
      const detail = typeof payload.detail === 'string' ? payload.detail.trim() : '';
      detailEl.textContent = detail;
      detailEl.hidden = !detail;
    }

    const isError = stage === 'error';
    const isDone = stage === 'done';
    if (card) card.dataset.state = isError ? 'error' : isDone ? 'done' : 'running';

    const activeIdx = isDone ? ORDER.length : ORDER.indexOf(isError ? latestStage : stage);
    latestStage = isError ? latestStage : stage;
    document.querySelectorAll('.updater-step').forEach((node) => {
      const idx = ORDER.indexOf(node.dataset.step);
      node.classList.toggle('is-done', idx >= 0 && idx < activeIdx);
      node.classList.toggle('is-active', !isError && !isDone && idx === activeIdx);
      if (!isError && !isDone && idx === activeIdx) node.setAttribute('aria-current', 'step');
      else node.removeAttribute('aria-current');
    });

    if (errorBox) errorBox.hidden = !isError;
    if (errorText && isError) errorText.textContent = payload.error || 'Update error';
  }

  // Fallback theme from localStorage before IPC arrives.
  try {
    const raw = localStorage.getItem('vortex.preferences');
    if (raw) applyTheme(JSON.parse(raw));
  } catch { /* default */ }

  const tauri = window.__TAURI__;
  retryBtn?.addEventListener('click', async () => {
    retryBtn.disabled = true;
    if (errorBox) errorBox.hidden = true;
    if (card) card.dataset.state = 'running';
    try { await tauri?.core?.invoke('updater_retry'); }
    catch {
      if (errorBox) errorBox.hidden = false;
      if (card) card.dataset.state = 'error';
      return;
    }
    finally { retryBtn.disabled = false; }
    scheduleSnapshot();
  });
  closeBtn?.addEventListener('click', () => {
    tauri?.core?.invoke?.('updater_close').catch(() => window.close());
  });

  function scheduleSnapshot() {
    clearTimeout(pollTimer);
    if (latestStage !== 'done') pollTimer = setTimeout(readSnapshot, 150);
  }

  async function readSnapshot() {
    try { applyProgress(await tauri.core.invoke('updater_ready')); }
    catch {
      if (statusEl && latestSequence < 0) statusEl.textContent = COPY[lang].disconnected;
    }
    if (card?.dataset.state !== 'error') scheduleSnapshot();
  }

  if (tauri?.core?.invoke) {
    void readSnapshot();
  }
  window.addEventListener('pagehide', () => clearTimeout(pollTimer), { once: true });
})();
