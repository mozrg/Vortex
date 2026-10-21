// Vortex notification console — local only.
// Run with: node tools/notify-console.cjs
// Then open http://127.0.0.1:8777 in your browser.
//
// The token is entered in the page and kept in that browser's localStorage.
// It is never written to disk and never leaves this machine except for
// api.github.com requests.
//
// Requires: the gist id, entered in the page, and a classic PAT with the
// "gist" scope.

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const PORT = 8777;
const PAGE = path.join(__dirname, 'notify-console.html');

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url !== '/' && url !== '/index.html') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  fs.readFile(PAGE, (error, data) => {
    if (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('notify-console.html is missing next to this script');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Vortex notification console: http://127.0.0.1:${PORT}`);
  console.log('Close this window to stop the console.');
});
