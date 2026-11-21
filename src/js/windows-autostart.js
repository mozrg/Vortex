Object.assign(translations.ru, {
  "settings.autostart.group": "Запуск Vortex",
  "settings.autostart.title": "Запускать Vortex при входе в Windows",
  "settings.autostart.body": "Открывать лаунчер при входе в твою учётную запись Windows.",
  "settings.autostart.failed": "Не удалось прочитать настройку Windows.",
  "settings.autostart.saveError": "Windows не сохранила настройку автозапуска.",
  "settings.autostart.retry": "Проверить снова"
});

Object.assign(translations.en, {
  "settings.autostart.group": "Vortex startup",
  "settings.autostart.title": "Start Vortex when signing into Windows",
  "settings.autostart.body": "Open the launcher when you sign in to your Windows account.",
  "settings.autostart.failed": "Windows startup settings could not be read.",
  "settings.autostart.saveError": "Windows could not save the startup setting.",
  "settings.autostart.retry": "Check again"
});

const windowsAutostart = { enabled: null, busy: false, read: false, failed: false };

function windowsAutostartControls() {
  const { enabled, busy, failed } = windowsAutostart;
  const label = t('settings.autostart.title');
  return `<div class="setting-line"><div class="setting-label"><strong>${label}</strong>
    <small>${t(failed ? 'settings.autostart.failed' : 'settings.autostart.body')}</small></div>
    ${failed ? `<button class="control-button" type="button" data-action="windows-autostart" data-autostart-retry
      aria-disabled="${busy}">${icon('refreshCw', 14)} ${t('settings.autostart.retry')}</button>`
      : `<button class="toggle" type="button" data-action="windows-autostart" role="switch"
        aria-label="${label}" aria-checked="${enabled === true}" aria-disabled="${busy || enabled === null}"></button>`}</div>`;
}

function renderWindowsAutostart() {
  if (!windowsAutostart.read && !windowsAutostart.busy) queueMicrotask(refreshWindowsAutostart);
  return `<section class="settings-card"><div class="settings-card-head"><h2>${t('settings.autostart.group')}</h2>${icon('monitor', 18)}</div>
    <div data-windows-autostart>${windowsAutostartControls()}</div></section>`;
}

function paintWindowsAutostart() {
  const host = document.querySelector('[data-windows-autostart]');
  if (!host) return;
  const focused = host.contains(document.activeElement);
  host.innerHTML = windowsAutostartControls();
  if (focused) host.querySelector('button')?.focus({ preventScroll: true });
}

async function refreshWindowsAutostart() {
  if (windowsAutostart.busy || !document.querySelector('[data-windows-autostart]')) return;
  windowsAutostart.busy = true;
  try {
    const enabled = await window.vortexDesktop.getWindowsAutostart();
    if (typeof enabled !== 'boolean') throw new Error('Invalid autostart status');
    windowsAutostart.enabled = enabled;
    windowsAutostart.failed = false;
  } catch { windowsAutostart.failed = true; }
  finally {
    windowsAutostart.busy = false;
    windowsAutostart.read = true;
    paintWindowsAutostart();
  }
}

document.addEventListener('click', async event => {
  const button = event.target.closest?.('[data-action="windows-autostart"]');
  if (!button || windowsAutostart.busy || button.getAttribute('aria-disabled') === 'true') return;
  if (button.hasAttribute('data-autostart-retry')) {
    void refreshWindowsAutostart();
    return;
  }
  windowsAutostart.busy = true;
  button.setAttribute('aria-disabled', 'true');
  try {
    const enabled = await window.vortexDesktop.setWindowsAutostart(!windowsAutostart.enabled);
    if (typeof enabled !== 'boolean') throw new Error('Invalid autostart status');
    windowsAutostart.enabled = enabled;
  } catch { showToast(t('settings.autostart.saveError')); }
  finally {
    windowsAutostart.busy = false;
    paintWindowsAutostart();
  }
});

window.addEventListener('focus', () => { void refreshWindowsAutostart(); });
