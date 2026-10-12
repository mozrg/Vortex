// Temporary diagnostic: tries several detached spawn variants and reports which ones run.
import { spawn } from 'node:child_process';
import { writeFile, readFile, mkdtemp } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

const workDir = await mkdtemp(path.join(os.tmpdir(), 'vortex-spawn-variants-'));
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;

async function makeScript(name) {
  const marker = path.join(workDir, `${name}.log`);
  const scriptPath = path.join(os.tmpdir(), `vortex-${name}-${randomUUID()}.ps1`);
  const body = [
    `Add-Content -LiteralPath ${q(marker)} -Value '${name} ran' -ErrorAction SilentlyContinue`,
    `Remove-Item -LiteralPath ${q(scriptPath)} -Force -ErrorAction SilentlyContinue`
  ].join('\r\n');
  await writeFile(scriptPath, `\ufeff${body}`, 'utf8');
  return { marker, scriptPath };
}

async function runVariant(name, build) {
  const { marker, scriptPath } = await makeScript(name);
  try {
    const child = build(scriptPath);
    await new Promise((resolve) => child.once('spawn', resolve));
    child.unref();
  } catch (error) {
    console.log(`${name}: spawn threw ${error.message}`);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 7000));
  try {
    console.log(`${name}: OK -> ${(await readFile(marker, 'utf8')).trim()}`);
  } catch {
    console.log(`${name}: NOT executed`);
  }
}

const powershell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const args = (scriptPath) => ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptPath];

await runVariant('A_fullpath_powershell', (scriptPath) => spawn(powershell, args(scriptPath), { detached: true, stdio: 'ignore', windowsHide: true }));
await runVariant('B_short_powershell', (scriptPath) => spawn('powershell.exe', args(scriptPath), { detached: true, stdio: 'ignore', windowsHide: true }));
await runVariant('C_powershell_no_detached', (scriptPath) => spawn(powershell, args(scriptPath), { stdio: 'ignore', windowsHide: true }));
await runVariant('D_cmd_start', (scriptPath) => spawn('cmd.exe', ['/c', 'start', '/b', '', powershell, ...args(scriptPath)], { detached: true, stdio: 'ignore', windowsHide: true }));
