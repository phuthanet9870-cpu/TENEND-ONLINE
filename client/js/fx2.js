// ===== Detailed pixel-particle VFX engine (fire, explosions, ice, lightning, water, holy, shadow, poison, arcane, force fields) =====
// Particles are pixel-snapped squares drawn with additive glow, colour ramps over lifetime, drag, gravity and smoke.
import { glyphSprite } from './fxglyphs.js';
const TAU = Math.PI * 2;
const R = Math.random;
const glowCache = new Map();
export function glow(color, r) {
  const key = color + r; let c = glowCache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = r * 2; const x = c.getContext('2d');
  const g = x.createRadialGradient(r, r, 0, r, r, r); g.addColorStop(0, color); g.addColorStop(0.35, color + '88'); g.addColorStop(1, color + '00');
  x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); glowCache.set(key, c); return c;
}
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function ramp(cols, t) { const f = Math.min(cols.length - 1.001, t * (cols.length - 1)); const i = Math.floor(f), k = f - i; const a = hex(cols[i]), b = hex(cols[i + 1]); return `rgb(${a[0] + (b[0] - a[0]) * k | 0},${a[1] + (b[1] - a[1]) * k | 0},${a[2] + (b[2] - a[2]) * k | 0})`; }

export const PAL = {
  fire: ['#fffbe0', '#ffe066', '#ffa030', '#ff5a1a', '#b82010', '#401010'],
  ember: ['#ffffff', '#ffd060', '#ff7020', '#802010'],
  smoke: ['#a09890', '#787078', '#4a4450', '#2a2632'],
  ice: ['#ffffff', '#d8f6ff', '#8ad8ff', '#3a8ae8', '#1a3a7a'],
  lightning: ['#ffffff', '#fffad0', '#c8e0ff', '#7aa0ff', '#3a3aaa'],
  poison: ['#f0ffd0', '#b8ff5a', '#6ad83a', '#2a8a2a', '#103a10'],
  holy: ['#ffffff', '#fff8d0', '#ffe080', '#ffb840', '#a06a10'],
  shadow: ['#f0d8ff', '#b07aff', '#6a3ac8', '#3a1a6a', '#10081a'],
  arcane: ['#ffffff', '#ffc8f4', '#ff6ad8', '#b02aa8', '#401040'],
  physical: ['#ffffff', '#f0e8d8', '#c8b8a0', '#8a7a6a', '#3a3430'],
  water: ['#ffffff', '#c8f0ff', '#5ac8ff', '#2a7ad8', '#103a7a'],
  heal: ['#ffffff', '#d8ffd8', '#7aff9a', '#2ac85a', '#0a4a2a'],
};
const ELPAL = { fire: 'fire', ice: 'ice', lightning: 'lightning', poison: 'poison', holy: 'holy', shadow: 'shadow', arcane: 'arcane', physical: 'physical' };
const GLOWC = { fire: '#ff8a2a', ice: '#7ad8ff', lightning: '#a8c8ff', poison: '#8aff4a', holy: '#ffe080', shadow: '#9a5cff', arcane: '#ff5cd6', physical: '#ffffff', water: '#5ac8ff', heal: '#7aff9a' };

export class FX {
  constructor() { this.p = []; this.bolts = []; this.lights = []; this.max = 4200; }
  add(o) { if (this.p.length >= this.max) this.p.shift(); this.p.push({ t: 0, drag: 0.9, g: 0, size: 2, size2: 0, add: true, shape: 'sq', rot: 0, vr: 0, ...o }); }
  light(x, y, r, color, life = 0.25) { this.lights.push({ x, y, r, color, life, t: 0 }); }
  bolt(x1, y1, x2, y2, color = '#a8c8ff', life = 0.22, width = 3, branches = 3) { this.bolts.push({ pts: boltPath(x1, y1, x2, y2, 0), br: Array.from({ length: branches }, () => { const t = 0.2 + R() * 0.6; const bx = x1 + (x2 - x1) * t, by = y1 + (y2 - y1) * t; const a = Math.atan2(y2 - y1, x2 - x1) + (R() - 0.5) * 2; const L = Math.hypot(x2 - x1, y2 - y1) * (0.15 + R() * 0.25); return boltPath(bx, by, bx + Math.cos(a) * L, by + Math.sin(a) * L, 0); }), color, life, t: 0, width }); }

  // ---------- emitters ----------
  sparks(x, y, el = 'physical', n = 10, speed = 160) { const pal = PAL[ELPAL[el] || 'physical']; for (let i = 0; i < n; i++) { const a = R() * TAU, s = speed * (0.4 + R()); this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.25 + R() * 0.3, pal, shape: 'spark', size: 2, g: 200, drag: 0.92 }); } }
  smoke(x, y, n = 6, r = 20, rise = 30, life = 1.4, dark = false) { for (let i = 0; i < n; i++) this.add({ x: x + (R() - 0.5) * r, y: y + (R() - 0.5) * r * 0.5, vx: (R() - 0.5) * 20, vy: -rise * (0.5 + R()), life: life * (0.7 + R() * 0.6), pal: dark ? ['#3a2a4a', '#2a1a36', '#140c1c'] : PAL.smoke, shape: 'puff', size: 6 + R() * 6, size2: 14 + R() * 10, add: false, drag: 0.97, alpha: 0.55 }); }
  flame(x, y, n = 8, spread = 10, rise = 90, size = 3, life = 0.6) { for (let i = 0; i < n; i++) this.add({ x: x + (R() - 0.5) * spread, y: y + (R() - 0.5) * spread * 0.4, vx: (R() - 0.5) * 30, vy: -rise * (0.5 + R()), life: life * (0.6 + R() * 0.6), pal: PAL.fire, size, size2: 0, drag: 0.94 }); }
  embers(x, y, n = 6, spread = 30) { for (let i = 0; i < n; i++) this.add({ x: x + (R() - 0.5) * spread, y: y + (R() - 0.5) * spread * 0.5, vx: (R() - 0.5) * 60, vy: -60 - R() * 90, life: 0.8 + R() * 0.9, pal: PAL.ember, size: 1.5, drag: 0.985, g: -10 }); }

  explosion(x, y, r = 80, el = 'fire') {
    const big = r > 140; const pal = PAL[ELPAL[el] || 'fire'];
    this.light(x, y - 10, r * 2.2, '#fff4d0', 0.18); this.light(x, y - 10, r * 1.6, GLOWC[el] || '#ff8a2a', 0.5);
    this.add({ x, y, shape: 'ring', life: 0.45, r0: r * 0.2, r1: r * 1.4, pal: ['#ffffff', '#fff0c0', GLOWC[el] || '#ff8a2a'], size: 4, vx: 0, vy: 0 });
    const n = Math.min(90, 26 + r * 0.4);
    for (let i = 0; i < n; i++) { const a = R() * TAU, s = r * (1.2 + R() * 2.2); this.add({ x, y: y - 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 30, life: 0.35 + R() * 0.45, pal, size: 3 + R() * 3, size2: 1, drag: 0.86 }); }
    for (let i = 0; i < n * 0.4; i++) { const a = R() * TAU, s = r * (2 + R() * 3); this.add({ x, y: y - 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - 80, life: 0.6 + R() * 0.5, pal: ['#ffffff', '#c8b8a0', '#6a5a4a'], size: 2, g: 420, drag: 0.97, add: false, shape: 'sq' }); }
    this.embers(x, y - 10, 10 + r / 10, r);
    setTimeout(() => this.smoke(x, y - 10, 8 + r / 12, r * 0.8, 40, 1.6), 120);
    if (big) { // mushroom cloud: rising column + spreading cap
      for (let k = 0; k < 16; k++) setTimeout(() => { this.smoke(x, y - k * 9, 2, 14, 70, 1.8); this.flame(x, y - k * 9, 2, 10, 60, 3, 0.5); }, k * 35);
      setTimeout(() => { for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU; this.add({ x: x + Math.cos(a) * 20, y: y - 150 + Math.sin(a) * 8, vx: Math.cos(a) * 70, vy: Math.sin(a) * 18 - 10, life: 2 + R(), pal: PAL.smoke, shape: 'puff', size: 10, size2: 26, add: false, drag: 0.96, alpha: 0.6 }); this.add({ x: x + Math.cos(a) * 16, y: y - 140, vx: Math.cos(a) * 50, vy: Math.sin(a) * 12, life: 0.7, pal: PAL.fire, size: 4, size2: 1, drag: 0.95 }); } }, 520);
    }
  }
  implosion(x, y, r = 120, el = 'shadow') {
    const pal = PAL[ELPAL[el] || 'shadow'];
    for (let i = 0; i < 46; i++) { const a = R() * TAU, d = r * (0.8 + R() * 0.4); this.add({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.55, vx: -Math.cos(a) * d * 2.4, vy: -Math.sin(a) * d * 1.3, life: 0.42, pal, size: 2.5, drag: 1, shape: 'spark' }); }
    this.add({ x, y, shape: 'ring', life: 0.5, r0: r, r1: 4, pal: ['#ffffff', GLOWC[el] || '#9a5cff'], size: 3, vx: 0, vy: 0 });
    setTimeout(() => { this.light(x, y, r * 1.2, '#ffffff', 0.15); this.sparks(x, y, el, 18, 240); }, 420);
  }
  fireRing(x, y, r) { for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; this.flame(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, 2, 6, 120, 3, 0.7); } this.light(x, y, r * 1.5, '#ff8a2a', 0.5); }
  pillar(x, y, el = 'fire', h = 160, w = 26) {
    const pal = PAL[ELPAL[el] || 'fire'];
    this.light(x, y - h / 2, h, GLOWC[el], 0.5);
    for (let i = 0; i < 60; i++) this.add({ x: x + (R() - 0.5) * w, y: y - R() * 20, vx: (R() - 0.5) * 20, vy: -h * (1.6 + R() * 1.4), life: 0.5 + R() * 0.3, pal, size: 3 + R() * 2, size2: 1, drag: 0.93 });
    if (el === 'fire') { this.embers(x, y - h * 0.6, 14, w * 2); this.smoke(x, y - h, 5, w, 50); }
  }
  iceBurst(x, y, r = 70) {
    this.light(x, y, r * 1.6, '#9adfff', 0.4);
    for (let i = 0; i < Math.min(40, 12 + r / 5); i++) { const a = R() * TAU, s = r * (1 + R() * 2); this.add({ x, y: y - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 100, life: 0.6 + R() * 0.4, pal: PAL.ice, shape: 'shard', size: 4 + R() * 4, g: 380, drag: 0.97, rot: R() * TAU, vr: (R() - 0.5) * 14, add: false }); }
    for (let i = 0; i < 20; i++) { const a = R() * TAU; this.add({ x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.25, vx: Math.cos(a) * 30, vy: -10 - R() * 20, life: 1 + R(), pal: ['#e8f8ff', '#a8e0ff', '#5aa8e8'], shape: 'puff', size: 6, size2: 16, alpha: 0.35, drag: 0.97 }); }
    for (let i = 0; i < 10; i++) this.add({ x: x + (R() - 0.5) * r, y: y - R() * 40, vx: 0, vy: -10, life: 1, pal: ['#ffffff', '#c8f0ff'], shape: 'plus', size: 2 });
  }
  vortex(x, y, r = 90, el = 'ice', h = 120) {
    for (let i = 0; i < 40; i++) { const a = R() * TAU; this.add({ x, y, life: 1 + R() * 0.6, pal: PAL[ELPAL[el] || 'ice'], shape: 'helix', a0: a, rr: r * (0.3 + R() * 0.7), h: h * (0.5 + R() * 0.5), size: 2, vx: 0, vy: 0, spin: 7 + R() * 4 }); }
  }
  strike(x, y, el = 'lightning', h = 300) {
    const c = GLOWC[el] || '#a8c8ff';
    this.bolt(x + (R() - 0.5) * 30, y - h, x, y, c, 0.28, 4, 4);
    this.light(x, y, 140, c, 0.3); this.light(x, y - h / 2, 200, '#ffffff', 0.08);
    this.sparks(x, y, el, 14, 220);
    this.add({ x, y, shape: 'ring', life: 0.3, r0: 6, r1: 60, pal: ['#ffffff', c], size: 2, vx: 0, vy: 0 });
  }
  holyBeam(x, y, r = 50) {
    this.add({ x, y, shape: 'beam', life: 0.8, w: r * 0.9, h: 420, pal: PAL.holy, vx: 0, vy: 0 });
    for (let i = 0; i < 26; i++) this.add({ x: x + (R() - 0.5) * r * 1.2, y: y - R() * 40, vx: 0, vy: -40 - R() * 90, life: 0.8 + R() * 0.6, pal: PAL.holy, shape: 'plus', size: 2 + R() * 2, drag: 0.98 });
    this.light(x, y, r * 2.4, '#ffe9a0', 0.5);
  }
  healBurst(x, y, r = 60) { for (let i = 0; i < 22; i++) { const a = R() * TAU; this.add({ x: x + Math.cos(a) * r * 0.6, y: y + Math.sin(a) * r * 0.3, vx: 0, vy: -50 - R() * 60, life: 0.9 + R() * 0.5, pal: PAL.heal, shape: 'plus', size: 2 + R() * 2, drag: 0.98 }); } this.light(x, y - 20, r * 1.6, '#7aff9a', 0.4); }
  shadowBurst(x, y, r = 70) { this.smoke(x, y - 10, 10, r, 30, 1.1, true); for (let i = 0; i < 16; i++) { const a = R() * TAU; this.add({ x: x + Math.cos(a) * r * 0.4, y: y + Math.sin(a) * r * 0.2, vx: Math.cos(a) * 30, vy: -60 - R() * 70, life: 1.2, pal: PAL.shadow, shape: 'wisp', size: 3, drag: 0.98 }); } this.light(x, y, r * 1.5, '#9a5cff', 0.4); }
  poisonBurst(x, y, r = 70) { for (let i = 0; i < 20; i++) this.add({ x: x + (R() - 0.5) * r, y: y + (R() - 0.5) * r * 0.5, vx: (R() - 0.5) * 20, vy: -20 - R() * 40, life: 0.8 + R() * 0.8, pal: PAL.poison, shape: 'bubble', size: 2 + R() * 3, drag: 0.98, add: false }); for (let i = 0; i < 8; i++) this.add({ x: x + (R() - 0.5) * r, y: y + (R() - 0.5) * r * 0.4, vx: (R() - 0.5) * 30, vy: -8, life: 1.4, pal: ['#a8ff6a', '#5aa83a', '#2a5a1a'], shape: 'puff', size: 8, size2: 20, alpha: 0.3, add: false, drag: 0.97 }); }
  arcaneBurst(x, y, r = 70) { this.add({ x, y, shape: 'runering', life: 0.8, r0: r * 0.4, r1: r, pal: PAL.arcane, vx: 0, vy: 0 }); for (let i = 0; i < 24; i++) { const a = R() * TAU, s = r * (1 + R()); this.add({ x, y: y - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5, life: 0.5 + R() * 0.4, pal: PAL.arcane, shape: 'star', size: 3, drag: 0.9, rot: R() * TAU, vr: 8 }); } this.light(x, y, r * 1.6, '#ff5cd6', 0.4); }
  dust(x, y, r = 50) { for (let i = 0; i < 12; i++) { const a = R() * TAU; this.add({ x: x + Math.cos(a) * r * 0.3, y, vx: Math.cos(a) * r * 1.6, vy: Math.sin(a) * r * 0.4 - 10, life: 0.6 + R() * 0.4, pal: ['#d8c8a8', '#a89878', '#6a5a4a'], shape: 'puff', size: 5, size2: 14, alpha: 0.5, add: false, drag: 0.9 }); } }
  waterBurst(x, y, r = 60) { for (let i = 0; i < 40; i++) this.add({ x: x + (R() - 0.5) * 16, y, vx: (R() - 0.5) * r * 2, vy: -180 - R() * 220, life: 0.9, pal: PAL.water, size: 2 + R() * 2, g: 520, drag: 0.99 }); this.add({ x, y, shape: 'ring', life: 0.8, r0: 10, r1: r * 1.3, pal: ['#ffffff', '#5ac8ff'], size: 2, vx: 0, vy: 0 }); }
  disintegrate(x, y, el = 'physical', h = 40) { const pal = PAL[ELPAL[el] || 'physical']; for (let i = 0; i < 36; i++) this.add({ x: x + (R() - 0.5) * 22, y: y - R() * h, vx: (R() - 0.5) * 30, vy: -30 - R() * 60, life: 0.8 + R() * 0.8, pal, size: 2, drag: 0.97 }); }
  shatter(x, y) { for (let i = 0; i < 26; i++) { const a = R() * TAU, s = 80 + R() * 160; this.add({ x, y: y - 20, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 0.9, pal: PAL.ice, shape: 'shard', size: 4 + R() * 5, g: 520, drag: 0.98, rot: R() * TAU, vr: (R() - 0.5) * 18, add: false }); } this.light(x, y - 20, 90, '#bff0ff', 0.3); }
  respawn(x, y) { this.add({ x, y, shape: 'beam', life: 1.2, w: 30, h: 500, pal: PAL.heal, vx: 0, vy: 0 }); for (let i = 0; i < 30; i++) this.add({ x: x + (R() - 0.5) * 40, y: y - R() * 60, vx: 0, vy: -80 - R() * 80, life: 1.2, pal: ['#ffffff', '#c8fff0', '#5affd0'], shape: 'plus', size: 2 }); }
  // per-frame trail emission behind a projectile
  trail(x, y, vx, vy, el, size = 6) {
    const back = Math.atan2(vy, vx) + Math.PI;
    switch (el) {
      case 'fire': this.flame(x, y, 2, size, 30, 3, 0.35); if (R() < 0.35) this.smoke(x, y, 1, size, 15, 0.8); if (R() < 0.3) this.embers(x, y, 1, size); break;
      case 'ice': this.add({ x, y, vx: Math.cos(back) * 40 + (R() - 0.5) * 30, vy: Math.sin(back) * 40 + (R() - 0.5) * 30, life: 0.5, pal: PAL.ice, size: 2, drag: 0.92 }); if (R() < 0.4) this.add({ x, y, vx: 0, vy: 0, life: 0.6, pal: ['#e8f8ff', '#8ad0ff'], shape: 'puff', size: 4, size2: 10, alpha: 0.3 }); break;
      case 'lightning': if (R() < 0.5) this.bolt(x, y, x + Math.cos(back) * 30 + (R() - 0.5) * 20, y + Math.sin(back) * 30 + (R() - 0.5) * 20, '#c8e0ff', 0.08, 1.5, 0); this.add({ x, y, vx: (R() - 0.5) * 80, vy: (R() - 0.5) * 80, life: 0.2, pal: PAL.lightning, shape: 'spark', size: 1.5 }); break;
      case 'holy': this.add({ x: x + (R() - 0.5) * 8, y: y + (R() - 0.5) * 8, vx: 0, vy: -20, life: 0.6, pal: PAL.holy, shape: 'plus', size: 2 }); break;
      case 'shadow': this.add({ x, y, vx: Math.cos(back) * 30, vy: Math.sin(back) * 30 - 10, life: 0.6, pal: PAL.shadow, shape: 'wisp', size: 3 }); break;
      case 'poison': if (R() < 0.6) this.add({ x, y, vx: (R() - 0.5) * 20, vy: 30, life: 0.5, pal: PAL.poison, shape: 'bubble', size: 2, g: 200, add: false }); break;
      case 'arcane': this.add({ x: x + (R() - 0.5) * 8, y: y + (R() - 0.5) * 8, vx: 0, vy: 0, life: 0.45, pal: PAL.arcane, shape: 'star', size: 2.5, rot: R() * TAU, vr: 6 }); break;
      default: this.add({ x, y, vx: Math.cos(back) * 20, vy: Math.sin(back) * 20, life: 0.25, pal: ['#ffffff', '#c8c0b0'], size: 1.5 });
    }
  }
  // per-frame emission for lingering fields
  field(x, y, r, el, v, dt) {
    const k = Math.min(1, (r * r) / 9000) * dt * 60;
    const at = () => { const a = R() * TAU, d = r * Math.sqrt(R()); return [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5]; };
    if (R() > k * 0.9) return;
    const [px, py] = at();
    switch (v === 'storm' ? 'lightning' : v === 'blizzard' || v === 'frost' ? 'ice' : v === 'swamp' || v === 'cloud' ? 'poison' : el) {
      case 'fire': this.flame(px, py, 2, 8, 80, 3, 0.6); if (R() < 0.2) this.embers(px, py, 1); break;
      case 'ice': this.add({ x: px, y: py - 60, vx: -20, vy: 70, life: 0.9, pal: ['#ffffff', '#d8f6ff'], size: 1.5, drag: 1 }); if (R() < 0.3) this.add({ x: px, y: py, vx: 0, vy: -8, life: 1.2, pal: ['#e8f8ff', '#8ad0ff'], shape: 'puff', size: 6, size2: 14, alpha: 0.25 }); break;
      case 'lightning': if (R() < 0.12) this.strike(px, py, 'lightning', 220); else this.add({ x: px, y: py, vx: (R() - 0.5) * 60, vy: -20, life: 0.2, pal: PAL.lightning, shape: 'spark', size: 1.5 }); break;
      case 'poison': this.add({ x: px, y: py, vx: 0, vy: -25, life: 1, pal: PAL.poison, shape: 'bubble', size: 2 + R() * 2, add: false }); break;
      case 'holy': this.add({ x: px, y: py, vx: 0, vy: -50, life: 1, pal: PAL.holy, shape: 'plus', size: 2 }); break;
      case 'shadow': this.add({ x: px, y: py, vx: 0, vy: -30, life: 1.1, pal: PAL.shadow, shape: 'wisp', size: 3 }); break;
      case 'arcane': this.add({ x: px, y: py, vx: 0, vy: -20, life: 0.8, pal: PAL.arcane, shape: 'star', size: 2.5, rot: 0, vr: 5 }); break;
      default: this.add({ x: px, y: py, vx: 0, vy: -15, life: 0.8, pal: ['#d8c8a8', '#8a7a6a'], shape: 'puff', size: 3, size2: 8, alpha: 0.35, add: false });
    }
  }

  // ---------- update & draw (world -> screen via w2s) ----------
  draw(ctx, dt, w2s) {
    // dynamic lights
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    this.lights = this.lights.filter((l) => (l.t += dt) < l.life);
    for (const l of this.lights) { const [x, y] = w2s(l.x, l.y); const a = 1 - l.t / l.life; ctx.globalAlpha = a * 0.8; const r = Math.round(l.r); ctx.drawImage(glow(l.color, Math.max(8, Math.min(256, r))), x - r, y - r, r * 2, r * 2); }
    ctx.restore();
    const keep = [];
    for (const p of this.p) {
      p.t += dt; if (p.t >= p.life) continue; keep.push(p);
      const u = p.t / p.life;
      if (p.orb) { const o = p.orb; const a = o.a0 + o.spin * p.t, rr = o.r0 + (o.r1 - o.r0) * (o.ease ? 1 - Math.pow(1 - u, 2) : u); p.x = o.cx + Math.cos(a) * rr; p.y = o.cy + Math.sin(a) * rr * 0.5 - (o.lift || 0) * u; p.rot += p.vr * dt; }
      else if (p.shape !== 'helix' && p.shape !== 'ring' && p.shape !== 'beam' && p.shape !== 'runering' && p.shape !== 'glyph') { p.vx *= Math.pow(p.drag, dt * 60); p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.floor != null && p.y > p.floor && p.vy > 0) { p.y = p.floor; p.vy *= -0.35; p.vx *= 0.6; p.vr *= 0.5; } }
      if (p.follow) { const f = p.follow(); if (f) { p.x = f[0] + (p.ox || 0); p.y = f[1] + (p.oy || 0); } }
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      const col = p.pal ? ramp(p.pal, u) : '#ffffff'; ctx.fillStyle = col; ctx.strokeStyle = col;
      const size = p.size + (p.size2 - p.size) * u;
      let [x, y] = w2s(p.x, p.y); x = Math.round(x); y = Math.round(y);
      ctx.globalAlpha = (p.alpha ?? 1) * (u < 0.1 ? u / 0.1 : 1 - Math.max(0, (u - 0.6) / 0.4));
      switch (p.shape) {
        case 'sq': { const s = Math.max(1, Math.round(size)) * 2; ctx.fillRect(x - s / 2, y - s / 2, s, s); if (p.add && size > 2) { ctx.globalAlpha *= 0.35; const r = s * 2; ctx.drawImage(glow(p.pal[2] || p.pal[1], 16), x - r, y - r, r * 2, r * 2); } break; }
        case 'spark': { ctx.lineWidth = Math.max(1, size); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 0.03, y - p.vy * 0.03); ctx.stroke(); break; }
        case 'puff': { const s = Math.round(size); for (let i = -s; i <= s; i += 2) for (let j = -s; j <= s; j += 2) if (i * i + j * j <= s * s) ctx.fillRect(x + i, y + j * 0.8, 2, 2); break; }
        case 'shard': { ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.beginPath(); ctx.moveTo(0, -size * 1.4); ctx.lineTo(size * 0.6, 0); ctx.lineTo(0, size * 1.4); ctx.lineTo(-size * 0.6, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); break; }
        case 'plus': { const s = Math.round(size); ctx.fillRect(x - s, y, s * 2 + 1, 1.5); ctx.fillRect(x, y - s, 1.5, s * 2 + 1); break; }
        case 'star': { ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.fillRect(-size, -0.75, size * 2, 1.5); ctx.fillRect(-0.75, -size, 1.5, size * 2); ctx.rotate(Math.PI / 4); ctx.fillRect(-size / 2, -0.5, size, 1); ctx.fillRect(-0.5, -size / 2, 1, size); ctx.restore(); break; }
        case 'bubble': { ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, size), 0, TAU); ctx.stroke(); ctx.fillRect(x - 1, y - 1, 1, 1); break; }
        case 'wisp': { ctx.fillRect(x - 1, y - size, 2, size * 2); ctx.fillRect(x - size / 2, y - 1, size, 2); break; }
        case 'helix': { const a = p.a0 + p.t * p.spin; const rr = p.rr * (1 - u * 0.3); const sx = p.x + Math.cos(a) * rr, sy = p.y + Math.sin(a) * rr * 0.45 - p.h * u; const [hx, hy] = w2s(sx, sy); ctx.fillRect(Math.round(hx), Math.round(hy), 2, 2); break; }
        case 'ring': { const r = p.r0 + (p.r1 - p.r0) * (1 - Math.pow(1 - u, 2)); ctx.lineWidth = Math.max(1, p.size * (1 - u)); ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, TAU); ctx.stroke(); if (p.size >= 3) { ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r * 0.4, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } break; }
        case 'runering': { const r = p.r0 + (p.r1 - p.r0) * Math.min(1, u * 2); ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, p.t * 2, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.ellipse(x, y, r * 0.7, r * 0.35, -p.t * 3, 0, TAU); ctx.stroke(); for (let i = 0; i < 6; i++) { const a = p.t * 2 + (i / 6) * TAU; ctx.fillRect(x + Math.cos(a) * r - 2, y + Math.sin(a) * r * 0.5 - 2, 4, 4); } break; }
        case 'bmp': { const spr = glyphSprite(p.key, p.c1, p.c2); const sc = Math.max(1, Math.round(size)); if (p.glow) { ctx.globalCompositeOperation = 'lighter'; const ga = ctx.globalAlpha; ctx.globalAlpha = ga * 0.55; const r = Math.round(spr.width * sc * 0.9); ctx.drawImage(glow(p.glow, 32), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = ga; ctx.globalCompositeOperation = 'source-over'; } ctx.save(); ctx.translate(x, y); if (p.rot) ctx.rotate(p.rot); if (p.flip) ctx.scale(-1, 1); ctx.drawImage(spr, Math.round(-spr.width * sc / 2), Math.round(-spr.height * sc / 2), spr.width * sc, spr.height * sc); ctx.restore(); break; }
        case 'glyph': drawGlyphCircle(ctx, x, y, p, u); break;
        case 'slash': { const r = p.r * (0.7 + u * 0.4), a0 = p.ang - p.arc / 2 + (p.dir || 1) * u * 0.4, a1 = p.ang + p.arc / 2 + (p.dir || 1) * u * 0.4; ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 3; k++) { const w = (p.w || 10) * (1 - u) * (1 - k * 0.3); ctx.lineWidth = Math.max(1, w); ctx.strokeStyle = k === 2 ? '#ffffff' : ramp(p.pal, Math.min(1, u + k * 0.2)); ctx.beginPath(); ctx.ellipse(x, y, r - k * 3, (r - k * 3) * 0.55, 0, a0, a1); ctx.stroke(); } break; }
        case 'reticle': { const r = p.r * (1.6 - Math.min(1, u * 3) * 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + p.t * 2; ctx.fillRect(x + Math.cos(a) * r - 2, y + Math.sin(a) * r - 2, 4, 4); } ctx.fillRect(x - r * 0.4, y, r * 0.8, 1.5); ctx.fillRect(x, y - r * 0.4, 1.5, r * 0.8); break; }
        case 'beam': { const w = p.w * (u < 0.2 ? u / 0.2 : 1 - (u - 0.2) * 0.8); const g = ctx.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, p.pal[1]); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - w, y - p.h, w * 2, p.h); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - w * 0.15, y - p.h, w * 0.3, p.h); break; }
      }
    }
    this.p = keep;
    ctx.globalAlpha = 1;
    // lightning bolts: wide glow + bright core, flicker
    ctx.globalCompositeOperation = 'lighter';
    this.bolts = this.bolts.filter((b) => (b.t += dt) < b.life);
    for (const b of this.bolts) {
      if (R() < 0.25) continue; // flicker
      const a = 1 - b.t / b.life;
      for (const [path, wmul] of [[b.pts, 1], ...b.br.map((x) => [x, 0.5])]) {
        const P = path.map(([px, py]) => w2s(px, py));
        for (const [w, col, al] of [[b.width * 4 * wmul, b.color, 0.25], [b.width * 2 * wmul, b.color, 0.6], [Math.max(1, b.width * 0.6 * wmul), '#ffffff', 1]]) {
          ctx.globalAlpha = a * al; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'miter'; ctx.beginPath(); P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
}
function boltPath(x1, y1, x2, y2, depth) {
  // midpoint displacement
  let pts = [[x1, y1], [x2, y2]]; let off = Math.hypot(x2 - x1, y2 - y1) * 0.22;
  for (let k = 0; k < 5; k++) { const n = [pts[0]]; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const mx = (ax + bx) / 2, my = (ay + by) / 2; const nx = -(by - ay), ny = bx - ax, l = Math.hypot(nx, ny) || 1; const d = (R() - 0.5) * off; n.push([mx + (nx / l) * d, my + (ny / l) * d], [bx, by]); } pts = n; off *= 0.55; }
  return pts;
}

// hexagonal force-field dome around a unit (shield status)
export function drawDome(ctx, x, y, r, t, color = '#7ad8ff') {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.05, 0, Math.PI, 0); ctx.lineTo(x + r, y); ctx.ellipse(x, y, r, r * 0.3, 0, 0, Math.PI); ctx.closePath(); ctx.save(); ctx.clip();
  ctx.fillStyle = color + '22'; ctx.fillRect(x - r, y - r * 1.1, r * 2, r * 1.5);
  ctx.strokeStyle = color; ctx.lineWidth = 1; const s = 7;
  for (let row = -10; row < 4; row++) for (let col = -8; col < 8; col++) { const cx = x + col * s * 1.75 + (row % 2 ? s * 0.87 : 0), cy = y + row * s * 1.5; const sh = 0.4 + 0.6 * Math.max(0, Math.sin(t * 3 + (cx + cy) * 0.05)); ctx.globalAlpha = sh * 0.7; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; ctx.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); } ctx.closePath(); ctx.stroke(); }
  ctx.restore();
  ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.05, 0, Math.PI, 0); ctx.stroke();
  ctx.restore();
}
// translucent ice prism encasing a frozen unit
export function drawIcePrism(ctx, x, y, w, h, t) {
  ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#a8e8ff';
  const pts = [[-w * 0.6, 0], [-w * 0.7, -h * 0.55], [-w * 0.35, -h], [0, -h * 1.12], [w * 0.4, -h * 0.95], [w * 0.7, -h * 0.5], [w * 0.6, 0]];
  ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py))); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - w * 0.35, y - h); ctx.lineTo(x - w * 0.1, y - h * 0.3); ctx.lineTo(x + w * 0.4, y - h * 0.95); ctx.moveTo(x - w * 0.7, y - h * 0.55); ctx.lineTo(x - w * 0.1, y - h * 0.3); ctx.lineTo(x + w * 0.7, y - h * 0.5); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + Math.sin(t * 4) * 0.3; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - w * 0.3, y - h * 0.8, 2, h * 0.4);
  ctx.restore();
}

// ground magic circle: N-gon / star polygon + rings + rune ticks, rotating, drawn in iso perspective
function drawGlyphCircle(ctx, x, y, p, u) {
  const grow = Math.min(1, u / 0.25), r = p.r * (0.3 + 0.7 * (1 - Math.pow(1 - grow, 3)));
  const rot = (p.rot0 || 0) + p.t * (p.spin || 1);
  ctx.globalCompositeOperation = 'lighter';
  { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * 0.18; ctx.fillStyle = ramp(p.pal, 0.55); ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = ga; }
  const P = (a, rr) => [x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.5];
  ctx.lineWidth = p.w || 2;
  for (let k = 0; k < (p.rings || 1); k++) { const rr = r * (1 - k * 0.16); ctx.strokeStyle = ramp(p.pal, 0.42 + k * 0.12); ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.5, 0, 0, TAU); ctx.stroke(); }
  const n = p.sides || 6, step = p.step || 1, rp = r * (1 - (p.rings || 1) * 0.16 + 0.05);
  ctx.strokeStyle = ramp(p.pal, 0.3); ctx.beginPath();
  for (let i = 0; i <= n; i++) { const [px, py] = P(rot + ((i * step) % n) / n * TAU, rp); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.stroke();
  if (p.inner) { ctx.strokeStyle = ramp(p.pal, 0.6); ctx.beginPath(); for (let i = 0; i <= n; i++) { const [px, py] = P(-rot * 1.5 + (i / n) * TAU + Math.PI / n, rp * 0.45); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) { const [px, py] = P(rot + (i / n) * TAU, rp); ctx.fillRect(Math.round(px) - 2, Math.round(py) - 2, 4, 4); }
  const ticks = p.ticks || 0; ctx.fillStyle = ramp(p.pal, 0.45);
  for (let i = 0; i < ticks; i++) { const [px, py] = P(-rot * 0.7 + (i / ticks) * TAU, r * 0.92); ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 2); }
  ctx.globalCompositeOperation = 'source-over';
}
