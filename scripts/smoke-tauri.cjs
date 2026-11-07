// Smoke-test the running Tauri app over CDP: verifies the renderer actually
// painted the interface instead of leaving an empty window.
const CDP_LIST = 'http://127.0.0.1:9333/json';

async function main() {
  const targets = await (await fetch(CDP_LIST)).json();
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target found');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
    else entry.resolve(msg.result);
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  const expr = `(() => {
    const q = (sel) => document.querySelector(sel);
    return {
      title: document.title,
      bodyChildren: document.body.children.length,
      hasSidebar: !!q('.sidebar'),
      navItemCount: document.querySelectorAll('.nav-item').length,
      pageContentHtmlLength: (q('#page-content')?.innerHTML || '').length,
      activeViewText: (q('.nav-item.active')?.textContent || '').trim(),
      logoLoaded: (() => { const i = q('.brand-logo'); return i ? i.complete && i.naturalWidth > 0 : null; })(),
      desktopShimPresent: typeof window.vortexDesktop === 'object' && window.vortexDesktop !== null,
      tauriPresent: typeof window.__TAURI__ === 'object' && window.__TAURI__ !== null,
      consoleErrors: window.__smokeErrors || [],
    };
  })()`;

  const result = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: false,
  });

  console.log(JSON.stringify(result.result.value, null, 2));

  // Capture a screenshot so the result can be inspected visually.
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('node:fs');
  fs.writeFileSync(process.argv[2] || 'smoke.png', Buffer.from(shot.data, 'base64'));
  console.log('screenshot written');

  ws.close();
}

main().catch((error) => {
  console.error('SMOKE FAILED:', error.message);
  process.exit(1);
});
