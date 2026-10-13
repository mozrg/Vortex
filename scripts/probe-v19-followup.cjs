// Temporary diagnostic: verifies the six follow-up fixes — row layout, hover states,
// light theme, drag reorder, skin fade, tray behaviour (main-process level).
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('host-resolver-rules', 'MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const stub = `
window.vortexDesktop = Object.assign(window.vortexDesktop || {}, {
  searchGames: ({ query }) => Promise.resolve({ items: [
    { id: '2753915549', universeId: '2619649538', title: 'Blox Fruits', creator: 'Gamer Robot', description: 'Стань мастером фруктов.', thumbnail: '', playerCount: 2245123 },
    { id: '6516141723', universeId: '3107283736', title: 'DOORS', creator: 'LSPLASH', description: 'Открывай двери осторожно.', thumbnail: '', playerCount: 87311 }
  ] }),
  reportRecentGames: (games) => { window.__reportedGames = games; },
  getUpdateState: () => Promise.resolve({ status: 'development', currentVersion: '1.0.19' }),
  onUpdateState: () => () => {}
});`;

async function shoot(window, name) {
  const image = await window.webContents.capturePage();
  await fs.mkdir(path.join(__dirname, '..', 'dist-update-test', 'screens'), { recursive: true });
  await fs.writeFile(path.join(__dirname, '..', 'dist-update-test', 'screens', `${name}.png`), image.toPNG());
  console.log('saved', name);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 940, show: true, webPreferences: { contextIsolation: true, sandbox: true } });
  const errors = [];
  window.webContents.on('console-message', (_event, level, message) => { if (level >= 2) errors.push(message); });
  const load = window.loadFile(path.join(__dirname, '..', 'index.html'));
  await Promise.race([load.catch(() => {}), wait(6000)]);
  await wait(1500);
  await window.webContents.executeJavaScript(stub).catch(() => {});
  await window.webContents.executeJavaScript(`localStorage.clear(); localStorage.setItem('vortex.preferences', JSON.stringify({ settingsTab: 'home', language: 'ru', customGames: [
    { id: '2753915549', title: 'Blox Fruits', creator: 'Gamer Robot', description: 'Стань мастером фруктов.', art: 'live', thumbnail: '' },
    { id: '6516141723', title: 'DOORS', creator: 'LSPLASH', description: 'Открывай двери осторожно.', art: 'live', thumbnail: '' }
  ], homeFeaturedGame: '2753915549', homePicks: ['6516141723'] }))`).catch(() => {});
  await window.webContents.executeJavaScript(`localStorage.setItem('vortex.recent', JSON.stringify(['2753915549', '6516141723']))`).catch(() => {});
  window.webContents.reload();
  await wait(4000);
  await window.webContents.executeJavaScript(stub).catch(() => {});
  await wait(400);

  // 1. Row layout: avatar 30px, badges aligned, form gap.
  await window.webContents.executeJavaScript(`document.querySelector('[data-nav="settings"]')?.click()`);
  await wait(700);
  const rowLayout = await window.webContents.executeJavaScript(`(() => {
    const row = document.querySelector('.custom-game-row');
    const art = row?.querySelector('.home-game-art');
    const form = document.querySelector('.custom-game-form');
    const input = document.querySelector('.game-search-field');
    const button = document.querySelector('[data-add-custom]');
    const formRect = form?.getBoundingClientRect();
    const inputRect = input?.getBoundingClientRect();
    const buttonRect = button?.getBoundingClientRect();
    const badges = [...(row?.querySelectorAll('.home-game-badge') || [])].map((b) => {
      const rect = b.getBoundingClientRect();
      const copy = row.querySelector('.home-game-copy').getBoundingClientRect();
      return { noOverlap: rect.left >= copy.right - 2, sameRow: Math.abs(rect.top - copy.top) < 30, visible: rect.width > 40 };
    });
    return {
      artSize: art ? Math.round(art.getBoundingClientRect().width) + 'x' + Math.round(art.getBoundingClientRect().height) : null,
      inputToButtonGap: buttonRect && inputRect ? Math.round(buttonRect.left - inputRect.right) : null,
      badges,
      formWidth: formRect ? Math.round(formRect.width) : null
    };
  })()`).catch((e) => ({ error: e.message }));
  console.log('ROW LAYOUT:', JSON.stringify(rowLayout));
  await shoot(window, 'v19-my-games-rows');

  // 2. Hover states on settings controls.
  const hoverStates = await window.webContents.executeJavaScript(`(() => {
    const read = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const before = getComputedStyle(node).backgroundColor;
      node.classList.add('hover-probe');
      const style = getComputedStyle(node);
      const changedViaRule = new Function('return true')();
      node.classList.remove('hover-probe');
      return { hasTransition: style.transitionDuration !== '0s', baseBg: before };
    };
    const segment = document.querySelector('.segment:not(.active)');
    const tab = document.querySelector('.settings-tab');
    // simulate :hover via matched rules check
    const css = [...document.styleSheets].flatMap((sheet) => { try { return [...sheet.cssRules]; } catch { return []; } });
    const hasRule = (selectorText) => css.some((rule) => rule.selectorText && rule.selectorText.includes(selectorText));
    return {
      segmentHoverRule: hasRule('.segment:hover'),
      settingsTabHoverRule: hasRule('.settings-tab:hover'),
      navHoverRule: hasRule('.nav-item:hover'),
      toggleHoverRule: hasRule('.toggle:hover'),
      segmentTransition: segment ? getComputedStyle(segment).transitionDuration !== '0s' : null,
      tabTransition: tab ? getComputedStyle(tab).transitionDuration !== '0s' : null
    };
  })()`).catch((e) => ({ error: e.message }));
  console.log('HOVER STATES:', JSON.stringify(hoverStates));

  // 3. The minimal setting label is translated.
  const labels = await window.webContents.executeJavaScript(`(() => ({
    minimalLabel: [...document.querySelectorAll('.setting-label strong')].map((s) => s.textContent).find((text) => text.includes('Минимальный')) || null,
    rawKeyLeak: [...document.querySelectorAll('.setting-label strong')].some((s) => s.textContent.startsWith('settings.'))
  }))()`).catch((e) => ({ error: e.message }));
  console.log('LABELS:', JSON.stringify(labels));

  // 4. Drag reorder: simulate pointer events on the grip.
  await window.webContents.executeJavaScript(`document.querySelector('[data-settings-tab="interface"]')?.click()`);
  await wait(600);
  const dragResult = await window.webContents.executeJavaScript(`(() => {
    const list = document.querySelector('[data-ui-order]');
    const before = [...list.querySelectorAll('.ui-row')].map((row) => row.dataset.uiRow);
    const rows = [...list.querySelectorAll('.ui-row')];
    // Drag the last row (settings) to the top by dispatching pointer events.
    const last = rows[rows.length - 1];
    const grip = last.querySelector('[data-ui-drag]');
    const firstRect = rows[0].getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    grip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: lastRect.left + 12, clientY: lastRect.top + 12, pointerId: 1 }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: firstRect.left + 12, clientY: firstRect.top + 6, pointerId: 1 }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    const after = [...list.querySelectorAll('.ui-row')].map((row) => row.dataset.uiRow);
    return { before, after, moved: before.join(',') !== after.join(','), settingsOnTop: after[0] === 'settings' };
  })()`).catch((e) => ({ error: e.message }));
  const sidebarAfterDrag = await window.webContents.executeJavaScript(`[...document.querySelectorAll('[data-nav-group] .nav-item')].map((b) => b.dataset.nav).join(',')`).catch(() => null);
  console.log('DRAG REORDER:', JSON.stringify(dragResult), 'SIDEBAR:', sidebarAfterDrag);

  // 5. Skin fades: check the mask gradient on the grid skin.
  await window.webContents.executeJavaScript(`document.querySelector('[data-nav="home"]')?.click()`);
  await wait(700);
  const skins = await window.webContents.executeJavaScript(`(() => {
    const view = document.querySelector('.home-view');
    const check = (skin) => {
      view.dataset.homeSkin = skin;
      const before = getComputedStyle(view, '::before');
      return { mask: before.maskImage.slice(0, 60) || before.webkitMaskImage.slice(0, 60), bg: before.backgroundImage.slice(0, 40) };
    };
    return { grid: check('grid'), aurora: check('aurora') };
  })()`).catch((e) => ({ error: e.message }));
  console.log('SKIN FADE:', JSON.stringify(skins));

  // 6. Light theme contrast: compute contrast of active nav text vs its background.
  await window.webContents.executeJavaScript(`(() => { preferences.theme = 'light'; preferences.accent = '#F626F'.padEnd(7, '0'); savePreferences(); renderPage(); })()`).catch(() => {});
  await wait(600);
  const lightContrast = await window.webContents.executeJavaScript(`(() => {
    const nav = document.querySelector('.nav-item.active') || document.querySelector('.settings-tab.active');
    if (!nav) return null;
    const color = getComputedStyle(nav).color;
    const background = getComputedStyle(nav).backgroundColor;
    const luminance = (value) => {
      const match = value.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)/);
      if (!match) return 0;
      const [r, g, b] = match.slice(1).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const textLum = luminance(color);
    let bg = background;
    let node = nav.parentElement;
    while (node && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) { bg = getComputedStyle(node).backgroundColor; node = node.parentElement; }
    const bgLum = luminance(bg);
    const ratio = (Math.max(textLum, bgLum) + 0.05) / (Math.min(textLum, bgLum) + 0.05);
    return { color, background: bg, ratio: Math.round(ratio * 100) / 100 };
  })()`).catch((e) => ({ error: e.message }));
  console.log('LIGHT CONTRAST:', JSON.stringify(lightContrast));
  await shoot(window, 'v19-light-theme');

  // 7. Recent games reporting.
  const reported = await window.webContents.executeJavaScript(`(() => {
    reportRecentGamesToTray();
    return window.__reportedGames || [];
  })()`).catch((e) => ({ error: e.message }));
  console.log('TRAY REPORT:', JSON.stringify(reported));

  console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 10).join(' | ') : 'none');
  app.exit(0);
});
