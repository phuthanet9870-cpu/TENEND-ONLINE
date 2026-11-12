// ===== Skill "moves": one hand-made choreography per mechanic (125), drawn with the high-detail primitives =====
// The choreography follows what the skill DOES (Bash = overhead smash + cracked ground, Meteor Storm = falling
// meteors + craters, Frost Nova = ring of ice spikes + frosted ground, Sonic Blow = 8 rapid smears …).
// It is coloured and decorated by the per-skill recipe (class motif, element palette, emblem, modifiers),
// so all 1,000 skills look different while still matching their ability.
import './fxpro.js';
import { PAL } from './fx2.js';
import { drawOrb, palOf, glowC, ease } from './fxpro.js';
import { SKILL_LIST } from '/shared/skills.js';
import { partOf, emblem, glyphCircle, MOD_FX, SFX } from './skillfx.js';
import { glyphSprite } from './fxglyphs.js';

const TAU = Math.PI * 2;
const R = Math.random;
const later = (s, f) => setTimeout(f, s * 1000);
const SPK = { ice: 'ice', holy: 'holy', shadow: 'shadow', poison: 'poison', fire: 'fire', lightning: 'lightning', arcane: 'arcane', physical: 'rock' };
const spikeKind = (rc) => (rc.cls === 'necromancer' && (rc.el === 'physical' || rc.el === 'shadow') ? 'bone' : SPK[rc.el] || 'rock');
const isUlt = (rc) => rc.ult;

// element-tinted flame tongue (fire uses the real fire palette, other elements recolour it)
function eflame(F, rc, x, y, n = 3, spread = 10, rise = 90, size = 3, life = 0.6) {
  if (rc.el === 'fire') return F.flame(x, y, n, spread, rise, size, life);
  for (let i = 0; i < n; i++) F.add({ x: x + (R() - 0.5) * spread, y: y + (R() - 0.5) * spread * 0.4, vx: (R() - 0.5) * 30, vy: -rise * (0.5 + R()), life: life * (0.6 + R() * 0.6), pal: rc.pal, size, size2: 0, drag: 0.94 });
}
// element signature explosion with matching ground decal
function boom(F, rc, x, y, r, opt = {}) {
  const el = rc.el;
  switch (el) {
    case 'fire': F.explosion(x, y, r, 'fire'); F.scorch(x, y, r * 0.9); break;
    case 'ice': F.iceBurst(x, y, r); F.frost(x, y, r); for (let i = 0; i < 5; i++) { const a = R() * TAU; F.spike(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.2, 20 + R() * 20, 5, 'ice', R() * 0.1, 1.2, (R() - 0.5) * 0.4); } break;
    case 'lightning': F.strike(x, y, 'lightning', 280); F.crack(x, y, r * 0.8, 'lightning', { rays: 5 }); for (let i = 0; i < 4; i++) F.bolt(x, y - 4, x + (R() - 0.5) * r * 2, y + (R() - 0.5) * r, rc.pal[2], 0.25, 1.5, 1); break;
    case 'poison': F.poisonBurst(x, y, r); F.puddle(x, y, r * 0.8, rc.pal[3]); break;
    case 'holy': F.holyBeam(x, y, Math.min(80, r)); F.groundGlow(x, y, r * 1.2, rc.pal[2], 1.6); break;
    case 'shadow': F.implosion(x, y, r, 'shadow'); F.shadowBurst(x, y, r * 0.8); F.scorch(x, y, r * 0.7, 'shadow'); break;
    case 'arcane': F.arcaneBurst(x, y, r); F.sigilBurn(x, y, r * 0.8, rc.pal, rc.sides, rc.step, 2.2); break;
    default: F.dust(x, y, r); F.debris(x, y, r, 10); F.crater(x, y, r * 0.5); F.sparks(x, y - 6, 'physical', 10, 180);
  }
  F.shock(x, y, r * 1.2, rc.pal); F.light(x, y - 10, r * 1.6, rc.glowC, 0.35);
  if (!opt.quiet) F.shakeReq(Math.min(10, 2 + r / 30));
}
function slash(F, rc, x, y, r, ang, dir = 1, o = {}) { F.smear(x, y - 14, r, ang, rc.pal, { dir, arc: o.arc || 2.2, th: o.th || 0.38, life: o.life || 0.3, flat: o.flat, lift: o.lift || 0 }); for (let i = 0; i < (o.sparks ?? 6); i++) { const a = ang + (R() - 0.5) * 1.2; partOf(F, rc, i % 2 ? 'spark' : rc.part, x + Math.cos(a) * r, y - 14 + Math.sin(a) * r * 0.55, Math.cos(a) * 160, Math.sin(a) * 90 - 40, 0.4); } }
const front = (x, y, ang, d) => [x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.6];
function stamp(F, rc, x, y, scale = 2) { emblem(F, rc, x, y - 34, scale, 0.7, 30); }
function mods(F, rc, x, y, r, ang) { for (const m of rc.mods) (MOD_FX[m] || (() => {}))(F, rc, x, y, r, ang); }
function rain(F, rc, x, y, r, n, kind, onHit) { for (let i = 0; i < n; i++) { const a = R() * TAU, d = r * Math.sqrt(R()), tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d * 0.5, dl = R() * 0.5; later(dl, () => { F.streak(tx - 50, ty - 260, Math.atan2(260, 50) , 270, 3, rc.pal, 0.22); later(0.2, () => { if (kind) partOf(F, rc, kind, tx, ty - 6, 0, 0, 0.5, { rot: 1.2, vr: 0, g: 0 }); F.dust(tx, ty, 14); onHit && onHit(tx, ty); }); }); } }
function ringSpikes(F, rc, x, y, r, n, h = 40, kind = spikeKind(rc), stagger = 0.02) { for (let i = 0; i < n; i++) { const a = (i / n) * TAU; F.spike(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, h * (0.7 + R() * 0.6), 6 + R() * 3, kind, i * stagger, 1.2, Math.cos(a) * 0.25); } }
function lineSpikes(F, rc, x, y, ang, len, n, h = 44, kind = spikeKind(rc)) { for (let i = 0; i < n; i++) { const k = (i + 1) / n; F.spike(x + Math.cos(ang) * len * k + (R() - 0.5) * 12, y + Math.sin(ang) * len * k * 0.6 + (R() - 0.5) * 6, h * (0.6 + R() * 0.7), 6 + R() * 4, kind, i * 0.05, 1.1, (R() - 0.5) * 0.4); } }
function orbitOrbs(F, rc, x, y, n, rad, life = 1.2, lift = 30) { for (let i = 0; i < n; i++) F.add({ x, y, vx: 0, vy: 0, life, shape: 'fn', add: false, pal: rc.pal, orb: { cx: x, cy: y - lift, a0: (i / n) * TAU, spin: 4, r0: rad, r1: rad }, draw: (ctx, X, Y, u, p) => drawOrb(ctx, X, Y, 4, p.pal, p.t) }); }
function net(F, rc, x, y, r) { F.add({ x, y, vx: 0, vy: 0, life: 1.6, shape: 'fn', add: false, r, draw: (ctx, X, Y, u, p) => { const g = ease(Math.min(1, u * 5)), rr = p.r * g; ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 1; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(X - rr, Y + i * rr * 0.14); ctx.lineTo(X + rr, Y + i * rr * 0.14 + 4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(X + i * rr * 0.28, Y - rr * 0.5); ctx.lineTo(X + i * rr * 0.28 + 4, Y + rr * 0.5); ctx.stroke(); } ctx.fillStyle = '#8a7a5a'; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.fillRect(X + Math.cos(a) * rr - 2, Y + Math.sin(a) * rr * 0.5 - 2, 4, 4); } } }); }
function clock(F, rc, x, y, r, dir = -1) { F.add({ x, y, vx: 0, vy: 0, life: 1.4, shape: 'fn', add: false, r, pal: rc.pal, draw: (ctx, X, Y, u, p) => { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = p.pal[1]; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(X, Y, p.r, p.r * 0.5, 0, 0, TAU); ctx.stroke(); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.fillStyle = p.pal[0]; ctx.fillRect(X + Math.cos(a) * p.r * 0.88 - 1, Y + Math.sin(a) * p.r * 0.44 - 1, 3, 2); } const h1 = dir * p.t * 7, h2 = dir * p.t * 1.2; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(h1) * p.r * 0.8, Y + Math.sin(h1) * p.r * 0.4); ctx.stroke(); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(h2) * p.r * 0.5, Y + Math.sin(h2) * p.r * 0.25); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; } }); }
function shout(F, rc, x, y, n = 3, col) { for (let k = 0; k < n; k++) F.shock(x, y - 20, 70 + k * 40, col ? [col, col, col] : rc.pal, 0.4, k * 0.1); }
function vines(F, x, y, r, n = 10) { for (let i = 0; i < n; i++) { const a = R() * TAU, d = r * Math.sqrt(R()); const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.5; F.add({ x: px, y: py, vx: 0, vy: 0, life: 1.2, shape: 'fn', add: false, h: 26 + R() * 24, ph: R() * TAU, draw: (ctx, X, Y, u, p) => { const g = ease(Math.min(1, u * 3)); ctx.strokeStyle = '#2a6a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X, Y); for (let k = 1; k <= 8; k++) { const t = k / 8; ctx.lineTo(X + Math.sin(p.ph + t * 6) * 6 * t, Y - p.h * g * t); } ctx.stroke(); ctx.strokeStyle = '#7ad84a'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#5ab83a'; ctx.fillRect(X + Math.sin(p.ph + 3) * 4 - 2, Y - p.h * g * 0.5 - 2, 4, 3); } }); } F.crack(x, y, r * 0.7, 'poison', { rays: 6, life: 2.5 }); }

// ---- per-mechanic impact choreography: (F, rc, x, y, r, ang, f) ----
const H = {
  // strike
  bash: (F, rc, x, y, r, a) => { const [px, py] = front(x, y, a, r * 0.6); slash(F, rc, px, py, r * 0.55, -Math.PI / 2, 1, { arc: 1.6, flat: 0.95, lift: 10 }); later(0.08, () => { F.crack(px, py, r * 0.7, rc.el, { rays: 6 }); F.debris(px, py, 40, 9); F.shock(px, py, r * 0.8, rc.pal); F.dust(px, py, 30); F.shakeReq(4); }); },
  double: (F, rc, x, y, r, a) => { slash(F, rc, x, y, r * 0.7, a, 1); later(0.15, () => slash(F, rc, x, y, r * 0.75, a + 0.2, -1)); },
  triple: (F, rc, x, y, r, a) => { slash(F, rc, x, y, r * 0.7, a, 1); later(0.18, () => slash(F, rc, x, y, r * 0.7, a, -1)); later(0.36, () => { const [px, py] = front(x, y, a, r * 0.6); slash(F, rc, x, y, r * 0.85, a, 1, { arc: 2.8, th: 0.5 }); F.shock(px, py, r, rc.pal); F.debris(px, py, 50, 8); F.shakeReq(5); }); },
  uppercut: (F, rc, x, y, r, a) => { const [px, py] = front(x, y, a, r * 0.5); F.streak(px, py + 4, -Math.PI / 2, 110, 12, rc.pal, 0.3); F.debris(px, py, 30, 10); F.dust(px, py, 30); for (let i = 0; i < 14; i++) partOf(F, rc, i % 2 ? 'spark' : rc.part, px + (R() - 0.5) * 14, py, (R() - 0.5) * 40, -260 - R() * 200, 0.6, { g: 300 }); F.crack(px, py, 30, rc.el, { rays: 4 }); },
  thrust: (F, rc, x, y, r, a, f) => { const L = f.len || r * 2; for (let k = 0; k < 3; k++) later(k * 0.04, () => F.streak(x, y - 14, a, L, 10 - k * 2, rc.pal, 0.25, (k - 1) * 6)); for (let i = 1; i <= 3; i++) { const [px, py] = front(x, y, a, L * i / 3); F.shock(px, py - 14, 26, rc.pal, 0.3, i * 0.05); } const [ex, ey] = front(x, y, a, L); F.sparks(ex, ey - 14, rc.el, 14, 240); },
  sonic: (F, rc, x, y, r, a) => { const [px, py] = front(x, y, a, r * 0.5); for (let i = 0; i < 8; i++) later(i * 0.07, () => { F.smear(px, py - 14, r * (0.35 + R() * 0.25), a + (R() - 0.5) * 3, rc.pal, { dir: i % 2 ? 1 : -1, arc: 1.6, life: 0.18 }); F.sparks(px, py - 14, rc.el, 4, 200); }); later(0.6, () => { F.add({ x: px, y: py - 14, vx: 0, vy: 0, life: 0.35, pal: ['#ffffff', rc.pal[1]], shape: 'star', size: 20, size2: 4, rot: 0.78, vr: 0 }); F.shakeReq(4); }); },
  execute: (F, rc, x, y, r, a) => { const [px, py] = front(x, y, a, r * 0.55); later(0.12, () => { F.smear(px, py - 10, r * 0.7, -Math.PI / 2, ['#ffffff', '#ff6a6a', '#c8102a', '#600010', '#200008'], { arc: 1.9, flat: 1, th: 0.5 }); F.flashScreen('#600010', 0.35, 0.18); F.crack(px, py, r * 0.8, 'fire', { rays: 7 }); F.shakeReq(7); emblem(F, { ...rc, emb: 'skull', pal: ['#ffffff', '#ff8a8a', '#c8102a'] }, px, py - 40, 3, 0.9, 30); }); },
  sunder: (F, rc, x, y, r, a) => { const [px, py] = front(x, y, a, r * 0.6); slash(F, rc, px, py, r * 0.5, -Math.PI / 2 + 0.3, 1, { flat: 0.9 }); F.debris(px, py, 50, 12, ['#d8d8e0', '#6a6a78']); F.crack(px, py, r * 0.5, rc.el, { rays: 5 }); MOD_FX.sunder(F, rc, px, py); },
  rend: (F, rc, x, y, r, a) => { const [px, py] = front(x, y, a, r * 0.2); for (let k = -1; k <= 1; k++) later((k + 1) * 0.04, () => F.streak(px - Math.cos(a) * 20, py - 14, a + 0.15, r * 0.9, 6, rc.pal, 0.28, k * 10)); MOD_FX.bleed(F, rc, ...front(x, y, a, r * 0.7)); },
  backstab: (F, rc, x, y, r, a) => { const [px, py] = front(x, y, a, r * 0.5); F.smoke(px, py - 10, 5, 20, 20, 0.8, true); F.streak(px - Math.cos(a) * 30, py - 16, a, 70, 8, rc.pal, 0.2); MOD_FX.crit(F, rc, px, py); MOD_FX.bleed(F, rc, px, py); },
  riposte: (F, rc, x, y) => { F.add({ x, y: y - 24, vx: 0, vy: 0, life: 0.3, pal: ['#ffffff', '#ffe080'], shape: 'star', size: 18, size2: 3, rot: 0, vr: 2 }); F.sparks(x, y - 24, 'physical', 20, 260); F.light(x, y - 20, 90, '#fff4c0', 0.2); orbitOrbs(F, rc, x, y, 3, 26, 0.6, 20); },
  hook: (F, rc, x, y) => { F.sparks(x, y - 12, 'physical', 10, 180); F.dust(x, y, 26); },
  silence: (F, rc, x, y, r, a) => { const [px, py] = front(x, y, a, r * 0.6); slash(F, rc, px, py, r * 0.45, a, 1); for (let k = 0; k < 3; k++) F.shock(px, py - 30, 40 + k * 14, ['#ffffff', '#8a6aa8', '#4a2a6a'], 0.4, k * 0.08); MOD_FX.silence(F, rc, px, py); },
  lunge: (F, rc, x, y, r, a) => { F.streak(x - Math.cos(a) * 40, y - 14, a, r * 1.4, 9, rc.pal, 0.25); F.dust(x, y, 20); F.sparks(...front(x, y - 14, a, r), rc.el, 10, 200); },
  crescent: (F, rc, x, y, r, a) => { F.smear(x, y - 14, r * 0.9, a, rc.pal, { arc: 3, th: 0.25, life: 0.38 }); later(0.1, () => F.smear(x, y - 14, r * 1.1, a, rc.pal, { arc: 2.4, th: 0.15, life: 0.3 })); for (let i = 0; i < 16; i++) { const b = a + (R() - 0.5) * 2.4; partOf(F, rc, rc.part, x + Math.cos(b) * r, y - 14 + Math.sin(b) * r * 0.55, Math.cos(b) * 200, Math.sin(b) * 110, 0.5); } },
  asura: (F, rc, x, y, r, a) => { const [px, py] = front(x, y, a, r * 0.5); F.flashScreen('#ffffff', 0.85, 0.35); F.shakeReq(14); F.column(px, py, 40, 520, rc.pal, 0.9); F.crack(px, py, r * 1.6, rc.el, { rays: 10, glow: 1 }); F.crater(px, py, r * 0.8, rc.el); F.debris(px, py, 90, 26); for (let k = 0; k < 3; k++) F.shock(px, py, r * (1.2 + k * 0.6), rc.pal, 0.6, k * 0.12); F.explosion(px, py, r, rc.el === 'physical' ? 'fire' : rc.el); },
  // sweep
  cleave: (F, rc, x, y, r, a) => { slash(F, rc, x, y, r * 0.95, a, 1, { arc: 2.9, th: 0.45, sparks: 12 }); F.dust(...front(x, y, a, r * 0.6), 30); },
  whirl: (F, rc, x, y, r) => { for (let k = 0; k < 2; k++) later(k * 0.12, () => F.smear(x, y - 12, r * (0.8 + k * 0.15), R() * TAU, rc.pal, { arc: TAU * 0.95, th: 0.3, life: 0.32, dir: 1 })); F.dust(x, y, r * 0.8); for (let i = 0; i < 14; i++) partOf(F, rc, rc.part, x, y, 0, 0, 0.6, { orb: { cx: x, cy: y - 10, a0: (i / 14) * TAU, spin: 9, r0: r * 0.4, r1: r, ease: 1 } }); },
  magnum: (F, rc, x, y, r) => { boom(F, rc, x, y, r * 0.8); F.fireRing(x, y, r * 0.8); F.crack(x, y, r, rc.el === 'physical' ? 'fire' : rc.el, { rays: 9 }); F.flashScreen(rc.pal[2], 0.2, 0.12); },
  shockwave: (F, rc, x, y, r, a) => { F.shock(x, y, r * 1.2, rc.pal); F.shock(x, y, r * 0.8, rc.pal, 0.4, 0.08); F.crack(x, y, r * 0.9, rc.el, { rays: 4, ang: a, spread: 1.2 }); F.debris(...front(x, y, a, r * 0.5), 60, 12); F.shakeReq(5); },
  fissure: (F, rc, x, y, r, a, f) => { const L = f.len || r * 2.2; F.lineCrack(x, y, a, L, rc.el); lineSpikes(F, rc, x, y, a, L, Math.round(L / 34)); for (let i = 0; i < 6; i++) { const [px, py] = front(x, y, a, L * (i / 6)); later(i * 0.05, () => F.dust(px, py, 20)); } F.shakeReq(5); },
  bowling: (F, rc, x, y, r, a) => { slash(F, rc, x, y, r * 0.8, a, 1, { arc: 2.4, th: 0.55 }); F.speedLines(x, y, ...front(x, y, a, r * 2), rc.pal, 10); MOD_FX.knock(F, rc, x, y, r, a); F.dust(x, y, 30); },
  cyclone: (F, rc, x, y, r) => { F.funnel(x, y, 140, r * 0.7, rc.pal, 1); for (let k = 0; k < 3; k++) later(k * 0.1, () => F.smear(x, y - 12, r * 0.8, R() * TAU, rc.pal, { arc: TAU * 0.8, th: 0.25, life: 0.28 })); F.dust(x, y, r); },
  tremor: (F, rc, x, y, r) => { for (let k = 0; k < 3; k++) later(k * 0.22, () => { const ox = (R() - 0.5) * r * 0.6, oy = (R() - 0.5) * r * 0.3; F.shock(x + ox, y + oy, r * 0.9, rc.pal); F.crack(x + ox, y + oy, r * 0.6, rc.el, { rays: 5 }); F.debris(x + ox, y + oy, 50, 8); F.shakeReq(5); }); },
  reap: (F, rc, x, y, r, a) => { F.smear(x, y - 14, r, a, ['#ffffff', rc.pal[1], '#4a2a6a', '#1a0a2a', '#000000'], { arc: 4.2, th: 0.3, life: 0.4 }); for (let i = 0; i < 10; i++) partOf(F, rc, 'wisp', ...front(x, y, a + (R() - 0.5) * 3, r * 0.8), 0, -60, 1); },
  splitter: (F, rc, x, y, r, a, f) => { const L = f.len || r * 2.6; F.lineCrack(x, y, a, L, rc.el, { glow: 1 }); for (let i = 0; i < 6; i++) { const [px, py] = front(x, y, a, L * (i + 1) / 6); later(i * 0.06, () => { F.spike(px, py, 50 + R() * 30, 10, spikeKind(rc), 0, 1.2, (R() - 0.5) * 0.3); F.debris(px, py, 40, 5); }); } const [ex, ey] = front(x, y, a, L); later(0.4, () => { F.crater(ex, ey, 40, rc.el); F.shock(ex, ey, 90, rc.pal); F.shakeReq(8); }); },
  pillarslam: (F, rc, x, y, r) => { F.crater(x, y, r * 0.6, rc.el); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; F.spike(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.28, 70 + R() * 30, 12, spikeKind(rc), i * 0.04, 1.3, Math.cos(a) * 0.2); } F.shock(x, y, r * 1.2, rc.pal); F.debris(x, y, 70, 14); F.shakeReq(8); },
  vortexslash: (F, rc, x, y, r) => { for (let k = 0; k < 4; k++) later(k * 0.08, () => F.smear(x, y - 12, r * (1 - k * 0.15), k * 1.6, rc.pal, { arc: 3.5, th: 0.2, life: 0.3, dir: -1 })); later(0.3, () => F.implosion(x, y, r * 0.8, rc.el)); },
  // shot (impacts / area parts)
  pierceshot: (F, rc, x, y, r, a) => { F.streak(x, y - 12, a, 120, 5, rc.pal, 0.2); F.sparks(x, y - 12, rc.el, 8, 200); },
  multishot: (F, rc, x, y) => { F.sparks(x, y - 12, rc.el, 6, 160); },
  ricochet: (F, rc, x, y) => { F.sparks(x, y - 12, rc.el, 8, 220); F.shock(x, y - 12, 26, rc.pal, 0.25); },
  splitshot: (F, rc, x, y, r, a) => { for (let k = -1; k <= 1; k++) F.streak(x, y - 12, a + k * 0.5, 50, 3, rc.pal, 0.2); },
  seeker: (F, rc, x, y) => { F.add({ x, y: y - 12, vx: 0, vy: 0, life: 0.25, pal: ['#ffffff', rc.pal[1]], shape: 'star', size: 9, size2: 2, rot: 0, vr: 5 }); F.sparks(x, y - 12, rc.el, 6, 160); },
  arrowstorm: (F, rc, x, y, r) => rain(F, rc, x, y, r, 18, rc.cls === 'gunslinger' ? 'p_shell' : 'p_feather'),
  sniper: (F, rc, x, y) => { F.add({ x, y: y - 14, vx: 0, vy: 0, life: 0.3, pal: ['#ffffff', rc.pal[1]], shape: 'star', size: 22, size2: 3, rot: 0, vr: 0 }); F.shock(x, y - 10, 70, rc.pal); F.sparks(x, y - 12, rc.el, 20, 300); F.flashScreen('#ffffff', 0.18, 0.08); },
  cluster: (F, rc, x, y, r) => { for (let i = 0; i < 5; i++) later(i * 0.08, () => boom(F, rc, x + (R() - 0.5) * r, y + (R() - 0.5) * r * 0.5, 45, { quiet: 1 })); F.shakeReq(6); },
  boomerang: (F, rc, x, y) => { F.sparks(x, y - 12, rc.el, 8, 200); },
  net: (F, rc, x, y, r) => { net(F, rc, x, y, Math.max(30, r * 0.5)); },
  timebomb: (F, rc, x, y, r) => { clock(F, rc, x, y, 30, 1); later(1, () => boom(F, rc, x, y, r)); },
  wave: (F, rc, x, y, r, a) => { F.smear(x, y - 12, 50, a, rc.pal, { arc: 2.4, th: 0.25 }); F.shock(x, y, 50, rc.pal); },
  fan: (F, rc, x, y, r, a) => { for (let i = 0; i < 4; i++) partOf(F, rc, 'p_dagger', x, y - 12, Math.cos(a + (R() - 0.5)) * 120, -60, 0.6, { g: 400 }); },
  rainarrow: (F, rc, x, y, r) => rain(F, rc, x, y, r, 26, rc.cls === 'gunslinger' ? 'p_shell' : 'p_feather', (tx, ty) => R() < 0.3 && F.sparks(tx, ty, rc.el, 3, 100)),
  doubleshot: (F, rc, x, y) => { F.sparks(x - 6, y - 12, rc.el, 5, 160); F.sparks(x + 6, y - 12, rc.el, 5, 160); },
  explosive: (F, rc, x, y, r) => boom(F, rc, x, y, Math.max(60, r)),
  tracer: (F, rc, x, y, r, a) => { F.streak(x - Math.cos(a) * 160, y - 12, a, 170, 2, ['#ffffff', '#fff0a0', '#ffb040', '#802010', '#000'], 0.15); F.sparks(x, y - 12, 'fire', 8, 220); MOD_FX.mark(F, rc, x, y); },
  chargedshot: (F, rc, x, y, r) => { F.shock(x, y - 8, 110, rc.pal); F.shock(x, y - 8, 70, rc.pal, 0.4, 0.06); F.light(x, y, 160, rc.glowC, 0.3); F.sparks(x, y - 12, rc.el, 26, 320); F.crack(x, y, 60, rc.el, { rays: 6 }); F.shakeReq(6); },
  // spells
  fireball: (F, rc, x, y, r) => boom(F, rc, x, y, r),
  firewall: (F, rc, x, y, r, a, f) => { const L = f.len || r * 2; for (let i = 0; i < 10; i++) { const [px, py] = front(x, y, a, L * i / 9 - L / 2); later(i * 0.02, () => { eflame(F, rc, px, py, 6, 14, 160, 4, 0.8); F.scorch(px, py, 22, rc.el); }); } },
  firepillar: (F, rc, x, y, r) => { F.column(x, y, 26, 260, rc.pal, 1); F.pillar(x, y, rc.el, 220, 30); F.scorch(x, y, r * 0.7, rc.el); for (let i = 0; i < 12; i++) eflame(F, rc, x + (R() - 0.5) * 30, y, 2, 6, 260, 4, 0.8); },
  frostnova: (F, rc, x, y, r) => { ringSpikes(F, rc, x, y, r * 0.75, 14, 46); ringSpikes(F, rc, x, y, r * 0.4, 8, 32); F.frost(x, y, r); F.shock(x, y, r * 1.2, rc.pal); F.iceBurst(x, y, r * 0.5); },
  blizzard: (F, rc, x, y, r) => { F.frost(x, y, r, 6); F.vortex(x, y, r * 0.8, rc.el, 140); },
  icespear: (F, rc, x, y, r, a) => { for (let i = 0; i < 5; i++) F.spike(x + (R() - 0.5) * 24, y + (R() - 0.5) * 10, 30 + R() * 30, 6, spikeKind(rc), i * 0.03, 1, Math.cos(a) * 0.4); F.shatter(x, y); F.frost(x, y, 40); },
  bolts: (F, rc, x, y, r) => { F.crack(x, y, r * 0.6, rc.el === 'physical' ? 'lightning' : rc.el, { rays: 5 }); F.sparks(x, y, rc.el, 12, 220); },
  thunderstorm: (F, rc, x, y, r) => { for (let i = 0; i < 6; i++) later(i * 0.12, () => { const tx = x + (R() - 0.5) * r * 1.5, ty = y + (R() - 0.5) * r * 0.7; F.strike(tx, ty, rc.el === 'physical' ? 'lightning' : rc.el, 300); F.crack(tx, ty, 30, 'lightning', { rays: 4, life: 1.6 }); }); F.flashScreen('#c8d8ff', 0.25, 0.1); },
  chainl: (F, rc, x, y) => { F.sparks(x, y - 12, rc.el, 10, 220); F.light(x, y, 70, rc.glowC, 0.2); },
  jupitel: (F, rc, x, y, r) => { F.shock(x, y - 10, r * 1.2, rc.pal); for (let i = 0; i < 6; i++) F.bolt(x, y - 12, x + (R() - 0.5) * r * 2, y - 12 + (R() - 0.5) * r, rc.pal[1], 0.3, 2, 1); F.light(x, y, r * 2, rc.glowC, 0.4); F.sparks(x, y - 12, rc.el, 18, 260); },
  static: (F, rc, x, y, r) => { for (let i = 0; i < 8; i++) { const a = R() * TAU, b = a + 1 + R(); F.bolt(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.4, x + Math.cos(b) * r * 0.8, y + Math.sin(b) * r * 0.4, rc.pal[1], 0.3, 1.5, 1); } F.groundGlow(x, y, r, rc.glowC, 1); },
  stormgust: (F, rc, x, y, r) => { F.funnel(x, y, 180, r, rc.pal, 1.6); F.vortex(x, y, r, rc.el, 160); F.frost(x, y, r * 1.1); for (let i = 0; i < 26; i++) F.add({ x, y, vx: 0, vy: 0, life: 1.3, pal: PAL.ice, shape: 'shard', size: 3 + R() * 3, rot: R() * TAU, vr: 8, add: false, orb: { cx: x, cy: y, a0: R() * TAU, spin: 6, r0: r * 0.2, r1: r, lift: 60 } }); },
  vermilion: (F, rc, x, y, r) => { F.flashScreen('#ffffff', 0.4, 0.2); for (let i = 0; i < 14; i++) later(i * 0.07, () => { const tx = x + (R() - 0.5) * r * 1.8, ty = y + (R() - 0.5) * r * 0.9; F.strike(tx, ty, rc.el === 'physical' ? 'lightning' : rc.el, 360); F.crack(tx, ty, 34, rc.el === 'physical' ? 'lightning' : rc.el, { rays: 4 }); }); F.shakeReq(9); },
  meteorstorm: (F, rc, x, y, r) => { const n = isUlt(rc) ? 9 : 5; for (let i = 0; i < n; i++) { const tx = x + (R() - 0.5) * r * 1.4, ty = y + (R() - 0.5) * r * 0.7; F.meteor(tx, ty, 8 + R() * 6, rc.el, i * 0.16, () => { boom(F, rc, tx, ty, 70, { quiet: 1 }); F.crater(tx, ty, 34, rc.el); F.debris(tx, ty, 60, 8); F.shakeReq(7); }); } },
  soulstrike: (F, rc, x, y) => { F.shadowBurst(x, y, 40); for (let i = 0; i < 8; i++) partOf(F, rc, 'wisp', x, y - 12, (R() - 0.5) * 120, -60 - R() * 60, 0.9); },
  napalm: (F, rc, x, y, r) => { F.implosion(x, y, r * 0.8, rc.el === 'physical' ? 'shadow' : rc.el); later(0.35, () => { F.shock(x, y, r, rc.pal); F.smoke(x, y - 10, 6, r * 0.6, 30, 0.9, true); }); },
  gravity: (F, rc, x, y, r) => { F.sigilBurn(x, y, r, rc.pal, rc.sides, rc.step, 2.5); F.crack(x, y, r * 0.8, rc.el, { rays: 8 }); for (let k = 0; k < 3; k++) F.shock(x, y, r * (1 - k * 0.25), rc.pal, 0.5, k * 0.15); F.shakeReq(4); },
  blackhole: (F, rc, x, y, r) => { F.blackHole(x, y, Math.min(70, r * 0.5), rc.pal, 1.6); F.implosion(x, y, r * 1.2, rc.el); for (let i = 0; i < 30; i++) partOf(F, rc, 'spark', x, y, 0, 0, 1.2, { orb: { cx: x, cy: y - 20, a0: R() * TAU, spin: 6, r0: r * 1.3, r1: 4, ease: 1 } }); F.flashScreen('#100018', 0.35, 0.3); },
  tornado: (F, rc, x, y, r) => { F.funnel(x, y, 200, r * 0.8, rc.pal, 1.6); F.dust(x, y, r); F.debris(x, y, 40, 10); },
  earthspike: (F, rc, x, y, r, a, f) => { if (f.shape === 'line') { lineSpikes(F, rc, x, y, a, f.len || r * 2, 9, 56); F.lineCrack(x, y, a, f.len || r * 2, rc.el); } else { for (let i = 0; i < 9; i++) { const b = R() * TAU, d = r * 0.7 * Math.sqrt(R()); F.spike(x + Math.cos(b) * d, y + Math.sin(b) * d * 0.5, 40 + R() * 40, 8, spikeKind(rc), R() * 0.15, 1.2, (R() - 0.5) * 0.3); } F.crack(x, y, r, rc.el); } F.debris(x, y, 50, 10); F.shakeReq(5); },
  heavensdrive: (F, rc, x, y, r) => { for (let k = 0; k < 3; k++) later(k * 0.12, () => { ringSpikes(F, rc, x, y, r * (0.25 + k * 0.32), 5 + k * 4, 44 + k * 10); F.shock(x, y, r * (0.5 + k * 0.35), rc.pal); }); F.crack(x, y, r, rc.el, { rays: 9 }); F.debris(x, y, 70, 16); F.shakeReq(7); },
  missiles: (F, rc, x, y) => { F.arcaneBurst(x, y, 34); for (let i = 0; i < 6; i++) partOf(F, rc, 'star', x, y - 12, (R() - 0.5) * 200, (R() - 0.5) * 120, 0.5); },
  frostbolt: (F, rc, x, y) => { F.shatter(x, y); F.frost(x, y, 34, 2.5); },
  breath: (F, rc, x, y, r, a, f) => { const arc = ((f.arc || 70) * Math.PI) / 180, L = f.r || r; for (let i = 0; i < 70; i++) later(R() * 0.35, () => { const b = a + (R() - 0.5) * arc, s = L * (1.6 + R()); F.add({ x: x + Math.cos(a) * 16, y: y - 14 + Math.sin(a) * 8, vx: Math.cos(b) * s, vy: Math.sin(b) * s * 0.55 - 20, life: 0.55, pal: rc.el === 'fire' ? PAL.fire : rc.pal, size: 3 + R() * 3, size2: 6, drag: 0.93 }); }); later(0.2, () => { for (let k = 0; k < 4; k++) F.scorch(...front(x, y, a + (R() - 0.5) * arc, L * (0.4 + k * 0.15)), 22, rc.el); }); later(0.3, () => F.smoke(...front(x, y, a, L * 0.7), 6, 40, 30, 1.2)); },
  prism: (F, rc, x, y, r, a, f) => { const L = f.len || 300; const cols = [['#ffffff', '#ffb0b0', '#ff4a4a', '#801010', '#200000'], ['#ffffff', '#b0ffb0', '#4aff4a', '#108010', '#002000'], ['#ffffff', '#b0c8ff', '#4a7aff', '#102080', '#000020']]; cols.forEach((pal, i) => later(i * 0.03, () => F.beamFx(x, y - 14, ...front(x, y - 14, a + (i - 1) * 0.06, L), 8, pal, 0.4))); },
  acid: (F, rc, x, y, r) => { F.puddle(x, y, r, rc.pal[3], 5); },
  holylight: (F, rc, x, y, r) => { F.column(x, y, 22, 420, rc.el === 'holy' ? PAL.holy : rc.pal, 0.9); F.groundGlow(x, y, r, rc.glowC, 1.4); emblem(F, { ...rc, emb: 'cross' }, x, y - 40, 2, 0.9, 20); F.sparks(x, y - 10, 'holy', 14, 160); },
  exorcism: (F, rc, x, y, r) => { F.sigilBurn(x, y, r, rc.pal, 4, 1, 3); F.flashScreen('#fff8d8', 0.4, 0.25); const pts = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]; pts.forEach(([i, j], k) => later(k * 0.08, () => { F.column(x + i * r * 0.45, y + j * r * 0.22, 18, 380, PAL.holy, 0.9); F.groundGlow(x + i * r * 0.45, y + j * r * 0.22, 50, '#ffe080', 1.5); })); },
  // control
  frostring: (F, rc, x, y, r) => { ringSpikes(F, rc, x, y, r, 18, 40); F.frost(x, y, r * 1.1); },
  quagmire: (F, rc, x, y, r) => { F.puddle(x, y, r, '#5a4a2a', 5); F.dust(x, y, r * 0.5); },
  slowfield: (F, rc, x, y, r) => { clock(F, rc, x, y, r * 0.6, -1); for (let i = 0; i < 16; i++) F.add({ x: x + (R() - 0.5) * r, y: y - 60 - R() * 40, vx: 0, vy: 30, life: 1.4, pal: ['#fff0c0', '#c8a860'], size: 1.5, drag: 1 }); },
  curse: (F, rc, x, y, r) => { F.sigilBurn(x, y, r * 0.6, ['#ffffff', '#c87aff', '#6a2aa8', '#2a0a4a', '#000'], 5, 2, 2.5); emblem(F, { ...rc, emb: 'skull', pal: ['#ffffff', '#c87aff', '#6a2aa8'] }, x, y - 40, 3, 1, 20); for (let i = 0; i < 10; i++) F.add({ x: x + (R() - 0.5) * r, y, vx: 0, vy: -40, life: 1.2, pal: PAL.shadow, shape: 'wisp', size: 3 }); },
  stonecurse: (F, rc, x, y, r) => { F.crack(x, y, r * 0.8, 'physical', { rays: 8 }); F.debris(x, y, 40, 10, ['#c8c8c8', '#6a6a6a']); F.flashScreen('#a8a8a8', 0.15, 0.15); F.add({ x, y: y - 20, vx: 0, vy: 0, shape: 'ring', life: 0.6, r0: 4, r1: r, pal: ['#ffffff', '#a8a8a8'], size: 3 }); },
  provoke: (F, rc, x, y) => { shout(F, rc, x, y, 3, '#ff5a3a'); emblem(F, { ...rc, emb: 'crown', pal: ['#ffffff', '#ffa08a', '#d83a2a'] }, x, y - 60, 3, 0.9, 20); },
  timewarp: (F, rc, x, y, r) => { clock(F, rc, x, y, r * 0.7, -1); F.sigilBurn(x, y, r * 0.9, rc.pal, 12, 5, 2); },
  lex: (F, rc, x, y) => { F.sigilBurn(x, y, 40, PAL.holy, 8, 3, 2); MOD_FX.lex(F, rc, x, y); F.column(x, y, 6, 200, PAL.holy, 0.5); },
  smoke: (F, rc, x, y, r) => { for (let k = 0; k < 3; k++) later(k * 0.1, () => F.smoke(x, y, 10, r, 12, 2.2, true)); },
  hush: (F, rc, x, y, r) => { for (let k = 0; k < 4; k++) F.shock(x, y - 20, r * (0.4 + k * 0.2), ['#ffffff', '#8a8aa8', '#3a3a5a'], 0.5, k * 0.1); MOD_FX.silence(F, rc, x, y); },
  repulse: (F, rc, x, y, r) => { F.shock(x, y, r * 1.4, rc.pal); F.shock(x, y, r, rc.pal, 0.4, 0.06); for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; F.add({ x: x + Math.cos(a) * 20, y: y - 10 + Math.sin(a) * 10, vx: Math.cos(a) * 420, vy: Math.sin(a) * 210, life: 0.3, pal: ['#ffffff', rc.pal[1]], shape: 'spark', size: 2, drag: 0.95 }); } F.dust(x, y, r); },
  entangle: (F, rc, x, y, r) => vines(F, x, y, r, 14),
  fear: (F, rc, x, y, r) => { MOD_FX.fear(F, rc, x, y); F.smoke(x, y, 8, r, 20, 1.4, true); F.flashScreen('#200030', 0.25, 0.25); },
  // heal
  heal: (F, rc, x, y) => { F.column(x, y, 14, 160, PAL.heal, 0.7); F.healBurst(x, y, 50); },
  sanctuary: (F, rc, x, y, r) => { F.groundGlow(x, y, r, '#7aff9a', 4); F.sigilBurn(x, y, r * 0.9, PAL.heal, rc.sides, rc.step, 4); },
  purify: (F, rc, x, y, r) => { MOD_FX.cleanse(F, rc, x, y); for (let i = 0; i < 12; i++) F.add({ x: x + (R() - 0.5) * r, y: y - R() * 30, vx: 0, vy: -50, life: 1, pal: ['#ffffff', '#c8fff8', '#5ac8ff'], shape: 'bubble', size: 2 + R() * 3, add: false }); },
  safetywall: (F, rc, x, y) => { F.column(x, y, 34, 140, rc.pal, 1.4); for (let i = 0; i < 16; i++) partOf(F, rc, 'p_hex', x, y, 0, 0, 1.4, { orb: { cx: x, cy: y - 20, a0: (i / 16) * TAU, spin: 1.5, r0: 36, r1: 34, lift: 50 } }); },
  drain: (F, rc, x, y) => { for (let i = 0; i < 10; i++) F.add({ x, y: y - 14, vx: (R() - 0.5) * 80, vy: -80 - R() * 60, life: 0.9, shape: 'bmp', key: 'p_heart', c1: '#d82a4a', c2: '#ff8aa8', size: 2, add: false, drag: 0.96 }); F.add({ x, y: y - 14, vx: 0, vy: 0, shape: 'ring', life: 0.5, r0: 40, r1: 4, pal: ['#ffffff', '#ff4a6a'], size: 2 }); },
  renew: (F, rc, x, y) => { for (let i = 0; i < 12; i++) partOf(F, rc, 'p_leaf', x, y, 0, 0, 1.2, { orb: { cx: x, cy: y, a0: (i / 12) * TAU, spin: 3, r0: 30, r1: 14, lift: 70 } }); F.groundGlow(x, y, 50, '#7aff9a', 1.2); },
  massheal: (F, rc, x, y, r) => { F.groundGlow(x, y, r, '#7aff9a', 1.8); F.column(x, y, 30, 300, PAL.heal, 1); for (let i = 0; i < 30; i++) F.add({ x: x + (R() - 0.5) * r * 1.6, y: y + (R() - 0.5) * r * 0.6, vx: 0, vy: -60 - R() * 40, life: 1.2, pal: PAL.heal, shape: 'plus', size: 2 + R() * 2 }); },
  lifelink: (F, rc, x, y) => { for (let i = 0; i < 8; i++) F.add({ x, y, vx: 0, vy: 0, life: 1.2, shape: 'bmp', key: 'chain', c1: '#ff6a8a', c2: '#ffd0d8', size: 1, add: false, orb: { cx: x, cy: y - 20, a0: (i / 8) * TAU, spin: 3, r0: 34, r1: 34 } }); },
  // summon (portal + creature-specific signature)
  raisedead: (F, rc, x, y) => { F.sigilBurn(x, y, 50, rc.pal, 5, 2, 2); for (let i = 0; i < 5; i++) F.spike(x + (R() - 0.5) * 50, y + (R() - 0.5) * 20, 26, 4, 'bone', i * 0.05, 1); F.debris(x, y, 30, 8, ['#8a7a6a', '#3a2a22']); },
  golem: (F, rc, x, y) => { F.crater(x, y, 40, rc.el); F.debris(x, y, 70, 18); F.shock(x, y, 100, rc.pal); F.shakeReq(6); },
  wolves: (F, rc, x, y) => { F.dust(x, y, 40); for (let i = 0; i < 4; i++) F.add({ x: x + (R() - 0.5) * 50, y: y + (R() - 0.5) * 20, vx: 0, vy: -10, life: 1, shape: 'bmp', key: 'paw', c1: rc.pal[2], c2: rc.pal[1], size: 2, add: false }); },
  familiar: (F, rc, x, y) => { for (let i = 0; i < 14; i++) partOf(F, rc, 'wisp', x, y, 0, 0, 1, { orb: { cx: x, cy: y, a0: (i / 14) * TAU, spin: 5, r0: 30, r1: 4, ease: 1, lift: 40 } }); },
  decoy: (F, rc, x, y) => { F.smoke(x, y, 8, 30, 20, 1); F.add({ x, y: y - 20, vx: 0, vy: 0, shape: 'ring', life: 0.4, r0: 4, r1: 40, pal: ['#ffffff', rc.pal[2]], size: 3 }); },
  turret: (F, rc, x, y) => { F.debris(x, y, 30, 8, ['#d8d8e0', '#5a5a6a']); F.sparks(x, y - 10, 'physical', 16, 200); emblem(F, { ...rc, emb: 'gear' }, x, y - 40, 2, 0.8, 20); },
  stormtotem: (F, rc, x, y) => { F.strike(x, y, rc.el === 'physical' ? 'lightning' : rc.el, 300); F.crack(x, y, 40, 'lightning'); },
  healtotem: (F, rc, x, y) => { F.groundGlow(x, y, 60, '#7aff9a', 1.5); F.healBurst(x, y, 40); },
  falcon: (F, rc, x, y) => { F.streak(x - 200, y - 200, Math.PI / 4, 280, 6, rc.pal, 0.25); for (let i = 0; i < 10; i++) partOf(F, rc, 'p_feather', x, y - 20, (R() - 0.5) * 140, -40 - R() * 60, 1.2, { g: 40 }); },
  guardian: (F, rc, x, y) => { F.column(x, y, 26, 300, PAL.holy, 1); F.groundGlow(x, y, 60, '#ffe080', 1.5); },
  drones: (F, rc, x, y) => { orbitOrbs(F, rc, x, y, 4, 40, 1.2, 40); F.sparks(x, y - 30, 'physical', 10, 150); },
  wraiths: (F, rc, x, y) => { F.shadowBurst(x, y, 60); for (let i = 0; i < 10; i++) F.add({ x: x + (R() - 0.5) * 60, y, vx: 0, vy: -60, life: 1.3, pal: PAL.shadow, shape: 'wisp', size: 4 }); },
  // move / traps
  charge: (F, rc, x, y) => { F.shock(x, y, 70, rc.pal); F.dust(x, y, 40); F.shakeReq(4); },
  blink: (F, rc, x, y) => F.arcaneBurst(x, y, 40),
  leap: (F, rc, x, y, r) => { F.crater(x, y, r * 0.5, rc.el); F.crack(x, y, r * 0.8, rc.el, { rays: 7 }); F.shock(x, y, r * 1.2, rc.pal); F.debris(x, y, 60, 14); F.dust(x, y, r); F.shakeReq(7); },
  phantomrush: (F, rc, x, y, r) => { for (let i = 0; i < 6; i++) later(i * 0.05, () => F.streak(x + (R() - 0.5) * 80, y - 14 + (R() - 0.5) * 40, R() * TAU, 70, 4, rc.pal, 0.18)); },
  roll: (F, rc, x, y) => F.dust(x, y, 26),
  blasttrap: (F, rc, x, y, r) => boom(F, rc, x, y, r),
  freezetrap: (F, rc, x, y, r) => { ringSpikes(F, { ...rc, el: 'ice' }, x, y, r * 0.5, 10, 36, 'ice'); F.iceBurst(x, y, r * 0.7); F.frost(x, y, r); },
  minefield: (F, rc, x, y) => boom(F, rc, x, y, 55, { quiet: 1 }),
  caltrops: (F, rc, x, y, r) => { F.debris(x, y, r, 14, ['#c8c8d0', '#4a4a58']); },
  corpse: (F, rc, x, y, r) => { boom(F, rc, x, y, r); F.debris(x, y, 70, 12, ['#f0e8d0', '#8a7a6a']); MOD_FX.bleed(F, rc, x, y); },
  shadowstep: (F, rc, x, y) => { F.implosion(x, y, 50, 'shadow'); F.smoke(x, y, 6, 24, 20, 0.8, true); },
  grapple: (F, rc, x, y) => { F.dust(x, y, 30); F.sparks(x, y - 10, 'physical', 8, 180); },
};
// buffs: aura choreography on the target
const B = {
  blessing: (F, rc, x, y) => { F.column(x, y, 10, 180, PAL.holy, 0.8); for (let i = 0; i < 10; i++) partOf(F, rc, 'p_feather', x + (R() - 0.5) * 50, y - 90, (R() - 0.5) * 20, 30, 1.4, { g: 10, drag: 0.99 }); F.add({ x, y: y - 58, vx: 0, vy: 0, shape: 'ring', life: 1, r0: 12, r1: 14, pal: ['#ffffff', '#ffe080'], size: 3 }); },
  agility: (F, rc, x, y) => { for (let i = 0; i < 12; i++) F.add({ x: x + 30, y: y - 6 - R() * 40, vx: -300, vy: 0, life: 0.3, pal: ['#ffffff', '#a8f0ff'], shape: 'spark', size: 1.5, drag: 1 }); for (let i = 0; i < 8; i++) partOf(F, rc, 'p_feather', x, y, 0, 0, 0.9, { orb: { cx: x, cy: y - 20, a0: (i / 8) * TAU, spin: 8, r0: 26, r1: 30, lift: 30 } }); },
  endure: (F, rc, x, y) => { for (let i = 0; i < 10; i++) F.add({ x, y, vx: 0, vy: 0, life: 1, shape: 'fn', add: false, orb: { cx: x, cy: y - 20, a0: (i / 10) * TAU, spin: 1.5, r0: 34, r1: 24 }, draw: (ctx, X, Y) => { ctx.fillStyle = '#8a7a6a'; ctx.fillRect(X - 3, Y - 3, 6, 6); ctx.fillStyle = '#c8b898'; ctx.fillRect(X - 3, Y - 3, 5, 2); } }); F.dust(x, y, 30); },
  steelbody: (F, rc, x, y) => { F.add({ x, y: y - 24, vx: 0, vy: 0, life: 0.6, shape: 'fn', add: false, draw: (ctx, X, Y, u) => { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffffff'; ctx.globalAlpha *= 0.7; ctx.fillRect(X - 20 + u * 40, Y - 30, 6, 60); ctx.globalCompositeOperation = 'source-over'; } }); MOD_FX.shield(F, rc, x, y); F.sparks(x, y - 24, 'physical', 12, 160); },
  berserk: (F, rc, x, y) => { for (let i = 0; i < 24; i++) later(i * 0.03, () => F.flame(x + (R() - 0.5) * 30, y, 1, 6, 120, 3, 0.6)); F.flashScreen('#600000', 0.25, 0.25); shout(F, rc, x, y, 2, '#ff3a2a'); },
  reflect: (F, rc, x, y) => { for (let i = 0; i < 6; i++) F.add({ x, y, vx: 0, vy: 0, life: 1.2, shape: 'bmp', key: 'p_hex', c1: '#c8e8ff', c2: '#ffffff', size: 3, add: false, glow: '#a8d8ff', orb: { cx: x, cy: y - 22, a0: (i / 6) * TAU, spin: 2.5, r0: 30, r1: 30 } }); },
  autoguard: (F, rc, x, y) => { emblem(F, { ...rc, emb: 'shield' }, x, y - 30, 3, 0.9, 10); F.shock(x, y, 50, rc.pal); },
  kyrie: (F, rc, x, y) => { for (let i = 0; i < 20; i++) F.add({ x, y, vx: 0, vy: 0, life: 1, shape: 'bmp', key: 'p_hex', c1: '#7ad8ff', c2: '#e0f8ff', size: 2, add: false, orb: { cx: x, cy: y - 20, a0: (i / 20) * TAU, spin: 1, r0: 10, r1: 36, ease: 1, lift: 10 } }); F.light(x, y - 20, 90, '#7ad8ff', 0.5); },
  enchant: (F, rc, x, y) => { for (let i = 0; i < 16; i++) partOf(F, rc, 'spark', x + 10, y - 26, (R() - 0.5) * 120, -80 - R() * 60, 0.5); eflame(F, rc, x + 10, y - 26, 6, 8, 60, 2, 0.5); },
  magnificat: (F, rc, x, y) => { for (let i = 0; i < 8; i++) F.add({ x: x + (R() - 0.5) * 50, y: y - 20, vx: (R() - 0.5) * 30, vy: -50, life: 1.4, shape: 'bmp', key: 'note', c1: rc.pal[2], c2: rc.pal[1], size: 2, add: false, drag: 0.99 }); },
  lifetap: (F, rc, x, y) => { for (let i = 0; i < 12; i++) F.add({ x, y, vx: 0, vy: 0, life: 0.7, shape: 'bmp', key: 'p_drop', c1: '#c0102a', c2: '#ff5a5a', size: 2, add: false, orb: { cx: x, cy: y - 20, a0: (i / 12) * TAU, spin: 3, r0: 50, r1: 2, ease: 1 } }); },
  spheres: (F, rc, x, y) => orbitOrbs(F, rc, x, y, 5, 30, 2, 30),
  cloak: (F, rc, x, y) => { F.smoke(x, y, 8, 26, 20, 1, true); F.add({ x, y: y - 22, vx: 0, vy: 0, shape: 'ring', life: 0.5, r0: 30, r1: 4, pal: ['#ffffff', '#6a3ac8'], size: 2 }); },
  devotion: (F, rc, x, y) => { F.column(x, y, 8, 140, PAL.holy, 0.7); for (let i = 0; i < 8; i++) F.add({ x, y, vx: 0, vy: 0, life: 1.2, shape: 'bmp', key: 'chain', c1: '#ffe080', c2: '#ffffff', size: 1, add: false, orb: { cx: x, cy: y - 20, a0: (i / 8) * TAU, spin: 2, r0: 34, r1: 34 } }); },
  focus: (F, rc, x, y) => { emblem(F, { ...rc, emb: 'eye' }, x, y - 60, 2, 1, 10); F.add({ x, y: y - 20, vx: 0, vy: 0, shape: 'ring', life: 0.6, r0: 60, r1: 8, pal: ['#ffffff', rc.pal[2]], size: 2 }); },
  hasteaura: (F, rc, x, y) => { for (let k = 0; k < 4; k++) F.shock(x, y, 120, rc.pal, 0.3, k * 0.06); B.agility(F, rc, x, y); },
  warcry: (F, rc, x, y) => { shout(F, rc, x, y, 4); F.dust(x, y, 40); F.shakeReq(5); emblem(F, { ...rc, emb: 'crown' }, x, y - 60, 2, 0.8, 20); },
};
// projectile look per mechanic
const PROJ = { fireball: 'orb', jupitel: 'plasma', soulstrike: 'ghost', napalm: 'ghost', missiles: 'star', icespear: 'crystal', frostbolt: 'crystal', chargedshot: 'plasma', tracer: 'tracer', sniper: 'tracer', wave: 'crescent', boomerang: 'spin', fan: 'glyph', cluster: 'bomb', explosive: 'bomb', timebomb: 'bomb', net: 'net', bolts: 'plasma', chainl: 'plasma' };

const DEF = (n) => (n == null ? null : SKILL_LIST[n]);
export const MOVES = {
  has: (n) => !!DEF(n),
  cast(F, rc, n, x, y, ang) {
    const d = DEF(n); if (!d) return; const fam = sigFam(d.sig);
    if (['spell', 'control', 'heal', 'summon'].includes(fam) || rc.ult) glyphCircle(F, rc, x, y + 2, rc.ult ? 80 : 36, rc.ult ? 1.1 : 0.6);
    if (fam === 'spell' || d.sig === 'chargedshot' || d.sig === 'sniper') F.charge(x + Math.cos(ang) * 16, y - 26, rc.pal, 44, 0.3);
    if (fam === 'strike' || fam === 'sweep') { F.add({ x: x + Math.cos(ang) * 14, y: y - 30, vx: 0, vy: 0, life: 0.15, pal: ['#ffffff', rc.pal[1]], shape: 'star', size: 6, size2: 2, rot: 0, vr: 0 }); }
    if (fam === 'shot') { const fx = x + Math.cos(ang) * 22, fy = y - 18 + Math.sin(ang) * 12; F.add({ x: fx, y: fy, vx: 0, vy: 0, life: 0.1, pal: ['#ffffff', rc.pal[1], rc.pal[2]], shape: 'star', size: 8, size2: 3, rot: ang, vr: 0 }); F.light(fx, fy, 40, rc.glowC, 0.1); }
    SFX.cast(F, rc, x, y, ang, true); // class flourish (muzzle, halo, petals …)
  },
  impact(F, rc, n, f) {
    const d = DEF(n); if (!d) return; const h = H[d.sig]; const ul = rc.ult ? 1.35 : 1;
    const r = Math.max(30, Math.min(300, (f.r || f.len || 60))) * ul, a = f.ang || 0;
    if (h) h(F, rc, f.x, f.y, r, a, f); else boom(F, rc, f.x, f.y, r);
    if (f.minor) { F.shakeN = Math.min(F.shakeN || 0, 3); F.scr = F.scr && F.scr.a < 0.3 ? F.scr : null; return; }
    const fam = sigFam(d.sig);
    if (!['strike', 'sweep', 'shot', 'move'].includes(fam) || rc.ult) stamp(F, rc, f.x, f.y, rc.ult ? 5 : 2);
    mods(F, rc, f.x, f.y, r, a);
    if (rc.ult) { F.flashScreen(rc.pal[1], 0.35, 0.25); F.shakeReq(10); glyphCircle(F, rc, f.x, f.y, r, 1.2); }
  },
  fieldStart(F, rc, n, f) { const d = DEF(n); if (!d) return; const h = H[d.sig]; if (h) h(F, rc, f.x, f.y, f.r || f.len || 60, f.ang || 0, f); },
  field(F, rc, n, f, dt) {
    const d = DEF(n); if (!d) return; const r = f.r || f.len || 60; if (R() > Math.min(1, (r * r) / 9000) * dt * 50) return;
    const a = R() * TAU, dd = r * Math.sqrt(R()); let px = f.x + Math.cos(a) * dd, py = f.y + Math.sin(a) * dd * 0.5;
    if (f.shape === 'line') { const k = R() - 0.5, L = f.len || r; px = f.x + Math.cos(f.ang || 0) * L * (k + 0.5); py = f.y + Math.sin(f.ang || 0) * L * (k + 0.5) * 0.6; }
    switch (d.sig) {
      case 'firewall': eflame(F, rc, px, py, 3, 10, 150, 4, 0.7); break;
      case 'blizzard': case 'stormgust': F.add({ x: px + 60, y: py - 120, vx: -120, vy: 260, life: 0.5, pal: PAL.ice, shape: 'shard', size: 3, rot: 0.6, vr: 0, add: false, drag: 1 }); break;
      case 'thunderstorm': case 'vermilion': if (R() < 0.15) { F.strike(px, py, 'lightning', 280); F.crack(px, py, 26, 'lightning', { rays: 3, life: 1.2 }); } break;
      case 'static': if (R() < 0.3) F.bolt(px, py, px + (R() - 0.5) * 60, py + (R() - 0.5) * 30, rc.pal[1], 0.12, 1.2, 0); break;
      case 'acid': F.add({ x: px + 20, y: py - 140, vx: -40, vy: 380, life: 0.36, pal: rc.pal, shape: 'spark', size: 2, drag: 1 }); if (R() < 0.4) F.add({ x: px, y: py, vx: 0, vy: 0, shape: 'ring', life: 0.3, r0: 1, r1: 8, pal: ['#ffffff', rc.pal[2]], size: 1 }); break;
      case 'quagmire': F.add({ x: px, y: py, vx: 0, vy: -10, life: 0.8, pal: ['#c8b888', '#5a4a2a'], shape: 'bubble', size: 2 + R() * 3, add: false }); break;
      case 'sanctuary': case 'healtotem': F.add({ x: px, y: py, vx: 0, vy: -50, life: 1.1, pal: PAL.heal, shape: 'plus', size: 2 }); break;
      case 'gravity': partOf(F, rc, 'spark', px, py, (f.x - px) * 2, (f.y - py) * 2, 0.4); break;
      case 'smoke': if (R() < 0.3) F.smoke(px, py, 1, 20, 8, 1.6, true); break;
      case 'tornado': case 'cyclone': partOf(F, rc, rc.part, f.x, f.y, 0, 0, 0.9, { orb: { cx: f.x, cy: f.y, a0: R() * TAU, spin: 8, r0: r * 0.3, r1: r * 0.7, lift: 120 } }); break;
      case 'caltrops': case 'minefield': break;
      default: eflame(F, rc, px, py, 1, 6, 60, 2, 0.6); if (R() < 0.3) partOf(F, rc, rc.part, px, py, 0, -40, 0.8, { g: -10 });
    }
  },
  beam(F, rc, n, x1, y1, x2, y2, w) { const d = DEF(n); F.beamFx(x1, y1, x2, y2, Math.max(6, (w || 20) * 0.45), rc.pal, 0.35); if (d && H[d.sig] && (d.sig === 'thrust' || d.sig === 'pierceshot')) { const a = Math.atan2(y2 - y1, x2 - x1); H.thrust(F, rc, x1, y1 + 14, 0, a, { len: Math.hypot(x2 - x1, y2 - y1) }); } F.sparks(x2, y2, rc.el, 14, 220); },
  dash(F, rc, n, x1, y1, x2, y2) {
    const d = DEF(n); const sig = d?.sig;
    F.speedLines(x1, y1, x2, y2, rc.pal, 12);
    for (let i = 0; i < 5; i++) { const k = i / 5; F.add({ x: x1 + (x2 - x1) * k, y: y1 - 26 + (y2 - y1) * k, vx: 0, vy: 0, life: 0.25 + k * 0.25, shape: 'bmp', key: rc.emb, c1: rc.pal[3], c2: rc.pal[2], size: 2, alpha: 0.45, add: false }); }
    if (sig === 'blink' || sig === 'shadowstep') { F.implosion(x1, y1, 40, rc.el === 'physical' ? 'arcane' : rc.el); later(0.1, () => F.arcaneBurst(x2, y2, 40)); }
    else for (let i = 0; i < 6; i++) F.dust(x1 + (x2 - x1) * i / 6, y1 + (y2 - y1) * i / 6, 14);
  },
  buff(F, rc, n, x, y) { const d = DEF(n); if (!d) return; (B[d.sig] || H[d.sig] || ((F2) => SFX.buff(F2, rc, x, y)))(F, rc, x, y, 50, 0, {}); mods(F, rc, x, y, 40, 0); },
  hit(F, rc, n, x, y, crit) {
    const d = DEF(n); if (!d) return; const fam = sigFam(d.sig);
    if (fam === 'strike' || fam === 'sweep') F.smear(x, y, 18, R() * TAU, rc.pal, { arc: 1.4, life: 0.16, th: 0.5 });
    F.sparks(x, y, rc.el, crit ? 10 : 4, crit ? 240 : 150); if (R() < 0.5) partOf(F, rc, rc.part, x, y, (R() - 0.5) * 160, -60, 0.4);
    if (crit) { F.add({ x, y, vx: 0, vy: 0, life: 0.22, pal: ['#ffffff', '#ffe14a'], shape: 'star', size: 12, size2: 3, rot: 0, vr: 3 }); F.light(x, y, 50, '#fff4c0', 0.12); }
  },
  projStyle: (n) => PROJ[DEF(n)?.sig] || 'glyph',
  drawProj(ctx, rc, n, x, y, p, t) {
    const st = MOVES.projStyle(n), ang = Math.atan2(p.vy, p.vx), r = Math.max(4, (p.r || 6) * 0.9) * (rc.ult ? 1.5 : 1);
    switch (st) {
      case 'orb': case 'plasma': case 'ghost': return drawOrb(ctx, x, y, r, rc.pal, t, st);
      case 'star': { drawOrb(ctx, x, y, r * 0.6, rc.pal, t); ctx.save(); ctx.translate(x, y); ctx.rotate(t * 10); ctx.fillStyle = '#ffffff'; ctx.fillRect(-r * 1.6, -1, r * 3.2, 2); ctx.fillRect(-1, -r * 1.6, 2, r * 3.2); ctx.restore(); return; }
      case 'crystal': { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.fillStyle = rc.pal[2]; ctx.fillRect(-r * 3, -r * 0.6, r * 3, r * 1.2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = rc.pal[3]; ctx.beginPath(); ctx.moveTo(r * 2.4, 0); ctx.lineTo(-r * 0.6, -r * 0.8); ctx.lineTo(-r * 1.2, 0); ctx.lineTo(-r * 0.6, r * 0.8); ctx.closePath(); ctx.fill(); ctx.fillStyle = rc.pal[1]; ctx.beginPath(); ctx.moveTo(r * 2.4, 0); ctx.lineTo(-r * 0.6, -r * 0.8); ctx.lineTo(-r * 0.2, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r * 2.2, 0); ctx.lineTo(-r * 0.8, 0); ctx.stroke(); ctx.restore(); return; }
      case 'tracer': { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rc.pal[2]; ctx.globalAlpha = 0.5; ctx.fillRect(-70, -2, 70, 4); ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; ctx.fillRect(-40, -1, 44, 2); ctx.globalCompositeOperation = 'source-over'; ctx.restore(); return; }
      case 'crescent': { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 3; k++) { ctx.strokeStyle = k === 2 ? '#ffffff' : rc.pal[2 - k]; ctx.lineWidth = 6 - k * 2; ctx.beginPath(); ctx.ellipse(-4 * k, 0, r * 1.2, r * 3, 0, -1.2, 1.2); ctx.stroke(); } ctx.globalCompositeOperation = 'source-over'; ctx.restore(); return; }
      case 'spin': { ctx.save(); ctx.translate(x, y); ctx.rotate(t * 24); const img = glyphSprite(rc.projEmb, rc.pal[2], rc.pal[1]); ctx.drawImage(img, -img.width, -img.height, img.width * 2, img.height * 2); ctx.restore(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rc.pal[1]; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; return; }
      case 'bomb': { ctx.fillStyle = '#2a2a32'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#6a6a78'; ctx.fillRect(x - r * 0.5, y - r * 0.6, r * 0.5, r * 0.4); ctx.fillStyle = (t * 8) % 1 < 0.5 ? '#ff3a2a' : '#ffe14a'; ctx.fillRect(x - 1, y - r - 4, 3, 3); return; }
      case 'net': { ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x - r * 2, y + i * r * 0.4); ctx.lineTo(x + r * 2, y + i * r * 0.4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + i * r * 0.8, y - r); ctx.lineTo(x + i * r * 0.8, y + r); ctx.stroke(); } return; }
      default: return SFX.drawProj(ctx, rc, x, y, p, t);
    }
  },
};
const FAM = {}; let famReady = false;
function sigFam(sig) { if (!famReady) { for (const d of SKILL_LIST) FAM[d.sig] = FAM[d.sig] || famOf(d); famReady = true; } return FAM[sig] || 'spell'; }
import { SIG_BY_ID } from '/shared/signatures.js';
function famOf(d) { return SIG_BY_ID[d.sig]?.fam || 'spell'; }
export const HANDLED = () => Object.keys(H).length + Object.keys(B).length;
export { H as MOVE_IMPACTS, B as MOVE_BUFFS };
