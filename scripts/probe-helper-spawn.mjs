// Temporary diagnostic: spawns a helper exactly like installUpdate() does and checks
// whether the helper process actually executes the script.
import { spawn } from 'node:child_process';
import { writeFile, readFile, rm, mkdtemp } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

const workDir = await mkdtemp(path.join(os.tmpdir(), 'vortex-helper-test-'));
const marker = path.join(workDir, 'helper.log');
const script = path.join(os.tmpdir(), `vortex-helper-${randomUUID()}.ps1`);
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
const body = [
  "$ErrorActionPreference = 'Continue'",
  `$log = ${q(marker)}`,
  `Add-Content -LiteralPath $log -Value ('helper started ' + (Get-Date -Format s)) -ErrorAction SilentlyContinue`,
  "Start-Sleep -Seconds 2",
  `Add-Content -LiteralPath $log -Value 'helper finished' -ErrorAction SilentlyContinue`,
  `Remove-Item -LiteralPath ${q(script)} -Force -ErrorAction SilentlyContinue`
].join('\r\n');
await writeFile(script, `\ufeff${body}`, 'utf8');
console.log('script:', script);

const helper = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', script], {
  detached: true,
  stdio: 'ignore',
  windowsHide: true
});
await new Promise((resolve, reject) => {
  helper.once('spawn', resolve);
  helper.once('error', reject);
});
helper.unref();
console.log('helper pid:', helper.pid);
await new Promise((resolve) => setTimeout(resolve, 8000));
try {
  console.log('marker content:', (await readFile(marker, 'utf8')).trim());
} catch (error) {
  console.log('helper did not write the marker:', error.code);
}
await rm(workDir, { recursive: true, force: true }).catch(() => {});
