(() => {
  const card = document.getElementById('updater-card');
  const titleEl = document.getElementById('updater-title');
  const fromEl = document.getElementById('version-from');
  const toEl = document.getElementById('version-to');
  const statusEl = document.getElementById('updater-status');
  const percentEl = document.getElementById('updater-percent');
  const barEl = document.getElementById('updater-bar');
  const trackEl = document.querySelector('.updater-track');
  const errorBox = document.getElementById('updater-error-box');
  const errorText = document.getElementById('updater-error-text');
  const retryBtn = document.getElementById('updater-retry-btn');
  const closeBtn = document.getElementById('updater-close-btn');

  const ORDER = ['closing', 'verifying', 'installing', 'launching'];
  let lang = 'ru';

  const COPY = {
    ru: {
      title: 'Обновление Vortex',
      steps: { closing: 'Подготовка', verifying: 'Проверка', installing: 'Установка', launching: 'Запуск' },
      messages: {
        closing: 'Завершаем текущий процесс Vortex…',
        verifying: 'Проверяем целостность установщика…',
        installing: 'Устанавливаем новую версию…',
        launching: 'Готово! Запускаем обновлённый Vortex…',
        done: 'Обновление установлено!'
      },
      retry: 'Повторить',
      close: 'Закрыть'
    },
    en: {
      title: 'Updating Vortex',
      steps: { closing: 'Prepare', verifying: 'Verify', installing: 'Install', launching: 'Launch' },
      messages: {
        closing: 'Closing current Vortex process…',
        verifying: 'Verifying installer package…',
        installing: 'Installing new version…',
        launching: 'Done! Launching updated Vortex…',
        done: 'Update installed!'
      },
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
    if (payload.fromVersion && fromEl) fromEl.textContent = `v${String(payload.fromVersion).replace(/^v/i, '')}`;
    if (payload.toVersion && toEl) toEl.textContent = `v${String(payload.toVersion).replace(/^v/i, '')}`;

    const pct = Math.max(0, Math.min(100, Math.round(Number(payload.progress) || 0)));
    if (barEl) barEl.style.width = `${pct}%`;
    if (percentEl) percentEl.textContent = `${pct}%`;
    if (trackEl) trackEl.setAttribute('aria-valuenow', String(pct));

    const stage = String(payload.stage || 'closing');
    const dict = COPY[lang];
    const msg = payload.message || dict.messages[stage] || '';
    if (statusEl && msg) statusEl.textContent = msg;

    const isError = stage === 'error';
    const isDone = stage === 'done';
    if (card) card.dataset.state = isError ? 'error' : isDone ? 'done' : 'running';

    const activeIdx = isDone ? ORDER.length : ORDER.indexOf(stage);
    document.querySelectorAll('.updater-step').forEach((node) => {
      const idx = ORDER.indexOf(node.dataset.step);
      node.classList.toggle('is-done', idx >= 0 && idx < activeIdx);
      node.classList.toggle('is-active', !isError && !isDone && idx === activeIdx);
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
  retryBtn?.addEventListener('click', () => {
    if (errorBox) errorBox.hidden = true;
    tauri?.core?.invoke?.('updater_retry').catch(() => {});
  });
  closeBtn?.addEventListener('click', () => {
    tauri?.core?.invoke?.('updater_close').catch(() => window.close());
  });

  if (tauri?.event?.listen) {
    tauri.event.listen('updater:progress', (event) => applyProgress(event.payload));
  }
  if (tauri?.core?.invoke) {
    tauri.core.invoke('updater_ready')
      .then((info) => {
        if (info) {
          applyTheme(info);
          applyProgress(info);
        }
      })
      .catch(() => {});
  }
})();
