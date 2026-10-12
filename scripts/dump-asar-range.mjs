// Temporary diagnostic: dumps a line range of electron/main.cjs from a packaged app.asar.
import asar from '@electron/asar';

const [target, from, to] = process.argv.slice(2);
const main = asar.extractFile(target, 'electron/main.cjs').toString().split(/\r?\n/);
const start = Number(from || 1);
const end = Number(to || main.length);
for (let index = start - 1; index < Math.min(end, main.length); index += 1) {
  console.log(String(index + 1).padStart(4) + '| ' + main[index]);
}
