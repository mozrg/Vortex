(() => {
  const marker = 'vortex.migration.electron.v1';

  function mergePreferences(legacyValue, currentValue) {
    try {
      const legacy = JSON.parse(legacyValue);
      const current = JSON.parse(currentValue);
      if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)
        && current && typeof current === 'object' && !Array.isArray(current)) {
        return JSON.stringify({ ...legacy, ...current });
      }
    } catch { /* Keep the current value if either copy is malformed. */ }
    return currentValue;
  }

  const bootErrors = [];
  function escapeBootHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }
  function showBootError() {
    if (window.__VORTEX_BOOTED__) return;
    const host = document.getElementById('page-content') || document.body;
    if (!host) return;
    const logText = bootErrors.join('\n\n');
    host.innerHTML = `<div class="vortex-boot-recovery" style="max-width:680px;margin:40px auto;padding:24px 26px;border:1px solid rgba(242,114,114,.38);border-radius:16px;background:rgba(24,20,34,.96);color:#f3f2f8;font-family:system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 18px 48px rgba(0,0,0,.45);">` +
      `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">` +
      `<strong style="font-size:16px;color:#ff9494;">Ошибка запуска Vortex</strong>` +
      `<div style="display:flex;gap:8px;">` +
      `<button type="button" id="vortex-boot-copy" style="padding:7px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#eceaf5;font-size:12px;cursor:pointer;">Скопировать лог</button>` +
      `<button type="button" id="vortex-boot-reload" style="padding:7px 14px;border-radius:9px;border:0;background:#8f7cff;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Перезагрузить</button>` +
      `</div></div>` +
      `<p style="margin:0 0 12px;font-size:13px;color:#b8b4cc;">Не удалось загрузить интерфейс лаунчера. Попробуй перезагрузить окно или отправь лог разработчику.</p>` +
      `<pre style="margin:0;padding:12px 14px;border-radius:10px;background:rgba(10,9,16,.78);border:1px solid rgba(255,255,255,.08);color:#e4e1f2;font:12px/1.5 monospace;white-space:pre-wrap;max-height:280px;overflow:auto;">${escapeBootHtml(logText)}</pre>` +
      `</div>`;
    host.querySelector('#vortex-boot-reload')?.addEventListener('click', () => window.location.reload());
    host.querySelector('#vortex-boot-copy')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const done = () => { if (btn) btn.textContent = 'Скопировано!'; };
      if (window.vortexDesktop?.copyText) {
        window.vortexDesktop.copyText(logText).then(done).catch(() => {});
      } else if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(logText).then(done).catch(() => {});
      }
    });
  }
  window.addEventListener('error', (event) => {
    if (window.__VORTEX_BOOTED__) return;
    const detail = `${event.message || 'Script error'} (${event.filename || '?'}:${event.lineno || 0}:${event.colno || 0})\n${event.error?.stack || ''}`.trim();
    bootErrors.push(detail);
    showBootError();
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (window.__VORTEX_BOOTED__) return;
    const detail = `Unhandled rejection: ${event.reason?.stack || event.reason || 'unknown'}`;
    bootErrors.push(detail);
    showBootError();
  });

  const appScripts = [
    './js/app-state.js',
    './js/app-home.js',
    './js/app-friends.js',
    './js/app-settings.js',
    './js/app-sidebar.js',
    './js/app-runtime.js',
    './js/app-events.js',
    './app.js'
  ];

  function loadApplication(index = 0) {
    if (index >= appScripts.length) return;
    const script = document.createElement('script');
    script.async = false;
    script.src = appScripts[index];
    script.onload = () => loadApplication(index + 1);
    script.onerror = (error) => {
      bootErrors.push(`Failed to load module: ${appScripts[index]}`);
      showBootError();
      console.error('Failed to load Vortex module:', appScripts[index], error);
      loadApplication(index + 1);
    };
    document.body.appendChild(script);
  }

  async function migrateThenLoad() {
    if (localStorage.getItem(marker) === 'done' || !window.vortexDesktop?.importLegacyLocalStorage) {
      loadApplication();
      return;
    }

    try {
      const result = await window.vortexDesktop.importLegacyLocalStorage();
      if (result?.available) {
        for (const [key, value] of Object.entries(result.values || {})) {
          if (!key.startsWith('vortex.') || typeof value !== 'string') continue;
          const current = localStorage.getItem(key);
          if (key === 'vortex.preferences' && current !== null) {
            localStorage.setItem(key, mergePreferences(value, current));
          } else if (current === null) {
            localStorage.setItem(key, value);
          }
        }
        localStorage.setItem(marker, 'done');
      }
    } catch (error) {
      console.warn('Legacy Vortex data migration will be retried at next launch.', error);
    }

    loadApplication();
  }

  void migrateThenLoad();
})();
