// ===== Server-side combat: skill execution, damage, statuses, minions =====
import { ELEMENTS } from '../shared/constants.js';
import { moveWithCollision, canStand } from '../shared/mapgen.js';

const BEH_CAT = { melee: 'dmgMelee', dash: 'dmgMelee', leap: 'dmgMelee', orbit: 'dmgMelee', projectile: 'dmgRanged', barrage: 'dmgRanged', beam: 'dmgRanged', nova: 'dmgSpell', ground: 'dmgSpell', chain: 'dmgSpell', trap: 'dmgSpell', totem: 'dmgSpell', summon: 'dmgSpell' };
const CC = new Set(['stun', 'freeze', 'silence']);
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const now = () => Date.now() / 1000;

export function isHostile(a, b) { return a !== b && !a.dead && !b.dead && a.team !== b.team && b.kind !== 'totem' && !b.untargetable; }
export function isAlly(a, b) { return !b.dead && a.team === b.team && (b.kind === 'player' || b.kind === 'bot'); }
export const hasStatus = (u, s) => u.statuses.has(s);
export const isCC = (u) => u.statuses.has('stun') || u.statuses.has('freeze');

export function addStatus(inst, u, type, dur, data = {}) {
  if (u.dead) return;
  if (u.boss && (type === 'stun' || type === 'freeze' || type === 'silence') && !data.force) return;
  if (CC.has(type) && u.ccImmuneUntil > inst.time) return;
  const cur = u.statuses.get(type);
  if (cur) {
    cur.t = Math.max(cur.t, dur);
    if (data.stacks) cur.stacks = Math.min(data.max || 99, (cur.stacks || 1) + data.stacks);
    if (data.dps) cur.dps = Math.max(cur.dps, data.dps);
    if (data.src) cur.src = data.src;
  } else u.statuses.set(type, { t: dur, stacks: data.stacks || 1, dps: data.dps || 0, src: data.src, stats: data.stats, tick: 0 });
  if (data.stats) refreshStats(u);
}

// apply temporary buff stats on top of base stats
export function refreshStats(u) {
  if (!u.baseStats) return;
  const s = { ...u.baseStats, dmgEl: { ...u.baseStats.dmgEl }, res: { ...u.baseStats.res } };
  for (const [, st] of u.statuses) {
    if (!st.stats) continue;
    for (const [k, v] of Object.entries(st.stats)) {
      if (k === 'res') for (const e of ELEMENTS) s.res[e] = Math.min(85, (s.res[e] || 0) + v);
      else if (k === 'move') s.move *= 1 + v / 100;
      else if (k === 'armorPct') s.armor *= 1 + v / 100;
      else s[k] = (s[k] || 0) + v;
    }
  }
  s.crit = Math.min(90, s.crit); s.cdr = Math.min(70, s.cdr || 0);
  u.stats = s;
}

function heal(inst, u, amount, src) {
  if (u.dead || amount <= 0) return 0;
  if (u.stats.flags?.has('noRegen') && !src?.leech) return 0;
  const before = u.hp;
  u.hp = Math.min(u.hpMax, u.hp + amount);
  const over = amount - (u.hp - before);
  if (over > 0 && (u.stats.ks?.has('beacon') || u.stats.ks?.has('vampaura') || u.stats.leg?.has('set_bloodsworn'))) u.shield = Math.min(u.hpMax * 0.5, (u.shield || 0) + over * 0.5);
  if (amount >= 1 && !src?.silent) inst.fx({ k: 'dmg', id: u.id, v: Math.round(u.hp - before), h: 1 }, u);
  return u.hp - before;
}
export { heal as healUnit };

// ---- Damage ----
export function dealDamage(inst, src, tgt, spec, mult = 1, opt = {}) {
  if (!tgt || tgt.dead || tgt.invuln > inst.time) return 0;
  if (tgt.iframesUntil > inst.time) { inst.fx({ k: 'dmg', id: tgt.id, v: 0, miss: 1 }, tgt); return 0; }
  const s = src.stats; const ts = tgt.stats;
  const el = spec.chaos ? ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)] : (opt.el || spec.el || 'physical');
  if (src.statuses.has('blind') && Math.random() < 0.3) { inst.fx({ k: 'dmg', id: tgt.id, v: 0, miss: 1 }, tgt); return 0; }
  if ((tgt.kind === 'player' || tgt.kind === 'bot') && ts.dodge && Math.random() * 100 < ts.dodge) { inst.fx({ k: 'dmg', id: tgt.id, v: 0, miss: 1 }, tgt); return 0; }
  const owner = src.owner ? inst.units.get(src.owner) || src : src;
  let base = (opt.flat != null ? opt.flat : s.atk * (spec.dmg / 100)) * mult;
  let pct = opt.dot ? (s.dmgDot || 0) : (s.dmgAll || 0) + ((s.dmgEl && s.dmgEl[el]) || 0) + (s[BEH_CAT[spec.behavior]] || 0);
  if (tgt.boss) pct += s.dmgBoss || 0;
  if (src.kind === 'minion' || src.kind === 'totem') pct += owner.stats?.minionDmg || 0;
  const ks = s.ks || new Set();
  if (!opt.dot) {
  if (ks.has('berserker')) pct += 60 * (1 - src.hp / src.hpMax);
  if (ks.has('momentum') && src.momentumUntil > inst.time) pct += 25;
  if (ks.has('overload')) pct += 12 * Math.min(4, (src.elemChain || []).length);
  if (ks.has('flow')) pct += 8 * Math.min(5, src.flowStacks || 0);
  if (ks.has('sniper')) pct += Math.min(50, Math.sqrt(dist2(src, tgt)) / 12);
  if (ks.has('overheat') && src.mp / src.mpMax < 0.3) pct += 35;
  }
  base *= Math.max(0.1, 1 + pct / 100);
  if (tgt.statuses.has('shock')) base *= 1.15;
  if (tgt.statuses.has('mark')) base *= 1.2;
  if (tgt.statuses.has('weak')) base *= 2;
  if (src.statuses.has('weaken')) base *= 0.75;
  if (spec.execute && tgt.hp / tgt.hpMax < spec.execute) base *= 2;
  if (spec.shatter && (tgt.statuses.has('freeze') || tgt.statuses.has('chill'))) { base *= 2.5; tgt.statuses.delete('freeze'); tgt.statuses.delete('chill'); inst.fx({ k: 'pop', id: tgt.id, text: 'SHATTER!', c: '#bff0ff' }, tgt); }
  let crit = false;
  if (!opt.dot) {
    let cc = (spec.critBonus != null ? spec.critBonus : s.crit) || 5;
    if (ks.has('ambush') && tgt.hp >= tgt.hpMax * 0.99) cc = 100;
    if (src.guaranteedCrit) { cc = 100; src.guaranteedCrit = false; }
    crit = Math.random() * 100 < cc;
    if (crit) { base *= 1 + (s.critDmg || 50) / 100; if (ks.has('assassinate') && isCC(tgt)) base *= 1.5; }
  }
  // mitigation
  const armor = ts.armor || 0;
  if (el === 'physical' && !opt.dot) base *= 1 - armor / (armor + 60 + (s.level || 1) * 22);
  else if (!opt.dot) base *= 1 - (armor * 0.4) / (armor * 0.4 + 60 + (s.level || 1) * 22);
  const res = Math.max(-50, Math.min(75, ((ts.res && ts.res[el]) || 0) - ((s.pen && s.pen[el]) || 0)));
  base *= 1 - res / 100;
  base *= ts.dmgTakenMul || 1;
  if (ts.ks?.has('diamond') && tgt.hp > tgt.hpMax * 0.7) base *= 0.85;
  const pvp = (owner.kind === 'player' || owner.kind === 'bot') && (tgt.kind === 'player' || tgt.kind === 'bot');
  if (pvp) base *= (spec.pvpMul?.dmg ?? 0.55);
  if (tgt.countering > inst.time && !opt.dot && opt.melee) { base *= 0.3; addStatus(inst, src, 'stun', 0.6); inst.fx({ k: 'pop', id: tgt.id, text: 'PARRY!', c: '#ffe14a' }, tgt); }
  if (ts.block && !opt.dot && Math.random() * 100 < ts.block) { base *= 0.5; inst.fx({ k: 'pop', id: tgt.id, text: 'BLOCK', c: '#a0e0ff' }, tgt); }
  base *= 0.92 + Math.random() * 0.16;
  let dmg = Math.max(1, Math.round(base));
  // Martyr: paladin absorbs part of ally damage
  if (tgt.kind === 'player' && !opt.dot) for (const m of inst.martyrs || []) {
    if (m !== tgt && !m.dead && m.team === tgt.team && dist2(m, tgt) < 300 * 300) { const part = Math.round(dmg * 0.2); dmg -= part; applyRaw(inst, m, part); break; }
  }
  src.lastCombat = tgt.lastCombat = inst.time;
  const dealt = applyRaw(inst, tgt, dmg, src);
  inst.fx({ k: 'dmg', id: tgt.id, v: dmg, c: crit ? 1 : 0, el }, tgt);
  // threat & contribution
  tgt.threat = tgt.threat || new Map();
  tgt.threat.set(owner.id, (tgt.threat.get(owner.id) || 0) + dmg);
  if (tgt.contrib && (owner.kind === 'player')) tgt.contrib.set(owner.charId, (tgt.contrib.get(owner.charId) || 0) + dmg);
  if (!opt.dot) {
    const leech = (spec.leech || 0) + (s.leech || 0);
    if (leech > 0 && !owner.dead) heal(inst, owner, dmg * leech / 100 * (pvp ? 0.4 : 1), { leech: true, silent: true });
    if (spec.healOnHit && !owner.dead) heal(inst, owner, owner.hpMax * spec.healOnHit / 100 * 0.3, { silent: true });
    if (ks.has('battlepriest')) for (const a of inst.allies(owner, 350)) heal(inst, a, dmg * 0.1, { silent: true });
    if (ts.ks?.has('thorns') && src !== tgt && !src.dead) applyRaw(inst, src, Math.round(dmg * 0.3), tgt);
    if (crit && ks.has('critcascade')) for (const k in owner.cd || {}) owner.cd[k] -= 0.2;
    if (crit && s.leg?.has('tempest') && (owner.tempestCd || 0) < inst.time) {
      owner.tempestCd = inst.time + 0.5;
      inst.fx({ k: 'bolt', x: tgt.x, y: tgt.y, el: 'lightning' }, tgt);
      inst.timer(0.1, () => dealDamage(inst, owner, tgt, { dmg: 80, el: 'lightning', behavior: 'chain', pvpMul: spec.pvpMul }, 1));
    }
    applyMech(inst, src, tgt, spec, dmg, opt);
  }
  if (tgt.hp <= 0) inst.onKill(tgt, owner, src);
  return dealt;
}

export function applyRaw(inst, tgt, dmg, src) {
  if (tgt.dead) return 0;
  if (tgt.shield > 0) { const a = Math.min(tgt.shield, dmg); tgt.shield -= a; dmg -= a; }
  tgt.hp -= dmg;
  if (tgt.hp <= 0) {
    if (tgt.stats?.leg?.has('phoenix') && (tgt.phoenixCd || 0) < inst.time) {
      tgt.phoenixCd = inst.time + 90; tgt.hp = tgt.hpMax * 0.4; tgt.invuln = inst.time + 1.5;
      inst.fx({ k: 'pop', id: tgt.id, text: 'PHOENIX REBIRTH!', c: '#ff9a2a' }, tgt);
      return dmg;
    }
    tgt.hp = 0;
    if (src && !tgt.dead && dmg > 0 && tgt.kind !== 'player') { /* killer handled by dealDamage */ }
    if (src === undefined || src === null) inst.onKill(tgt, null, null);
  }
  return dmg;
}

export function applyMech(inst, src, tgt, spec, dmg, opt = {}) {
  const s = src.stats;
  const owner = src.owner ? inst.units.get(src.owner) || src : src;
  const sp = (spec.sp || 1) * (1 + (s.statusPower || 0) / 100) * (s.ks?.has('elemaster') ? 1.4 : 1);
  const pvp = (tgt.kind === 'player' || tgt.kind === 'bot') && (owner.kind === 'player' || owner.kind === 'bot');
  const cc = pvp ? (spec.pvpMul?.cc ?? 0.5) : 1;
  const list = [spec.mech, ...(spec.extraStatus || [])];
  for (const m of list) {
    switch (m) {
      case 'bleed': addStatus(inst, tgt, 'bleed', 4, { dps: dmg * 0.1 * sp, stacks: 1, max: 5, src: owner.id }); break;
      case 'burn': addStatus(inst, tgt, 'burn', 3.5, { dps: dmg * 0.18 * sp, src: owner.id }); break;
      case 'poison': addStatus(inst, tgt, 'poison', 5, { dps: dmg * 0.06 * sp * (s.leg?.has('venomweave') ? 2 : 1), stacks: 1, max: 10, src: owner.id }); break;
      case 'chill': case 'freeze': {
        addStatus(inst, tgt, 'chill', 3, { stacks: m === 'freeze' ? 1 : 1, max: 3 });
        const c = tgt.statuses.get('chill');
        if (c && c.stacks >= 3 && !tgt.statuses.has('freeze')) { addStatus(inst, tgt, 'freeze', 1.3 * Math.min(2, sp) * cc); c.stacks = 0; }
        break;
      }
      case 'shock': addStatus(inst, tgt, 'shock', 4); break;
      case 'stun': if (Math.random() < 0.35 * sp) addStatus(inst, tgt, 'stun', 0.9 * cc * Math.min(1.8, sp)); break;
      case 'slow': addStatus(inst, tgt, 'slow', 2.5 * cc); break;
      case 'mark': addStatus(inst, tgt, 'mark', 6); break;
      case 'weaken': addStatus(inst, tgt, 'weaken', 5); break;
      case 'blind': addStatus(inst, tgt, 'blind', 3 * cc); break;
    }
  }
  if (spec.knock && !opt.dot) push(inst, tgt, opt.cx ?? src.x, opt.cy ?? src.y, spec.knock * (pvp ? 0.5 : 1));
  if (spec.pull && opt.cx != null) push(inst, tgt, opt.cx, opt.cy, -Math.min(120, Math.sqrt((tgt.x - opt.cx) ** 2 + (tgt.y - opt.cy) ** 2) * 0.8));
}

export function push(inst, u, fx, fy, amount) {
  if (u.boss || u.dead || u.kind === 'totem' || u.stats.ks?.has('juggernaut')) return;
  const dx = u.x - fx, dy = u.y - fy, d = Math.hypot(dx, dy) || 1;
  const steps = 6;
  for (let i = 0; i < steps; i++) [u.x, u.y] = moveWithCollision(inst.L, u.x, u.y, (dx / d) * amount / steps, (dy / d) * amount / steps, u.r * 0.6);
}

// ---- Shapes ----
export function inShape(u, a) {
  const dx = u.x - a.x, dy = u.y - a.y, d = Math.hypot(dx, dy), rr = u.r || 12;
  switch (a.shape) {
    case 'circle': return d <= a.r + rr;
    case 'donut': return d <= a.r + rr && d >= (a.r2 || 0) - rr;
    case 'cone': {
      if (d > a.r + rr) return false; if (d < rr + 10) return true;
      let da = Math.atan2(dy, dx) - a.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
      return Math.abs(da) <= ((a.arc || 90) * Math.PI) / 360 + rr / Math.max(d, 1);
    }
    case 'line': case 'cross': {
      const angs = a.shape === 'cross' ? [a.ang, a.ang + Math.PI / 2, a.ang + Math.PI, a.ang - Math.PI / 2] : [a.ang];
      for (const g of angs) {
        const along = dx * Math.cos(g) + dy * Math.sin(g), perp = Math.abs(-dx * Math.sin(g) + dy * Math.cos(g));
        if (along >= -rr && along <= a.len + rr && perp <= a.w / 2 + rr) return true;
      }
      return false;
    }
  }
  return false;
}

// ---- Skill execution ----
export function castSkill(inst, caster, spec, tx, ty, opt = {}) {
  const mult = opt.mult || 1;
  const ang = Math.atan2(ty - caster.y, tx - caster.x);
  caster.facing = ang;
  if (!opt.silent) inst.fx({ k: 'cast', id: caster.id, ang, beh: spec.behavior, el: spec.el, n: opt.echo ? null : spec.name }, caster);
  const clampTarget = (range) => {
    const d = Math.hypot(tx - caster.x, ty - caster.y);
    if (d <= range) return [tx, ty];
    return [caster.x + Math.cos(ang) * range, caster.y + Math.sin(ang) * range];
  };
  // conversions from runes
  if (spec.totemMode && !opt.fromTotem) { spawnTotem(inst, caster, spec, ...clampTarget(300), { castSpec: { ...spec, totemMode: false }, dur: 8, tick: Math.max(0.8, spec.cd * 0.5) }); return post(); }
  if (spec.spiritMode && !opt.fromMinion) { spawnMinion(inst, caster, 'spirit', { ...spec, spiritMode: false }, 12, caster.x, caster.y); return post(); }
  if (spec.trapMode && spec.behavior !== 'trap') { placeTrap(inst, caster, spec, ...clampTarget(320), mult); return post(); }
  if (spec.orbitMode) { addOrbit(inst, caster, spec, mult); return post(); }
  const b = spec.behavior;
  const delayW = spec.windup || 0;
  switch (b) {
    case 'melee': {
      const doHit = (a2) => inst.area({ owner: caster.id, team: caster.team, x: caster.x, y: caster.y, shape: 'cone', r: spec.range + (spec.radius - 85) * 0.5, arc: spec.arc, ang: a2, spec, mult, delay: delayW + spec.delay, melee: true, chain: spec.chain });
      doHit(ang); if (spec.mirror) doHit(ang + Math.PI);
      if (spec.linger) inst.area({ owner: caster.id, team: caster.team, x: caster.x + Math.cos(ang) * 50, y: caster.y + Math.sin(ang) * 50, shape: 'circle', r: 70, spec, mult: 0.25, delay: delayW, dur: spec.linger, tick: 0.5 });
      if (spec.detonate) inst.area({ owner: caster.id, team: caster.team, x: caster.x + Math.cos(ang) * 70, y: caster.y + Math.sin(ang) * 70, shape: 'circle', r: spec.detonate, spec, mult: mult * 0.5, delay: delayW + 0.3 });
      break;
    }
    case 'projectile': case 'barrage': {
      const fire = (a0, idx) => {
        const n = b === 'barrage' ? 1 : spec.count;
        for (let i = 0; i < n; i++) {
          let a = a0;
          if (spec.radial) a = a0 + (i / n) * Math.PI * 2;
          else if (n > 1) a = a0 + ((i - (n - 1) / 2) * ((spec.spread * Math.PI) / 180)) / Math.max(1, (n - 1) / 2);
          if (b === 'barrage') a += ((Math.random() - 0.5) * spec.spread * Math.PI) / 180;
          const el = spec.prism && i > 0 ? ELEMENTS[1 + Math.floor(Math.random() * 7)] : spec.el;
          inst.projectile({ owner: caster.id, team: caster.team, x: caster.x, y: caster.y - 6, ang: a, speed: spec.speed || 500, r: spec.radius || 10, range: spec.range || 600, spec, mult, el, pierce: spec.pierce, chain: spec.chain, fork: spec.fork, homing: spec.homing, tx, ty });
        }
      };
      const total = b === 'barrage' ? spec.count : 1;
      for (let k = 0; k < total; k++) {
        inst.timer(delayW + k * (spec.interval || 0.1), () => {
          if (caster.dead) return;
          const a1 = Math.atan2(ty - caster.y, tx - caster.x);
          fire(a1, k); if (spec.mirror) fire(a1 + Math.PI, k);
        });
      }
      break;
    }
    case 'nova': {
      const cas = spec.cascade || 1;
      for (let i = 0; i < cas; i++) {
        const ox = caster.x + Math.cos(ang) * spec.radius * 1.4 * i, oy = caster.y + Math.sin(ang) * spec.radius * 1.4 * i;
        inst.area({ owner: caster.id, team: caster.team, x: ox, y: oy, shape: 'circle', r: spec.radius, spec, mult, delay: delayW + spec.delay + i * 0.2, pull: spec.pull, follow: i === 0 && !spec.delay ? caster.id : null, chain: spec.chain });
        if (spec.linger) inst.area({ owner: caster.id, team: caster.team, x: ox, y: oy, shape: 'circle', r: spec.radius * 0.8, spec, mult: mult * 0.2, delay: delayW + spec.delay, dur: spec.linger, tick: 0.5 });
      }
      if (spec.detonate) inst.area({ owner: caster.id, team: caster.team, x: caster.x, y: caster.y, shape: 'donut', r: spec.radius + spec.detonate, r2: spec.radius, spec, mult: mult * 0.6, delay: delayW + spec.delay + 0.4 });
      break;
    }
    case 'ground': case 'leap': {
      const [gx, gy] = clampTarget(spec.range || 500);
      if (b === 'leap') {
        caster.iframesUntil = inst.time + spec.delay + 0.1;
        inst.fx({ k: 'dash', id: caster.id, x1: caster.x, y1: caster.y, x2: gx, y2: gy, el: spec.el, leap: 1, dur: spec.delay }, caster);
        const ok = canStand(inst.L, gx, gy, caster.r * 0.6);
        inst.timer(spec.delay, () => { if (ok && !caster.dead) { caster.x = gx; caster.y = gy; } });
        if (caster.stats.ks?.has('unstoppable')) caster.ccImmuneUntil = inst.time + 2;
        caster.momentumUntil = inst.time + 3;
      }
      const cas = spec.cascade || 1;
      for (let i = 0; i < cas; i++) {
        const ox = gx + Math.cos(ang) * spec.radius * 1.3 * i, oy = gy + Math.sin(ang) * spec.radius * 1.3 * i;
        inst.area({ owner: caster.id, team: caster.team, x: ox, y: oy, shape: 'circle', r: spec.radius, spec, mult, delay: delayW + spec.delay + i * 0.25, pull: spec.pull, chain: spec.chain, show: true });
        if (spec.linger) inst.area({ owner: caster.id, team: caster.team, x: ox, y: oy, shape: 'circle', r: spec.radius, spec, mult: mult * 0.2, delay: delayW + spec.delay, dur: spec.linger, tick: 0.5, healField: spec.healField });
        else if (spec.healField) inst.area({ owner: caster.id, team: caster.team, x: ox, y: oy, shape: 'circle', r: spec.radius, spec, mult: 0, delay: delayW + spec.delay, dur: 4, tick: 1, healField: true });
      }
      if (spec.detonate) inst.area({ owner: caster.id, team: caster.team, x: gx, y: gy, shape: 'circle', r: spec.radius + spec.detonate, spec, mult: mult * 0.5, delay: delayW + spec.delay + 0.5 });
      break;
    }
    case 'beam': {
      const shoot = (a2) => {
        inst.timer(delayW, () => {
          if (caster.dead) return;
          const len = spec.range;
          inst.fx({ k: 'beam', x1: caster.x, y1: caster.y - 8, x2: caster.x + Math.cos(a2) * len, y2: caster.y - 8 + Math.sin(a2) * len, el: spec.el, w: spec.width }, caster);
          inst.area({ owner: caster.id, team: caster.team, x: caster.x, y: caster.y, shape: 'line', len, w: spec.width, ang: a2, spec, mult, delay: 0, chain: spec.chain, noVis: true });
          if (spec.linger) inst.area({ owner: caster.id, team: caster.team, x: caster.x, y: caster.y, shape: 'line', len, w: spec.width, ang: a2, spec, mult: mult * 0.2, delay: 0, dur: spec.linger, tick: 0.5 });
          if (spec.detonate) inst.area({ owner: caster.id, team: caster.team, x: caster.x + Math.cos(a2) * len, y: caster.y + Math.sin(a2) * len, shape: 'circle', r: spec.detonate, spec, mult: mult * 0.6, delay: 0.1 });
        });
      };
      shoot(ang); if (spec.mirror) shoot(ang + Math.PI);
      break;
    }
    case 'dash': {
      const range = spec.range;
      let x = caster.x, y = caster.y; const x0 = x, y0 = y;
      for (let i = 0; i < 20; i++) {
        const [nx, ny] = moveWithCollision(inst.L, x, y, (Math.cos(ang) * range) / 20, (Math.sin(ang) * range) / 20, caster.r * 0.6);
        if (nx === x && ny === y) break; x = nx; y = ny;
      }
      caster.iframesUntil = inst.time + 0.25;
      caster.momentumUntil = inst.time + 3;
      if (caster.stats.ks?.has('unstoppable')) caster.ccImmuneUntil = inst.time + 2;
      if (caster.stats.leg?.has('set_shadowdancer')) caster.guaranteedCrit = true;
      inst.fx({ k: 'dash', id: caster.id, x1: x0, y1: y0, x2: x, y2: y, el: spec.el, dur: 0.15 }, caster);
      caster.x = x; caster.y = y;
      const len = Math.hypot(x - x0, y - y0);
      inst.area({ owner: caster.id, team: caster.team, x: x0, y: y0, shape: 'line', len: Math.max(30, len), w: spec.width, ang, spec, mult, delay: 0.05, chain: spec.chain, noVis: true });
      if (spec.detonate) inst.area({ owner: caster.id, team: caster.team, x, y, shape: 'circle', r: spec.detonate + 20, spec, mult: mult * 0.6, delay: 0.25 });
      if (spec.linger) inst.area({ owner: caster.id, team: caster.team, x: x0, y: y0, shape: 'line', len: Math.max(30, len), w: spec.width, ang, spec, mult: mult * 0.2, delay: 0.1, dur: spec.linger, tick: 0.5 });
      if (spec.shadowBomb) inst.area({ owner: caster.id, team: caster.team, x: x0, y: y0, shape: 'circle', r: 110, spec: { ...spec, el: 'shadow' }, mult: mult * 1.2, delay: 0.8, show: true });
      break;
    }
    case 'chain': {
      inst.timer(delayW, () => {
        if (caster.dead) return;
        const first = inst.nearestEnemy(caster, spec.range, tx, ty) || inst.nearestEnemy(caster, spec.range);
        if (!first) { inst.fx({ k: 'chain', pts: [[caster.x, caster.y - 8], [caster.x + Math.cos(ang) * 120, caster.y + Math.sin(ang) * 120]], el: spec.el }, caster); return; }
        doChain(inst, caster, first, spec, mult, spec.chain + (caster.stats.chainBonus || 0), [caster.x, caster.y - 8]);
      });
      break;
    }
    case 'trap': placeTrap(inst, caster, spec, ...clampTarget(spec.range || 300), mult); break;
    case 'orbit': addOrbit(inst, caster, spec, mult); break;
    case 'summon': {
      for (let i = 0; i < spec.count; i++) spawnMinion(inst, caster, spec.minion || 'spirit', spec, spec.duration, caster.x + Math.cos(i * 2.4) * 40, caster.y + Math.sin(i * 2.4) * 40);
      break;
    }
    case 'totem': {
      const [gx, gy] = clampTarget(260);
      for (let i = 0; i < spec.count; i++) spawnTotem(inst, caster, spec, gx + i * 36 - (spec.count - 1) * 18, gy, { castSpec: totemSubSpec(spec), dur: spec.duration, tick: spec.tick });
      break;
    }
    case 'buff': {
      const targets = spec.aura ? [caster, ...inst.allies(caster, spec.aura)] : [caster];
      for (const t of new Set(targets)) {
        addStatus(inst, t, 'buff', spec.duration, { stats: spec.buff });
        if (spec.cleanse) cleanse(t);
        inst.fx({ k: 'buff', id: t.id, el: spec.el, dur: spec.duration }, t);
      }
      if (spec.castNova) inst.area({ owner: caster.id, team: caster.team, x: caster.x, y: caster.y, shape: 'circle', r: 150, spec: { ...spec, dmg: spec.castNova, behavior: 'nova' }, mult, delay: 0.1, show: true });
      if (spec.mech === 'rage') caster.mp = Math.min(caster.mpMax, caster.mp + caster.mpMax * 0.35);
      break;
    }
    case 'heal': {
      inst.timer(delayW, () => {
        const amt = caster.stats.atk * (spec.heal / 100) * (1 + (caster.stats.healPower || 0) / 100);
        const r = Math.max(spec.radius, spec.aura || 0);
        inst.fx({ k: 'area', x: caster.x, y: caster.y, shape: 'circle', r, el: 'holy', heal: 1, dur: 0.6 }, caster);
        for (const t of new Set([caster, ...inst.allies(caster, r)])) {
          heal(inst, t, amt * (inst.isPvp ? 0.6 : 1));
          if (spec.mech === 'shield' || spec.selfShield) t.shield = Math.min(t.hpMax * 0.6, (t.shield || 0) + amt * 0.5 * (1 + (caster.stats.shieldPower || 0) / 100));
          if (spec.cleanse || spec.variant === 'empowered') cleanse(t);
        }
        if (spec.linger) inst.area({ owner: caster.id, team: caster.team, x: caster.x, y: caster.y, shape: 'circle', r, spec, mult: 0, delay: 0, dur: spec.linger, tick: 1, healField: true, healAmt: amt * 0.15 });
      });
      break;
    }
  }
  return post();

  function post() {
    if (spec.selfShield) caster.shield = Math.min(caster.hpMax * 0.6, (caster.shield || 0) + caster.hpMax * spec.selfShield / 100 * (1 + (caster.stats.shieldPower || 0) / 100) * (inst.isPvp ? 0.6 : 1));
    if (spec.selfHaste || caster.stats.ks?.has('kite')) addStatus(inst, caster, 'haste', 2, { stats: { move: spec.selfHaste ? 30 : 15 } });
    if (spec.echo && !opt.echo) for (let e = 1; e <= spec.echo; e++) inst.timer(0.5 * e, () => { if (!caster.dead) castSkill(inst, caster, spec, tx, ty, { ...opt, mult: mult * (spec.echoMul || 0.6), echo: true }); });
  }
}

function totemSubSpec(spec) {
  const healing = spec.mech === 'heal';
  return { ...spec, behavior: healing ? 'heal' : 'projectile', dmg: spec.dmg, heal: healing ? 40 : 0, speed: 520, radius: 10, count: 1, range: spec.range || 450, totemMode: false, echo: 0, windup: 0, selfShield: 0, selfHaste: false, pierce: spec.pierce || 0 };
}

function cleanse(u) { for (const k of ['stun', 'freeze', 'slow', 'chill', 'poison', 'burn', 'bleed', 'blind', 'weaken', 'silence']) u.statuses.delete(k); }

export function doChain(inst, caster, first, spec, mult, bounces, fromPt) {
  const pts = [fromPt || [caster.x, caster.y]]; const hit = new Set(); let cur = first; let m = mult;
  for (let i = 0; i <= bounces && cur; i++) {
    pts.push([cur.x, cur.y - 8]); hit.add(cur.id);
    dealDamage(inst, caster, cur, spec, m, { cx: cur.x, cy: cur.y });
    if (spec.detonate) inst.area({ owner: caster.id, team: caster.team, x: cur.x, y: cur.y, shape: 'circle', r: spec.detonate, spec, mult: m * 0.4, delay: 0.1 });
    m *= 0.9;
    cur = inst.nearestEnemy(caster, 240, cur.x, cur.y, hit);
  }
  inst.fx({ k: 'chain', pts, el: spec.el }, caster);
}

function placeTrap(inst, caster, spec, x, y, mult) {
  caster.traps = (caster.traps || []).filter((a) => !a.done);
  if (caster.traps.length >= 3) { const old = caster.traps.shift(); old.done = true; }
  const a = inst.area({ owner: caster.id, team: caster.team, x, y, shape: 'circle', r: Math.max(60, spec.radius || 80), spec, mult, trap: true, arm: inst.time + 0.6, dur: spec.duration || 15, pull: spec.pull, show: true, chain: spec.chain });
  caster.traps.push(a);
}

function addOrbit(inst, caster, spec, mult) {
  const o = { id: inst.nextId(), owner: caster.id, team: caster.team, count: spec.count, r: spec.radius, spec, mult, until: inst.time + spec.duration, tick: spec.tick || 0.35, next: 0, hitT: new Map(), el: spec.el };
  inst.orbits.push(o);
  inst.fx({ k: 'orbit', id: o.id, owner: caster.id, n: o.count, r: o.r, dur: spec.duration, el: spec.el }, caster);
}

const MINION_KINDS = {
  skeleton: { hp: 0.35, spd: 120, range: 40, ranged: false, sprite: 'skeleton' },
  wolf: { hp: 0.4, spd: 170, range: 40, ranged: false, sprite: 'wolf' },
  hawk: { hp: 0.2, spd: 220, range: 40, ranged: false, sprite: 'bat', fly: true },
  clone: { hp: 0.4, spd: 170, range: 45, ranged: false, sprite: 'clone' },
  golem: { hp: 1.5, spd: 90, range: 55, ranged: false, sprite: 'golem', big: true },
  wraith: { hp: 0.3, spd: 140, range: 320, ranged: true, sprite: 'wraith' },
  angel: { hp: 0.4, spd: 150, range: 300, ranged: true, sprite: 'angel', healer: true },
  drone: { hp: 0.25, spd: 180, range: 320, ranged: true, sprite: 'drone', fly: true },
  spirit: { hp: 0.3, spd: 160, range: 380, ranged: true, sprite: 'spirit', fly: true },
};

export function spawnMinion(inst, owner, kind, spec, dur, x, y) {
  const mk = MINION_KINDS[kind] || MINION_KINDS.spirit;
  owner.minions = (owner.minions || []).filter((id) => { const m = inst.units.get(id); return m && !m.dead; });
  const cap = 6 + (owner.stats.ks?.has('legion') ? 3 : 0) + (owner.stats.leg?.has('gravecaller') ? 2 : 0);
  while (owner.minions.length >= cap) { const old = inst.units.get(owner.minions.shift()); if (old) inst.killQuiet(old); }
  const hpMax = Math.round(owner.hpMax * mk.hp * (1 + (owner.stats.minionDmg || 0) / 200));
  const m = inst.addUnit({
    kind: 'minion', team: owner.team, owner: owner.id, x, y, r: mk.big ? 18 : 11, hp: hpMax, hpMax, mp: 0, mpMax: 0,
    name: kind, sprite: mk.sprite, tint: owner.palette?.accent || '#a0ffd0', mk, spec, expire: inst.time + dur, atkReady: 0,
    stats: { ...owner.stats, move: mk.spd, armor: owner.stats.armor * 0.5, leech: 0 }, mech: spec.mech,
  });
  owner.minions.push(m.id);
  return m;
}

export function spawnTotem(inst, owner, spec, x, y, { castSpec, dur, tick }) {
  owner.totems = (owner.totems || []).filter((id) => { const t = inst.units.get(id); return t && !t.dead; });
  const cap = 1 + (spec.count || 1) - 1 + (owner.stats.ks?.has('totemlord') ? 2 : 0) + 2;
  while (owner.totems.length >= cap) { const old = inst.units.get(owner.totems.shift()); if (old) inst.killQuiet(old); }
  if (!canStand(inst.L, x, y, 8)) { x = owner.x; y = owner.y; }
  const t = inst.addUnit({
    kind: 'totem', team: owner.team, owner: owner.id, x, y, r: 12, hp: owner.hpMax * 0.3, hpMax: owner.hpMax * 0.3, mp: 0, mpMax: 0,
    name: 'totem', sprite: 'totem', tint: owner.palette?.accent || '#fff', castSpec, expire: inst.time + dur, tick, nextCast: inst.time + 0.3,
    stats: { ...owner.stats }, untargetable: false,
  });
  owner.totems.push(t.id);
  return t;
}

// Minion & totem AI
export function updateMinion(inst, m, dt) {
  if (m.expire < inst.time) { inst.killQuiet(m); return; }
  const owner = inst.units.get(m.owner);
  if (!owner || owner.dead) { inst.killQuiet(m); return; }
  if (isCC(m)) return;
  if (m.kind === 'totem') {
    if (m.nextCast <= inst.time) {
      m.nextCast = inst.time + m.tick;
      const cs = m.castSpec;
      if (cs.behavior === 'heal') { castSkill(inst, m, cs, m.x, m.y, { fromTotem: true, silent: true }); return; }
      const e = inst.nearestEnemy(m, cs.range || 450);
      if (e) castSkill(inst, m, cs, e.x, e.y, { fromTotem: true, silent: true });
    }
    return;
  }
  const mk = m.mk;
  let tgt = m.target && inst.units.get(m.target);
  if (!tgt || tgt.dead || dist2(tgt, owner) > 600 * 600) { tgt = inst.nearestEnemy(owner, 450, m.x, m.y); m.target = tgt?.id; }
  let mx = 0, my = 0;
  if (tgt) {
    const d = Math.sqrt(dist2(m, tgt));
    if (d > mk.range * 0.85) { mx = (tgt.x - m.x) / d; my = (tgt.y - m.y) / d; }
    if (d <= mk.range + tgt.r && m.atkReady <= inst.time) {
      m.atkReady = inst.time + (mk.ranged ? 1.3 : 0.9);
      if (m.spec?.spiritMode === false && m.name === 'spirit') { castSkill(inst, m, m.spec, tgt.x, tgt.y, { fromMinion: true, silent: true }); m.atkReady = inst.time + Math.max(1, m.spec.cd); }
      else if (mk.ranged) inst.projectile({ owner: m.id, team: m.team, x: m.x, y: m.y - 6, ang: Math.atan2(tgt.y - m.y, tgt.x - m.x), speed: 480, r: 8, range: mk.range + 60, spec: { ...m.spec, behavior: 'projectile', dmg: m.spec.dmg, pierce: 0, fork: 0, homing: true, detonate: 0, linger: 0 }, mult: 1, el: m.spec.el });
      else { inst.fx({ k: 'matk', id: m.id, ang: Math.atan2(tgt.y - m.y, tgt.x - m.x) }, m); dealDamage(inst, m, tgt, { ...m.spec, behavior: 'melee' }, 1, { melee: true }); }
      if (mk.healer) for (const a of [owner, ...inst.allies(owner, 300)]) heal(inst, a, owner.stats.atk * 0.25 * (1 + (owner.stats.healPower || 0) / 100), { silent: true });
    }
  } else {
    const d = Math.sqrt(dist2(m, owner));
    if (d > 70) { mx = (owner.x - m.x) / d; my = (owner.y - m.y) / d; }
  }
  if (mx || my) {
    const sp = m.stats.move * dt * (m.statuses.has('slow') ? 0.6 : 1);
    if (mk.fly) { m.x += mx * sp; m.y += my * sp; }
    else [m.x, m.y] = moveWithCollision(inst.L, m.x, m.y, mx * sp, my * sp, m.r * 0.6);
    m.facing = Math.atan2(my, mx);
  }
}

// statuses / DoTs / regen
export function tickStatuses(inst, u, dt) {
  let changed = false;
  for (const [k, s] of u.statuses) {
    s.t -= dt;
    if (s.dps) {
      s.tick += dt;
      if (s.tick >= 0.5) {
        s.tick -= 0.5;
        const src = inst.units.get(s.src) || u;
        const amt = Math.max(1, Math.round(s.dps * 0.5 * (s.stacks || 1)));
        if (src !== u) dealDamage(inst, src, u, { el: k === 'burn' ? 'fire' : k === 'poison' ? 'poison' : 'physical', dmg: 0, behavior: 'dot', pvpMul: { dmg: 0.6 } }, 1, { flat: amt, dot: true });
        else applyRaw(inst, u, amt);
      }
    }
    if (s.t <= 0) { u.statuses.delete(k); if (s.stats) changed = true; }
  }
  if (changed) refreshStats(u);
}
