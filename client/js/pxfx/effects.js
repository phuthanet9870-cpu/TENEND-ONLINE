// ===== PXFX effect library (original effects for TENEND ONLINE, drawn with core.js) =====
// Local space: art pixels (1 art px = 2 screen px), origin at the target's feet, y down.
// The floor plane is squashed by SY (top-down 3/4 view). o.P = 8-step palette dark→bright, o.F = fire ramp bright→dark.
import { TAU, clamp, lerp, smooth, easeOut, outBack, WHITE, hex, mix, ramp, rampAt, Parts, Bits, Lights, K, BK, sparkle, flare, band, crystal, boltPath, drawBolt } from './core.js';
import { GLYPHS } from '../fxglyphs.js';
export const SY = 0.5;
const DARK = hex('#140c0a'), DIRT = ramp(['#3a2a1e', '#6a5440', '#a08a6a', '#d8c8a8'], 4), STONE = ramp(['#2a2420', '#5a5048', '#8a8078', '#c8c0b8'], 4);
const SMOKE_DARK = ramp(['#120c18', '#221a2a', '#3a2e44', '#544660'], 4);

class E {
  constructor(o, dur) { this.o = o; this.t = 0; this.dur = dur; this.R = o.rng; this.P = o.P; this.ps = new Parts(o.rng, { fire: o.F, haze: o.P[5] }); this.bits = new Bits(); this.lights = new Lights(); }
  update(dt) { this.t += dt; if (this.step) this.step(dt, this.t); this.ps.update(dt); this.bits.update(dt); this.lights.update(dt); }
  done() { return this.t >= this.dur; }
  back(p) { if (this.drawBack) this.drawBack(p, this.t); this.ps.draw(p, 'back'); }
  front(p) { if (this.drawFront) this.drawFront(p, this.t); this.bits.draw(p); this.ps.draw(p, 'front'); this.lights.draw(p); }
  once(key, at, fn) { if (!this['_' + key] && this.t >= at) { this['_' + key] = 1; fn(); } }
}
const mk = (o, dur, def) => Object.assign(new E(o, dur), def);
const rnd = (R, a, b) => R.range(a, b);

// ---- shared bursts ----
function sparks(e, x, y, n, sp = 140, up = 0.6, fl = 0, col) { const R = e.R; for (let i = 0; i < n; i++) { const a = rnd(R, 0, TAU), s = rnd(R, sp * 0.4, sp); e.ps.spawn(K.SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s * up - rnd(R, 20, 90), rnd(R, 0.3, 0.7), col ?? R.pick([e.P[7], e.P[6], e.P[5]]), 1, { floor: fl + rnd(R, -2, 4) }); } }
function grit(e, x, y, n, sp = 120, col = DIRT, fl = 0) { const R = e.R; for (let i = 0; i < n; i++) { const a = rnd(R, Math.PI * 1.05, Math.PI * 1.95); e.bits.add({ kind: BK.CHUNK, x: x + rnd(R, -4, 4), y, vx: Math.cos(a) * rnd(R, sp * 0.3, sp), vy: Math.sin(a) * rnd(R, sp * 0.6, sp * 1.6), fl: fl + rnd(R, -3, 5), s: rnd(R, 1.5, 3.2), ramp: col, life: rnd(R, 0.9, 1.6), g: 1 }); } }
function dust(e, x, y, n, r = 10, col = DIRT[2]) { const R = e.R; for (let i = 0; i < n; i++) { const a = rnd(R, 0, TAU); e.ps.spawn(K.DUST, x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.2, Math.cos(a) * rnd(R, 20, 70), Math.sin(a) * rnd(R, 5, 20) - rnd(R, 2, 12), rnd(R, 0.5, 1), col, rnd(R, 2, 4)); } }
function cracks(R, r, rays, ang = null, spread = 0) {
  const segs = [];
  const grow = (x, y, a, len, w, d) => { const n = 4 + Math.floor(R.next() * 3); for (let i = 0; i < n; i++) { a += (R.next() - 0.5) * 0.9; const nx = x + Math.cos(a) * len / n, ny = y + Math.sin(a) * len / n * SY; segs.push([x, y, nx, ny, w * (1 - i / n * 0.6), d]); if (d < 2 && R.next() < 0.35) grow(nx, ny, a + R.sign() * (0.6 + R.next() * 0.5), len * 0.45, w * 0.6, d + 1); x = nx; y = ny; } };
  for (let i = 0; i < rays; i++) grow(0, 0, ang == null ? (i / rays) * TAU + R.next() * 0.5 : ang + (R.next() - 0.5) * spread, r * (0.55 + R.next() * 0.5), 1, 0);
  return segs;
}
function drawCracks(p, segs, k, glowC, gk, grow = 1) {
  const n = Math.ceil(segs.length * grow);
  for (let i = 0; i < n; i++) { const [x0, y0, x1, y1, w] = segs[i]; p.line(x0, y0, x1, y1, DARK, k); if (w > 0.7) p.line(x0, y0 + 1, x1, y1 + 1, DARK, k * 0.7); p.line(x0, y0 - 1, x1, y1 - 1, DIRT[1], k * 0.3); if (glowC && gk > 0.02) { p.line(x0, y0, x1, y1, glowC, Math.min(1, gk * 1.4)); p.glowLine(x0, y0, x1, y1, 4, glowC, 0.35 * gk); } }
}
function floorDither(p, r, k, cols) { if (r < 1 || k <= 0.01) return; const ry = r * SY; for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -r; i <= r; i++) { const d = Math.hypot(i / r, j / ry); if (d > 1) continue; const a = (1 - d) * k * 0.9; p.dot(i, j, cols[Math.min(cols.length - 1, Math.floor(d * cols.length))], a); } }
function emblem(p, key, P, x, y, a, scale = 1) { const rows = GLYPHS[key]; if (!rows) return; const w = Math.max(...rows.map((r) => r.length)), h = rows.length; const pal = { '#': P[5], '+': P[6], '*': WHITE }; p.sprite(rows, pal, Math.round(x - (w * scale) / 2), Math.round(y - (h * scale) / 2), a, scale); p.glow(x, y, w * scale * 1.2, P[5], 0.35 * a); }
const sweep = (t, t0, d = 0.07) => easeOut((t - t0) / d, 2);

// =================== EFFECTS ===================
export const FX = {
  /** crescent slash(es): arcs [{a0, a1, r, w, t0, sy, y}] — the leading edge white, tapering tail */
  slash(o) {
    const arcs = o.arcs || [{ a0: o.ang - 1.2, a1: o.ang + 1.2, r: o.r || 22, w: 7, t0: 0 }];
    return mk(o, Math.max(...arcs.map((a) => a.t0)) + 0.45, {
      step() { for (const [i, a] of arcs.entries()) this.once('s' + i, a.t0, () => { const tip = a.a1, y = a.y ?? -12, sy = a.sy ?? 0.55; const tx = Math.cos(tip) * a.r, ty = y + Math.sin(tip) * a.r * sy; sparks(this, tx, ty, 6, 160, 0.6, 0); this.lights.add(tx * 0.5, y, 30, this.P[5], 0.6, 0.25); }); },
      drawFront(p, t) {
        const P = this.P;
        for (const a of arcs) {
          const lt = t - a.t0; if (lt < 0 || lt > 0.32) continue;
          const s = sweep(t, a.t0), fade = lt < 0.1 ? 1 : 1 - (lt - 0.1) / 0.22, y = a.y ?? -12, sy = a.sy ?? 0.55;
          const lo = Math.min(a.a0, a.a1), hi = Math.max(a.a0, a.a1), rev = a.a1 < a.a0;
          const end = rev ? hi - (hi - lo) * s : lo + (hi - lo) * s, A0 = rev ? end : lo, A1 = rev ? hi : end;
          p.arc(0, y, a.r, (u) => a.w * Math.sin(Math.PI * clamp(rev ? 1 - u : u) * 0.5 + 0.05) * (0.4 + 0.6 * s), A0, A1, sy,
            (u, v) => { const lead = rev ? 1 - u : u; return v > 0.78 ? WHITE : lead > 0.8 ? P[7] : v > 0.45 ? P[6] : P[4]; },
            (u, v) => { const lead = rev ? 1 - u : u; return fade * clamp(lead * 1.4) * (v > 0.2 ? 1 : 0.6); });
          const mid = (A0 + A1) / 2; p.glow(Math.cos(mid) * a.r * 0.8, y + Math.sin(mid) * a.r * sy * 0.8, a.r * 0.9, P[5], 0.35 * fade);
        }
      },
    });
  },
  /** hit spark: flash star + sparks + small ring */
  hit(o) {
    const big = o.big ? 1.6 : 1;
    return mk(o, 0.5, {
      step() { this.once('a', 0, () => { sparks(this, 0, -12, Math.round(10 * big), 180 * big, 0.6, 0); this.lights.add(0, -12, 26 * big, this.P[5], 0.8, 0.2); }); },
      drawFront(p, t) { const u = t / 0.18; if (u < 1) { flare(p, 0, -12, 10 * big * (1 - u), 1 - u, this.P); p.ring(0, -12, 4 + 10 * big * easeOut(u), 1.5, 1, this.P[6], 1 - u); } },
    });
  },
  /** ground slam: shock band, glowing cracks, dust, grit, flare */
  slam(o) {
    const r = o.r || 40, segs = cracks(o.rng, r * 0.9, o.rays || 7, o.dirA ?? null, o.spread || 0), gl = o.el !== 'physical';
    return mk(o, 2.6, {
      step() { this.once('a', 0, () => { grit(this, 0, 0, 8, 130); dust(this, 0, 0, 8, r * 0.6); sparks(this, 0, -2, 12, 200, 0.4, 0); this.lights.add(0, -6, r * 1.2, this.P[5], 0.9, 0.4); this.lights.add(0, -6, r * 0.5, WHITE, 0.6, 0.12); }); },
      drawBack(p, t) { const k = t < 2 ? 1 : 1 - (t - 2) / 0.6; drawCracks(p, segs, k, gl ? this.P[6] : null, gl ? Math.max(0, 1 - t / 1.3) : 0, easeOut(t / 0.12)); const u = clamp(t / 0.4); if (u < 1) band(p, 0, 0, r * 1.1 * easeOut(u), SY, 4 * (1 - u) + 1, 1 - u, this.P, null, t < 0.05); },
      drawFront(p, t) { if (t < 0.14) flare(p, 0, -4, 16 * (1 - t / 0.14), 1, this.P); },
    });
  },
  /** explosion: fire-puff fireball, flare, shock band, embers, smoke column, grit, scorch */
  explode(o) {
    const r = o.r || 30, big = r > 45;
    return mk(o, 2.8, {
      step(dt, t) {
        this.once('a', 0, () => {
          const R = this.R;
          for (let i = 0; i < 22 + r * 0.6; i++) { const a = rnd(R, 0, TAU), s = rnd(R, 30, 110) * (r / 30); this.ps.spawn(K.FIRE, Math.cos(a) * 3, -8 + Math.sin(a) * 3, Math.cos(a) * s, Math.sin(a) * s * 0.7 - rnd(R, 10, 50), rnd(R, 0.35, 0.7), 0, rnd(R, 2.5, 5) * (r / 30), { smokes: R.chance(0.5) }); }
          for (let i = 0; i < 14; i++) { const a = rnd(R, Math.PI, TAU), s = rnd(R, 120, 260); this.ps.spawn(K.EMBER, 0, -8, Math.cos(a) * s, Math.sin(a) * s * 0.8, rnd(R, 0.8, 1.6), R.pick(this.o.F.slice(1, 4)), 1); }
          sparks(this, 0, -8, 16, 260, 0.7, 0); grit(this, 0, 0, 10, 160);
          this.lights.add(0, -10, r * 2.2, this.o.F[3], 1, 0.6); this.lights.add(0, -10, r, WHITE, 0.9, 0.12);
        });
        if (big && t > 0.15 && t < 0.9 && this.R.chance(0.5)) this.ps.spawn(K.FIRE, rnd(this.R, -3, 3), -10 - (t - 0.15) * 70, rnd(this.R, -8, 8), -40, 0.45, 0, rnd(this.R, 3, 5), { smokes: true });
        if (t > 0.2 && t < 1 && this.R.chance(0.25)) this.ps.spawn(K.SMOKE, rnd(this.R, -r * 0.5, r * 0.5), -6, rnd(this.R, -8, 8), -rnd(this.R, 10, 30), rnd(this.R, 1, 1.8), 0, rnd(this.R, 3, 5));
      },
      drawBack(p, t) { const k = t < 2.2 ? 1 : 1 - (t - 2.2) / 0.6; floorDither(p, Math.round(r * 0.8), k * 0.8, [DARK, hex('#2a1810'), hex('#3a2418')]); const u = clamp(t / 0.45); if (u < 1) band(p, 0, 0, r * 1.3 * easeOut(u), SY, 4 * (1 - u) + 1, 1 - u, this.P, null, t < 0.05); if (t < 1.4) for (let i = 0; i < 6; i++) p.light(Math.sin(i * 7.1) * r * 0.6, Math.cos(i * 3.3) * r * 0.25, this.o.F[3], (1 - t / 1.4) * (0.5 + 0.5 * Math.sin(t * 20 + i))); },
      drawFront(p, t) { if (t < 0.16) { flare(p, 0, -10, r * 0.9 * (1 - t / 0.16), 1, this.P); p.glow(0, -10, r * 1.2, WHITE, 0.7 * (1 - t / 0.16)); } },
    });
  },
  /** nova of crystals (ice / rock / bone / light) in rings, wave band, frosted floor, melt */
  crystals(o) {
    const r = o.r || 50, R = o.rng, CR = o.CR || o.P, sites = [];
    const rings = o.rings || [[0.25, 0.4, 3, 18, 26], [0.5, 0.7, 5, 10, 16], [0.8, 1, 7, 5, 10]];
    for (const [q0, q1, n, h0, h1] of rings) for (let i = 0; i < n; i++) { const a = (i / n) * TAU + R.next() * 0.6, q = lerp(q0, q1, R.next()); sites.push({ x: Math.cos(a) * r * q, y: Math.sin(a) * r * q * SY, h: rnd(R, h0, h1), w: rnd(R, 4, 8), lean: Math.cos(a) * rnd(R, 2, 7), t0: 0.05 + q * 0.3 + R.next() * 0.04, up: 0, gl: R.next() }); }
    sites.sort((a, b) => a.y - b.y);
    const HOLD = o.hold || 1.5;
    return mk(o, HOLD + 1, {
      step(dt, t) { for (const s of sites) if (!s.up && t >= s.t0) { s.up = 1; for (let i = 0; i < 3; i++) this.bits.add({ kind: BK.SHARD, x: s.x, y: s.y - 2, vx: rnd(this.R, -80, 80), vy: rnd(this.R, -220, -80), fl: s.y, s: rnd(this.R, 1.5, 3), c: CR[6], life: rnd(this.R, 0.6, 1.2), va: rnd(this.R, -16, 16) }); this.ps.spawn(K.VAPOUR, s.x, s.y, rnd(this.R, -20, 20), -4, 0.7, CR[6], 2.5); if (s.h > 12) this.ps.spawn(K.STAR, s.x, s.y - s.h * 0.7, 0, -3, 0.45, CR[6], 2); }
        this.once('a', 0, () => this.lights.add(0, -8, r, CR[5], 0.8, 0.6)); },
      drawBack(p, t) { const k = 1 - smooth(HOLD, HOLD + 0.8, t); if (o.frost !== false) floorDither(p, Math.round(r * easeOut(t / 0.4)), k * 0.55, [WHITE, CR[6], CR[5], CR[4]]); const u = clamp(t / 0.5); if (u < 1) band(p, 0, 0, r * easeOut(u) + 2, SY, 5 * (1 - u) + 1, 1 - u, CR, null, t < 0.06); },
      drawFront(p, t) { const m = smooth(HOLD, HOLD + 0.7, t); for (const s of sites) { if (!s.up || m >= 1) continue; const g = outBack((t - s.t0) / 0.1, 2.4), sw = ((t * 0.7 + s.gl * 3) % 1.6) / 0.5; crystal(p, s.x, s.y, s.h * g * (1 - m), s.w, s.lean * g, CR, { white: t < s.t0 + 0.03, glint: sw <= 1 ? sw : -1 }); } },
    });
  },
  /** spikes erupting along a line */
  spikeLine(o) {
    const L = o.len || 80, a = o.ang || 0, n = Math.max(4, Math.round(L / 9)), CR = o.CR || o.P, R = o.rng;
    const s = Array.from({ length: n }, (_, i) => ({ x: Math.cos(a) * L * (i + 1) / n + rnd(R, -3, 3), y: Math.sin(a) * L * (i + 1) / n * SY + rnd(R, -2, 2), h: rnd(R, 10, 24) * (o.hMul || 1), w: rnd(R, 5, 9), t0: i * 0.035, lean: rnd(R, -4, 4) }));
    const segs = []; for (let i = 0; i < n; i++) { const p0 = i ? s[i - 1] : { x: 0, y: 0 }; segs.push([p0.x, p0.y, s[i].x, s[i].y, 1]); }
    return mk(o, 2, {
      step(dt, t) { for (const q of s) if (!q.up && t >= q.t0) { q.up = 1; grit(this, q.x, q.y, 3, 100, o.rock ? DIRT : DIRT, q.y); dust(this, q.x, q.y, 2, 6); } },
      drawBack(p, t) { drawCracks(p, segs, 1 - smooth(1.4, 2, t), o.el !== 'physical' ? CR[6] : null, 1 - t / 1.2, clamp(t / (n * 0.035))); },
      drawFront(p, t) { const m = smooth(1.1, 1.6, t); for (const q of s) if (q.up) crystal(p, q.x, q.y, q.h * outBack((t - q.t0) / 0.09) * (1 - m), q.w, q.lean, CR, { white: t < q.t0 + 0.03, glint: -1 }); },
    });
  },
  /** pillar / column of element (fire, light, energy) */
  pillar(o) {
    const h = o.h || 110, w = o.w || 10;
    return mk(o, 1.6, {
      step(dt, t) { this.once('a', 0, () => { this.lights.add(0, -h * 0.4, h * 0.7, this.P[5], 0.9, 1); sparks(this, 0, -2, 12, 160, 0.5, 0); }); if (t < 1 && this.R.chance(0.9)) { const x = rnd(this.R, -w * 0.6, w * 0.6); this.ps.spawn(o.fire ? K.FIRE : K.MOTE, x, -rnd(this.R, 0, 10), rnd(this.R, -6, 6), -rnd(this.R, 120, 220), rnd(this.R, 0.4, 0.8), o.fire ? 0 : this.R.pick([this.P[7], this.P[6], WHITE]), o.fire ? rnd(this.R, 2, 4) : 1, { smokes: true }); } if (t < 1.2 && this.R.chance(0.3)) this.ps.spawn(K.EMBER, rnd(this.R, -w, w), -rnd(this.R, 0, h * 0.6), rnd(this.R, -20, 20), -rnd(this.R, 20, 60), 1, this.P[6]); },
      drawBack(p, t) { const k = 1 - smooth(1, 1.6, t); p.ring(0, 0, w * 1.6, 2, SY, this.P[6], k); p.glow(0, 0, w * 3, this.P[5], 0.5 * k, SY); floorDither(p, Math.round(w * 1.4), k * 0.7, [this.P[5], this.P[4], this.P[3]]); },
      drawFront(p, t) { const g = t < 0.12 ? easeOut(t / 0.12) : 1 - smooth(0.7, 1.5, t); const ww = w * g * (1 + 0.12 * Math.sin(t * 40)); if (ww < 0.5) return; p.beam(0, 0, 0, -h, ww * 2, (u, v) => (v < 0.2 ? WHITE : v < 0.55 ? this.P[6] : v < 0.8 ? this.P[5] : this.P[4]), (u, v) => clamp((1 - u) * 1.6) * (1 - v * v * 0.7)); p.glowLine(0, 0, 0, -h, ww * 2.5, this.P[5], 0.5 * g); },
    });
  },
  /** lightning strike(s) from the sky with branches, floor sparks, scorched crack */
  strike(o) {
    const n = o.n || 1, r = o.r || 0, R = o.rng, hits = Array.from({ length: n }, (_, i) => ({ x: n > 1 ? rnd(R, -r, r) : 0, y: n > 1 ? rnd(R, -r, r) * SY : 0, t0: i * (o.gap ?? 0.09), segs: cracks(R, 14, 4) }));
    return mk(o, Math.max(...hits.map((h) => h.t0)) + 1.4, {
      step(dt, t) { for (const h of hits) { if (!h.on && t >= h.t0) { h.on = 1; h.path = boltPath(h.x + rnd(R, -20, 20), h.y - 200, h.x, h.y, R, 0.22); h.br = [0, 1].map(() => { const k = Math.floor(R.next() * (h.path.length - 4)) + 2, [bx, by] = h.path[k]; return boltPath(bx, by, bx + rnd(R, -30, 30), by + rnd(R, 15, 40), R, 0.3, 4); }); sparks(this, h.x, h.y - 1, 12, 200, 0.5, h.y); this.lights.add(h.x, h.y - 30, 70, this.P[5], 1, 0.35); this.lights.add(h.x, h.y - 4, 26, WHITE, 1, 0.1); } if (h.on && t - h.t0 < 0.2 && R.chance(0.3)) h.path = boltPath(h.x + rnd(R, -20, 20), h.y - 200, h.x, h.y, R, 0.22); } },
      drawBack(p, t) { for (const h of hits) if (h.on) drawCracks(p, h.segs.map(([a, b, c, d, w]) => [a + h.x, b + h.y, c + h.x, d + h.y, w]), 1 - smooth(1, 1.4, t - h.t0), this.P[6], 1 - (t - h.t0) / 0.6); },
      drawFront(p, t) { for (const h of hits) { const lt = t - h.t0; if (!h.on || lt > 0.24 || (lt > 0.06 && this.R.chance(0.3))) continue; const k = 1 - lt / 0.24; drawBolt(p, h.path, this.P, k, 2); for (const b of h.br) drawBolt(p, b, this.P, k * 0.7, 1); flare(p, h.x, h.y - 2, 12 * k, k, this.P); } },
    });
  },
  /** chain arcs between local points */
  arcs(o) {
    const pts = o.pts || [[0, -10], [40, -10]];
    return mk(o, 0.4, {
      step(dt, t) { if (!this.paths || this.R.chance(0.35)) this.paths = pts.slice(1).map((q, i) => boltPath(pts[i][0], pts[i][1], q[0], q[1], this.R, 0.25, 4)); this.once('a', 0, () => pts.slice(1).forEach(([x, y]) => sparks(this, x, y, 6, 140, 0.6, y + 10))); },
      drawFront(p, t) { const k = 1 - t / 0.4; if (this.R.chance(0.2)) return; for (const path of this.paths) drawBolt(p, path, this.P, k, 1); },
    });
  },
  /** meteors falling onto points within r, each exploding */
  meteors(o) {
    const n = o.n || 4, r = o.r || 50, R = o.rng, M = Array.from({ length: n }, (_, i) => ({ x: n > 1 ? rnd(R, -r, r) : 0, y: n > 1 ? rnd(R, -r, r) * SY : 0, t0: i * 0.18, s: rnd(R, 3, 5) }));
    const subs = [];
    return mk(o, n * 0.18 + 3, {
      step(dt, t) { for (const m of M) { const lt = t - m.t0, T = 0.45; if (lt < 0) continue; if (lt < T) { const k = lt / T; m.cx = m.x - 90 * (1 - k); m.cy = m.y - 220 * (1 - k); this.ps.spawn(K.FIRE, m.cx + rnd(R, -1, 1), m.cy, rnd(R, -10, 10), -10, 0.35, 0, m.s * 0.9, { smokes: R.chance(0.5) }); } else if (!m.boom) { m.boom = 1; const e = FX.explode({ ...this.o, r: 26 + m.s * 3 }); e.ox = m.x; e.oy = m.y; subs.push(e); } } for (const s of subs) s.update(dt); },
      drawBack(p) { for (const s of subs) { const tx = p.tx, ty = p.ty; p.tx += s.ox * p.fx; p.ty += s.oy; s.back(p); p.tx = tx; p.ty = ty; } },
      drawFront(p, t) { for (const m of M) { const lt = t - m.t0; if (lt < 0 || lt >= 0.45) continue; const s = m.s; p.glow(m.cx, m.cy, s * 5, this.o.F[3], 0.6); p.ellipse(m.cx, m.cy, s, s, (d, a) => (d > 0.75 ? DARK : Math.cos(a - 0.8) > 0.3 ? this.o.F[2] : STONE[1]), 1); p.dot(m.cx + 1, m.cy + 1, WHITE); } for (const s of subs) { const tx = p.tx, ty = p.ty; p.tx += s.ox * p.fx; p.ty += s.oy; s.front(p); p.tx = tx; p.ty = ty; } },
    });
  },
  /** tornado / storm funnel */
  funnel(o) {
    const h = o.h || 90, r = o.r || 26;
    return mk(o, o.dur || 1.6, {
      step(dt, t) { if (this.R.chance(0.6)) dust(this, rnd(this.R, -r, r), 0, 1, 6, o.dustC ?? DIRT[2]); if (t < this.dur - 0.3 && this.R.chance(0.4)) this.bits.add({ kind: BK.CHUNK, x: rnd(this.R, -r, r), y: -rnd(this.R, 0, h * 0.6), vx: rnd(this.R, -120, 120), vy: -rnd(this.R, 60, 200), fl: 0, s: 2, ramp: o.debrisC || DIRT, life: 1, g: 0.6 }); },
      drawFront(p, t) { const g = clamp(t * 4) * (1 - smooth(this.dur - 0.4, this.dur, t)); for (let i = 0; i < 22; i++) { const k = i / 22, y = -k * h * g, rr = (r * 0.15 + r * k * k) * (0.9 + 0.1 * Math.sin(t * 9 + i)), sway = Math.sin(t * 3 + k * 4) * 5 * k; const a0 = t * 10 + i * 0.7; for (let j = 0; j < 10; j++) { const a = a0 + j * 0.35; const x = sway + Math.cos(a) * rr, yy = y + Math.sin(a) * rr * 0.3; p.dot(x, yy, Math.sin(a) > 0 ? this.P[6] : this.P[4], g * (0.5 + 0.5 * (1 - k))); } p.glowRing(sway, y, rr, 3, this.P[5], 0.08 * g, 0.3); } p.glow(0, -h * 0.4, r * 2, this.P[5], 0.2 * g); },
    });
  },
  /** black hole: dark core, lensing ring, accretion band, streaks pulled in */
  hole(o) {
    const r = o.r || 18;
    return mk(o, 1.8, {
      step(dt, t) { if (t < 1.4) for (let i = 0; i < 2; i++) { const a = rnd(this.R, 0, TAU), d = rnd(this.R, r * 2.5, r * 4); const x = Math.cos(a) * d, y = -r - 4 + Math.sin(a) * d * 0.6; this.ps.spawn(K.STREAK, x, y, -x * 2.2, (-r - 4 - y) * 2.2, 0.35, this.R.pick([this.P[6], this.P[5]]), 1); } },
      drawFront(p, t) { const g = t < 0.25 ? easeOut(t / 0.25) : 1 - smooth(1.4, 1.8, t), rr = r * g, cy = -r - 4; if (rr < 1) return; p.glow(0, cy, rr * 3, this.P[4], 0.5); band(p, 0, cy, rr * 2.2, 0.3, 3, 1, this.P, (a) => Math.sin(a + t * 6) < 0.9); p.ellipse(0, cy, rr, rr, (d) => (d > 0.85 ? this.P[7] : hex('#05000a')), 1); band(p, 0, cy, rr * 2.2, 0.3, 3, 1, this.P, (a) => Math.sin(a) > 0); },
    });
  },
  /** magic circle on the floor: rings, star polygon, rune ticks, rising motes */
  circle(o) {
    const r = o.r || 30, n = o.sides || 6, st = o.step || (n >= 5 ? 2 : 1), rings = o.rings || 2, dur = o.dur || 1.2, spin = o.spin || 1;
    return mk(o, dur, {
      step(dt, t) { if (t < dur - 0.3 && this.R.chance(0.5)) { const a = rnd(this.R, 0, TAU); this.ps.spawn(K.MOTE, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9 * SY, 0, -rnd(this.R, 20, 60), rnd(this.R, 0.5, 0.9), this.R.pick([this.P[7], this.P[6]]), 1); } },
      drawBack(p, t) {
        const g = easeOut(t / 0.25), k = 1 - smooth(dur - 0.3, dur, t), rot = t * spin, P = this.P; const R0 = r * (0.6 + 0.4 * g);
        for (let i = 0; i < rings; i++) p.ring(0, 0, R0 * (1 - i * 0.14), 1.2, SY, P[6 - i], k);
        const pts = []; for (let i = 0; i <= n; i++) { const a = rot + ((i * st) % n) / n * TAU; pts.push([Math.cos(a) * R0 * 0.82, Math.sin(a) * R0 * 0.82 * SY]); } p.polyline(pts, P[5], k);
        for (let i = 0; i < n; i++) { const a = rot + (i / n) * TAU; p.dot(Math.cos(a) * R0 * 0.82, Math.sin(a) * R0 * 0.82 * SY, WHITE, k); }
        for (let i = 0; i < 16; i++) { const a = -rot * 0.6 + (i / 16) * TAU; p.dot(Math.cos(a) * R0 * 0.93, Math.sin(a) * R0 * 0.93 * SY, i % 2 ? P[7] : P[5], k); }
        p.glow(0, 0, R0 * 1.2, P[5], 0.35 * k, SY);
      },
    });
  },
  /** holy beam from the sky with feathers and sparkles */
  beamDown(o) {
    const w = o.w || 9;
    return mk(o, 1.5, {
      step(dt, t) { this.once('a', 0.1, () => { this.lights.add(0, -30, 70, this.P[5], 1, 0.7); sparks(this, 0, -2, 10, 140, 0.5, 0); }); if (t < 1 && this.R.chance(0.4)) this.ps.spawn(o.leaf ? K.LEAF : K.FLAKE, rnd(this.R, -w * 2, w * 2), -rnd(this.R, 60, 120), 0, 30, 1.2, this.R.pick([WHITE, this.P[7]]), 1.5); if (t < 1.1 && this.R.chance(0.5)) this.ps.spawn(K.STAR, rnd(this.R, -w, w), -rnd(this.R, 5, 80), 0, -10, 0.4, this.P[6], 1.5); },
      drawBack(p, t) { const k = 1 - smooth(0.9, 1.5, t); p.ring(0, 0, w * 2.2, 2, SY, this.P[6], k); p.glow(0, 0, w * 4, this.P[5], 0.5 * k, SY); },
      drawFront(p, t) { const g = t < 0.1 ? easeOut(t / 0.1) : 1 - smooth(0.8, 1.4, t), ww = w * g; if (ww < 0.5) return; p.beam(0, 0, 0, -220, ww * 2, (u, v) => (v < 0.18 ? WHITE : v < 0.5 ? this.P[7] : v < 0.8 ? this.P[6] : this.P[5]), (u, v) => (1 - v * v * 0.8) * (u < 0.8 ? 1 : (1 - u) / 0.2)); p.glowLine(0, 0, 0, -220, ww * 2.5, this.P[5], 0.25 * g); },
    });
  },
  /** heal bloom: rising plus-sparkles, leaves, band, soft glow */
  heal(o) {
    const r = o.r || 18;
    const PLUS = ['.#.', '#*#', '.#.'];
    return mk(o, 1.5, {
      step(dt, t) { if (t < 1 && this.R.chance(0.7)) { const a = rnd(this.R, 0, TAU); (this.pl ||= []).push({ x: Math.cos(a) * r * rnd(this.R, 0.2, 1), y: Math.sin(a) * r * SY * rnd(this.R, 0.2, 1), t0: t, v: rnd(this.R, 25, 50) }); } if (o.leaf && t < 1 && this.R.chance(0.2)) this.ps.spawn(K.LEAF, rnd(this.R, -r, r), -rnd(this.R, 30, 50), 0, 10, 1.2, this.P[5], 1); this.once('a', 0, () => this.lights.add(0, -10, r * 2.5, this.P[5], 0.7, 1.2)); },
      drawBack(p, t) { const k = 1 - smooth(1, 1.5, t), u = clamp(t / 0.5); band(p, 0, 0, r * (0.5 + 0.6 * easeOut(u)), SY, 3, k, this.P); },
      drawFront(p, t) { for (const q of this.pl || []) { const lt = t - q.t0; if (lt > 0.8) continue; const a = lt < 0.15 ? lt / 0.15 : 1 - (lt - 0.15) / 0.65; p.sprite(PLUS, { '#': this.P[6], '*': WHITE }, q.x - 1, q.y - lt * q.v - 8, a); p.light(q.x, q.y - lt * q.v - 7, this.P[6], 0.5 * a); } },
    });
  },
  /** cloud of vapour (poison, smoke, mist) with bubbles */
  cloud(o) {
    const r = o.r || 30, dur = o.dur || 2;
    return mk(o, dur, {
      step(dt, t) { if (t < dur - 0.6 && this.R.chance(0.6)) { const a = rnd(this.R, 0, TAU), d = r * Math.sqrt(this.R.next()); this.ps.spawn(K.VAPOUR, Math.cos(a) * d, Math.sin(a) * d * SY - 4, rnd(this.R, -8, 8), -rnd(this.R, 2, 10), rnd(this.R, 0.8, 1.4), this.R.pick([this.P[3], this.P[4], this.P[5]]), rnd(this.R, 3, 6)); } if (o.bubbles && this.R.chance(0.3)) this.ps.spawn(K.BUBBLE, rnd(this.R, -r, r), rnd(this.R, -r, r) * SY, 0, -rnd(this.R, 10, 20), 0.8, this.P[6], rnd(this.R, 1, 2)); },
      drawBack(p, t) { const k = 1 - smooth(dur - 0.6, dur, t); p.ellipse(0, 0, r, r * SY, this.P[2], (d) => (1 - d) * 0.7 * k, true); },
    });
  },
  /** things raining down within r (arrows, drops, shards) */
  rain(o) {
    const n = o.n || 16, r = o.r || 40, R = o.rng, L = Array.from({ length: n }, () => ({ x: rnd(R, -r, r), y: rnd(R, -r, r) * SY, t0: rnd(R, 0, 0.5) }));
    const ARROW = ['#', '#', '*'];
    return mk(o, 2, {
      step(dt, t) { for (const q of L) if (!q.hit && t >= q.t0 + 0.25) { q.hit = 1; if (o.kind === 'drop') this.ps.spawn(K.BUBBLE, q.x, q.y, 0, -4, 0.3, this.P[6], 2); else { grit(this, q.x, q.y, 2, 60, DIRT, q.y); sparks(this, q.x, q.y - 1, 2, 80, 0.5, q.y); } } },
      drawFront(p, t) { for (const q of L) { const lt = t - q.t0; if (lt < 0) continue; if (lt < 0.25) { const k = lt / 0.25, x = q.x - 30 * (1 - k), y = q.y - 120 * (1 - k); p.line(x, y, x - 3, y - 12, (u) => (u < 0.2 ? WHITE : this.P[6]), 1); p.light(x, y, this.P[5], 0.4); } else if (o.kind !== 'drop' && lt < 1.6) { p.line(q.x, q.y, q.x - 1, q.y - 5, o.stick ?? this.P[4], 1 - smooth(1.2, 1.6, lt)); p.dot(q.x - 1, q.y - 6, this.P[6], 1 - smooth(1.2, 1.6, lt)); } } },
    });
  },
  /** shadow burst: dark smoke, tendrils from the floor, wisps, purple light */
  shadow(o) {
    const r = o.r || 30, R = o.rng, tend = Array.from({ length: o.tendrils ?? 7 }, () => { const a = rnd(R, 0, TAU), d = r * rnd(R, 0.2, 0.9); return { x: Math.cos(a) * d, y: Math.sin(a) * d * SY, h: rnd(R, 14, 30), ph: rnd(R, 0, TAU), t0: rnd(R, 0, 0.2) }; });
    return mk(o, 1.8, {
      step(dt, t) { this.once('a', 0, () => { for (let i = 0; i < 16; i++) { const a = rnd(R, 0, TAU); this.ps.spawn(K.VAPOUR, Math.cos(a) * 4, -6, Math.cos(a) * rnd(R, 30, 90), Math.sin(a) * rnd(R, 10, 40) - 10, rnd(R, 0.7, 1.2), R.pick(SMOKE_DARK), rnd(R, 3, 6)); } this.lights.add(0, -10, r * 1.5, this.P[5], 0.8, 0.6); }); if (t < 1.2 && R.chance(0.4)) this.ps.spawn(K.WISP, rnd(R, -r, r), rnd(R, -r, r) * SY, 0, -rnd(R, 20, 40), 1, this.P[6], 1); },
      drawFront(p, t) { for (const q of tend) { const lt = t - q.t0; if (lt < 0) continue; const g = easeOut(lt / 0.25) * (1 - smooth(1.2, 1.7, lt)); let px = q.x, py = q.y; for (let i = 1; i <= 10; i++) { const k = i / 10, x = q.x + Math.sin(q.ph + k * 5 + t * 6) * 4 * k, y = q.y - q.h * g * k; p.line(px, py, x, y, i > 8 ? this.P[7] : this.P[3], g); p.dot(x + 1, y, this.P[1], g * 0.8); px = x; py = y; } p.light(px, py, this.P[6], 0.5 * g); } },
    });
  },
  /** sigil on the floor with an emblem rising above (curse, hex, lex, mark) */
  sigil(o) {
    const r = o.r || 22, base = FX.circle({ ...o, r, dur: 1.6, sides: o.sides || 5, step: 2, rings: 2, spin: -1.2 });
    return Object.assign(base, { drawFront(p, t) { const a = t < 0.2 ? t / 0.2 : 1 - smooth(1.1, 1.6, t); emblem(p, o.emb || 'skull', this.P, 0, -34 - t * 6, a, 1); } });
  },
  /** dome / ward around the unit */
  dome(o) {
    const r = o.r || 16;
    return mk(o, 1.4, {
      step() { this.once('a', 0, () => this.lights.add(0, -r * 0.6, r * 2, this.P[5], 0.7, 0.8)); },
      drawFront(p, t) {
        const g = outBack(t / 0.2), k = 1 - smooth(1, 1.4, t), rr = r * g; if (rr < 1) return;
        p.ring(0, -2, rr + 1, 1.2, 1.05, (v, a) => (Math.sin(a) < 0 ? this.P[6] : this.P[4]), (v, a) => (Math.sin(a) < 0.15 ? k : 0));
        for (let i = 0; i < 18; i++) { const a = Math.PI + (i / 18) * Math.PI, sh = 0.5 + 0.5 * Math.sin(t * 6 + i); p.dot(Math.cos(a) * rr * 0.8, -2 + Math.sin(a) * rr * 0.8, sh > 0.6 ? WHITE : this.P[5], k * sh); }
        p.ring(0, 0, rr, 1.5, SY, this.P[6], k); p.glow(0, -rr * 0.5, rr * 1.6, this.P[4], 0.3 * k);
      },
    });
  },
  /** aura of a buff: rising band rings, motes/flames around the body */
  aura(o) {
    const r = o.r || 12, kind = o.kind || 'motes';
    return mk(o, 1.6, {
      step(dt, t) { if (t < 1.2) { if (this.R.chance(0.8)) { const a = rnd(this.R, 0, TAU); const x = Math.cos(a) * r, y = Math.sin(a) * r * SY; if (kind === 'fire') this.ps.spawn(K.FIRE, x, y, 0, -rnd(this.R, 30, 60), rnd(this.R, 0.4, 0.7), 0, rnd(this.R, 1.5, 2.5)); else if (kind === 'leaf') this.ps.spawn(K.LEAF, x, y - 30, 0, 0, 1, this.P[5], 1); else if (kind === 'wisp') this.ps.spawn(K.WISP, x, y, 0, -30, 0.9, this.P[6], 1); else this.ps.spawn(K.MOTE, x, y, 0, -rnd(this.R, 30, 70), rnd(this.R, 0.5, 0.9), this.R.pick([this.P[7], this.P[6], WHITE]), 1); } } this.once('a', 0, () => this.lights.add(0, -14, 30, this.P[5], 0.7, 1)); },
      drawBack(p, t) { const k = 1 - smooth(1.1, 1.6, t); band(p, 0, 0, r + 4, SY, 2, k, this.P); },
      drawFront(p, t) { for (let i = 0; i < 3; i++) { const lt = (t + i * 0.35) % 1.05, y = -lt * 34, k = (1 - lt / 1.05) * (1 - smooth(1.1, 1.6, t)); p.ring(0, y, r + 2 - lt * 4, 1, SY, this.P[6], k, (a) => Math.sin(a) > -0.2); } },
    });
  },
  /** fire breath / cone stream */
  breath(o) {
    const a = o.ang || 0, L = o.len || 70, arc = o.arc || 0.6, fire = o.fire;
    return mk(o, 1.6, {
      step(dt, t) { if (t < 0.6) for (let i = 0; i < 4; i++) { const b = a + rnd(this.R, -arc / 2, arc / 2), s = L * rnd(this.R, 1.6, 2.4); if (fire) this.ps.spawn(K.FIRE, Math.cos(a) * 6, -12 + Math.sin(a) * 3, Math.cos(b) * s, Math.sin(b) * s * SY, rnd(this.R, 0.4, 0.6), 0, rnd(this.R, 1.5, 3.5), { smokes: this.R.chance(0.3) }); else this.ps.spawn(K.VAPOUR, Math.cos(a) * 6, -12, Math.cos(b) * s, Math.sin(b) * s * SY, rnd(this.R, 0.4, 0.7), this.R.pick([this.P[6], this.P[5], this.P[7]]), rnd(this.R, 2, 3)); if (this.R.chance(0.4)) this.ps.spawn(K.SPARK, 0, -12, Math.cos(b) * s * 1.2, Math.sin(b) * s * SY * 1.2, 0.4, this.P[6], 1, { floor: 4 }); } },
      drawFront(p, t) { if (t < 0.6) { p.glow(Math.cos(a) * 8, -12, 14, this.o.F[2], 0.6); p.glowLine(Math.cos(a) * 8, -12, Math.cos(a) * L, -12 + Math.sin(a) * L * SY, 10, this.P[5], 0.2); } },
    });
  },
  /** straight beam from origin to (x1, y1) */
  beam(o) {
    const x1 = o.x1 ?? 80, y1 = o.y1 ?? 0, w = o.w || 6;
    return mk(o, 0.6, {
      step(dt, t) { this.once('a', 0, () => { sparks(this, x1, y1, 14, 180, 0.6, y1 + 12); this.lights.add(x1, y1, 30, this.P[5], 0.9, 0.4); }); if (t < 0.35 && this.R.chance(0.6)) { const k = this.R.next(); this.ps.spawn(K.MOTE, x1 * k, y1 * k + rnd(this.R, -w, w), rnd(this.R, -20, 20), rnd(this.R, -30, 0), 0.4, this.P[7], 1); } },
      drawFront(p, t) { const g = t < 0.06 ? t / 0.06 : 1 - smooth(0.25, 0.55, t), ww = w * g * (1 + 0.15 * Math.sin(t * 60)); if (ww < 0.4) return; p.beam(0, 0, x1, y1, ww * 2, (u, v) => (v < 0.3 ? WHITE : v < 0.65 ? this.P[7] : this.P[5]), 1); p.glowLine(0, 0, x1, y1, ww * 3, this.P[5], 0.5 * g); flare(p, 0, 0, ww * 2, g, this.P); flare(p, x1, y1, ww * 2.5, g, this.P); },
    });
  },
  /** thrust: narrow tapered stab with rings along it */
  thrust(o) {
    const a = o.ang || 0, L = o.len || 50, ex = Math.cos(a) * L, ey = -12 + Math.sin(a) * L * SY;
    return mk(o, 0.5, {
      step() { this.once('a', 0.05, () => { sparks(this, ex, ey, 10, 200, 0.6, 2); this.lights.add(ex, ey, 22, this.P[5], 0.8, 0.2); }); },
      drawFront(p, t) { const s = easeOut(t / 0.07), k = 1 - smooth(0.12, 0.4, t); const x = ex * s, y = -12 + (ey + 12) * s; p.beam(0, -12, x, y, 5, (u, v) => (v < 0.3 || u > 0.85 ? WHITE : u > 0.5 ? this.P[6] : this.P[4]), (u) => k * clamp(u * 2)); p.glowLine(0, -12, x, y, 6, this.P[5], 0.4 * k); for (let i = 1; i <= 2; i++) { const q = i / 3; p.ring(ex * q, -12 + (ey + 12) * q, 3 + 4 * s, 1, 1, this.P[6], k * 0.8); } },
    });
  },
  /** dash trail from (x0,y0) to origin: after-image streaks, dust */
  dash(o) {
    const x0 = o.x0 ?? -60, y0 = o.y0 ?? 0, R = o.rng, lines = Array.from({ length: 9 }, () => ({ o: rnd(R, -10, 10), y: rnd(R, -26, -2), l: rnd(R, 0.4, 1) }));
    return mk(o, 0.6, {
      step() { this.once('a', 0, () => { for (let i = 0; i < 5; i++) dust(this, x0 * (1 - i / 5), y0 * (1 - i / 5), 1, 6); }); },
      drawFront(p, t) { const k = 1 - t / 0.6; for (const q of lines) { const L = Math.hypot(x0, y0) * q.l, nx = -x0 / (Math.hypot(x0, y0) || 1), ny = -y0 / (Math.hypot(x0, y0) || 1); const sx = q.o * -ny, sy = q.o * nx; p.line(sx - nx * L, q.y + sy - ny * L * 0.5, sx, q.y + sy, (u) => (u > 0.8 ? WHITE : this.P[5]), (u) => u * k); } },
    });
  },
  /** muzzle flash at local (x, y) facing ang + smoke + shell */
  muzzle(o) {
    const a = o.ang || 0, x = Math.cos(a) * 10, y = -16 + Math.sin(a) * 6;
    return mk(o, 0.9, {
      step() { this.once('a', 0, () => { this.ps.spawn(K.SMOKE, x, y, Math.cos(a) * 20, -10, 0.7, 0, 2); this.bits.add({ kind: BK.CHUNK, x: 0, y: -14, vx: -Math.cos(a) * 60 + rnd(this.R, -20, 20), vy: -160, fl: 2, s: 1.5, ramp: ramp(['#8a5a10', '#e8b040', '#fff0a0'], 3), life: 0.9, g: 1 }); this.lights.add(x, y, 22, hex('#ffcc66'), 1, 0.12); }); },
      drawFront(p, t) { if (t < 0.07) { const L = 9 * (1 - t / 0.07); p.line(x, y, x + Math.cos(a) * L * 1.6, y + Math.sin(a) * L, WHITE, 1); p.line(x, y - 2, x + Math.cos(a - 0.5) * L, y + Math.sin(a - 0.5) * L - 2, hex('#ffe080'), 1); p.line(x, y + 2, x + Math.cos(a + 0.5) * L, y + Math.sin(a + 0.5) * L + 2, hex('#ffe080'), 1); p.glow(x, y, 10, hex('#ffb040'), 0.8); } },
    });
  },
  /** summoning portal: band ring, dark centre, rising light, motes */
  portal(o) {
    const r = o.r || 20;
    return mk(o, 1.8, {
      step(dt, t) { if (t < 1.3 && this.R.chance(0.7)) { const a = rnd(this.R, 0, TAU); this.ps.spawn(K.MOTE, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8 * SY, 0, -rnd(this.R, 40, 90), 0.8, this.R.pick([this.P[7], this.P[6]]), 1); } this.once('a', 0.3, () => { sparks(this, 0, -4, 14, 160, 0.5, 0); this.lights.add(0, -20, 50, this.P[5], 1, 0.5); }); },
      drawBack(p, t) { const g = easeOut(t / 0.3), k = 1 - smooth(1.3, 1.8, t); p.ellipse(0, 0, r * g, r * g * SY, (d) => (d < 0.7 ? this.P[0] : this.P[2]), k); band(p, 0, 0, r * g + 1, SY, 3, k, this.P); },
      drawFront(p, t) { const lt = t - 0.3; if (lt < 0 || lt > 0.6) return; const k = 1 - lt / 0.6; p.beam(0, 0, 0, -70, r * 0.8 * k, (u, v) => (v < 0.4 ? WHITE : this.P[6]), (u) => (1 - u) * k); },
    });
  },
  /** whirl: full-circle slashes around the caster */
  whirl(o) { const r = o.r || 26; return FX.slash({ ...o, arcs: [{ a0: 0, a1: TAU * 0.95, r, w: 6, t0: 0, sy: 0.5, y: -10 }, { a0: TAU * 0.95 + 1, a1: 1.2, r: r * 0.85, w: 5, t0: 0.14, sy: 0.5, y: -12 }] }); },
  /** vines growing from the floor */
  vines(o) {
    const r = o.r || 26, R = o.rng, V = Array.from({ length: o.n || 9 }, () => { const a = rnd(R, 0, TAU), d = r * Math.sqrt(R.next()); return { x: Math.cos(a) * d, y: Math.sin(a) * d * SY, h: rnd(R, 12, 24), ph: rnd(R, 0, TAU), t0: rnd(R, 0, 0.25) }; });
    const G1 = hex('#2a6a2a'), G2 = hex('#5ab83a'), G3 = hex('#9adf6a');
    return mk(o, 2, {
      drawFront(p, t) { for (const q of V) { const lt = t - q.t0; if (lt < 0) continue; const g = easeOut(lt / 0.3) * (1 - smooth(1.5, 2, t)); let px = q.x, py = q.y; for (let i = 1; i <= 8; i++) { const k = i / 8, x = q.x + Math.sin(q.ph + k * 6) * 4 * k, y = q.y - q.h * g * k; p.line(px, py, x, y, G1, 1); p.dot(x + 1, y, G2, 1); if (i === 4 || i === 7) { p.dot(x + 2, y - 1, G3, 1); p.dot(x - 2, y, G2, 1); } px = x; py = y; } } },
    });
  },
  /** clock face on the floor with spinning hands (time / slow) */
  clock(o) {
    const r = o.r || 22, dir = o.dir || -1;
    return mk(o, 1.6, {
      drawBack(p, t) { const k = 1 - smooth(1.2, 1.6, t), g = easeOut(t / 0.25), rr = r * g; p.ring(0, 0, rr, 1.5, SY, this.P[6], k); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; p.dot(Math.cos(a) * rr * 0.86, Math.sin(a) * rr * 0.86 * SY, i % 3 ? this.P[5] : WHITE, k); } const h1 = dir * t * 7, h2 = dir * t * 1.3; p.line(0, 0, Math.cos(h1) * rr * 0.8, Math.sin(h1) * rr * 0.8 * SY, WHITE, k); p.line(0, 0, Math.cos(h2) * rr * 0.5, Math.sin(h2) * rr * 0.5 * SY, this.P[7], k); p.glow(0, 0, rr, this.P[5], 0.3 * k, SY); },
    });
  },
  /** net / snare */
  net(o) {
    const r = o.r || 18, C = hex('#d8c8a0'), D = hex('#8a7a5a');
    return mk(o, 1.6, { drawFront(p, t) { const g = easeOut(t / 0.15), k = 1 - smooth(1.2, 1.6, t), rr = r * g; for (let i = -3; i <= 3; i++) { p.line(-rr, i * rr * 0.13 - 8, rr, i * rr * 0.13 - 6, C, k); p.line(i * rr * 0.28, -8 - rr * 0.45, i * rr * 0.28 + 2, -8 + rr * 0.45, C, k); } for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; p.dot(Math.cos(a) * rr, -8 + Math.sin(a) * rr * 0.45, D, k); } } });
  },
  /** blood spray */
  blood(o) {
    return mk(o, 1.2, { step() { this.once('a', 0, () => { for (let i = 0; i < 10; i++) this.bits.add({ kind: BK.DRIP, x: 0, y: -12, vx: rnd(this.R, -90, 90), vy: rnd(this.R, -160, -40), fl: rnd(this.R, -2, 4), c: hex('#c0102a'), life: rnd(this.R, 0.6, 1.1), g: 1 }); }); } });
  },
  /** souls / wisps rising */
  souls(o) {
    const r = o.r || 16;
    return mk(o, 1.6, { step(dt, t) { if (t < 0.8 && this.R.chance(0.5)) this.ps.spawn(K.WISP, rnd(this.R, -r, r), rnd(this.R, -r, r) * SY, 0, -rnd(this.R, 25, 45), 1, this.R.pick([this.P[6], this.P[7]]), 1); } });
  },
  /** sound / shout waves: upright rings expanding */
  shout(o) {
    return mk(o, 0.9, { step() { this.once('a', 0, () => dust(this, 0, 0, 8, 14)); }, drawFront(p, t) { for (let i = 0; i < 3; i++) { const lt = t - i * 0.12; if (lt < 0 || lt > 0.5) continue; const u = lt / 0.5; p.ring(0, -18, 6 + u * 34, 1.5, 0.8, this.P[6], 1 - u, (a) => Math.cos(a) * (o.dir || 1) > -0.2); } } });
  },
  /** orbs circling the unit */
  orbs(o) {
    const n = o.n || 4, r = o.r || 16;
    return mk(o, o.dur || 1.6, { drawFront(p, t) { const k = 1 - smooth(this.dur - 0.3, this.dur, t); for (let i = 0; i < n; i++) { const a = t * 4 + (i / n) * TAU, x = Math.cos(a) * r, y = -14 + Math.sin(a) * r * SY; p.ellipse(x, y, 2, 2, (d) => (d < 0.5 ? WHITE : this.P[6]), k); p.glow(x, y, 7, this.P[5], 0.5 * k); } } });
  },
  /** emblem pop: the skill's glyph flashes and rises (used for signatures and ultimates) */
  stamp(o) { return mk(o, 0.9, { drawFront(p, t) { const a = t < 0.12 ? t / 0.12 : 1 - smooth(0.5, 0.9, t); emblem(p, o.emb || 'star', this.P, 0, -28 - t * 10, a, o.scale || 1); } }); },
};

// ---- projectile looks (drawn each frame into the front buffer at the projectile's art position) ----
const ARROW_PX = (p, x, y, a, P, len = 7) => { const c = Math.cos(a), s = Math.sin(a); p.line(x - c * len, y - s * len, x, y, (u) => (u > 0.8 ? WHITE : P[3]), 1); p.dot(x - c * len, y - s * len - 1, P[6]); p.dot(x - c * len, y - s * len + 1, P[6]); p.light(x, y, P[6], 0.5); };
export function drawProjectile(p, kind, P, F, x, y, vx, vy, t, size = 3, emb) {
  const a = Math.atan2(vy, vx), c = Math.cos(a), s = Math.sin(a);
  switch (kind) {
    case 'arrow': ARROW_PX(p, x, y, a, P); break;
    case 'bullet': p.line(x - c * 12, y - s * 12, x, y, (u) => (u > 0.7 ? WHITE : P[5]), (u) => u); p.glowLine(x - c * 10, y - s * 10, x, y, 3, P[5], 0.4); break;
    case 'lance': { const L = size * 3; p.poly([[x + c * L, y + s * L], [x - s * size * 0.6, y + c * size * 0.6], [x - c * L * 0.4, y - s * L * 0.4], [x + s * size * 0.6, y - c * size * 0.6]], (px, py) => ((px - x) * -s + (py - y) * c > 0 ? P[6] : P[4])); p.line(x - c * L * 0.3, y - s * L * 0.3, x + c * L, y + s * L, WHITE, 1); p.glow(x, y, L * 1.5, P[5], 0.4); break; }
    case 'skull': emblem(p, 'skull', P, x, y, 1, 1); break;
    case 'glyph': emblem(p, emb || 'orb', P, x, y, 1, 1); p.glow(x, y, 10, P[5], 0.4); break;
    case 'star': for (let i = 0; i < 4; i++) { const b = t * 12 + (i * Math.PI) / 2; p.line(x, y, x + Math.cos(b) * size * 1.6, y + Math.sin(b) * size * 1.6, P[6], 1); } p.dot(x, y, WHITE); p.glow(x, y, size * 4, P[5], 0.5); break;
    case 'fire': p.ellipse(x, y, size, size, (d) => rampAt(F, d * 0.6), 1); p.glow(x, y, size * 4, F[3], 0.5); break;
    case 'plasma': p.ellipse(x, y, size, size, (d) => (d < 0.5 ? WHITE : P[6]), 1); for (let i = 0; i < 3; i++) { const b = t * 30 + i * 2.1; p.line(x, y, x + Math.cos(b) * size * 2, y + Math.sin(b) * size * 2, P[7], 0.8); } p.glow(x, y, size * 5, P[5], 0.6); break;
    default: p.ellipse(x, y, size, size, (d) => (d < 0.35 ? WHITE : d < 0.7 ? P[6] : P[4]), 1); p.ring(x, y, size + 2, 1, 1, P[5], 0.6); p.glow(x, y, size * 4, P[5], 0.5);
  }
}
/** per-frame trail particles behind a projectile (spawned into a shared trail system) */
export function trailKind(kind) { return { fire: K.FIRE, arrow: K.MOTE, bullet: null, lance: K.FLAKE, skull: K.WISP, plasma: K.SPARK, star: K.STAR }[kind] ?? K.MOTE; }
