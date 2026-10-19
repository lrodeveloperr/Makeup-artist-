// Minimal static file server for local previews and browser tests.
// Usage: node tools/serve.mjs [root] [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const port = +(process.argv[3] || 8130);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.bin': 'application/octet-stream', '.png': 'image/png', '.webp': 'image/webp' };

export function serve(dir = root, p = port) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(dir, url);
    if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'content-length': data.length, 'cache-control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(p, () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) serve().then(() => console.log(`serving ${root} on http://localhost:${port}`));
