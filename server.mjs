import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const dataDir = path.join(root, 'data');
const configDir = path.join(root, 'config');
const port = Number(process.env.PORT || 4173);

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'
};

async function serveFile(res, file) {
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/latest' || url.pathname === '/api/latest.json') return serveFile(res, path.join(dataDir, 'latest.json'));
  if (url.pathname === '/api/projects') return serveFile(res, path.join(configDir, 'projects.json'));
  if (url.pathname === '/api/benchmarks' || url.pathname === '/api/benchmarks.json') return serveFile(res, path.join(configDir, 'benchmarks.json'));
  if (url.pathname.startsWith('/screenshots/')) return serveFile(res, path.join(publicDir, url.pathname));
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const normalized = path.normalize(requested).replace(/^\.\.(\/|\\|$)+/, '');
  return serveFile(res, path.join(publicDir, normalized));
});

server.listen(port, () => console.log(`Archic Benchmark → http://localhost:${port}`));
