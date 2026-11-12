// ===== Instance: one simulated map (town / field / dungeon / pvp) =====
import { TILE, VIEW_RADIUS, STATUS_BITS } from '../shared/constants.js';
import { moveWithCollision, canStand, randomOpenSpot } from '../shared/mapgen.js';
import { monsterStats } from '../shared/stats.js';
import { MONSTERS, BOSSES, BOSS_ATTACKS } from '../shared/world.js';
import { dealDamage, tickStatuses, updateMinion, inShape, isHostile, isCC, addStatus, doChain, healUnit, castSkill } from './combat.js';

let INST_SEQ = 1;
const STATUS_BIT = Object.fromEntries(STATUS_BITS.map((s, i) => [s, 1 << i]));
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export class Instance {
  constructor(game, o) {
    this.game = game; this.id = o.id || `i${INST_SEQ++}`; this.kind = o.kind; this.key = o.key; this.def = o.def || {}; this.L = o.layout;
    this.level = o.level || 1; this.isPvp = !!o.pvp; this.mode = null; this.safe = !!o.safe;
    this.units = new Map(); this.projectiles = []; this.areas = []; this.orbits = []; this.timers = []; this.events = [];
    this.drops = new Map(); this.time = 0; this.seq = 1; this.players = new Set(); this.martyrs = [];
    this.mods = o.mods || []; this.name = o.name || this.def.name || this.key; this.created = Date.now(); this.emptySince = null;
    this.rng = Math.random;
  }
  nextId() { return this.seq++; }
  addUnit(o) {
    const u = { id: this.nextId(), r: 12, facing: 0, shield: 0, statuses: new Map(), cd: {}, charges: {}, dead: false, iframesUntil: 0, invuln: 0, ccImmuneUntil: 0, lockUntil: 0, ...o };
    if (!u.baseStats && u.stats) u.baseStats = u.stats;
    this.units.set(u.id, u);
    return u;
  }
  removeUnit(u) { this.units.delete(u.id); if (u.kind === 'player') this.players.delete(u); this.martyrs = this.martyrs.filter((m) => m !== u); }
  killQuiet(u) { u.dead = true; this.fx({ k: 'die', id: u.id, quiet: 1 }, u); this.units.delete(u.id); }
  fx(ev, at) { this.events.push({ ev, x: at ? at.x : ev.x, y: at ? at.y : ev.y }); }
  timer(delay, fn) { this.timers.push({ at: this.time + delay, fn }); }
  area(o) {
    const a = { id: this.nextId(), created: this.time, delay: 0, hit: new Set(), next: 0, ...o };
    a.at = this.time + (a.delay || 0);
    a.until = a.dur ? a.at + a.dur : a.at;
    this.areas.push(a);
    if (!a.noVis) this.fx({ k: 'area', x: a.x, y: a.y, shape: a.shape, r: a.r, r2: a.r2, ang: a.ang, arc: a.arc, len: a.len, w: a.w, el: a.spec?.el, delay: a.delay, dur: a.dur || 0, trap: a.trap ? 1 : 0, heal: a.healField ? 1 : 0, follow: a.follow, show: a.show ? 1 : 0, melee: a.melee ? 1 : 0 });
    return a;
  }
  projectile(o) {
    const p = { id: this.nextId(), hit: new Set(), dist: 0, ...o };
    p.vx = Math.cos(p.ang) * p.speed; p.vy = Math.sin(p.ang) * p.speed;
    this.projectiles.push(p);
    this.fx({ k: 'proj', id: p.id, x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), r: p.r, el: p.el || p.spec?.el, life: p.range / p.speed, h: p.homing ? 1 : 0, m: p.monster ? 1 : 0 });
    return p;
  }
  nearestEnemy(u, range, x = u.x, y = u.y, exclude) {
    let best = null, bd = range * range;
    for (const t of this.units.values()) {
      if (!isHostile(u, t) || (exclude && exclude.has(t.id))) continue;
      const dd = (t.x - x) ** 2 + (t.y - y) ** 2;
      if (dd < bd) { bd = dd; best = t; }
    }
    return best;
  }
  allies(u, r) {
    const out = [];
    for (const t of this.units.values()) if (t !== u && !t.dead && t.team === u.team && (t.kind === 'player' || t.kind === 'bot') && d2(t, u) <= r * r) out.push(t);
    return out;
  }
  hostilesIn(team, a) {
    const out = [];
    for (const t of this.units.values()) if (!t.dead && t.team !== team && t.kind !== 'totem' && !t.untargetable && inShape(t, a)) out.push(t);
    return out;
  }

  // ---------- monsters ----------
  spawnMonster(tplId, lv, x, y, opt = {}) {
    const tpl = MONSTERS[tplId] || BOSSES[tplId];
    const mul = { ...(opt.mul || {}) };
    for (const m of this.mods) {
      if (m === 'haste') mul.spd = (mul.spd || 1) * 1.3;
      if (m === 'armored') mul.hp = (mul.hp || 1) * 1.5;
      if (m === 'frenzy') mul.dmg = (mul.dmg || 1) * 1.3;
      if (m === 'vampiric') mul.leech = 10;
      if (m === 'elemental') mul.res = 30;
    }
    const st = monsterStats(lv, tpl, mul);
    return this.addUnit({
      kind: 'monster', team: 'm', tpl: tplId, name: opt.name || tpl.name, sprite: tpl.kind, tint: tpl.tint, el: tpl.el, lv, x, y, home: { x, y },
      r: tpl.size || 13, hp: st.hpMax, hpMax: st.hpMax, mp: 0, mpMax: 0, stats: st, baseStats: st, ai: tpl.ai || 'melee', atkReady: 0, wanderAt: 0,
      elite: !!opt.elite, regen: this.mods.includes('regen'), volatile: this.mods.includes('volatile'), spawner: opt.spawner, noRespawn: opt.noRespawn,
    });
  }
  spawnBoss(bossId, lv, x, y, opt = {}) {
    const def = BOSSES[bossId];
    const u = this.spawnMonster(bossId, lv, x, y, { mul: { hp: 14 * (opt.hpMul || 1), dmg: 1.0 * (opt.dmgMul || 1), armor: 1.3 }, name: opt.name || def.name });
    u.boss = true; u.bossDef = def; u.r = def.size; u.contrib = new Map(); u.world = !!opt.world; u.bossKind = opt.bossKind || 'field';
    u.bs = { phase: 0, idx: 0, next: this.time + 2, cur: null, speed: 1 };
    u.stats.move = 95; u.baseStats = u.stats;
    this.fx({ k: 'msg', text: `⚠ ${u.name} ปรากฏตัว!`, c: '#ff5a5a', big: 1 });
    return u;
  }

  updateMonster(m, dt) {
    if (m.static) return;
    if (m.boss) return this.updateBoss(m, dt);
    if (m.regen && m.hp < m.hpMax) m.hp = Math.min(m.hpMax, m.hp + m.hpMax * 0.01 * dt);
    if (isCC(m)) { m.attacking = null; return; }
    let tgt = m.target && this.units.get(m.target);
    if (tgt && (tgt.dead || d2(m, m.home) > 950 * 950 || tgt.untargetable)) {
      tgt = null; m.target = null;
      if (d2(m, m.home) > 950 * 950) { m.returning = true; m.hp = m.hpMax; m.threat = null; }
    }
    if (!tgt && !m.returning) {
      const near = this.nearestEnemy(m, m.aggro || 240);
      if (near) { tgt = near; m.target = near.id; }
    }
    if (m.threat && m.threat.size && (!tgt || Math.random() < 0.02)) {
      let best = null, bv = -1;
      for (const [id, v] of m.threat) { const t = this.units.get(id); if (t && !t.dead && v > bv) { bv = v; best = t; } }
      if (best && d2(best, m) < 700 * 700) { tgt = best; m.target = best.id; }
    }
    const sp = m.stats.move * (m.statuses.has('slow') ? 0.6 : 1) * (m.statuses.has('chill') ? 0.75 : 1);
    if (m.attacking) {
      if (this.time >= m.attacking.at) {
        const a = m.attacking; m.attacking = null;
        if (a.type === 'melee') { const t = this.units.get(a.t); if (t && !t.dead && Math.sqrt(d2(m, t)) <= m.r + t.r + 34) dealDamage(this, m, t, { dmg: 100, el: m.el, behavior: 'melee', mech: m.elite ? 'stun' : null, sp: 0.5 }, 1, { melee: true }); }
        if (a.type === 'charge') {
          let x = m.x, y = m.y;
          for (let i = 0; i < 16; i++) { const [nx, ny] = moveWithCollision(this.L, x, y, Math.cos(a.ang) * 18, Math.sin(a.ang) * 18, m.r * 0.6); if (nx === x && ny === y) break; x = nx; y = ny; }
          this.fx({ k: 'dash', id: m.id, x1: m.x, y1: m.y, x2: x, y2: y, el: m.el, dur: 0.2 }, m);
          for (const t of this.hostilesIn(m.team, { shape: 'line', x: m.x, y: m.y, ang: a.ang, len: Math.hypot(x - m.x, y - m.y), w: 50 })) dealDamage(this, m, t, { dmg: 140, el: m.el, behavior: 'melee', knock: 60 }, 1, { melee: true });
          m.x = x; m.y = y;
        }
        if (a.type === 'cast') for (const t of this.hostilesIn(m.team, { shape: 'circle', x: a.x, y: a.y, r: 60 })) dealDamage(this, m, t, { dmg: 120, el: m.el, behavior: 'ground', mech: m.el === 'ice' ? 'chill' : m.el === 'poison' ? 'poison' : null, sp: 0.5 });
      }
      return;
    }
    let mx = 0, my = 0;
    if (tgt) {
      const d = Math.sqrt(d2(m, tgt));
      m.facing = Math.atan2(tgt.y - m.y, tgt.x - m.x);
      const reach = m.r + tgt.r + 20;
      if (m.ai === 'ranged' || m.ai === 'caster') {
        if (d > 300) { mx = (tgt.x - m.x) / d; my = (tgt.y - m.y) / d; }
        else if (d < 170) { mx = -(tgt.x - m.x) / d; my = -(tgt.y - m.y) / d; }
        if (d < 360 && m.atkReady <= this.time) {
          m.atkReady = this.time + 1.8 + Math.random() * 0.6;
          if (m.ai === 'ranged') this.projectile({ owner: m.id, team: m.team, x: m.x, y: m.y - 6, ang: m.facing, speed: 330, r: 7, range: 420, spec: { dmg: 90, el: m.el, behavior: 'projectile', pierce: 0 }, mult: 1, el: m.el, monster: true });
          else { m.attacking = { type: 'cast', at: this.time + 0.9, x: tgt.x, y: tgt.y }; this.fx({ k: 'tele', x: tgt.x, y: tgt.y, shape: 'circle', r: 60, dur: 0.9, small: 1 }, m); }
        }
      } else {
        if (m.ai === 'charger' && d > 140 && d < 380 && (m.chargeReady || 0) <= this.time) {
          m.chargeReady = this.time + 6 + Math.random() * 3;
          m.attacking = { type: 'charge', at: this.time + 0.75, ang: m.facing };
          this.fx({ k: 'tele', x: m.x, y: m.y, shape: 'line', ang: m.facing, len: 300, w: 50, dur: 0.75, small: 1 }, m);
          return;
        }
        if (d > reach) { mx = (tgt.x - m.x) / d; my = (tgt.y - m.y) / d; }
        else if (m.atkReady <= this.time) {
          m.atkReady = this.time + (m.ai === 'swarm' ? 0.9 : 1.3);
          m.attacking = { type: 'melee', at: this.time + 0.4, t: tgt.id };
          this.fx({ k: 'matk', id: m.id, ang: m.facing, wind: 0.4 }, m);
        }
      }
    } else {
      const hd = Math.sqrt(d2(m, m.home));
      if (m.returning) { if (hd < 30) m.returning = false; else { mx = (m.home.x - m.x) / hd; my = (m.home.y - m.y) / hd; } }
      else {
        if (m.wanderAt <= this.time) { m.wanderAt = this.time + 2 + Math.random() * 4; const a = Math.random() * 6.28; m.wander = [m.home.x + Math.cos(a) * 110 * Math.random(), m.home.y + Math.sin(a) * 110 * Math.random()]; }
        if (m.wander) { const dx = m.wander[0] - m.x, dy = m.wander[1] - m.y, dd = Math.hypot(dx, dy); if (dd > 8) { mx = (dx / dd) * 0.45; my = (dy / dd) * 0.45; } }
      }
    }
    if (mx || my) {
      [m.x, m.y] = moveWithCollision(this.L, m.x, m.y, mx * sp * dt * (m.returning ? 2 : 1), my * sp * dt * (m.returning ? 2 : 1), m.r * 0.55);
      if (Math.abs(mx) + Math.abs(my) > 0.1) m.facing = Math.atan2(my, mx);
    }
  }

  bossTarget(b) {
    let best = null, bv = -1;
    if (b.threat) for (const [id, v] of b.threat) { const t = this.units.get(id); if (t && !t.dead && t.kind !== 'totem' && d2(t, b) < 900 * 900 && v > bv) { bv = v; best = t; } }
    return best || this.nearestEnemy(b, 700);
  }
  updateBoss(b, dt) {
    const bs = b.bs, def = b.bossDef;
    if (b.statuses.has('stun')) { bs.cur = null; return; }
    const ph = def.phases;
    if (bs.phase + 1 < ph.length && b.hp / b.hpMax <= ph[bs.phase + 1].hp) {
      bs.phase++; bs.idx = 0; bs.cur = null; bs.next = this.time + 1.8; b.invuln = this.time + 1.5;
      bs.speed = Math.max(bs.speed, ph[bs.phase].speed || 1);
      this.fx({ k: 'msg', text: `${b.name} เข้าสู่เฟส ${bs.phase + 1}!`, c: '#ff9a2a', big: 1 });
      this.fx({ k: 'pop', id: b.id, text: `PHASE ${bs.phase + 1}`, c: '#ff5a2a' }, b);
      if (def.minion) this.bossSummon(b, 2 + bs.phase);
    }
    const tgt = this.bossTarget(b);
    if (!tgt) { bs.cur = null; if (b.hp < b.hpMax) b.hp = Math.min(b.hpMax, b.hp + b.hpMax * 0.05 * dt); return; }
    b.facing = Math.atan2(tgt.y - b.y, tgt.x - b.x);
    if (bs.cur) {
      const c = bs.cur;
      if (c.counter) {
        for (const p of this.units.values()) {
          if ((p.kind === 'player' || p.kind === 'bot') && p.team !== b.team && p.countering > this.time && c.at - this.time <= 0.9 && Math.sqrt(d2(p, b)) < c.r + 80) {
            bs.cur = null; bs.next = this.time + 4;
            addStatus(this, b, 'stun', 3.5, { force: true }); addStatus(this, b, 'weak', 3.5, { force: true });
            this.fx({ k: 'pop', id: b.id, text: 'COUNTER! จุดอ่อนเปิด!', c: '#ffe14a' }, b);
            this.fx({ k: 'teleCancel', id: c.teleId });
            return;
          }
        }
      }
      if (this.time >= c.at) { bs.cur = null; bs.next = this.time + 1.1 / bs.speed; this.resolveBossAttack(b, c); }
      return;
    }
    if (this.time >= bs.next) {
      const list = ph[bs.phase].atk;
      const name = list[bs.idx++ % list.length];
      this.startBossAttack(b, name, tgt);
      return;
    }
    const d = Math.sqrt(d2(b, tgt));
    if (d > b.r + 60) {
      const sp = b.stats.move * bs.speed * (b.statuses.has('slow') ? 0.7 : 1) * dt;
      [b.x, b.y] = moveWithCollision(this.L, b.x, b.y, ((tgt.x - b.x) / d) * sp, ((tgt.y - b.y) / d) * sp, b.r * 0.5);
    }
  }
  bossSummon(b, n) {
    const def = b.bossDef;
    const pool = Object.values(MONSTERS).filter((m) => m.kind === def.minion);
    const tpl = pool.sort((a, c) => Math.abs(a.lv - b.lv) - Math.abs(c.lv - b.lv))[0];
    if (!tpl) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, x = b.x + Math.cos(a) * 110, y = b.y + Math.sin(a) * 110;
      if (canStand(this.L, x, y, 10)) { const m = this.spawnMonster(tpl.id, b.lv, x, y, { noRespawn: true, mul: { hp: 1.5 } }); m.aggro = 900; m.summoned = true; }
    }
  }
  startBossAttack(b, name, tgt) {
    const A = BOSS_ATTACKS[name]; const bs = b.bs;
    const windup = A.windup / Math.min(1.5, bs.speed);
    const c = { name, ...A, at: this.time + windup, teleId: this.nextId() };
    const ang = Math.atan2(tgt.y - b.y, tgt.x - b.x);
    switch (A.type) {
      case 'aoe': {
        c.x = A.at === 'target' ? tgt.x : b.x; c.y = A.at === 'target' ? tgt.y : b.y; c.ang = ang;
        if (A.shape === 'cone') c.r = A.r + b.r;
        this.fx({ k: 'tele', tid: c.teleId, x: c.x, y: c.y, shape: A.shape, r: c.r || A.r, r2: A.r2, ang, arc: A.arc, len: A.len, w: A.w, dur: windup, counter: A.counter ? 1 : 0 }, b);
        if (A.counter) this.fx({ k: 'pop', id: b.id, text: '⚠ COUNTER! (กด F)', c: '#ffd84a' }, b);
        break;
      }
      case 'charge': c.ang = ang; c.x = b.x; c.y = b.y; this.fx({ k: 'tele', tid: c.teleId, x: b.x, y: b.y, shape: 'line', ang, len: A.len, w: A.w, dur: windup }, b); break;
      case 'meteor': {
        c.spots = [];
        const players = [...this.units.values()].filter((u) => (u.kind === 'player' || u.kind === 'bot') && u.team !== b.team && !u.dead && d2(u, b) < 900 * 900);
        for (const p of players) for (let i = 0; i < 2 + bs.phase; i++) c.spots.push([p.x + (Math.random() - 0.5) * 200 * (i > 0), p.y + (Math.random() - 0.5) * 200 * (i > 0)]);
        for (const [x, y] of c.spots) this.fx({ k: 'tele', x, y, shape: 'circle', r: A.r, dur: windup }, b);
        break;
      }
      case 'barrage': this.fx({ k: 'pop', id: b.id, text: '!!', c: '#ff5a5a' }, b); break;
      case 'summon': this.fx({ k: 'pop', id: b.id, text: 'SUMMON', c: '#c25cff' }, b); break;
      case 'weak': break;
      case 'teleport': c.t = tgt.id; this.fx({ k: 'tele', x: tgt.x, y: tgt.y, shape: 'circle', r: 60, dur: windup }, b); break;
      case 'enrage': this.fx({ k: 'pop', id: b.id, text: 'ENRAGE!', c: '#ff2a2a' }, b); break;
    }
    b.bs.cur = c;
  }
  resolveBossAttack(b, c) {
    const spec = { dmg: c.dmg * 100, el: b.el, behavior: 'boss', mech: b.el === 'ice' ? 'chill' : b.el === 'fire' ? 'burn' : b.el === 'poison' ? 'poison' : null, sp: 0.6, knock: 40 };
    switch (c.type) {
      case 'aoe': for (const t of this.hostilesIn(b.team, { ...c, r: c.r })) dealDamage(this, b, t, spec, 1, { cx: c.x, cy: c.y }); this.fx({ k: 'area', x: c.x, y: c.y, shape: c.shape, r: c.r, r2: c.r2, ang: c.ang, arc: c.arc, len: c.len, w: c.w, el: b.el, delay: 0, dur: 0, show: 1, boss: 1 }); break;
      case 'meteor': for (const [x, y] of c.spots) { for (const t of this.hostilesIn(b.team, { shape: 'circle', x, y, r: c.r })) dealDamage(this, b, t, spec, 1); this.fx({ k: 'area', x, y, shape: 'circle', r: c.r, el: b.el, delay: 0, dur: 0, show: 1, boss: 1 }); } break;
      case 'barrage': {
        const waves = c.spiral ? 3 : 1;
        for (let w = 0; w < waves; w++) this.timer(w * 0.35, () => { if (b.dead) return; for (let i = 0; i < c.n; i++) this.projectile({ owner: b.id, team: b.team, x: b.x, y: b.y, ang: (i / c.n) * Math.PI * 2 + w * 0.2, speed: c.speed, r: 11, range: 700, spec: { ...spec, dmg: c.dmg * 100, behavior: 'projectile', knock: 0 }, mult: 1, el: b.el, monster: true }); });
        break;
      }
      case 'charge': {
        let x = b.x, y = b.y, blocked = false;
        for (let i = 0; i < 30; i++) { const [nx, ny] = moveWithCollision(this.L, x, y, (Math.cos(c.ang) * c.len) / 30, (Math.sin(c.ang) * c.len) / 30, b.r * 0.5); if (nx === x && ny === y) { blocked = true; break; } x = nx; y = ny; }
        for (const t of this.hostilesIn(b.team, { shape: 'line', x: b.x, y: b.y, ang: c.ang, len: Math.hypot(x - b.x, y - b.y) + 20, w: c.w })) dealDamage(this, b, t, { ...spec, knock: 120 }, 1, { cx: b.x, cy: b.y });
        this.fx({ k: 'dash', id: b.id, x1: b.x, y1: b.y, x2: x, y2: y, el: b.el, dur: 0.3 }, b);
        b.x = x; b.y = y;
        if (blocked && c.wallStun) { addStatus(this, b, 'stun', 3, { force: true }); addStatus(this, b, 'weak', 3, { force: true }); this.fx({ k: 'pop', id: b.id, text: 'ชนกำแพง! จุดอ่อนเปิด!', c: '#ffe14a' }, b); }
        break;
      }
      case 'summon': this.bossSummon(b, c.n); break;
      case 'weak': addStatus(this, b, 'weak', c.dur, { force: true }); b.bs.next = this.time + c.dur; this.fx({ k: 'pop', id: b.id, text: 'แกนพลังเปิดเผย! (ดาเมจ x2)', c: '#ff5a5a' }, b); break;
      case 'teleport': { const t = this.units.get(c.t); if (t && !t.dead) { const a = Math.random() * 6.28; const x = t.x + Math.cos(a) * 90, y = t.y + Math.sin(a) * 90; if (canStand(this.L, x, y, b.r * 0.5)) { this.fx({ k: 'dash', id: b.id, x1: b.x, y1: b.y, x2: x, y2: y, el: 'shadow', dur: 0.1 }, b); b.x = x; b.y = y; } } break; }
      case 'enrage': b.bs.speed = Math.min(2, b.bs.speed * 1.2); b.stats.atk = Math.round(b.stats.atk * 1.1); break;
    }
  }

  // ---------- main update ----------
  update(dt) {
    this.time += dt;
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.time);
      if (due.length) { this.timers = this.timers.filter((t) => t.at > this.time); for (const t of due) { try { t.fn(); } catch (e) { console.error('timer', e); } } }
    }
    const hunters = [];
    for (const u of this.units.values()) if ((u.kind === 'player' || u.kind === 'bot') && !u.dead) hunters.push(u);
    for (const u of [...this.units.values()]) {
      if (u.dead) continue;
      if (u.kind === 'monster' && !u.target && !u.returning && !u.statuses.size) {
        // sleep monsters that no player is near (huge maps stay cheap)
        let near = false; for (const h of hunters) if ((h.x - u.x) ** 2 + (h.y - u.y) ** 2 < 1500 * 1500) { near = true; break; }
        if (!near) continue;
      }
      tickStatuses(this, u, dt);
      if (u.dead) continue;
      if (u.kind === 'player' || u.kind === 'bot') this.game.updatePlayerUnit(this, u, dt);
      else if (u.kind === 'monster') this.updateMonster(u, dt);
      else if (u.kind === 'minion' || u.kind === 'totem') updateMinion(this, u, dt);
    }
    this.updateProjectiles(dt);
    this.updateAreas();
    this.updateOrbits();
    for (const [id, d] of this.drops) if (d.expire < this.time) this.drops.delete(id);
    if (this.mode && this.mode.update) this.mode.update(dt);
  }
  updateProjectiles(dt) {
    const keep = [];
    for (const p of this.projectiles) {
      const owner = this.units.get(p.owner);
      if (!owner) { this.fx({ k: 'pend', id: p.id }); continue; }
      if (p.homing) {
        const t = this.nearestEnemy({ ...owner, x: p.x, y: p.y, team: p.team }, 260, p.x, p.y, p.hit);
        if (t) { const want = Math.atan2(t.y - p.y, t.x - p.x); let cur = Math.atan2(p.vy, p.vx); let da = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)); cur += Math.max(-4 * dt, Math.min(4 * dt, da)); p.vx = Math.cos(cur) * p.speed; p.vy = Math.sin(cur) * p.speed; p.dirty = true; }
      }
      const steps = Math.ceil((p.speed * dt) / 12);
      let alive = true;
      for (let s = 0; s < steps && alive; s++) {
        p.x += (p.vx * dt) / steps; p.y += (p.vy * dt) / steps; p.dist += (p.speed * dt) / steps;
        if (this.L.solid(Math.floor(p.x / TILE), Math.floor((p.y + 6) / TILE))) { alive = false; break; }
        for (const t of this.units.values()) {
          if (p.hit.has(t.id) || t.dead || t.team === p.team || t.kind === 'totem' || t.untargetable) continue;
          if ((t.x - p.x) ** 2 + (t.y - 6 - p.y) ** 2 > (p.r + t.r) ** 2) continue;
          if (t.stats?.leg?.has('mirrorward') && p.monster !== false && Math.random() < 0.2) {
            p.team = t.team; p.owner = t.id; p.vx *= -1; p.vy *= -1; p.hit.clear(); p.dirty = true; this.fx({ k: 'pop', id: t.id, text: 'REFLECT', c: '#a0e0ff' }, t); break;
          }
          p.hit.add(t.id);
          dealDamage(this, owner, t, p.spec, p.mult, { el: p.el, cx: p.x - p.vx * 0.05, cy: p.y - p.vy * 0.05 });
          if (p.spec.linger) this.area({ owner: p.owner, team: p.team, x: p.x, y: p.y, shape: 'circle', r: 60, spec: p.spec, mult: p.mult * 0.2, dur: p.spec.linger, tick: 0.5 });
          if (p.chain > 0) { const nx = this.nearestEnemy(owner, 260, t.x, t.y, p.hit); if (nx) { p.chain--; const a = Math.atan2(nx.y - p.y, nx.x - p.x); p.vx = Math.cos(a) * p.speed; p.vy = Math.sin(a) * p.speed; p.dist = Math.max(0, p.dist - 200); p.dirty = true; continue; } }
          if (p.fork > 0) { p.fork--; const base = Math.atan2(p.vy, p.vx); for (const off of [-0.5, 0.5]) { const q = this.projectile({ ...p, id: undefined, hit: new Set(p.hit), dist: 0, ang: base + off, range: p.range * 0.6, fork: 0, chain: 0, pierce: 0 }); q.hit = new Set(p.hit); } }
          if (p.pierce > 0) { p.pierce--; continue; }
          alive = false; break;
        }
        if (p.dist >= p.range) alive = false;
      }
      if (alive) {
        keep.push(p);
        if (p.dirty) { p.dirty = false; this.fx({ k: 'proj', id: p.id, x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), r: p.r, el: p.el, life: (p.range - p.dist) / p.speed, upd: 1, m: p.monster ? 1 : 0 }); }
      } else {
        this.fx({ k: 'pend', id: p.id, x: p.x, y: p.y });
        if (p.spec.detonate && owner) this.area({ owner: p.owner, team: p.team, x: p.x, y: p.y, shape: 'circle', r: p.spec.detonate, spec: p.spec, mult: p.mult * 0.5, delay: 0, show: true });
      }
    }
    this.projectiles = keep;
  }
  updateAreas() {
    const keep = [];
    for (const a of this.areas) {
      if (a.done) continue;
      if (this.time < a.at) { keep.push(a); continue; }
      const owner = this.units.get(a.owner);
      if (!owner) continue;
      if (a.follow) { const f = this.units.get(a.follow); if (f) { a.x = f.x; a.y = f.y; } }
      if (a.trap) {
        if (this.time < a.arm) { keep.push(a); continue; }
        if (this.time > a.until) continue;
        const victims = this.hostilesIn(a.team, a);
        if (victims.length) {
          const boom = { ...a, r: a.r * 1.4 };
          for (const t of this.hostilesIn(a.team, boom)) dealDamage(this, owner, t, a.spec, a.mult, { cx: a.x, cy: a.y });
          this.fx({ k: 'area', x: a.x, y: a.y, shape: 'circle', r: boom.r, el: a.spec.el, delay: 0, dur: 0, show: 1 });
          this.fx({ k: 'trapEnd', x: a.x, y: a.y });
          if (a.spec.linger) this.area({ owner: a.owner, team: a.team, x: a.x, y: a.y, shape: 'circle', r: a.r, spec: a.spec, mult: a.mult * 0.2, dur: a.spec.linger, tick: 0.5 });
          a.done = true; continue;
        }
        keep.push(a); continue;
      }
      if (a.dur) {
        if (this.time > a.until) continue;
        if (this.time >= a.next) {
          a.next = this.time + (a.tick || 0.5);
          if (a.healField) for (const t of [owner, ...this.allies(owner, 2000)]) { if (inShape(t, a)) healUnit(this, t, a.healAmt || owner.stats.atk * 0.12, { silent: true }); }
          if (a.mult > 0) for (const t of this.hostilesIn(a.team, a)) dealDamage(this, owner, t, a.spec, a.mult, { cx: a.x, cy: a.y });
        }
        keep.push(a); continue;
      }
      // instant
      const victims = this.hostilesIn(a.team, a);
      for (const t of victims) dealDamage(this, owner, t, a.spec, a.mult, { cx: a.x, cy: a.y, melee: a.melee });
      if (a.chain && victims.length) { const nx = this.nearestEnemy(owner, 260, victims[0].x, victims[0].y, new Set(victims.map((v) => v.id))); if (nx) doChain(this, owner, nx, a.spec, a.mult * 0.6, a.chain - 1, [victims[0].x, victims[0].y]); }
    }
    this.areas = keep;
  }
  updateOrbits() {
    const keep = [];
    for (const o of this.orbits) {
      const owner = this.units.get(o.owner);
      if (!owner || owner.dead || this.time > o.until) { this.fx({ k: 'orbitEnd', id: o.id }); continue; }
      if (this.time >= o.next) {
        o.next = this.time + o.tick;
        const ang0 = this.time * 4;
        for (let i = 0; i < o.count; i++) {
          const a = ang0 + (i / o.count) * Math.PI * 2;
          const bx = owner.x + Math.cos(a) * o.r, by = owner.y + Math.sin(a) * o.r;
          for (const t of this.hostilesIn(owner.team, { shape: 'circle', x: bx, y: by, r: 18 })) dealDamage(this, owner, t, o.spec, o.mult, { cx: owner.x, cy: owner.y });
        }
      }
      keep.push(o);
    }
    this.orbits = keep;
  }

  onKill(tgt, killer, src) {
    if (tgt.dead) return;
    tgt.dead = true; tgt.hp = 0;
    this.fx({ k: 'die', id: tgt.id }, tgt);
    if (tgt.volatile && !tgt.boss) this.area({ owner: tgt.id, team: tgt.team, x: tgt.x, y: tgt.y, shape: 'circle', r: 70, spec: { dmg: 120, el: 'fire', behavior: 'nova' }, mult: 1, delay: 0.6, show: true, ownerless: true });
    if (killer && killer.stats?.ks?.has('relentless')) for (const k in killer.cd) if (k.includes('step') || k.includes('dash')) killer.cd[k] = 0;
    if (killer && killer.stats?.leg?.has('bloodlust')) { healUnit(this, killer, killer.hpMax * 0.04, { silent: true }); }
    if (tgt.kind === 'monster') { this.game.onMonsterKilled(this, tgt, killer); if (!this.mode?.keepCorpses) this.timer(1.2, () => this.units.delete(tgt.id)); }
    else if (tgt.kind === 'player' || tgt.kind === 'bot') this.game.onPlayerDeath(this, tgt, killer);
    else { if (tgt.kind === 'minion' && tgt.owner) { const o = this.units.get(tgt.owner); if (o?.stats?.ks?.has('soulbound')) healUnit(this, o, o.hpMax * 0.05); } this.units.delete(tgt.id); }
    if (this.mode?.onKill) this.mode.onKill(tgt, killer);
  }

  // ---------- networking ----------
  snapshotFor(p, seen) {
    const out = []; const meta = {}; const R2 = VIEW_RADIUS * VIEW_RADIUS;
    for (const u of this.units.values()) {
      if (u !== p && d2(u, p) > R2 && !(u.boss && u.world)) continue;
      if (u.gmInvis && u !== p && !p.sess?.isGM) continue;
      let flags = 0; for (const k of u.statuses.keys()) flags |= STATUS_BIT[k] || 0;
      if (u.dead) flags |= 1 << 30;
      out.push([u.id, Math.round(u.x), Math.round(u.y), Math.round((u.hp / u.hpMax) * 1000), flags, Math.round(((u.facing || 0) * 180) / Math.PI), u.shield > 0 ? Math.round((u.shield / u.hpMax) * 1000) : 0]);
      const sig = `${u.hpMax}|${u.name}|${u.team}|${u.lv || u.level}|${u.title || ''}`;
      if (seen.get(u.id) !== sig) {
        seen.set(u.id, sig);
        meta[u.id] = { k: u.kind, n: u.name, c: u.classId || u.sprite, t: u.tint, lv: u.lv || u.level, tm: u.team, r: u.r, b: u.boss ? 1 : 0, e: u.elite ? 1 : 0, hm: Math.round(u.hpMax), g: u.guildTag, pal: u.palette, own: u.owner, title: u.title, w: u.weaponType };
      }
    }
    const fx = [];
    for (const e of this.events) if (e.x == null || (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < (VIEW_RADIUS + 300) ** 2 || e.ev.big) fx.push(e.ev);
    const drops = [];
    for (const d of this.drops.values()) if (d.owner === p.charId && (d.x - p.x) ** 2 + (d.y - p.y) ** 2 < R2) drops.push([d.id, Math.round(d.x), Math.round(d.y), d.label, d.color]);
    return { t: 's', tm: Math.round(this.time * 1000), u: out, m: meta, fx, d: drops };
  }
}
