// Temporary diagnostic: spawner side. Starts the helper through `cmd /c start`, then exits
// immediately so the helper has to survive on its own.
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

const workDir = process.argv[2];
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
const marker = path.join(workDir, 'helper.log');
const script = path.join(os.tmpdir(), `vortex-helper-${randomUUID()}.ps1`);
const body = [
  `Add-Content -LiteralPath ${q(marker)} -Value 'helper started' -ErrorAction SilentlyContinue`,
  `Wait-Process -Id ${process.pid} -Timeout 60 -ErrorAction SilentlyContinue`,
  `Add-Content -LiteralPath ${q(marker)} -Value 'parent exited, helper continued' -ErrorAction SilentlyContinue`,
  `Remove-Item -LiteralPath ${q(script)} -Force -ErrorAction SilentlyContinue`
].join('\r\n');
await writeFile(script, `\ufeff${body}`, 'utf8');

const helper = spawn('cmd.exe', ['/c', 'start', '/b', '', 'powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', script], {
  detached: true,
  stdio: 'ignore',
  windowsHide: true
});
await new Promise((resolve, reject) => {
  helper.once('spawn', resolve);
  helper.once('error', reject);
});
helper.unref();
console.log('spawner: helper dispatched, exiting now as pid', process.pid);
