// Temporary diagnostic: does GitHub honour a Range request for release assets?
const url = 'https://github.com/mozrg/Vortex/releases/download/1.0.14/Vortex.Launcher.Setup.1.0.14.exe';
const headers = { 'User-Agent': 'Vortex-Place-Launcher' };
const full = await fetch(url, { method: 'HEAD', redirect: 'follow', headers });
console.log('total size:', full.headers.get('content-length'), '| accept-ranges:', full.headers.get('accept-ranges'));

const partial = await fetch(url, { redirect: 'follow', headers: { ...headers, Range: 'bytes=40000000-' } });
console.log('range status:', partial.status, '| content-range:', partial.headers.get('content-range'), '| length:', partial.headers.get('content-length'));
const chunk = await partial.body.getReader().read();
console.log('first resumed chunk bytes:', chunk.value ? chunk.value.length : 0);
await partial.body.cancel().catch(() => {});
