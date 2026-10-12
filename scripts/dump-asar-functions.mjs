// Temporary diagnostic: prints the installed downloadUpdate/checkForUpdates code with line numbers.
import asar from '@electron/asar';

const [target, ...needles] = process.argv.slice(2);
const source = asar.extractFile(target, 'electron/main.cjs').toString().split(/\r?\n/);
const ranges = [];
source.forEach((line, index) => {
  if (/^(async )?function (downloadUpdate|installUpdate|checkForUpdates|fetchReleaseAsset|appendUpdateLog)/.test(line)) {
    ranges.push({ start: index, header: line.trim() });
  }
});
ranges.forEach((range, index) => {
  const end = index + 1 < ranges.length ? ranges[index + 1].start : source.length;
  console.log(`\n===== ${range.header} (lines ${range.start + 1}-${end}) =====`);
  for (let line = range.start; line < end; line += 1) {
    if (needles.length && !needles.some((needle) => source[line].includes(needle))) continue;
    console.log(String(line + 1).padStart(4) + '| ' + source[line]);
  }
});
