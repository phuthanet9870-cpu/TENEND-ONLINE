// ===== TENEND ONLINE server entry: static file server + WebSocket game server =====
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import { Game } from './game.js';
import { loadDB, saveDB } from './db.js';

const PORT = +(process.env.PORT || 8080);
const ROOT = path.resolve('.');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

loadDB();
const game = new Game();

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/client/index.html';
  if (url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, online: game.online.size, instances: game.instances.size })); }
  // only /client and /shared are public
  if (!url.startsWith('/client/') && !url.startsWith('/shared/')) { res.writeHead(404); return res.end('not found'); }
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
wss.on('connection', (ws) => {
  const sess = game.connect(ws);
  ws.on('message', (data) => { let m; try { m = JSON.parse(data); } catch { return; } game.handle(sess, m); });
  ws.on('close', () => game.disconnect(sess));
  ws.on('error', () => {});
});

game.start();
server.listen(PORT, () => console.log(`TENEND ONLINE running at http://localhost:${PORT}`));
const shutdown = () => { console.log('saving...'); game.persistAll(); saveDB(); process.exit(0); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
