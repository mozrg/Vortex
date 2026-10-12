// Temporary diagnostic: verifies 1.0.17 packaging contains all three improvements.
import asar from '@electron/asar';

const [target] = process.argv.slice(2);
const appJs = asar.extractFile(target, 'app.js').toString();
const css = asar.extractFile(target, 'styles.css').toString();
const html = asar.extractFile(target, 'index.html').toString();
const main = asar.extractFile(target, 'electron/main.cjs').toString();
const pkg = JSON.parse(asar.extractFile(target, 'package.json').toString());
const checks = {
  version: pkg.version,
  'game search field': appJs.includes('data-game-search'),
  'game search dropdown': appJs.includes('game-search-option'),
  'keyboard navigation': appJs.includes('highlightGameSearch'),
  'search styles': css.includes('.game-search-results'),
  'hover preview system': appJs.includes('showHoverPreview') && css.includes('.hover-preview-layer'),
  'previews on home options': appJs.includes("previewAttr('homeLayout'"),
  'previews on cards options': appJs.includes("previewAttr('density'"),
  'previews on accent options': appJs.includes("previewAttr('accent'"),
  'previews on theme options': appJs.includes("previewAttr('theme'"),
  'interface tab': appJs.includes("['interface', 'sliders']"),
  'interface settings renderer': appJs.includes('renderInterfaceSettings'),
  'nav order preference': appJs.includes('sidebarOrder'),
  'sidebar rendered from prefs': appJs.includes('function renderSidebar()'),
  'ui part data hooks': html.includes('data-ui-part="tip"') && html.includes('data-ui-part="topbar-search"'),
  'ui hide styles': css.includes('.ui-no-topbar-search'),
  'interface tab translated': appJs.includes("'settings.tab.interface': 'Интерфейс'"),
  'update fixes kept': main.includes("'start', '/b'") && main.includes('DOWNLOAD_ATTEMPTS')
};
for (const [name, value] of Object.entries(checks)) console.log(`${name}: ${value}`);
