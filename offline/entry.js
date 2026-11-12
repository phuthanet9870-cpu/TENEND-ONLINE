// Offline build: runs the authoritative game server inside the browser and talks to it
// through an in-memory socket, so the whole game is playable from one page.
globalThis.process = { env: { PVP_BOT_FILL: '6', RAID_MIN_PLAYERS: '1', GUILDWAR_MIN: '3' } };
import { Game } from '../server/game.js';
import { loadDB, saveDB, resetDB } from './db-browser.js';

loadDB();
const game = new Game();
game.start();
window.addEventListener('beforeunload', () => { game.persistAll(); saveDB(); });
window.TENEND_LOCAL = () => {
  const client = { readyState: 1, onopen: null, onmessage: null, onclose: null, send(s) { queueMicrotask(() => game.handle(sess, JSON.parse(s))); }, close() {} };
  const serverWs = { readyState: 1, send(s) { queueMicrotask(() => client.onmessage && client.onmessage({ data: s })); }, close() { location.reload(); } };
  const sess = game.connect(serverWs);
  setTimeout(() => client.onopen && client.onopen(), 0);
  return client;
};
window.TENEND_RESET = () => { resetDB(); location.reload(); };
await import('../client/js/main.js');

