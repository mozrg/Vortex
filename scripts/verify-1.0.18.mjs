// Temporary diagnostic: verifies 1.0.18 packaging contains all the requested fixes.
import asar from '@electron/asar';

const [target] = process.argv.slice(2);
const appJs = asar.extractFile(target, 'app.js').toString();
const css = asar.extractFile(target, 'styles.css').toString();
const html = asar.extractFile(target, 'index.html').toString();
const main = asar.extractFile(target, 'electron/main.cjs').toString();
const startup = asar.extractFile(target, 'startup.html').toString();
const pkg = JSON.parse(asar.extractFile(target, 'package.json').toString());
const checks = {
  version: pkg.version,
  'home renders only custom games': appJs.includes('preferences.customGames || []').map,
  'home uses user games only': appJs.includes('const customGames = [...new Map((preferences.customGames || [])'),
  'banner and picks badges': appJs.includes('data-banner-pick') && appJs.includes('data-picks-pick'),
  'homePicks preference': appJs.includes('homePicks'),
  'banner picks handler': appJs.includes('[data-banner-pick]'),
  'picks handler': appJs.includes('[data-picks-pick]'),
  'remove also drops picks': appJs.includes("preferences.homePicks = (preferences.homePicks || []).filter((pick) => String(pick) !== id)"),
  'game avatar on banner': appJs.includes('hero-avatar') && css.includes('.hero-avatar'),
  'orbit art removed from js': !appJs.includes('hero-rings') && !appJs.includes('hero-orbit-label'),
  'hero style setting removed': !appJs.includes('homeHeroStyle'),
  'orbit css removed': !css.includes('.hero-art') && !css.includes('[data-hero-style]') && !css.includes('.hero-rings'),
  'logo glow removed': !css.includes('drop-shadow(0 4px 12px') && !startup.includes('drop-shadow(0 5px 16px'),
  'skin aurora glow added': css.includes('[data-home-skin="aurora"]::before'),
  'skin plain flat': css.includes('[data-home-skin="plain"] .hero-card { background: var(--surface)'),
  'unique page transition previews': css.includes('.page-transition-mock.slide .mock-page') && css.includes('mock-page-slide'),
  'unique card animation previews': css.includes('.card-animation-mock.rise i') && css.includes('mock-card-rise'),
  'unique ui part previews': css.includes('.ui-part-mock') && css.includes('.mock-ui-tip') && css.includes('.mock-ui-banner'),
  'uiPart preview type': appJs.includes("data-preview=\"uiPart:"),
  'search dropdown z raised': css.includes('z-index: 70') && css.includes('width: min(100%, 480px)'),
  'search option shows description': appJs.includes('game-search-copy em') || appJs.includes('<em>${escapeHtml(hint'),
  'search descriptions enriched': main.includes('Omni-search returns no descriptions'),
  'discover descriptions enriched': main.includes('Discover rows carry no descriptions'),
  'layout spotlight bigger avatar': css.includes('[data-home-layout="spotlight"] .hero-avatar'),
  'update fixes kept': main.includes("'start', '/b'") && main.includes('DOWNLOAD_ATTEMPTS')
};
for (const [name, value] of Object.entries(checks)) console.log(`${name}: ${typeof value === 'boolean' ? value : value}`);
