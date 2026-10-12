// Temporary diagnostic: verifies that a partial installer download resumes with a Range
// request and that the resumed file passes its published SHA-256.
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { readFile, rm, stat, mkdtemp } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import os from 'node:os';
import path from 'node:path';

const url = 'https://github.com/mozrg/Vortex/releases/download/1.0.14/Vortex.Launcher.Setup.1.0.14.exe';
const shaUrl = `${url}.sha256`;
const expectedHash = (await (await fetch(shaUrl, { headers: { 'User-Agent': 'Vortex-Place-Launcher' } })).text()).trim().split(/\s+/)[0];
const expectedSize = Number((await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': 'Vortex-Place-Launcher' } })).headers.get('content-length'));
console.log(`expected: ${expectedSize} bytes, sha256 ${expectedHash.slice(0, 12)}…`);

const workDir = await mkdtemp(path.join(os.tmpdir(), 'vortex-resume-'));
const partial = path.join(workDir, 'installer.partial');

async function fetchChunk(rangeHeader) {
  const response = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Vortex-Place-Launcher', ...(rangeHeader ? { Range: rangeHeader } : {}) } });
  return response;
}

// First attempt: take only the first 40 MB, then stop as if the connection died.
const first = await fetchChunk(null);
const reader = first.body.getReader();
const writer = createWriteStream(partial, { flags: 'w' });
let received = 0;
const limit = 40 * 1024 * 1024;
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  const slice = received + value.length > limit ? value.subarray(0, limit - received) : value;
  writer.write(Buffer.from(slice));
  received += slice.length;
  if (received >= limit) break;
}
await reader.cancel().catch(() => {});
await new Promise((resolve) => writer.end(resolve));
console.log(`first attempt stopped at ${received} bytes (simulated stall)`);

// Second attempt: resume from the last byte, exactly like the launcher now does.
const sizeOnDisk = (await stat(partial)).size;
const resumed = await fetchChunk(`bytes=${sizeOnDisk}-`);
console.log(`resume response status: ${resumed.status} (206 means partial content)`);
const hash = createHash('sha256');
for await (const chunk of (await import('node:fs')).createReadStream(partial)) hash.update(chunk);
let total = sizeOnDisk;
await pipeline(Readable.fromWeb(resumed.body), async function* (source) {
  for await (const chunk of source) {
    total += chunk.length;
    hash.update(chunk);
    yield chunk;
  }
}, createWriteStream(partial, { flags: 'a' }));
const digest = hash.digest('hex');
console.log(`final: ${total} bytes, sha256 ${digest.slice(0, 12)}…`);
console.log(`size matches: ${total === expectedSize} | hash matches: ${digest === expectedHash}`);
await rm(workDir, { recursive: true, force: true }).catch(() => {});
