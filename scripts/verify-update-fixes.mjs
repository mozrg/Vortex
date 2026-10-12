// Temporary diagnostic: verifies that a packaged build contains the update fixes.
import asar from '@electron/asar';

const [target] = process.argv.slice(2);
const main = asar.extractFile(target, 'electron/main.cjs').toString();
const html = asar.extractFile(target, 'startup.html').toString();
const pkg = JSON.parse(asar.extractFile(target, 'package.json').toString());
const checks = {
  'version': pkg.version,
  'helper launched via cmd start': main.includes("'start', '/b'"),
  'download retries': main.includes('DOWNLOAD_ATTEMPTS'),
  'resume with Range header': main.includes('bytes='),
  'stall watchdog': main.includes('DOWNLOAD_STALL_TIMEOUT_MS'),
  'skip button removed from main': !main.includes('updates:show-app'),
  'skip button removed from page': !html.includes('skip-button')
};
for (const [name, value] of Object.entries(checks)) console.log(`${name}: ${value}`);
