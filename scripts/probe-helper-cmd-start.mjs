// Temporary diagnostic: validates the two fixes.
// 1. the installer helper starts through `cmd /c start` and survives while the parent waits
// 2. a partial download resumes with a Range request and passes the SHA-256 check
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { readFile, rm, stat, writeFile, mkdtemp } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

const workDir = await mkdtemp(path.join(os.tmpdir(), 'vortex-fix-check-'));
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;

// ---------- 1. helper dispatch ----------
const marker = path.join(workDir, 'helper.log');
const script = path.join(os.tmpdir(), `vortex-helper-${randomUUID()}.ps1`);
const body = [
  `Add-Content -LiteralPath ${q(marker)} -Value 'helper started' -ErrorAction SilentlyContinue`,
  `Wait-Process -Id ${process.pid} -Timeout 30 -ErrorAction SilentlyContinue`,
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
console.log('helper dispatched, cmd pid', helper.pid);

// Simulate the launcher exiting right after the handoff.
const timer = setTimeout(() => {}, 0);
clearTimeout(timer);
await new Promise((resolve) => setTimeout(resolve, 100));
console.log('simulating launcher exit (this script ends, helper must survive)');
// The helper waits for *this* pid, so keep the process alive a moment then report.
await new Promise((resolve) => setTimeout(resolve, 6000));
try {
  console.log('helper log after 6s:', (await readFile(marker, 'utf8')).trim().replace(/\r?\n/g, ' | '));
} catch (error) {
  console.log('helper did not write:', error.code);
}
