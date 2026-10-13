// Temporary diagnostic: verifies 1.0.19 packaging contains the six follow-up fixes.
import asar from '@electron/asar';

const [target] = process.argv.slice(2);
const appJs = asar.extractFile(target, 'app.js').toString();
const css = asar.extractFile(target, 'styles.css').toString();
const main = asar.extractFile(target, 'electron/main.cjs').toString();
const trayHtml = asar.extractFile(target, 'tray.html').toString();
const trayPreload = asar.extractFile(target, 'electron/tray-preload.cjs').toString();
const preload = asar.extractFile(target, 'electron/preload.cjs').toString();
const pkg = JSON.parse(asar.extractFile(target, 'package.json').toString());
const checks = {
  version: pkg.version,
  'tray window html packaged': trayHtml.includes('tray-panel') && trayHtml.includes('Закрыть полностью'),
  'tray preload packaged': trayPreload.includes('vortexTray'),
  'preload reports recent games': preload.includes('reportRecentGames'),
  'main creates tray': main.includes('function createTray()') && main.includes("new Tray("),
  'close hides to tray': main.includes("window.on('close'") && main.includes('window.hide()'),
  'tray recent games ipc': main.includes("ipcMain.on('tray:recent-games'"),
  'tray launch ipc': main.includes('launchFromTray'),
  'window-all-closed keeps process': !main.includes('app.quit();\n});\n\napp.on(\'window-all-closed\''),
  'renderer reports on launch': appJs.includes('reportRecentGamesToTray();'),
  'report on startup': appJs.includes('renderPage();\nreportRecentGamesToTray();'),
  'compact rows': css.includes('.custom-game-row { display: grid; grid-template-columns: 30px'),
  'badge hover like nav': css.includes('.home-game-badge:hover'),
  'segment hover': css.includes('.segment:hover { background'),
  'settings tab hover': css.includes('.settings-tab:hover'),
  'toggle hover': css.includes('.toggle:hover'),
  'grip handle': appJs.includes('[data-ui-drag]') && css.includes('.ui-row-drag'),
  'drag pointer handlers': appJs.includes("addEventListener('pointerdown'") && appJs.includes("addEventListener('pointerup'"),
  'skin smooth fade': css.includes('mask-image: linear-gradient(#000 0%, transparent 78%)'),
  'aurora full page glow': css.includes('[data-home-skin="aurora"]::after'),
  'light theme extended': css.includes('body.light-theme .hero-copy p') && css.includes('body.light-theme .game-search-results'),
  'light toggle styles': css.includes('body.light-theme .toggle {'),
  'contrast direction fix': appJs.includes('const direction = isLightCanvas ? -4 : 3;'),
  'minimal label key restored': appJs.includes("'settings.home.minimal': 'Минимальный вид'"),
  'update fixes kept': main.includes("'start', '/b'") && main.includes('DOWNLOAD_ATTEMPTS')
};
for (const [name, value] of Object.entries(checks)) console.log(`${name}: ${value}`);
