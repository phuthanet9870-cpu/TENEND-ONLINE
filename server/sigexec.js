// ===== Executors for signature skill mechanics (server authoritative) =====
// castSkill() calls execSig() first; returning true means the mechanic was fully handled here.
import { dealDamage, addStatus, healUnit, castSkill, push, spawnMinion } from './combat.js';
import { canStand, moveWithCollision } from '../shared/mapgen.js';

const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const clampTo = (caster, tx, ty, range) => { const d = Math.hypot(tx - caster.x, ty - caster.y); if (d <= range) return [tx, ty]; const a = Math.atan2(ty - caster.y, tx - caster.x); return [caster.x + Math.cos(a) * range, caster.y + Math.sin(a) * range]; };
function teleport(inst, u, x, y) {
  // step back along the line until the spot is standable
  for (let i = 0; i < 12; i++) { const k = 1 - i / 12; const px = u.x + (x - u.x) * k, py = u.y + (y - u.y) * k; if (canStand(inst.L, px, py, u.r * 0.6)) { inst.fx({ k: 'dash', id: u.id, x1: u.x, y1: u.y, x2: px, y2: py, el: 'arcane', dur: 0.08, blink: 1 }, u); u.x = px; u.y = py; return true; } }
  return false;
}
function targetNear(inst, caster, tx, ty, range) { return inst.nearestEnemy(caster, range, tx, ty) || inst.nearestEnemy(caster, range); }

export function execSig(inst, caster, spec, tx, ty, mult, opt) {
  const ang = Math.atan2(ty - caster.y, tx - caster.x);
  const w = spec.windup || 0;
  // ---- caster-side effects that ride on any behavior ----
  if (!opt.sigSub) {
    if (spec.hpCost) caster.hp = Math.max(1, caster.hp - caster.hpMax * spec.hpCost / 100);
    if (spec.mpGain) caster.mp = Math.min(caster.mpMax, caster.mp + caster.mpMax * spec.mpGain / 100);
    if (spec.ccImmune) caster.ccImmuneUntil = inst.time + spec.ccImmune;
    if (spec.parry) { caster.countering = inst.time + spec.parry; addStatus(inst, caster, 'parry', spec.parry); }
    if (spec.enchant) caster.enchant = { el: spec.el, until: inst.time + (spec.enchant > 1 ? spec.enchant : spec.duration) };
    if (spec.refund) caster.mp = Math.min(caster.mpMax, caster.mp + caster.mpMax * spec.refund / 100);
    if (spec.iframe) caster.iframesUntil = inst.time + spec.iframe;
    if (spec.selfStealth) { addStatus(inst, caster, 'stealth', spec.selfStealth); inst.fx({ k: 'buff', id: caster.id, el: 'shadow', dur: spec.selfStealth, v: 'shadowstep' }, caster); }
    if (spec.devotion) { if (!inst.martyrs.includes(caster)) inst.martyrs.push(caster); inst.timer(spec.devotion, () => { if (!caster.stats.ks?.has('martyr')) inst.martyrs = inst.martyrs.filter((m) => m !== caster); }); }
    if (spec.kyrie) for (const t of new Set([caster, ...inst.allies(caster, spec.aura || 300)])) { t.shield = Math.min(t.hpMax * 0.6, (t.shield || 0) + t.hpMax * spec.kyrie / 100 * (inst.isPvp ? 0.6 : 1)); inst.fx({ k: 'buff', id: t.id, el: 'holy', dur: 1, v: 'holy' }, t); }
    if (spec.buffWith) addStatus(inst, caster, 'buff', spec.duration, { stats: spec.buffWith });
    if (spec.consumeMp) { mult *= 1 + (caster.mp / Math.max(1, caster.mpMax)) * 4; caster.mp = 0; }
  }
  // ---- repeated hits (Double Strike, Sonic Blow, Whirlwind, Dragon Breath, Life Drain ...) ----
  if (spec.multiHit > 1 && !opt.sigSub && !spec.skyBolt && !spec.orbHits) {
    const n = spec.multiHit;
    for (let i = 0; i < n; i++) inst.timer(i * (spec.interval || 0.15), () => {
      if (caster.dead) return;
      const sub = { ...spec, multiHit: 0, windup: i ? 0 : w, knock: i === n - 1 && spec.lastKnock ? spec.lastKnock : spec.knock };
      const aim = Math.atan2(ty - caster.y, tx - caster.x);
      castSkill(inst, caster, sub, caster.x + Math.cos(aim) * 100, caster.y + Math.sin(aim) * 100, { ...opt, mult, silent: i > 0, sigSub: true });
    });
    return true;
  }
  if (opt.sigSub) return false;
  // ---- sky bolts on one target (Lightning Bolt style) ----
  if (spec.skyBolt && spec.behavior === 'chain') {
    const t = targetNear(inst, caster, tx, ty, spec.range || 420); if (!t) return true;
    for (let i = 0; i < (spec.multiHit || 1); i++) inst.timer(w + i * (spec.interval || 0.12), () => { if (t.dead) return; inst.fx({ k: 'bolt', x: t.x, y: t.y, el: spec.el, s: spec.n }, t); dealDamage(inst, caster, t, spec, mult); });
    return true;
  }
  // ---- single target curses via chain:0 (Stone Curse, Lex Aeterna) ----
  if (spec.behavior === 'chain' && spec.chain === 0) {
    const t = targetNear(inst, caster, tx, ty, spec.range || 420); if (!t) return true;
    inst.timer(w, () => { inst.fx({ k: 'chain', pts: [[caster.x, caster.y - 8], [t.x, t.y - 8]], el: spec.el, s: spec.n }, caster); inst.fx({ k: 'area', x: t.x, y: t.y, shape: 'circle', r: 40, el: spec.el, s: spec.n, delay: 0, dur: 0, v: spec.v, show: 1 }); dealDamage(inst, caster, t, spec, mult); });
    return true;
  }
  // ---- teleport behind a target then strike (Backstab, Shadow Step) ----
  if (spec.behind) {
    const t = targetNear(inst, caster, tx, ty, spec.range || 340);
    if (!t) { teleport(inst, caster, ...clampTo(caster, tx, ty, 200)); return true; }
    const a = Math.atan2(t.y - caster.y, t.x - caster.x);
    teleport(inst, caster, t.x + Math.cos(a) * (t.r + 18), t.y + Math.sin(a) * (t.r + 18));
    caster.facing = a + Math.PI;
    if (spec.guaranteedCrit) caster.guaranteedCrit = true;
    inst.timer(0.05, () => { inst.fx({ k: 'area', x: t.x, y: t.y, shape: 'circle', r: 50, el: spec.el, s: spec.n, delay: 0, dur: 0, v: spec.v, show: 1 }); dealDamage(inst, caster, t, spec, mult, { melee: true }); });
    return true;
  }
  // ---- dash to a far target (Grapple Leap) ----
  if (spec.toTarget) {
    const t = targetNear(inst, caster, tx, ty, spec.range); if (!t) return true;
    const a = Math.atan2(caster.y - t.y, caster.x - t.x);
    inst.fx({ k: 'chain', pts: [[caster.x, caster.y - 10], [t.x, t.y - 10]], el: 'physical' }, caster);
    teleport(inst, caster, t.x + Math.cos(a) * (t.r + 16), t.y + Math.sin(a) * (t.r + 16));
    dealDamage(inst, caster, t, spec, mult, { melee: true });
    return true;
  }
  // ---- chain of dashes through several enemies (Phantom Assault) ----
  if (spec.multiDash) {
    const hit = new Set(); let n = 0;
    const step = () => {
      if (caster.dead || n++ >= spec.multiDash) return;
      const t = inst.nearestEnemy(caster, n === 1 ? spec.range : 320, n === 1 ? tx : caster.x, n === 1 ? ty : caster.y, hit); if (!t) return;
      hit.add(t.id); const a = Math.atan2(t.y - caster.y, t.x - caster.x);
      teleport(inst, caster, t.x + Math.cos(a) * (t.r + 14), t.y + Math.sin(a) * (t.r + 14));
      inst.fx({ k: 'area', x: t.x, y: t.y, shape: 'circle', r: 46, el: spec.el, s: spec.n, delay: 0, dur: 0, v: 'xslash', show: 1 });
      dealDamage(inst, caster, t, spec, mult, { melee: true }); caster.iframesUntil = inst.time + 0.2;
      inst.timer(0.16, step);
    };
    step(); return true;
  }
  // ---- blink ----
  if (spec.teleport) { teleport(inst, caster, ...clampTo(caster, tx, ty, spec.range)); caster.iframesUntil = inst.time + 0.2; return true; }
  // ---- dash + heavy strike at the end (Lunge) ----
  if (spec.endHit) {
    inst.timer(0.18, () => inst.area({ owner: caster.id, team: caster.team, x: caster.x + Math.cos(ang) * 40, y: caster.y + Math.sin(ang) * 40, shape: 'circle', r: 60, spec: { ...spec, dmg: spec.endHit }, mult, delay: 0, show: true, melee: true }));
    return false;
  }
  // ---- expanding shock rings ----
  if (spec.rings) {
    for (let i = 0; i < spec.rings; i++) inst.timer(w + i * 0.22, () => inst.area({ owner: caster.id, team: caster.team, x: caster.x, y: caster.y, shape: 'donut', r: spec.radius * (i + 1), r2: spec.radius * i, spec, mult, delay: 0 }));
    return true;
  }
  // ---- eruptions marching forward (Fissure, Earth Spike) ----
  if (spec.march) {
    const x0 = caster.x, y0 = caster.y;
    for (let i = 0; i < spec.march; i++) inst.timer(w + i * 0.09, () => inst.area({ owner: caster.id, team: caster.team, x: x0 + Math.cos(ang) * spec.step * (i + 1), y: y0 + Math.sin(ang) * spec.step * (i + 1), shape: 'circle', r: 48, spec, mult, delay: 0 }));
    return true;
  }
  // ---- random strikes over an area (Arrow Rain, Blizzard, Thunderstorm, Meteor Storm, Heaven's Drive) ----
  if (spec.rain) {
    const [cx, cy] = clampTo(caster, tx, ty, spec.range || 520);
    inst.fx({ k: 'area', x: cx, y: cy, shape: 'circle', r: spec.radius, el: spec.el, s: spec.n, delay: spec.rainDur || 1, dur: 0, v: 'runes', ghost: 1 });
    for (let i = 0; i < spec.rain; i++) inst.timer(w + (i / spec.rain) * (spec.rainDur || 1), () => {
      const a = Math.random() * 6.283, r = spec.radius * Math.sqrt(Math.random());
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (spec.skyBolt) inst.fx({ k: 'bolt', x, y, el: spec.el, s: spec.n });
      inst.area({ owner: caster.id, team: caster.team, x, y, shape: 'circle', r: spec.rainR || 42, spec, mult, delay: spec.v === 'meteor' ? 0.35 : 0 });
    });
    return true;
  }
  // ---- wall of lingering segments (Fire Wall) ----
  if (spec.wall) {
    const [cx, cy] = clampTo(caster, tx, ty, spec.range || 300); const pa = ang + Math.PI / 2;
    for (let i = 0; i < spec.wall; i++) { const o = (i - (spec.wall - 1) / 2) * 44; inst.area({ owner: caster.id, team: caster.team, x: cx + Math.cos(pa) * o, y: cy + Math.sin(pa) * o, shape: 'circle', r: 30, spec, mult, delay: w + i * 0.05, dur: spec.linger, tick: spec.tick || 0.4 }); }
    return true;
  }
  // ---- spiral volley around the caster (Arrow Storm) ----
  if (spec.spiral) {
    for (let k = 0; k < spec.spiral; k++) inst.timer(w + k * 0.22, () => { for (let i = 0; i < spec.count; i++) inst.projectile({ owner: caster.id, team: caster.team, x: caster.x, y: caster.y - 6, ang: (i / spec.count) * Math.PI * 2 + k * 0.26, speed: 520, r: 9, range: 420, spec, mult, el: spec.el }); });
    return true;
  }
  // ---- total damage split between everyone hit (Napalm Beat) ----
  if (spec.splitDmg) {
    const [cx, cy] = clampTo(caster, tx, ty, spec.range || 520);
    inst.fx({ k: 'area', x: cx, y: cy, shape: 'circle', r: spec.radius, el: spec.el, s: spec.n, delay: spec.delay, dur: 0, v: spec.v, show: 1 });
    inst.timer(w + (spec.delay || 0), () => { const v = inst.hostilesIn(caster.team, { shape: 'circle', x: cx, y: cy, r: spec.radius }); const m = (mult * (1 + 0.3 * (v.length - 1))) / Math.max(1, v.length); for (const t of v) dealDamage(inst, caster, t, spec, m, { cx, cy }); });
    return true;
  }
  // ---- three-way beam (Prism Ray) ----
  if (spec.prismSplit) {
    for (const off of [-0.28, 0, 0.28]) castSkill(inst, caster, { ...spec, prismSplit: 0 }, caster.x + Math.cos(ang + off) * 200, caster.y + Math.sin(ang + off) * 200, { ...opt, mult, silent: off !== 0, sigSub: true });
    return true;
  }
  // ---- donut ring field (Frost Ring) / holy cross (Exorcism) ----
  if (spec.donut) { inst.area({ owner: caster.id, team: caster.team, x: caster.x, y: caster.y, shape: 'donut', r: spec.radius, r2: spec.donut, spec, mult, delay: w, dur: spec.linger || 0, tick: spec.tick || 0.5, show: true }); return true; }
  if (spec.cross) { const [cx, cy] = clampTo(caster, tx, ty, spec.range || 450); inst.area({ owner: caster.id, team: caster.team, x: cx, y: cy, shape: 'cross', len: spec.radius, w: 70, ang: 0, spec, mult, delay: w + 0.3, dur: spec.linger, tick: spec.tick || 0.5, show: true }); return true; }
  // ---- explode fresh corpses (Corpse Explosion) ----
  if (spec.corpse) {
    const [cx, cy] = clampTo(caster, tx, ty, spec.range || 520);
    const list = (inst.corpses || []).filter((c) => inst.time - c.t < 10 && (c.x - cx) ** 2 + (c.y - cy) ** 2 < 300 * 300).slice(0, spec.corpse);
    inst.corpses = (inst.corpses || []).filter((c) => !list.includes(c));
    if (!list.length) list.push({ x: cx, y: cy, weak: true });
    list.forEach((c, i) => inst.area({ owner: caster.id, team: caster.team, x: c.x, y: c.y, shape: 'circle', r: spec.radius, spec, mult: c.weak ? mult * 0.4 : mult, delay: w + 0.1 + i * 0.12, show: true }));
    return true;
  }
  // ---- mines around a point ----
  if (spec.mines) {
    const [cx, cy] = clampTo(caster, tx, ty, 300);
    caster.traps = (caster.traps || []).filter((a) => !a.done);
    for (let i = 0; i < spec.mines; i++) { const a = (i / spec.mines) * 6.283; const x = cx + Math.cos(a) * 70, y = cy + Math.sin(a) * 70; if (!canStand(inst.L, x, y, 6)) continue; const tr = inst.area({ owner: caster.id, team: caster.team, x, y, shape: 'circle', r: spec.radius, spec, mult, trap: true, arm: inst.time + 0.6, dur: 20, show: true }); caster.traps.push(tr); }
    while (caster.traps.length > 8) caster.traps.shift().done = true;
    return true;
  }
  // ---- heal the most wounded ally (Heal) ----
  if (spec.healTarget) {
    const allies = [caster, ...inst.allies(caster, spec.radius || 450)];
    const t = allies.sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
    const amt = caster.stats.atk * (spec.heal / 100) * (1 + (caster.stats.healPower || 0) / 100) * (inst.isPvp ? 0.6 : 1);
    inst.timer(w, () => { healUnit(inst, t, amt); inst.fx({ k: 'buff', id: t.id, el: 'holy', dur: 1, v: 'heal' }, t); });
    return true;
  }
  // ---- decoys pull aggro ----
  if (spec.minion === 'decoy') {
    for (let i = 0; i < spec.count; i++) {
      const d = spawnMinion(inst, caster, 'decoy', spec, spec.duration, caster.x + Math.cos(i * 3.14) * 60, caster.y + Math.sin(i * 3.14) * 60);
      for (const m of inst.units.values()) if (m.kind === 'monster' && !m.boss && !m.dead && d2(m, d) < 400 * 400) { m.target = d.id; m.tauntUntil = inst.time + spec.duration; }
    }
    return true;
  }
  return false;
}

// on-hit specials for projectiles (called from Instance.updateProjectiles)
export function projectileHit(inst, p, owner, t) {
  const s = p.spec;
  if (s.hook && !t.boss) { const a = Math.atan2(owner.y - t.y, owner.x - t.x); const d = Math.max(0, Math.hypot(owner.x - t.x, owner.y - t.y) - (owner.r + t.r + 10)); for (let i = 0; i < 10; i++) [t.x, t.y] = moveWithCollision(inst.L, t.x, t.y, (Math.cos(a) * d) / 10, (Math.sin(a) * d) / 10, t.r * 0.6); inst.fx({ k: 'chain', pts: [[owner.x, owner.y - 10], [t.x, t.y - 10]], el: 'physical' }, owner); }
  if (s.bomb) { inst.fx({ k: 'pop', id: t.id, text: '💣 2', c: '#ff9a2a' }, t); inst.timer(s.bomb, () => inst.area({ owner: owner.id, team: owner.team, x: t.x, y: t.y, shape: 'circle', r: 130, spec: { ...s, bomb: 0 }, mult: p.mult, delay: 0, show: true })); }
  if (s.orbHits) for (let i = 1; i < s.orbHits; i++) inst.timer(i * 0.1, () => { if (!t.dead) dealDamage(inst, owner, t, { ...s, knock: i === s.orbHits - 1 ? s.knock : 0 }, p.mult, { cx: p.x, cy: p.y }); });
}
export { push };
