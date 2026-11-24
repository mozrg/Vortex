(() => {
  const card = document.getElementById('splash-card');
  const statusEl = document.getElementById('splash-status');
  const barEl = document.getElementById('splash-bar');

  let lang = 'ru';
  try {
    const raw = localStorage.getItem('vortex.preferences');
    if (raw) {
      const prefs = JSON.parse(raw);
      if (prefs?.language === 'en') lang = 'en';
      if (prefs?.theme === 'light') document.body.classList.add('light-theme');
      else if (prefs?.theme === 'oled') document.body.classList.add('oled-theme');
      if (/^#[0-9a-f]{6}$/i.test(prefs?.accent || '')) {
        document.documentElement.style.setProperty('--sp-accent', prefs.accent);
      }
      if (/^#[0-9a-f]{6}$/i.test(prefs?.accentSecondary || '')) {
        document.documentElement.style.setProperty('--sp-accent-2', prefs.accentSecondary);
      }
    }
  } catch { /* Use default dark theme. */ }

  document.documentElement.lang = lang;
  const stages = lang === 'en'
    ? [
        [24, 'Starting Vortex…'],
        [58, 'Loading library & preferences…'],
        [86, 'Preparing interface…']
      ]
    : [
        [24, 'Запуск Vortex…'],
        [58, 'Загрузка библиотеки и настроек…'],
        [86, 'Подготовка интерфейса…']
      ];

  let idx = 0;
  function setStage(pct, text) {
    if (barEl) barEl.style.width = `${pct}%`;
    if (statusEl) statusEl.textContent = text;
  }

  setStage(stages[0][0], stages[0][1]);
  const timer = window.setInterval(() => {
    idx += 1;
    if (idx < stages.length) {
      setStage(stages[idx][0], stages[idx][1]);
    } else {
      window.clearInterval(timer);
    }
  }, 240);

  const listen = window.__TAURI__?.event?.listen;
  if (listen) {
    listen('splash:done', () => {
      window.clearInterval(timer);
      setStage(100, lang === 'en' ? 'Ready!' : 'Готово!');
      if (card) card.classList.add('is-leaving');
    });
  }
})();
