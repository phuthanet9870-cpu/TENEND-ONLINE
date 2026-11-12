// ===== PXFX core: low-resolution pixel buffer VFX engine =====
// Technique (credit: the approach popularised by Hugo Duprez / Sprite Fusion pixel VFX and patch-gg/pixelfx):
// effects draw at art resolution (1 art px = 2 screen px) into two buffers — COLOR (opaque pixels, faded with a
// 4x4 ordered dither, never alpha-blended) and LIGHT (additive glow) — then the light is composited on top and
// the picture is scaled up with crisp pixels. Lines and light rather than fills; light on every spark.
// This file is an original implementation written for TENEND ONLINE.
export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, t) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
export const easeOut = (x, p = 3) => 1 - Math.pow(1 - clamp(x), p);
export const outBack = (x, s = 1.8) => { x = clamp(x) - 1; return x * x * ((s + 1) * x + s) + 1; };

// ---------- colour (u32 little-endian ABGR, as ImageData wants) ----------
export function hex(c) {
  if (typeof c === 'number') return c;
  let h = c.slice(1); if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h.slice(0, 6), 16); return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0;
}
const ch = (c, s) => (c >>> s) & 255;
export function mix(a, b, t) { return (0xff000000 | (Math.round(ch(a, 16) + (ch(b, 16) - ch(a, 16)) * t) << 16) | (Math.round(ch(a, 8) + (ch(b, 8) - ch(a, 8)) * t) << 8) | Math.round(ch(a, 0) + (ch(b, 0) - ch(a, 0)) * t)) >>> 0; }
export const WHITE = hex('#ffffff');
/** resample a ramp (array of hex or u32, dark→bright) to n steps */
export function ramp(cols, n) { const c = cols.map(hex); return Array.from({ length: n }, (_, i) => { const f = (i / (n - 1)) * (c.length - 1), k = Math.floor(f); return k >= c.length - 1 ? c[c.length - 1] : mix(c[k], c[k + 1], f - k); }); }
export const rampAt = (r, t) => r[Math.min(r.length - 1, Math.max(0, Math.floor(t * r.length)))];

// ---------- seeded rng ----------
export class Rng {
  constructor(seed = 1) { this.s = (seed * 2654435761) >>> 0 || 1; }
  next() { let t = (this.s = (this.s + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  chance(p) { return this.next() < p; }
  pick(a) { return a[Math.floor(this.next() * a.length)]; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
}

// ---------- buffers ----------
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export class Buf {
  constructor() { this.w = 0; this.h = 0; this.used = false; }
  size(w, h) { if (w !== this.w || h !== this.h) { this.w = w; this.h = h; this.C = new Uint32Array(w * h); this.L = new Uint32Array(w * h); this.cv = document.createElement('canvas'); this.cv.width = w; this.cv.height = h; this.cx = this.cv.getContext('2d'); this.img = this.cx.createImageData(w, h); this.out = new Uint32Array(this.img.data.buffer); } }
  clear() { if (this.used) { this.C.fill(0); this.L.fill(0); } this.used = false; this.x0 = 1e9; this.y0 = 1e9; this.x1 = -1; this.y1 = -1; }
  mark(x, y) { this.used = true; if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x; if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y; }
  /** colour + light → RGBA (light over transparency becomes colour with alpha = its brightest channel) */
  composite() {
    if (!this.used) return false;
    const { C, L, out, w } = this; out.fill(0);
    const x0 = Math.max(0, this.x0 - 1), x1 = Math.min(w - 1, this.x1 + 1), y0 = Math.max(0, this.y0 - 1), y1 = Math.min(this.h - 1, this.y1 + 1);
    for (let y = y0; y <= y1; y++) for (let i = y * w + x0, e = y * w + x1; i <= e; i++) {
      const c = C[i], l = L[i];
      if (!c && !l) continue;
      let r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255, a = c >>> 24;
      if (l) {
        const lr = l & 255, lg = (l >>> 8) & 255, lb = (l >>> 16) & 255;
        if (a < 255) { const pa = a / 255, na = Math.min(1, Math.max(pa, Math.max(lr, lg, lb) / 255)); if (na > 0) { r = Math.min(255, (r * pa + lr) / na); g = Math.min(255, (g * pa + lg) / na); b = Math.min(255, (b * pa + lb) / na); a = na * 255; } }
        else { r = Math.min(255, r + lr); g = Math.min(255, g + lg); b = Math.min(255, b + lb); }
      }
      out[i] = ((a & 255) << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0;
    }
    this.cx.putImageData(this.img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    return true;
  }
}

// ---------- pen: draws in an effect's local space (origin at its feet, y down; floor plane squashed by sy) ----------
const call = (v, a, b) => (typeof v === 'function' ? v(a, b) : v);
export class Pen {
  constructor(buf) { this.b = buf; this.tx = 0; this.ty = 0; this.fx = 1; this.fade = 1; this.lk = 1; }
  place(x, y, flip = false) { this.tx = x; this.ty = y; this.fx = flip ? -1 : 1; return this; }
  sx(x) { return Math.floor(this.tx + x * this.fx); }
  sy(y) { return Math.floor(this.ty + y); }
  put(X, Y, c, a = 1) {
    const B = this.b; if (!c || X < 0 || Y < 0 || X >= B.w || Y >= B.h) return;
    a *= this.fade; if (a < 1 && a <= BAYER[((Y & 3) << 2) | (X & 3)]) return;
    B.C[Y * B.w + X] = c; B.mark(X, Y);
  }
  add(X, Y, c, k = 1) {
    const B = this.b; k *= this.fade * this.lk; if (k <= 0.004 || X < 0 || Y < 0 || X >= B.w || Y >= B.h) return;
    const i = Y * B.w + X, d = B.L[i];
    const r = Math.min(255, (d & 255) + (c & 255) * k) | 0, g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * k) | 0, b = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k) | 0;
    B.L[i] = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0; B.mark(X, Y);
  }
  blendPx(X, Y, c, a) {
    const B = this.b; a *= this.fade; if (!c || a <= 0.004 || X < 0 || Y < 0 || X >= B.w || Y >= B.h) return;
    const i = Y * B.w + X, d = B.C[i], da = (d >>> 24) / 255, oa = a + da * (1 - a), k = a / oa;
    const m = (s) => ((((c >>> s) & 255) * k + ((d >>> s) & 255) * (1 - k)) & 255);
    B.C[i] = ((((oa * 255) & 255) << 24) | (m(16) << 16) | (m(8) << 8) | m(0)) >>> 0; B.mark(X, Y);
  }
  dot(x, y, c, a = 1) { if (a > 0) this.put(this.sx(x), this.sy(y), c, a); }
  px(x, y, c) { this.put(this.sx(x), this.sy(y), c, 1); }
  light(x, y, c, k = 1) { this.add(this.sx(x), this.sy(y), c, k); }
  /** visit pixels of a local box: fn(lx, ly, X, Y) with lx,ly the pixel centre in local space */
  each(x0, y0, x1, y1, fn) {
    const B = this.b; let ax = this.tx + x0 * this.fx, bx = this.tx + x1 * this.fx; if (ax > bx) [ax, bx] = [bx, ax];
    const X0 = Math.max(0, Math.floor(ax)), X1 = Math.min(B.w - 1, Math.ceil(bx)), Y0 = Math.max(0, Math.floor(this.ty + y0)), Y1 = Math.min(B.h - 1, Math.ceil(this.ty + y1));
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) fn((X + 0.5 - this.tx) * this.fx, Y + 0.5 - this.ty, X, Y);
  }
  line(x0, y0, x1, y1, c, a = 1) {
    let X = this.sx(x0), Y = this.sy(y0); const EX = this.sx(x1), EY = this.sy(y1);
    const dx = Math.abs(EX - X), dy = -Math.abs(EY - Y), stx = X < EX ? 1 : -1, sty = Y < EY ? 1 : -1, n = Math.max(dx, -dy) || 1; let err = dx + dy, i = 0;
    const fc = typeof c === 'function', fa = typeof a === 'function';
    for (let g = 0; g < 2000; g++) { const u = i++ / n; this.put(X, Y, fc ? c(u) : c, fa ? a(u) : a); if (X === EX && Y === EY) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; X += stx; } if (e2 <= dx) { err += dx; Y += sty; } }
  }
  polyline(pts, c, a = 1) { for (let i = 1; i < pts.length; i++) this.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, a); }
  /** filled ellipse; c/a may be fn(d 0..1, ang) */
  ellipse(cx, cy, rx, ry, c, a = 1, soft = false) {
    if (rx < 0.6 || ry < 0.3) return this.dot(cx, cy, call(c, 0, 0), call(a, 0, 0));
    this.each(cx - rx, cy - ry, cx + rx, cy + ry, (x, y, X, Y) => { const dx = (x - cx) / rx, dy = (y - cy) / ry, d2 = dx * dx + dy * dy; if (d2 > 1) return; const d = Math.sqrt(d2), an = Math.atan2(dy, dx); soft ? this.blendPx(X, Y, call(c, d, an), call(a, d, an)) : this.put(X, Y, call(c, d, an), call(a, d, an)); });
  }
  disc(cx, cy, r, c, a) { this.ellipse(cx, cy, r, r, c, a, true); }
  /** ring band on a floor plane squashed by sy (1 = upright circle); c/a fn(v 0 inner..1 outer, ang) */
  ring(cx, cy, r, w, sy, c, a = 1, keep) {
    const r0 = Math.max(0, r - w);
    this.each(cx - r, cy - r * sy, cx + r, cy + r * sy, (x, y, X, Y) => { const dx = x - cx, dy = (y - cy) / sy, d2 = dx * dx + dy * dy; if (d2 > r * r || d2 < r0 * r0) return; const an = Math.atan2(dy, dx); if (keep && !keep(an)) return; const v = w > 0 ? (Math.sqrt(d2) - r0) / Math.max(0.001, r - r0) : 1; this.put(X, Y, call(c, v, an), call(a, v, an)); });
  }
  /** crescent band from angle a0 to a1 (radians, floor-squashed by sy); c/a fn(u along 0..1, v across 0 inner..1 outer); w may be fn(u) */
  arc(cx, cy, r, w, a0, a1, sy, c, a = 1) {
    const span = a1 - a0, wf = typeof w === 'function';
    this.each(cx - r, cy - r * sy, cx + r, cy + r * sy, (x, y, X, Y) => {
      const dx = x - cx, dy = (y - cy) / sy, d = Math.sqrt(dx * dx + dy * dy); if (d > r) return;
      let an = Math.atan2(dy, dx) - a0; an -= Math.floor(an / TAU) * TAU; if (an > span) return;
      const u = an / span, ww = wf ? w(u) : w; if (ww <= 0 || d < r - ww) return;
      this.put(X, Y, call(c, u, (d - (r - ww)) / ww), call(a, u, (d - (r - ww)) / ww));
    });
  }
  /** thick segment; c/a fn(u along, v across 0 centre..1 edge) */
  beam(x0, y0, x1, y1, width, c, a = 1) {
    const r = width / 2, dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
    this.each(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r, (x, y, X, Y) => { const u = clamp(((x - x0) * dx + (y - y0) * dy) / L2), px = x0 + dx * u - x, py = y0 + dy * u - y, d2 = px * px + py * py; if (d2 > r * r) return; const v = Math.sqrt(d2) / r; this.put(X, Y, call(c, u, v), call(a, u, v)); });
  }
  poly(pts, c, a = 1) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const n = pts.length;
    this.each(x0, y0, x1, y1, (x, y, X, Y) => { let ins = false; for (let i = 0, j = n - 1; i < n; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } if (ins) this.put(X, Y, call(c, x, y), call(a, x, y)); });
  }
  // ---- light ----
  glow(x, y, r, c, k = 0.5, sy = 1) {
    if (r < 1 || k <= 0.004) return; const cx = this.tx + x * this.fx, cy = this.ty + y, ry = r * sy;
    for (let Y = Math.floor(cy - ry); Y <= Math.ceil(cy + ry); Y++) { const dy = (Y + 0.5 - cy) / ry; for (let X = Math.floor(cx - r); X <= Math.ceil(cx + r); X++) { const dx = (X + 0.5 - cx) / r, d = dx * dx + dy * dy; if (d >= 1) continue; const f = 1 - Math.sqrt(d); this.add(X, Y, c, f * f * k); } }
  }
  glowLine(x0, y0, x1, y1, r, c, k = 0.5) {
    if (r < 1 || k <= 0.004) return; const ax = this.tx + x0 * this.fx, ay = this.ty + y0, bx = this.tx + x1 * this.fx, by = this.ty + y1, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    for (let Y = Math.floor(Math.min(ay, by) - r); Y <= Math.ceil(Math.max(ay, by) + r); Y++) for (let X = Math.floor(Math.min(ax, bx) - r); X <= Math.ceil(Math.max(ax, bx) + r); X++) { const px = X + 0.5, py = Y + 0.5, u = clamp(((px - ax) * dx + (py - ay) * dy) / L2), ex = ax + dx * u - px, ey = ay + dy * u - py, d = Math.sqrt(ex * ex + ey * ey) / r; if (d >= 1) continue; this.add(X, Y, c, (1 - d) * (1 - d) * k); }
  }
  glowRing(x, y, R, r, c, k = 0.5, sy = 1) {
    if (r < 1 || k <= 0.004) return; const cx = this.tx + x * this.fx, cy = this.ty + y, E = R + r;
    for (let Y = Math.floor(cy - E * sy); Y <= Math.ceil(cy + E * sy); Y++) for (let X = Math.floor(cx - E); X <= Math.ceil(cx + E); X++) { const d = Math.abs(Math.hypot(X + 0.5 - cx, (Y + 0.5 - cy) / sy) - R) / r; if (d >= 1) continue; this.add(X, Y, c, (1 - d) * (1 - d) * k); }
  }
  /** sprite from strings; pal maps char → u32 */
  sprite(rows, pal, x, y, a = 1, scale = 1) { for (let r = 0; r < rows.length; r++) for (let q = 0; q < rows[r].length; q++) { const c = pal[rows[r][q]]; if (!c) continue; if (scale === 1) this.dot(x + q, y + r, c, a); else for (let i = 0; i < scale; i++) for (let j = 0; j < scale; j++) this.dot(x + q * scale + i, y + r * scale + j, c, a); } }
}

// ---------- helpers ----------
/** four-armed sparkle with light */
export function sparkle(p, x, y, arm, c, tip = c, k = 0.6) {
  if (arm < 0.5) { p.dot(x, y, c); return; }
  for (let i = -arm; i <= arm; i++) { const t = Math.abs(i) / arm, col = t > 0.6 ? tip : c; p.dot(x + i, y, col, 1 - t * 0.6); p.dot(x, y + i, col, 1 - t * 0.6); }
  p.px(x, y, WHITE); p.glow(x, y, arm * 2.5 + 3, c, k);
}
/** bright star flare with long rays */
export function flare(p, x, y, L, k, R) {
  if (L < 1) return;
  for (const [dx, dy, m] of [[1, 0, 1], [0, 1, 0.75], [0.7, 0.7, 0.45], [0.7, -0.7, 0.45]]) { const l = L * m; p.line(x - dx * l, y - dy * l, x + dx * l, y + dy * l, (u) => (Math.abs(u - 0.5) < 0.12 ? WHITE : R[R.length - 2]), (u) => k * (1 - Math.abs(u - 0.5) * 1.8)); }
  p.glow(x, y, L * 1.4, R[R.length - 3], 0.5 * k); p.glow(x, y, L * 0.5, WHITE, 0.6 * k);
}
/** floor ring band coloured by depth (far half dimmer) */
export function band(p, cx, cy, r, sy, th, k, R, keep, hot = false) {
  p.ring(cx, cy, r, th, sy, (v, an) => (hot ? WHITE : R[Math.min(R.length - 1, Math.round(2 + v * (R.length - 3) + (Math.sin(an) > 0 ? 1 : -1)))]), (v) => k * (0.4 + 0.6 * v), keep);
  p.glowRing(cx, cy, r - th / 2, th + 4, R[R.length - 3], 0.25 * k, sy);
}
/** faceted crystal spike standing at (x, base) */
export function crystal(p, x, base, h, w, lean, R, o = {}) {
  if (h < 1) return; const a = o.a ?? 1, top = [x + lean, base - h], L = [x - w / 2, base], Rt = [x + w / 2, base], mid = [x + lean * 0.3 + w * 0.05, base - h * 0.15];
  const n = R.length;
  p.poly([L, top, mid], o.white ? WHITE : R[n - 3], a); p.poly([Rt, top, mid], o.white ? WHITE : R[n - 5] ?? R[1], a);
  p.line(top[0], top[1], mid[0], mid[1], R[n - 1], a); p.line(L[0], L[1], top[0], top[1], R[n - 2], a); p.line(Rt[0], Rt[1], top[0], top[1], R[2], a);
  if (o.glint >= 0) { const gy = base - h * o.glint, gx = lerp(x, top[0], o.glint); sparkle(p, gx, gy, 2, WHITE, R[n - 2], 0.4); }
  p.glow(top[0], top[1] + h * 0.3, Math.min(30, h * 0.7), R[n - 3], 0.18 * a);
}
/** jagged bolt between two points (midpoint displacement), returns path */
export function boltPath(x0, y0, x1, y1, rng, rough = 0.25, depth = 5) {
  let pts = [[x0, y0], [x1, y1]], off = Math.hypot(x1 - x0, y1 - y0) * rough;
  for (let k = 0; k < depth; k++) { const n = [pts[0]]; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], mx = (ax + bx) / 2, my = (ay + by) / 2, nx = -(by - ay), ny = bx - ax, l = Math.hypot(nx, ny) || 1, d = (rng.next() - 0.5) * off; n.push([mx + (nx / l) * d, my + (ny / l) * d], [bx, by]); } pts = n; off *= 0.55; }
  return pts;
}
export function drawBolt(p, pts, R, k = 1, width = 1) {
  const n = R.length;
  for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; p.line(ax, ay, bx, by, WHITE, k); if (width > 1) { p.line(ax + 1, ay, bx + 1, by, R[n - 2], k * 0.8); p.line(ax - 1, ay, bx - 1, by, R[n - 3], k * 0.6); } p.glowLine(ax, ay, bx, by, 5 + width * 2, R[n - 3], 0.35 * k); }
}

// ---------- simulated particles ----------
export const K = { SPARK: 0, MOTE: 1, STREAK: 2, FLAKE: 3, VAPOUR: 4, DUST: 5, STAR: 6, EMBER: 7, SMOKE: 8, FIRE: 9, GRIT: 10, WISP: 11, BUBBLE: 12, LEAF: 13 };
const G = 900;
export class Parts {
  constructor(rng, o = {}) { this.R = rng; this.list = []; this.t = 0; this.fire = o.fire; this.smoke = o.smoke || ramp(['#1a171e', '#2b2630', '#433d48', '#5d5660', '#7b6f72'], 5); this.haze = o.haze; }
  spawn(k, x, y, vx, vy, life, col, size = 1, o = {}) { this.list.push({ k, x, y, vx, vy, life, max: life, col, size, seed: this.R.next() * 100, fl: o.floor ?? Infinity, delay: o.delay || 0, back: o.back, smokes: o.smokes }); }
  update(dt) {
    this.t += dt; const t = this.t, R = this.R;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      if ((p.life -= dt) <= 0) { if (p.k === K.FIRE && p.smokes) this.spawn(K.SMOKE, p.x, p.y, p.vx * 0.5, p.vy * 0.5 - 6, R.range(0.8, 1.5), 0, p.size * 0.8); this.list.splice(i, 1); continue; }
      switch (p.k) {
        case K.SPARK: case K.GRIT: p.vy += G * (p.k === K.GRIT ? 1 : 0.45) * dt; p.vx -= p.vx * (p.k === K.GRIT ? 0.8 : 2) * dt; if (p.vy > 0 && p.y + p.vy * dt >= p.fl) { p.y = p.fl - 0.2; if (p.k === K.GRIT && Math.abs(p.vy) < 140) { p.vx = 0; p.vy = 0; p.life = Math.min(p.life, 0.6); } else { p.vy *= -0.4; p.vx *= 0.7; } } break;
        case K.STREAK: p.vx += p.vx * 3 * dt; p.vy += p.vy * 3 * dt; break;
        case K.FLAKE: p.vx -= p.vx * 2 * dt; p.vy += (30 - p.vy * 2) * dt; p.x += Math.sin(t * 2.5 + p.seed) * 7 * dt; break;
        case K.EMBER: p.vy += (-28 + Math.sin(t * 3 + p.seed) * 20) * dt; p.vx += Math.cos(t * 2.3 + p.seed) * 40 * dt; p.vx -= p.vx * 1.5 * dt; p.vy -= p.vy * 1.5 * dt; break;
        case K.FIRE: p.vy -= 90 * dt; p.vx += Math.sin(t * 17 + p.seed) * 30 * dt; p.vx -= p.vx * 5 * dt; p.vy -= p.vy * 3 * dt; break;
        case K.SMOKE: p.vy -= 16 * dt; p.vx += Math.sin(t * 1.3 + p.seed) * 8 * dt; p.vx -= p.vx * 1.6 * dt; p.vy -= p.vy * 1.2 * dt; break;
        case K.WISP: p.vy -= 20 * dt; p.vx = Math.sin(t * 4 + p.seed) * 14; break;
        case K.BUBBLE: p.vy -= 10 * dt; p.vx = Math.sin(t * 5 + p.seed) * 6; break;
        case K.LEAF: p.vy += (25 - p.vy * 1.5) * dt; p.vx = Math.sin(t * 3 + p.seed) * 22 + p.vx * 0.98; break;
        case K.MOTE: p.vx -= p.vx * 0.8 * dt; p.vy -= p.vy * 0.8 * dt; break;
        default: { const dr = p.k === K.VAPOUR || p.k === K.DUST ? 4 : 1.6; p.vx -= p.vx * dr * dt; p.vy -= p.vy * dr * dt + 4 * dt; }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  draw(pen, layer) {
    for (const q of this.list) {
      if (q.delay > 0) continue;
      const soft = q.k === K.VAPOUR || q.k === K.DUST || q.k === K.SMOKE;
      if (layer && (layer === 'back') !== (soft || !!q.back)) continue;
      const u = 1 - q.life / q.max, k = 1 - u, c = q.col;
      switch (q.k) {
        case K.SPARK: { const tl = Math.min(4, Math.hypot(q.vx, q.vy) * 0.02); const nx = q.vx / (Math.hypot(q.vx, q.vy) || 1), ny = q.vy / (Math.hypot(q.vx, q.vy) || 1); pen.line(q.x, q.y, q.x - nx * tl, q.y - ny * tl, (v) => (v < 0.3 ? WHITE : c), k > 0.3 ? 1 : k / 0.3); pen.light(q.x, q.y, c, 0.5 * k); break; }
        case K.STREAK: { const sp = Math.hypot(q.vx, q.vy) || 1, L = Math.min(10, sp * 0.03) * q.size; pen.line(q.x, q.y, q.x - (q.vx / sp) * L, q.y - (q.vy / sp) * L, (v) => (v < 0.25 ? WHITE : c), (v) => k * (1 - v * 0.6)); pen.light(q.x, q.y, c, 0.4 * k); break; }
        case K.MOTE: pen.dot(q.x, q.y, c, k); pen.light(q.x, q.y, c, 0.5 * k); if (q.size > 1) pen.glow(q.x, q.y, 3 * q.size, c, 0.25 * k); break;
        case K.FLAKE: pen.dot(q.x, q.y, c, Math.min(1, k * 1.5)); if (q.size > 1.2) { pen.dot(q.x + 1, q.y, c, k * 0.6); pen.dot(q.x, q.y + 1, c, k * 0.6); } pen.light(q.x, q.y, c, 0.15 * k); break;
        case K.STAR: { const arm = Math.round(q.size * (u < 0.3 ? u / 0.3 : 1 - (u - 0.3) / 0.7) * 2); sparkle(pen, q.x, q.y, arm, c, c, 0.5 * k); break; }
        case K.EMBER: { const fl = 0.6 + 0.4 * Math.sin(this.t * 20 + q.seed * 7); pen.dot(q.x, q.y, k > 0.5 ? WHITE : c, Math.min(1, k * 1.6)); pen.light(q.x, q.y, c, 0.6 * k * fl); break; }
        case K.VAPOUR: case K.DUST: { const r = q.size * (1 + u * 1.6); pen.disc(q.x, q.y, r, c, (d) => (1 - d) * 0.55 * k); if (this.haze && q.k === K.VAPOUR) pen.glow(q.x, q.y, r * 1.6, this.haze, 0.08 * k); break; }
        case K.SMOKE: { const r = q.size * (1.5 + u * 2.5); const col = rampAt(this.smoke, u); pen.disc(q.x, q.y, r, col, (d) => (1 - d * d) * 0.6 * k); break; }
        case K.FIRE: { const R = this.fire, r = q.size * (1 - u * 0.5) + 0.5; const col = (d) => rampAt(R, Math.min(0.999, u * 0.62 + d * 0.28 + (u > 0.6 ? (u - 0.6) * 0.5 : 0))); pen.ellipse(q.x, q.y, r, r * 1.2, col, (d) => (d < 0.75 ? 1 : (1 - d) * 4) * (u < 0.85 ? 1 : (1 - u) / 0.15)); pen.light(q.x, q.y, R[Math.min(R.length - 1, 3)], 0.35 * (1 - u)); if (u < 0.3) pen.glow(q.x, q.y, r * 3, R[2], 0.2); break; }
        case K.GRIT: pen.dot(q.x, q.y, c, 1); if (q.size > 1) pen.dot(q.x + 1, q.y, c, 1); break;
        case K.WISP: { for (let j = 0; j < 4; j++) pen.dot(q.x + Math.sin(this.t * 6 + j + q.seed) * 1.5, q.y + j * 2, c, k * (1 - j / 4)); pen.glow(q.x, q.y + 3, 6, c, 0.3 * k); break; }
        case K.BUBBLE: { const r = q.size; pen.ring(q.x, q.y, r + 0.5, 1, 1, c, k); pen.dot(q.x - r * 0.4, q.y - r * 0.4, WHITE, k); break; }
        case K.LEAF: { const s = Math.sin(this.t * 6 + q.seed); pen.dot(q.x, q.y, c, k); pen.dot(q.x + (s > 0 ? 1 : -1), q.y, c, k); pen.dot(q.x, q.y - 1, mix(c, WHITE, 0.4), k); break; }
      }
    }
  }
}
/** rigid debris: SHARD (thin tumbling line), CHUNK (shaded block), DRIP */
export const BK = { SHARD: 0, CHUNK: 1, DRIP: 2 };
export class Bits {
  constructor() { this.list = []; }
  add(b) { this.list.push({ g: 1, drag: 0.3, bounce: 0.35, a: 0, va: 0, s: 2, life: 1, fl: 0, ...b, max: b.life ?? 1 }); }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i]; if ((b.life -= dt) <= 0) { this.list.splice(i, 1); continue; }
      b.vy += G * b.g * dt; b.vx -= b.vx * b.drag * dt; b.x += b.vx * dt; b.a += b.va * dt;
      const ny = b.y + b.vy * dt; if (b.vy > 0 && ny >= b.fl) { b.y = b.fl; if (Math.abs(b.vy) > 90) { b.vy *= -b.bounce; b.vx *= 0.6; b.va *= 0.5; } else { b.vy = 0; b.vx *= 0.8; b.va = 0; } } else b.y = ny;
    }
  }
  draw(pen) {
    for (const b of this.list) {
      const k = Math.min(1, b.life / Math.min(0.4, b.max)), c = b.c;
      if (b.kind === BK.SHARD) { const dx = Math.cos(b.a) * b.s, dy = Math.sin(b.a) * b.s; pen.line(b.x - dx, b.y - dy, b.x + dx, b.y + dy, (u) => (u > 0.6 ? WHITE : c), k); pen.light(b.x, b.y, c, 0.25 * k); }
      else if (b.kind === BK.CHUNK) { const R = b.ramp, s = Math.max(1, Math.round(b.s)); for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) pen.dot(b.x + i - s / 2, b.y + j - s / 2, R[j === 0 ? R.length - 1 : i === s - 1 ? 0 : 1], k); }
      else { pen.dot(b.x, b.y, c, k); pen.dot(b.x, b.y - 1, c, k * 0.6); }
    }
  }
}
/** lights that flare and fall away (k falls with life²) */
export class Lights {
  constructor() { this.list = []; }
  add(x, y, r, c, k, life) { this.list.push({ x, y, r, c, k, life, max: life }); }
  update(dt) { this.list = this.list.filter((l) => (l.life -= dt) > 0); }
  draw(pen) { for (const l of this.list) { const f = l.life / l.max; pen.glow(l.x, l.y, l.r * (0.6 + 0.4 * f), l.c, l.k * f * f); } }
}
