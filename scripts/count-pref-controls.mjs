// Temporary diagnostic: counts how many times each preference control appears and in which function.
import asar from '@electron/asar';

const [target] = process.argv.slice(2);
const js = asar.extractFile(target, 'app.js').toString();
const lines = js.split(/\r?\n/);
let currentFunction = '(top)';
const counts = new Map();
lines.forEach((line) => {
  const fn = line.match(/^function (\w+)/);
  if (fn) currentFunction = fn[1];
  for (const match of line.matchAll(/data-pref="([\w]+)"/g)) {
    const key = `${match[1]} in ${currentFunction}`;
    counts.set(key, (counts.get(key) || 0) + (line.match(new RegExp(`data-pref="${match[1]}"`, 'g')) || []).length);
  }
});
for (const [key, value] of [...counts.entries()].sort()) console.log(`${key}: ${value}`);
