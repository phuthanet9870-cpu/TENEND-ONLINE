// ===== High-detail VFX primitives (pixel-art "moves" style) =====
// Ground decals (glowing cracks, craters with rubble, scorch, frost, acid, holy glow, burnt sigils),
// weapon smears, rising spikes (ice / rock / bone / obsidian / light), meteors, tornado funnels, black holes,
// layered energy orbs, speed lines, screen flashes and camera shake requests.
import { FX, PAL, glow, ramp, drawGlyphCircle } from './fx2.js';
const TAU = Math.PI * 2;
const R = Math.random;
const ease = (u) => 1 - Math.pow(1 - u, 3);
const EL = { fire: 'fire', ice: 'ice', lightning: 'lightning', poison: 'poison', holy: 'holy', shadow: 'shadow', arcane: 'arcane', physical: 'physical' };
export const palOf = (el) => PAL[EL[el] || 'physical'];
const GL = { fire: '#ff8a2a', ice: '#7ad8ff', lightning: '#a8c8ff', poison: '#8aff4a', holy: '#ffe080', shadow: '#9a5cff', arcane: '#ff5cd6', physical: '#fff0d0' };
export const glowC = (el) => GL[el] || '#ffffff';

// ---------------- screen flash / shake requests ----------------
FX.prototype.flashScreen = function (color = '#ffffff', a = 0.5, life = 0.15) { this.scr = { color, a, life, t: 0 }; };
FX.prototype.shakeReq = function (n) { this.shakeN = Math.max(this.shakeN || 0, n); };
FX.prototype.takeShake = function () { const n = this.shakeN || 0; this.shakeN = 0; return n; };
FX.prototype.drawScreen = function (ctx, dt, W, H) { const s = this.scr; if (!s) return; s.t += dt; if (s.t > s.life) { this.scr = null; return; } ctx.globalAlpha = s.a * (1 - s.t / s.life); ctx.fillStyle = s.color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; };

// ---------------- ground decals ----------------
FX.prototype.decal = function (d) { (this.decals ||= []).push({ t: 0, life: 3, ...d }); if (this.decals.length > 36) this.decals.shift(); };
FX.prototype.drawDecals = function (ctx, dt, w2s) {
  if (!this.decals) return;
  this.decals = this.decals.filter((d) => (d.t += dt) < d.life);
  for (const d of this.decals) { const [x, y] = w2s(d.x, d.y); const u = d.t / d.life; const a = u < 0.04 ? u / 0.04 : u > 0.65 ? (1 - u) / 0.35 : 1; ctx.save(); DECAL[d.k](ctx, x, y, d, a, u); ctx.restore(); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
};
function crackSegs(r, rays, ang, spread) {
  const segs = [];
  const grow = (x, y, a, len, w, depth) => {
    let px = x, py = y; const n = 4 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) { a += (R() - 0.5) * 0.9; const l = len / n; const nx = px + Math.cos(a) * l, ny = py + Math.sin(a) * l * 0.55; segs.push([px, py, nx, ny, w * (1 - i / n * 0.7)]); if (depth < 2 && R() < 0.35) grow(nx, ny, a + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6), len * 0.45, w * 0.6, depth + 1); px = nx; py = ny; }
  };
  for (let i = 0; i < rays; i++) { const a = spread ? ang + (R() - 0.5) * spread : (i / rays) * TAU + R() * 0.5; grow(0, 0, a, r * (0.6 + R() * 0.5), 3 + R() * 2, 0); }
  return segs;
}
FX.prototype.crack = function (x, y, r, el = 'physical', o = {}) { this.decal({ k: 'crack', x, y, r, el, segs: o.segs || crackSegs(r, o.rays || 7, o.ang || 0, o.spread || 0), life: o.life || 2.4, glow: el !== 'physical' || o.glow }); };
FX.prototype.lineCrack = function (x, y, ang, len, el = 'physical', o = {}) {
  const segs = []; let px = 0, py = 0, a = ang; const n = Math.max(6, Math.round(len / 18));
  for (let i = 0; i < n; i++) { a = ang + (R() - 0.5) * 0.6; const nx = px + Math.cos(a) * len / n, ny = py + Math.sin(a) * len / n * 0.55 * 1.8; segs.push([px, py, nx, ny, 5 - i / n * 2]); if (R() < 0.5) { const b = a + (R() < 0.5 ? -1 : 1) * (0.8 + R() * 0.6); let qx = nx, qy = ny; for (let k = 0; k < 3; k++) { const ex = qx + Math.cos(b + (R() - 0.5) * 0.6) * 12, ey = qy + Math.sin(b) * 7; segs.push([qx, qy, ex, ey, 2 - k * 0.5]); qx = ex; qy = ey; } } px = nx; py = ny; }
  this.decal({ k: 'crack', x, y, r: len, el, segs, life: o.life || 3.2, glow: el !== 'physical' || o.glow });
};
FX.prototype.crater = function (x, y, r, el = 'physical', life = 4) { const rub = Array.from({ length: Math.round(r / 3) }, () => { const a = R() * TAU, d = r * (0.85 + R() * 0.45); return [Math.cos(a) * d, Math.sin(a) * d * 0.5, 2 + Math.floor(R() * 3), R()]; }); this.decal({ k: 'crater', x, y, r, el, rub, life }); };
FX.prototype.scorch = function (x, y, r, el = 'fire', life = 4) { const b = Array.from({ length: 14 }, () => { const a = R() * TAU, d = r * R() * 0.7; return [Math.cos(a) * d, Math.sin(a) * d * 0.5, r * (0.25 + R() * 0.3)]; }); this.decal({ k: 'scorch', x, y, r, el, b, life, emb: Array.from({ length: Math.round(r / 6) }, () => [(R() - 0.5) * r * 1.4, (R() - 0.5) * r * 0.7, R() * TAU]) }); };
FX.prototype.frost = function (x, y, r, life = 4) { const segs = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + R() * 0.4; let px = 0, py = 0; for (let k = 0; k < 4; k++) { const nx = px + Math.cos(a) * r * 0.22, ny = py + Math.sin(a) * r * 0.11; segs.push([px, py, nx, ny]); segs.push([nx, ny, nx + Math.cos(a + 0.8) * r * 0.08, ny + Math.sin(a + 0.8) * r * 0.04]); segs.push([nx, ny, nx + Math.cos(a - 0.8) * r * 0.08, ny + Math.sin(a - 0.8) * r * 0.04]); px = nx; py = ny; } } this.decal({ k: 'frost', x, y, r, segs, life }); };
FX.prototype.puddle = function (x, y, r, col = '#6ad83a', life = 4) { this.decal({ k: 'puddle', x, y, r, col, life, b: Array.from({ length: 6 }, () => [(R() - 0.5) * r, (R() - 0.5) * r * 0.4, r * (0.3 + R() * 0.3)]) }); };
FX.prototype.groundGlow = function (x, y, r, col, life = 1.5) { this.decal({ k: 'glow', x, y, r, col, life }); };
FX.prototype.sigilBurn = function (x, y, r, pal, sides = 6, step = 1, life = 3) { this.decal({ k: 'sigil', x, y, r, pal, sides, step, life }); };
const DECAL = {
  crack(ctx, x, y, d, a, u) {
    ctx.lineCap = 'round';
    ctx.globalAlpha = a * 0.6; ctx.strokeStyle = '#140c0a';
    for (const [x1, y1, x2, y2, w] of d.segs) { ctx.lineWidth = w + 1; ctx.beginPath(); ctx.moveTo(x + x1, y + y1); ctx.lineTo(x + x2, y + y2); ctx.stroke(); }
    ctx.globalAlpha = a * 0.6; ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 1;
    for (const [x1, y1, x2, y2] of d.segs) { ctx.beginPath(); ctx.moveTo(x + x1, y + y1 - 1.5); ctx.lineTo(x + x2, y + y2 - 1.5); ctx.stroke(); }
    if (d.glow) {
      const pal = palOf(d.el), k = Math.pow(Math.max(0, 1 - u * 1.4), 1.3);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * k; ctx.strokeStyle = pal[2]; for (const [x1, y1, x2, y2, w] of d.segs) { ctx.lineWidth = Math.max(1, w * 0.6); ctx.beginPath(); ctx.moveTo(x + x1, y + y1); ctx.lineTo(x + x2, y + y2); ctx.stroke(); }
      ctx.strokeStyle = pal[0]; ctx.globalAlpha = a * k * 0.8; for (const [x1, y1, x2, y2, w] of d.segs) if (w > 2.5) { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + x1, y + y1); ctx.lineTo(x + x2, y + y2); ctx.stroke(); }
      ctx.globalAlpha = a * k * 0.6; const r = Math.min(200, d.r * 1.2); ctx.drawImage(glow(glowC(d.el), 64), x - r, y - r * 0.5, r * 2, r);
    }
  },
  crater(ctx, x, y, d, a) {
    const r = d.r; ctx.globalAlpha = a * 0.75;
    const g = ctx.createRadialGradient(x, y + r * 0.08, 0, x, y, r); g.addColorStop(0, '#0a0606'); g.addColorStop(0.6, '#2a1e18'); g.addColorStop(1, 'rgba(40,30,24,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = a * 0.7; ctx.strokeStyle = '#8a7a62'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r * 0.4, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.strokeStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r * 0.4, 0, 0.1, Math.PI * 0.9); ctx.stroke();
    for (const [rx, ry, s, sh] of d.rub) { ctx.fillStyle = sh > 0.5 ? '#7a6a58' : '#4a3e34'; ctx.fillRect(Math.round(x + rx), Math.round(y + ry), s, s); ctx.fillStyle = '#a89878'; ctx.fillRect(Math.round(x + rx), Math.round(y + ry), Math.max(1, s - 1), 1); }
    if (d.el !== 'physical') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * Math.max(0, 1 - d.t / 1.5) * 0.7; ctx.drawImage(glow(glowC(d.el), 64), x - r * 0.7, y - r * 0.35, r * 1.4, r * 0.7); }
  },
  scorch(ctx, x, y, d, a, u) {
    ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#120a08';
    for (const [bx, by, br] of d.b) { ctx.beginPath(); ctx.ellipse(x + bx, y + by, br, br * 0.5, 0, 0, TAU); ctx.fill(); }
    const k = Math.max(0, 1 - u * 2); if (k > 0) { ctx.globalCompositeOperation = 'lighter'; for (const [ex, ey, ph] of d.emb) { ctx.globalAlpha = a * k * (0.5 + 0.5 * Math.sin(d.t * 9 + ph)); ctx.fillStyle = d.el === 'fire' ? '#ff7a1a' : glowC(d.el); ctx.fillRect(Math.round(x + ex), Math.round(y + ey), 2, 2); } }
  },
  frost(ctx, x, y, d, a) {
    ctx.globalAlpha = a * 0.28; ctx.fillStyle = '#c8f0ff'; ctx.beginPath(); ctx.ellipse(x, y, d.r, d.r * 0.5, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = a * 0.85; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    for (const [x1, y1, x2, y2] of d.segs) { ctx.beginPath(); ctx.moveTo(x + x1, y + y1); ctx.lineTo(x + x2, y + y2); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.5 * (0.6 + 0.4 * Math.sin(d.t * 3)); ctx.drawImage(glow('#7ad8ff', 64), x - d.r, y - d.r * 0.5, d.r * 2, d.r);
  },
  puddle(ctx, x, y, d, a) { ctx.globalAlpha = a * 0.45; ctx.fillStyle = d.col; for (const [bx, by, br] of d.b) { ctx.beginPath(); ctx.ellipse(x + bx, y + by, br, br * 0.45, 0, 0, TAU); ctx.fill(); } ctx.globalAlpha = a * 0.8; ctx.strokeStyle = '#ffffff'; for (let i = 0; i < 3; i++) { const bx = x + Math.sin(d.t * 2 + i * 2) * d.r * 0.4, by = y + Math.cos(d.t * 1.7 + i) * d.r * 0.15; ctx.beginPath(); ctx.arc(bx, by, 1.5 + ((d.t * 2 + i) % 1) * 2, 0, TAU); ctx.stroke(); } },
  glow(ctx, x, y, d, a) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.7; ctx.drawImage(glow(d.col, 64), x - d.r, y - d.r * 0.5, d.r * 2, d.r); },
  sigil(ctx, x, y, d, a) { ctx.globalAlpha = a * 0.55; drawGlyphCircle(ctx, x, y, { r: d.r, t: d.t * 0.2 + 1, pal: d.pal, sides: d.sides, step: d.step, rings: 2, spin: 0.3, ticks: 16, inner: true, w: 1 }, 0.5); },
};

// ---------------- custom particles ('fn' shape) ----------------
// weapon smear: crescent band with white leading edge fading to element colour
FX.prototype.smear = function (x, y, r, ang, pal, o = {}) {
  this.add({ x, y, vx: 0, vy: 0, life: o.life || 0.28, shape: 'fn', add: false, pal, r, ang, arc: o.arc || 2.2, th: o.th || 0.35, dir: o.dir || 1, lift: o.lift || 0, flat: o.flat ?? 0.55, draw: drawSmear });
};
function drawSmear(ctx, x, y, u, p) {
  const sweep = ease(Math.min(1, u * 2.4));
  const a0 = p.ang - p.arc / 2 * p.dir, span = p.arc * p.dir;
  const head = a0 + span * sweep, tail = a0 + span * Math.max(0, Math.min(sweep, u * 1.8 - 0.55));
  const N = 16; ctx.globalCompositeOperation = 'lighter'; const al = ctx.globalAlpha;
  for (let i = 0; i < N; i++) {
    const k0 = i / N, k1 = (i + 1) / N; const b0 = tail + (head - tail) * k0, b1 = tail + (head - tail) * k1;
    const ro = p.r, ri = p.r * (1 - p.th * (0.25 + 0.75 * k1));
    ctx.globalAlpha = al * Math.pow(k1, 1.5) * (1 - u * 0.7);
    ctx.fillStyle = ramp(p.pal, 1 - k1 * 0.85);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(b0) * ro, y - p.lift + Math.sin(b0) * ro * p.flat); ctx.lineTo(x + Math.cos(b1) * ro, y - p.lift + Math.sin(b1) * ro * p.flat);
    ctx.lineTo(x + Math.cos(b1) * ri, y - p.lift + Math.sin(b1) * ri * p.flat); ctx.lineTo(x + Math.cos(b0) * ri, y - p.lift + Math.sin(b0) * ri * p.flat); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = al * (1 - u); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - p.lift, p.r, p.r * p.flat, 0, Math.min(tail, head), Math.max(tail, head)); ctx.stroke();
  ctx.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) { const b = tail + (head - tail) * R(); ctx.fillRect(Math.round(x + Math.cos(b) * (p.r + 3)), Math.round(y - p.lift + Math.sin(b) * (p.r + 3) * p.flat), 2, 2); }
  ctx.globalCompositeOperation = 'source-over';
}
// straight thrust / claw streak
FX.prototype.streak = function (x, y, ang, len, w, pal, life = 0.22, off = 0) { this.add({ x, y, vx: 0, vy: 0, life, shape: 'fn', add: false, pal, ang, len, w, off, draw: drawStreak }); };
function drawStreak(ctx, x, y, u, p) {
  const c = Math.cos(p.ang), s = Math.sin(p.ang) * 0.6, nx = -s, ny = c; const L = p.len * ease(Math.min(1, u * 3)), w = p.w * (1 - u);
  const ox = nx * p.off, oy = ny * p.off;
  ctx.globalCompositeOperation = 'lighter';
  for (const [k, col, al] of [[1, p.pal[2], 0.6], [0.55, p.pal[1], 0.9], [0.2, '#ffffff', 1]]) { ctx.globalAlpha = al * (1 - u); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + ox + c * L * 0.3 + nx * w * k, y + oy + s * L * 0.3 + ny * w * k); ctx.lineTo(x + ox + c * L, y + oy + s * L); ctx.lineTo(x + ox + c * L * 0.3 - nx * w * k, y + oy + s * L * 0.3 - ny * w * k); ctx.closePath(); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
}
// rising spike (ice crystal / rock / bone / obsidian / light lance)
const SPIKE = { ice: ['#ffffff', '#bff0ff', '#5ab8e8', '#1a4a8a'], rock: ['#d8c8a8', '#a08a6a', '#6a5440', '#2a2018'], bone: ['#ffffff', '#f0e8d0', '#c8b898', '#5a4a3a'], shadow: ['#e0c8ff', '#8a5ad8', '#4a2a8a', '#140a24'], holy: ['#ffffff', '#fff4c0', '#ffd060', '#8a5a10'], fire: ['#fffbe0', '#ffb040', '#d84a10', '#4a1008'], poison: ['#f0ffd0', '#8ad84a', '#3a8a2a', '#102a10'], lightning: ['#ffffff', '#d8e8ff', '#7a9aff', '#2a2a8a'], arcane: ['#ffffff', '#ffc8f4', '#c84ab8', '#401040'] };
FX.prototype.spike = function (x, y, h, w, kind = 'rock', delay = 0, life = 1.1, lean = 0) { const f = () => this.add({ x, y, vx: 0, vy: 0, life, shape: 'fn', add: false, h, w, kind, lean, draw: drawSpike }); delay ? setTimeout(f, delay * 1000) : f(); };
function drawSpike(ctx, x, y, u, p) {
  const c = SPIKE[p.kind] || SPIKE.rock; const g = u < 0.15 ? ease(u / 0.15) : 1; const h = p.h * g, w = p.w;
  const sink = u > 0.75 ? (u - 0.75) / 0.25 : 0; const top = [x + p.lean * h, y - h * (1 - sink * 0.6)];
  ctx.globalAlpha *= p.kind === 'ice' ? 0.92 : 1;
  ctx.fillStyle = c[2]; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(top[0], top[1]); ctx.lineTo(x, y + w * 0.3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c[3]; ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(top[0], top[1]); ctx.lineTo(x, y + w * 0.3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c[1]; ctx.beginPath(); ctx.moveTo(x - w * 0.55, y - 1); ctx.lineTo(top[0], top[1]); ctx.lineTo(x - w * 0.15, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = c[0]; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - w * 0.3, y - h * 0.15); ctx.lineTo(top[0], top[1]); ctx.stroke();
  if (p.kind !== 'rock' && p.kind !== 'bone') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.5; ctx.drawImage(glow(c[2], 32), top[0] - w * 2, top[1] - w * 2, w * 4, w * 4); ctx.globalCompositeOperation = 'source-over'; }
}
// meteor: shaded rock with flame tail, falls to (tx,ty) then calls onLand
FX.prototype.meteor = function (tx, ty, size, el, delay, onLand) {
  const F = this; const sx = tx - 160 - R() * 60, sy = ty - 420; const T = 0.5;
  setTimeout(() => { F.add({ x: sx, y: sy, vx: (tx - sx) / T, vy: (ty - sy) / T, drag: 1, life: T, shape: 'fn', add: false, size, el, F, draw: drawMeteor }); setTimeout(() => onLand && onLand(), T * 1000); }, delay * 1000);
};
function drawMeteor(ctx, x, y, u, p) {
  const F = p.F, pal = palOf(p.el === 'physical' ? 'fire' : p.el); F.flame(p.x, p.y, 3, p.size, 20, 3, 0.35); if (R() < 0.5) F.smoke(p.x, p.y, 1, p.size, 10, 0.9, true);
  ctx.globalCompositeOperation = 'lighter'; const gr = p.size * 4; ctx.drawImage(glow(pal[2], 32), x - gr, y - gr, gr * 2, gr * 2); ctx.globalCompositeOperation = 'source-over';
  const s = p.size; ctx.fillStyle = '#3a2a22'; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); ctx.fillStyle = pal[3]; ctx.beginPath(); ctx.arc(x + s * 0.25, y + s * 0.25, s * 0.7, 0, TAU); ctx.fill(); ctx.fillStyle = pal[1]; ctx.beginPath(); ctx.arc(x + s * 0.35, y + s * 0.35, s * 0.35, 0, TAU); ctx.fill();
}
// tornado funnel
FX.prototype.funnel = function (x, y, h, r, pal, life = 1.4) { this.add({ x, y, vx: 0, vy: 0, life, shape: 'fn', add: false, h, r, pal, draw: drawFunnel }); };
function drawFunnel(ctx, x, y, u, p) {
  const t = p.t; const g = Math.min(1, u * 4); ctx.globalCompositeOperation = 'lighter'; const al = ctx.globalAlpha;
  for (let i = 0; i < 18; i++) { const k = i / 18, yy = y - k * p.h * g, rr = (p.r * 0.15 + p.r * k * k) * (0.9 + 0.1 * Math.sin(t * 8 + i)), sway = Math.sin(t * 3 + k * 4) * 8 * k;
    ctx.globalAlpha = al * (0.35 + 0.4 * (1 - k)); ctx.strokeStyle = ramp(p.pal, 0.3 + k * 0.5); ctx.lineWidth = 2; const a0 = t * 9 + i; ctx.beginPath(); ctx.ellipse(x + sway, yy, rr, rr * 0.3, 0, a0, a0 + 3.6); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x + sway + Math.cos(a0 * 1.3) * rr), Math.round(yy + Math.sin(a0 * 1.3) * rr * 0.3), 2, 2); }
  ctx.globalCompositeOperation = 'source-over';
}
// black hole: dark core, lensing ring, accretion disk
FX.prototype.blackHole = function (x, y, r, pal, life = 1.4) { this.add({ x, y, vx: 0, vy: 0, life, shape: 'fn', add: false, r, pal, draw: drawHole }); };
function drawHole(ctx, x, y, u, p) {
  const g = u < 0.2 ? ease(u / 0.2) : u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1; const r = p.r * g, t = p.t;
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow(p.pal[2], 64), x - r * 2.2, y - r * 1.3 - 20, r * 4.4, r * 2.6);
  for (let i = 0; i < 3; i++) { ctx.strokeStyle = ramp(p.pal, 0.1 + i * 0.25); ctx.lineWidth = 3 - i; ctx.beginPath(); ctx.ellipse(x, y - 20, r * (1.5 - i * 0.18), r * (0.4 - i * 0.05), 0, t * (4 + i), t * (4 + i) + 5); ctx.stroke(); }
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#05000a'; ctx.beginPath(); ctx.arc(x, y - 20, r * 0.55, 0, TAU); ctx.fill();
  ctx.strokeStyle = p.pal[0]; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y - 20, r * 0.6, 0, TAU); ctx.stroke();
}
// layered energy orb (used by projectiles too)
export function drawOrb(ctx, x, y, r, pal, t, style = 'orb') {
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glow(pal[2], 32), x - r * 3, y - r * 3, r * 6, r * 6);
  if (style === 'plasma') for (let i = 0; i < 4; i++) { const a = t * 20 + i * 1.7; ctx.strokeStyle = pal[1]; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 1.8, y + Math.sin(a) * r * 1.8); ctx.stroke(); }
  if (style === 'ghost') { ctx.fillStyle = pal[2]; ctx.globalAlpha *= 0.6; for (let i = 0; i < 3; i++) ctx.fillRect(x - r + i * r * 0.7, y + r * 0.6 + Math.sin(t * 14 + i) * 2, r * 0.5, r * 0.9); ctx.globalAlpha /= 0.6; }
  ctx.strokeStyle = pal[1]; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, r * 1.35, r * 0.55, t * 5, 0, TAU); ctx.stroke();
  ctx.fillStyle = pal[2]; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = pal[1]; ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 0.15, r * 0.65, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.32, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}
// charge-up: particles converging onto a point + growing core
FX.prototype.charge = function (x, y, pal, r = 50, life = 0.4) {
  for (let i = 0; i < 18; i++) { const a = R() * TAU, d = r * (0.7 + R() * 0.5); this.add({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, vx: -Math.cos(a) * d / life, vy: -Math.sin(a) * d * 0.7 / life, drag: 1, life, pal, shape: 'spark', size: 1.5 }); }
  this.add({ x, y, vx: 0, vy: 0, life, shape: 'fn', add: false, pal, r: r * 0.25, draw: (ctx, X, Y, u, p) => drawOrb(ctx, X, Y, Math.max(1, p.r * u), p.pal, p.t) });
};
// speed lines behind a moving body
FX.prototype.speedLines = function (x1, y1, x2, y2, pal, n = 14) { const a = Math.atan2(y2 - y1, x2 - x1); for (let i = 0; i < n; i++) { const k = R(); this.streak(x1 + (x2 - x1) * k + (R() - 0.5) * 30, y1 + (y2 - y1) * k - 10 - R() * 30, a + Math.PI, 30 + R() * 50, 2, pal, 0.25); } };
// debris chunks thrown up from the ground (shaded, bounce, settle)
FX.prototype.debris = function (x, y, r, n = 10, col = ['#a89878', '#6a5a4a']) { for (let i = 0; i < n; i++) { const a = R() * TAU, s = r * (0.8 + R() * 1.6); this.add({ x: x + Math.cos(a) * r * 0.2, y: y - 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - 160 - R() * 160, life: 0.9 + R() * 0.4, shape: 'fn', add: false, g: 640, drag: 0.99, floor: y + Math.sin(a) * r * 0.25 + 4, rot: R() * TAU, vr: (R() - 0.5) * 16, s: 2 + Math.floor(R() * 3), col, draw: (ctx, X, Y, u, p) => { ctx.save(); ctx.translate(X, Y); ctx.rotate(p.rot); ctx.fillStyle = p.col[1]; ctx.fillRect(-p.s, -p.s, p.s * 2, p.s * 2); ctx.fillStyle = p.col[0]; ctx.fillRect(-p.s, -p.s, p.s * 2 - 1, p.s); ctx.restore(); } }); } };
// expanding shockwave with bright edge + dark trailing band
FX.prototype.shock = function (x, y, r, pal, life = 0.45, delay = 0) { const f = () => this.add({ x, y, vx: 0, vy: 0, life, shape: 'fn', add: false, r, pal, draw: (ctx, X, Y, u, p) => { const rr = p.r * ease(u); ctx.globalAlpha *= 1 - u; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 6 * (1 - u) + 1; ctx.beginPath(); ctx.ellipse(X, Y + 2, rr * 0.92, rr * 0.46, 0, 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = p.pal[1]; ctx.lineWidth = 4 * (1 - u) + 1; ctx.beginPath(); ctx.ellipse(X, Y, rr, rr * 0.5, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; } }); delay ? setTimeout(f, delay * 1000) : f(); };
// vertical light column with flicker (holy / summon / pillars)
FX.prototype.column = function (x, y, w, h, pal, life = 0.8) { this.add({ x, y, vx: 0, vy: 0, life, shape: 'fn', add: false, w, h, pal, draw: (ctx, X, Y, u, p) => { const g = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85; const w = p.w * g * (0.9 + 0.1 * Math.sin(p.t * 40)); ctx.globalCompositeOperation = 'lighter'; for (const [k, c, a] of [[1, p.pal[3], 0.35], [0.6, p.pal[2], 0.6], [0.3, p.pal[1], 0.9], [0.1, '#ffffff', 1]]) { ctx.globalAlpha = a * g; ctx.fillStyle = c; ctx.fillRect(X - w * k, Y - p.h, w * k * 2, p.h); } ctx.globalAlpha = g; ctx.drawImage(glow(p.pal[2], 32), X - w * 2, Y - w, w * 4, w * 2); ctx.globalCompositeOperation = 'source-over'; } }); };
// thick beam with wobbling edges, start/end flares
FX.prototype.beamFx = function (x1, y1, x2, y2, w, pal, life = 0.35) { this.add({ x: x1, y: y1, vx: 0, vy: 0, life, shape: 'fn', add: false, x2, y2, w, pal, draw: (ctx, X, Y, u, p, w2s) => { const [X2, Y2] = w2s(p.x2, p.y2); const a = Math.atan2(Y2 - Y, X2 - X), L = Math.hypot(X2 - X, Y2 - Y), nx = -Math.sin(a), ny = Math.cos(a); const g = u < 0.1 ? u / 0.1 : 1 - (u - 0.1) / 0.9; ctx.globalCompositeOperation = 'lighter'; for (const [k, c, al] of [[1, p.pal[3], 0.4], [0.65, p.pal[2], 0.7], [0.35, p.pal[1], 0.9], [0.12, '#ffffff', 1]]) { ctx.globalAlpha = al * g; ctx.fillStyle = c; ctx.beginPath(); const N = 12; for (let i = 0; i <= N; i++) { const t = i / N, ww = p.w * k * g * (1 + 0.15 * Math.sin(p.t * 50 + i * 2)); ctx.lineTo(X + Math.cos(a) * L * t + nx * ww, Y + Math.sin(a) * L * t + ny * ww); } for (let i = N; i >= 0; i--) { const t = i / N, ww = p.w * k * g * (1 + 0.15 * Math.sin(p.t * 47 + i * 3)); ctx.lineTo(X + Math.cos(a) * L * t - nx * ww, Y + Math.sin(a) * L * t - ny * ww); } ctx.closePath(); ctx.fill(); } ctx.globalAlpha = g; const fr = p.w * 3; ctx.drawImage(glow(p.pal[1], 32), X - fr, Y - fr, fr * 2, fr * 2); ctx.drawImage(glow(p.pal[1], 32), X2 - fr * 1.3, Y2 - fr * 1.3, fr * 2.6, fr * 2.6); ctx.globalCompositeOperation = 'source-over'; } }); };
export { ease };
