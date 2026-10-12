// Temporary diagnostic: prints which release asset names each packaged build looks for.
import asar from '@electron/asar';

for (const target of process.argv.slice(2)) {
  const main = asar.extractFile(target, 'electron/main.cjs').toString();
  const pkg = JSON.parse(asar.extractFile(target, 'package.json').toString());
  const setup = main.match(/Vortex\.Launcher\.Setup\.[^`"']*/);
  const update = main.match(/Vortex\.Launcher\.Update\.[^`"']*/);
  console.log(`version ${pkg.version} | setup asset: ${setup ? setup[0] : '—'} | zip asset: ${update ? update[0] : '—'}`);
}
