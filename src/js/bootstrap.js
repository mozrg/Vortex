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

  function loadApplication() {
    const script = document.createElement('script');
    script.src = './app.js';
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
