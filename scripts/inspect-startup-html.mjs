// Temporary diagnostic: compares startup.html inside a packaged app with the workspace copy
// and syntax-checks the inline script.
import asar from '@electron/asar';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const [asarPath, workspaceFile = 'startup.html'] = process.argv.slice(2);

const packaged = asar.extractFile(asarPath, 'startup.html').toString('utf8');
const local = await readFile(workspaceFile, 'utf8');

console.log('identical to workspace:', packaged === local);
console.log('packaged length:', packaged.length, '| workspace length:', local.length);
if (packaged !== local) {
  const packagedLines = packaged.split(/\r?\n/);
  const localLines = local.split(/\r?\n/);
  const max = Math.max(packagedLines.length, localLines.length);
  for (let index = 0; index < max; index += 1) {
    if (packagedLines[index] !== localLines[index]) {
      console.log(`first difference at line ${index + 1}`);
      console.log('  packaged:', JSON.stringify(packagedLines[index]));
      console.log('  workspace:', JSON.stringify(localLines[index]));
      break;
    }
  }
}

const script = packaged.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) {
  console.log('no inline script found');
} else {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'vortex-splash-'));
  const scriptPath = path.join(dir, 'splash-check.mjs');
  await writeFile(scriptPath, script, 'utf8');
  try {
    await execFileAsync(process.execPath, ['--check', scriptPath]);
    console.log('inline script: syntax OK');
  } catch (error) {
    console.log('inline script: SYNTAX ERROR');
    console.log(String(error.stderr || error.message).split('\n').slice(0, 12).join('\n'));
  }
}
