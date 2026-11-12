// ===== Canvas renderer: top-down 3/4 pixel-art world, entities, skill FX, telegraphs =====
import { TILE, ELEMENT_INFO, STATUS_BITS } from '/shared/constants.js';
import { MAPS } from '/shared/world.js';
import { drawProjectile, drawImpact, drawField } from './vfx.js';
import { FX, drawDome, drawIcePrism } from './fx2.js';
import { recipeOf, SFX } from './skillfx.js';
import { MOVES } from './moves.js';
import { charSprite, weaponSprite, monsterSprite, groundTile, plazaTile, obstacleSprite, wallTile, borderTile, shade, drawEmblem } from './sprites.js';

const BIT = Object.fromEntries(STATUS_BITS.map((s, i) => [s, 1 << i]));
const glowOf = (el) => ({ fire: '#ff8a2a', ice: '#7ad8ff', lightning: '#a8c8ff', poison: '#8aff4a', holy: '#ffe080', shadow: '#9a5cff', arcane: '#ff5cd6' }[el] || '#ffffff');
const elc = (el) => ELEMENT_INFO[el]?.color || '#ffffff';
const elg = (el) => ELEMENT_INFO[el]?.glow || '#ffffff';

export class Renderer {
  constructor(canvas, game) {
    this.fxp = new FX();
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.g = game;
    this.cam = { x: 0, y: 0 }; this.fx = []; this.texts = []; this.parts = []; this.projs = new Map(); this.orbits = new Map();
    this.flash = new Map(); this.swing = new Map(); this.t = 0; this.shake = 0;
    this.mini = document.createElement('canvas');
    window.addEventListener('resize', () => this.resize()); this.resize();
  }
  resize() { this.cv.width = window.innerWidth; this.cv.height = window.innerHeight; this.ctx.imageSmoothingEnabled = false; }
  setMap(L) {
    this.L = L; this.fx = []; this.texts = []; this.parts = []; this.projs.clear(); this.orbits.clear();
    this.chunks = new Map(); this.CH = 16; // tiles per chunk side
    // per-chunk obstacle & water lists (ground is rendered lazily per chunk)
    const b = L.biomeDef; this.chunkObs = new Map(); this.chunkWater = new Map();
    const ck = (tx, ty) => `${Math.floor(tx / this.CH)},${Math.floor(ty / this.CH)}`;
    for (let ty = 0; ty < L.h; ty++) for (let tx = 0; tx < L.w; tx++) {
      const i = ty * L.w + tx, v = L.tiles[i], d = L.deco[i];
      if (v === 3) { const k = ck(tx, ty); if (!this.chunkObs.has(k)) this.chunkObs.set(k, []); this.chunkObs.get(k).push({ x: tx * TILE + 16, y: ty * TILE + 30, type: b.obstacle[d % b.obstacle.length], seed: d }); }
      if (v === 2) { const k = ck(tx, ty); if (!this.chunkWater.has(k)) this.chunkWater.set(k, []); this.chunkWater.get(k).push([tx * TILE, ty * TILE, d]); }
    }
    // minimap / full map image (1 px per tile scaled later)
    this.mini.width = L.w; this.mini.height = L.h; const m = this.mini.getContext('2d');
    const img = m.createImageData(L.w, L.h);
    const hex = (c) => { if (c.startsWith('rgb')) { const n = c.match(/\d+/g).map(Number); return n; } const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const cols = { 0: hex(b.ground[0]), 1: hex(b.path), 2: hex(b.water), 3: [34, 64, 30], 4: [20, 18, 26], 5: [120, 60, 40], 6: hex(b.path) };
    for (let i = 0; i < L.tiles.length; i++) { const c = cols[L.tiles[i]] || cols[0]; img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255; }
    m.putImageData(img, 0, 0);
  }
  chunk(cx, cy) {
    const key = cx + ',' + cy; let c = this.chunks.get(key);
    if (c) { this.chunks.delete(key); this.chunks.set(key, c); return c; }
    const L = this.L, b = L.biomeDef, CH = this.CH;
    c = document.createElement('canvas'); c.width = CH * TILE; c.height = CH * TILE; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    for (let ty = cy * CH; ty < Math.min(L.h, cy * CH + CH); ty++) for (let tx = cx * CH; tx < Math.min(L.w, cx * CH + CH); tx++) {
      const i = ty * L.w + tx, v = L.tiles[i], d = L.deco[i], X = (tx - cx * CH) * TILE, Y = (ty - cy * CH) * TILE;
      if (v === 4) { g.drawImage(borderTile(L.biome), X, Y); continue; }
      if (v === 5) { const below = ty + 1 < L.h ? L.tiles[i + L.w] : 0; g.drawImage(wallTile(below === 5), X, Y); continue; }
      const nz = Math.sin(tx * 0.21 + 1.3) + Math.sin(ty * 0.17 + 0.7) + Math.sin((tx + ty) * 0.09) + Math.sin((tx - ty) * 0.13);
      let col = b.ground[nz > 1 ? 1 : nz < -1 ? 2 : 0];
      if (v === 1) col = b.path;
      if (v === 6) g.drawImage(plazaTile(d), X, Y);
      else g.drawImage(groundTile(col, d, v === 0 && d % 7 === 0 ? 1 : 0), X, Y);
    }
    this.chunks.set(key, c);
    if (this.chunks.size > 80) this.chunks.delete(this.chunks.keys().next().value);
    return c;
  }
  w2s(x, y) { return [Math.round(x - this.cam.x + this.cv.width / 2), Math.round(y - this.cam.y + this.cv.height / 2)]; }
  s2w(x, y) { return [x + this.cam.x - this.cv.width / 2, y + this.cam.y - this.cv.height / 2]; }

  // ---------- FX intake ----------
  addFx(e) {
    const G = this.g; const now = this.t;
    switch (e.k) {
      case 'proj': {
        const p = this.projs.get(e.id) || { trail: [] };
        Object.assign(p, { x: e.x, y: e.y, vx: e.vx, vy: e.vy, r: e.r, el: e.el, until: now + e.life + 0.05, m: e.m, v: e.v || p.v, s: e.s ?? p.s });
        this.projs.set(e.id, p); break;
      }
      case 'pend': { const p = this.projs.get(e.id); if (p) { const rc = recipeOf(p.s); if (rc) MOVES.impact(this.fxp, rc, p.s, { x: p.x, y: p.y + 12, r: Math.max(34, (p.r || 6) * 5), ang: Math.atan2(p.vy, p.vx), shape: 'circle', minor: 1 }); this.fxp.sparks(p.x, p.y, p.el, 8, 120); if (p.el === 'fire') this.fxp.smoke(p.x, p.y, 2, 8, 20, 0.8); this.fxp.light(p.x, p.y, 40, glowOf(p.el), 0.15); this.projs.delete(e.id); } break; }
      case 'dmg': {
        const u = G.units.get(e.id); if (!u) break;
        if (e.miss) this.text(u.x, u.y - 30, 'MISS', '#aaaaaa', 12);
        else if (e.h) this.text(u.x, u.y - 30, '+' + e.v, '#5aff7a', 13);
        else {
          const mine = e.id === G.you; const col = mine ? '#ff5a5a' : e.c ? '#ffe14a' : elc(e.el) === '#e0d6c8' ? '#ffffff' : elc(e.el);
          this.text(u.x + (Math.random() - 0.5) * 20, u.y - 30, (e.c ? '★' : '') + fmt(e.v), col, e.c ? 18 : 13);
          this.flash.set(e.id, now + 0.1); this.fxp.sparks(u.x, u.y - 14, e.el, e.c ? 12 : 5, e.c ? 220 : 130); { const rc = recipeOf(e.s); if (rc) MOVES.hit(this.fxp, rc, e.s, u.x, u.y - 14, e.c); }
          if (mine) this.shake = Math.min(6, this.shake + 2);
        }
        break;
      }
      case 'gold': { const u = G.units.get(e.id); if (u && e.id === G.you) this.text(u.x + 20, u.y - 44, `+${e.v}G`, '#ffd84a', 11); break; }
      case 'pop': { const u = G.units.get(e.id); if (u) this.text(u.x, u.y - 60, e.text, e.c || '#fff', 15, 1.6); break; }
      case 'area': this.fx.push({ ...e, t0: now }); if (e.s != null && e.delay > 0.15 && !e.trap) { const rc = recipeOf(e.s); if (rc) this.fxp.add({ x: e.x, y: e.y, vx: 0, vy: 0, shape: 'glyph', life: e.delay + 0.1, r: e.r || 60, pal: rc.pal, sides: rc.sides, step: rc.step, rings: rc.rings, spin: rc.spin, ticks: rc.ticks, inner: rc.inner, alpha: 0.7 }); } if (e.boss) this.shake = Math.min(10, this.shake + 4); break;
      case 'tele': this.fx.push({ ...e, kind: 'tele', t0: now }); break;
      case 'teleCancel': this.fx = this.fx.filter((f) => !(f.kind === 'tele' && f.tid === e.id)); break;
      case 'beam': this.fx.push({ ...e, kind: 'beam', t0: now }); { const rc = recipeOf(e.s); if (rc) MOVES.beam(this.fxp, rc, e.s, e.x1, e.y1, e.x2, e.y2, e.w); } this.fxp.sparks(e.x2, e.y2, e.el, 14, 200); this.fxp.light(e.x2, e.y2, 70, glowOf(e.el), 0.25); this.fxp.light(e.x1, e.y1, 50, glowOf(e.el), 0.2); break;
      case 'chain': for (let i = 1; i < e.pts.length; i++) { const rc = recipeOf(e.s); this.fxp.bolt(e.pts[i - 1][0], e.pts[i - 1][1], e.pts[i][0], e.pts[i][1], rc ? rc.pal[2] : glowOf(e.el), 0.3, 2.5, 1); if (rc) SFX.hit(this.fxp, rc, e.pts[i][0], e.pts[i][1], 0); this.fxp.sparks(e.pts[i][0], e.pts[i][1], e.el, 6, 140); } break;
      case 'bolt': this.fxp.strike(e.x, e.y, e.el || 'lightning'); break;
      case 'dash': this.fx.push({ ...e, kind: 'dash', t0: now }); { const rc = recipeOf(e.s); if (rc) MOVES.dash(this.fxp, rc, e.s, e.x1, e.y1, e.x2, e.y2); } for (let i = 0; i < 10; i++) { const k = i / 10; this.fxp.trail(e.x1 + (e.x2 - e.x1) * k, e.y1 - 14 + (e.y2 - e.y1) * k, e.x2 - e.x1, e.y2 - e.y1, e.el); } if (e.blink) { this.fxp.arcaneBurst(e.x1, e.y1, 30); this.fxp.arcaneBurst(e.x2, e.y2, 30); } { const u = G.units.get(e.id); if (u && e.dur) { u.anim = { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, t0: now, dur: e.dur, leap: e.leap }; } } break;
      case 'cast': { this.swing.set(e.id, { t0: now, ang: e.ang, beh: e.beh }); const u = G.units.get(e.id); { const rc = recipeOf(e.s); if (rc && u) MOVES.cast(this.fxp, rc, e.s, u.x, u.y, e.ang || 0); } if (u && e.n && e.id !== G.you && u.meta?.k !== 'monster') this.text(u.x, u.y - 52, e.n, '#c8e8ff', 10, 0.8); break; }
      case 'ult': { const u = G.units.get(e.id); if (u) { this.text(u.x, u.y - 70, e.n, elc(e.el), 18, 1.8); this.fx.push({ kind: 'ring', x: u.x, y: u.y, el: e.el, t0: now, r: 200 }); this.fxp.pillar(u.x, u.y, e.el || 'holy', 220, 34); { const rc = recipeOf(e.s); if (rc) SFX.ult(this.fxp, rc, u.x, u.y); } this.fxp.light(u.x, u.y, 260, glowOf(e.el), 0.6); this.shake = 8; } break; }
      case 'matk': this.swing.set(e.id, { t0: now, ang: e.ang, beh: 'melee', wind: e.wind }); break;
      case 'orbit': this.orbits.set(e.id, { owner: e.owner, n: e.n, r: e.r, until: now + e.dur, el: e.el }); break;
      case 'orbitEnd': this.orbits.delete(e.id); break;
      case 'buff': this.fx.push({ kind: 'ring', x: 0, y: 0, follow: e.id, el: e.el, t0: now, r: 50 }); { const rc = recipeOf(e.s), u = G.units.get(e.id); if (rc && u) MOVES.buff(this.fxp, rc, e.s, u.x, u.y); } { const u = G.units.get(e.id); if (u && e.v) this.fx.push({ k: 'area', x: u.x, y: u.y, follow: e.id, shape: 'circle', r: 46, el: e.el, delay: 0, dur: 0, v: e.v === 'parry' || e.v === 'steel' ? 'runes' : e.v === 'rage' ? 'explosion' : e.v === 'wind' ? 'rings' : e.v === 'note' ? 'heal' : e.v === 'enchant' ? 'sparkle' : e.v, t0: now }); } break;
      case 'hop': { const u = G.units.get(e.id); if (u) u.anim = { x1: u.x, y1: u.y, x2: u.x, y2: u.y, t0: now, dur: Math.min(1, e.dur), leap: 1 }; break; }
      case 'lvl': { const u = G.units.get(e.id); if (u) { this.fxp.respawn(u.x, u.y); this.fx.push({ kind: 'ring', follow: e.id, el: 'holy', t0: now, r: 90 }); this.text(u.x, u.y - 70, 'LEVEL UP!', '#7fe8ff', 18, 2); } break; }
      case 'counter': this.fx.push({ kind: 'ring', follow: e.id, el: 'lightning', t0: now, r: 40, fast: 1 }); break;
      case 'dodge': this.fx.push({ kind: 'ghost', id: e.id, t0: now }); break;
      case 'die': { const u = G.units.get(e.id); if (u && !e.quiet) { if (u.flags & BIT.freeze) this.fxp.shatter(u.x, u.y); else if (u.meta?.b) this.fxp.explosion(u.x, u.y, 160, u.meta?.el || 'fire'); else this.fxp.disintegrate(u.x, u.y, 'physical', (u.meta?.r || 12) * 3); } break; }
      case 'trapEnd': this.fx = this.fx.filter((f) => !(f.trap && Math.abs(f.x - e.x) < 2 && Math.abs(f.y - e.y) < 2)); break;
    }
  }
  // play a skill's VFX on the local player (skill window preview)
  previewSkill(n) {
    const rc = recipeOf(n), me = this.g.units.get(this.g.you); if (!rc || !me) return;
    const a = me.facing || 0, F = this.fxp, beh = rc.beh, near = ['melee', 'nova'].includes(beh);
    const tx = near ? me.x + Math.cos(a) * 10 : me.x + Math.cos(a) * 180, ty = near ? me.y + Math.sin(a) * 6 : me.y + Math.sin(a) * 110;
    MOVES.cast(F, rc, n, me.x, me.y, a);
    if (rc.ult) SFX.ult(F, rc, me.x, me.y);
    const area = { x: tx, y: ty, r: beh === 'melee' ? 70 : beh === 'nova' ? 130 : 90, ang: a, shape: beh === 'beam' ? 'line' : 'circle', len: 220 };
    if (['buff', 'heal', 'summon', 'totem', 'orbit'].includes(beh)) { setTimeout(() => MOVES.buff(F, rc, n, me.x, me.y), 150); if (beh !== 'buff') setTimeout(() => MOVES.impact(F, rc, n, { ...area, r: 80 }), 350); return; }
    if (beh === 'projectile' || beh === 'barrage' || beh === 'chain') { const id = -1e6 - Math.floor(Math.random() * 1e5); this.projs.set(id, { trail: [], x: me.x, y: me.y - 14, vx: Math.cos(a) * 520, vy: Math.sin(a) * 340, r: 6, el: rc.el, until: this.t + 0.33, s: n }); setTimeout(() => MOVES.impact(F, rc, n, area), 330); return; }
    if (beh === 'dash' || beh === 'leap') MOVES.dash(F, rc, n, me.x, me.y, tx, ty);
    if (beh === 'beam') { MOVES.beam(F, rc, n, me.x, me.y - 12, me.x + Math.cos(a) * 240, me.y - 12 + Math.sin(a) * 150, 24); return; }
    setTimeout(() => MOVES.impact(F, rc, n, area), near ? 60 : 200);
  }
  text(x, y, s, c, size = 13, life = 1) { this.texts.push({ x, y, s, c, size, t0: this.t, life }); if (this.texts.length > 150) this.texts.shift(); }
  burst(x, y, c, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = 40 + Math.random() * 120; this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, c, t0: this.t, life: 0.3 + Math.random() * 0.4 }); } if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600); }

  // ---------- frame ----------
  draw(dt) {
    this.t += dt;
    const G = this.g, ctx = this.ctx, W = this.cv.width, H = this.cv.height;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(0, 0, W, H);
    if (!this.L) return;
    const me = G.units.get(G.you);
    if (me) { this.cam.x += (me.x - this.cam.x) * Math.min(1, dt * 10); this.cam.y += (me.y - 10 - this.cam.y) * Math.min(1, dt * 10); }
    let sx = 0, sy = 0; if (this.shake > 0) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; this.shake = Math.max(0, this.shake - dt * 25); }
    ctx.save(); ctx.translate(sx, sy);
    // ground
    const x0 = Math.round(this.cam.x - W / 2), y0 = Math.round(this.cam.y - H / 2);
    const CS = this.CH * TILE;
    const cx0 = Math.max(0, Math.floor(x0 / CS)), cy0 = Math.max(0, Math.floor(y0 / CS)), cx1 = Math.min(Math.ceil(this.L.w / this.CH) - 1, Math.floor((x0 + W) / CS)), cy1 = Math.min(Math.ceil(this.L.h / this.CH) - 1, Math.floor((y0 + H) / CS));
    const visKeys = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) { ctx.drawImage(this.chunk(cx, cy), cx * CS - x0, cy * CS - y0); visKeys.push(cx + ',' + cy); }
    // water shimmer
    const wc = this.L.biomeDef.water;
    for (const k of visKeys) for (const [X, Y, d] of this.chunkWater.get(k) || []) {
      ctx.fillStyle = wc; ctx.fillRect(X - x0, Y - y0, 32, 32);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; const o = ((this.t * 12 + d) % 32) | 0; ctx.fillRect(X - x0 + o % 28, Y - y0 + ((d >> 3) % 24), 6, 2);
    }
    // ground FX (areas, telegraphs, traps, objectives)
    this.fxp.drawDecals(ctx, dt, (wx, wy) => this.w2s(wx, wy));
    this.drawObjectives(ctx);
    this.drawGroundFx(ctx, dt);
    this.drawNavAndTarget(ctx);
    // drops
    for (const d of G.drops) {
      const [x, y] = this.w2s(d[1], d[2]);
      const bob = Math.sin(this.t * 4 + d[0]) * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 6, y + 4, 12, 3);
      ctx.fillStyle = d[4]; ctx.fillRect(x - 5, y - 5 + bob, 10, 10); ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 3 + bob, 3, 3);
      ctx.strokeStyle = d[4]; ctx.globalAlpha = 0.5 + Math.sin(this.t * 5) * 0.3; ctx.beginPath(); ctx.moveTo(x, y + bob); ctx.lineTo(x, y - 30 + bob); ctx.stroke(); ctx.globalAlpha = 1;
      if (G.showLoot || (me && Math.hypot(d[1] - me.x, d[2] - me.y) < 200)) { ctx.font = '11px Tahoma'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(d[3], x + 1, y - 13 + bob); ctx.fillStyle = d[4]; ctx.fillText(d[3], x, y - 14 + bob); }
    }
    // y-sorted world objects
    const list = [];
    const oKeys = new Set(visKeys); for (const k of visKeys) { const [a, b2] = k.split(',').map(Number); oKeys.add(a + ',' + (b2 + 1)); }
    for (const k of oKeys) for (const o of this.chunkObs.get(k) || []) if (o.x > x0 - 40 && o.x < x0 + W + 40 && o.y > y0 - 20 && o.y < y0 + H + 60) list.push({ y: o.y, o });
    for (const e of this.L.exits) list.push({ y: e.y + 20, portal: e });
    for (const u of G.units.values()) list.push({ y: u.y, u });
    for (const n of G.npcs) list.push({ y: n.y, n });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) { if (it.o) { const [x, y] = this.w2s(it.o.x, it.o.y); ctx.drawImage(obstacleSprite(it.o.type, it.o.seed), x - 16, y - 52); } else if (it.u) this.drawUnit(ctx, it.u); else if (it.portal) this.drawPortal(ctx, it.portal); else this.drawNpc(ctx, it.n); }
    this.drawProjectiles(ctx, dt);
    this.fxp.draw(ctx, dt, (wx, wy) => this.w2s(wx, wy));
    this.drawAirFx(ctx);
    this.drawOrbits(ctx);
    // particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; const a = (this.t - p.t0) / p.life; if (a >= 1) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt;
      const [x, y] = this.w2s(p.x, p.y); ctx.globalAlpha = 1 - a; ctx.fillStyle = p.c; ctx.fillRect(x - 1, y - 1, 3, 3);
    }
    ctx.globalAlpha = 1;
    // floating text
    ctx.textAlign = 'center';
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const tx = this.texts[i]; const a = (this.t - tx.t0) / tx.life; if (a >= 1) { this.texts.splice(i, 1); continue; }
      const [x, y] = this.w2s(tx.x, tx.y - a * 40);
      ctx.font = `bold ${tx.size}px Tahoma`; ctx.globalAlpha = a > 0.7 ? (1 - a) / 0.3 : 1;
      ctx.fillStyle = '#000'; ctx.fillText(tx.s, x + 1, y + 1); ctx.fillStyle = tx.c; ctx.fillText(tx.s, x, y);
    }
    ctx.globalAlpha = 1;
    if (this.L.biomeDef.fog) { ctx.fillStyle = this.L.biomeDef.fog; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    // vignette
    const grd = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    this.fxp.drawScreen(ctx, dt, W, H); { const sk = this.fxp.takeShake(); if (sk) this.shake = Math.min(14, Math.max(this.shake, sk)); }
    if (me && me.dead) { ctx.fillStyle = 'rgba(60,0,0,0.35)'; ctx.fillRect(0, 0, W, H); }
  }

  drawNpc(ctx, n) {
    const [x, y] = this.w2s(n.x, n.y);
    const pal = NPC_PAL[n.type] || NPC_PAL.shop;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 12, 4, 0, 0, 7); ctx.fill();
    ctx.drawImage(charSprite(pal.cls, pal, 0), x - 18, y - 52, 36, 60);
    ctx.font = 'bold 11px Tahoma'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(n.name, x + 1, y - 55); ctx.fillStyle = '#ffe08a'; ctx.fillText(n.name, x, y - 56);
    const me = this.g.units.get(this.g.you);
    if (me && Math.hypot(me.x - n.x, me.y - n.y) < 110) { ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Tahoma'; ctx.fillText('[E] คุย', x, y - 70 + Math.sin(this.t * 5) * 2); }
  }

  drawUnit(ctx, u) {
    const m = u.meta || {}; const G = this.g;
    let ux = u.x, uy = u.y, lift = 0;
    if (u.anim) { const a = (this.t - u.anim.t0) / u.anim.dur; if (a < 1) { ux = u.anim.x1 + (u.anim.x2 - u.anim.x1) * a; uy = u.anim.y1 + (u.anim.y2 - u.anim.y1) * a; if (u.anim.leap) lift = Math.sin(a * Math.PI) * 60; } else u.anim = null; }
    const [x, y] = this.w2s(ux, uy);
    if (x < -150 || y < -150 || x > this.cv.width + 150 || y > this.cv.height + 200) return;
    const dead = u.flags & (1 << 30);
    const r = m.r || 12;
    ctx.globalAlpha = dead ? 0.35 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 2, r * 0.9, r * 0.35, 0, 0, 7); ctx.fill();
    if (m.b && !dead) { ctx.strokeStyle = u.flags & BIT.weak ? '#ff2a2a' : 'rgba(255,80,60,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 2, r * 1.2 + Math.sin(this.t * 4) * 3, r * 0.45, 0, 0, 7); ctx.stroke(); }
    const flash = (this.flash.get(u.id) || 0) > this.t;
    const facingLeft = Math.cos(u.facing || 0) < 0;
    const moving = u.moving;
    const frame = dead ? 0 : moving ? (Math.floor(this.t * 8 + u.id) % 4 === 1 ? 1 : Math.floor(this.t * 8 + u.id) % 4 === 3 ? 2 : 0) : 0;
    ctx.save(); ctx.translate(x, y - lift);
    if (u.flags & BIT.freeze) ctx.filter = 'saturate(0.4) brightness(1.25)';
    if (flash) ctx.filter = 'brightness(3)';
    const isHuman = m.k === 'player' || m.k === 'bot' || (m.k === 'minion' && (m.c === 'clone' || m.c === 'angel'));
    if (isHuman) {
      const cls = m.k === 'minion' ? m.c : m.c; const pal = m.k === 'minion' ? (m.c === 'angel' ? { body: '#f8f4ff', trim: '#ffe14a', skin: '#f0d0b0', hair: '#ffe08a' } : { body: '#2a2238', trim: '#6a3aa8', skin: '#5a4a6a', hair: '#1a1220' }) : (m.pal || { body: '#888', trim: '#ccc', skin: '#e6b48a', hair: '#333' });
      const spr = charSprite(cls, pal, frame);
      const sc = 2;
      ctx.scale(facingLeft ? -1 : 1, 1);
      if (m.k === 'minion') ctx.globalAlpha *= 0.8;
      ctx.drawImage(spr, -spr.width, -spr.height * sc + 8, spr.width * sc, spr.height * sc);
      // weapon
      if (m.w || m.k !== 'minion') {
        const sw = this.swing.get(u.id); let ang = 0.6;
        if (sw) { const a = (this.t - sw.t0) / 0.25; if (a < 1) ang = sw.beh === 'melee' || sw.beh === 'dash' ? -1.6 + a * 3 : -0.2; else this.swing.delete(u.id); }
        const ws = weaponSprite(m.w || 'sword');
        ctx.save(); ctx.translate(8, -22); ctx.rotate(ang); ctx.drawImage(ws, -2, -10, ws.width * 1.6, ws.height * 1.6); ctx.restore();
      }
    } else {
      const kind = m.c || 'slime';
      const spr = monsterSprite(kind, m.t || '#88aa66');
      const sc = Math.max(2, Math.round((r * 2.6) / 16));
      const bob = kind === 'bat' || kind === 'wraith' || kind === 'spirit' || kind === 'drone' || kind === 'elemental' || kind === 'siren' ? Math.sin(this.t * 6 + u.id) * 3 - 6 : moving ? -Math.abs(Math.sin(this.t * 10 + u.id)) * 2 : 0;
      const sw = this.swing.get(u.id);
      let lunge = 0; if (sw) { const a = (this.t - sw.t0) / (sw.wind ? sw.wind + 0.15 : 0.3); if (a < 1) lunge = a < 0.7 ? -a * 6 : 12; else this.swing.delete(u.id); }
      ctx.scale(facingLeft ? -1 : 1, 1);
      if (m.k === 'minion' || m.k === 'totem') ctx.globalAlpha *= 0.85;
      ctx.drawImage(spr, -8 * sc + lunge, -16 * sc + 4 + bob, 16 * sc, 16 * sc);
    }
    ctx.restore(); ctx.filter = 'none'; ctx.globalAlpha = 1;
    const topY = y - lift - (isHuman ? 58 : Math.max(2, Math.round((r * 2.6) / 16)) * 16) - 6;
    // status visuals
    if (!dead) {
      if (u.flags & BIT.stun) for (let i = 0; i < 3; i++) { const a = this.t * 5 + i * 2.1; ctx.fillStyle = '#ffe14a'; ctx.fillRect(x + Math.cos(a) * 12 - 2, topY + 4 + Math.sin(a) * 3, 4, 4); }
      if (u.flags & BIT.burn && Math.random() < 0.5) this.fxp.flame(u.x, u.y - Math.random() * r * 1.5, 1, r, 70, 2, 0.45);
      if (u.flags & BIT.freeze) drawIcePrism(ctx, x, y - lift + 2, r * 2.2, r * 3.4, this.t);
      if (u.flags & BIT.poison && Math.random() < 0.2) this.parts.push({ x: u.x + (Math.random() - 0.5) * r, y: u.y - Math.random() * 20, vx: 0, vy: -30, c: '#7be04a', t0: this.t, life: 0.5 });
      if (u.flags & BIT.bleed && Math.random() < 0.15) this.parts.push({ x: u.x, y: u.y - 15, vx: (Math.random() - 0.5) * 40, vy: 0, c: '#c0102a', t0: this.t, life: 0.4 });
      if (u.flags & BIT.shock && Math.random() < 0.12) this.fxp.bolt(u.x - r, u.y - r * 2.5, u.x + r * 0.6, u.y - 4, '#c8e0ff', 0.1, 1.2, 0);
      if (u.flags & BIT.poison && Math.random() < 0.15) this.fxp.add({ x: u.x + (Math.random() - 0.5) * r, y: u.y - r * 2, vx: 0, vy: -25, life: 0.7, pal: ['#f0ffd0', '#8aff4a', '#2a8a2a'], shape: 'bubble', size: 2, add: false });
      if (u.sh > 0 || u.flags & BIT.shield) drawDome(ctx, x, y - lift + 2, r + 14, this.t + u.id);
      if (u.flags & BIT.weak) { ctx.fillStyle = `rgba(255,40,40,${0.4 + Math.sin(this.t * 10) * 0.3})`; ctx.beginPath(); ctx.arc(x, y - r - 10, 8, 0, 7); ctx.fill(); }
      if (u.flags & BIT.buff) { ctx.strokeStyle = 'rgba(255,208,96,0.5)'; ctx.beginPath(); ctx.ellipse(x, y + 2, r + 6, (r + 6) * 0.4, 0, 0, 7); ctx.stroke(); }
    }
    // name & hp bar
    const isMe = u.id === G.you;
    const enemy = m.tm !== G.myTeam;
    if (!dead && !isMe && (m.k !== 'totem')) {
      const bw = m.b ? 70 : Math.max(26, r * 2.2), bh = m.b ? 6 : 4;
      if (m.k !== 'minion' || enemy) {
        ctx.fillStyle = '#000'; ctx.fillRect(x - bw / 2 - 1, topY - 1, bw + 2, bh + 2);
        ctx.fillStyle = enemy ? (m.k === 'monster' ? '#d83a2a' : '#ff4a8a') : '#4ad86a'; ctx.fillRect(x - bw / 2, topY, (bw * u.hp) / 1000, bh);
        if (u.sh) { ctx.fillStyle = '#a0e0ff'; ctx.fillRect(x - bw / 2, topY, Math.min(bw, (bw * u.sh) / 1000), 2); }
      }
    }
    if (m.k === 'player' || m.k === 'bot' || m.b || m.e) {
      ctx.font = m.b ? 'bold 13px Tahoma' : '11px Tahoma'; ctx.textAlign = 'center';
      const label = `${m.g ? `[${m.g}] ` : ''}${m.n}${m.lv && !m.b ? ` Lv${m.lv}` : ''}`;
      ctx.fillStyle = '#000'; ctx.fillText(label, x + 1, topY - 4);
      ctx.fillStyle = isMe ? '#7fe8ff' : m.b ? '#ff7a5a' : m.e ? '#ffd84a' : enemy ? '#ff8aa8' : '#ffffff'; ctx.fillText(label, x, topY - 5);
      if (m.title) { ctx.font = '10px Tahoma'; ctx.fillStyle = '#ffd84a'; ctx.fillText(`«${m.title}»`, x, topY - 17); }
    }
  }

  drawProjectiles(ctx, dt) {
    for (const [id, p] of this.projs) {
      if (this.t > p.until) { this.projs.delete(id); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.trail.push([p.x, p.y]); if (p.trail.length > 6) p.trail.shift();
      const rc = !p.m && recipeOf(p.s);
      if (rc) { if (Math.random() < 0.6) this.fxp.trail(p.x, p.y, p.vx, p.vy, p.el, p.r); SFX.trail(this.fxp, rc, p.x, p.y, p.vx, p.vy); } else if (!p.m) this.fxp.trail(p.x, p.y, p.vx, p.vy, p.el, p.r); else if (Math.random() < 0.5) this.fxp.trail(p.x, p.y, p.vx, p.vy, 'fire', p.r);
      const c = rc ? rc.pal[2] : elc(p.el), g = rc ? rc.pal[1] : elg(p.el);
      ctx.strokeStyle = c; ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(2, p.r * 0.8); ctx.beginPath();
      p.trail.forEach(([tx, ty], i) => { const [sx, sy] = this.w2s(tx, ty); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke(); ctx.globalAlpha = 1;
      const [x, y] = this.w2s(p.x, p.y);
      if (rc) { MOVES.drawProj(ctx, rc, p.s, x, y, p, this.t); continue; }
      if (!p.m && drawProjectile(ctx, p, x, y, c, g, this.t)) continue;
      const rr = Math.max(3, p.r);
      ctx.fillStyle = p.m ? '#ff5a3a' : c; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      ctx.fillStyle = g; ctx.fillRect(x - rr / 2, y - rr / 2, rr, rr);
    }
  }

  shapePath(ctx, f, x, y, rScale = 1) {
    ctx.beginPath();
    switch (f.shape) {
      case 'circle': ctx.arc(x, y, f.r * rScale, 0, Math.PI * 2); break;
      case 'donut': ctx.arc(x, y, f.r * rScale, 0, Math.PI * 2); ctx.arc(x, y, f.r2 || 0, 0, Math.PI * 2, true); break;
      case 'cone': { const a = ((f.arc || 90) * Math.PI) / 360; ctx.moveTo(x, y); ctx.arc(x, y, f.r * rScale, f.ang - a, f.ang + a); ctx.closePath(); break; }
      case 'line': case 'cross': {
        const angs = f.shape === 'cross' ? [f.ang, f.ang + Math.PI / 2, f.ang + Math.PI, f.ang - Math.PI / 2] : [f.ang];
        for (const g of angs) { const c = Math.cos(g), s = Math.sin(g), w = f.w / 2, L = f.len * rScale; ctx.moveTo(x - s * w, y + c * w); ctx.lineTo(x + c * L - s * w, y + s * L + c * w); ctx.lineTo(x + c * L + s * w, y + s * L - c * w); ctx.lineTo(x + s * w, y - c * w); ctx.closePath(); }
        break;
      }
    }
  }
  drawGroundFx(ctx, dt0 = 0.016) {
    const keep = [];
    for (const f of this.fx) {
      const age = this.t - f.t0;
      if (f.follow) { const u = this.g.units.get(f.follow); if (u) { f.x = u.x; f.y = u.y; } }
      if (f.kind === 'tele') {
        if (age > f.dur) continue; keep.push(f);
        const [x, y] = this.w2s(f.x, f.y); const p = age / f.dur;
        const col = f.counter ? '255,210,60' : '255,50,40';
        ctx.fillStyle = `rgba(${col},${f.small ? 0.12 : 0.16})`; this.shapePath(ctx, f, x, y); ctx.fill('evenodd');
        ctx.fillStyle = `rgba(${col},${0.3})`; this.shapePath(ctx, f, x, y, p); if (f.shape !== 'donut') ctx.fill();
        ctx.strokeStyle = `rgba(${col},0.9)`; ctx.lineWidth = f.counter ? 3 : 2; this.shapePath(ctx, f, x, y); ctx.stroke();
        continue;
      }
      if (f.kind === 'ring') {
        const d = f.fast ? 0.25 : 0.6; if (age > d) continue; keep.push(f);
        const u = f.follow ? this.g.units.get(f.follow) : null; const [x, y] = this.w2s(u ? u.x : f.x, u ? u.y : f.y);
        ctx.strokeStyle = elc(f.el); ctx.globalAlpha = 1 - age / d; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, f.r * (age / d), f.r * (age / d) * 0.5, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
        continue;
      }
      if (f.k !== 'area') { keep.push(f); continue; }
      const total = (f.delay || 0) + Math.max(f.dur || 0, 0.35);
      if (f.trap) { if (age > (f.dur || 15) + 0.5) continue; keep.push(f); const [x, y] = this.w2s(f.x, f.y); ctx.strokeStyle = elc(f.el); ctx.globalAlpha = 0.6 + Math.sin(this.t * 6) * 0.3; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, f.r * 0.5, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); ctx.stroke(); ctx.globalAlpha = 1; continue; }
      if (age > total) continue; keep.push(f);
      const [x, y] = this.w2s(f.x, f.y);
      const col = f.heal ? '#7aff9a' : elc(f.el);
      if (age < (f.delay || 0)) {
        // friendly pre-cast marker
        ctx.strokeStyle = col; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; this.shapePath(ctx, f, x, y); ctx.stroke();
        ctx.globalAlpha = 0.15; ctx.fillStyle = col; this.shapePath(ctx, f, x, y, age / f.delay); ctx.fill('evenodd'); ctx.globalAlpha = 1;
        continue;
      }
      const a = age - (f.delay || 0);
      if (f.dur) { // lingering field
        this.fxp.field(f.x, f.y, f.r || f.len || 60, f.heal ? 'holy' : f.el, f.v, dt0); { const rc = recipeOf(f.s); if (rc) { if (!f.started) { f.started = 1; MOVES.fieldStart(this.fxp, rc, f.s, f); } MOVES.field(this.fxp, rc, f.s, f, dt0); SFX.field(this.fxp, rc, f.x, f.y, (f.r || f.len || 60) * 0.5, dt0 * 0.4); } }
        const tint = drawField(ctx, f, x, y, this.t, col, elg(f.el));
        ctx.globalAlpha = 0.18 + Math.sin(this.t * 6) * 0.06; ctx.fillStyle = tint || col; this.shapePath(ctx, f, x, y); ctx.fill('evenodd');
        ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = 1; this.shapePath(ctx, f, x, y); ctx.stroke(); ctx.globalAlpha = 1;
        if (Math.random() < 0.3) this.parts.push({ x: f.x + (Math.random() - 0.5) * (f.r || 60), y: f.y + (Math.random() - 0.5) * (f.r || 60) * 0.6, vx: 0, vy: -40, c: col, t0: this.t, life: 0.5 });
      } else { // impact burst
        if (f.ghost) continue;
        if (!f.particled) { f.particled = 1; this.impactFx(f); }
        if (f.v && drawImpact(ctx, f, x, y, Math.min(1, a / 0.4), col, elg(f.el))) { if (a < 0.05 && !f.burst) { f.burst = 1; this.burst(f.x, f.y, col, 6); } continue; }
        const p = Math.min(1, a / 0.3);
        ctx.globalAlpha = (1 - p) * 0.55; ctx.fillStyle = col; this.shapePath(ctx, f, x, y, f.melee ? 0.6 + p * 0.4 : 0.4 + p * 0.6); ctx.fill('evenodd');
        ctx.globalAlpha = 1 - p; ctx.strokeStyle = elg(f.el); ctx.lineWidth = 3; this.shapePath(ctx, f, x, y, 0.4 + p * 0.6); ctx.stroke(); ctx.globalAlpha = 1;
        if (a < 0.05 && !f.burst) { f.burst = 1; if (f.shape === 'circle') this.burst(f.x, f.y, col, Math.min(20, (f.r || 50) / 6)); }
      }
    }
    this.fx = keep;
  }
  impactFx(f) {
    const r = f.r || 60, el = f.heal ? 'holy' : (f.el || 'physical'), v = f.v || '', F = this.fxp, x = f.x, y = f.y;
    { const rc = recipeOf(f.s); if (rc) { MOVES.impact(F, rc, f.s, f); return; } }
    if (f.melee || ['slash', 'crescent', 'xslash', 'combo', 'rend', 'flurry', 'thrust'].includes(v)) { const a = f.ang || 0; for (let i = 0; i < 6; i++) F.sparks(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6 - 10, el, 2, 160); if (el === 'fire') F.flame(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, 8, r * 0.5); else if (el !== 'physical') F.light(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r, glowOf(el), 0.2); return; }
    if (['explosion', 'bomb', 'meteor', 'asura'].includes(v)) return F.explosion(x, y, r, el === 'physical' ? 'fire' : el);
    if (v === 'pillar') return F.pillar(x, y, el === 'physical' ? 'holy' : el, 150, r * 0.6);
    if (v === 'vortex' || v === 'blackhole') return F.implosion(x, y, r, el);
    if (f.heal || v === 'heal') return F.healBurst(x, y, r);
    if (['holy', 'cross', 'sparkle'].includes(v) || el === 'holy') return F.holyBeam(x, y, Math.min(80, r));
    if (v === 'wave' && el === 'ice') return F.waterBurst(x, y, r);
    if (['frost', 'blizzard', 'stone'].includes(v) || el === 'ice') { if (f.shape === 'donut') { for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; F.iceBurst(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, 14); } return; } return F.iceBurst(x, y, r); }
    if (['bolt', 'storm'].includes(v) || el === 'lightning') { F.strike(x, y, 'lightning', 260); if (r > 80) for (let i = 0; i < 3; i++) F.bolt(x, y, x + (Math.random() - 0.5) * r * 2, y + (Math.random() - 0.5) * r, '#a8c8ff', 0.25, 1.5, 1); return; }
    if (['dark', 'shadowstep'].includes(v) || el === 'shadow') return F.shadowBurst(x, y, r);
    if (['cloud', 'swamp', 'vines'].includes(v) || el === 'poison') return F.poisonBurst(x, y, r);
    if (['runes', 'clock', 'star'].includes(v) || el === 'arcane') return F.arcaneBurst(x, y, r);
    if (el === 'fire') { if (f.shape === 'donut') return F.fireRing(x, y, r); F.explosion(x, y, Math.min(r, 90), 'fire'); return; }
    F.dust(x, y, r); F.sparks(x, y - 6, 'physical', 8, 160);
  }
  drawAirFx(ctx) {
    for (const f of this.fx) {
      const age = this.t - f.t0;
      if (f.kind === 'beam' && age < 0.3) {
        const [x1, y1] = this.w2s(f.x1, f.y1), [x2, y2] = this.w2s(f.x2, f.y2); const a = 1 - age / 0.3;
        ctx.strokeStyle = elc(f.el); ctx.globalAlpha = a; ctx.lineWidth = f.w * a; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, f.w * 0.3 * a); ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (f.kind === 'chain' && age < (f.short ? 0.1 : 0.3)) {
        ctx.strokeStyle = elc(f.el); ctx.lineWidth = 2; ctx.globalAlpha = 1 - age / 0.3; ctx.beginPath();
        f.pts.forEach(([px, py], i) => { const [x, y] = this.w2s(px, py); if (!i) ctx.moveTo(x, y); else { const [qx, qy] = this.w2s(f.pts[i - 1][0], f.pts[i - 1][1]); ctx.lineTo((qx + x) / 2 + (Math.random() - 0.5) * 16, (qy + y) / 2 + (Math.random() - 0.5) * 16); ctx.lineTo(x, y); } });
        ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (f.kind === 'dash' && age < 0.35) {
        const [x1, y1] = this.w2s(f.x1, f.y1), [x2, y2] = this.w2s(f.x2, f.y2);
        ctx.strokeStyle = elc(f.el); ctx.globalAlpha = (1 - age / 0.35) * 0.6; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x1, y1 - 16); ctx.lineTo(x2, y2 - 16); ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (f.kind === 'ghost' && age < 0.3) { const u = this.g.units.get(f.id); if (u) { const [x, y] = this.w2s(u.x, u.y); ctx.fillStyle = `rgba(160,240,255,${0.4 * (1 - age / 0.3)})`; ctx.fillRect(x - 10, y - 40, 20, 40); } }
    }
  }
  drawOrbits(ctx) {
    for (const [id, o] of this.orbits) {
      if (this.t > o.until) { this.orbits.delete(id); continue; }
      const u = this.g.units.get(o.owner); if (!u || u.flags & (1 << 30)) continue;
      for (let i = 0; i < o.n; i++) {
        const a = this.t * 4 + (i / o.n) * Math.PI * 2; const [x, y] = this.w2s(u.x + Math.cos(a) * o.r, u.y + Math.sin(a) * o.r * 0.6 - 14);
        ctx.fillStyle = elc(o.el); ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
  }
  drawObjectives(ctx) {
    const o = this.g.obj; if (!o) return;
    for (const p of o.pts || []) {
      const [x, y] = this.w2s(p[0], p[1]);
      const col = p[2] === 'A' ? '#4aa8ff' : p[2] === 'B' ? '#ff5a5a' : '#cccccc';
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 130, 65, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = col + '33'; ctx.fill();
      ctx.fillStyle = col; ctx.fillRect(x - 3, y - 50, 6, 50); ctx.fillRect(x + 3, y - 50, 22, 14);
      ctx.fillStyle = '#000'; ctx.fillRect(x - 30, y + 10, 60, 6); ctx.fillStyle = p[3] >= 0 ? '#4aa8ff' : '#ff5a5a'; ctx.fillRect(x, y + 10, (p[3] / 100) * 30, 6);
      ctx.font = 'bold 12px Tahoma'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(p[4], x, y - 56);
    }
    if (o.gateX) { const [x] = this.w2s(o.gateX, 0); ctx.fillStyle = 'rgba(120,80,40,0.8)'; ctx.fillRect(x - 6, 0, 12, this.cv.height); ctx.fillStyle = '#ffd84a'; ctx.font = 'bold 14px Tahoma'; ctx.fillText('ประตูปราสาท (ปิด)', x, 140); }
    if (o.corePos) { const [x, y] = this.w2s(o.corePos[0], o.corePos[1]); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 150, 75, 0, 0, 7); ctx.stroke(); ctx.fillStyle = `rgba(255,216,74,${0.2 + Math.sin(this.t * 3) * 0.1})`; ctx.fill(); ctx.fillStyle = '#ffd84a'; ctx.font = 'bold 14px Tahoma'; ctx.fillText(`CORE ${o.core || 0}%`, x, y - 80); }
  }

  drawPortal(ctx, e) {
    const [x, y] = this.w2s(e.x, e.y); if (x < -100 || x > this.cv.width + 100 || y < -150 || y > this.cv.height + 100) return;
    const t = this.t;
    ctx.save(); ctx.translate(x, y - 30);
    for (let i = 0; i < 3; i++) { ctx.strokeStyle = ['#7fe8ff', '#c25cff', '#ffffff'][i]; ctx.globalAlpha = 0.8 - i * 0.2; ctx.lineWidth = 4 - i; ctx.beginPath(); ctx.ellipse(0, 0, 26 - i * 6, 40 - i * 9, 0, t * (2 + i) + i, t * (2 + i) + i + 4.5); ctx.stroke(); }
    ctx.globalAlpha = 0.25 + Math.sin(t * 3) * 0.1; ctx.fillStyle = '#7fe8ff'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 36, 0, 0, 7); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
    const name = MAPS[e.to]?.name || e.to; const lv = MAPS[e.to]?.lv;
    ctx.font = 'bold 12px Kanit, Tahoma'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(`ประตูวาร์ป → ${name}`, x + 1, y - 79); ctx.fillStyle = '#7fe8ff'; ctx.fillText(`ประตูวาร์ป → ${name}`, x, y - 80);
    if (lv && MAPS[e.to].kind === 'field') { ctx.font = '11px Kanit, Tahoma'; ctx.fillStyle = '#ffd84a'; ctx.fillText(`Lv ${lv[0]}-${lv[1]}`, x, y - 66); }
  }
  drawNavAndTarget(ctx) {
    const A = this.g.auto; if (!A) return;
    const me = this.g.units.get(this.g.you);
    if (A.nav.path && me) {
      ctx.strokeStyle = 'rgba(127,232,255,0.55)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.beginPath();
      let [px, py] = this.w2s(me.x, me.y); ctx.moveTo(px, py);
      for (const [wx, wy] of A.nav.path) { [px, py] = this.w2s(wx, wy); ctx.lineTo(px, py); }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#7fe8ff'; ctx.beginPath(); ctx.ellipse(px, py, 10 + Math.sin(this.t * 6) * 2, 5, 0, 0, 7); ctx.stroke();
    }
    const t = A.target && this.g.units.get(A.target);
    if (t) { const [x, y] = this.w2s(t.x, t.y); const r = (t.meta?.r || 12) + 8; ctx.strokeStyle = A.on ? '#5aff7a' : '#ff5a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 2, r, r * 0.42, 0, this.t * 2, this.t * 2 + 5); ctx.stroke(); }
    if (this.clickMark && this.t - this.clickMark.t0 < 0.5) { const [x, y] = this.w2s(this.clickMark.x, this.clickMark.y); const a = (this.t - this.clickMark.t0) / 0.5; ctx.strokeStyle = `rgba(255,255,255,${1 - a})`; ctx.beginPath(); ctx.ellipse(x, y, 14 * (1 - a) + 4, (14 * (1 - a) + 4) * 0.5, 0, 0, 7); ctx.stroke(); }
  }
  // Draw the map into a canvas. view: {cx, cy, span} world-space window (null = whole map). Returns transform for click mapping.
  drawMap(mc, view, opts = {}) {
    const G = this.g; if (!this.L) return null;
    const c = mc.getContext('2d'); const W = mc.width, H = mc.height; c.imageSmoothingEnabled = false;
    c.fillStyle = '#05040a'; c.fillRect(0, 0, W, H);
    let k, ox, oy;
    if (!view) { k = Math.min(W / this.L.pxW, H / this.L.pxH); ox = (W - this.L.pxW * k) / 2; oy = (H - this.L.pxH * k) / 2; }
    else { k = W / view.span; ox = W / 2 - view.cx * k; oy = H / 2 - view.cy * k; }
    c.drawImage(this.mini, ox, oy, this.L.w * TILE * k, this.L.h * TILE * k);
    const P = (x, y) => [ox + x * k, oy + y * k];
    if (G.auto?.nav.path) { const me = G.units.get(G.you); c.strokeStyle = '#7fe8ff'; c.lineWidth = 1.5; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(...P(me.x, me.y)); for (const p of G.auto.nav.path) c.lineTo(...P(p[0], p[1])); c.stroke(); c.setLineDash([]); }
    for (const e of this.L.exits) { const [x, y] = P(e.x, e.y); c.fillStyle = '#7fe8ff'; c.beginPath(); c.arc(x, y, opts.big ? 7 : 4, 0, 7); c.fill(); if (opts.big) { c.font = 'bold 12px Kanit, Tahoma'; c.textAlign = e.side === 'w' ? 'left' : 'right'; c.fillStyle = '#fff'; c.fillText(`🌀 ${MAPS[e.to]?.name || ''}`, x + (e.side === 'w' ? 10 : -10), y - 10); } }
    for (const n of G.npcs) { const [x, y] = P(n.x, n.y); c.fillStyle = '#ffd84a'; c.fillRect(x - 3, y - 3, 6, 6); if (opts.big) { c.font = '11px Kanit, Tahoma'; c.textAlign = 'center'; c.fillStyle = '#ffe08a'; c.fillText(n.name, x, y - 7); } }
    for (const u of G.units.values()) {
      const m = u.meta || {}; if (u.flags & (1 << 30)) continue;
      const [x, y] = P(u.x, u.y); if (x < -5 || y < -5 || x > W + 5 || y > H + 5) continue;
      c.fillStyle = u.id === G.you ? '#ffffff' : m.b ? '#ff3a3a' : m.k === 'monster' ? '#d86a4a' : m.tm === G.myTeam ? '#4ad86a' : '#ff6aa8';
      const s = u.id === G.you ? 6 : m.b ? 8 : m.k === 'monster' ? 3 : 4; c.fillRect(x - s / 2, y - s / 2, s, s);
      if (m.b && opts.big) { c.font = 'bold 12px Kanit, Tahoma'; c.textAlign = 'center'; c.fillStyle = '#ff7a5a'; c.fillText(m.n, x, y - 9); }
    }
    for (const p of G.obj?.pts || []) { const [x, y] = P(p[0], p[1]); c.fillStyle = p[2] === 'A' ? '#4aa8ff' : p[2] === 'B' ? '#ff5a5a' : '#ccc'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
    const me = G.units.get(G.you); if (me) { const [x, y] = P(me.x, me.y); c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 7 + Math.sin(this.t * 5) * 2, 0, 7); c.stroke(); }
    return { k, ox, oy, toWorld: (sx, sy) => [(sx - ox) / k, (sy - oy) / k] };
  }
  drawMinimap(mc) { const me = this.g.units.get(this.g.you); if (!me) return; this.miniT = this.drawMap(mc, { cx: me.x, cy: me.y, span: this.miniSpan || 2600 }); }
}
const NPC_PAL = {
  shop: { cls: 'gunslinger', body: '#6a4a8a', trim: '#e8c040', skin: '#e6b48a', hair: '#4a2a1a' },
  smith: { cls: 'warrior', body: '#5a3a2a', trim: '#8a8a92', skin: '#c89070', hair: '#2a1a10' },
  stash: { cls: 'cleric', body: '#3a5a8a', trim: '#e8c040', skin: '#e6b48a', hair: '#8a6a3a' },
  market: { cls: 'gunslinger', body: '#8a6a2a', trim: '#e8e8e8', skin: '#e6b48a', hair: '#2a2a2a' },
  guild: { cls: 'paladin', body: '#8a2a2a', trim: '#ffd84a', skin: '#e6b48a', hair: '#2a2a2a' },
  arena: { cls: 'warrior', body: '#a83a2a', trim: '#2a2a2a', skin: '#b88860', hair: '#1a1a1a' },
  dungeon: { cls: 'necromancer', body: '#2a1a3a', trim: '#9a5cff', skin: '#c8c0b8', hair: '#e8e8e8' },
  teleport: { cls: 'arcanist', body: '#2a6a8a', trim: '#7fe8ff', skin: '#e6b48a', hair: '#e8e8f0' },
  quest: { cls: 'ranger', body: '#4a6a2a', trim: '#e8c040', skin: '#e6b48a', hair: '#6a3a1a' },
  build: { cls: 'monk', body: '#d8a02a', trim: '#8a2a1a', skin: '#e6b48a', hair: '#1a1a1a' },
};
export const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : String(n));
export { drawEmblem };
