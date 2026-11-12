// ===== Click-to-move navigation + Auto Hunt (client-side assistant; the server still validates every action) =====
import { findPath } from './path.js';
import { getSkill, resolveSkill } from '/shared/skills.js';
import { MAPS, MONSTERS, BOSSES } from '/shared/world.js';
import { HOTBAR_SIZE } from '/shared/constants.js';

export const AUTO_DEFAULT = { targets: 'all', list: [], bossFirst: true, avoidElite: false, priority: 'nearest', radius: 1500, anchor: 'start', loot: true, potHp: 45, potMp: 25, dodge: true, counter: true, useUlt: true, onDeath: 'stop' };
const DEAD = 1 << 30;

export class Nav {
  constructor(G) { this.G = G; this.path = null; this.goal = null; this.stuckT = 0; this.last = null; }
  goTo(x, y, stop = 8) {
    const me = this.G.units.get(this.G.you); if (!me || !this.G.L) return false;
    const p = findPath(this.G.L, me.x, me.y, x, y);
    if (!p) { this.path = null; return false; }
    this.path = p; this.goal = [x, y]; this.stop = stop; this.stuckT = 0; this.last = [me.x, me.y];
    return true;
  }
  clear() { this.path = null; this.goal = null; }
  get active() { return !!this.path; }
  dir(dt) {
    const me = this.G.units.get(this.G.you); if (!me || !this.path) return [0, 0];
    let wp = this.path[0];
    while (wp && Math.hypot(wp[0] - me.x, wp[1] - me.y) < (this.path.length === 1 ? this.stop : 14)) { this.path.shift(); wp = this.path[0]; }
    if (!wp) { this.clear(); return [0, 0]; }
    if (this.last && Math.hypot(me.x - this.last[0], me.y - this.last[1]) < 0.5) { this.stuckT += dt; if (this.stuckT > 0.7) { const g = this.goal; this.goTo(g[0], g[1], this.stop); return [0, 0]; } } else this.stuckT = 0;
    this.last = [me.x, me.y];
    const dx = wp[0] - me.x, dy = wp[1] - me.y, l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  }
}

function inTele(f, x, y) {
  const dx = x - f.x, dy = y - f.y, d = Math.hypot(dx, dy), rr = 14;
  if (f.shape === 'circle') return d < f.r + rr;
  if (f.shape === 'donut') return d < f.r + rr && d > (f.r2 || 0) - rr;
  if (f.shape === 'cone') { if (d > f.r + rr) return false; let a = Math.atan2(dy, dx) - f.ang; a = Math.atan2(Math.sin(a), Math.cos(a)); return Math.abs(a) < ((f.arc || 90) * Math.PI) / 360 + 0.2; }
  const angs = f.shape === 'cross' ? [f.ang, f.ang + Math.PI / 2, f.ang + Math.PI, f.ang - Math.PI / 2] : [f.ang];
  return angs.some((g) => { const al = dx * Math.cos(g) + dy * Math.sin(g), pe = Math.abs(-dx * Math.sin(g) + dy * Math.cos(g)); return al > -rr && al < f.len + rr && pe < f.w / 2 + rr; });
}

export class Auto {
  constructor(G, renderer) {
    this.G = G; this.r = renderer; this.on = false; this.nav = new Nav(G); this.target = null; this.forced = null;
    this.next = 0; this.potT = 0; this.handled = new Set(); this.anchor = null; this.specs = {}; this.repathT = 0; this.wanderT = 0; this.lootT = 0;
  }
  get cfg() { return { ...AUTO_DEFAULT, ...(this.G.char?.settings?.auto || {}) }; }
  get order() {
    const c = this.G.char; if (!c) return [];
    const s = c.settings?.askill || {}; const filled = c.build.hotbar.map((id, i) => (id ? i : -1)).filter((i) => i >= 0);
    const ord = (s.order || []).filter((i) => filled.includes(i));
    for (const i of filled) if (!ord.includes(i)) ord.push(i);
    return ord.filter((i) => !(s.off || []).includes(i));
  }
  refreshSpecs(stats) {
    const c = this.G.char; this.specs = {};
    [...c.build.hotbar, c.build.ult].forEach((id, i) => { const d = id && getSkill(id); if (d) this.specs[i === HOTBAR_SIZE ? 'u' : i] = resolveSkill(d, { rank: c.skillRanks[id] || 1, runes: c.build.runes[id] || [], stats, ks: stats?.ks, leg: stats?.leg }); });
  }
  toggle(v) {
    this.on = v ?? !this.on; this.target = null; this.nav.clear();
    const me = this.G.units.get(this.G.you); this.anchor = me ? [me.x, me.y] : null;
    this.G.ui?.toast(this.on ? 'เปิดระบบออโต้ (U เพื่อปิด)' : 'ปิดระบบออโต้', this.on ? '#5aff7a' : '#ffb04a', 1600);
    this.G.ui?.renderAutoBtn();
  }
  attack(id) { this.forced = id; this.target = id; }
  cancelManual() { this.forced = null; if (!this.on) this.target = null; }
  range(sp) {
    if (!sp) return 0;
    switch (sp.behavior) {
      case 'melee': return sp.range + 10; case 'nova': return sp.radius * 0.85; case 'dash': return sp.range; case 'orbit': return sp.radius + 10;
      case 'buff': case 'summon': case 'totem': case 'heal': return 500;
      default: return Math.max(80, (sp.range || 300) * 0.85);
    }
  }
  validTarget(u, cfg, anchor) {
    const m = u.meta; if (!m || u.flags & DEAD || m.tm === this.G.myTeam || m.k === 'totem' || m.k === 'minion') return false;
    if (m.k !== 'monster' && !this.G.inst?.pvp) return false;
    if (cfg.avoidElite && m.e) return false;
    if (cfg.targets === 'list' && !m.b && !cfg.list.includes(m.n.replace('★ ', ''))) return false;
    if (cfg.targets === 'boss' && !m.b) return false;
    if (cfg.radius && anchor && Math.hypot(u.x - anchor[0], u.y - anchor[1]) > cfg.radius) return false;
    return true;
  }
  pickTarget(cfg) {
    const me = this.G.units.get(this.G.you); const anchor = cfg.anchor === 'start' ? this.anchor : [me.x, me.y];
    let best = null, bs = Infinity;
    for (const u of this.G.units.values()) {
      if (!this.validTarget(u, cfg, anchor)) continue;
      const d = Math.hypot(u.x - me.x, u.y - me.y);
      let score = cfg.priority === 'lowhp' ? u.hp : cfg.priority === 'highlv' ? -(u.meta.lv || 0) * 100 + d / 100 : d;
      if (cfg.bossFirst && u.meta.b) score -= 1e6;
      if (score < bs) { bs = score; best = u; }
    }
    return best;
  }
  // returns [mx,my] movement or null when idle
  tick(dt, castAt, send) {
    const G = this.G, me = G.units.get(G.you);
    if (!me || !G.me || !G.L) return null;
    const active = this.on || this.forced;
    if (me.flags & DEAD) { if (this.on && this.cfg.onDeath === 'stop') this.toggle(false); this.forced = null; this.nav.clear(); return null; }
    const now = performance.now() / 1000; const cfg = this.cfg;
    if (this.on) {
      // potions
      if (now > this.potT) {
        if (G.me.hp / G.me.hpMax * 100 < cfg.potHp && G.me.pot <= 0) { send({ t: 'potion', kind: 'hp' }); this.potT = now + 1; }
        else if (G.me.mp / G.me.mpMax * 100 < cfg.potMp && G.me.pot <= 0) { send({ t: 'potion', kind: 'mp' }); this.potT = now + 1; }
      }
      // read boss telegraphs: counter golden attacks, dodge the rest
      for (const f of this.r.fx) {
        if (f.kind !== 'tele' || this.handled.has(f)) continue;
        const left = f.dur - (this.r.t - f.t0);
        if (left <= 0 || left > 0.85 || !inTele(f, me.x, me.y)) continue;
        if (f.counter && cfg.counter && left < 0.8) { send({ t: 'counter' }); this.handled.add(f); continue; }
        if (cfg.dodge && G.me.dodge <= 0) {
          let dx = me.x - f.x, dy = me.y - f.y;
          if (f.shape === 'line' || f.shape === 'cross' || f.shape === 'cone') { dx = -Math.sin(f.ang); dy = Math.cos(f.ang); if ((me.x - f.x) * dx + (me.y - f.y) * dy < 0) { dx = -dx; dy = -dy; } }
          if (f.shape === 'donut') { dx = f.x - me.x; dy = f.y - me.y; }
          const l = Math.hypot(dx, dy) || 1; send({ t: 'dodge', dx: dx / l, dy: dy / l }); this.handled.add(f);
        }
      }
      if (this.handled.size > 200) this.handled.clear();
    }
    if (!active) return this.nav.active ? this.nav.dir(dt) : null;
    // loot first
    if (this.on && cfg.loot && G.drops.length) {
      const d = G.drops.map((d) => [d, Math.hypot(d[1] - me.x, d[2] - me.y)]).filter(([, dd]) => dd < 600).sort((a, b) => a[1] - b[1])[0];
      if (d) {
        if (d[1] < 70) { if (now > this.lootT) { send({ t: 'pickupAll' }); this.lootT = now + 0.4; } }
        else { if (!this.nav.active || now > this.repathT) { this.nav.goTo(d[0][1], d[0][2], 20); this.repathT = now + 0.8; } return this.nav.dir(dt); }
      }
    }
    // target
    let t = this.target && G.units.get(this.target);
    if (t && (t.flags & DEAD)) { t = null; if (this.forced === this.target) this.forced = null; }
    if (this.forced && !t) { this.target = null; return null; }
    if (!t && this.on) { t = this.pickTarget(cfg); this.target = t?.id || null; }
    if (!t) {
      if (this.on && (!this.nav.active || now > this.wanderT)) {
        const a = this.anchor || [me.x, me.y]; const r = cfg.radius || 2000; const ang = Math.random() * 6.28;
        this.nav.goTo(a[0] + Math.cos(ang) * r * 0.6 * Math.random(), a[1] + Math.sin(ang) * r * 0.6 * Math.random(), 30); this.wanderT = now + 4;
      }
      return this.nav.active ? this.nav.dir(dt) : null;
    }
    const dist = Math.hypot(t.x - me.x, t.y - me.y);
    // choose skill by the player's priority order
    const order = this.forced && !this.on ? this.order.slice(0, 1) : this.order;
    const slots = [...order]; if (this.on && cfg.useUlt && this.specs.u) slots.unshift('u');
    let want = null;
    for (const s of slots) {
      const sp = this.specs[s]; const cd = G.me.cds[s === 'u' ? HOTBAR_SIZE : s];
      if (!sp || !cd || cd[0] > 0 || G.me.mp < cd[3]) continue;
      if (sp.behavior === 'heal' && G.me.hp / G.me.hpMax > 0.7) continue;
      if (s === 'u' && !t.meta?.b && !t.meta?.e) continue;
      want = { s, sp }; break;
    }
    const firstSp = this.specs[order[0]];
    const needRange = want ? this.range(want.sp) : this.range(firstSp) || 80;
    if (dist <= needRange + (t.meta?.r || 12)) {
      this.nav.clear();
      if (want && now > this.next) { castAt(want.s, t.x, t.y); this.next = now + 0.18; }
      return [0, 0];
    }
    if (!this.nav.active || now > this.repathT || (this.nav.goal && Math.hypot(this.nav.goal[0] - t.x, this.nav.goal[1] - t.y) > 64)) { this.nav.goTo(t.x, t.y, Math.max(20, needRange * 0.7)); this.repathT = now + 0.5; }
    return this.nav.dir(dt);
  }
  monsterChoices() {
    const m = MAPS[this.G.inst?.key]; if (!m || !m.monsters) return [];
    return [...m.monsters.map((id) => MONSTERS[id].name), BOSSES[m.fieldBoss]?.name].filter(Boolean);
  }
}
