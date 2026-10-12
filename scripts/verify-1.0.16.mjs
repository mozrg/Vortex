// Temporary diagnostic: verifies the packaged 1.0.16 build places home customisation in
// Settings (not on the home page) and keeps the update fixes.
import asar from '@electron/asar';

const [target] = process.argv.slice(2);
const appJs = asar.extractFile(target, 'app.js').toString();
const css = asar.extractFile(target, 'styles.css').toString();
const main = asar.extractFile(target, 'electron/main.cjs').toString();
const pkg = JSON.parse(asar.extractFile(target, 'package.json').toString());
const checks = {
  'version': pkg.version,
  'quick panel removed from home': !appJs.includes('renderHomeQuickPanel') && !appJs.includes('home-quick'),
  'quick panel styles removed': !css.includes('.home-quick'),
  'layout setting in settings': appJs.includes("data-pref=\"homeLayout\""),
  'skin setting in settings': appJs.includes("data-pref=\"homeSkin\""),
  'games-only toggle in settings': appJs.includes('data-toggle="homeMinimal"'),
  'layout styles kept': css.includes('[data-home-layout="spotlight"]'),
  'skin styles kept': css.includes('[data-home-skin="grid"]'),
  'games-only styles kept': css.includes('.home-minimal'),
  'no duplicated accent row on home': !appJs.includes('quick-swatch'),
  'density not duplicated in home tab': appJs.split('data-pref="density"').length === 2,
  'update fixes kept': main.includes("'start', '/b'") && main.includes('DOWNLOAD_ATTEMPTS'),
  'empty picks text present': appJs.includes("home.picks.emptyTitle': 'Подборка пока пуста'")
};
for (const [name, value] of Object.entries(checks)) console.log(`${name}: ${value}`);
