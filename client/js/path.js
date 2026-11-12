// A* pathfinding on the tile grid (8 directions, no corner cutting) + line-of-sight smoothing
import { TILE } from '/shared/constants.js';

class Heap {
  constructor() { this.a = []; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

function nearestOpen(L, tx, ty) {
  if (!L.solid(tx, ty)) return [tx, ty];
  for (let r = 1; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (!L.solid(tx + dx, ty + dy)) return [tx + dx, ty + dy];
  }
  return null;
}

export function lineClear(L, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0); const steps = Math.ceil(d / 10);
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps, y = y0 + ((y1 - y0) * i) / steps;
    for (const [ox, oy] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) if (L.solid(Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE))) return false;
  }
  return true;
}

// returns array of world-space waypoints, or null
export function findPath(L, sx, sy, gx, gy, maxNodes = 90000) {
  if (lineClear(L, sx, sy, gx, gy)) return [[gx, gy]];
  const s = nearestOpen(L, Math.floor(sx / TILE), Math.floor(sy / TILE));
  const g = nearestOpen(L, Math.floor(gx / TILE), Math.floor(gy / TILE));
  if (!s || !g) return null;
  const W = L.w, key = (x, y) => y * W + x;
  const gScore = new Map(), came = new Map(), closed = new Set();
  const h = (x, y) => { const dx = Math.abs(x - g[0]), dy = Math.abs(y - g[1]); return dx + dy - 0.59 * Math.min(dx, dy); };
  const open = new Heap();
  gScore.set(key(s[0], s[1]), 0); open.push({ x: s[0], y: s[1], f: h(s[0], s[1]) });
  let found = false, n = 0;
  while (open.size && n++ < maxNodes) {
    const cur = open.pop(); const ck = key(cur.x, cur.y);
    if (closed.has(ck)) continue; closed.add(ck);
    if (cur.x === g[0] && cur.y === g[1]) { found = true; break; }
    const gc = gScore.get(ck);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cur.x + dx, ny = cur.y + dy;
      if (L.solid(nx, ny)) continue;
      if (dx && dy && (L.solid(cur.x + dx, cur.y) || L.solid(cur.x, cur.y + dy))) continue;
      const nk = key(nx, ny); if (closed.has(nk)) continue;
      const ng = gc + (dx && dy ? 1.414 : 1);
      if (ng < (gScore.get(nk) ?? Infinity)) { gScore.set(nk, ng); came.set(nk, ck); open.push({ x: nx, y: ny, f: ng + h(nx, ny) }); }
    }
  }
  if (!found) return null;
  const tiles = []; let k = key(g[0], g[1]);
  while (k !== undefined) { tiles.push([(k % W) * TILE + TILE / 2, Math.floor(k / W) * TILE + TILE / 2]); k = came.get(k); }
  tiles.reverse();
  tiles[tiles.length - 1] = [gx, gy];
  if (L.solid(Math.floor(gx / TILE), Math.floor(gy / TILE))) tiles[tiles.length - 1] = [g[0] * TILE + TILE / 2, g[1] * TILE + TILE / 2];
  // string-pull smoothing
  const out = []; let from = [sx, sy], i = 0;
  while (i < tiles.length) {
    let j = tiles.length - 1;
    while (j > i && !lineClear(L, from[0], from[1], tiles[j][0], tiles[j][1])) j--;
    out.push(tiles[j]); from = tiles[j]; i = j + 1;
  }
  return out;
}
