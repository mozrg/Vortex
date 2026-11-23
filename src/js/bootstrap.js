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
  function showBootError() {
    if (window.__VORTEX_BOOTED__) return;
    const host = document.getElementById('page-content');
    if (!host) return;
    host.innerHTML = `<div style="margin:24px;padding:16px 18px;border:1px solid #f27272;border-radius:12px;background:#1a1520;color:#f3f2f8;font:13px/1.55 monospace;white-space:pre-wrap;">` +
      `Vortex boot error:\n` + bootErrors.join('\n\n') + `</div>`;
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
