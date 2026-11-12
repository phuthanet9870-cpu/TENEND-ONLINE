// Deterministic map generation (identical on client & server => tiles never sent over network)
import { rngFrom } from './rng.js';
import { TILE } from './constants.js';
import { MAPS, ARENA_MAPS, BIOMES } from './world.js';

// tile codes: 0 ground, 1 path, 2 water (solid), 3 obstacle (solid), 4 wall (solid), 5 building (solid), 6 plaza
const cache = new Map();

export function getMapLayout(key, def) {
  if (cache.has(key)) return cache.get(key);
  const d = def || MAPS[key];
  const L = generate(key, d);
  cache.set(key, L);
  return L;
}

function generate(key, d) {
  const w = d.w, h = d.h;
  const rng = rngFrom('map:' + key);
  const t = new Uint8Array(w * h);
  const deco = new Uint8Array(w * h); // obstacle variant / ground variant
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < w && y < h) t[y * w + x] = v; };
  for (let i = 0; i < w * h; i++) deco[i] = Math.floor(rng() * 255);
  // border walls
  for (let x = 0; x < w; x++) { set(x, 0, 4); set(x, h - 1, 4); }
  for (let y = 0; y < h; y++) { set(0, y, 4); set(w - 1, y, 4); }
  const kind = d.kind || 'instance';
  const cy = Math.floor(h / 2);
  const noise = makeNoise(rng);
  if (kind === 'town') {
    const cx = Math.floor(w / 2);
    // roads to every edge + plaza + ring road
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const dx = x - cx, dy = y - cy;
      if (Math.abs(dx) <= 15 && Math.abs(dy) <= 11) t[y * w + x] = 6;
      else if (Math.abs(dy) <= 1 || Math.abs(dx) <= 1) t[y * w + x] = 1;
      else if ((Math.abs(dx) === 18 || Math.abs(dx) === 19) && Math.abs(dy) <= 14) t[y * w + x] = 1;
      else if ((Math.abs(dy) === 14 || Math.abs(dy) === 15) && Math.abs(dx) <= 19) t[y * w + x] = 1;
    }
    // houses scattered around the plaza (never on roads/plaza)
    const free = (bx, by, bw, bh) => { for (let y = by - 1; y <= by + bh; y++) for (let x = bx - 1; x <= bx + bw; x++) { if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) return false; if (t[y * w + x] !== 0) return false; } return true; };
    let placed = 0;
    for (let i = 0; i < 400 && placed < 26; i++) {
      const bw = 5 + Math.floor(rng() * 4), bh = 3 + Math.floor(rng() * 3);
      const bx = 2 + Math.floor(rng() * (w - bw - 4)), by = 2 + Math.floor(rng() * (h - bh - 4));
      if (Math.abs(bx + bw / 2 - cx) > 36 || Math.abs(by + bh / 2 - cy) > 26) continue;
      if (!free(bx, by, bw, bh)) continue;
      for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) set(x, y, 5);
      placed++;
    }
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (t[y * w + x] !== 0) continue;
      const far = Math.abs(x - cx) > 30 || Math.abs(y - cy) > 22;
      if (noise(x / 9, y / 9) > (far ? 0.6 : 0.82) && rng() < 0.55) t[y * w + x] = 3;
    }
    for (let y = cy - 1; y <= cy; y++) for (let x = cx - 1; x <= cx; x++) set(x, y, 2);
  } else if (kind === 'field') {
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const forest = noise(x / 13, y / 13), lake = noise(x / 24 + 50, y / 24 + 50);
      if (lake > 0.76) t[y * w + x] = 2;
      else if (forest > 0.66 && rng() < 0.8) t[y * w + x] = 3;
      else if (rng() < 0.012) t[y * w + x] = 3;
    }
    // winding main road west -> east, plus side roads
    const road = (x0, y0, horizontal, len) => {
      let px = x0, py = y0;
      for (let i = 0; i < len; i++) {
        if (horizontal) { px++; if (rng() < 0.3) py += rng() < 0.5 ? -1 : 1; py = Math.max(4, Math.min(h - 5, py)); }
        else { py++; if (rng() < 0.3) px += rng() < 0.5 ? -1 : 1; px = Math.max(4, Math.min(w - 5, px)); }
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (px + a > 0 && py + b > 0 && px + a < w - 1 && py + b < h - 1) t[(py + b) * w + px + a] = 1;
      }
      return [px, py];
    };
    let [ex, ey] = road(0, cy, true, w - 14);
    // connect road end to the east exit
    while (ey !== cy) { ey += ey < cy ? 1 : -1; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) set(ex + a, ey + b, 1); }
    for (let x = ex; x < w - 1; x++) for (let k = -1; k <= 1; k++) set(x, cy + k, 1);
    for (let i = 0; i < 4; i++) road(Math.floor(w * (0.15 + i * 0.22)), 1, false, h - 3);
    // clearings
    for (let i = 0; i < Math.floor((w * h) / 2500); i++) { const bx = Math.floor(rng() * w), by = Math.floor(rng() * h), r = 4 + Math.floor(rng() * 5); for (let y = by - r; y <= by + r; y++) for (let x = bx - r; x <= bx + r; x++) if ((x - bx) ** 2 + (y - by) ** 2 <= r * r && x > 0 && y > 0 && x < w - 1 && y < h - 1 && t[y * w + x] === 3) t[y * w + x] = 0; }
    for (let x = 1; x < 8; x++) for (let k = -3; k <= 3; k++) { set(x, cy + k, 1); set(w - 1 - x, cy + k, 1); }
  } else {
    // instance arenas: open rooms with pillars and rubble patches
    const pill = d.pillars ?? 10;
    const n = Math.round(pill * Math.max(1, (w * h) / 2400));
    for (let i = 0; i < n; i++) {
      const x = 4 + Math.floor(rng() * (w - 8)), y = 4 + Math.floor(rng() * (h - 8));
      if (Math.abs(x - w / 2) < 5 && Math.abs(y - h / 2) < 5) continue;
      if (x < 9 && Math.abs(y - cy) < 4) continue;
      set(x, y, 3); if (rng() < 0.5) set(x + 1, y, 3);
    }
  }
  // exits for fields/towns
  const exits = [];
  for (const e of d.exits || []) {
    const ex = e.side === 'w' ? 1 : w - 2;
    exits.push({ to: e.to, side: e.side, x: ex * TILE + TILE / 2, y: cy * TILE + TILE / 2 });
    for (let k = -2; k <= 2; k++) set(e.side === 'w' ? 0 : w - 1, cy + k, 1);
  }
  const solid = (tx, ty) => { if (tx < 0 || ty < 0 || tx >= w || ty >= h) return true; const v = t[ty * w + tx]; return v === 2 || v === 3 || v === 4 || v === 5; };
  return { key, w, h, tiles: t, deco, exits, biome: d.biome, solid, pxW: w * TILE, pxH: h * TILE, biomeDef: BIOMES[d.biome] };
}

function makeNoise(rng) {
  const P = 64, g = new Float32Array(P * P); for (let i = 0; i < g.length; i++) g[i] = rng();
  const at = (x, y) => g[((y % P) + P) % P * P + (((x % P) + P) % P)];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx, b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx; return a + (b - a) * fy; };
}
export function spotNear(L, rng, x, y, r) {
  for (let i = 0; i < 60; i++) { const a = rng() * 6.283, d = r * Math.sqrt(rng()); const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (canStand(L, px, py, 12)) return [px, py]; }
  return randomOpenSpot(L, rng, 3);
}
export function instanceLayout(key, size, biome, pillars) {
  return getMapLayout(key, { w: size[0], h: size[1], biome, kind: 'instance', pillars });
}
export function arenaLayout(mode) { const a = ARENA_MAPS[mode]; return getMapLayout('arena:' + mode, { ...a, kind: 'instance', pillars: mode === 'duel' ? 4 : 14 }); }

export function isSolidAt(L, x, y) { return L.solid(Math.floor(x / TILE), Math.floor(y / TILE)); }
export function canStand(L, x, y, r = 10) {
  return !isSolidAt(L, x - r, y - r) && !isSolidAt(L, x + r, y - r) && !isSolidAt(L, x - r, y + r) && !isSolidAt(L, x + r, y + r);
}
// line-of-travel: move with sliding collision
export function moveWithCollision(L, x, y, dx, dy, r = 10) {
  let nx = x + dx, ny = y;
  if (!canStand(L, nx, ny, r)) nx = x;
  ny = y + dy;
  if (!canStand(L, nx, ny, r)) ny = y;
  return [nx, ny];
}
export function randomOpenSpot(L, rng, margin = 3) {
  for (let i = 0; i < 300; i++) {
    const tx = margin + Math.floor(rng() * (L.w - margin * 2)), ty = margin + Math.floor(rng() * (L.h - margin * 2));
    if (!L.solid(tx, ty) && !L.solid(tx + 1, ty) && !L.solid(tx, ty + 1)) return [tx * TILE + TILE / 2, ty * TILE + TILE / 2];
  }
  return [L.pxW / 2, L.pxH / 2];
}
