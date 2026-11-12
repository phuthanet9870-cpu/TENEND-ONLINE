// ===== Client bootstrap: networking, state, input (keys / click-to-move / auto), prediction =====
import { getMapLayout, moveWithCollision } from '/shared/mapgen.js';
import { HOTBAR_SIZE } from '/shared/constants.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { Auto } from './auto.js';

const G = {
  ws: null, you: null, myTeam: 'p', units: new Map(), meta: {}, npcs: [], drops: [], char: null, inst: null, obj: null, me: null, L: null,
  keys: {}, mouse: { x: 0, y: 0, wx: 0, wy: 0, l: false, r: false }, showLoot: false, connected: false,
};
window.G = G;
const send = (o) => { if (G.ws && G.ws.readyState === 1) G.ws.send(JSON.stringify(o)); };
G.send = send;
const renderer = new Renderer(document.getElementById('game'), G);
G.auto = new Auto(G, renderer);
const ui = new UI(G, send, renderer);
G.ui = ui;

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  G.ws = window.TENEND_LOCAL ? window.TENEND_LOCAL() : new WebSocket(`${proto}://${location.host}/ws`);
  G.ws.onopen = () => { G.connected = true; ui.onConnect(); };
  G.ws.onclose = () => { G.connected = false; ui.onDisconnect(); setTimeout(connect, 2000); };
  G.ws.onmessage = (ev) => onMsg(JSON.parse(ev.data));
}

function onMsg(m) {
  switch (m.t) {
    case 's': return onSnap(m);
    case 'enter': {
      G.inst = m.inst; G.you = m.you; G.units.clear(); G.meta = {}; G.drops = []; G.obj = null;
      const lay = m.inst.layout;
      G.L = lay.def ? getMapLayout(lay.key, lay.def) : getMapLayout(lay.key);
      G.npcs = m.inst.mode?.npcs || [];
      G.auto.nav.clear(); G.auto.target = null; G.auto.forced = null; G.auto.anchor = null;
      renderer.setMap(G.L);
      ui.onEnter(m.inst);
      return;
    }
    case 'char': G.char = m.c; G.myTeam = G.units.get(G.you)?.meta?.tm || G.myTeam; return ui.onChar();
    default: return ui.onMessage(m);
  }
}

function onSnap(m) {
  Object.assign(G.meta, m.m);
  const seen = new Set();
  for (const e of m.u) {
    const [id, x, y, hp, flags, face, sh] = e; seen.add(id);
    let u = G.units.get(id);
    if (!u) { u = { id, x, y, sx: x, sy: y }; G.units.set(id, u); }
    u.moving = Math.hypot(x - u.sx, y - u.sy) > 1.5;
    u.sx = x; u.sy = y; u.hp = hp; u.flags = flags; u.facing = (face * Math.PI) / 180; u.sh = sh; u.meta = G.meta[id];
    if (id === G.you) { G.myTeam = u.meta?.tm || G.myTeam; const d = Math.hypot(u.x - x, u.y - y); if (d > 70 || u.flags & (1 << 30)) { u.x = x; u.y = y; } if (!G.auto.anchor && G.auto.on) G.auto.anchor = [x, y]; }
  }
  for (const id of G.units.keys()) if (!seen.has(id)) G.units.delete(id);
  for (const f of m.fx) renderer.addFx(f);
  G.drops = m.d || [];
  G.me = m.me; G.obj = m.obj || null;
  ui.onSnap(m);
}

// ---------- input ----------
// Hotbar: row 1 = 1..0, row 2 = Shift+1..0, row 3 = Alt+1..0. R = ultimate.
const DIGIT = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6, Digit8: 7, Digit9: 8, Digit0: 9 };
const slotFor = (e) => (e.code in DIGIT ? DIGIT[e.code] + (e.altKey ? 20 : e.shiftKey ? 10 : 0) : null);
const held = new Map(); // code -> slot (auto-repeat while held)
window.addEventListener('keydown', (e) => {
  if (ui.typing()) { if (e.code === 'Escape') ui.blurChat(); return; }
  if (!G.char) return;
  if (e.altKey || e.code === 'F9' || e.code === 'Tab') e.preventDefault();
  G.keys[e.code] = true;
  const slot = slotFor(e);
  if (slot != null) { held.set(e.code, slot); castSlot(slot); return; }
  switch (e.code) {
    case 'KeyR': castSlot('u'); break;
    case 'Space': { e.preventDefault(); const [mx, my] = moveDir(); const me = G.units.get(G.you); const dir = mx || my ? [mx, my] : me ? [Math.cos(me.facing), Math.sin(me.facing)] : [1, 0]; send({ t: 'dodge', dx: dir[0], dy: dir[1] }); break; }
    case 'KeyF': send({ t: 'counter' }); break;
    case 'KeyQ': send({ t: 'potion', kind: 'hp' }); break;
    case 'KeyT': send({ t: 'potion', kind: 'mp' }); break;
    case 'KeyZ': send({ t: 'pickupAll' }); break;
    case 'KeyU': G.auto.toggle(); break;
    case 'Tab': G.showLoot = !G.showLoot; break;
    case 'KeyE': ui.interact(); break;
    case 'Enter': e.preventDefault(); ui.focusChat(); break;
    case 'Escape': if (!ui.closeTop()) { G.auto.nav.clear(); G.auto.cancelManual(); } break;
    case 'F9': ui.toggle('gm'); break;
    default: ui.hotkey(e.code);
  }
});
window.addEventListener('keyup', (e) => { G.keys[e.code] = false; held.delete(e.code); if (e.key === 'Alt') e.preventDefault(); });
window.addEventListener('blur', () => { G.keys = {}; held.clear(); G.mouse.l = G.mouse.r = false; });
const cv = document.getElementById('game');
cv.addEventListener('mousemove', (e) => { G.mouse.x = e.clientX; G.mouse.y = e.clientY; });
function unitAt(wx, wy) {
  let best = null, bd = 1e9;
  for (const u of G.units.values()) { if (u.id === G.you || u.flags & (1 << 30) || !u.meta) continue; const r = (u.meta.r || 12) + 14; const d = Math.hypot(u.x - wx, u.y - 14 - wy); if (d < r && d < bd) { bd = d; best = u; } }
  return best;
}
let lastNavClick = 0;
function clickWorld(wx, wy, isDrag) {
  const now = performance.now();
  if (isDrag && now - lastNavClick < 180) return;
  lastNavClick = now;
  if (G.auto.nav.goTo(wx, wy)) renderer.clickMark = { x: wx, y: wy, t0: renderer.t };
}
G.walkTo = (x, y) => { G.auto.cancelManual(); if (G.auto.on) G.auto.toggle(false); clickWorld(x, y); };
cv.addEventListener('mousedown', (e) => {
  if (!G.char) return;
  const [wx, wy] = renderer.s2w(e.clientX, e.clientY);
  if (e.button === 0) {
    const d = G.drops.find((d) => Math.hypot(d[1] - wx, d[2] - wy) < 18);
    if (d) { const me = G.units.get(G.you); if (me && Math.hypot(d[1] - me.x, d[2] - me.y) < 140) return send({ t: 'pickup', id: d[0] }); return clickWorld(d[1], d[2]); }
    const n = G.npcs.find((n) => Math.hypot(n.x - wx, n.y - 20 - wy) < 28);
    if (n) { const me = G.units.get(G.you); if (me && Math.hypot(n.x - me.x, n.y - me.y) < 120) return ui.openNpc(n); return clickWorld(n.x, n.y + 40); }
    const u = unitAt(wx, wy);
    if (u && u.meta.tm !== G.myTeam && u.meta.k !== 'totem') { G.auto.attack(u.id); return; }
    G.auto.cancelManual();
    G.mouse.l = true; clickWorld(wx, wy);
  }
  if (e.button === 2) G.mouse.r = true;
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) G.mouse.l = false; if (e.button === 2) G.mouse.r = false; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());

function moveDir() {
  if (ui.typing()) return [0, 0];
  let mx = 0, my = 0;
  if (G.keys.KeyW || G.keys.ArrowUp) my -= 1; if (G.keys.KeyS || G.keys.ArrowDown) my += 1;
  if (G.keys.KeyA || G.keys.ArrowLeft) mx -= 1; if (G.keys.KeyD || G.keys.ArrowRight) mx += 1;
  const l = Math.hypot(mx, my); return l ? [mx / l, my / l] : [0, 0];
}
let lastCast = 0;
function castAt(slot, x, y) { const now = performance.now(); if (now - lastCast < 60) return; lastCast = now; send({ t: 'cast', slot, x: Math.round(x), y: Math.round(y) }); }
function castSlot(slot) { castAt(slot, G.mouse.wx, G.mouse.wy); }
G.castSlot = castSlot;

let lastInput = 0, lastSent = '';
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  [G.mouse.wx, G.mouse.wy] = renderer.s2w(G.mouse.x, G.mouse.y);
  if (G.char && G.inst) {
    let [mx, my] = moveDir();
    if (mx || my) { G.auto.nav.clear(); G.auto.cancelManual(); }
    else {
      if (G.mouse.l) clickWorld(G.mouse.wx, G.mouse.wy, true);
      const a = G.auto.tick(dt, castAt, send);
      if (a) [mx, my] = a;
    }
    const sig = `${mx.toFixed(2)},${my.toFixed(2)}`;
    if (sig !== lastSent || now - lastInput > 120) { send({ t: 'input', mx, my, ax: Math.round(G.mouse.wx), ay: Math.round(G.mouse.wy) }); lastSent = sig; lastInput = now; }
    if (G.mouse.r) castSlot(1);
    for (const [, slot] of held) if (now - lastCast > 180) castSlot(slot);
    // interpolate others, predict self
    for (const u of G.units.values()) {
      if (u.id === G.you && G.L && !(u.flags & (1 << 30))) {
        const cc = u.flags & ((1 << 4) | (1 << 5));
        if ((mx || my) && !cc) { const sp = (G.char?.derived?.move || 175) * dt * (u.flags & (1 << 7) ? 0.6 : 1); [u.x, u.y] = moveWithCollision(G.L, u.x, u.y, mx * sp, my * sp, 9); u.moving = true; u.facing = Math.atan2(my, mx); }
        else u.facing = Math.atan2(G.mouse.wy - u.y, G.mouse.wx - u.x);
        u.x += (u.sx - u.x) * Math.min(1, dt * 4); u.y += (u.sy - u.y) * Math.min(1, dt * 4);
      } else { const k = Math.min(1, dt * 12); u.x += (u.sx - u.x) * k; u.y += (u.sy - u.y) * k; }
    }
  }
  renderer.draw(dt);
  ui.frame(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
connect();
export { HOTBAR_SIZE };
