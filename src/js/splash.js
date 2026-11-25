(() => {
  const card = document.getElementById('splash-card');
  const statusEl = document.getElementById('splash-status');
  const barEl = document.getElementById('splash-bar');
  const track = document.querySelector('.splash-track');

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
  const labels = lang === 'en'
    ? ['Starting Vortex…', 'Checking local data…', 'Loading app modules…', 'Preparing the interface…', 'Ready!']
    : ['Запуск Vortex…', 'Проверяем локальные данные…', 'Загружаем модули…', 'Готовим интерфейс…', 'Готово!'];
  const milestones = [10, 25, 50, 80, 100];
  let latestStage = -1;
  function setStage(stage) {
    if (!Number.isInteger(stage) || stage <= latestStage || stage >= milestones.length) return;
    latestStage = stage;
    const progress = milestones[stage];
    if (barEl) barEl.style.width = `${progress}%`;
    if (statusEl) statusEl.textContent = labels[stage];
    track?.setAttribute('aria-valuenow', String(progress));
    if (stage === 4) card?.classList.add('is-leaving');
  }

  setStage(0);
  const tauri = window.__TAURI__;
  async function watchStartup() {
    try { setStage(await tauri.core.invoke('splash_progress')); }
    catch { /* The native window controls when to dismiss this splash. */ }
    if (latestStage < 4) window.setTimeout(watchStartup, 100);
  }
  if (tauri?.core?.invoke) void watchStartup();
})();
