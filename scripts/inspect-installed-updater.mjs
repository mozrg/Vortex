// Temporary diagnostic: prints the update-check details of the installed Vortex build.
import asar from '@electron/asar';
import path from 'node:path';

const target = process.argv[2];
if (!target) throw new Error('Pass the path to app.asar.');
const main = asar.extractFile(target, 'electron/main.cjs').toString();
const html = asar.extractFile(target, 'startup.html').toString();
const pkg = JSON.parse(asar.extractFile(target, 'package.json').toString());

const needles = ['Vortex.Launcher.Setup.', 'Vortex Launcher Setup ', 'releases?per_page', '/releases/latest', 'MAX_INSTALLER_BYTES ='];
for (const needle of needles) console.log(`${JSON.stringify(needle)} => ${main.includes(needle)}`);
for (const pattern of [/MAX_INSTALLER_BYTES = [^;]+;/, /GITHUB_REPOSITORY = [^;]+;/, /releases\?per_page=\d+/, /AbortSignal\.timeout\(\d+\)/]) {
  const match = main.match(pattern);
  console.log(`${pattern} => ${match ? match[0] : 'no match'}`);
}
const wanted = /async function downloadUpdate|async function installUpdate|async function applyUpdate|update-staging|Expand-Archive|Stop-Process|app\.relaunch|app\.exit|Start-Process|Vortex Launcher\.exe/;
const lines = main.split(/\r?\n/);
lines.forEach((line, index) => {
  if (wanted.test(line)) console.log(`SRC ${index + 1}>`, line.trim());
});
console.log('package version:', pkg.version);
console.log('startup status-list:', html.includes('status-list'), '| status-card:', html.includes('status-card'));
console.log('installer path:', path.dirname(target));
