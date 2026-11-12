// ===== Character stat computation (server authoritative; client uses it for display) =====
import { CLASS_BY_ID } from './classes.js';
import { ELEMENTS, MAX_LEVEL } from './constants.js';
import { itemStats, SETS, WEAPON_TYPES } from './items.js';
import { passiveEffects, WEAPON_CATEGORY } from './passives.js';
import { cardFor } from './world.js';

const add = (dst, src, mul = 1) => { for (const [k, v] of Object.entries(src)) dst[k] = (dst[k] || 0) + v * mul; };

// Ranked PvP: gear stats are replaced by a normalized template; build choices (skills, runes, passives,
// legendary/mythic/set *effects*) remain.
function normalizedGear(lv) {
  return { atk: Math.round((10 + lv * 2.4) * 1.2 * 1.25), armor: Math.round((6 + lv * 1.5) * 6.2), hp: 40 + lv * 12, crit: 8, critDmg: 35, atkSpd: 8, cdr: 8, res: 18, atkPct: 20 };
}

export function computeStats(char, opts = {}) {
  const cls = CLASS_BY_ID[char.classId];
  const lv = opts.normalize ? MAX_LEVEL : Math.min(MAX_LEVEL, char.level);
  const st = {};
  const leg = new Set(); const flags = new Set(); const setCount = {};
  const weapon = char.equip?.weapon;
  const weaponCat = weapon && weapon.dur > 0 ? WEAPON_CATEGORY[weapon.wtype] : null;
  if (opts.normalize) add(st, normalizedGear(lv));
  for (const it of Object.values(char.equip || {})) {
    if (!it || it.dur <= 0) continue;
    if (!opts.normalize) add(st, itemStats(it, cardFor));
    else if (it.mythic) add(st, itemStats({ ...it, implicit: {}, affixes: [], cards: [] }));
    if (it.legendary) leg.add(it.legendary);
    if (it.mythic) { leg.add(it.mythic); for (const f of ['noRegen']) if (it.mythic === 'crown') flags.add(f); }
    if (it.set) setCount[it.set] = (setCount[it.set] || 0) + 1;
  }
  const setBonuses = [];
  for (const [sid, n] of Object.entries(setCount)) {
    const s = SETS[sid]; if (!s) continue;
    if (n >= 2) { add(st, s.b2); setBonuses.push(`${s.name} (2)`); }
    if (n >= 4) { add(st, s.b4); setBonuses.push(`${s.name} (4)`); leg.add('set_' + sid); }
  }
  const pe = passiveEffects(char.classId, char.build?.passives, weaponCat);
  add(st, pe.stats);
  const g = cls.growth, b = cls.base;
  const attr = (k) => b[k] + g[k] * (lv - 1) + (st[k] || 0);
  const str = attr('str'), dex = attr('dex'), int = attr('int'), vit = attr('vit');
  const primary = { str, dex, int }[cls.primary];
  const out = {
    level: lv, str, dex, int, vit, weaponCat,
    hpMax: Math.round((b.hp + g.hp * (lv - 1) + vit * 8 + (st.hp || 0)) * (1 + (st.hpPct || 0) / 100)),
    mpMax: Math.round((b.mp + g.mp * (lv - 1) * 0.2 + (st.mp || 0)) * (1 + (st.mpPct || 0) / 100)),
    atk: Math.round(((st.atk || 0) + 5 + lv * 1.2 + primary * 1.6) * (1 + (st.atkPct || 0) / 100)),
    armor: Math.round(((st.armor || 0) + vit * 1.5) * (1 + (st.armorPct || 0) / 100)),
    crit: Math.min(75, 5 + (st.crit || 0) + dex * 0.01),
    critDmg: 50 + (st.critDmg || 0),
    atkSpd: st.atkSpd || 0,
    cdr: Math.min(60, st.cdr || 0),
    move: Math.max(80, 175 * (1 + (st.move || 0) / 100)),
    leech: st.leech || 0,
    hpRegen: flags.has('noRegen') ? 0 : 1 + vit * 0.08 + lv * 0.05 + (st.hpRegen || 0),
    mpRegen: cls.resource.regen + (st.mpRegen || 0),
    dmgAll: st.dmgAll || 0, dmgMelee: st.dmgMelee || 0, dmgRanged: st.dmgRanged || 0, dmgSpell: st.dmgSpell || 0, dmgDot: st.dmgDot || 0,
    dmgBoss: st.dmgBoss || 0, minionDmg: st.minionDmg || 0, healPower: st.healPower || 0, shieldPower: st.shieldPower || 0,
    statusPower: st.statusPower || 0, area: st.area || 0, dodge: Math.min(40, st.dodge || 0), block: Math.min(40, st.block || 0),
    dodgeCd: Math.min(60, st.dodgeCd || 0), magicFind: st.magicFind || 0, goldFind: st.goldFind || 0, expBonus: st.expBonus || 0,
    allSkills: st.allSkills || 0, chainBonus: st.chainBonus || 0,
    dmgEl: {}, res: {}, pen: {},
    ks: pe.ks, leg, flags, setBonuses,
  };
  for (const el of ELEMENTS) {
    out.dmgEl[el] = (st[`dmg_${el}`] || 0) + (el !== 'physical' ? st.dmgElAll || 0 : 0);
    out.res[el] = el === 'physical' ? 0 : Math.min(75, (st.res || 0) + (st[`res_${el}`] || 0));
    out.pen[el] = st[`pen_${el}`] || 0;
  }
  if (out.ks.has('colossus')) { out.dmgMelee += 10; out.area += 30; out.move *= 0.95; }
  if (out.ks.has('deadshot')) out.crit = Math.min(75, out.crit + 10);
  if (out.ks.has('juggernaut')) out.dmgTakenMul = 0.9;
  if (out.ks.has('bloodmagic')) out.leech *= 1.5;
  if (opts.normalize) out.normalized = true;
  return out;
}

export function monsterStats(lv, tpl, mul = {}) {
  const hp = (60 + lv * 28 + Math.pow(lv, 1.7) * 0.5) * (tpl.hp || 1) * (mul.hp || 1);
  const dmg = (7 + lv * 2.7 + Math.pow(lv, 1.5) * 0.05) * (tpl.dmg || 1) * (mul.dmg || 1);
  return {
    level: lv, hpMax: Math.round(hp), atk: Math.round(dmg), armor: Math.round(lv * 4 * (mul.armor || 1)), crit: 5, critDmg: 50,
    move: (tpl.spd || 90) * (mul.spd || 1), res: Object.fromEntries(ELEMENTS.map((e) => [e, e === tpl.el ? 25 : (mul.res || 0)])), pen: {},
    dmgEl: {}, dmgAll: 0, leech: mul.leech || 0, ks: new Set(), leg: new Set(), flags: new Set(),
  };
}
export { WEAPON_TYPES };
