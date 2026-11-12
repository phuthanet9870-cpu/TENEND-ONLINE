// ===== PXFX manager + skill choreography =====
// Renders all skill VFX into two half-resolution pixel buffers (behind / in front of characters) aligned to the
// camera, scaled up 2x with crisp pixels. Every one of the 1,000 skills gets: a choreography matching its mechanic
// (136 mechanics), its own 8-step palette (element + class + per-skill hue), its own seed, a class accent, and
// for spells/ultimates its emblem — so no two skills look the same.
import { Buf, Pen, Rng, ramp, hex, mix, WHITE, TAU, K, Parts } from './core.js';
import { FX, drawProjectile, SY } from './effects.js';
import { SKILL_LIST } from '/shared/skills.js';
import { SIG_BY_ID } from '/shared/signatures.js';
import { recipeOf } from '../skillfx.js';

const FIRE = ['#ffffff', '#fff3a6', '#ffe26b', '#ffc23d', '#ff8a2a', '#f2561d', '#c9281f', '#8a1f17', '#4a1712'];
const CRYS = {
  ice: ['#151a3d', '#212f6b', '#2c58aa', '#3a8bd8', '#62c8f4', '#a6ecff', '#dcfbff', '#ffffff'],
  rock: ['#1a1410', '#2e241c', '#4a3a2c', '#6a5440', '#8a7258', '#a89070', '#c8b498', '#e8dcc8'],
  bone: ['#2a2018', '#4a3e30', '#7a6a58', '#a8987e', '#c8bca0', '#e0d8c0', '#f4eedc', '#ffffff'],
  shadow: ['#08040e', '#140a24', '#24123e', '#3a1e62', '#5a3090', '#8a5ad8', '#c0a0ff', '#f0e0ff'],
  holy: ['#3a2408', '#6a4210', '#a06a18', '#d09a30', '#f0c850', '#ffe488', '#fff4c8', '#ffffff'],
};
const crysOf = (rc) => { const k = rc.el === 'ice' ? 'ice' : rc.el === 'holy' ? 'holy' : rc.el === 'shadow' ? 'shadow' : rc.cls === 'necromancer' ? 'bone' : rc.el === 'physical' ? 'rock' : null; return k ? ramp(CRYS[k], 8) : null; };
const cache = new Map();
function look(n) {
  let L = cache.get(n); if (L) return L;
  const rc = recipeOf(n), d = SKILL_LIST[n]; if (!rc || !d) return null;
  const P = ramp(['#0a0710', rc.pal[4], rc.pal[3], rc.pal[2], rc.pal[1], rc.pal[0], '#ffffff'], 8);
  const F = rc.el === 'fire' ? ramp(FIRE.map((c, i) => (i > 1 && i < 7 ? mix(hex(c), hex(rc.pal[2]), 0.18) : c)), 9) : [WHITE, ...P.slice().reverse().slice(0, 8)];
  const CR = crysOf(rc) || P;
  L = { rc, d, sig: d.sig, fam: SIG_BY_ID[d.sig]?.fam || 'spell', P, F, CR, seed: n * 7919 + 13 };
  cache.set(n, L); return L;
}

export class PXFX {
  constructor() { this.back = new Buf(); this.front = new Buf(); this.pb = new Pen(this.back); this.pf = new Pen(this.front); this.list = []; this.projs = []; this.hitBudget = 0; this.trails = new Parts(new Rng(5), { fire: ramp(FIRE, 9) }); }
  spawn(name, L, wx, wy, o = {}, delay = 0) {
    const fn = FX[name]; if (!fn) return;
    const e = fn({ P: L.P, F: L.F, CR: L.CR, el: L.rc.el, rng: new Rng(L.seed + this.list.length * 31 + Math.floor(wx + wy)), ...o });
    e.wx = wx; e.wy = wy; e.delay = delay; this.list.push(e); if (this.list.length > 56) this.list.shift();
  }
  frame(dt, cam, W, H) {
    const w2 = Math.ceil(W / 2) + 2, h2 = Math.ceil(H / 2) + 2; this.back.size(w2, h2); this.front.size(w2, h2); this.back.clear(); this.front.clear();
    this.ox = Math.floor((cam.x - W / 2) / 2); this.oy = Math.floor((cam.y - H / 2) / 2); this.cam = cam; this.W = W; this.H = H;
    this.hitBudget = Math.min(8, this.hitBudget + dt * 30);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i]; if (e.delay > 0) { e.delay -= dt; continue; }
      e.update(dt); if (e.done()) { this.list.splice(i, 1); continue; }
      const x = e.wx / 2 - this.ox, y = e.wy / 2 - this.oy; if (x < -150 || y < -150 || x > w2 + 150 || y > h2 + 200) continue;
      this.pb.place(x, y); this.pf.place(x, y); e.back(this.pb); e.front(this.pf);
    }
    this.trails.update(dt); this.pf.place(-this.ox, -this.oy); this.trails.draw(this.pf);
    for (const q of this.projs) { this.pf.place(0, 0); drawProjectile(this.pf, q.kind, q.L.P, q.L.F, q.x / 2 - this.ox, q.y / 2 - this.oy - 6, q.vx, q.vy, q.t, q.size, q.L.rc.projEmb); }
    this.projs.length = 0;
  }
  blit(ctx, buf) { if (!buf.composite()) return; const sx = this.ox * 2 - this.cam.x + this.W / 2, sy = this.oy * 2 - this.cam.y + this.H / 2; ctx.imageSmoothingEnabled = false; ctx.drawImage(buf.cv, Math.round(sx), Math.round(sy), buf.w * 2, buf.h * 2); }
  drawBack(ctx) { this.blit(ctx, this.back); }
  drawFront(ctx) { this.blit(ctx, this.front); }
  has(n) { return !!look(n); }

  // ---------- skill events (world coordinates) ----------
  cast(n, x, y, ang) {
    const L = look(n); if (!L) return; const { fam, rc } = L;
    if (['spell', 'control', 'heal', 'summon'].includes(fam) || rc.ult) this.spawn('circle', L, x, y, { r: rc.ult ? 44 : 18, sides: rc.sides, step: rc.step, rings: rc.rings, spin: rc.spin, dur: rc.ult ? 1.4 : 0.8 });
    if (fam === 'shot' && !['arrowstorm', 'rainarrow'].includes(L.sig)) this.spawn(rc.cls === 'gunslinger' ? 'muzzle' : 'hit', L, x, y, { ang, big: 0 });
    if (rc.ult) this.spawn('stamp', L, x, y - 30, { emb: rc.emb, scale: 2 });
  }
  impact(n, f) {
    const L = look(n); if (!L) return;
    const r = Math.max(14, Math.min(150, (f.r || f.len || 60) / 2)) * (L.rc.ult ? 1.25 : 1), a = f.ang || 0, len = (f.len || f.r || 100) / 2;
    const list = choreo(L, r, a, len, f);
    for (const [name, o, dx = 0, dy = 0, delay = 0] of list) this.spawn(name, L, f.x + dx * 2, f.y + dy * 2, o, delay);
    if (f.minor) return;
    const acc = ACCENT[L.rc.cls]; if (acc && !['buff'].includes(L.fam)) this.spawn(acc[0], L, f.x, f.y, acc[1](r));
    if (['spell', 'control', 'heal', 'summon'].includes(L.fam) || L.rc.ult) this.spawn('stamp', L, f.x, f.y, { emb: L.rc.emb, scale: L.rc.ult ? 3 : 1 });
  }
  buff(n, x, y) { const L = look(n); if (!L) return; const list = BUFF[L.sig]?.(L) || [['aura', { kind: 'motes' }]]; for (const [name, o, delay = 0] of list) this.spawn(name, L, x, y, o, delay); this.spawn('stamp', L, x, y - 20, { emb: L.rc.emb }); }
  dash(n, x1, y1, x2, y2) { const L = look(n); if (!L) return; this.spawn('dash', L, x2, y2, { x0: (x1 - x2) / 2, y0: (y1 - y2) / 2 }); if (L.sig === 'blink' || L.sig === 'shadowstep') { this.spawn('shadow', L, x1, y1, { r: 14, tendrils: 3 }); this.spawn('circle', L, x2, y2, { r: 16, sides: L.rc.sides, dur: 0.6 }); } }
  beam(n, x1, y1, x2, y2, w) { const L = look(n); if (!L) return; if (L.sig === 'thrust' || L.sig === 'pierceshot') this.spawn('thrust', L, x1, y1 + 24, { ang: Math.atan2(y2 - y1, x2 - x1), len: Math.hypot(x2 - x1, y2 - y1) / 2 }); else this.spawn('beam', L, x1, y1, { x1: (x2 - x1) / 2, y1: (y2 - y1) / 2, w: Math.max(3, (w || 20) / 6) }); }
  hit(n, x, y, crit) { const L = look(n); if (!L || this.hitBudget < 1) return; this.hitBudget -= 1; this.spawn('hit', L, x, y + 24, { big: crit ? 1 : 0 }); }
  field(n, f, dt) {
    const L = look(n); if (!L) return; f._px = (f._px || 0) - dt; if (f._px > 0) return; f._px = 0.45;
    const r = Math.max(14, (f.r || f.len || 60) / 2), a = Math.random() * TAU, d = r * Math.sqrt(Math.random()); let x = f.x + Math.cos(a) * d * 2, y = f.y + Math.sin(a) * d * SY * 2;
    if (f.shape === 'line') { const k = Math.random() - 0.5, Ln = f.len || 100; x = f.x + Math.cos(f.ang || 0) * Ln * (k + 0.5); y = f.y + Math.sin(f.ang || 0) * Ln * (k + 0.5); }
    const FLD = { firewall: ['pillar', { h: 40, w: 4, fire: L.rc.el === 'fire' }], blizzard: ['rain', { n: 6, r: r * 0.8, kind: 'drop' }], stormgust: ['funnel', { h: 60, r: 14, dur: 0.9 }], thunderstorm: ['strike', {}], vermilion: ['strike', {}], static: ['arcs', { pts: [[-10, -4], [8, -10], [20, -2]] }], acid: ['rain', { n: 5, r: r * 0.8, kind: 'drop' }], quagmire: ['cloud', { r: 10, dur: 1, bubbles: 1 }], sanctuary: ['heal', { r: 12 }], healtotem: ['heal', { r: 12 }], gravity: ['circle', { r: 14, dur: 0.6 }], smoke: ['cloud', { r: 16, dur: 1.4 }], tornado: ['funnel', { h: 70, r: 18, dur: 0.9 }], cyclone: ['funnel', { h: 50, r: 14, dur: 0.8 }] };
    const s = FLD[L.sig] || [L.rc.el === 'fire' ? 'pillar' : 'souls', L.rc.el === 'fire' ? { h: 24, w: 3, fire: true } : { r: 10 }];
    this.spawn(s[0], L, x, y, s[1]);
  }
  /** draw a projectile this frame (called by the renderer for every live skill projectile) */
  proj(n, x, y, vx, vy, t, r) {
    const L = look(n); if (!L) return false;
    const kind = PROJ[L.sig] || (L.fam === 'shot' ? (L.rc.cls === 'gunslinger' ? 'bullet' : 'arrow') : L.rc.el === 'fire' ? 'fire' : L.rc.projSpin === false ? 'glyph' : 'orb');
    this.projs.push({ L, kind, x, y, vx, vy, t, size: Math.max(2, Math.min(5, (r || 6) / 2)) * (L.rc.ult ? 1.4 : 1) });
    const tk = { fire: K.FIRE, lance: K.FLAKE, skull: K.WISP, plasma: K.SPARK, star: K.STAR, arrow: null, bullet: null }[kind] ?? K.MOTE;
    if (tk != null && Math.random() < 0.7) this.trails.spawn(tk, x / 2 + (Math.random() - 0.5) * 2, y / 2 - 6, -vx * 0.04, -vy * 0.04 - 4, tk === K.FIRE ? 0.3 : 0.4, tk === K.FIRE ? 0 : L.P[6], tk === K.FIRE ? 2 : 1);
    return true;
  }
}
const PROJ = { fireball: 'fire', jupitel: 'plasma', chargedshot: 'plasma', bolts: 'plasma', soulstrike: 'skull', napalm: 'skull', missiles: 'star', icespear: 'lance', frostbolt: 'lance', tracer: 'bullet', sniper: 'bullet', explosive: 'fire', cluster: 'fire' };
const ACCENT = {
  warrior: ['hit', () => ({ big: 1 })], paladin: ['circle', (r) => ({ r: Math.min(30, r * 0.5), sides: 4, step: 1, rings: 1, dur: 0.7 })], ranger: ['aura', () => ({ kind: 'leaf', r: 8 })],
  assassin: ['shadow', (r) => ({ r: Math.min(24, r * 0.5), tendrils: 3 })], arcanist: ['circle', (r) => ({ r: Math.min(34, r * 0.6), sides: 6, step: 2, rings: 2, dur: 0.8 })], necromancer: ['souls', () => ({ r: 12 })],
  cleric: ['beamDown', () => ({ w: 3 })], shaman: ['vines', () => ({ r: 12, n: 4 })], gunslinger: ['cloud', () => ({ r: 10, dur: 0.9 })], monk: ['shout', () => ({})],
};
// impact choreography per mechanic: returns [[effect, opts, dxArt, dyArt, delay], ...]
function choreo(L, r, a, len, f) {
  const el = L.rc.el, fire = el === 'fire', c = Math.cos(a), s = Math.sin(a), fx = c * r * 0.6, fy = s * r * 0.6 * SY;
  const arc = (a0, a1, rr, w, t0 = 0, sy = 0.55, y = -12) => ({ a0, a1, r: rr, w, t0, sy, y });
  const boom = (rr, dx = 0, dy = 0, d = 0) => (fire ? ['explode', { r: rr }, dx, dy, d] : el === 'ice' ? ['crystals', { r: rr }, dx, dy, d] : el === 'lightning' ? ['strike', {}, dx, dy, d] : el === 'shadow' ? ['shadow', { r: rr }, dx, dy, d] : el === 'holy' ? ['beamDown', { w: 6 }, dx, dy, d] : el === 'poison' ? ['cloud', { r: rr, bubbles: 1 }, dx, dy, d] : el === 'arcane' ? ['circle', { r: rr, sides: L.rc.sides, dur: 0.9 }, dx, dy, d] : ['slam', { r: rr }, dx, dy, d]);
  switch (L.sig) {
    case 'bash': return [['slash', { arcs: [arc(-2.6, -0.4, r * 0.55, 8, 0, 1, -16)] }, fx, fy], ['slam', { r: r * 0.6, rays: 6 }, fx, fy, 0.07]];
    case 'double': return [['slash', { arcs: [arc(a - 1.2, a + 1.2, r * 0.7, 7), arc(a + 1.3, a - 1.1, r * 0.75, 6, 0.15)] }]];
    case 'triple': return [['slash', { arcs: [arc(a - 1.2, a + 1.2, r * 0.7, 7), arc(a + 1.2, a - 1.2, r * 0.7, 6, 0.18), arc(a - 1.6, a + 1.6, r * 0.85, 9, 0.36)] }], ['slam', { r: r * 0.5, rays: 4 }, fx, fy, 0.38]];
    case 'uppercut': return [['slash', { arcs: [arc(1.9, -1.4, r * 0.5, 8, 0, 1, -10)] }, fx, fy], ['slam', { r: r * 0.35, rays: 3 }, fx, fy], ['hit', { big: 1 }, fx, fy - 20, 0.08]];
    case 'thrust': case 'lunge': return [['thrust', { ang: a, len: len || r }], ['hit', {}, c * (len || r), s * (len || r) * SY, 0.06]];
    case 'sonic': return [...Array.from({ length: 8 }, (_, i) => ['slash', { arcs: [arc(a + (i % 2 ? 1 : -1) * 1.1 + i * 0.4, a - (i % 2 ? 1 : -1) * 1.1 + i * 0.4, r * (0.35 + (i % 3) * 0.08), 5, 0)] }, fx * 0.5, fy * 0.5, i * 0.07]), ['hit', { big: 1 }, fx, fy, 0.6]];
    case 'execute': return [['slash', { arcs: [arc(-2.8, -0.3, r * 0.7, 11, 0, 1, -18)] }, fx, fy], ['slam', { r: r * 0.7, rays: 8 }, fx, fy, 0.08], ['blood', {}, fx, fy, 0.08]];
    case 'sunder': return [['slash', { arcs: [arc(-2.4, -0.6, r * 0.5, 8, 0, 1, -14)] }, fx, fy], ['slam', { r: r * 0.5, rays: 5, el: 'physical' }, fx, fy, 0.06], ['crystals', { r: r * 0.3, CR: ramp(['#2a2a32', '#5a5a68', '#8a8a98', '#d8d8e0'], 8), hold: 0.3, frost: false, rings: [[0.3, 1, 4, 3, 6]] }, fx, fy, 0.06]];
    case 'rend': return [0, 1, 2].map((k) => ['slash', { arcs: [arc(a - 0.8, a + 0.5, r * (0.55 + k * 0.08), 3, k * 0.04)] }, -s * (k - 1) * 4, c * (k - 1) * 4]).concat([['blood', {}, fx, fy, 0.1]]);
    case 'backstab': return [['shadow', { r: r * 0.4, tendrils: 3 }, fx, fy], ['thrust', { ang: a, len: r * 0.7 }], ['blood', {}, fx, fy, 0.08]];
    case 'riposte': return [['hit', { big: 1 }], ['dome', { r: 14 }], ['orbs', { n: 3, r: 14, dur: 0.8 }]];
    case 'silence': return [['slash', { arcs: [arc(a - 1, a + 1, r * 0.5, 6)] }], ['shout', {}, fx, fy, 0.05], ['sigil', { r: 14, emb: 'mask', sides: 4 }, fx, fy, 0.1]];
    case 'crescent': return [['slash', { arcs: [arc(a - 1.6, a + 1.6, r * 0.95, 9), arc(a - 1.3, a + 1.3, r * 1.15, 4, 0.1)] }]];
    case 'asura': return [['beamDown', { w: 16 }, fx, fy], ['slam', { r: r * 1.4, rays: 11 }, fx, fy], ['explode', { r: r * 0.8 }, fx, fy, 0.05], ['crystals', { r: r * 0.6, CR: L.CR, hold: 0.8 }, fx, fy, 0.1]];
    case 'hook': case 'grapple': return [['hit', {}], ['slam', { r: 14, rays: 3 }]];
    case 'cleave': return [['slash', { arcs: [arc(a - 1.5, a + 1.5, r * 0.95, 10)] }], ['slam', { r: r * 0.4, rays: 4, dirA: a, spread: 1.4 }, fx, fy, 0.06]];
    case 'whirl': return [['whirl', { r: r * 0.85 }], ['slam', { r: r * 0.5, rays: 6 }, 0, 0, 0.1]];
    case 'magnum': return [['explode', { r: r * 0.8 }], ['slam', { r: r * 1.1, rays: 10 }], ['pillar', { h: 60, w: 8, fire }, 0, 0, 0.05]];
    case 'shockwave': case 'bowling': return [['slash', { arcs: [arc(a - 1.2, a + 1.2, r * 0.7, 8)] }], ['slam', { r: r, rays: 5, dirA: a, spread: 1.2 }, fx, fy, 0.05]];
    case 'fissure': return [['spikeLine', { ang: a, len, CR: L.CR, hMul: 0.9 }], ['slam', { r: 16, rays: 4 }]];
    case 'splitter': return [['spikeLine', { ang: a, len, CR: L.CR, hMul: 1.5 }], ['slam', { r: r * 0.6, rays: 7 }, c * len, s * len * SY, 0.4], boom(r * 0.5, c * len, s * len * SY, 0.4)];
    case 'cyclone': return [['funnel', { h: 80, r: r * 0.5, dur: 1 }], ['whirl', { r: r * 0.8 }]];
    case 'tremor': return [0, 1, 2].map((k) => ['slam', { r: r * 0.8, rays: 6 }, (k - 1) * r * 0.3, ((k * 7) % 3 - 1) * r * 0.15, k * 0.22]);
    case 'reap': return [['slash', { arcs: [arc(a - 2.2, a + 2.2, r, 8)] }], ['souls', { r: r * 0.6 }, fx, fy, 0.1]];
    case 'pillarslam': return [['crystals', { r: r * 0.7, CR: L.CR, rings: [[0.5, 0.8, 6, 22, 32]], hold: 1.1, frost: false }], ['slam', { r: r * 1.1, rays: 8 }]];
    case 'vortexslash': return [['whirl', { r: r * 0.9 }], ['hole', { r: 10 }, 0, 0, 0.25]];
    case 'pierceshot': case 'multishot': case 'ricochet': case 'splitshot': case 'seeker': case 'doubleshot': case 'boomerang': case 'fan': return [['hit', { big: L.sig === 'ricochet' ? 1 : 0 }]];
    case 'arrowstorm': return [['rain', { n: 18, r }]];
    case 'rainarrow': return [['rain', { n: 28, r }]];
    case 'sniper': return [['hit', { big: 1 }], ['slam', { r: 18, rays: 4 }]];
    case 'cluster': return [0, 1, 2, 3, 4].map((k) => ['explode', { r: 18 }, Math.cos(k * 1.3) * r * 0.5, Math.sin(k * 1.3) * r * 0.25, k * 0.08]);
    case 'net': return [['net', { r: Math.max(16, r * 0.5) }]];
    case 'timebomb': return [['clock', { r: 16, dir: 1 }], ['explode', { r }, 0, 0, 1]];
    case 'wave': return [['slash', { arcs: [arc(a - 1.2, a + 1.2, r * 0.5, 6)] }], ['shout', { dir: c >= 0 ? 1 : -1 }]];
    case 'explosive': return [['explode', { r: Math.max(30, r) }]];
    case 'tracer': return [['hit', {}], ['sigil', { r: 10, emb: 'eye', sides: 4 }]];
    case 'chargedshot': return [['hit', { big: 1 }], ['slam', { r: r * 0.6, rays: 6 }], ['shout', {}]];
    case 'fireball': return [boom(r)];
    case 'firewall': return Array.from({ length: 7 }, (_, i) => ['pillar', { h: 46, w: 5, fire }, c * (i / 6 - 0.5) * len, s * (i / 6 - 0.5) * len * SY, i * 0.03]);
    case 'firepillar': return [['pillar', { h: 130, w: 10, fire }], ['explode', { r: r * 0.5 }]];
    case 'frostnova': case 'frostring': case 'freezetrap': return [['crystals', { r, CR: el === 'ice' ? L.CR : L.CR }]];
    case 'blizzard': return [['crystals', { r: r * 0.8, rings: [[0.2, 1, 9, 6, 14]], hold: 0.6 }], ['rain', { n: 20, r, kind: 'drop' }]];
    case 'icespear': case 'frostbolt': return [['crystals', { r: Math.min(26, r * 0.6), rings: [[0.1, 0.5, 4, 10, 18]], hold: 0.8 }]];
    case 'earthspike': return f.shape === 'line' ? [['spikeLine', { ang: a, len, CR: L.CR }]] : [['crystals', { r: r * 0.8, CR: L.CR, rings: [[0.1, 0.9, 9, 14, 26]], frost: false }]];
    case 'heavensdrive': return [['crystals', { r, CR: L.CR, rings: [[0.2, 0.35, 5, 18, 26], [0.5, 0.65, 8, 14, 20], [0.8, 1, 11, 8, 14]], frost: false }], ['slam', { r: r * 1.1, rays: 9 }]];
    case 'bolts': return [['strike', {}]];
    case 'thunderstorm': return [['strike', { n: 6, r: r * 0.8, gap: 0.12 }]];
    case 'vermilion': return [['strike', { n: 12, r, gap: 0.07 }], ['circle', { r, sides: L.rc.sides, dur: 1.4 }]];
    case 'chainl': return [['hit', {}], ['arcs', { pts: [[0, -10], [Math.cos(a) * 20, -14], [Math.cos(a) * 34, -8]] }]];
    case 'jupitel': return [['arcs', { pts: [[0, -10], [16, -20], [-14, -6], [10, 2]] }], ['shout', {}], ['hit', { big: 1 }]];
    case 'static': return [['arcs', { pts: [[-r * 0.6, 0], [0, -8], [r * 0.6, 0]] }], ['circle', { r, sides: 6, dur: 0.8 }]];
    case 'stormgust': return [['funnel', { h: 110, r: r * 0.6, dur: 1.6, dustC: L.P[6], debrisC: ramp(CRYS.ice, 4) }], ['crystals', { r, rings: [[0.4, 1, 8, 6, 12]] }]];
    case 'meteorstorm': return [['meteors', { n: L.rc.ult ? 7 : 4, r }]];
    case 'soulstrike': return [['souls', { r: 12 }], ['hit', {}]];
    case 'napalm': return [['shadow', { r: r * 0.6 }], ['shout', {}]];
    case 'gravity': return [['circle', { r, sides: L.rc.sides, dur: 1.4, spin: 0.4 }], ['slam', { r: r * 0.9, rays: 8 }]];
    case 'blackhole': return [['hole', { r: Math.min(24, r * 0.35) }], ['shadow', { r: r * 0.8, tendrils: 5 }]];
    case 'tornado': return [['funnel', { h: 110, r: r * 0.5, dur: 1.6 }]];
    case 'missiles': return [['hit', {}], ['orbs', { n: 3, r: 10, dur: 0.5 }]];
    case 'breath': return [['breath', { ang: a, len: len || r, arc: ((f.arc || 70) * Math.PI) / 180, fire }]];
    case 'prism': return [['beam', { x1: c * len, y1: s * len * SY - 12, w: 4 }]];
    case 'acid': return [['cloud', { r, bubbles: 1, dur: 2.4 }], ['rain', { n: 14, r, kind: 'drop' }]];
    case 'holylight': return [['beamDown', { w: 8 }]];
    case 'exorcism': return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([i, j], k) => ['beamDown', { w: 7 }, i * r * 0.45, j * r * 0.22, k * 0.08]).concat([['circle', { r, sides: 4, step: 1, rings: 3, dur: 1.6 }]]);
    case 'quagmire': return [['cloud', { r, bubbles: 1, dur: 2 }]];
    case 'slowfield': case 'timewarp': return [['clock', { r: r * 0.7, dir: -1 }]];
    case 'curse': return [['sigil', { r: r * 0.6, emb: 'skull' }], ['shadow', { r: r * 0.5, tendrils: 4 }]];
    case 'stonecurse': return [['slam', { r: r * 0.7, rays: 8, el: 'physical' }], ['sigil', { r: r * 0.5, emb: 'rock' }]];
    case 'provoke': return [['shout', {}], ['stamp', { emb: 'crown', scale: 1 }]];
    case 'lex': return [['sigil', { r: 14, emb: 'eye', sides: 8 }], ['beamDown', { w: 3 }]];
    case 'smoke': return [['cloud', { r, dur: 2.6 }]];
    case 'hush': return [['shout', {}], ['sigil', { r: r * 0.5, emb: 'mask', sides: 4 }]];
    case 'repulse': return [['slam', { r: r * 1.2, rays: 10 }], ['shout', {}]];
    case 'entangle': return [['vines', { r, n: 12 }]];
    case 'fear': return [['shadow', { r, tendrils: 9 }], ['stamp', { emb: 'eye' }]];
    case 'heal': return [['heal', { r: 16 }]];
    case 'sanctuary': return [['heal', { r }], ['circle', { r, sides: L.rc.sides, rings: 3, dur: 2 }]];
    case 'purify': return [['heal', { r: 16 }], ['aura', { kind: 'motes' }]];
    case 'safetywall': return [['dome', { r: 18 }], ['pillar', { h: 70, w: 6 }]];
    case 'drain': return [['souls', { r: 10 }], ['blood', {}]];
    case 'renew': return [['heal', { r: 16, leaf: 1 }]];
    case 'massheal': return [['heal', { r }], ['beamDown', { w: 10 }]];
    case 'lifelink': return [['orbs', { n: 6, r: 16 }], ['heal', { r: 12 }]];
    case 'raisedead': return [['portal', { r: 18 }], ['crystals', { r: 20, CR: ramp(CRYS.bone, 8), rings: [[0.2, 1, 5, 8, 14]], frost: false, hold: 0.8 }]];
    case 'golem': return [['slam', { r: 40, rays: 9 }], ['portal', { r: 20 }]];
    case 'wolves': case 'falcon': return [['portal', { r: 16 }], ['aura', { kind: L.sig === 'falcon' ? 'motes' : 'leaf', r: 10 }]];
    case 'familiar': case 'guardian': case 'wraiths': case 'drones': case 'turret': case 'stormtotem': case 'healtotem': case 'decoy': return [['portal', { r: 18 }], [L.sig === 'stormtotem' ? 'strike' : L.sig === 'wraiths' ? 'shadow' : L.sig === 'guardian' ? 'beamDown' : L.sig === 'healtotem' ? 'heal' : L.sig === 'decoy' ? 'cloud' : 'orbs', { r: 14, n: 4, dur: 0.9 }, 0, 0, 0.3]];
    case 'charge': return [['slam', { r: 26, rays: 5 }], ['hit', { big: 1 }]];
    case 'blink': return [['circle', { r: 18, sides: L.rc.sides, dur: 0.6 }]];
    case 'leap': return [['slam', { r: r * 0.9, rays: 9 }], ['explode', { r: r * 0.4 }]];
    case 'phantomrush': return [0, 1, 2, 3].map((k) => ['slash', { arcs: [arc(k * 1.6, k * 1.6 + 2, r * 0.5, 5)] }, 0, 0, k * 0.06]);
    case 'roll': return [['slam', { r: 12, rays: 2 }]];
    case 'blasttrap': case 'minefield': case 'corpse': return [['explode', { r: Math.max(22, r * 0.8) }]].concat(L.sig === 'corpse' ? [['blood', {}], ['crystals', { r: 16, CR: ramp(CRYS.bone, 8), rings: [[0.3, 1, 4, 5, 9]], frost: false, hold: 0.4 }]] : []);
    case 'caltrops': return [['crystals', { r: r * 0.7, CR: ramp(['#2a2a32', '#5a5a68', '#8a8a98', '#d8d8e0'], 8), rings: [[0.1, 1, 10, 2, 4]], frost: false, hold: 2 }]];
    case 'shadowstep': return [['shadow', { r: 16, tendrils: 4 }]];
    default: return [boom(r)];
  }
}
const BUFF = {
  berserk: () => [['aura', { kind: 'fire', r: 10 }], ['shout', {}]], warcry: () => [['shout', {}], ['aura', { kind: 'motes' }, 0.1]], blessing: () => [['beamDown', { w: 5 }], ['aura', { kind: 'motes' }]],
  agility: () => [['aura', { kind: 'motes', r: 9 }], ['dash', { x0: -30, y0: 0 }]], hasteaura: () => [['aura', { kind: 'motes', r: 14 }], ['shout', {}]], endure: () => [['dome', { r: 14 }]], steelbody: () => [['dome', { r: 15 }], ['hit', { big: 1 }]],
  reflect: () => [['dome', { r: 16 }], ['orbs', { n: 6, r: 14 }]], autoguard: () => [['dome', { r: 15 }]], kyrie: () => [['dome', { r: 17 }], ['circle', { r: 18, sides: 6, dur: 0.9 }]], enchant: (L) => [['aura', { kind: L.rc.el === 'fire' ? 'fire' : 'motes', r: 8 }]],
  magnificat: () => [['aura', { kind: 'motes', r: 12 }], ['circle', { r: 22, sides: 8, step: 3, dur: 1.2 }]], lifetap: () => [['blood', {}], ['aura', { kind: 'wisp' }]], spheres: () => [['orbs', { n: 5, r: 14, dur: 2.2 }]], cloak: () => [['cloud', { r: 14, dur: 1 }], ['shadow', { r: 12, tendrils: 3 }]],
  devotion: () => [['beamDown', { w: 4 }], ['orbs', { n: 4, r: 16 }]], focus: () => [['sigil', { r: 14, emb: 'eye', sides: 6 }]],
};
