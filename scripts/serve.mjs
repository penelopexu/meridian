/* 本地预览 PWA：npm run serve
   Service Worker 需要 http(s)，file:// 下不生效，所以要起个静态服务器。 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'pwa');
const PORT = process.env.PORT || 5173;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png',
  '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };

if (!existsSync(ROOT)) { console.error('dist/pwa 不存在，先跑 npm run build'); process.exit(1); }

createServer((req, res) => {
  let p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream',
                       'Cache-Control': 'no-cache' });
  res.end(readFileSync(p));
}).listen(PORT, () => console.log(`\n  http://localhost:${PORT}\n`));
