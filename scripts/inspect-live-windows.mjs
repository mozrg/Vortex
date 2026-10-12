// Temporary diagnostic: inspects renderer windows of a running Electron app over the CDP HTTP/WS endpoint.
const port = Number(process.argv[2] || 9223);

async function json(path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!response.ok) throw new Error(`${path} -> ${response.status}`);
  return response.json();
}

const expression = `JSON.stringify({
  url: location.href,
  readyState: document.readyState,
  bodyText: (document.body?.innerText || '').replace(/\\s+/g, ' ').slice(0, 300),
  hasBridge: typeof window.vortexStartup !== 'undefined' ? 'startup' : (typeof window.vortexDesktop !== 'undefined' ? 'desktop' : 'none')
})`;

const webSocketUrl = (process.argv[3] || '').trim();
if (webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = (error) => reject(new Error(`ws error: ${error.message || 'unknown'}`));
  });
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ws timeout')), 8000);
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.id !== 1) return;
      clearTimeout(timer);
      resolve(payload);
    };
    socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  });
  socket.close();
  console.log('ws result:', JSON.stringify(result.result?.result?.value ?? result, null, 2));
} else {
  const targets = await json('/json/list');
  console.log('targets:', targets.length);
  for (const target of targets) {
    console.log(`- [${target.type}] ${target.title} :: ${target.url}`);
    console.log(`  ws: ${target.webSocketDebuggerUrl}`);
  }
}
