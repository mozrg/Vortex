// Temporary diagnostic: measures the real download path for a GitHub release asset
// (fetch -> redirect -> stream) and stops after the first chunk.
const repo = 'mozrg/Vortex';
const version = process.argv[2] || '1.0.14';
const assetName = `Vortex.Launcher.Setup.${version}.exe`;
const url = `https://github.com/${repo}/releases/download/${version}/${assetName}`;

const started = Date.now();
console.log(`fetching ${assetName}`);
const response = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Vortex-Place-Launcher' } });
console.log('response url:', response.url);
console.log('status:', response.status, '| content-length:', response.headers.get('content-length'), '| type:', response.headers.get('content-type'));
if (!response.body) throw new Error('no body');
let received = 0;
const reader = response.body.getReader();
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  received += value.length;
  if (received >= 2 * 1024 * 1024) {
    await reader.cancel();
    break;
  }
}
console.log(`streamed ${received} bytes in ${Date.now() - started} ms`);
const speed = received / ((Date.now() - started) / 1000) / 1024 / 1024;
console.log(`approx speed: ${speed.toFixed(2)} MiB/s`);
