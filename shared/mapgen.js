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
  if (kind === 'town') {
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const dx = x - w / 2, dy = y - h / 2;
      if (Math.abs(dx) < 14 && Math.abs(dy) < 10) t[y * w + x] = 6;
      else if (Math.abs(dy) < 2 || Math.abs(dx) < 2) t[y * w + x] = 1;
    }
    // buildings around plaza
    const blds = [[4, 3, 7, 5], [w - 11, 3, 7, 5], [4, h - 8, 7, 5], [w - 11, h - 8, 7, 5], [Math.floor(w / 2) - 4, 1, 8, 3]];
    for (const [bx, by, bw, bh] of blds) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) set(x, y, 5);
    // decorative trees on the edges
    for (let i = 0; i < 40; i++) { const x = 1 + Math.floor(rng() * (w - 2)), y = 1 + Math.floor(rng() * (h - 2)); if (t[y * w + x] === 0) set(x, y, 3); }
    // fountain water
    for (let y = cy - 1; y <= cy; y++) for (let x = Math.floor(w / 2) - 1; x <= Math.floor(w / 2); x++) set(x, y, 2);
  } else if (kind === 'field') {
    // noise blobs of obstacles + lakes, a winding path from west to east
    const blobs = Math.floor((w * h) / 140);
    for (let i = 0; i < blobs; i++) {
      const bx = Math.floor(rng() * w), by = Math.floor(rng() * h), r = 1 + Math.floor(rng() * 3), v = rng() < 0.18 ? 2 : 3;
      for (let y = by - r; y <= by + r; y++) for (let x = bx - r; x <= bx + r; x++) if ((x - bx) ** 2 + (y - by) ** 2 <= r * r + rng() * 2) set(x, y, v);
    }
    let py = cy;
    for (let x = 1; x < w - 1; x++) {
      if (rng() < 0.3) py += rng() < 0.5 ? -1 : 1;
      py = Math.max(4, Math.min(h - 5, py));
      for (let k = -1; k <= 1; k++) set(x, py + k, 1);
    }
    // keep exit corridors open
    for (let x = 1; x < 6; x++) for (let k = -2; k <= 2; k++) { set(x, cy + k, 1); set(w - 1 - x, cy + k, 1); }
    for (let x = 1; x < 12; x++) { const yy = Math.round(cy + ((py - cy) * x) / 12); for (let k = -1; k <= 1; k++) set(w - 1 - x, yy + k, 1); }
  } else {
    // instance arenas: open rooms with pillars
    const pill = d.pillars ?? 10;
    for (let i = 0; i < pill; i++) {
      const x = 4 + Math.floor(rng() * (w - 8)), y = 4 + Math.floor(rng() * (h - 8));
      if (Math.abs(x - w / 2) < 5 && Math.abs(y - h / 2) < 5) continue;
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
