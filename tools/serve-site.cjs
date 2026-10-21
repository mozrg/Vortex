// Local preview server for the site, including admin.html.
// Run: node tools/serve-site.cjs
// Open: http://127.0.0.1:8777/admin.html
//
// This only exists so the announcement console can be tested before the site is
// published. The token is typed into the page and never touches this process.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 8777;
const ROOT = path.join(__dirname, '..', 'site');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.join(ROOT, relative);

  // Never serve anything outside the site folder.
  if (!file.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('forbidden');
    return;
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Site preview:  http://127.0.0.1:${PORT}`);
  console.log(`Admin console: http://127.0.0.1:${PORT}/admin.html`);
  console.log('Close this window to stop.');
});
