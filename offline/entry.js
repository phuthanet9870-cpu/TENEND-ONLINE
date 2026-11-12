// Offline build: runs the authoritative game server inside the browser and talks to it
// through an in-memory socket, so the whole game is playable from one page.
globalThis.process = { env: { DEV: '1', PVP_BOT_FILL: '6', RAID_MIN_PLAYERS: '1', GUILDWAR_MIN: '3' } };
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

// Tester panel (offline build only)
const bar = document.createElement('div');
bar.id = 'testbar';
bar.innerHTML = `<button id="tb-toggle" title="เครื่องมือทดสอบ">🧪 ทดสอบ</button><div id="tb-body" hidden>
  <b>เครื่องมือทดสอบ (เวอร์ชันออฟไลน์)</b>
  <div class="row"><button data-dev="lv" data-n="50">Lv 50</button><button data-dev="lv" data-n="150">Lv 150</button><button data-dev="lv" data-n="300">Lv 300</button></div>
  <div class="row"><button data-dev="gold">+1M ทอง</button><button data-dev="mats">+วัตถุดิบ</button><button data-dev="gear">ชุด Epic</button><button data-dev="runes">+รูนทุกแบบ</button></div>
  <div class="row"><button data-dev="item" data-r="legendary">Legendary</button><button data-dev="item" data-r="mythic">Mythic</button></div>
  <div class="row"><button data-dev="warp" data-m="town_aurelia">เมืองแรก</button><button data-dev="warp" data-m="aurelia_3">แมพบอสโลก</button><button data-dev="warp" data-m="ember_5">แมพ Lv 280</button></div>
  <div class="row"><button data-dev="reset" class="alt">ลบเซฟทั้งหมด</button></div>
  <small class="dim">PvP / Guild War จะเติมบอทให้หลังรอคิว 6 วินาที • Raid เข้าได้คนเดียว</small></div>`;
document.body.appendChild(bar);
document.getElementById('tb-toggle').onclick = () => { const b = document.getElementById('tb-body'); b.hidden = !b.hidden; };
bar.addEventListener('click', (e) => {
  const t = e.target.closest('[data-dev]'); if (!t) return; const S = window.G.send; const d = t.dataset;
  if (d.dev === 'reset') { if (t.dataset.armed) window.TENEND_RESET(); else { t.dataset.armed = 1; t.textContent = 'กดอีกครั้งเพื่อยืนยัน'; } return; }
  if (!window.G.char) return;
  if (d.dev === 'lv') { S({ t: 'dev', op: 'level', n: +d.n }); S({ t: 'dev', op: 'equipBest' }); }
  if (d.dev === 'gold') S({ t: 'dev', op: 'gold', n: 1000000 });
  if (d.dev === 'mats') S({ t: 'dev', op: 'mats' });
  if (d.dev === 'gear') S({ t: 'dev', op: 'equipBest' });
  if (d.dev === 'runes') S({ t: 'dev', op: 'runes', runes: Object.fromEntries(['split','pierce','chain','homing','echo','detonate','nova','fork','gravity','linger','trap','totem','minion','overcharge','rapid','charges','bloodprice','vampiric','ember','frost','storm','venom','umbral','radiant','shatter','execute','impact','barrier','haste','mark','orbitconv','delay','mirror','cascade','precision','concentrate','swarm','endure','sanctify'].map((r) => [r, 2])) });
  if (d.dev === 'item') for (const slot of ['weapon', 'amulet', 'helm', 'boots']) S({ t: 'dev', op: 'item', slot, rarity: d.r });
  if (d.dev === 'warp') S({ t: 'dev', op: 'warp', map: d.m });
});
