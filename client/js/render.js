// ===== Canvas renderer: top-down 3/4 pixel-art world, entities, skill FX, telegraphs =====
import { TILE, ELEMENT_INFO, STATUS_BITS } from '/shared/constants.js';
import { charSprite, weaponSprite, monsterSprite, groundTile, plazaTile, obstacleSprite, wallTile, borderTile, shade, drawEmblem } from './sprites.js';

const BIT = Object.fromEntries(STATUS_BITS.map((s, i) => [s, 1 << i]));
const elc = (el) => ELEMENT_INFO[el]?.color || '#ffffff';
const elg = (el) => ELEMENT_INFO[el]?.glow || '#ffffff';

export class Renderer {
  constructor(canvas, game) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.g = game;
    this.cam = { x: 0, y: 0 }; this.fx = []; this.texts = []; this.parts = []; this.projs = new Map(); this.orbits = new Map();
    this.flash = new Map(); this.swing = new Map(); this.t = 0; this.shake = 0;
    this.mini = document.createElement('canvas');
    window.addEventListener('resize', () => this.resize()); this.resize();
  }
  resize() { this.cv.width = window.innerWidth; this.cv.height = window.innerHeight; this.ctx.imageSmoothingEnabled = false; }
  setMap(L) {
    this.L = L; this.fx = []; this.texts = []; this.parts = []; this.projs.clear(); this.orbits.clear();
    const b = L.biomeDef; const gc = document.createElement('canvas'); gc.width = L.pxW; gc.height = L.pxH; const g = gc.getContext('2d');
    g.imageSmoothingEnabled = false;
    this.obstacles = []; this.water = [];
    for (let ty = 0; ty < L.h; ty++) for (let tx = 0; tx < L.w; tx++) {
      const i = ty * L.w + tx, v = L.tiles[i], d = L.deco[i], X = tx * TILE, Y = ty * TILE;
      if (v === 4) { g.drawImage(borderTile(L.biome), X, Y); continue; }
      if (v === 5) { const below = ty + 1 < L.h ? L.tiles[i + L.w] : 0; g.drawImage(wallTile(below === 5), X, Y); continue; }
      const nz = Math.sin(tx * 0.21 + 1.3) + Math.sin(ty * 0.17 + 0.7) + Math.sin((tx + ty) * 0.09) + Math.sin((tx - ty) * 0.13);
      let col = b.ground[nz > 1 ? 1 : nz < -1 ? 2 : 0];
      if (v === 1) col = b.path;
      if (v === 6) g.drawImage(plazaTile(d), X, Y);
      else g.drawImage(groundTile(col, d, v === 0 && d % 7 === 0 ? 1 : 0), X, Y);
      if (v === 2) this.water.push([X, Y, d]);
      if (v === 3) this.obstacles.push({ x: X + 16, y: Y + 30, type: b.obstacle[d % b.obstacle.length], seed: d });
    }
    // edge exits
    for (const e of L.exits) { g.fillStyle = 'rgba(120,200,255,0.25)'; g.fillRect(e.x - 16, e.y - 80, 32, 160); }
    this.ground = gc;
    // minimap
    const s = 3; this.mini.width = L.w * s; this.mini.height = L.h * s; const m = this.mini.getContext('2d');
    for (let ty = 0; ty < L.h; ty++) for (let tx = 0; tx < L.w; tx++) {
      const v = L.tiles[ty * L.w + tx];
      m.fillStyle = v === 2 ? b.water : v === 3 ? '#1e3a1a' : v >= 4 && v <= 5 ? '#222' : v === 1 || v === 6 ? b.path : b.ground[0];
      m.fillRect(tx * s, ty * s, s, s);
    }
  }
  w2s(x, y) { return [Math.round(x - this.cam.x + this.cv.width / 2), Math.round(y - this.cam.y + this.cv.height / 2)]; }
  s2w(x, y) { return [x + this.cam.x - this.cv.width / 2, y + this.cam.y - this.cv.height / 2]; }

  // ---------- FX intake ----------
  addFx(e) {
    const G = this.g; const now = this.t;
    switch (e.k) {
      case 'proj': {
        const p = this.projs.get(e.id) || { trail: [] };
        Object.assign(p, { x: e.x, y: e.y, vx: e.vx, vy: e.vy, r: e.r, el: e.el, until: now + e.life + 0.05, m: e.m });
        this.projs.set(e.id, p); break;
      }
      case 'pend': { const p = this.projs.get(e.id); if (p) { this.burst(p.x, p.y, elc(p.el), 6); this.projs.delete(e.id); } break; }
      case 'dmg': {
        const u = G.units.get(e.id); if (!u) break;
        if (e.miss) this.text(u.x, u.y - 30, 'MISS', '#aaaaaa', 12);
        else if (e.h) this.text(u.x, u.y - 30, '+' + e.v, '#5aff7a', 13);
        else {
          const mine = e.id === G.you; const col = mine ? '#ff5a5a' : e.c ? '#ffe14a' : elc(e.el) === '#e0d6c8' ? '#ffffff' : elc(e.el);
          this.text(u.x + (Math.random() - 0.5) * 20, u.y - 30, (e.c ? '★' : '') + fmt(e.v), col, e.c ? 18 : 13);
          this.flash.set(e.id, now + 0.1); this.burst(u.x, u.y - 10, elc(e.el), e.c ? 8 : 4);
          if (mine) this.shake = Math.min(6, this.shake + 2);
        }
        break;
      }
      case 'gold': { const u = G.units.get(e.id); if (u && e.id === G.you) this.text(u.x + 20, u.y - 44, `+${e.v}G`, '#ffd84a', 11); break; }
      case 'pop': { const u = G.units.get(e.id); if (u) this.text(u.x, u.y - 60, e.text, e.c || '#fff', 15, 1.6); break; }
      case 'area': this.fx.push({ ...e, t0: now }); if (e.boss) this.shake = Math.min(10, this.shake + 4); break;
      case 'tele': this.fx.push({ ...e, kind: 'tele', t0: now }); break;
      case 'teleCancel': this.fx = this.fx.filter((f) => !(f.kind === 'tele' && f.tid === e.id)); break;
      case 'beam': this.fx.push({ ...e, kind: 'beam', t0: now }); break;
      case 'chain': this.fx.push({ ...e, kind: 'chain', t0: now }); break;
      case 'bolt': this.fx.push({ kind: 'chain', pts: [[e.x, e.y - 300], [e.x + 10, e.y - 150], [e.x - 8, e.y - 70], [e.x, e.y]], el: 'lightning', t0: now }); break;
      case 'dash': this.fx.push({ ...e, kind: 'dash', t0: now }); { const u = G.units.get(e.id); if (u && e.dur) { u.anim = { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, t0: now, dur: e.dur, leap: e.leap }; } } break;
      case 'cast': { this.swing.set(e.id, { t0: now, ang: e.ang, beh: e.beh }); const u = G.units.get(e.id); if (u && e.n && e.id !== G.you && u.meta?.k !== 'monster') this.text(u.x, u.y - 52, e.n, '#c8e8ff', 10, 0.8); break; }
      case 'ult': { const u = G.units.get(e.id); if (u) { this.text(u.x, u.y - 70, e.n, elc(e.el), 18, 1.8); this.fx.push({ kind: 'ring', x: u.x, y: u.y, el: e.el, t0: now, r: 200 }); this.shake = 8; } break; }
      case 'matk': this.swing.set(e.id, { t0: now, ang: e.ang, beh: 'melee', wind: e.wind }); break;
      case 'orbit': this.orbits.set(e.id, { owner: e.owner, n: e.n, r: e.r, until: now + e.dur, el: e.el }); break;
      case 'orbitEnd': this.orbits.delete(e.id); break;
      case 'buff': this.fx.push({ kind: 'ring', x: 0, y: 0, follow: e.id, el: e.el, t0: now, r: 50 }); break;
      case 'lvl': { const u = G.units.get(e.id); if (u) { this.fx.push({ kind: 'ring', follow: e.id, el: 'holy', t0: now, r: 90 }); this.text(u.x, u.y - 70, 'LEVEL UP!', '#7fe8ff', 18, 2); } break; }
      case 'counter': this.fx.push({ kind: 'ring', follow: e.id, el: 'lightning', t0: now, r: 40, fast: 1 }); break;
      case 'dodge': this.fx.push({ kind: 'ghost', id: e.id, t0: now }); break;
      case 'die': { const u = G.units.get(e.id); if (u && !e.quiet) this.burst(u.x, u.y - 8, u.meta?.t || '#fff', 14); break; }
      case 'trapEnd': this.fx = this.fx.filter((f) => !(f.trap && Math.abs(f.x - e.x) < 2 && Math.abs(f.y - e.y) < 2)); break;
    }
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
    const srcX = Math.max(0, x0), srcY = Math.max(0, y0), srcW = Math.min(this.L.pxW, x0 + W) - srcX, srcH = Math.min(this.L.pxH, y0 + H) - srcY;
    if (srcW > 0 && srcH > 0) ctx.drawImage(this.ground, srcX, srcY, srcW, srcH, srcX - x0, srcY - y0, srcW, srcH);
    // water shimmer
    const wc = this.L.biomeDef.water;
    for (const [X, Y, d] of this.water) {
      if (X < x0 - 32 || X > x0 + W || Y < y0 - 32 || Y > y0 + H) continue;
      ctx.fillStyle = wc; ctx.fillRect(X - x0, Y - y0, 32, 32);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; const o = ((this.t * 12 + d) % 32) | 0; ctx.fillRect(X - x0 + o % 28, Y - y0 + ((d >> 3) % 24), 6, 2);
    }
    // ground FX (areas, telegraphs, traps, objectives)
    this.drawObjectives(ctx);
    this.drawGroundFx(ctx);
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
    for (const o of this.obstacles) if (o.x > x0 - 40 && o.x < x0 + W + 40 && o.y > y0 - 20 && o.y < y0 + H + 60) list.push({ y: o.y, o });
    for (const u of G.units.values()) list.push({ y: u.y, u });
    for (const n of G.npcs) list.push({ y: n.y, n });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) { if (it.o) { const [x, y] = this.w2s(it.o.x, it.o.y); ctx.drawImage(obstacleSprite(it.o.type, it.o.seed), x - 16, y - 52); } else if (it.u) this.drawUnit(ctx, it.u); else this.drawNpc(ctx, it.n); }
    this.drawProjectiles(ctx, dt);
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
    if (u.flags & BIT.freeze) ctx.filter = 'hue-rotate(180deg) saturate(2) brightness(1.3)';
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
      if (u.flags & BIT.burn && Math.random() < 0.3) this.parts.push({ x: u.x + (Math.random() - 0.5) * r, y: u.y - Math.random() * 20, vx: 0, vy: -60, c: '#ff8a2a', t0: this.t, life: 0.4 });
      if (u.flags & BIT.poison && Math.random() < 0.2) this.parts.push({ x: u.x + (Math.random() - 0.5) * r, y: u.y - Math.random() * 20, vx: 0, vy: -30, c: '#7be04a', t0: this.t, life: 0.5 });
      if (u.flags & BIT.bleed && Math.random() < 0.15) this.parts.push({ x: u.x, y: u.y - 15, vx: (Math.random() - 0.5) * 40, vy: 0, c: '#c0102a', t0: this.t, life: 0.4 });
      if (u.flags & BIT.shock && Math.random() < 0.15) this.fx.push({ kind: 'chain', pts: [[u.x - 10, u.y - 30], [u.x + 6, u.y - 18], [u.x - 4, u.y - 6]], el: 'lightning', t0: this.t, short: 1 });
      if (u.sh > 0 || u.flags & BIT.shield) { ctx.strokeStyle = 'rgba(160,224,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - lift - 18, r + 12, 0, 7); ctx.stroke(); }
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
      const c = elc(p.el), g = elg(p.el);
      ctx.strokeStyle = c; ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(2, p.r * 0.8); ctx.beginPath();
      p.trail.forEach(([tx, ty], i) => { const [sx, sy] = this.w2s(tx, ty); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke(); ctx.globalAlpha = 1;
      const [x, y] = this.w2s(p.x, p.y);
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
  drawGroundFx(ctx) {
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
        ctx.globalAlpha = 0.18 + Math.sin(this.t * 6) * 0.06; ctx.fillStyle = col; this.shapePath(ctx, f, x, y); ctx.fill('evenodd');
        ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = 1; this.shapePath(ctx, f, x, y); ctx.stroke(); ctx.globalAlpha = 1;
        if (Math.random() < 0.3) this.parts.push({ x: f.x + (Math.random() - 0.5) * (f.r || 60), y: f.y + (Math.random() - 0.5) * (f.r || 60) * 0.6, vx: 0, vy: -40, c: col, t0: this.t, life: 0.5 });
      } else { // impact burst
        const p = Math.min(1, a / 0.3);
        ctx.globalAlpha = (1 - p) * 0.55; ctx.fillStyle = col; this.shapePath(ctx, f, x, y, f.melee ? 0.6 + p * 0.4 : 0.4 + p * 0.6); ctx.fill('evenodd');
        ctx.globalAlpha = 1 - p; ctx.strokeStyle = elg(f.el); ctx.lineWidth = 3; this.shapePath(ctx, f, x, y, 0.4 + p * 0.6); ctx.stroke(); ctx.globalAlpha = 1;
        if (a < 0.05 && !f.burst) { f.burst = 1; if (f.shape === 'circle') this.burst(f.x, f.y, col, Math.min(20, (f.r || 50) / 6)); }
      }
    }
    this.fx = keep;
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

  drawMinimap(mc) {
    const G = this.g; if (!this.L) return;
    const c = mc.getContext('2d'); const W = mc.width, H = mc.height;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    const sc = Math.min(W / this.L.w, H / this.L.h) / 3;
    const ox = (W - this.L.w * 3 * sc) / 2, oy = (H - this.L.h * 3 * sc) / 2;
    c.imageSmoothingEnabled = false; c.drawImage(this.mini, ox, oy, this.L.w * 3 * sc, this.L.h * 3 * sc);
    const k = (3 * sc) / TILE;
    for (const e of this.L.exits) { c.fillStyle = '#7fe8ff'; c.fillRect(ox + e.x * k - 3, oy + e.y * k - 3, 6, 6); }
    for (const n of G.npcs) { c.fillStyle = '#ffd84a'; c.fillRect(ox + n.x * k - 2, oy + n.y * k - 2, 4, 4); }
    for (const u of G.units.values()) {
      const m = u.meta || {}; if (u.flags & (1 << 30)) continue;
      c.fillStyle = u.id === G.you ? '#ffffff' : m.b ? '#ff3a3a' : m.k === 'monster' ? '#d86a4a' : m.tm === G.myTeam ? '#4ad86a' : '#ff6aa8';
      const s = u.id === G.you ? 5 : m.b ? 6 : 3; c.fillRect(ox + u.x * k - s / 2, oy + u.y * k - s / 2, s, s);
    }
    for (const p of G.obj?.pts || []) { c.fillStyle = p[2] === 'A' ? '#4aa8ff' : p[2] === 'B' ? '#ff5a5a' : '#ccc'; c.beginPath(); c.arc(ox + p[0] * k, oy + p[1] * k, 4, 0, 7); c.fill(); }
  }
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
