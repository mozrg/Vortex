// Temporary diagnostic: hints at which update mechanism a packaged build contains.
import asar from '@electron/asar';

for (const target of process.argv.slice(2)) {
  const main = asar.extractFile(target, 'electron/main.cjs').toString();
  const pkg = JSON.parse(asar.extractFile(target, 'package.json').toString());
  const markers = {
    'exe handoff (installUpdate)': /async function installUpdate/.test(main),
    'zip staging (finishUpdate)': /async function finishUpdate/.test(main),
    'zip apply (applyStagedUpdate)': /async function applyStagedUpdate/.test(main),
    'robocopy helper': main.includes('robocopy'),
    'setup /S handoff': main.includes("'/S'")
  };
  console.log(`--- ${pkg.version}: ${target}`);
  for (const [name, value] of Object.entries(markers)) console.log(`    ${name}: ${value}`);
}
