// Temporary diagnostic: reproduces the exact fetchReleaseAsset path used by the launcher
// with timing around every awaited step.
const url = 'https://github.com/mozrg/Vortex/releases/download/1.0.14/Vortex.Launcher.Setup.1.0.14.exe';
const log = (message) => console.log(`[${((Date.now() - t0) / 1000).toFixed(2)}s] ${message}`);
const t0 = Date.now();

log('building signals');
const downloadAbort = new AbortController();
const stallTimer = setTimeout(() => downloadAbort.abort(new Error('stalled')), 8 * 60 * 1000);
const timeoutSignal = AbortSignal.timeout(10 * 60 * 1000);
log(`AbortSignal.any available: ${typeof AbortSignal.any}`);
let combined;
try {
  combined = AbortSignal.any([downloadAbort.signal, timeoutSignal]);
  log('combined signal created');
} catch (error) {
  log(`AbortSignal.any threw: ${error.message}`);
  combined = timeoutSignal;
}

log('calling fetch');
try {
  const response = await fetch(url, { signal: combined, redirect: 'follow' });
  log(`fetch returned: status ${response.status} url host ${new URL(response.url).hostname}`);
  log(`body is stream: ${Boolean(response.body)}`);
  let received = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received >= 5 * 1024 * 1024) break;
  }
  log(`read ${received} bytes`);
  await reader.cancel().catch(() => {});
} catch (error) {
  log(`fetch/stream threw after: ${error.name}: ${error.message}`);
} finally {
  clearTimeout(stallTimer);
}
log('done');
